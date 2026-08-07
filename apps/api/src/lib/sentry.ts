/**
 * Sentry error tracking — env-gated.
 *
 * With SENTRY_DSN set (production), the SDK captures unhandled rejections,
 * uncaught exceptions and unexpected route errors. Without it (local dev),
 * init is skipped entirely and captureException becomes a no-op — the SDK
 * stays in the bundle but never sends anything.
 */
import * as Sentry from '@sentry/node';
import { config } from '../config/index.js';

export const sentryEnabled = Boolean(config.sentry.dsn);

if (sentryEnabled) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.05,
    // Never send request bodies — uploads may contain image payloads.
    beforeSend: (event) => {
      event.request = { url: event.request?.url };
      return event;
    },
  });
  console.log(`📡 Sentry error tracking enabled (${process.env.NODE_ENV || 'development'})`);
}

/** Capture an exception when Sentry is configured — no-op otherwise. */
export function captureException(err: unknown): void {
  if (!sentryEnabled) return;
  Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
}

/** Install process-level handlers so crashes land in Sentry. */
export function installSentryProcessHandlers(): void {
  if (!sentryEnabled) return;
  process.on('unhandledRejection', (reason) => {
    captureException(reason);
  });
  process.on('uncaughtException', (err) => {
    captureException(err);
  });
}

export { Sentry };
