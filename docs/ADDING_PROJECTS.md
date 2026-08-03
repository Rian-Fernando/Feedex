# Adding your projects

How to put Feedex on rianfernando.com and every project linked from it.

Each site becomes its own **project** in Feedex, with its own key, its own
widget styling, and its own feedback stream — all landing in one dashboard.

---

## The short version

For each site, three steps:

1. **Create the project** — Dashboard → Projects → New project. Give it the
   name and the bare domain (`rianfernando.com`, no `https://`).
2. **Paste the snippet** before `</body>`.
3. **Style it** under Settings → Widget. No redeploy needed for this part.

That's it. The rest of this document is the detail for each kind of site.

---

## Step 1 — Create the project

Dashboard → **Projects** → **New project**.

| Field       | What to put                                                            |
| ----------- | ---------------------------------------------------------------------- |
| Name        | How it reads in your dashboard: `Portfolio`, `Naventra`, `Gerente`     |
| Domain      | Bare hostname: `rianfernando.com`, `naventra.rianfernando.com`         |
| Environment | `Production`                                                           |
| Colour      | The project's own accent — it tints the widget and the dashboard chips |

**Set the domain.** It restricts ingestion to that host and its subdomains, so
a leaked public key cannot be used to post junk into your workspace from
somewhere else. Leave it blank only if the site has no fixed hostname.

Landing on the project page, the **Install** tab has your snippet with the key
already in it.

---

## Step 2 — Add the snippet

### Next.js App Router

This is your portfolio and most of your projects. Add it to the root layout:

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

`lazyOnload` keeps the widget off the critical path — it loads after the page
is interactive, so it costs nothing in Lighthouse.

The key is publishable and safe in client HTML. It can only create feedback for
one project. Committing it is fine.

### Plain HTML

```html
<script
  src="https://feedex.rianfernando.com/widget.js"
  data-feedex-key="pk_fdx_your_project_key"
  defer
></script>
```

### Astro, Vite, SvelteKit, anything else

Same tag, in whatever file wraps every page. There is no build step, no
package to install, and no framework integration — it is one script tag
everywhere.

---

## Step 3 — Confirm it connected

Go back to the project's **Install** tab and load your site once. The badge
flips from **Waiting** to **Connected** on its own — it is driven by a real
request carrying that project's key, so it cannot say Connected unless the
widget is genuinely live on a page someone loaded.

If it stays on Waiting, see Troubleshooting below.

---

## Step 4 — Style it per project

**Settings → Widget** on the project. Set the accent to that project's colour,
the theme to match its scheme, the button label, and which categories a
reporter can pick.

A live preview beside the form runs the real widget against your unsaved
settings, so you can see it before you commit to it.

**These changes need no redeploy of your site.** The widget fetches its
configuration at boot, so saving here restyles every page that embeds it within
about five minutes. This is the part worth using: the snippet goes in once and
never has to be touched again.

Suggested per project:

| Project   | Theme  | Categories                    |
| --------- | ------ | ----------------------------- |
| Portfolio | `auto` | UI issue, Content, Other      |
| Naventra  | `dark` | Bug, UI issue, Feature, Other |
| Gerente   | `dark` | Bug, Feature, Performance     |
| Hivemind  | `dark` | Bug, Feature, Other           |

For a portfolio, dropping `Bug` and `Performance` and keeping `Content` and
`UI issue` matches what people will actually write to you about.

---

## Attaching the route to each report

If you want to know _which page_ a report came from — worth it on a portfolio
with many project pages — pass the current route as metadata. In Next.js:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';

export function FeedexRoute() {
  const pathname = usePathname();

  React.useEffect(() => {
    window.Feedex?.setMetadata({ route: pathname });
  }, [pathname]);

  return null;
}
```

Render it once in the layout, next to the script tag. The route then shows up
in the report's context panel, alongside the browser, OS, viewport, and screen
size the widget captures on its own.

---

## Opening the widget from your own UI

To trigger it from a "Send feedback" link in your footer instead of the
floating button:

```html
<script
  src="https://feedex.rianfernando.com/widget.js"
  data-feedex-key="pk_fdx_..."
  data-feedex-hide-button="true"
  defer
></script>

<button onclick="Feedex.open()">Send feedback</button>
```

`Feedex.open('bug')` opens it with a category preselected.

---

## Filing feedback as GitHub issues

Any report can be opened as a GitHub issue in one click, with the browser, OS,
viewport, and page already filled in — the context that a hand-copied report
always loses.

**Once per account:** on a project's Settings tab, choose **Connect GitHub**.
Feedex asks for repository access at that point rather than at sign-in, because
most people never file issues and nobody should be asked for write access to
their private repositories just to log in.

**Once per project:** set the repository as `owner/name`. It is checked when you
save — that it exists, that you can see it, that it is not archived, and that
issues are enabled — so a typo surfaces immediately rather than during triage.

**Then:** open any report and press **Create issue**. The button becomes a link
to the issue afterwards, so the same report cannot be filed twice.

Issues are created with **your** GitHub token, not a shared bot account. You can
only file where you could already file, and the issue is attributed to you.

---

## Managing several projects

Everything is workspace-scoped, so all your sites share one dashboard:

- **Overview** — totals across every project at once.
- **Feedback** — filter by project, status, priority, or category. This is where
  you triage across all of them in one pass.
- **Projects** — per-project streams when you want to focus on one site.

Feedback from one project never appears under another, and a public key only
ever grants "create feedback for this one project".

---

## Adding people to a workspace

Settings → **Members** → **Invite someone**.

Feedex creates a **link** rather than sending an email. There is no mail
provider to configure, no domain to verify, and no deliverability problem —
paste the link into Slack, a DM, or an email you send yourself.

- **With an email address** — only that address can accept, so forwarding the
  link grants nobody else access.
- **Without one** — anyone holding the link can accept it, once.

Links expire after seven days and work a single time. Only a hash of the token
is stored, so the link is shown **once** at creation; if it is lost, revoke the
invitation and make another.

### Roles

| Role       | Can                                                                                   |
| ---------- | ------------------------------------------------------------------------------------- |
| **Owner**  | Everything, including deleting the workspace. Only an owner can create another owner. |
| **Admin**  | Manage projects, members, and all feedback.                                           |
| **Member** | Create projects and triage feedback.                                                  |
| **Viewer** | Read-only access to projects and feedback.                                            |

A workspace always keeps at least one owner — the last one cannot be demoted or
removed.

---

## Troubleshooting

**The badge stays on Waiting.**
Open your site, then check the browser console. The most common causes are the
script tag sitting somewhere that does not render on every page, or an ad
blocker — some block any third-party script by hostname.

**Reports return 403.**
The project's domain does not match where the widget is running. A project with
`rianfernando.com` accepts that host and its subdomains, and nothing else. Check
for a `www.` mismatch.

**Reports return 401.**
The key is wrong, or belongs to a deleted project. Copy it again from the
Install tab. It should start with `pk_fdx_`.

**Styling changes are not showing up.**
The config response is edge-cached for five minutes. Wait, then hard-reload. If
a value still will not move, check whether the snippet sets it explicitly — an
attribute in the HTML always beats the dashboard, by design.

**It works locally but posts to production.**
Pass the origin explicitly rather than letting it be inferred:

```js
Feedex.init({ key: 'pk_fdx_...', host: window.location.origin });
```

---

## What to read next

- [WIDGET.md](WIDGET.md) — every configuration option, the JavaScript API,
  attachments, and what the widget collects
- [API.md](API.md) — the REST API, for pulling feedback into something else
- [DEPLOYMENT.md](DEPLOYMENT.md) — running your own instance
