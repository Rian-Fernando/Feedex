# API

Base URL: `https://feedex.rianfernando.com`

Two endpoints, two key types. Both answer with the same envelope.

---

## Response envelope

Success:

```json
{ "data": {} }
```

Failure:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid feedback payload.",
    "details": { "description": ["Description must be at least 5 characters."] }
  }
}
```

`code` is stable and machine-readable. `message` is safe to show a user.
`details` appears only for validation failures.

| Code               | Status | Meaning                             |
| ------------------ | ------ | ----------------------------------- |
| `unauthorized`     | 401    | Missing or unrecognised key         |
| `forbidden`        | 403    | Key is valid but not permitted here |
| `not_found`        | 404    | No such resource                    |
| `conflict`         | 409    | Already exists                      |
| `validation_error` | 422    | Payload failed validation           |
| `rate_limited`     | 429    | Slow down                           |
| `internal_error`   | 500    | Our fault                           |

---

## Keys

| Type   | Prefix    | Where it lives                   | Can                             |
| ------ | --------- | -------------------------------- | ------------------------------- |
| Public | `pk_fdx_` | Client-side, in a `<script>` tag | Create feedback for one project |
| Secret | `sk_fdx_` | Your server only                 | Read that project's feedback    |

Public keys are stored verbatim — they are published in snippets and are not
secrets. Secret keys are stored only as HMAC digests and shown once at creation.
Both rotate from the dashboard.

---

## `POST /api/v1/feedback`

Create a feedback item. Authenticated by a **public** key in the body. This is
what the widget calls.

CORS is open (`Access-Control-Allow-Origin: *`) because the widget runs on
origins Feedex cannot enumerate. It is safe because the endpoint accepts no
credentials, the key grants only "create feedback for this project", and it is
rate limited per IP and per project.

### Request

```json
{
  "publicKey": "pk_fdx_...",
  "category": "bug",
  "title": "Optional — derived from the description if omitted",
  "description": "The export button does nothing on the reports page.",
  "email": "user@example.com",
  "name": "Ada Lovelace",
  "context": {
    "url": "https://example.com/reports",
    "path": "/reports",
    "browser": "Chrome",
    "browserVersion": "131.0.6778",
    "os": "macOS 15.2",
    "device": "desktop",
    "viewport": { "width": 1512, "height": 858 },
    "language": "en-US",
    "timezone": "America/New_York",
    "custom": { "plan": "pro" }
  }
}
```

| Field         | Type   | Required | Notes                                                                                      |
| ------------- | ------ | -------- | ------------------------------------------------------------------------------------------ |
| `publicKey`   | string | yes      | 8–128 chars                                                                                |
| `description` | string | yes      | 5–5000 chars                                                                               |
| `category`    | enum   | no       | `bug`, `feature`, `ui`, `performance`, `content`, `question`, `other`. Defaults to `other` |
| `title`       | string | no       | ≤200 chars; derived from the description if omitted                                        |
| `email`       | string | no       | Valid email, or empty                                                                      |
| `name`        | string | no       | ≤120 chars                                                                                 |
| `context`     | object | no       | All fields optional; unknown keys are dropped                                              |

### Response — 201

```json
{
  "data": {
    "id": "fbk_m4x9k2c1_a83jf0zq",
    "reference": "#42",
    "status": "open",
    "createdAt": "2026-08-01T17:04:11.221Z"
  }
}
```

### Example

```bash
curl -X POST https://feedex.rianfernando.com/api/v1/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "pk_fdx_...",
    "category": "bug",
    "description": "The export button does nothing on the reports page.",
    "email": "user@example.com"
  }'
```

### Rate limits

| Scope       | Limit        |
| ----------- | ------------ |
| Per IP      | 20 / minute  |
| Per project | 240 / minute |

---

## `GET /api/v1/issues`

List a project's feedback. Authenticated by a **secret** key as a bearer token.

Scoped to the key's own project. A `projectId` query parameter is ignored — the
key decides.

### Query parameters

| Name       | Type   | Default  | Notes                                                  |
| ---------- | ------ | -------- | ------------------------------------------------------ |
| `status`   | enum   | —        | `open`, `in_progress`, `testing`, `resolved`, `closed` |
| `priority` | enum   | —        | `low`, `medium`, `high`, `critical`                    |
| `category` | enum   | —        | As above                                               |
| `q`        | string | —        | Substring match on title, description, reporter email  |
| `sort`     | enum   | `newest` | `newest`, `oldest`, `priority`                         |
| `page`     | int    | `1`      | 1–1000                                                 |
| `perPage`  | int    | `25`     | 1–100                                                  |

### Response — 200

```json
{
  "data": {
    "items": [
      {
        "id": "fbk_m4x9k2c1_a83jf0zq",
        "reference": 42,
        "title": "Export button does nothing",
        "description": "Clicking Export CSV does nothing at all.",
        "category": "bug",
        "status": "open",
        "priority": "critical",
        "tags": [],
        "reporter": { "email": "user@example.com", "name": null },
        "context": {
          "url": "https://example.com/reports",
          "browser": "Chrome",
          "viewport": { "width": 1512, "height": 858 }
        },
        "createdAt": "2026-08-01T17:04:11.221Z",
        "updatedAt": "2026-08-01T17:04:11.221Z",
        "resolvedAt": null
      }
    ],
    "pagination": { "page": 1, "perPage": 25, "total": 1, "totalPages": 1 }
  }
}
```

Internal notes are never returned.

### Example

```bash
curl https://feedex.rianfernando.com/api/v1/issues \
  -H "Authorization: Bearer sk_fdx_..." \
  -G -d status=open -d priority=critical -d perPage=50
```

### Rate limits

120 requests per minute per key. Every response carries:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 2026-08-01T17:05:00.000Z
```

---

## `GET /api/health`

Unauthenticated liveness probe. Executes a real query, so it fails when the
process is up but the database is not.

```json
{
  "status": "ok",
  "driver": "postgres",
  "latencyMs": 3,
  "timestamp": "2026-08-01T17:04:11.221Z"
}
```

Returns `503` with `"status": "error"` when the database is unreachable.

---

## Versioning

The path carries the version. `v1` is stable: fields will be added, never
removed or repurposed. A breaking change would ship as `v2` alongside it.

## Not yet available

Writes through the API (updating status, adding notes), webhooks, and listing
projects. All are on the [roadmap](ROADMAP.md).
