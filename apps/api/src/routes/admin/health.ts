import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { redisHealthy } from '../../lib/redis.js';
import { meilisearch } from '../../services/meilisearch.js';
import { requirePermission } from '../../services/rbac.js';

/* ═══════════════════════════════════════════════════════════════
   Admin Health — system component health at a glance.
   ═══════════════════════════════════════════════════════════════ */

export const adminHealthRouter = Router();

adminHealthRouter.use(requirePermission('health:read'));

adminHealthRouter.get('/health', async (_req, res, next) => {
  try {
    const started = Date.now();
    const checks: Record<string, { ok: boolean; latencyMs?: number; detail?: string }> = {};

    // Database
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true, latencyMs: Date.now() - dbStart };
    } catch (err) {
      checks.database = { ok: false, detail: (err as Error).message };
    }

    // Redis (cache layer)
    const redisStart = Date.now();
    try {
      const pong = await redisHealthy();
      checks.redis = pong ? { ok: true, latencyMs: Date.now() - redisStart } : { ok: false, detail: 'ping failed' };
    } catch (err) {
      checks.redis = { ok: false, detail: (err as Error).message };
    }

    // Meilisearch
    const meiliStart = Date.now();
    try {
      const healthy = await meilisearch.isHealthy();
      checks.meilisearch = healthy ? { ok: true, latencyMs: Date.now() - meiliStart } : { ok: false, detail: 'unreachable' };
    } catch (err) {
      checks.meilisearch = { ok: false, detail: (err as Error).message };
    }

    // Realtime hub (WS) — connected clients count
    try {
      const { realtimeConnectedUserCount } = await import('../../lib/realtime.js');
      checks.realtime = { ok: true, detail: `${realtimeConnectedUserCount()} live clients` };
    } catch {
      checks.realtime = { ok: false, detail: 'hub not mounted' };
    }

    res.json({
      success: true,
      data: {
        status: Object.values(checks).every((c) => c.ok) ? 'healthy' : 'degraded',
        uptime: Math.round(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        totalMs: Date.now() - started,
        checks,
      },
    });
  } catch (err) {
    next(err);
  }
});
