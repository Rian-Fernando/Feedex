import { loadEnv } from './load-env';

loadEnv();

/**
 * Seeds a realistic development workspace.
 *
 * Populates two projects with feedback spread across categories, statuses,
 * priorities, and the last three weeks, so the dashboard's charts, filters, and
 * empty states can all be exercised without waiting for real traffic.
 *
 * Idempotent: running it twice does not create a second copy of the demo
 * account. Refuses to run against production.
 */

const DEMO_EMAIL = 'demo@feedex.dev';
const DEMO_PASSWORD = 'feedex-demo-2026';

interface SeedFeedback {
  project: 0 | 1;
  category: 'bug' | 'feature' | 'ui' | 'performance' | 'content' | 'question' | 'other';
  status: 'open' | 'in_progress' | 'testing' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  email?: string;
  path: string;
  browser: string;
  browserVersion: string;
  os: string;
  device: 'desktop' | 'tablet' | 'mobile';
  viewport: [number, number];
  /** Days in the past. */
  age: number;
}

const FEEDBACK: SeedFeedback[] = [
  {
    project: 0,
    category: 'bug',
    status: 'open',
    priority: 'critical',
    title: 'Export button does nothing on the reports page',
    description:
      'Clicking "Export CSV" on the reports page does nothing at all. No download starts and no error appears. The console shows a 500 from /api/export. This worked last week.',
    email: 'priya@example.com',
    path: '/reports',
    browser: 'Chrome',
    browserVersion: '131.0.6778',
    os: 'macOS 15.2',
    device: 'desktop',
    viewport: [1512, 858],
    age: 0,
  },
  {
    project: 0,
    category: 'ui',
    status: 'open',
    priority: 'medium',
    title: 'Sidebar overlaps content between 900 and 1024 pixels',
    description:
      'At tablet widths the sidebar sits on top of the main column instead of collapsing. Everything below the header is unreadable until I rotate to portrait.',
    email: 'marcus@example.com',
    path: '/dashboard',
    browser: 'Safari',
    browserVersion: '18.2',
    os: 'iOS 18.2',
    device: 'tablet',
    viewport: [1024, 768],
    age: 1,
  },
  {
    project: 0,
    category: 'feature',
    status: 'in_progress',
    priority: 'high',
    title: 'Let me filter the activity feed by team member',
    description:
      'The activity timeline is useful but noisy once more than two people are working. Being able to filter to one person would make standups much faster.',
    email: 'dana@example.com',
    path: '/activity',
    browser: 'Firefox',
    browserVersion: '134.0',
    os: 'Windows',
    device: 'desktop',
    viewport: [1920, 1080],
    age: 2,
  },
  {
    project: 0,
    category: 'performance',
    status: 'testing',
    priority: 'high',
    title: 'Dashboard takes eight seconds to load with a large workspace',
    description:
      'With around 4,000 items the overview page takes about eight seconds before anything renders. The network tab shows one request sitting pending the whole time.',
    email: 'sam@example.com',
    path: '/dashboard',
    browser: 'Chrome',
    browserVersion: '130.0.6723',
    os: 'Windows',
    device: 'desktop',
    viewport: [2560, 1440],
    age: 4,
  },
  {
    project: 0,
    category: 'bug',
    status: 'resolved',
    priority: 'high',
    title: 'Session expires after about ten minutes of inactivity',
    description:
      'I get signed out constantly. Leaving the tab for a short while and coming back always lands me on the login screen.',
    email: 'alex@example.com',
    path: '/settings',
    browser: 'Edge',
    browserVersion: '131.0.2903',
    os: 'Windows',
    device: 'desktop',
    viewport: [1680, 1050],
    age: 6,
  },
  {
    project: 0,
    category: 'question',
    status: 'closed',
    priority: 'low',
    title: 'Is there a way to export everything as JSON?',
    description:
      'I would like to keep an offline archive. CSV loses the nested context object, so JSON would be much better for this.',
    email: 'jordan@example.com',
    path: '/settings/export',
    browser: 'Chrome',
    browserVersion: '131.0.6778',
    os: 'Linux',
    device: 'desktop',
    viewport: [1920, 1080],
    age: 9,
  },
  {
    project: 1,
    category: 'ui',
    status: 'open',
    priority: 'medium',
    title: 'Footer links wrap awkwardly at 375 pixels',
    description:
      'On an iPhone SE the footer navigation wraps so that a single link sits alone on its own line. It looks broken rather than intentional.',
    path: '/',
    browser: 'Safari',
    browserVersion: '18.1',
    os: 'iOS 18.1',
    device: 'mobile',
    viewport: [375, 667],
    age: 1,
  },
  {
    project: 1,
    category: 'content',
    status: 'open',
    priority: 'low',
    title: 'The about page still says "last updated 2023"',
    description: 'Small thing, but the date at the bottom of the about page is two years stale.',
    email: 'chris@example.com',
    path: '/about',
    browser: 'Firefox',
    browserVersion: '133.0',
    os: 'macOS 14.6',
    device: 'desktop',
    viewport: [1440, 900],
    age: 3,
  },
  {
    project: 1,
    category: 'feature',
    status: 'in_progress',
    priority: 'medium',
    title: 'Add an RSS feed for the writing section',
    description:
      'I would subscribe if there were a feed. Right now I have to remember to check the site, which means I mostly do not.',
    email: 'lena@example.com',
    path: '/writing',
    browser: 'Chrome',
    browserVersion: '131.0.6778',
    os: 'macOS 15.1',
    device: 'desktop',
    viewport: [1728, 1117],
    age: 5,
  },
  {
    project: 1,
    category: 'bug',
    status: 'resolved',
    priority: 'medium',
    title: 'Project images do not load on slow connections',
    description:
      'On mobile data the project thumbnails stay blank. They appear immediately on wifi, so it looks like a timeout rather than a missing file.',
    path: '/projects',
    browser: 'Samsung Internet',
    browserVersion: '27.0',
    os: 'Android 15',
    device: 'mobile',
    viewport: [412, 915],
    age: 8,
  },
  {
    project: 1,
    category: 'performance',
    status: 'resolved',
    priority: 'low',
    title: 'Hero animation drops frames on older laptops',
    description:
      'The landing animation is choppy on a 2017 MacBook Air. Not a blocker, but it makes the page feel heavier than it is.',
    email: 'toni@example.com',
    path: '/',
    browser: 'Safari',
    browserVersion: '17.6',
    os: 'macOS 14.6',
    device: 'desktop',
    viewport: [1440, 900],
    age: 12,
  },
  {
    project: 1,
    category: 'other',
    status: 'closed',
    priority: 'low',
    title: 'Just wanted to say the redesign looks great',
    description: 'No issue — the new layout is a big improvement. Much easier to scan.',
    email: 'wei@example.com',
    path: '/',
    browser: 'Chrome',
    browserVersion: '130.0.6723',
    os: 'Windows',
    device: 'desktop',
    viewport: [1920, 1080],
    age: 16,
  },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('[seed] refusing to seed a production environment.');
    process.exit(1);
  }

  const { getDb } = await import('../src/lib/db');
  const { feedback: feedbackTable } = await import('../src/lib/db/schema');
  const { registerUser, findUserByEmail } = await import('../src/server/services/accounts');
  const { listUserWorkspaces } = await import('../src/server/services/workspaces');
  const { createProject, listProjects } = await import('../src/server/services/projects');
  const { ingestFeedback } = await import('../src/server/services/feedback');
  const { eq } = await import('drizzle-orm');

  const db = await getDb();

  let user = await findUserByEmail(DEMO_EMAIL);
  let workspaceId: string;

  if (user) {
    console.log('[seed] demo account already exists — reusing it');
    const workspaces = await listUserWorkspaces(user.id);
    const workspace = workspaces[0];
    if (!workspace) throw new Error('Demo user exists but has no workspace.');
    workspaceId = workspace.id;
  } else {
    const result = await registerUser({
      name: 'Demo Developer',
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      workspaceName: 'Demo workspace',
    });
    user = result.user;
    workspaceId = result.workspaceId;
    console.log('[seed] created demo account');
  }

  const existingProjects = await listProjects(workspaceId);
  const projects: Array<{ id: string; name: string; publicKey: string }> = [];

  const definitions = [
    {
      name: 'Dashboard',
      description: 'Internal analytics dashboard used by the operations team.',
      domain: 'app.example.com',
      color: '#B58BF9',
      environment: 'production' as const,
    },
    {
      name: 'Portfolio',
      description: 'Personal portfolio and writing.',
      domain: 'example.com',
      color: '#10b981',
      environment: 'production' as const,
    },
  ];

  for (const definition of definitions) {
    const existing = existingProjects.find((project) => project.name === definition.name);

    if (existing) {
      projects.push({
        id: existing.id,
        name: existing.name,
        publicKey: existing.publicKey ?? '(rotated)',
      });
      continue;
    }

    const created = await createProject(workspaceId, user.id, definition);
    projects.push({
      id: created.project.id,
      name: created.project.name,
      publicKey: created.publicKey,
    });
    console.log(`[seed] created project "${created.project.name}"`);
  }

  const alreadySeeded = await db
    .select({ id: feedbackTable.id })
    .from(feedbackTable)
    .where(eq(feedbackTable.workspaceId, workspaceId))
    .limit(1);

  if (alreadySeeded.length > 0) {
    console.log('[seed] feedback already present — skipping');
  } else {
    for (const item of FEEDBACK) {
      const project = projects[item.project];
      if (!project) continue;

      const created = await ingestFeedback({
        workspaceId,
        projectId: project.id,
        category: item.category,
        title: item.title,
        description: item.description,
        reporterEmail: item.email ?? null,
        priority: item.priority,
        context: {
          url: `https://${item.project === 0 ? 'app.example.com' : 'example.com'}${item.path}`,
          path: item.path,
          browser: item.browser,
          browserVersion: item.browserVersion,
          os: item.os,
          device: item.device,
          viewport: { width: item.viewport[0], height: item.viewport[1] },
          screen: { width: item.viewport[0], height: item.viewport[1] },
          language: 'en-US',
          timezone: 'America/New_York',
        },
      });

      // `ingestFeedback` always stamps "now"; backdate afterwards so the
      // 14-day trend chart has something to plot.
      const createdAt = new Date(Date.now() - item.age * 24 * 60 * 60 * 1000);
      const isClosed = item.status === 'resolved' || item.status === 'closed';

      await db
        .update(feedbackTable)
        .set({
          status: item.status,
          createdAt,
          updatedAt: createdAt,
          resolvedAt: isClosed ? new Date(createdAt.getTime() + 6 * 60 * 60 * 1000) : null,
        })
        .where(eq(feedbackTable.id, created.id));
    }

    console.log(`[seed] created ${FEEDBACK.length} feedback items`);
  }

  console.log('');
  console.log('  Demo account');
  console.log(`    email:    ${DEMO_EMAIL}`);
  console.log(`    password: ${DEMO_PASSWORD}`);
  console.log('');
  console.log('  Projects');
  for (const project of projects) {
    console.log(`    ${project.name.padEnd(12)} ${project.publicKey}`);
  }
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[seed] failed');
    console.error(error);
    process.exit(1);
  });
