/**
 * Sentry instrumentation — Next.js server runtime (Node).
 *
 * Runs once when the server starts. No-op without SENTRY_DSN so local dev
 * and environments without the key stay SDK-free (the dynamic import below
 * also keeps the SDK out of the edge runtime bundle).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.05,
    });
  } catch {
    // SDK failure must never take down the server.
  }
}
