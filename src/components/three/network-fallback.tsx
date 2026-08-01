'use client';

import * as React from 'react';

/**
 * Pure-SVG version of the hero network.
 *
 * Rendered whenever WebGL is unavailable — a blocked GPU, hardware
 * acceleration switched off, a locked-down enterprise profile, an old device.
 * Those cases are invisible from the server and impossible to feature-detect
 * ahead of time, and the failure mode without this is a completely flat
 * background, which is worse than any fallback.
 *
 * Animated with SMIL and CSS rather than JavaScript, so it costs nothing on the
 * main thread and stops automatically under `prefers-reduced-motion`.
 */

const NODES = [
  { x: 12, y: 22, r: 9, gold: true, delay: 0 },
  { x: 30, y: 8, r: 6, gold: false, delay: 0.7 },
  { x: 62, y: 11, r: 8, gold: true, delay: 1.4 },
  { x: 88, y: 26, r: 7, gold: false, delay: 2.1 },
  { x: 93, y: 62, r: 9, gold: true, delay: 2.8 },
  { x: 74, y: 86, r: 6, gold: false, delay: 3.5 },
  { x: 40, y: 91, r: 8, gold: true, delay: 4.2 },
  { x: 9, y: 68, r: 7, gold: false, delay: 4.9 },
] as const;

const GOLD = '#F7B83D';
const VIOLET = '#B58BF9';
const CENTER = { x: 50, y: 48 };

export function NetworkFallback({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <g stroke={VIOLET} strokeWidth="0.16" opacity="0.42">
          {NODES.map((node) => (
            <line
              key={`edge-${node.x}-${node.y}`}
              x1={node.x}
              y1={node.y}
              x2={CENTER.x}
              y2={CENTER.y}
            />
          ))}
        </g>

        {/* Pulses travelling inward, one per edge, offset so they never sync. */}
        <g className="motion-reduce:hidden">
          {NODES.map((node) => (
            <circle key={`pulse-${node.x}-${node.y}`} r="0.7" fill="#ffffff" opacity="0.9">
              <animate
                attributeName="cx"
                values={`${node.x};${CENTER.x}`}
                dur="3.4s"
                begin={`${node.delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                values={`${node.y};${CENTER.y}`}
                dur="3.4s"
                begin={`${node.delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.95;0.95;0"
                dur="3.4s"
                begin={`${node.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>

        {NODES.map((node) => (
          <circle
            key={`node-${node.x}-${node.y}`}
            cx={node.x}
            cy={node.y}
            r={node.r / 8}
            fill={node.gold ? GOLD : VIOLET}
          >
            <animate
              attributeName="r"
              values={`${node.r / 8};${(node.r / 8) * 1.18};${node.r / 8}`}
              dur="4.6s"
              begin={`${node.delay * 0.4}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}

        <circle cx={CENTER.x} cy={CENTER.y} r="2.6" fill={GOLD} opacity="0.22" />
        <circle cx={CENTER.x} cy={CENTER.y} r="1.3" fill={VIOLET} opacity="0.7" />
      </svg>
    </div>
  );
}
