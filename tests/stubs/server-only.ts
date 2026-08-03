/**
 * Stub for the `server-only` marker package.
 *
 * That package deliberately throws unless it is resolved under the
 * `react-server` condition, which is what stops server modules being pulled
 * into a client bundle. Vitest runs plain Node, so the integration tests alias
 * it here to keep the guarantee in the app while still being able to exercise
 * the service layer directly.
 */
export {};
