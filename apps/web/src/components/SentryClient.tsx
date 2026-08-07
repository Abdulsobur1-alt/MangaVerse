'use client';

import { useEffect } from 'react';

/* ═══════════════════════════════════════════════════════════════
   SentryClient — initializes the browser SDK for client-side error
   capture. No-op without NEXT_PUBLIC_SENTRY_DSN (set at build time,
   since the DSN is inlined into the browser bundle by design — it's a
   public value; the SENTRY_AUTH_TOKEN that uploads sourcemaps stays
   server-side only).
   ═══════════════════════════════════════════════════════════════ */

export function SentryClient() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    void import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.init({
          dsn,
          environment: process.env.NODE_ENV || 'development',
          tracesSampleRate: 0.1,
          // Session replays stay off — no personal-data recording by default.
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 0,
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
