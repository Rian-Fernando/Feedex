'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';

import { useTheme } from '@/components/theme-provider';
import {
  usePageVisible,
  usePrefersReducedMotion,
  useRenderQuality,
  useWebGLSupport,
} from '@/lib/client-capabilities';

const FeedexScene = dynamic(() => import('./feedex-scene'), { ssr: false });

/** Where the scene is held when motion is off — the convergence. */
const STILL_FRAME = 0.72;

/**
 * Decorative WebGL backdrop for the landing page.
 *
 * Everything here is progressive enhancement — the page's content is
 * server-rendered HTML sitting on top. If WebGL is unavailable the canvas
 * simply never mounts, and if the visitor prefers reduced motion the scene
 * renders as a still frame at its most striking moment.
 *
 * The canvas is fixed for the whole page rather than pinned to one section:
 * the story drives it from act one to act four, and past the story it keeps
 * idling behind a progressively heavier scrim so the denser content sections
 * stay comfortable to read.
 *
 * @param storyId id of the element whose scroll range drives the story
 */
export function FeedexBackdrop({ storyId }: { storyId: string }) {
  const { resolved } = useTheme();

  // Environment, read as external state so the first client render is already
  // correct rather than defaulting and then correcting a frame later.
  const webgl = useWebGLSupport();
  const reduced = usePrefersReducedMotion();
  const quality = useRenderQuality();
  const visible = usePageVisible();

  const animate = !reduced;

  // Raw scroll position; the scene eases toward this rather than snapping.
  const targetRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  // Scroll → story progress, plus how far past the story we are, which drives
  // the extra scrim. Skipped entirely under reduced motion, where the scene is
  // held at a fixed frame instead.
  useEffect(() => {
    if (!webgl) return;

    if (reduced) {
      targetRef.current = STILL_FRAME;
      return;
    }

    const story = document.getElementById(storyId);
    if (!story) return;

    let frame = 0;

    const update = () => {
      frame = 0;

      const rect = story.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = -rect.top;
      targetRef.current = total <= 0 ? 0 : Math.min(Math.max(scrolled / total, 0), 1);

      // 0 while the story is on screen, ramping to 1 over the viewport after it.
      const past = Math.min(Math.max((scrolled - total) / (window.innerHeight * 0.7), 0), 1);
      wrapRef.current?.style.setProperty('--past', past.toFixed(3));
    };

    const onScroll = () => {
      // Coalesced to one read per frame: scroll fires far more often than the
      // display refreshes, and reading layout on every event is wasteful.
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [webgl, reduced, storyId]);

  // Subtle parallax so the scene reads as a physical space.
  useEffect(() => {
    if (!webgl || !animate || quality === 'low') return;

    const onMove = (event: PointerEvent) => {
      pointerRef.current = {
        x: (event.clientX / window.innerWidth - 0.5) * 2,
        y: -(event.clientY / window.innerHeight - 0.5) * 2,
      };
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [webgl, animate, quality]);

  // The scene's ground, fog, and scrims are all plum. On the paper theme it
  // would fight the page rather than sit behind it, so the light variant is a
  // clean, quiet page instead of a recoloured scene.
  if (!webgl || resolved !== 'dark') return null;

  return (
    <div ref={wrapRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <FeedexScene
        targetRef={targetRef}
        pointerRef={pointerRef}
        animate={animate}
        quality={quality}
        active={visible}
      />

      {/* Keeps overlaid story copy legible against the brightest bloom. */}
      <div className="absolute inset-0 bg-gradient-to-b from-plum-900/85 via-plum-900/55 to-plum-900/90" />

      {/* Settles the scene down behind the denser content further down. */}
      <div
        className="absolute inset-0 bg-plum-900"
        style={{ opacity: 'calc(var(--past, 0) * 0.94)' }}
      />
    </div>
  );
}
