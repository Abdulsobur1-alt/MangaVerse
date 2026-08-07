import { Router } from 'express';
import { supabaseConfigured } from '../lib/supabase.js';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

// How long to wait for the DB probe before declaring it down. A broken
// DATABASE_URL (e.g. the IPv6-only direct host instead of the session
// pooler) can hang a TCP connect for a long time — the probe must never
// stall the health check itself, or Render would mark the service
// unhealthy/restarting instead of surfacing the real problem.
const DB_PROBE_TIMEOUT_MS = 5_000;

healthRouter.get('/', async (_req, res) => {
  let database: 'up' | 'down' = 'down';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('DB probe timed out')), DB_PROBE_TIMEOUT_MS);
      }),
    ]);
    database = 'up';
  } catch {
    // Unreachable/misconfigured DATABASE_URL → every data route 500s. The
    // response stays 200 (Render's health check must keep passing) but the
    // payload makes the failure obvious: `"database": "down"`.
    database = 'down';
  } finally {
    // Stop the timer once the race settles (whether the query won or the
    // timeout fired) so no stray timer lingers between health polls.
    if (timer) clearTimeout(timer);
  }

  res.json({
    success: true,
    data: {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      // Database visibility — lets a deployer confirm the API can reach
      // Postgres from a single curl. 'down' means every data route 500s
      // (check DATABASE_URL: use the Supabase Session pooler URI, not the
      // IPv6-only direct host).
      database,
      // Auth visibility — lets a deployer confirm whether real Supabase
      // auth is live from a single curl (no logs digging). provider is
      // 'supabase' | 'dev' | 'none'.
      auth: {
        provider: supabaseConfigured() ? 'supabase' : config.devAuth ? 'dev' : 'none',
        supabaseConfigured: supabaseConfigured(),
      },
    },
  });
});
