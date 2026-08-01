# Security

## Reporting a vulnerability

Please do not open a public issue.

Email **rian.fernando2006@gmail.com** with:

- what the issue is,
- how to reproduce it,
- what an attacker could do with it.

You will get an acknowledgement within 72 hours and an assessment within a
week. If the report is valid and you would like credit, you will get it.

## Scope

In scope:

- `feedex.rianfernando.com` and this repository
- Authentication, session handling, and API key handling
- Cross-tenant data access
- The ingestion endpoint and the embeddable widget

Out of scope:

- Missing security headers with no demonstrated impact
- Rate limiting on unauthenticated endpoints beyond documented limits
- Social engineering, physical access, or denial of service
- Findings from automated scanners without a working proof of concept

## What Feedex does

| Concern         | Approach                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Passwords       | scrypt, N=2^16 r=8 p=1, per-password salt, parameters stored in the hash                                     |
| Sessions        | 256-bit opaque tokens; only the SHA-256 is stored                                                            |
| Cookies         | `httpOnly`, `SameSite=Lax`, `Secure` in production                                                           |
| Secret API keys | Stored as HMAC digests keyed by `AUTH_SECRET`, shown once                                                    |
| Public API keys | Stored verbatim by design — they are published in snippets and grant only "create feedback for this project" |
| Input           | Zod-validated and bounded on every ingress path                                                              |
| Tenancy         | Every workspace-scoped query filters on `workspace_id` in the service layer                                  |
| Rate limiting   | Per IP and per project on ingestion, per key on the API, per IP on sign-in                                   |
| Enumeration     | Identical response and equivalent timing for unknown email and wrong password                                |
| Headers         | HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`                   |

## Known limitations

Stated plainly rather than discovered:

- **No MFA.** Roadmap.
- **No password reset flow.** Roadmap; it needs a transactional email provider.
- **The ingestion origin check is hygiene, not authentication.** `Origin` is set
  by the browser and absent on server-to-server calls. Nothing is built on the
  assumption that it cannot be forged.
- **Public keys are not secret.** By design. Abuse is bounded by rate limiting.
- **Rate limits are fixed-window.** A burst spanning a window boundary can
  briefly exceed the nominal rate.
