import { loadEnv } from './load-env';

loadEnv();
import { rm } from 'node:fs/promises';
import path from 'node:path';

/**
 * Destroys the local development database.
 *
 * Deliberately refuses to touch a real Postgres server: this is a convenience
 * for wiping the embedded PGlite data directory during development, and
 * silently dropping production tables is not a mistake worth making possible.
 */
async function main(): Promise<void> {
  if (process.env.DATABASE_URL) {
    console.error('[reset] DATABASE_URL is set — refusing to reset a external database.');
    console.error('[reset] Drop and recreate it yourself, then run `npm run db:migrate`.');
    process.exit(1);
  }

  const dataDir = path.resolve(process.cwd(), process.env.PGLITE_DATA_DIR ?? '.data/feedex');
  await rm(dataDir, { recursive: true, force: true });

  console.log(`[reset] removed ${path.relative(process.cwd(), dataDir)}`);
  console.log('[reset] the schema is recreated the next time the app starts');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
