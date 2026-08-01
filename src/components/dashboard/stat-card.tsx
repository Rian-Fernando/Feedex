import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';

/**
 * Metric tile for the overview page.
 *
 * `delta` is a percentage change against the previous period. It is rendered
 * without a directional colour when the change is zero, because tinting a flat
 * number green or red implies a judgement the data does not support.
 */
export interface StatCardProps {
  label: string;
  value: number | string;
  delta?: number | null;
  /** Whether an increase should read as positive. False for "open issues". */
  increaseIsGood?: boolean;
  hint?: string;
  icon?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  delta,
  increaseIsGood = true,
  hint,
  icon,
}: StatCardProps) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const isFlat = !hasDelta || Math.round(delta) === 0;
  const isPositive = hasDelta && delta > 0;
  const isGood = isPositive === increaseIsGood;

  const Icon = isFlat ? Minus : isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-fg-muted">{label}</p>
        {icon ? <span className="shrink-0 text-fg-subtle">{icon}</span> : null}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-fg tabular-nums">{value}</p>
        {hasDelta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
              isFlat ? 'text-fg-subtle' : isGood ? 'text-success-500' : 'text-danger-500',
            )}
          >
            <Icon aria-hidden className="size-3" />
            {Math.abs(Math.round(delta))}%
          </span>
        ) : null}
      </div>

      {hint ? <p className="mt-1 text-xs text-fg-subtle">{hint}</p> : null}
    </Card>
  );
}

/**
 * Fourteen-day volume sparkline, drawn as inline SVG.
 *
 * A charting library would be several times the size of this component and buy
 * nothing at this level of complexity.
 */
export function TrendSparkline({
  data,
  className,
}: {
  data: Array<{ date: string; count: number }>;
  className?: string;
}) {
  if (data.length === 0) return null;

  const max = Math.max(1, ...data.map((point) => point.count));
  const width = 100;
  const height = 32;
  const step = data.length > 1 ? width / (data.length - 1) : width;

  const points = data.map((point, index) => {
    const x = index * step;
    const y = height - (point.count / max) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const line = `M${points.join(' L')}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('h-8 w-full', className)}
      role="img"
      aria-label={`${total} feedback items over the last ${data.length} days`}
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkline-fill)" className="text-accent-500" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="text-accent-500"
      />
    </svg>
  );
}

/** Horizontal distribution bar used for category and status breakdowns. */
export function DistributionBar({
  segments,
  className,
}: {
  segments: Array<{ label: string; value: number; className: string }>;
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return null;

  return (
    <div
      className={cn('flex h-2 overflow-hidden rounded-full bg-surface-sunken', className)}
      role="img"
      aria-label={segments
        .filter((segment) => segment.value > 0)
        .map((segment) => `${segment.label}: ${segment.value}`)
        .join(', ')}
    >
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment) => (
          <span
            key={segment.label}
            className={segment.className}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
    </div>
  );
}
