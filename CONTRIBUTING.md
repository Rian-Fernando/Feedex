# Contributing

Thanks for taking a look. Issues and pull requests are welcome.

## Getting set up

```bash
git clone https://github.com/Rian-Fernando/Feedex.git
cd Feedex
npm install
npm run db:seed
npm run dev
```

No database to install — local development runs an embedded PGlite instance
under `.data/`. The seed prints a demo account to sign in with.

## Before you open a pull request

```bash
npm run verify        # format, lint, typecheck, unit tests
npm run test:e2e      # browser smoke test, needs `npm run dev` running
```

CI runs the same checks plus a production build and the widget size budget.

## Conventions

- **Comments explain why, not what.** If a line needs a comment to say what it
  does, the line is the problem.
- **Data access goes through `src/server/services`.** Routes and components do
  not query the database directly, and every workspace-scoped function takes
  `workspaceId` first and filters on it.
- **Validation lives in `src/lib/validation.ts`.** One schema per contract,
  shared by server actions, the API, and the widget.
- **Styling uses tokens.** No raw hex, no one-off pixel values. If a value does
  not exist as a token, add the token.
- **The widget has no dependencies.** That is the constraint that keeps it small.

## Changing the schema

```bash
# edit src/lib/db/schema.ts
npm run db:generate
npm run db:reset      # local only — drops the embedded database
npm run dev
```

Commit the generated SQL in `drizzle/`. Never edit an applied migration; add a
new one.

## Changing the widget

```bash
npm run widget:watch
```

Keep it under the 12 kB gzipped budget. If a change pushes past it, that is a
design discussion, not a build flag.

## Commit messages

Present tense, imperative, and specific about the change:

```
Add per-project rate limiting to the ingestion endpoint
Fix mobile overflow caused by the API example block
```

## Reporting a bug

Open an issue with what you did, what happened, and what you expected. If it is
visual, a screenshot saves a round trip. If it is a security issue, see
[SECURITY.md](SECURITY.md) instead.
