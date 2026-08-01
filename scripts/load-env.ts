import path from 'node:path';

/**
 * Loads `.env.local` then `.env` for standalone scripts.
 *
 * Next.js does this itself for the application; scripts run outside that, so
 * they need their own step. Uses Node's built-in `process.loadEnvFile` rather
 * than dotenv — the capability has been in the runtime since 20.12, and a
 * dependency for reading a key/value file is not worth carrying.
 *
 * Missing files are not an error: local development is expected to run with no
 * env file at all.
 */
export function loadEnv(): void {
  // `.env.local` first: values already in `process.env` win, so the earlier
  // file takes precedence, which matches Next's own ordering.
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(path.resolve(process.cwd(), file));
    } catch {
      // Absent or unreadable — nothing to load.
    }
  }
}
