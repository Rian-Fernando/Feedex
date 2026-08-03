'use client';

import * as React from 'react';

import type { WidgetSettings } from '@/lib/db/schema';

/**
 * Live preview of the widget, as configured.
 *
 * This runs the real `widget.js` inside an iframe rather than reimplementing
 * its markup in React. A hand-built mock would be easier, and would start
 * lying the first time the widget changed — which is exactly when an accurate
 * preview matters. Anything you see here is what a visitor sees.
 *
 * The iframe is a same-origin `srcdoc` document so it can load the bundle from
 * this instance. Inside it, two things are faked and nothing else:
 *
 *   - `fetch` is stubbed, so the preview never posts a real report into the
 *     project and the success state is still explorable;
 *   - remote config is disabled, so the panel reflects the unsaved form rather
 *     than the last saved settings.
 */

export interface WidgetPreviewProps {
  settings: WidgetSettings;
  /** Fallback accent when the widget settings have not overridden it. */
  fallbackAccent: string;
}

function previewDocument(origin: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      html, body { margin: 0; height: 100%; background: transparent; }
      body { font-family: system-ui, sans-serif; }
    </style>
  </head>
  <body>
    <script src="${origin}/widget.js"></script>
    <script>
      // Nothing submitted from a preview should reach the ingestion endpoint.
      window.fetch = function () {
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve({ ok: true, status: 201, json: function () { return Promise.resolve({ data: {} }); } });
          }, 450);
        });
      };

      var current = null;

      function render(config) {
        current = config;
        window.Feedex.init(
          Object.assign({}, config, {
            key: 'preview',
            host: ${JSON.stringify(origin)},
            disableRemoteConfig: true,
          })
        );
        // The panel is the thing being configured, so it starts open.
        setTimeout(function () { window.Feedex.open(); }, 60);
      }

      window.addEventListener('message', function (event) {
        if (!event.data || event.data.type !== 'feedex-preview') return;
        render(event.data.config);
      });

      window.parent.postMessage({ type: 'feedex-preview-ready' }, '*');
    </script>
  </body>
</html>`;
}

/**
 * The page's own origin, read through the external-store hook.
 *
 * `window` does not exist during the server render, so this has to arrive on
 * the client — but as a snapshot React reads, not as state an effect writes,
 * which would cost a second render pass on every mount.
 */
const emptySubscribe = () => () => {};

function useOrigin(): string {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => window.location.origin,
    () => '',
  );
}

export function WidgetPreview({ settings, fallbackAccent }: WidgetPreviewProps) {
  const frame = React.useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = React.useState(false);
  const origin = useOrigin();

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'feedex-preview-ready') setReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Re-send on every settings change. Posting a message re-inits the widget in
  // place, which avoids the flash that reloading the iframe would cause on
  // each keystroke.
  React.useEffect(() => {
    if (!ready) return;

    frame.current?.contentWindow?.postMessage(
      {
        type: 'feedex-preview',
        config: {
          position: settings.position ?? 'bottom-right',
          accentColor: settings.accentColor ?? fallbackAccent,
          buttonLabel: settings.buttonLabel ?? 'Feedback',
          launcherIcon: settings.launcherIcon ?? 'chat',
          title: settings.title ?? 'Send feedback',
          description: settings.description ?? 'Found a bug or have an idea? Let us know.',
          successMessage: settings.successMessage ?? 'Thanks — your feedback has been received.',
          requireEmail: settings.requireEmail ?? false,
          attachments: settings.attachmentsEnabled ?? true,
          theme: settings.theme ?? 'auto',
          categories: settings.categories?.length
            ? settings.categories
            : ['bug', 'feature', 'ui', 'other'],
        },
      },
      '*',
    );
  }, [ready, settings, fallbackAccent]);

  if (!origin) {
    return <div className="h-[36rem] rounded-lg border border-line-subtle bg-surface-sunken" />;
  }

  return (
    <div className="relative h-[36rem] overflow-hidden rounded-lg border border-line-subtle bg-surface-sunken">
      {/*
        A faint page mock behind the widget, so the preview reads as a widget
        sitting on a site rather than a floating form on a blank panel.
      */}
      <div aria-hidden className="absolute inset-0 p-5">
        <div className="h-2.5 w-24 rounded-full bg-line" />
        <div className="mt-5 h-2 w-full rounded-full bg-line-subtle" />
        <div className="mt-2.5 h-2 w-4/5 rounded-full bg-line-subtle" />
        <div className="mt-2.5 h-2 w-2/3 rounded-full bg-line-subtle" />
        <div className="mt-6 h-24 w-full rounded-lg bg-line-subtle/60" />
      </div>

      <iframe
        ref={frame}
        title="Widget preview"
        srcDoc={previewDocument(origin)}
        // Scripts must run for the real widget to boot. `allow-same-origin` is
        // withheld, so the frame gets an opaque origin and cannot reach this
        // page's cookies or DOM.
        sandbox="allow-scripts"
        className="relative h-full w-full border-0 bg-transparent"
      />
    </div>
  );
}
