# Deployment

How Feedex gets from a local checkout to `https://feedex.rianfernando.com`, with
DNS on Cloudflare and the site verified in Google Search Console.

Work through the parts in order. Each one is independent enough to stop and
resume between them.

---

## What Feedex needs to run

| Requirement    | Why                                            | Where it comes from                     |
| -------------- | ---------------------------------------------- | --------------------------------------- |
| Node.js 20.9+  | Runtime                                        | Vercel provides it                      |
| PostgreSQL     | All persistent data                            | **You must provision this** — see below |
| `DATABASE_URL` | Connection string                              | From the database provider              |
| `AUTH_SECRET`  | Derives API key digests, signs tokens          | You generate it                         |
| `APP_URL`      | Canonical origin for absolute URLs and cookies | `https://feedex.rianfernando.com`       |

Nothing else. No Redis, no object storage, no email provider in this version.

---

## Part 1 — The database

### Is it local right now?

Yes. In development, with `DATABASE_URL` unset, Feedex runs an **embedded
PGlite** database — PostgreSQL compiled to WebAssembly — stored in `.data/` in
the project folder. That is why `npm run dev` works with nothing installed.

That embedded database is **development only**. Serverless functions on Vercel
get an ephemeral, per-instance filesystem, so a file-backed database there would
be empty on some requests, stale on others, and wiped on every deploy. Production
needs a real PostgreSQL server.

### Do you need Supabase? Does Vercel provide one?

You need _a_ Postgres. Several options work, and Feedex does not care which —
it only needs a connection string.

| Option                          | Free tier              | Notes                                                                                                                                     |
| ------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Neon** (recommended)          | 0.5 GB, scales to zero | Serverless Postgres, built for this shape of workload. Available directly in the Vercel dashboard under Storage.                          |
| **Supabase**                    | 500 MB                 | Works fine. You would use only the Postgres part — Feedex has its own auth, so Supabase Auth stays unused.                                |
| **Vercel Postgres**             | —                      | Now a thin layer over Neon; provisioning through the Vercel Storage tab gives you the same thing with the env var wired in automatically. |
| **Railway / Render / your own** | Varies                 | Any reachable Postgres 14+ works.                                                                                                         |

**Recommendation: Neon, provisioned from inside Vercel.** It sets
`DATABASE_URL` on the project for you, scales to zero when idle, and there is
no second dashboard to manage.

Supabase is not needed. If you already use it elsewhere and would rather keep
one provider, it works equally well — just take the connection string from
_Project Settings → Database → Connection string → URI_ and use the **pooled**
(port 6543) variant.

### Provision it

1. In the Vercel dashboard, open your project → **Storage** → **Create
   Database** → **Neon**.
2. Pick a region close to your users. `iad1` (Washington) is a reasonable
   default for a mostly-US audience.
3. Connect it to the project. Vercel injects `DATABASE_URL` into all
   environments.

If you provision outside Vercel, add `DATABASE_URL` manually in Part 3.

### Run the migrations

Feedex ships plain SQL migrations in `drizzle/`. Against production they run as
a deliberate step, not implicitly on a request.

```bash
# From your machine, pointed at the production database
DATABASE_URL="postgres://..." npm run db:migrate
```

Run this once after the first deploy, and again after any deploy that includes
new files in `drizzle/`.

> Do **not** run `npm run db:seed` against production — it creates a demo
> account with a published password.

---

## Part 2 — Deploy to Vercel

### Push the repository first

```bash
git remote add origin https://github.com/Rian-Fernando/Feedex.git
git push -u origin main
```

### Import it

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import `Rian-Fernando/Feedex`.
3. Vercel detects Next.js. Leave the build settings alone — the `build` script
   already bundles the widget before `next build`.
4. **Do not deploy yet.** Add the environment variables first (Part 3), or the
   first deploy will build fine and then fail at runtime on a missing
   `DATABASE_URL`.

### Build settings (for reference)

| Setting          | Value                     |
| ---------------- | ------------------------- |
| Framework preset | Next.js                   |
| Build command    | `npm run build` (default) |
| Output directory | `.next` (default)         |
| Install command  | `npm install` (default)   |
| Node version     | 20.x or 22.x              |

---

## Part 3 — Environment variables

In Vercel: **Settings → Environment Variables**. Add these for
_Production_ (and _Preview_, if you want preview deployments to work).

| Name             | Value                             | Notes                                                                                            |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`   | `postgres://…`                    | Auto-set if you provisioned through Vercel Storage.                                              |
| `AUTH_SECRET`    | Generate — see below              | Required. Rotating it invalidates every API key digest.                                          |
| `APP_URL`        | `https://feedex.rianfernando.com` | Set this **after** the domain is attached (Part 4).                                              |
| `DISABLE_SIGNUP` | `true`                            | Optional. Set it once your own account exists so the instance stops accepting new registrations. |

Generate the secret:

```bash
openssl rand -base64 48
```

> `AUTH_SECRET` keys the HMAC used for secret API keys. If you change it later,
> existing `sk_fdx_…` keys stop validating and have to be rotated from the
> dashboard. Set it once and leave it.

Redeploy after adding variables — Vercel does not apply them to an existing
build.

---

## Part 4 — Domain and Cloudflare DNS

Your apex `rianfernando.com` is on Cloudflare. You are adding
`feedex.rianfernando.com` as a subdomain pointing at Vercel.

### Add the domain in Vercel

1. Project → **Settings** → **Domains**.
2. Add `feedex.rianfernando.com`.
3. Vercel shows the DNS record it wants — a `CNAME` to
   `cname.vercel-dns.com`.

### Add the record in Cloudflare

1. Cloudflare dashboard → `rianfernando.com` → **DNS** → **Records** → **Add
   record**.
2. Fill in:

   | Field        | Value                     |
   | ------------ | ------------------------- |
   | Type         | `CNAME`                   |
   | Name         | `feedex`                  |
   | Target       | `cname.vercel-dns.com`    |
   | Proxy status | **DNS only** (grey cloud) |
   | TTL          | Auto                      |

3. Save.

**The proxy status matters.** Leave it grey (DNS only), at least initially:

- Vercel issues and renews the TLS certificate itself, and it validates over
  HTTP. With Cloudflare's orange-cloud proxy on, that validation can fail and
  the domain sits in "Invalid Configuration".
- Orange-cloud also puts Cloudflare's cache in front of Vercel's, which means
  two caches to reason about and stale HTML after deploys unless you configure
  page rules carefully.
- You gain little: Vercel already fronts the app with its own CDN.

If you later want Cloudflare's WAF in front, switch to orange cloud **after**
the certificate is issued, and set the SSL/TLS mode to **Full (strict)** —
anything less will loop or serve the wrong certificate.

### Verify

DNS usually propagates in a minute or two.

```bash
dig +short feedex.rianfernando.com
curl -sI https://feedex.rianfernando.com | head -1
curl -s https://feedex.rianfernando.com/api/health
```

The health endpoint should return `{"status":"ok","driver":"postgres",…}`. If
`driver` says `pglite`, `DATABASE_URL` did not reach the runtime.

### Update `APP_URL`

Set `APP_URL=https://feedex.rianfernando.com` in Vercel and redeploy. This
affects:

- absolute URLs in metadata and the sitemap,
- the `Secure` flag on the session cookie,
- the install snippet shown on each project page.

---

## Part 5 — First run

1. Visit `https://feedex.rianfernando.com/register` and create your account.
   The first registration also creates your workspace.
2. Set `DISABLE_SIGNUP=true` in Vercel and redeploy, so the instance stops
   accepting new registrations.
3. Create a project, copy the public key, and add the snippet to a real site:

   ```html
   <script
     src="https://feedex.rianfernando.com/widget.js"
     data-feedex-key="pk_fdx_..."
     defer
   ></script>
   ```

4. Submit a test report and confirm it lands in the dashboard.

---

## Part 6 — Google Search Console

### Verify the property

Use a **Domain property** if you want one entry covering the apex and every
subdomain, or a **URL prefix property** for just this subdomain. The domain
property is the better long-term choice given you will add more subdomains.

**Domain property (recommended):**

1. Search Console → **Add property** → **Domain** → `rianfernando.com`.
2. Google gives you a `TXT` record.
3. Cloudflare → DNS → Add record:

   | Field   | Value                        |
   | ------- | ---------------------------- |
   | Type    | `TXT`                        |
   | Name    | `@`                          |
   | Content | `google-site-verification=…` |

4. Back in Search Console, click **Verify**.

**URL prefix property (subdomain only):**

1. Add property → **URL prefix** → `https://feedex.rianfernando.com`.
2. Choose **HTML tag** verification and copy the `content` value.
3. Add it to `src/config/site.ts`, then surface it in the root layout's
   metadata:

   ```ts
   // src/app/layout.tsx
   export const metadata: Metadata = {
     // …
     verification: { google: 'YOUR_VERIFICATION_CODE' },
   };
   ```

4. Deploy, then click **Verify**.

### Submit the sitemap

Search Console → **Sitemaps** → enter `sitemap.xml` → **Submit**.

The full URL is `https://feedex.rianfernando.com/sitemap.xml`.

### Request indexing

Search Console → **URL Inspection** → paste
`https://feedex.rianfernando.com/` → **Request indexing**. This nudges the
first crawl; it is not required.

### What to expect

- Verification is immediate once the DNS record propagates.
- First crawl typically lands within a few days.
- The dashboard and API are `Disallow`ed in `robots.txt` and marked
  `noindex`, so Search Console will report them as excluded. That is correct,
  not an error.

### Also worth doing

- **Bing Webmaster Tools** — supports importing directly from Search Console,
  so it is a two-minute job. Bing's index also feeds several AI assistants.
- Confirm `https://feedex.rianfernando.com/llms.txt` is reachable. It is not
  part of Search Console, but it is what AI crawlers read.

---

## Ongoing operations

### Migrations on later deploys

```bash
npm run db:generate                     # after editing src/lib/db/schema.ts
DATABASE_URL="postgres://..." npm run db:migrate
```

Commit the generated SQL in `drizzle/`. Run the migration before or immediately
after the deploy that needs it.

### Backups

Neon and Supabase both keep automatic point-in-time backups on their free
tiers. Confirm the retention window in the provider dashboard — it is usually
7 days on free plans.

### Monitoring

`GET /api/health` returns `200` with the active driver and query latency, or
`503` if the database is unreachable. Point an uptime check at it.

### Rotating a leaked key

Dashboard → project → **Install** → **Rotate**. The old key stops working
immediately. Rotating the public key means updating the snippet wherever it is
installed.

---

## Troubleshooting

| Symptom                                 | Cause                                     | Fix                                                           |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| Build succeeds, runtime 500s            | `DATABASE_URL` missing                    | Add it in Vercel, redeploy                                    |
| `/api/health` reports `driver: pglite`  | `DATABASE_URL` not visible to the runtime | Check it is set for the right environment, redeploy           |
| `relation "users" does not exist`       | Migrations never ran                      | `DATABASE_URL=… npm run db:migrate`                           |
| Domain stuck on "Invalid Configuration" | Cloudflare proxy is on                    | Set the record to DNS only (grey cloud)                       |
| Redirect loop on the subdomain          | Cloudflare SSL mode is Flexible           | Set it to Full (strict)                                       |
| Widget gets a CORS error                | Project domain does not match the host    | Clear the project's Domain field, or set it to the right host |
| Sessions drop on every request          | `APP_URL` scheme is `http` in production  | Set it to the `https://` origin                               |
| Secret keys stop validating             | `AUTH_SECRET` changed                     | Rotate the secret keys from the dashboard                     |
