import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Tenant isolation, proven against a real database.
 *
 * Every other test in this repo is a pure unit test. This one is not, and it is
 * worth the cost: multi-tenancy is the property where a mistake is silent,
 * unrecoverable, and catastrophic — one workspace reading another's feedback is
 * not a bug report, it is a disclosure incident. Asserting it against mocks
 * would only prove that the mocks agree with the code.
 *
 * So this runs the actual service layer against an actual Postgres — PGlite,
 * the same engine and the same migrations used in development — with two fully
 * populated workspaces, and tries to reach across the boundary through every
 * exported read and write path.
 *
 * The data directory is a fresh temp folder per run, set before any module that
 * touches the database is imported, so this can never see or damage the
 * developer's local `.data/`.
 */

const dataDir = mkdtempSync(path.join(tmpdir(), 'feedex-isolation-'));

process.env.PGLITE_DATA_DIR = dataDir;
// Cleared so the PGlite branch is taken even on a machine that has a real
// database configured in its shell.
delete process.env.DATABASE_URL;

// Imported lazily so the environment above is in place first.
type Services = {
  db: typeof import('@/lib/db');
  schema: typeof import('@/lib/db/schema');
  projects: typeof import('@/server/services/projects');
  feedback: typeof import('@/server/services/feedback');
  apiAuth: typeof import('@/server/services/api-auth');
  ids: typeof import('@/lib/ids');
};

let s: Services;

interface Tenant {
  workspaceId: string;
  userId: string;
  projectId: string;
  publicKey: string;
  feedbackId: string;
  attachmentId: string;
}

let alpha: Tenant;
let beta: Tenant;

/** Creates a workspace with an owner, a project, a report, and an attachment. */
async function seedTenant(label: string): Promise<Tenant> {
  const db = await s.db.getDb();
  const { createId, ID_PREFIX } = s.ids;

  const userId = createId(ID_PREFIX.user);
  const workspaceId = createId(ID_PREFIX.workspace);

  await db.insert(s.schema.users).values({
    id: userId,
    email: `${label}@example.test`,
    name: `${label} owner`,
    passwordHash: 'scrypt$placeholder',
  });

  await db.insert(s.schema.workspaces).values({
    id: workspaceId,
    name: `${label} workspace`,
    slug: `${label}-workspace`,
  });

  await db.insert(s.schema.workspaceMembers).values({
    workspaceId,
    userId,
    role: 'owner',
  });

  const created = await s.projects.createProject(workspaceId, userId, {
    name: `${label} project`,
    environment: 'production',
    color: '#B58BF9',
  });

  const report = await s.feedback.ingestFeedback({
    workspaceId,
    projectId: created.project.id,
    category: 'bug',
    description: `A report that belongs to ${label} and nobody else.`,
    context: { url: `https://${label}.example.test/`, path: '/' },
    attachments: [
      {
        name: `${label}-screenshot.png`,
        type: 'image/png',
        // A one-pixel PNG; the bytes do not matter, only that a row exists.
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      },
    ],
  });

  const files = await s.feedback.listAttachments(workspaceId, report.id);
  expect(files).toHaveLength(1);

  return {
    workspaceId,
    userId,
    projectId: created.project.id,
    publicKey: created.publicKey,
    feedbackId: report.id,
    attachmentId: files[0]!.id,
  };
}

beforeAll(async () => {
  s = {
    db: await import('@/lib/db'),
    schema: await import('@/lib/db/schema'),
    projects: await import('@/server/services/projects'),
    feedback: await import('@/server/services/feedback'),
    apiAuth: await import('@/server/services/api-auth'),
    ids: await import('@/lib/ids'),
  };

  alpha = await seedTenant('alpha');
  beta = await seedTenant('beta');
}, 120_000);

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe('project reads are confined to the caller workspace', () => {
  it('lists only its own projects', async () => {
    const list = await s.projects.listProjects(alpha.workspaceId);

    expect(list.map((project) => project.id)).toContain(alpha.projectId);
    expect(list.map((project) => project.id)).not.toContain(beta.projectId);
  });

  it('cannot fetch another workspace project by id', async () => {
    expect(await s.projects.getProject(alpha.workspaceId, beta.projectId)).toBeNull();
  });

  it('refuses to resolve another workspace project', async () => {
    await expect(s.projects.requireProject(alpha.workspaceId, beta.projectId)).rejects.toThrow();
  });

  it('does not expose another workspace API keys', async () => {
    await expect(s.projects.listApiKeys(alpha.workspaceId, beta.projectId)).rejects.toThrow();
  });

  it('does not report another workspace project as connected', async () => {
    const connection = await s.projects.isProjectConnected(alpha.workspaceId, beta.projectId);
    expect(connection.connected).toBe(false);
  });
});

describe('project writes cannot cross the boundary', () => {
  it('refuses to update another workspace project', async () => {
    await expect(
      s.projects.updateProject(alpha.workspaceId, alpha.userId, beta.projectId, {
        name: 'Taken over',
        environment: 'production',
        color: '#ff0000',
      }),
    ).rejects.toThrow();

    const untouched = await s.projects.getProject(beta.workspaceId, beta.projectId);
    expect(untouched?.name).toBe('beta project');
  });

  it('refuses to restyle another workspace widget', async () => {
    await expect(
      s.projects.updateWidgetSettings(alpha.workspaceId, beta.projectId, {
        position: 'bottom-left',
        accentColor: '#ff0000',
        buttonLabel: 'Hijacked',
        launcherIcon: 'chat',
        title: 'Hijacked',
        description: 'Hijacked',
        successMessage: 'Hijacked',
        requireEmail: false,
        attachmentsEnabled: true,
        theme: 'auto',
        categories: ['bug'],
      }),
    ).rejects.toThrow();
  });

  it('refuses to delete another workspace project', async () => {
    await expect(
      s.projects.deleteProject(alpha.workspaceId, alpha.userId, beta.projectId),
    ).rejects.toThrow();

    expect(await s.projects.getProject(beta.workspaceId, beta.projectId)).not.toBeNull();
  });
});

describe('feedback is confined to the caller workspace', () => {
  it('lists only its own reports', async () => {
    const page = await s.feedback.listFeedback(alpha.workspaceId, {
      sort: 'newest',
      page: 1,
      perPage: 100,
    });

    expect(page.items.map((item) => item.id)).toContain(alpha.feedbackId);
    expect(page.items.map((item) => item.id)).not.toContain(beta.feedbackId);
  });

  it('cannot fetch another workspace report by id', async () => {
    expect(await s.feedback.getFeedback(alpha.workspaceId, beta.feedbackId)).toBeNull();
  });

  it('cannot filter its way into another workspace project', async () => {
    const page = await s.feedback.listFeedback(alpha.workspaceId, {
      // The project id is attacker-supplied here: it arrives as a query
      // parameter on the feedback list view.
      projectId: beta.projectId,
      sort: 'newest',
      page: 1,
      perPage: 100,
    });

    expect(page.items).toHaveLength(0);
  });

  it('cannot search across the boundary', async () => {
    const results = await s.feedback.searchFeedback(alpha.workspaceId, 'belongs to beta');
    expect(results).toHaveLength(0);
  });

  it('counts only its own reports in the dashboard stats', async () => {
    const stats = await s.feedback.getWorkspaceStats(alpha.workspaceId);

    // Alpha seeded exactly one project and one report. Beta seeded its own,
    // plus a second one through its public key — none of which may be counted
    // here.
    expect(stats.projects).toBe(1);
    expect(stats.totalFeedback).toBe(1);
  });

  it('refuses to triage another workspace report', async () => {
    await expect(
      s.feedback.updateFeedback(alpha.workspaceId, beta.feedbackId, { status: 'closed' }),
    ).rejects.toThrow();

    const untouched = await s.feedback.getFeedback(beta.workspaceId, beta.feedbackId);
    expect(untouched?.status).toBe('open');
  });

  it('does not delete another workspace report', async () => {
    await s.feedback.deleteFeedback(alpha.workspaceId, beta.feedbackId);

    // The delete is scoped rather than guarded, so it is a silent no-op. What
    // matters is that the row survives.
    expect(await s.feedback.getFeedback(beta.workspaceId, beta.feedbackId)).not.toBeNull();
  });

  it('cannot read another workspace internal notes', async () => {
    await s.feedback.createNote(
      beta.workspaceId,
      beta.feedbackId,
      beta.userId,
      'Only beta should ever see this.',
    );

    // The same call from alpha, against beta's report, must be refused rather
    // than silently writing a note into another tenant's thread.
    await expect(
      s.feedback.createNote(
        alpha.workspaceId,
        beta.feedbackId,
        alpha.userId,
        'Alpha should never be able to write here.',
      ),
    ).rejects.toThrow();

    expect(await s.feedback.listNotes(alpha.workspaceId, beta.feedbackId)).toHaveLength(0);
    expect(await s.feedback.listNotes(beta.workspaceId, beta.feedbackId)).toHaveLength(1);
  });
});

describe('attachments are confined to the caller workspace', () => {
  it('lists only its own attachments', async () => {
    expect(await s.feedback.listAttachments(alpha.workspaceId, beta.feedbackId)).toHaveLength(0);
    expect(await s.feedback.listAttachments(beta.workspaceId, beta.feedbackId)).toHaveLength(1);
  });

  it('cannot fetch another workspace attachment by id', async () => {
    // This is the case that matters for the download route: holding a valid
    // attachment id is not authorisation to read it.
    expect(await s.feedback.getAttachment(alpha.workspaceId, beta.attachmentId)).toBeNull();
    expect(await s.feedback.getAttachment(beta.workspaceId, beta.attachmentId)).not.toBeNull();
  });
});

describe('public keys authenticate to exactly one project', () => {
  it('resolves a key to its own workspace and no other', async () => {
    const context = await s.apiAuth.authenticateApiKey(beta.publicKey, 'public');

    expect(context.workspaceId).toBe(beta.workspaceId);
    expect(context.project.id).toBe(beta.projectId);
    expect(context.workspaceId).not.toBe(alpha.workspaceId);
  });

  it('rejects a key that does not exist', async () => {
    await expect(s.apiAuth.authenticateApiKey('pk_fdx_not_a_real_key', 'public')).rejects.toThrow();
  });

  it('routes an ingested report to the key owner workspace', async () => {
    const context = await s.apiAuth.authenticateApiKey(beta.publicKey, 'public');

    const report = await s.feedback.ingestFeedback({
      workspaceId: context.workspaceId,
      projectId: context.project.id,
      category: 'ui',
      description: 'Submitted through the beta public key.',
      context: { url: 'https://beta.example.test/', path: '/' },
    });

    expect(report.workspaceId).toBe(beta.workspaceId);
    expect(await s.feedback.getFeedback(alpha.workspaceId, report.id)).toBeNull();
  });
});

describe('onboarding status does not leak across tenants', () => {
  it('reports only the caller own project', async () => {
    const status = await s.projects.getOnboarding(alpha.workspaceId);
    expect(status.project?.id).toBe(alpha.projectId);
  });
});
