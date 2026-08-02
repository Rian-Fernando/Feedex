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

  // Progress across the pinned narrative region, not just the hero section:
  // the scene stays on screen while the copy scrolls over it, and only
  // releases once the story has played out.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // The copy lifts and fades as it leaves; the scene stays pinned behind it.
  const copyY = useTransform(scrollYProgress, [0, 0.36], ['0%', '-14%']);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.14, 0.28], [1, 1, 0]);
  // Faded copy must stop being clickable, or the page keeps invisible hit
  // targets over the scene.
  const copyPointer = useTransform(scrollYProgress, (v) => (v > 0.26 ? 'none' : 'auto'));
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.82, 1], [1, 1, 0]);
  // Lifts the mask's clear zone in step with the copy leaving.
  const maskCenter = useTransform(scrollYProgress, [0.2, 0.48], [0.16, 1]);

  React.useEffect(() => {
    // Deferred one frame past hydration rather than to an idle callback:
    // `requestIdleCallback` can be starved indefinitely on a busy page, and the
    // scene is the hero's main visual — arriving late reads as not arriving.
    const handle = window.setTimeout(() => setShowScene(true), 60);
    return () => window.clearTimeout(handle);
  }, []);

  return (
    /*
      Three viewports tall, with a sticky inner frame. The scene therefore
      stays on screen for two full screens of scrolling while the copy moves
      over and past it, which is what turns the hero from a picture into a
      sequence.
    */
    <section ref={containerRef} className="relative isolate h-[300vh]">
      <div className="sticky top-0 h-dvh overflow-hidden">
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
            // Motion accepts custom properties as motion values, but React's
            // CSSProperties has no slot for them, so the cast is via `unknown`.
            style={
              reduced
                ? undefined
                : ({
                    opacity: sceneOpacity,
                    '--hero-mask-center': maskCenter,
                  } as unknown as React.CSSProperties)
            }
            className="mask-hero-scene pointer-events-none absolute inset-0 -z-10"
          >
            <FeedbackNetwork className="h-full w-full" />
          </motion.div>
        ) : null}

        <motion.div
          style={
            reduced ? undefined : { y: copyY, opacity: copyOpacity, pointerEvents: copyPointer }
          }
          className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center px-6 text-center"
        >
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
                <CopyButton
                  value={SNIPPET}
                  label="Copy install snippet"
                  className="-mr-1 ml-auto"
                />
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
        </motion.div>
      </div>
    </section>
  );
}
