import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Marked } from 'marked';

/**
 * The documentation, rendered from the same Markdown the repository ships.
 *
 * There is exactly one copy of every guide. Maintaining a prose version of the
 * install instructions for the website and another for GitHub guarantees the
 * two disagree, and the one that goes stale is always the one fewer people
 * edit. These pages read `docs/*.md` directly, so a correction lands in both
 * places at once.
 *
 * Everything here runs at build time — the pages are statically generated — so
 * the Markdown parser never reaches a browser and no file is read while
 * serving a request.
 */

export interface DocHeading {
  id: string;
  text: string;
}

export interface DocPage {
  slug: string;
  /** Nav label, which is usually shorter than the document's own H1. */
  title: string;
  description: string;
  /** Order in the sidebar and on the index. */
  order: number;
  html: string;
  headings: DocHeading[];
}

/**
 * The guides published on the site, in reading order.
 *
 * An allowlist rather than a directory scan: ROADMAP and ARCHITECTURE are
 * written for people working on Feedex, not people integrating it, and
 * publishing them under /docs would bury the four pages that answer "how do I
 * use this".
 */
const PUBLISHED = [
  {
    slug: 'quickstart',
    file: 'ADDING_PROJECTS.md',
    title: 'Quickstart',
    description:
      'Put the widget on a site in three steps: create a project, paste one script tag, style it from the dashboard.',
  },
  {
    slug: 'widget',
    file: 'WIDGET.md',
    title: 'Widget',
    description:
      'Every configuration option, the JavaScript API, attachments, accessibility, and browser support.',
  },
  {
    slug: 'api',
    file: 'API.md',
    title: 'API',
    description:
      'REST reference for ingestion, widget configuration, and reading feedback back out — with keys, errors, and rate limits.',
  },
  {
    slug: 'self-hosting',
    file: 'DEPLOYMENT.md',
    title: 'Self-hosting',
    description: 'Run your own instance: Postgres, environment variables, migrations, and DNS.',
  },
] as const;

export type DocSlug = (typeof PUBLISHED)[number]['slug'];

/** Maps a repo-relative Markdown link onto its published route. */
const ROUTE_BY_FILE = new Map(PUBLISHED.map((doc) => [doc.file, `/docs/${doc.slug}`]));

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Rewrites the cross-references the Markdown uses on GitHub.
 *
 * The files link to each other by filename, which is correct in a repository
 * and a dead end on a website. Anything that maps to a published page becomes
 * an internal route; anything that does not — ARCHITECTURE.md, ROADMAP.md —
 * becomes a link to the file on GitHub rather than a 404.
 */
function rewriteLink(href: string, repoUrl: string): string {
  if (/^https?:|^#|^mailto:/.test(href)) return href;

  const file = href.replace(/^\.?\/?(docs\/)?/, '');
  const [name, hash] = file.split('#');

  const route = name ? ROUTE_BY_FILE.get(name) : undefined;
  if (route) return hash ? `${route}#${hash}` : route;

  if (name?.endsWith('.md')) return `${repoUrl}/blob/main/docs/${name}`;

  return href;
}

function render(markdown: string, repoUrl: string): { html: string; headings: DocHeading[] } {
  const headings: DocHeading[] = [];
  const marked = new Marked({ gfm: true });

  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = text.replace(/<[^>]+>/g, '');
        const id = slugifyHeading(plain);

        // Only H2s reach the sidebar. H3s are usually a request/response pair
        // inside one endpoint and would double the list without adding a
        // destination anyone navigates to.
        if (depth === 2) headings.push({ id, text: plain });

        // The anchor is the heading itself, so the link icon does not need a
        // hover target that is invisible on touch.
        return `<h${depth} id="${id}"><a class="doc-anchor" href="#${id}">${text}</a></h${depth}>`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const resolved = rewriteLink(href, repoUrl);
        const external = /^https?:/.test(resolved);
        const attrs = [
          `href="${resolved}"`,
          title ? `title="${title}"` : '',
          external ? 'target="_blank" rel="noopener noreferrer"' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return `<a ${attrs}>${text}</a>`;
      },
      // Tables are wide by nature — the API reference has a six-column one —
      // and a page that scrolls sideways is a broken page. Each gets its own
      // scroll container instead.
      table(token) {
        const header = token.header
          .map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`)
          .join('');

        const body = token.rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`,
          )
          .join('');

        return `<div class="doc-table"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
      },
    },
  });

  return { html: marked.parse(markdown) as string, headings };
}

/**
 * Strips the document's own H1.
 *
 * The page renders the title in its header, and a second copy immediately
 * below it reads as a mistake.
 */
function stripTitle(markdown: string): string {
  return markdown.replace(/^#\s+.*\n+/, '');
}

export function docSlugs(): DocSlug[] {
  return PUBLISHED.map((doc) => doc.slug);
}

/** Metadata only — used by the index and the sidebar, and cheap to call. */
export function docSummaries(): Array<Pick<DocPage, 'slug' | 'title' | 'description' | 'order'>> {
  return PUBLISHED.map((doc, index) => ({
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    order: index,
  }));
}

export function getDoc(slug: string, repoUrl: string): DocPage | null {
  const index = PUBLISHED.findIndex((doc) => doc.slug === slug);
  if (index === -1) return null;

  const doc = PUBLISHED[index]!;
  const source = readFileSync(path.join(process.cwd(), 'docs', doc.file), 'utf8');
  const { html, headings } = render(stripTitle(source), repoUrl);

  return {
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    order: index,
    html,
    headings,
  };
}
