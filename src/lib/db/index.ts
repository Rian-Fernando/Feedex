import 'server-only';

import path from 'node:path';
import { mkdirSync } from 'node:fs';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { env, isProduction, requireDatabaseUrl } from '@/config/env';
import * as schema from './schema';

export * as schema from './schema';

/**
 * Feedex speaks one SQL dialect — Postgres — through two drivers:
 *
 *   - `node-postgres` against a real server, used in production and by anyone
 *     who sets `DATABASE_URL`.
 *   - PGlite, Postgres compiled to WebAssembly, persisted to `.data/`. This is
 *     the default for local development so that `npm run dev` works with no
 *     Docker daemon, no service to install, and no connection string.
 *
 * Because both drivers execute the same dialect against the same migrations,
 * queries written against one behave identically on the other. The driver is an
 * implementation detail; every caller consumes the `Database` type below.
 *
 * The two Drizzle client types are structurally identical for the query surface
 * Feedex uses, so the PGlite client is presented as `NodePgDatabase` rather than
 * forcing every call site to narrow a union.
 */
export type Database = NodePgDatabase<typeof schema>;

type DbGlobal = {
  __feedexDb?: Promise<Database>;
};

const globalRef = globalThis as unknown as DbGlobal;

/** Translates the connection string's `sslmode` into a `pg` SSL option. */
function sslConfig(url: string): boolean | { rejectUnauthorized: boolean } {
  if (url.includes('sslmode=disable')) return false;
  if (url.includes('sslmode=no-verify')) return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}

function usingPostgres(): boolean {
  // In production the answer is always yes: `requireDatabaseUrl` throws rather
  // than let the process fall back to an ephemeral embedded database.
  if (isProduction()) {
    requireDatabaseUrl();
    return true;
  }
  return Boolean(env().DATABASE_URL);
}

async function createPostgresClient(): Promise<Database> {
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');

  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    /*
      TLS is verified against Node's trust store by default. Neon, Supabase,
      and Railway all present certificates from public CAs, so disabling
      verification buys nothing and costs the guarantee that the host on the
      other end is the one named in the connection string.

      Two documented escape hatches remain, because self-hosted Postgres
      commonly uses a self-signed certificate:
        - `sslmode=disable`    no TLS at all
        - `sslmode=no-verify`  TLS, but do not check the certificate
    */
    ssl: sslConfig(requireDatabaseUrl()),
  });

  return drizzle(pool, { schema, casing: 'snake_case' });
}

async function createPgliteClient(): Promise<Database> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');

  const dataDir = path.resolve(/* turbopackIgnore: true */ process.cwd(), env().PGLITE_DATA_DIR);

  // PGlite creates its own leaf directory but not the parents, so a first run
  // against the default `.data/feedex` would fail on the missing `.data`.
  mkdirSync(path.dirname(dataDir), { recursive: true });

  const client = new PGlite(dataDir);
  await client.waitReady;

  const db = drizzle(client, { schema, casing: 'snake_case' });

  // Local development is expected to be self-healing: bringing the app up on a
  // fresh checkout should produce a usable database without a separate step.
  await applyMigrations(db as unknown as Database);

  return db as unknown as Database;
}

/**
 * Applies any pending SQL migrations from `drizzle/`.
 *
 * Exported so `scripts/migrate.ts` can run it against production Postgres as a
 * deliberate deploy step.
 */
export async function applyMigrations(db: Database): Promise<void> {
  const migrationsFolder = path.resolve(/* turbopackIgnore: true */ process.cwd(), 'drizzle');

  if (usingPostgres()) {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(db, { migrationsFolder });
    return;
  }

  const { migrate } = await import('drizzle-orm/pglite/migrator');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- driver-specific client type
  await migrate(db as any, { migrationsFolder });
}

/**
 * Returns the process-wide database client, creating it on first use.
 *
 * Cached on `globalThis` so that Next.js hot reloads in development reuse the
 * same PGlite instance instead of opening a second handle to the same data
 * directory.
 */
export function getDb(): Promise<Database> {
  globalRef.__feedexDb ??= usingPostgres() ? createPostgresClient() : createPgliteClient();
  return globalRef.__feedexDb;
}

/** Which driver is backing the current process. Surfaced in the dashboard. */
export function databaseDriver(): 'postgres' | 'pglite' {
  return usingPostgres() ? 'postgres' : 'pglite';
}
