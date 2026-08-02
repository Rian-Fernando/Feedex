import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  Filter,
  Gauge,
  Heart,
  KeyRound,
  Layers,
  Puzzle,
  Scale,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Webhook,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GithubIcon } from '@/components/brand/github-icon';
import { Parallax, Reveal, RevealGroup, RevealItem, ScrollScale } from './reveal';
import { siteConfig } from '@/config/site';

/** Consistent section wrapper: one max width, one rhythm, one heading shape. */
export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
  align = 'center',
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  align?: 'center' | 'left';
}) {
  return (
    <section id={id} className={cn('px-6 py-20 sm:py-28', className)}>
      <div className="mx-auto max-w-6xl">
        <Parallax
          speed={0.07}
          className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}
        >
          {eyebrow ? (
            <p className="text-xs font-semibold tracking-[0.12em] text-accent-500 uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {title}
          </h2>
          {description ? <p className="mt-3 leading-relaxed text-fg-muted">{description}</p> : null}
        </Parallax>
        {children ? <div className="mt-12">{children}</div> : null}
      </div>
    </section>
  );
}

/* --------------------------------- Features -------------------------------- */

const FEATURES = [
  {
    icon: Boxes,
    title: 'Every project, one inbox',
    description:
      'Portfolio, storefront, blog, dashboard, side project. Each gets its own widget and keys, and everything lands in one place you actually check.',
  },
  {
    icon: Sparkles,
    title: 'Context without asking',
    description:
      'Page URL, browser and version, operating system, device, viewport, screen, language, and timezone travel with every report. Reporters type one thing.',
  },
  {
    icon: Filter,
    title: 'Built for triage',
    description:
      'Seven categories, five statuses, four priorities. Filter by any of them, and the URL carries the filter so a view is shareable.',
  },
  {
    icon: Gauge,
    title: 'A widget that stays out of the way',
    description:
      '7 kB gzipped, zero dependencies, rendered in a shadow root. It cannot inherit your styles and cannot leak into them.',
  },
  {
    icon: ShieldCheck,
    title: 'Multi-tenant from the first commit',
    description:
      'Workspaces own projects, projects own feedback. Every query is workspace-scoped in the service layer, not by convention in the UI.',
  },
  {
    icon: KeyRound,
    title: 'Keys you can rotate',
    description:
      'A public key for the browser and a secret key for your server. Secrets are stored as HMACs and shown exactly once.',
  },
] as const;

export function Features() {
  return (
    <Section
      id="features"
      eyebrow="Features"
      title="Everything you need to close the loop"
      description="Feedex does one job properly: getting feedback out of your users' heads and into a list you can work through."
    >
      <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <RevealItem key={feature.title}>
            <Card className="h-full p-5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent-500/10 text-accent-500">
                <feature.icon aria-hidden className="size-4.5" />
              </span>
              <h3 className="mt-4 text-[0.9375rem] font-semibold text-fg">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{feature.description}</p>
            </Card>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}

/* -------------------------------- Developers ------------------------------- */

const API_EXAMPLE = `curl https://feedex.rianfernando.com/api/v1/issues \\
  -H "Authorization: Bearer sk_fdx_..." \\
  -G -d status=open -d priority=critical

{
  "data": {
    "items": [
      {
        "id": "fbk_m4x9k2c1_a83jf0zq",
        "reference": 42,
        "title": "Export button does nothing",
        "category": "bug",
        "status": "open",
        "priority": "critical",
        "context": {
          "url": "https://example.com/reports",
          "browser": "Chrome",
          "viewport": { "width": 1512, "height": 858 }
        }
      }
    ],
    "pagination": { "page": 1, "total": 1, "totalPages": 1 }
  }
}`;

export function Developers() {
  return (
    <section id="developers" className="px-6 py-20 sm:py-28">
      {/*
        `min-w-0` on the grid children is required, not cosmetic: a grid item's
        automatic minimum size is its content, so the wide <pre> below would
        widen its track past the viewport and its own overflow-x-auto would
        never engage.
      */}
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
        <Reveal className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.12em] text-accent-500 uppercase">
            For developers
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            An API that behaves itself
          </h2>
          <p className="mt-3 leading-relaxed text-fg-muted">
            Every response uses the same envelope. Errors carry a stable machine-readable code
            alongside a message you can show a user. Rate limits are returned in headers, not
            discovered by getting blocked.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {[
              ['Bearer-token auth with per-project secret keys', Terminal],
              ['Consistent { data } / { error } envelope on every route', Layers],
              ['Rate limit headers on every authenticated response', Gauge],
              ['Webhooks and integrations designed for, not bolted on', Webhook],
            ].map(([text, Icon]) => {
              const IconComponent = Icon as typeof Terminal;
              return (
                <li key={text as string} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-surface-inset text-fg-subtle">
                    <IconComponent aria-hidden className="size-3" />
                  </span>
                  <span className="text-sm leading-relaxed text-fg-muted">{text as string}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild variant="secondary" size="sm">
              <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
                Read the docs
                <ArrowRight aria-hidden className="size-3.5" />
              </a>
            </Button>
          </div>
        </Reveal>

        <Parallax speed={-0.09} className="min-w-0">
          <div className="edge-highlight overflow-hidden rounded-xl border border-line bg-surface-raised shadow-raised">
            <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-2.5">
              <Terminal aria-hidden className="size-3.5 text-fg-subtle" />
              <span className="font-mono text-xs text-fg-subtle">Terminal</span>
              <Badge tone="success" size="sm" className="ml-auto">
                200 OK
              </Badge>
            </div>
            <pre className="scrollbar-thin overflow-x-auto p-4">
              <code className="font-mono text-[0.6875rem] leading-relaxed text-fg-muted sm:text-xs">
                {API_EXAMPLE}
              </code>
            </pre>
          </div>
        </Parallax>
      </div>
    </section>
  );
}

/* ------------------------------- Open source ------------------------------- */

const FREEDOMS = [
  {
    icon: Heart,
    title: 'Free, with no tier above it',
    description:
      'Every feature is in the box. There is no plan to upgrade to, no seat count, and no usage meter counting your feedback.',
  },
  {
    icon: Scale,
    title: 'MIT licensed',
    description:
      'Read it, fork it, run it commercially, change whatever you like. The whole application and the widget are in one public repository.',
  },
  {
    icon: Server,
    title: 'Self-host it',
    description:
      'Point it at your own PostgreSQL and deploy it anywhere Node runs. Your feedback stays in a database you control.',
  },
  {
    icon: ShieldCheck,
    title: 'No tracking of your users',
    description:
      'The widget reads no cookies, writes no storage, and builds no fingerprint. It collects what is needed to reproduce a bug and nothing else.',
  },
] as const;

export function OpenSource() {
  return (
    <Section
      id="open-source"
      eyebrow="Open source"
      title="Free, and built to stay that way"
      description="Feedex is MIT licensed and developed in the open. Use the hosted instance or run your own — they are the same application."
    >
      <RevealGroup className="grid gap-4 sm:grid-cols-2">
        {FREEDOMS.map((item) => (
          <RevealItem key={item.title}>
            <Card className="flex h-full gap-4 p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold-500/12 text-gold-600 dark:text-gold-500">
                <item.icon aria-hidden className="size-4.5" />
              </span>
              <span className="min-w-0">
                <h3 className="text-[0.9375rem] font-semibold text-fg">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{item.description}</p>
              </span>
            </Card>
          </RevealItem>
        ))}
      </RevealGroup>

      <Reveal
        delay={0.1}
        className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"
      >
        <Button asChild size="lg">
          <Link href="/register">
            Create a workspace
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
            <GithubIcon className="size-4" />
            View the source
          </a>
        </Button>
      </Reveal>
    </Section>
  );
}

/* ----------------------------------- FAQ ----------------------------------- */

/**
 * FAQ content.
 *
 * Exported because the same questions and answers feed the FAQPage JSON-LD in
 * the page's structured data — one source, so the markup and the visible text
 * can never disagree.
 */
export const FAQ_ITEMS = [
  {
    question: 'What is Feedex?',
    answer:
      'Feedex is a lightweight developer feedback platform. You install a single script on any web application, and the bugs, feature requests, and UI issues your users submit are collected into one central dashboard, with browser and page context attached automatically.',
  },
  {
    question: 'How does Feedex work?',
    answer:
      'You create a project in your Feedex workspace and get a public key. You add one script tag carrying that key to your site. A feedback button appears in the corner; when a visitor submits a report, it is validated, rate limited, and stored against your project, then appears in your dashboard where you can set a status and priority and work through it.',
  },
  {
    question: 'Is Feedex free?',
    answer:
      'Yes, entirely. Feedex is MIT licensed, so you can self-host it at no cost with your own PostgreSQL database, and the hosted instance at feedex.rianfernando.com is free to use. There is no paid tier, no seat pricing, and no usage limit on your feedback.',
  },
  {
    question: 'Who is Feedex for?',
    answer:
      'Developers and small teams who maintain more than one web property and want a single place to collect feedback across all of them, rather than a separate tool or inbox per project.',
  },
  {
    question: 'How do developers integrate Feedex?',
    answer:
      'Add one script tag with your project public key before the closing body tag. There is no build step, no package to install, and no framework requirement. For React or Next.js you can load the same script through next/script. You can also post feedback directly to the REST API from any client, including mobile apps and command-line tools.',
  },
  {
    question: 'What data does the widget collect?',
    answer:
      'Page URL and path, referrer, browser name and version, operating system, device class, viewport and screen dimensions, language, and timezone. It does not read cookies, does not write to storage, and does not compute a fingerprint. Email is collected only if the reporter chooses to provide it.',
  },
  {
    question: 'Can I self-host Feedex?',
    answer:
      'Yes. Feedex is a standard Next.js application backed by PostgreSQL. Set DATABASE_URL and AUTH_SECRET, run the migrations, and deploy it anywhere that runs Node. Local development needs no database at all — it falls back to an embedded PGlite instance.',
  },
  {
    question: 'Does Feedex use AI?',
    answer:
      'Not in this version. AI-assisted categorisation, duplicate detection, and issue summaries are on the roadmap, but the current release is deliberately a solid, predictable foundation without them.',
  },
] as const;

export function Faq() {
  return (
    <Section
      id="faq"
      eyebrow="FAQ"
      title="Questions, answered"
      description="If something is not covered here, the source is the documentation of last resort."
    >
      <RevealGroup className="mx-auto max-w-3xl divide-y divide-[var(--border-subtle)]">
        {FAQ_ITEMS.map((item) => (
          <RevealItem key={item.question}>
            {/* Native disclosure: keyboard accessible and works without JS. */}
            <details className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                <h3 className="text-[0.9375rem] font-medium text-fg">{item.question}</h3>
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line text-fg-subtle transition-transform group-open:rotate-45"
                >
                  <svg viewBox="0 0 12 12" className="size-3">
                    <path
                      d="M6 2v8M2 6h8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 pr-10 text-sm leading-relaxed text-fg-muted">{item.answer}</p>
            </details>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}

/* ------------------------------------ CTA ---------------------------------- */

export function CallToAction() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <ScrollScale className="mx-auto max-w-4xl">
        <div className="relative isolate overflow-hidden rounded-2xl border border-line bg-surface-raised px-6 py-14 text-center sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute top-[-14rem] left-1/2 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-accent-600/20 blur-[120px]"
          />
          <div aria-hidden className="bg-grid mask-radial-fade absolute inset-0 -z-10 opacity-40" />

          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-accent-500/10 text-accent-500">
            <Puzzle aria-hidden className="size-5" />
          </span>

          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Put it on one project today
          </h2>
          <p className="mx-auto mt-3 max-w-lg leading-relaxed text-fg-muted">
            Create a workspace, add a project, paste one script tag. The first piece of feedback
            usually arrives before you have finished reading the docs.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/register">
                Get started free
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
              <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
                Star on GitHub
              </a>
            </Button>
          </div>
        </div>
      </ScrollScale>
    </section>
  );
}
