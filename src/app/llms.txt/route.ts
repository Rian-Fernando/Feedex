import { siteConfig } from '@/config/site';

/**
 * /llms.txt
 *
 * Follows the llms.txt convention: a single Markdown document, led by an H1 and
 * a one-paragraph blockquote summary, that gives a language model the facts
 * about this product without making it parse the marketing page.
 *
 * Served from a route handler rather than `public/` so the URLs stay derived
 * from `siteConfig` and cannot go stale when the domain changes.
 *
 * Everything here is factual and verifiable against the source. Nothing is
 * aspirational — a model that quotes this file should never end up describing a
 * feature that does not exist.
 */

export const dynamic = 'force-static';

function body(): string {
  const url = siteConfig.url;
  const repo = siteConfig.links.github;

  return `# Feedex

> Feedex is a lightweight, open-source developer feedback platform. Developers install a single script tag on any web application, and the bugs, feature requests, and UI issues their users submit are collected into one centralised dashboard — with page URL, browser, operating system, device, and viewport captured automatically. It is built for developers who maintain several projects and want one inbox instead of one tool per site.

## What Feedex does

Feedex solves a specific problem: a developer with a portfolio, a storefront, a blog, and two side projects has no single place where user feedback arrives. Feedex gives every project an embeddable widget and a set of API keys, and routes everything those widgets collect into one workspace.

A visitor to any instrumented site clicks a feedback button, picks a category, describes the problem, and optionally leaves an email. Feedex attaches the technical context automatically, so the reporter never has to answer "what browser are you using?". The report appears in the developer's dashboard, where it can be given a status and a priority and worked through.

## Key features

- **Embeddable widget** — one script tag, 7 kB gzipped, no dependencies, rendered inside a shadow root so it cannot inherit or leak page styles.
- **Automatic context capture** — page URL and path, referrer, browser and version, operating system, device class, viewport and screen size, language, and timezone. No cookies are read, no storage is written, and no fingerprint is computed.
- **Multi-project dashboard** — every project has its own widget configuration, keys, and feedback stream; all of them roll up into one workspace view.
- **Triage workflow** — seven categories (bug, feature request, UI issue, performance, content, question, other), five statuses (open, in progress, testing, resolved, closed), and four priorities (low, medium, high, critical).
- **Multi-tenant architecture** — workspaces own projects, projects own feedback. Every query is workspace-scoped in the service layer.
- **REST API** — bearer-token authentication with per-project secret keys, a consistent \`{ data }\` / \`{ error }\` envelope, and rate-limit headers on every authenticated response.
- **API key management** — a public key for the browser and a secret key for servers. Secret keys are stored only as HMAC digests and displayed exactly once.
- **Self-hostable** — MIT licensed, deployable anywhere that runs Node.js with a PostgreSQL database.

## What Feedex does not do

Feedex does not use AI in this version. AI-assisted categorisation, duplicate detection, and issue summaries are on the roadmap but are not implemented. It also does not yet support multiple team members per workspace, third-party integrations (GitHub, Linear, Slack), webhooks, screenshot capture, or session replay — the roles and permissions model exists in the schema, but invitations are not built.

## Tech stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Language**: TypeScript, strict mode
- **Database**: PostgreSQL, accessed through Drizzle ORM. Local development falls back to PGlite (PostgreSQL compiled to WebAssembly) so no database service is required to run the project.
- **Styling**: Tailwind CSS v4, configured CSS-first with OKLCH design tokens
- **UI primitives**: Radix UI
- **Animation**: Motion, plus Three.js via React Three Fiber for the landing-page hero
- **Authentication**: custom credentials auth — scrypt password hashing and opaque, database-backed sessions; the schema includes an accounts table so OAuth providers can be added without changing the identity model
- **Widget build**: esbuild, bundled independently of the application

## Pricing

Feedex is free. The source is MIT licensed and can be self-hosted at no cost with your own PostgreSQL database, and the hosted instance is free to use. There is no paid tier, no per-seat pricing, and no usage limit on feedback volume.

## Who it is for

Developers and small teams maintaining more than one web property who want a single, low-friction place to collect and triage user feedback across all of them.

## Installation

\`\`\`html
<script
  src="${url}/widget.js"
  data-feedex-key="pk_fdx_your_project_key"
  defer
></script>
\`\`\`

No build step, no package to install, no framework requirement.

## Links

- Live application: ${url}
- Source repository: ${repo}
- API reference: ${repo}/blob/main/docs/API.md
- Widget documentation: ${repo}/blob/main/docs/WIDGET.md
- Adding the widget to a site: ${repo}/blob/main/docs/ADDING_PROJECTS.md
- Self-hosting guide: ${repo}/blob/main/docs/DEPLOYMENT.md
- Architecture notes: ${repo}/blob/main/docs/ARCHITECTURE.md
- Built by Rian Fernando — ${siteConfig.author.url}
- More projects — ${siteConfig.author.projects}

## Attribution

Feedex is designed and built by Rian Fernando (${siteConfig.author.url}). It is one product in a portfolio of independently deployed applications listed at ${siteConfig.author.projects}.
`;
}

export function GET(): Response {
  return new Response(body(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      // Explicitly crawlable: this file exists to be read by machines.
      'X-Robots-Tag': 'all',
    },
  });
}
