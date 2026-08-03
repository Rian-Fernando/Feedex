import 'server-only';

import { AppError } from '@/lib/errors';

/**
 * The slice of GitHub's REST API Feedex uses.
 *
 * Deliberately not Octokit. Two endpoints are called — verify a repository is
 * reachable, and open an issue — and the official client brings a plugin
 * system, a throttling layer, and a paginator to do it. `fetch` covers this in
 * a hundred lines and keeps the dependency surface where it is.
 *
 * Every call is made with the token of the person who clicked the button, not
 * a shared service account. That means GitHub's own permissions decide what is
 * possible: someone who cannot open an issue on a repository cannot use Feedex
 * to do it either, and the issue is correctly attributed to them rather than
 * to a bot.
 */

const API = 'https://api.github.com';

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Feedex',
  };
}

/** `owner/name`, rejecting anything that is not exactly that. */
export function parseRepo(value: string): { owner: string; repo: string } {
  const match = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/.exec(value.trim());

  if (!match) {
    throw AppError.validation('Enter a repository as owner/name, for example rian/feedex.');
  }

  return { owner: match[1]!, repo: match[2]! };
}

export interface GithubIssue {
  number: number;
  url: string;
}

/**
 * Confirms the token can see the repository and open issues on it.
 *
 * Run when the repository is saved rather than when the first issue is filed,
 * so a typo is caught while someone is looking at the setting instead of three
 * days later when triage stalls.
 */
export async function verifyRepoAccess(token: string, repo: string): Promise<void> {
  const { owner, repo: name } = parseRepo(repo);
  const response = await fetch(`${API}/repos/${owner}/${name}`, { headers: headers(token) });

  if (response.status === 404) {
    throw AppError.notFound(
      'That repository was not found, or your GitHub account cannot see it. Private repositories need the repo scope.',
    );
  }

  if (response.status === 401) {
    throw AppError.unauthorized('Your GitHub connection has expired. Reconnect and try again.');
  }

  if (!response.ok) {
    throw AppError.validation('GitHub could not confirm access to that repository.');
  }

  const data = (await response.json()) as { has_issues?: boolean; archived?: boolean };

  if (data.archived) {
    throw AppError.validation('That repository is archived, so issues cannot be created on it.');
  }

  if (data.has_issues === false) {
    throw AppError.validation('Issues are disabled on that repository.');
  }
}

export interface CreateIssueInput {
  token: string;
  repo: string;
  title: string;
  body: string;
  labels?: string[];
}

export async function createIssue(input: CreateIssueInput): Promise<GithubIssue> {
  const { owner, repo } = parseRepo(input.repo);

  const response = await fetch(`${API}/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: { ...headers(input.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title.slice(0, 250),
      body: input.body,
      // Labels are best-effort: GitHub rejects the whole request if a label
      // does not exist on the repository, which is not worth failing over.
      ...(input.labels?.length ? { labels: input.labels } : {}),
    }),
  });

  if (response.status === 401) {
    throw AppError.unauthorized('Your GitHub connection has expired. Reconnect and try again.');
  }

  if (response.status === 403) {
    throw AppError.forbidden(
      'Your GitHub account is not allowed to open issues on that repository.',
    );
  }

  if (response.status === 422) {
    // Almost always a label that does not exist on the repo. Retry without
    // them rather than making the person go and create labels first.
    if (input.labels?.length) {
      return createIssue({ ...input, labels: undefined });
    }
    throw AppError.validation('GitHub rejected the issue.');
  }

  if (!response.ok) {
    throw AppError.validation('GitHub could not create the issue. Please try again.');
  }

  const data = (await response.json()) as { number: number; html_url: string };
  return { number: data.number, url: data.html_url };
}

/**
 * Renders a report as issue markdown.
 *
 * The context block is the reason this integration is worth having at all: a
 * report copied by hand loses the browser, the viewport, and the page it came
 * from, which is exactly what the person fixing it needs first.
 */
export function issueBody(input: {
  description: string;
  reference: number;
  projectName: string;
  reporterEmail: string | null;
  category: string;
  priority: string;
  context: Record<string, unknown>;
  attachments: Array<{ name: string }>;
  feedbackUrl: string;
}): string {
  const rows: Array<[string, string]> = [
    ['Project', input.projectName],
    ['Category', input.category],
    ['Priority', input.priority],
  ];

  const context = input.context as {
    url?: string;
    browser?: string;
    browserVersion?: string;
    os?: string;
    device?: string;
    viewport?: { width: number; height: number };
  };

  if (context.url) rows.push(['Page', context.url]);
  if (context.browser) {
    rows.push(['Browser', [context.browser, context.browserVersion].filter(Boolean).join(' ')]);
  }
  if (context.os) rows.push(['OS', context.os]);
  if (context.viewport) {
    rows.push(['Viewport', `${context.viewport.width} × ${context.viewport.height}`]);
  }
  if (input.reporterEmail) rows.push(['Reporter', input.reporterEmail]);

  const table = [
    '| | |',
    '| --- | --- |',
    ...rows.map(([key, value]) => `| **${key}** | ${value} |`),
  ].join('\n');

  const attachments = input.attachments.length
    ? `\n\n**Attachments:** ${input.attachments.map((file) => file.name).join(', ')} — viewable in Feedex.`
    : '';

  return `${input.description}\n\n---\n\n${table}${attachments}\n\n[View in Feedex](${input.feedbackUrl}) · Reported as #${input.reference}`;
}
