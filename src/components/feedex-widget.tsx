'use client';

import * as React from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';

import { useTheme } from '@/components/theme-provider';

/**
 * Feedex, running on Feedex.
 *
 * The product collects its own feedback through its own widget. Beyond being
 * the most honest demo available, it means every change to the widget is
 * exercised here first — a regression shows up on this site before it shows up
 * on anyone else's.
 *
 * Mounted only when `NEXT_PUBLIC_FEEDEX_KEY` is set, so a fresh clone or a
 * self-hosted instance renders nothing rather than pointing at someone else's
 * project.
 *
 * Driven through the widget's own public API rather than data attributes,
 * because two things have to change after boot: the theme, so the widget
 * matches the surface it is sitting on, and the metadata, so a report says
 * which page it came from.
 */

declare global {
  interface Window {
    Feedex?: {
      init: (config: Record<string, unknown>) => void;
      destroy: () => void;
      setMetadata: (metadata: Record<string, string>) => void;
    };
  }
}

export function FeedexWidget() {
  const publicKey = process.env.NEXT_PUBLIC_FEEDEX_KEY;
  const { resolved } = useTheme();
  const pathname = usePathname();

  const [ready, setReady] = React.useState(false);

  // Boot, and re-boot whenever the theme changes. The widget reads its theme
  // once at init, so a swap is a destroy and a fresh init.
  React.useEffect(() => {
    if (!ready || !publicKey || !window.Feedex) return;

    window.Feedex.destroy();
    window.Feedex.init({
      key: publicKey,
      // Named explicitly rather than inferred. This page always knows its own
      // origin, and relying on inference is how a local install ends up
      // posting to production.
      host: window.location.origin,
      theme: resolved,
      title: 'Report an issue',
      description: 'Found a bug, or something reading wrong? Tell us here.',
      categories: ['bug', 'ui', 'feature', 'content', 'other'],
    });
  }, [ready, publicKey, resolved]);

  // Attach the current route to every submission, so a report arrives already
  // saying where it came from.
  React.useEffect(() => {
    if (!ready || !window.Feedex) return;

    window.Feedex.setMetadata({
      surface: pathname.startsWith('/dashboard') ? 'dashboard' : 'marketing',
      route: pathname,
    });
  }, [ready, pathname]);

  if (!publicKey) return null;

  return (
    <Script
      // Same origin as the app, so this is the very bundle the docs tell
      // everyone else to embed.
      src="/widget.js"
      strategy="lazyOnload"
      onReady={() => setReady(true)}
    />
  );
}
