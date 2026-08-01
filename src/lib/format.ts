/**
 * Presentation helpers.
 *
 * Kept free of React so they can be used in server components, client
 * components, and tests without pulling in a rendering dependency.
 */

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "3 days ago", "just now". */
export function timeAgo(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const diff = value.getTime() - Date.now();
  const absolute = Math.abs(diff);

  if (absolute < 45_000) return 'just now';

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (absolute >= ms) {
      return relativeFormatter.format(Math.round(diff / ms), unit);
    }
  }

  return relativeFormatter.format(Math.round(diff / 1000), 'second');
}

const dateFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDate(date: Date | string): string {
  return dateFormatter.format(typeof date === 'string' ? new Date(date) : date);
}

export function formatDateTime(date: Date | string): string {
  return dateTimeFormatter.format(typeof date === 'string' ? new Date(date) : date);
}

/** Compact counts for badges: 1.2k rather than 1200. */
export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

/**
 * Percentage change between two periods.
 *
 * Returns `null` when the previous period was empty, because "infinite growth"
 * is not a useful thing to render.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

/** Truncates on a word boundary where possible. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice}…`;
}

/** Strips the scheme and any trailing slash for compact display. */
export function displayUrl(url: string | undefined | null): string {
  if (!url) return '—';
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
