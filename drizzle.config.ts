import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit only generates SQL here; the runtime driver is selected in
 * `src/lib/db/index.ts`. Generation always targets Postgres so that the emitted
 * migrations are valid for both the embedded PGlite database and a real server.
 */
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/feedex',
  },
  verbose: true,
  strict: true,
});
