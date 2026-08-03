import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Unit tests only.
 *
 * The browser-driven checks live in `scripts/smoke.ts` and run against a real
 * server, because that is the only place they mean anything. Keeping the two
 * separate means `npm test` stays fast and needs no browser, which is what CI
 * runs on every push.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'widget/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      // `fileURLToPath` rather than `.pathname`: the latter leaves percent
      // encoding in place, which breaks resolution for any checkout whose path
      // contains a space or a non-ASCII character.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Service modules are marked `server-only`, which throws outside a
      // React Server Components graph. The integration tests call those
      // services directly, so the marker is stubbed out here.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
});
