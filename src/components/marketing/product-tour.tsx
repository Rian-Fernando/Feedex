'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Check,
  CircleDot,
  Code2,
  MessageSquarePlus,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * Interactive product tour.
 *
 * A working simulation of the whole loop rather than a carousel of
 * screenshots: install, report, ingest, triage, resolve. Each step renders real
 * components with mock data, so what a visitor sees here matches what they get.
 *
 * The tour autoplays but yields immediately to interaction — clicking a step
 * pauses it, because a visitor who is reading should not have the panel change
 * underneath them.
 */

const STEPS = [
  {
    id: 'install',
    label: 'Install',
    title: 'Add one script tag',
    description:
      'A single tag on any page. No build step, no framework requirement, no configuration file.',
    icon: Code2,
  },
  {
    id: 'report',
    label: 'Report',
    title: 'A visitor finds a bug',
    description:
      'The widget sits in the corner until it is needed. One click opens the form; nothing else on the page shifts.',
    icon: MousePointerClick,
  },
  {
    id: 'submit',
    label: 'Submit',
    title: 'Context is attached automatically',
    description:
      'Page URL, browser, operating system, viewport, and timezone travel with the report. The reporter types one thing.',
    icon: MessageSquarePlus,
  },
  {
    id: 'triage',
    label: 'Triage',
    title: 'It appears in your dashboard',
    description:
      'Sorted, filterable, and grouped by project. Set a status and a priority in two clicks.',
    icon: CircleDot,
  },
  {
    id: 'resolve',
    label: 'Resolve',
    title: 'Ship the fix and close it out',
    description:
      'Move it to resolved. Metrics and the activity timeline update across the workspace.',
    icon: Check,
  },
] as const;

const STEP_DURATION_MS = 5200;

export function ProductTour() {
  const reduced = useReducedMotion();
  const [active, setActive] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const [hasInteracted, setHasInteracted] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  // Autoplay only while the tour is actually on screen, so a visitor who
  // scrolls past does not return to a step chosen at random.
  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { threshold: 0.35 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!playing || !visible || reduced) return;

    const timer = setTimeout(() => {
      setActive((index) => (index + 1) % STEPS.length);
    }, STEP_DURATION_MS);

    return () => clearTimeout(timer);
  }, [active, playing, visible, reduced]);

  function select(index: number) {
    setActive(index);
    setPlaying(false);
    setHasInteracted(true);
  }

  const step = STEPS[active]!;

  return (
    <div ref={containerRef} className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
      {/* Step list — a real tablist, so arrow keys and screen readers work. */}
      <div
        role="tablist"
        aria-label="Product tour steps"
        aria-orientation="vertical"
        // `min-w-0` is load-bearing: a flex item defaults to `min-width: auto`,
        // which lets it grow past the container to fit the step buttons and
        // stops `overflow-x-auto` from ever engaging. Only the desktop rail
        // should refuse to shrink.
        className="flex min-w-0 scrollbar-thin gap-2 overflow-x-auto pb-2 lg:w-72 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0"
      >
        {STEPS.map((item, index) => {
          const isActive = index === active;

          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tour-panel-${item.id}`}
              id={`tour-tab-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  select((active + 1) % STEPS.length);
                } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                  event.preventDefault();
                  select((active - 1 + STEPS.length) % STEPS.length);
                }
              }}
              className={cn(
                'group relative flex min-w-52 items-start gap-3 rounded-xl border p-3.5 text-left transition-all lg:min-w-0',
                isActive
                  ? 'border-accent-500/40 bg-accent-500/8'
                  : 'border-line hover:border-line-strong hover:bg-surface-inset/50',
              )}
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                  isActive
                    ? 'bg-accent-600 text-white'
                    : 'bg-surface-inset text-fg-subtle group-hover:text-fg-muted',
                )}
              >
                <item.icon aria-hidden className="size-4" />
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-sm font-medium transition-colors',
                    isActive ? 'text-fg' : 'text-fg-muted',
                  )}
                >
                  {item.label}
                </span>
                <span className="mt-0.5 hidden text-xs text-fg-subtle lg:block">{item.title}</span>
              </span>

              {/* Progress bar doubling as the autoplay indicator. */}
              {isActive && playing && !reduced && visible ? (
                <motion.span
                  key={`progress-${active}`}
                  aria-hidden
                  className="absolute bottom-0 left-0 h-0.5 rounded-full bg-accent-500"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: STEP_DURATION_MS / 1000, ease: 'linear' }}
                />
              ) : null}
            </button>
          );
        })}

        <div className="hidden items-center gap-2 pt-2 lg:flex">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPlaying((value) => !value);
              setHasInteracted(true);
            }}
            aria-label={playing ? 'Pause the tour' : 'Play the tour'}
          >
            {playing ? (
              <Pause aria-hidden className="size-3.5" />
            ) : (
              <Play aria-hidden className="size-3.5" />
            )}
            {playing ? 'Pause' : 'Play'}
          </Button>

          {hasInteracted ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActive(0);
                setPlaying(true);
              }}
            >
              <RotateCcw aria-hidden className="size-3.5" />
              Restart
            </Button>
          ) : null}
        </div>
      </div>

      {/* Stage */}
      <div
        role="tabpanel"
        id={`tour-panel-${step.id}`}
        aria-labelledby={`tour-tab-${step.id}`}
        className="edge-highlight min-h-[26rem] flex-1 overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-raised"
      >
        <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-2.5">
          <span className="flex gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-plum-400/40" />
            <span aria-hidden className="size-2.5 rounded-full bg-plum-400/40" />
            <span aria-hidden className="size-2.5 rounded-full bg-plum-400/40" />
          </span>
          <span className="ml-1 truncate font-mono text-xs text-fg-subtle">
            {active >= 3 ? 'feedex.rianfernando.com/dashboard' : 'yourproject.com'}
          </span>
        </div>

        <div className="relative p-5 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -8 }}
              transition={{ duration: reduced ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <h3 className="text-base font-semibold text-fg">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{step.description}</p>

              <div className="mt-5">
                <StageContent step={step.id} reduced={Boolean(reduced)} />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** Per-step mock UI. */
function StageContent({ step, reduced }: { step: (typeof STEPS)[number]['id']; reduced: boolean }) {
  switch (step) {
    case 'install':
      return (
        <pre className="scrollbar-thin overflow-x-auto rounded-lg border border-line-subtle bg-surface-sunken p-4">
          <code className="font-mono text-xs leading-relaxed text-fg-muted">
            {`<!-- Anywhere before </body> -->
<script
  src="https://feedex.rianfernando.com/widget.js"
  data-feedex-key="pk_fdx_9Kd2..."
  defer
></script>`}
          </code>
        </pre>
      );

    case 'report':
      return (
        <div className="relative h-56 overflow-hidden rounded-lg border border-line-subtle bg-surface-sunken">
          <div className="space-y-2.5 p-5">
            <div className="h-2.5 w-1/3 rounded-full bg-line-subtle" />
            <div className="h-2 w-3/4 rounded-full bg-line-subtle/70" />
            <div className="h-2 w-2/3 rounded-full bg-line-subtle/70" />
            <div className="h-24 w-full rounded-lg bg-line-subtle/50" />
          </div>

          <motion.button
            type="button"
            tabIndex={-1}
            aria-hidden
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: reduced ? 0 : 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-full bg-accent-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
          >
            <MessageSquarePlus aria-hidden className="size-3.5" />
            Feedback
          </motion.button>

          {/* Cursor travelling to the button. */}
          {!reduced ? (
            <motion.span
              aria-hidden
              className="absolute"
              initial={{ top: '40%', left: '30%', opacity: 0 }}
              animate={{ top: '76%', left: '78%', opacity: [0, 1, 1] }}
              transition={{ duration: 1.1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <MousePointerClick className="size-4 text-fg drop-shadow" />
            </motion.span>
          ) : null}
        </div>
      );

    case 'submit':
      return (
        <div className="mx-auto max-w-sm rounded-xl border border-line bg-surface-sunken p-4">
          <p className="text-sm font-semibold text-fg">Send feedback</p>
          <p className="mt-0.5 text-xs text-fg-subtle">Found a bug or have an idea? Let us know.</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {['Bug', 'Feature', 'UI issue', 'Other'].map((chip, index) => (
              <span
                key={chip}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs',
                  index === 0
                    ? 'border-accent-500 bg-accent-500/12 font-semibold text-accent-500'
                    : 'border-line text-fg-subtle',
                )}
              >
                {chip}
              </span>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-line bg-surface-raised p-2.5">
            <p className="text-xs leading-relaxed text-fg-muted">
              The export button on the reports page does nothing when I click it.
            </p>
          </div>

          <div className="mt-3 border-t border-line-subtle pt-3">
            <p className="text-2xs font-medium text-fg-subtle uppercase">Attached automatically</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {[
                ['Page', '/reports'],
                ['Browser', 'Chrome 131'],
                ['OS', 'macOS 15.2'],
                ['Viewport', '1512 × 858'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <dt className="text-2xs text-fg-subtle">{label}</dt>
                  <dd className="truncate font-mono text-2xs text-fg-muted">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      );

    case 'triage':
      return (
        <ul className="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle">
          {[
            {
              title: 'Export button does nothing on the reports page',
              project: 'Dashboard',
              color: '#B58BF9',
              status: 'Open',
              tone: 'info' as const,
              category: 'Bug',
              catTone: 'danger' as const,
              time: 'just now',
              fresh: true,
            },
            {
              title: 'Add dark mode to the checkout flow',
              project: 'Storefront',
              color: '#10b981',
              status: 'In progress',
              tone: 'accent' as const,
              category: 'Feature',
              catTone: 'accent' as const,
              time: '2 hours ago',
              fresh: false,
            },
            {
              title: 'Footer links wrap awkwardly at 375px',
              project: 'Portfolio',
              color: '#f97316',
              status: 'Testing',
              tone: 'warning' as const,
              category: 'UI issue',
              catTone: 'info' as const,
              time: 'yesterday',
              fresh: false,
            },
          ].map((row, index) => (
            <motion.li
              key={row.title}
              initial={row.fresh && !reduced ? { backgroundColor: 'rgba(99,102,241,0.12)' } : false}
              animate={{ backgroundColor: 'rgba(99,102,241,0)' }}
              transition={{ duration: 1.6, delay: 0.3 }}
              className="flex flex-col gap-2 p-3"
            >
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <p className="flex-1 text-sm font-medium text-fg">{row.title}</p>
                <span className="shrink-0 text-xs whitespace-nowrap text-fg-subtle">
                  {row.time}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pl-4.5">
                <Badge tone={row.tone} size="sm" dot>
                  {row.status}
                </Badge>
                <Badge tone={row.catTone} size="sm">
                  {row.category}
                </Badge>
                <span className="ml-0.5 text-2xs text-fg-subtle">{row.project}</span>
                {index === 0 ? (
                  <Badge tone="accent" size="sm" className="ml-auto">
                    New
                  </Badge>
                ) : null}
              </div>
            </motion.li>
          ))}
        </ul>
      );

    case 'resolve':
      return (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-success-500/25 bg-success-500/8 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-500/15 text-success-500">
              <Check aria-hidden className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">
                Export button does nothing on the reports page
              </p>
              <p className="mt-0.5 text-xs text-fg-subtle">Moved to Resolved · closed in 4 hours</p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-3">
            {[
              ['Open', '11', 'text-info-500'],
              ['Resolved', '48', 'text-success-500'],
              ['Median time', '6h', 'text-fg'],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-lg border border-line-subtle p-3">
                <dt className="text-2xs text-fg-subtle">{label}</dt>
                <dd className={cn('mt-1 text-lg font-semibold tabular-nums', tone)}>{value}</dd>
              </div>
            ))}
          </dl>

          <ol className="flex flex-col gap-2.5">
            {[
              'Rian moved “Export button does nothing” to Resolved',
              'Rian set “Export button does nothing” to high priority',
              'New feedback: Export button does nothing on the reports page',
            ].map((entry, index) => (
              <li key={entry} className="flex gap-2.5">
                <span className="flex flex-col items-center">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 size-2 rounded-full',
                      index === 0
                        ? 'bg-success-500'
                        : index === 1
                          ? 'bg-warning-500'
                          : 'bg-accent-500',
                    )}
                  />
                  {index < 2 ? (
                    <span aria-hidden className="mt-1 w-px flex-1 bg-line-subtle" />
                  ) : null}
                </span>
                <span className="pb-1 text-xs leading-snug text-fg-muted">{entry}</span>
              </li>
            ))}
          </ol>
        </div>
      );

    default:
      return null;
  }
}
