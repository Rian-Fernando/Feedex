# Widget

The embeddable feedback widget. 7 kB gzipped, no dependencies, no build step.

---

## Install

Paste one tag before the closing `</body>`:

```html
<script
  src="https://feedex.rianfernando.com/widget.js"
  data-feedex-key="pk_fdx_your_project_key"
  defer
></script>
```

Your public key is on the project's **Install** tab in the dashboard.

A button appears in the bottom-right corner. Clicking it opens the form.
Nothing else on your page changes.

### Next.js

```tsx
// app/layout.tsx
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="https://feedex.rianfernando.com/widget.js"
          data-feedex-key="pk_fdx_your_project_key"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
```

---

## Configure with attributes

Every option has a `data-feedex-*` attribute, so the common case needs no
JavaScript.

| Attribute                   | Values                        | Default                                     |
| --------------------------- | ----------------------------- | ------------------------------------------- |
| `data-feedex-key`           | Your public key               | **required**                                |
| `data-feedex-host`          | Feedex origin                 | The script's own origin                     |
| `data-feedex-position`      | `bottom-right`, `bottom-left` | `bottom-right`                              |
| `data-feedex-accent`        | Any hex colour                | `#B58BF9`                                   |
| `data-feedex-label`         | Button text                   | `Feedback`                                  |
| `data-feedex-title`         | Panel heading                 | `Send feedback`                             |
| `data-feedex-description`   | Panel subheading              | `Found a bug or have an idea? Let us know.` |
| `data-feedex-theme`         | `light`, `dark`, `auto`       | `auto`                                      |
| `data-feedex-require-email` | `true`, `false`               | `false`                                     |
| `data-feedex-hide-button`   | `true`, `false`               | `false`                                     |
| `data-feedex-categories`    | Comma-separated               | `bug,feature,ui,other`                      |

Example:

```html
<script
  src="https://feedex.rianfernando.com/widget.js"
  data-feedex-key="pk_fdx_..."
  data-feedex-position="bottom-left"
  data-feedex-accent="#F7B83D"
  data-feedex-label="Report a problem"
  data-feedex-categories="bug,performance,other"
  data-feedex-require-email="true"
  defer
></script>
```

Settings saved in the dashboard apply to the widget's defaults; attributes
override them per page.

---

## Drive it from JavaScript

The script defines exactly one global: `window.Feedex`.

```ts
Feedex.init(config); // manual boot (omit the key attribute)
Feedex.open('bug'); // open, optionally on a category
Feedex.close();
Feedex.identify({ email, name }); // associate a known user
Feedex.setMetadata({ plan: 'pro' }); // attach to every submission
Feedex.destroy();
Feedex.version; // "0.1.0"
```

### Where submissions are sent

The widget posts to the origin it was served from, discovered from its own
`<script>` tag. If you boot it with `Feedex.init()` rather than the
`data-feedex-key` attribute, pass `host` explicitly:

```js
Feedex.init({ key: 'pk_fdx_...', host: window.location.origin });
```

Without it a programmatic boot has no tagged script to inspect, and a
self-hosted instance would post to the hosted one.

### Your own trigger

Hide the default button and wire your own:

```html
<script
  src="https://feedex.rianfernando.com/widget.js"
  data-feedex-key="pk_fdx_..."
  data-feedex-hide-button="true"
  defer
></script>

<button onclick="Feedex.open('bug')">Report a bug</button>
```

### Attach application context

```js
Feedex.identify({ email: user.email, name: user.name });

Feedex.setMetadata({
  plan: user.plan,
  build: process.env.NEXT_PUBLIC_BUILD_SHA,
  route: router.pathname,
});
```

Metadata appears on the feedback detail page under **Custom metadata**. Keys are
capped at 64 characters and values at 512.

---

## What it collects

Automatically, with every submission:

| Field                       | Source                                                       |
| --------------------------- | ------------------------------------------------------------ |
| `url`, `path`               | `window.location`                                            |
| `referrer`                  | `document.referrer`                                          |
| `browser`, `browserVersion` | Parsed from the user agent                                   |
| `os`                        | Parsed from the user agent                                   |
| `device`                    | `desktop`, `tablet`, or `mobile`, from viewport width and UA |
| `viewport`                  | `window.innerWidth/Height`                                   |
| `screen`                    | `window.screen`                                              |
| `language`                  | `navigator.language`                                         |
| `timezone`                  | `Intl.DateTimeFormat().resolvedOptions().timeZone`           |
| `userAgent`                 | Recorded server-side, so it cannot be spoofed by the payload |

It does **not** read cookies, write to `localStorage` or `sessionStorage`, or
compute a fingerprint. Email is collected only when the reporter types one.

---

## How it stays out of your way

- **Shadow DOM.** The entire UI renders in a shadow root, so your CSS cannot
  reach it and its CSS cannot reach your page. No reset, no specificity war, no
  `!important`.
- **One global.** `window.Feedex` and nothing else.
- **No webfont.** It uses Space Grotesk if your page already serves it, and the
  platform UI font otherwise. A third-party script has no business adding a
  network request or a font swap to someone else's page.
- **No cookies on the request.** Submissions are sent with
  `credentials: 'omit'`.
- **Fails quietly.** A network error shows an inline message in the panel and is
  never thrown into your page's error handling.

## Accessibility

- The panel is a labelled dialog; focus moves to the description field on open
  and returns to the trigger on close.
- Escape closes it. Pointer-down outside dismisses it.
- Categories are a real radio group in a `fieldset` with a `legend`, so
  keyboard and screen-reader semantics are native.
- Submission results are announced through a polite live region.
- Every control has a visible focus ring.
- Transitions are disabled under `prefers-reduced-motion`.

## Browser support

Chrome 80+, Firefox 78+, Safari 15+, Edge 88+.

Safari 15 is the floor because esbuild declines to emit destructuring for
Safari 14, which shipped a codegen bug around it.

---

## Troubleshooting

**The button does not appear.**
Check the console for `[Feedex]`. The usual cause is a missing or mistyped
`data-feedex-key`. Confirm the key starts with `pk_fdx_`.

**Submissions return 403.**
The project's **Domain** does not match the page's host. Either clear it (which
allows any origin) or set it to the right hostname. `localhost` is always
allowed so you can test against a production key.

**Submissions return 429.**
Rate limited — 20 submissions per minute per IP, 240 per minute per project.

**The styling looks wrong.**
It should not be possible for your CSS to affect it. If it happens, the shadow
root failed to attach; check for a browser extension interfering with
`attachShadow`.

**I need a field that is not there.**
`setMetadata` accepts arbitrary key/value pairs and they show up on the detail
page. If it is something every project would want, open an issue.
