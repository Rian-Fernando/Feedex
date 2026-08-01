import { loadEnv } from './load-env';

loadEnv();

/**
 * Applies pending migrations.
 *
 * Local development does this automatically on first database access, so this
 * script exists mainly as a deliberate deploy step against real Postgres —
 * where migrations should run once, before the new build starts serving, rather
 * than implicitly on a request.
 */
async function main(): Promise<void> {
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
