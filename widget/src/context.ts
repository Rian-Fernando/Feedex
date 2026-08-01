import type { ClientContext } from './types';

/**
 * Client context collection.
 *
 * Deliberately narrow: everything gathered here is either already visible in
 * the request (user agent, referrer) or non-identifying (viewport, timezone).
 * No cookies are read, no storage is written, and no fingerprint is computed.
 *
 * Adding a field means adding one entry here and one optional property to the
 * server-side `feedbackContextSchema`; nothing else needs to change.
 */

interface BrowserMatch {
  name: string;
  pattern: RegExp;
}

/**
 * Order matters. Chromium-based browsers put their own token *after* the
 * "Chrome" token, so the more specific ones have to be tested first.
 */
const BROWSERS: BrowserMatch[] = [
  { name: 'Edge', pattern: /Edg(?:e|A|iOS)?\/([\d.]+)/ },
  { name: 'Opera', pattern: /OPR\/([\d.]+)/ },
  { name: 'Samsung Internet', pattern: /SamsungBrowser\/([\d.]+)/ },
  { name: 'Firefox', pattern: /(?:Firefox|FxiOS)\/([\d.]+)/ },
  { name: 'Chrome', pattern: /(?:Chrome|CriOS)\/([\d.]+)/ },
  { name: 'Safari', pattern: /Version\/([\d.]+).*Safari/ },
];

const OPERATING_SYSTEMS: BrowserMatch[] = [
  { name: 'Windows', pattern: /Windows NT ([\d.]+)/ },
  { name: 'Android', pattern: /Android ([\d.]+)/ },
  { name: 'iOS', pattern: /OS (\d+[._]\d+)/ },
  { name: 'macOS', pattern: /Mac OS X ([\d._]+)/ },
  { name: 'Linux', pattern: /(Linux)/ },
];

function detectBrowser(ua: string): { browser?: string; browserVersion?: string } {
  for (const entry of BROWSERS) {
    const match = entry.pattern.exec(ua);
    if (match) {
      return { browser: entry.name, browserVersion: match[1] };
    }
  }
  return {};
}

function detectOs(ua: string): string | undefined {
  for (const entry of OPERATING_SYSTEMS) {
    const match = entry.pattern.exec(ua);
    if (match) {
      if (entry.name === 'Windows') return 'Windows';
      const version = match[1]?.replace(/_/g, '.');
      return version && entry.name !== 'Linux' ? `${entry.name} ${version}` : entry.name;
    }
  }
  return undefined;
}

/** Classifies by viewport width, which is what actually affects the layout. */
function detectDevice(width: number, ua: string): 'desktop' | 'tablet' | 'mobile' {
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return width >= 768 ? 'tablet' : 'mobile';
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function collectContext(custom?: Record<string, string>): ClientContext {
  const ua = navigator.userAgent;
  const width = window.innerWidth;
  const height = window.innerHeight;

  const context: ClientContext = {
    url: window.location.href.slice(0, 2048),
    path: window.location.pathname.slice(0, 1024),
    viewport: { width, height },
    device: detectDevice(width, ua),
    ...detectBrowser(ua),
  };

  const os = detectOs(ua);
  if (os) context.os = os;

  if (document.referrer) context.referrer = document.referrer.slice(0, 2048);
  if (navigator.language) context.language = navigator.language;

  try {
    context.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Intl is unavailable in some embedded webviews; the field is optional.
  }

  if (window.screen) {
    context.screen = { width: window.screen.width, height: window.screen.height };
  }

  if (custom && Object.keys(custom).length > 0) {
    context.custom = custom;
  }

  return context;
}
