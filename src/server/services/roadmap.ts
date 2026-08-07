import 'server-only';

import { and, asc, desc, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { feedback, projects, workspaceLabels } from '@/lib/db/schema';

/**
 * The public roadmap.
 *
 * This is the only read path in the product that is not scoped to a session,
 * so it is written defensively. It selects columns explicitly rather than
 * returning rows — a `select()` here would ship reporter emails, IP-derived
 * context, and internal notes to the open internet the first time someone
 * added a column and forgot this file existed.
 *
 * Three gates have to agree before anything is visible: the project publishes a
 * roadmap, the status is marked public, and the individual item is marked
 * public. Any one of them off hides it.
 */

export interface RoadmapItem {
  id: string;
  title: string;
  category: string;
  categoryTone: string;
  createdAt: Date;
}

export interface RoadmapColumn {
  key: string;
  label: string;
  tone: string;
  lifecycle: string;
  items: RoadmapItem[];
}

export interface PublicRoadmap {
  projectName: string;
  projectDescription: string | null;
  accentColor: string;
  columns: RoadmapColumn[];
}

export async function getPublicRoadmap(publicSlug: string): Promise<PublicRoadmap | null> {
  const db = await getDb();

  const projectRows = await db
    .select({
      id: projects.id,
      workspaceId: projects.workspaceId,
      name: projects.name,
      description: projects.description,
      color: projects.color,
      roadmapEnabled: projects.roadmapEnabled,
    })
    .from(projects)
    .where(eq(projects.publicSlug, publicSlug))
    .limit(1);

  const project = projectRows[0];
  // Disabled reads as absent rather than forbidden: a 404 does not confirm
  // that a project by this name exists.
  if (!project || !project.roadmapEnabled) return null;

  const [statuses, categories, items] = await Promise.all([
    db
      .select({
        key: workspaceLabels.key,
        label: workspaceLabels.label,
        tone: workspaceLabels.tone,
        lifecycle: workspaceLabels.lifecycle,
      })
      .from(workspaceLabels)
      .where(
        and(
          eq(workspaceLabels.workspaceId, project.workspaceId),
          eq(workspaceLabels.kind, 'status'),
          eq(workspaceLabels.isPublic, true),
        ),
      )
      .orderBy(asc(workspaceLabels.position)),

    db
      .select({
        key: workspaceLabels.key,
        label: workspaceLabels.label,
        tone: workspaceLabels.tone,
      })
      .from(workspaceLabels)
      .where(
        and(
          eq(workspaceLabels.workspaceId, project.workspaceId),
          eq(workspaceLabels.kind, 'category'),
        ),
      ),

    db
      .select({
        id: feedback.id,
        title: feedback.title,
        publicTitle: feedback.publicTitle,
        category: feedback.category,
        status: feedback.status,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .where(
        and(
          eq(feedback.projectId, project.id),
          eq(feedback.isPublic, true),
          // Descriptions are never selected at all, so there is no path by
          // which one reaches this page.
        ),
      )
      .orderBy(desc(feedback.createdAt))
      .limit(300),
  ]);

  const categoryByKey = new Map(categories.map((entry) => [entry.key, entry]));
  const publicStatusKeys = new Set(statuses.map((entry) => entry.key));

  const columns: RoadmapColumn[] = statuses.map((status) => ({
    key: status.key,
    label: status.label,
    tone: status.tone,
    lifecycle: status.lifecycle,
    items: items
      .filter((item) => item.status === status.key && publicStatusKeys.has(item.status))
      .map((item) => ({
        id: item.id,
        // The reporter's own wording is a derived first sentence and is often
        // not something to publish, so an override wins when one is set.
        title: item.publicTitle ?? item.title,
        category: categoryByKey.get(item.category)?.label ?? item.category,
        categoryTone: categoryByKey.get(item.category)?.tone ?? 'neutral',
        createdAt: item.createdAt,
      })),
  }));

  return {
    projectName: project.name,
    projectDescription: project.description,
    accentColor: project.color,
    columns,
  };
}

/** Every published slug, for the sitemap. */
export async function listPublicRoadmapSlugs(): Promise<string[]> {
  const db = await getDb();

  const rows = await db
    .select({ slug: projects.publicSlug })
    .from(projects)
    .where(eq(projects.roadmapEnabled, true));

  return rows.map((row) => row.slug).filter((slug): slug is string => Boolean(slug));
}
