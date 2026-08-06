import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../services/rbac.js';

/* ═══════════════════════════════════════════════════════════════
   Admin Audit Log — searchable history of every critical action,
   with filters (resource, action, actor) and JSON export.
   ═══════════════════════════════════════════════════════════════ */

export const adminAuditRouter = Router();

adminAuditRouter.use(requirePermission('audit:read'));

const AuditQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  resource: z.string().max(40).optional(),
  action: z.string().max(60).optional(),
  actorId: z.string().uuid().optional(),
  q: z.string().max(120).optional(),
});

adminAuditRouter.get('/audit', validate({ query: AuditQuery }), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof AuditQuery>;
    const skip = (q.page - 1) * q.limit;

    const where: Record<string, unknown> = {};
    if (q.resource) where.resource = q.resource;
    if (q.action) where.action = q.action;
    if (q.actorId) where.actorId = q.actorId;
    if (q.q) where.OR = [{ action: { contains: q.q, mode: 'insensitive' } }, { resource: { contains: q.q, mode: 'insensitive' } }];

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: q.limit,
        include: {
          actor: { select: { id: true, displayName: true, avatarUrl: true } },
          targetUser: { select: { id: true, displayName: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map((a) => ({
          id: a.id,
          action: a.action,
          resource: a.resource,
          resourceId: a.resourceId,
          details: a.details,
          ip: a.ip,
          actor: a.actor,
          actorName: a.actor?.displayName ?? 'system',
          targetUser: a.targetUser,
          createdAt: a.createdAt.toISOString(),
        })),
        total,
        page: q.page,
        limit: q.limit,
        hasMore: skip + items.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Distinct resources/actions for the filter chips.
adminAuditRouter.get('/audit/meta', async (_req, res, next) => {
  try {
    const [resources, actions] = await Promise.all([
      prisma.auditLog.groupBy({ by: ['resource'], _count: { _all: true }, orderBy: { _count: { resource: 'desc' } }, take: 30 }),
      prisma.auditLog.groupBy({ by: ['action'], _count: { _all: true }, orderBy: { _count: { action: 'desc' } }, take: 40 }),
    ]);
    res.json({
      success: true,
      data: {
        resources: resources.map((r) => r.resource),
        actions: actions.map((a) => a.action),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Export recent audit rows as raw JSON (for admins/auditors).
adminAuditRouter.get('/audit/export', async (_req, res, next) => {
  try {
    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2000,
      include: { actor: { select: { displayName: true } } },
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-export.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      count: rows.length,
      rows: rows.map((a) => ({
        id: a.id,
        action: a.action,
        resource: a.resource,
        resourceId: a.resourceId,
        targetUserId: a.targetUserId,
        actorName: a.actor?.displayName ?? 'system',
        details: a.details,
        ip: a.ip,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});
