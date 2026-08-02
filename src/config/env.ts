import { z } from 'zod';

/**
 * Server-side environment contract.
 *
 * Parsed lazily so that importing this module never throws during a client
 * bundle pass, and so that build-time steps that do not touch the database
 * (for example `next build` rendering static marketing pages) do not require a
 * fully populated environment.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * Postgres connection string. When omitted, Feedex falls back to an embedded
   * PGlite database stored under `.data/`, which makes `npm run dev` work with
   * zero external services. Production must set a real connection string.
   */
  DATABASE_URL: z.string().min(1).optional(),

  /**
   * Directory used by the embedded PGlite database in local development.
   */
  PGLITE_DATA_DIR: z.string().min(1).default('.data/feedex'),

  /**
   * 32+ byte secret used to derive HMACs for API key lookups and to sign
   * non-session tokens. Required in production.
   */
  AUTH_SECRET: z.string().min(32).optional(),

  /**
   * Canonical origin, used for absolute URLs, cookies, and the widget snippet.
   */
  APP_URL: z.string().url().default('http://localhost:3000'),

  /**
   * OAuth provider credentials. All optional: a provider without both values
   * is simply absent from the sign-in page, so an instance can run with
   * passwords only, with one provider, or with both.
   */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),

  /**
   * When `true`, the /register route is disabled. Useful once the workspace
   * owner has signed up and the instance should stop accepting new accounts.
   */
  DISABLE_SIGNUP: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/**
 * True while `next build` is running.
 *
 * The production requirements below must not apply during the build: a build
 * machine legitimately has no database credentials, and prerendering a static
 * page should never depend on them. They are enforced at runtime instead, which
 * is where a missing value actually matters.
 */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

function parse(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  // Shape only. Production requirements are enforced where the value is
  // actually used — see `requireDatabaseUrl` and `authSecret` — so that a page
  // which never touches the database still renders on a half-configured
  // instance instead of returning an opaque 500.
  return parsed.data;
}

export function env(): ServerEnv {
  cached ??= parse();
  return cached;
}

/**
 * Development fallback secret. Deterministic so that sessions and API keys
 * survive a dev-server restart. Never reachable in production, because
 * `authSecret()` throws there instead of falling back.
 */
const DEV_SECRET = 'feedex-development-secret-do-not-use-in-production-0000';

/** Raised when a required production value is absent. */
export class ConfigurationError extends Error {
  readonly variable: string;

  constructor(variable: string, guidance: string) {
    super(`${variable} is not set. ${guidance}`);
    this.name = 'ConfigurationError';
    this.variable = variable;
  }
}

/**
 * The connection string, or a precise error explaining what to set.
 *
 * Deliberately never falls back to the embedded database in production. A
 * serverless filesystem is ephemeral and per-instance, so falling back would
 * silently accept writes and then lose them — far worse than refusing to start.
 */
export function requireDatabaseUrl(): string {
  const value = env().DATABASE_URL;

  if (!value) {
    throw new ConfigurationError(
      'DATABASE_URL',
      'Feedex needs a PostgreSQL connection string in production. Provision a database ' +
        '(Neon, Supabase, or any Postgres 14+) and set DATABASE_URL, then run `npm run db:migrate`. ' +
        'See docs/DEPLOYMENT.md.',
    );
  }

  return value;
}

export function authSecret(): string {
  const value = env().AUTH_SECRET;
  if (value) return value;

  if (isProduction() && !isBuildPhase()) {
    throw new ConfigurationError(
      'AUTH_SECRET',
      'Generate one with `openssl rand -base64 48` and set it in your environment. ' +
        'It keys the HMAC used for secret API keys, so it must stay stable once set.',
    );
  }

  return DEV_SECRET;
}

export function isProduction(): boolean {
  return env().NODE_ENV === 'production';
}
