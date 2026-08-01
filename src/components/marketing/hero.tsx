'use client';

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/misc';

/**
 * The Three.js scene is loaded only in the browser and only after the rest of
 * the hero has painted. It is decorative, so nothing above the fold depends on
 * it, and holding ~150 kB of WebGL out of the initial bundle is the difference
 * between a good LCP and a mediocre one.
 */
const FeedbackNetwork = dynamic(
  () => import('@/components/three/feedback-network').then((mod) => mod.FeedbackNetwork),
  { ssr: false },
);

const SNIPPET = `<script src="https://feedex.rianfernando.com/widget.js"
        data-feedex-key="pk_fdx_your_key" defer></script>`;

export function Hero() {
  const reduced = useReducedMotion();
  const containerRef = React.useRef<HTMLElement>(null);
  const [showScene, setShowScene] = React.useState(false);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  // The scene drifts up and fades as the hero leaves; the copy stays put so
  // text never moves under a reader.
  const sceneY = useTransform(scrollYProgress, [0, 1], ['0%', '22%']);
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  React.useEffect(() => {
    // `requestIdleCallback` where available, so the WebGL context is created
    // during a quiet moment rather than competing with hydration.
    const schedule =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : (callback: () => void) => window.setTimeout(callback, 400);

    const handle = schedule(() => setShowScene(true));
    return () => {
      if (typeof window.cancelIdleCallback === 'function' && typeof handle === 'number') {
        window.cancelIdleCallback(handle);
      }
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative isolate overflow-hidden px-6 pt-28 pb-20 sm:pt-36 sm:pb-28"
    >
      <div
        aria-hidden
        className="bg-grid mask-radial-fade pointer-events-none absolute inset-0 -z-10 opacity-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-20rem] left-1/2 -z-10 size-[52rem] -translate-x-1/2 rounded-full bg-accent-600/15 blur-[140px]"
      />

      {showScene ? (
        <motion.div
          style={reduced ? undefined : { y: sceneY, opacity: sceneOpacity }}
          className="mask-hero-scene pointer-events-none absolute inset-0 -z-10"
        >
          <FeedbackNetwork className="h-full w-full" />
        </motion.div>
      ) : null}

      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-raised/70 px-3.5 py-1.5 text-xs font-medium text-fg-muted backdrop-blur transition-colors hover:border-accent-500/40 hover:text-fg"
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-accent-500" />
              <span className="relative inline-flex size-1.5 rounded-full bg-accent-400" />
            </span>
            One widget. Every project. One dashboard.
            <ArrowRight aria-hidden className="size-3" />
          </Link>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: reduced ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0 : 0.7,
            delay: reduced ? 0 : 0.08,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mt-7 text-4xl leading-[1.08] font-semibold tracking-tight text-fg sm:text-5xl lg:text-6xl"
        >
          Collect feedback from
          <br className="hidden sm:block" />{' '}
          <span className="text-gradient-brand">every project</span> in one place.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: reduced ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0 : 0.7,
            delay: reduced ? 0 : 0.16,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg"
        >
          Feedex is a lightweight feedback platform for developers who ship more than one thing.
          Drop a single script into any site, and bugs, feature requests, and UI issues land in a
          dashboard built for triage — with the browser, viewport, and page already attached.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0 : 0.7,
            delay: reduced ? 0 : 0.24,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/register">
              Start collecting feedback
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
            <Link href="#tour">See how it works</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0 : 0.7,
            delay: reduced ? 0 : 0.32,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mx-auto mt-12 max-w-2xl"
        >
          <div className="edge-highlight overflow-hidden rounded-xl border border-line bg-surface-raised/80 shadow-raised backdrop-blur">
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

          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-fg-subtle">
            {['7 kB gzipped', 'No dependencies', 'Works on any framework', 'MIT licensed'].map(
              (item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check aria-hidden className="size-3 text-success-500" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
