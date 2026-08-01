'use server';

import { requireWorkspaceOrThrow } from '@/lib/auth';
import { searchFeedback } from '@/server/services/feedback';
import { listProjects } from '@/server/services/projects';

/** Backing action for the dashboard command palette. */

export interface SearchHit {
  type: 'feedback' | 'project';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function searchAction(query: string): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const context = await requireWorkspaceOrThrow();

    const [feedback, projects] = await Promise.all([
      searchFeedback(context.workspaceId, trimmed, 6),
      listProjects(context.workspaceId),
    ]);

    const lower = trimmed.toLowerCase();

    // Projects are few enough to filter in memory; feedback is not, which is
    // why only the former is fetched wholesale.
    const projectHits: SearchHit[] = projects
      .filter((project) => project.name.toLowerCase().includes(lower))
      .slice(0, 4)
      .map((project) => ({
        type: 'project',
        id: project.id,
        title: project.name,
        subtitle: project.domain ?? 'No domain set',
        href: `/dashboard/projects/${project.id}`,
      }));

    const feedbackHits: SearchHit[] = feedback.map((item) => ({
      type: 'feedback',
      id: item.id,
      title: item.title,
      subtitle: `${item.projectName} · #${item.reference}`,
      href: `/dashboard/feedback/${item.id}`,
    }));

    return [...projectHits, ...feedbackHits];
  } catch {
    // The palette is a convenience; a failure here should close quietly rather
    // than surface an error over the whole dashboard.
    return [];
  }
}
