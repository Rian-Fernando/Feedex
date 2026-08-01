# Roadmap

What is deliberately not in v0.1, and where each piece slots in.

The current release is a foundation. Everything below is additive — none of it
requires reshaping the data model.

---

## Shipped

- Multi-tenant workspaces, projects, and feedback
- Embeddable widget with automatic context capture
- Triage across seven categories, five statuses, four priorities
- Filtering and search, with filters in the URL
- Internal notes and an activity timeline
- Public and secret API keys, rotatable
- REST read API with rate limit headers
- Credentials auth with database-backed sessions
- Light and dark themes
- SEO and GEO: sitemap, robots, JSON-LD, `llms.txt`, OG card

---

## Next

**Team members.** The `workspace_members` table, the four roles, and the
capability matrix already exist and are enforced. What is missing is the
invitation flow and the email to carry it.

**Email notifications.** A digest of new feedback, and an alert on `critical`.
Needs a transactional email provider; `recordActivity` is the emit point.

**Webhooks.** `POST` to a configured URL on feedback created and status
changed. Same emit point as notifications.

**Screenshot capture.** `feedback.screenshot_url` exists and the detail page
already renders it. The widget needs an opt-in capture step and somewhere to
store the image.

**API writes.** Update status, priority, and tags; add notes. The service layer
already exposes these to the dashboard.

---

## Later

**AI issue summaries.** Condense a long report into a sentence. A service that
reads `feedback.description` and writes a new column.

**Duplicate detection.** Embed descriptions, compare on ingest, link probable
duplicates. Needs a vector column; `pgvector` on the same database.

**AI categorisation.** Suggest a category on ingest instead of trusting the
reporter's choice. Writes `category` — no schema change.

**GitHub and Linear sync.** Create an issue from a feedback item and mirror its
status back. A join table keyed by `feedback_id`, and the service layer as the
boundary.

**Slack and Discord delivery.** Post new feedback into a channel. Webhooks
first, then these as presets on top.

**Feature voting and public roadmaps.** Let reporters upvote requests and see
what is planned. A new public surface, and a `votes` table.

**Analytics.** Resolution time distributions, volume by project over time,
category trends. The data is already recorded; this is a reporting layer.

**Session replay.** The heaviest item and the one with the most privacy
surface. Only worth doing with strict redaction and explicit consent.

---

## Not planned

**A paid tier.** Feedex is free and MIT licensed, and the intent is to keep it
that way. Team features will ship as part of the same free product.

**Mobile SDKs.** The REST API already accepts submissions from any client.

**A visual page-annotation mode.** Interesting, but it doubles the widget's
size, which is the one number this product is careful about.

---

## Principles

1. **The widget's size budget is real.** CI fails above 12 kB gzipped. Any
   feature that pushes past it needs a separate opt-in bundle.
2. **The schema absorbs change.** `context` and `metadata` are `jsonb` so the
   widget can capture more without a migration.
3. **Tenancy is not retrofittable.** Every new table carries `workspace_id`,
   and every new query filters on it.
4. **No AI in the critical path.** Categorisation and summaries will be
   suggestions layered on top of a system that works without them.
