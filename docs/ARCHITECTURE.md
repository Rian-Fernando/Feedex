# Architecture

The decisions behind Feedex, and what each one costs.

---

## Shape

One Next.js application serves three surfaces:

| Surface        | Route group   | Rendering                          |
| -------------- | ------------- | ---------------------------------- |
| Marketing site | `(marketing)` | Server-rendered, mostly static     |
| Authentication | `(auth)`      | Dynamic — reads the session cookie |
| Dashboard      | `(dashboard)` | Dynamic, Server Components         |
| Public API     | `app/api`     | Route handlers, Node runtime       |

A monorepo was considered and rejected. The widget is the only genuinely
separate artefact, and it is a single directory built by one esbuild script —
not enough to justify workspace tooling.

---

## Layers

```
route / server action
      ↓  authorises, validates
service  (src/server/services)
      ↓  workspace-scoped queries
Drizzle  (src/lib/db)
      ↓
PostgreSQL
```

The rule that keeps this honest: **routes and components never query the
database directly.** Everything goes through a service function, and every
service function that touches tenant data takes `workspaceId` as its first
argument and filters on it.

That is what makes cross-tenant access a compile-time-visible mistake rather
than a subtle one. A caller who has authenticated but not authorised still
cannot name another workspace's project id and receive data, because the
`WHERE` clause has both.

---

## Tenancy

```
workspace
├── members        (user, role)
├── projects
│   ├── api_keys   (public, secret)
│   └── feedback
│       └── notes
└── activities
```

`feedback.workspace_id` is denormalised from its project. Strictly it is
derivable through the join, but every dashboard query is workspace-scoped and
carrying the column means those queries never need the join at all. The service
layer sets it on write; nothing else may.

### Roles

Permissions are a table, not scattered conditionals:

```ts
const CAPABILITIES = {
  'workspace.update': ['owner', 'admin'],
  'project.create': ['owner', 'admin', 'member'],
  'feedback.delete': ['owner', 'admin'],
  // …
};
```

Adding a role or a permission is a single edit. `can(role, capability)` reads
it; `assertCan` throws. Only one user exists today, but the model is already
correct, so invitations become a feature rather than a migration.

---

## The two database drivers

Feedex speaks one SQL dialect — PostgreSQL — through two drivers:

| Driver          | When                  | Why               |
| --------------- | --------------------- | ----------------- |
| `node-postgres` | `DATABASE_URL` is set | Production        |
| PGlite          | otherwise             | Local development |

PGlite is PostgreSQL compiled to WebAssembly, persisted to `.data/`. Because
both drivers execute the same dialect against the same migrations, a query that
works on one works on the other.

**What this buys:** `git clone && npm install && npm run dev` produces a working
application with a real database. No Docker daemon, no service to install, no
connection string.

**What it costs:** the two Drizzle client types are nominally different, so
`getDb()` presents the PGlite client as `NodePgDatabase`. The query surface is
identical, but the cast is a seam worth knowing about.

**What it is not:** a production option. Serverless filesystems are ephemeral
and per-instance, so PGlite in production would lose data. `env()` enforces
`DATABASE_URL` at runtime in production for exactly this reason.

---

## Request paths

### Widget ingestion — the only unauthenticated write

`POST /api/v1/feedback`

1. Parse and bound the payload with Zod. Unknown context keys are stripped.
2. Rate limit per IP.
3. Resolve the public key to a project; reject revoked keys and archived or
   paused projects.
4. Rate limit per project, so one leaked key cannot flood a workspace.
5. Check `Origin` against the project's declared domain.
6. Insert, allocating a per-project reference number.

Points worth calling out:

- **The public key is not a secret.** It ships in a `<script>` tag. Its only
  capability is "create feedback for this project". Abuse is bounded by rate
  limiting and the origin check, not by confidentiality.
- **The origin check is hygiene, not authentication.** `Origin` is set by the
  browser and absent on server-to-server calls. It stops casual misuse of a key
  found in someone's page source; it does not stop a determined caller, and
  nothing is built on the assumption that it does.
- **Rate limits live in Postgres.** An in-memory counter would multiply the
  effective limit by the instance count. The whole check is one atomic upsert,
  so concurrent requests cannot race past it. Redis is the upgrade path, behind
  the same `consume()` signature.
- **Reference allocation retries.** `reference` is computed as
  `max(reference) + 1` inside the insert. Two simultaneous submissions can
  compute the same value; the unique index on `(project_id, reference)` turns
  that race into a retryable conflict rather than a duplicate.

### Dashboard read

Session cookie → `getSession()` → workspace resolution → service call.

Session lookup is memoised per request with React's `cache()`, so a layout, a
page, and three components resolving the user cost one query.

The active workspace comes from a cookie, but **resource pages authorise
against the resource's own workspace**, not the cookie. A stale cookie can
therefore never grant or deny access to a specific record — it only picks which
list you land on.

### REST API

`GET /api/v1/issues`, bearer token.

Scoped to the key's own project rather than its workspace. A secret key is
issued per project, and widening its reach to siblings would make rotation a
workspace-wide event.

---

## Authentication

Custom, built on Node's standard library. No auth framework.

| Concern          | Approach                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| Password hashing | scrypt, N=2^16 r=8 p=1, per-password salt                                                                       |
| Hash format      | `scrypt$1$N$r$p$salt$hash` — self-describing, so parameters can be raised and old hashes upgraded on next login |
| Sessions         | 256-bit random token in an `httpOnly`, `SameSite=Lax` cookie                                                    |
| Session storage  | Only SHA-256 of the token — a database snapshot cannot be replayed as a login                                   |
| Expiry           | 30 days, sliding; refreshed at most once per day to avoid a write per request                                   |
| Enumeration      | Identical response and equivalent CPU time for unknown email and wrong password                                 |

**Why not a library.** Credentials-only auth is a small, well-understood
problem, and the two common choices each carry a real cost: NextAuth's
credentials provider is deliberately limited and does not work with database
sessions, and Better Auth is another dependency to track for functionality that
is ~200 lines of standard-library code. The `accounts` table already models
external identity links, so adding a provider means adding a
`signInWithProvider` function beside the existing ones — not reshaping the
identity model.

### OAuth

Google and GitHub are implemented directly against the providers rather than
through a framework. The flow is small — an authorization redirect, a code
exchange, one profile request — and doing it in-house keeps the session model
unchanged: a provider sign-in ends in exactly the same opaque, database-backed
session a password produces, so nothing downstream knows which strategy was
used.

| Concern             | Approach                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| CSRF                | A random `state` in a ten-minute httpOnly cookie, checked on return                                                          |
| Code interception   | PKCE (S256) for Google; GitHub does not document support, where `state` carries the flow                                     |
| Account linking     | Only on a provider-_verified_ email — otherwise registering elsewhere with someone's address would take over their workspace |
| Provider-only users | `password_hash` stays null; they can set one later, and the last sign-in method cannot be unlinked                           |
| Not configured      | A provider missing either credential is absent from the sign-in page entirely                                                |

**What this costs:** no MFA, no magic links, no password reset flow yet. Those
are roadmap items, and each is additive.

---

## Design system

Tailwind v4, configured CSS-first. Every value the interface can use is a token
in `src/styles/globals.css`; components reference tokens, never raw hex.

Colour is OKLCH. Perceptual lightness comes first, so a scale steps evenly to
the eye and contrast stays predictable when a hue is retuned.

The brand supplies two accents — gold `#F7B83D` (the customer's voice) and
violet `#B58BF9` (the developer's response). Both are _brand_ colours and are
deliberately never used to signal state. The semantic ramps sit at hues far
enough from both (warning at 45°, not gold's 80°; info at 235°, not violet's
300°) that a status can never be mistaken for branding.

The neutral ramp is two families, not one: cool plum on dark, warm paper on
light, matching the handoff. Light and dark are a variable swap, not a `dark:`
variant on every element.

---

## Performance

- The WebGL hero is dynamically imported, client-only, and mounted on
  `requestIdleCallback`. Nothing above the fold depends on it.
- The scene stops its render loop entirely under `prefers-reduced-motion`.
- Project and feedback lists use grouped aggregate queries, so the number of
  round trips stays constant as rows are added.
- The widget is bundled separately from the app, so nothing from the dashboard
  can be pulled into it. CI fails the build if it exceeds 12 kB gzipped.
- Fonts are self-hosted by `next/font`, so there is no render-blocking request
  and no layout shift.

---

## Extension points

Designed for, not built:

| Feature              | Where it slots in                                                           |
| -------------------- | --------------------------------------------------------------------------- |
| OAuth providers      | `accounts` table exists; add a provider function beside `verifyCredentials` |
| Team invitations     | Roles and the capability matrix already exist                               |
| Webhooks             | `recordActivity` is the natural emit point                                  |
| AI categorisation    | A service that reads `feedback` and writes `category` — no schema change    |
| Duplicate detection  | Same; `context` and `description` are already stored                        |
| GitHub / Linear sync | Add a table keyed by `feedback_id`; the service layer is the boundary       |
| Screenshot capture   | `feedback.screenshot_url` exists and the detail page already renders it     |
| Full-text search     | Replace the `ILIKE` in `listFeedback`; no call site changes                 |
| Redis rate limiting  | Reimplement `consume()`; no call site changes                               |

The `context` column is `jsonb` precisely so the widget can capture more without
a migration. Every field is optional on both sides.
