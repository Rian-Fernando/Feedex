import { loadEnv } from './load-env';

loadEnv();

/**
 * Applies pending migrations.
 *
 * Runs as part of `npm run build`, which is what Vercel executes on every
 * deploy. Migrating from the build rather than by hand is the difference
 * between a schema change being live and a schema change being live *if
 * somebody remembers*: shipping code that reads a table the database does not
 * have yet breaks the page that reads it, and the gap lasts until a human
 * notices.
 *
 * Local development migrates itself on first database access, so this is a
 * no-op there beyond a line of output.
 */

/**
 * Prefers a direct connection over a pooled one.
 *
 * Poolers run in transaction mode, where session-level advisory locks — which
 * is how the migrator keeps two concurrent deploys from racing — are not
 * reliably held for the life of the migration. Neon and Supabase both publish
 * an unpooled URL for exactly this; when one is present, it is the correct
 * endpoint to migrate through.
 */
function preferDirectConnection(): void {
  const direct = process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL_NON_POOLING;

  if (direct && direct !== process.env.DATABASE_URL) {
    process.env.DATABASE_URL = direct;
    console.log('[migrate] using the direct (unpooled) connection');
  }
}

async function main(): Promise<void> {
  preferDirectConnection();

  const { applyMigrations, getDb, databaseDriver } = await import('../src/lib/db');

  console.log(`[migrate] driver: ${databaseDriver()}`);

  const db = await getDb();
  await applyMigrations(db);

  console.log('[migrate] up to date');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[migrate] failed');
    console.error(error);
    process.exit(1);
  });
