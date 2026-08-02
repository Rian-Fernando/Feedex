'use client';

import * as React from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type HTMLMotionProps,
  type Variants,
} from 'motion/react';

import { cn } from '@/lib/cn';

/**
 * Scroll-triggered entrance.
 *
 * One component for every reveal on the marketing page, so timing and easing
 * stay identical throughout. `whileInView` with `once` means an element
 * animates the first time it is seen and never again — re-animating on scroll
 * back up reads as jitter.
 *
 * Under `prefers-reduced-motion` the content renders in its final state with no
 * transition at all.
 *
 * Props extend motion's own element props rather than React's: motion redefines
 * the drag and animation handlers, and mixing the two type families produces a
 * conflict on `onDrag`.
 */
const EASE = [0.22, 1, 0.36, 1] as const;

export interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'variants'> {
  delay?: number;
  /** Distance travelled, in pixels. */
  distance?: number;
}

export function Reveal({ children, className, delay = 0, distance = 16, ...props }: RevealProps) {
  const reduced = useReducedMotion();

  const variants: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : distance, scale: reduced ? 1 : 0.985 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: reduced ? 0 : 0.7,
        delay: reduced ? 0 : delay,
        ease: EASE,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      variants={variants}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggers its children.
 *
 * Children should be `RevealItem`s; the parent owns the timing so a delay does
 * not have to be computed by hand at each call site.
 */
export interface RevealGroupProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'variants'> {
  stagger?: number;
}

export function RevealGroup({ children, className, stagger = 0.08, ...props }: RevealGroupProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reduced ? 0 : stagger } },
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  ...props
}: Omit<HTMLMotionProps<'div'>, 'variants'>) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: reduced ? 0 : 24, scale: reduced ? 1 : 0.985 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: reduced ? 0 : 0.65, ease: EASE },
        },
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Scroll-linked parallax.
 *
 * Moves its content at a slightly different rate to the page as it passes
 * through the viewport. Used on section headings and feature panels so the
 * whole page has depth while scrolling, not just the hero.
 *
 * `speed` is the fraction of the element's own travel to offset by: positive
 * lags behind the scroll, negative runs ahead of it.
 */
export interface ParallaxProps extends Omit<HTMLMotionProps<'div'>, 'style'> {
  speed?: number;
  /** Fades in over the first part of the pass, in addition to moving. */
  fade?: boolean;
}

export function Parallax({
  children,
  className,
  speed = 0.12,
  fade = false,
  ...props
}: ParallaxProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [`${speed * 100}%`, `${-speed * 100}%`]);
  const opacity = useTransform(scrollYProgress, [0, 0.22, 0.85, 1], [0.35, 1, 1, 0.5]);

  return (
    <motion.div
      ref={ref}
      style={reduced ? undefined : { y, ...(fade ? { opacity } : {}) }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * A section whose content scales and fades slightly as it enters and leaves.
 *
 * Subtler than the hero's pinned sequence, but applied across every section it
 * is what makes the page feel continuous rather than a stack of static blocks.
 */
export function ScrollScale({
  children,
  className,
  ...props
}: Omit<HTMLMotionProps<'div'>, 'style'>) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'center center'],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.55, 1], [0, 0.85, 1]);
  const y = useTransform(scrollYProgress, [0, 1], ['3rem', '0rem']);

  return (
    <motion.div
      ref={ref}
      style={reduced ? undefined : { scale, opacity, y }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
