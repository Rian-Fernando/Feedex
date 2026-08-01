'use client';

import * as React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from 'motion/react';

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
