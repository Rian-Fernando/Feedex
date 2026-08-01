import 'server-only';

import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import { getDb, type Database } from '@/lib/db';
import {
  apiKeys,
  feedback,
  projects,
  type ApiKey,
  type Project,
  type WidgetSettings,
} from '@/lib/db/schema';
import { createId, ID_PREFIX, slugify, uniquifySlug } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import { generateApiKey } from '@/lib/auth/api-keys';
import { OPEN_STATUSES } from '@/lib/taxonomy';
import type { CreateProjectInput, UpdateProjectInput, WidgetSettingsInput } from '@/lib/validation';
import { recordActivity } from './activity';

/**
 * Project operations.
 *
 * Every function takes `workspaceId` as its first argument and filters on it.
 * That is the single invariant preventing cross-tenant reads: a caller who has
 * only authenticated but not authorised still cannot name another workspace's
 * project id and receive data.
 */

export const DEFAULT_WIDGET_SETTINGS: Required<
  Pick<
    WidgetSettings,
    | 'position'
    | 'accentColor'
    | 'buttonLabel'
    | 'title'
    | 'description'
    | 'successMessage'
    | 'requireEmail'
    | 'theme'
    | 'categories'
  >
> = {
  position: 'bottom-right',
  accentColor: '#B58BF9',
  buttonLabel: 'Feedback',
  title: 'Send feedback',
  description: 'Found a bug or have an idea? Let us know.',
  successMessage: 'Thanks — your feedback has been received.',
  requireEmail: false,
  theme: 'auto',
  categories: ['bug', 'feature', 'ui', 'other'],
};

export interface ProjectWithStats extends Project {
  totalFeedback: number;
  openFeedback: number;
  publicKey: string | null;
}

export async function listProjects(workspaceId: string): Promise<ProjectWithStats[]> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(desc(projects.createdAt));

  if (rows.length === 0) return [];

  const projectIds = rows.map((row) => row.id);

  // Two grouped queries rather than a per-project count, so the list view stays
  // at a constant number of round trips as projects are added.
  const [totals, opens, publicKeys] = await Promise.all([
    db
      .select({ projectId: feedback.projectId, value: count() })
      .from(feedback)
      .where(inArray(feedback.projectId, projectIds))
      .groupBy(feedback.projectId),
    db
      .select({ projectId: feedback.projectId, value: count() })
      .from(feedback)
      .where(
        and(inArray(feedback.projectId, projectIds), inArray(feedback.status, [...OPEN_STATUSES])),
      )
      .groupBy(feedback.projectId),
    db
      .select({ projectId: apiKeys.projectId, keyHash: apiKeys.keyHash })
      .from(apiKeys)
      .where(
        and(
          inArray(apiKeys.projectId, projectIds),
          eq(apiKeys.type, 'public'),
          sql`${apiKeys.revokedAt} is null`,
        ),
      ),
  ]);

  const totalMap = new Map(totals.map((row) => [row.projectId, row.value]));
  const openMap = new Map(opens.map((row) => [row.projectId, row.value]));
  const keyMap = new Map(publicKeys.map((row) => [row.projectId, row.keyHash]));

  return rows.map((row) => ({
    ...row,
    totalFeedback: totalMap.get(row.id) ?? 0,
    openFeedback: openMap.get(row.id) ?? 0,
    publicKey: keyMap.get(row.id) ?? null,
  }));
}

export async function getProject(workspaceId: string, projectId: string): Promise<Project | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function requireProject(workspaceId: string, projectId: string): Promise<Project> {
  const project = await getProject(workspaceId, projectId);
  if (!project) throw AppError.notFound('Project not found.');
  return project;
}

/**
 * Creates a project together with its initial public and secret keys.
 *
 * The keys are generated in the same transaction as the project so a project
 * can never exist in a state where the widget snippet cannot be shown.
 */
export async function createProject(
  workspaceId: string,
  actorId: string,
  input: CreateProjectInput,
): Promise<{ project: Project; publicKey: string; secretKey: string }> {
  const db = await getDb();
  const slug = await uniqueProjectSlug(db, workspaceId, slugify(input.name) || 'project');

  const projectId = createId(ID_PREFIX.project);
  const publicKey = generateApiKey('public');
  const secretKey = generateApiKey('secret');

  const project = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(projects)
      .values({
        id: projectId,
        workspaceId,
        name: input.name,
        slug,
        description: input.description || null,
        domain: input.domain || null,
        environment: input.environment,
        color: input.color,
        widgetSettings: { ...DEFAULT_WIDGET_SETTINGS, accentColor: input.color },
      })
      .returning();

    const row = inserted[0];
    if (!row) throw new Error('Failed to create project.');

    await tx.insert(apiKeys).values([
      {
        id: createId(ID_PREFIX.apiKey),
        projectId,
        workspaceId,
        type: 'public',
        name: 'Default public key',
        keyHash: publicKey.storedHash,
        keyPrefix: publicKey.prefix,
      },
      {
        id: createId(ID_PREFIX.apiKey),
        projectId,
        workspaceId,
        type: 'secret',
        name: 'Default secret key',
        keyHash: secretKey.storedHash,
        keyPrefix: secretKey.prefix,
      },
    ]);

    await recordActivity(
      {
        workspaceId,
        actorId,
        action: 'project.created',
        targetType: 'project',
        targetId: projectId,
        metadata: { name: row.name },
      },
      tx as unknown as Database,
    );

    return row;
  });

  return { project, publicKey: publicKey.token, secretKey: secretKey.token };
}

async function uniqueProjectSlug(db: Database, workspaceId: string, base: string): Promise<string> {
  const existing = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.slug, base)))
    .limit(1);

  return existing.length === 0 ? base : uniquifySlug(base);
}

export async function updateProject(
  workspaceId: string,
  actorId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  const db = await getDb();
  await requireProject(workspaceId, projectId);

  const rows = await db
    .update(projects)
    .set({
      name: input.name,
      description: input.description || null,
      domain: input.domain || null,
      environment: input.environment,
      color: input.color,
      ...(input.status ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
    .returning();

  const project = rows[0];
  if (!project) throw AppError.notFound('Project not found.');

  await recordActivity({
    workspaceId,
    actorId,
    action: 'project.updated',
    targetType: 'project',
    targetId: projectId,
    metadata: { name: project.name },
  });

  return project;
}

export async function updateWidgetSettings(
  workspaceId: string,
  projectId: string,
  input: WidgetSettingsInput,
): Promise<Project> {
  const db = await getDb();
  await requireProject(workspaceId, projectId);

  const rows = await db
    .update(projects)
    .set({ widgetSettings: input, updatedAt: new Date() })
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
    .returning();

  const project = rows[0];
  if (!project) throw AppError.notFound('Project not found.');
  return project;
}

export async function deleteProject(
  workspaceId: string,
  actorId: string,
  projectId: string,
): Promise<void> {
  const db = await getDb();
  const project = await requireProject(workspaceId, projectId);

  await db
    .delete(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)));

  await recordActivity({
    workspaceId,
    actorId,
    action: 'project.deleted',
    targetType: 'project',
    targetId: projectId,
    metadata: { name: project.name },
  });
}

/* ------------------------------- API keys -------------------------------- */

export interface ApiKeyView {
  id: string;
  type: 'public' | 'secret';
  name: string;
  keyPrefix: string;
  /** Present only for public keys, which are not secret by design. */
  publicValue: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export async function listApiKeys(workspaceId: string, projectId: string): Promise<ApiKeyView[]> {
  const db = await getDb();
  await requireProject(workspaceId, projectId);

  const rows = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.workspaceId, workspaceId),
        eq(apiKeys.projectId, projectId),
        sql`${apiKeys.revokedAt} is null`,
      ),
    )
    .orderBy(apiKeys.type, desc(apiKeys.createdAt));

  return rows.map(toApiKeyView);
}

function toApiKeyView(row: ApiKey): ApiKeyView {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    keyPrefix: row.keyPrefix,
    publicValue: row.type === 'public' ? row.keyHash : null,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Issues a new key and revokes the previous one of the same type.
 *
 * Revocation is a soft delete so that a leaked key's usage history stays
 * auditable after rotation.
 */
export async function rotateApiKey(
  workspaceId: string,
  actorId: string,
  projectId: string,
  type: 'public' | 'secret',
): Promise<{ token: string }> {
  const db = await getDb();
  await requireProject(workspaceId, projectId);

  const generated = generateApiKey(type);

  await db.transaction(async (tx) => {
    await tx
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(apiKeys.workspaceId, workspaceId),
          eq(apiKeys.projectId, projectId),
          eq(apiKeys.type, type),
          sql`${apiKeys.revokedAt} is null`,
        ),
      );

    await tx.insert(apiKeys).values({
      id: createId(ID_PREFIX.apiKey),
      projectId,
      workspaceId,
      type,
      name: type === 'public' ? 'Default public key' : 'Default secret key',
      keyHash: generated.storedHash,
      keyPrefix: generated.prefix,
    });
  });

  await recordActivity({
    workspaceId,
    actorId,
    action: 'api_key.created',
    targetType: 'project',
    targetId: projectId,
    metadata: { type },
  });

  return { token: generated.token };
}

export async function revokeApiKey(
  workspaceId: string,
  actorId: string,
  projectId: string,
  keyId: string,
): Promise<void> {
  const db = await getDb();
  await requireProject(workspaceId, projectId);

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.workspaceId, workspaceId),
        eq(apiKeys.projectId, projectId),
        eq(apiKeys.id, keyId),
      ),
    );

  await recordActivity({
    workspaceId,
    actorId,
    action: 'api_key.revoked',
    targetType: 'project',
    targetId: projectId,
    metadata: { keyId },
  });
}

/** The public key a project's widget snippet should embed. */
export async function getPublicKey(workspaceId: string, projectId: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select({ keyHash: apiKeys.keyHash })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.workspaceId, workspaceId),
        eq(apiKeys.projectId, projectId),
        eq(apiKeys.type, 'public'),
        sql`${apiKeys.revokedAt} is null`,
      ),
    )
    .limit(1);

  return rows[0]?.keyHash ?? null;
}
