'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/misc';

/**
 * The landing story.
 *
 * Four full-height panels of ordinary, server-renderable copy. The WebGL
 * backdrop sits fixed behind them and reads its progress from this container's
 * scroll range, so the two stay in step without either knowing about the
 * other's internals.
 *
 * Deliberately plain markup: no pinning, no scroll-jacking, no transforms that
 * move text under a reader. Each panel fades and lifts a little as it arrives,
 * and that is all. The motion people notice is in the scene behind.
 */

const SNIPPET = `<script src="https://feedex.rianfernando.com/widget.js"
        data-feedex-key="pk_fdx_your_key" defer></script>`;

/** One panel of the story. */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();

  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -20% 0px' }}
      transition={{ duration: reduced ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export function Story() {
  return (
    <div id="story">
      {/* Act one — the problem, and the headline. */}
      <Panel className="mx-auto flex min-h-[92vh] max-w-4xl flex-col items-center justify-center px-6 py-20 text-center">
        <Link
          href="#tour"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-raised/60 px-3.5 py-1.5 text-xs font-medium text-fg-muted backdrop-blur transition-colors hover:border-accent-500/40 hover:text-fg"
        >
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-accent-500" />
            <span className="relative inline-flex size-1.5 rounded-full bg-accent-400" />
          </span>
          One widget. Every project. One dashboard.
          <ArrowRight aria-hidden className="size-3" />
        </Link>

        <h1 className="mt-7 text-4xl leading-[1.08] font-semibold tracking-tight text-fg sm:text-5xl lg:text-6xl">
          Collect feedback from
          <br className="hidden sm:block" />{' '}
          <span className="text-gradient-brand">every project</span> in one place.
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
          Feedex is a lightweight feedback platform for developers who ship more than one thing.
          Drop a single script into any site, and bugs, feature requests, and UI issues land in a
          dashboard built for triage — with the browser, viewport, and page already attached.
        </p>

        <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/register">
              Start collecting feedback
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
            <Link href="#tour">See how it works</Link>
          </Button>
        </div>
      </Panel>

      {/* Act two — installing the widget. */}
      <Panel className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center px-6 py-16">
        <p className="label-mono text-gold-500">Act one — install</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          One script tag, on every project you own.
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-fg-muted">
          No build step, no package to install, no framework requirement. Paste it once and a
          feedback button appears in the corner — 10 kB, rendered in a shadow root so it cannot
          touch your styles or be touched by them.
        </p>

        <div className="edge-highlight mt-8 overflow-hidden rounded-xl border border-line bg-surface-raised/80 shadow-raised backdrop-blur">
          <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-2.5">
            <span className="flex gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full bg-plum-400/40" />
              <span aria-hidden className="size-2.5 rounded-full bg-plum-400/40" />
              <span aria-hidden className="size-2.5 rounded-full bg-plum-400/40" />
            </span>
            <span className="ml-1 font-mono text-xs text-fg-subtle">index.html</span>
            <CopyButton value={SNIPPET} label="Copy install snippet" className="-mr-1 ml-auto" />
          </div>
          <pre className="scrollbar-thin overflow-x-auto px-4 py-3.5 text-left">
            <code className="font-mono text-xs leading-relaxed text-fg-muted sm:text-[0.8125rem]">
              {SNIPPET}
            </code>
          </pre>
        </div>

        <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fg-subtle">
          {['10 kB gzipped', 'No dependencies', 'Works on any framework', 'MIT licensed'].map(
            (item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check aria-hidden className="size-3 text-success-500" />
                {item}
              </li>
            ),
          )}
        </ul>
      </Panel>

      {/* Act three — everything converges. */}
      <Panel className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center px-6 py-16">
        <p className="label-mono text-accent-400">Act two — collect</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Every report streams into one inbox.
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-fg-muted">
          Portfolio, storefront, blog, dashboard, side project. Each keeps its own widget and its
          own keys, and everything they collect arrives in the same place — with the page URL,
          browser, operating system, device, and viewport already attached.
        </p>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-fg-subtle">
          The reporter types one thing. You get everything you would otherwise have to ask for.
        </p>
      </Panel>

      {/* Act four — the dashboard. */}
      <Panel className="mx-auto flex min-h-[86vh] max-w-3xl flex-col justify-center px-6 py-16">
        <p className="label-mono text-gold-500">Act three — resolve</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Then work through it, two clicks at a time.
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-fg-muted">
          Seven categories, five statuses, four priorities. Filter by any of them and the URL
          carries the filter, so a view is shareable and survives a reload. Set a status, set a
          priority, ship the fix, close it out.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/register">
              Create a workspace
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="#features">Everything it does</Link>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
