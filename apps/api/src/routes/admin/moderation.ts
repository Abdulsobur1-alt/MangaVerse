import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';
import { requirePermission } from '../../services/rbac.js';
import { logAudit } from '../../services/audit.js';
import { createSystemNotification } from '../../services/notifications.js';

/* ═══════════════════════════════════════════════════════════════
   Admin Moderation — the warn → mute → suspend → ban ladder.
   Every action creates a UserWarning record (auditable history) and
   an AuditLog row; suspend/ban additionally gate the target's auth
   middleware until lifted.
   ═══════════════════════════════════════════════════════════════ */

export const adminModerationRouter = Router();

adminModerationRouter.use(requirePermission('moderation:read', 'users:read'));

const IdParams = z.object({ id: z.string().uuid() });

const UserQuery = z.object({
  userId: z.string().uuid(),
});

const WarnSchema = z.object({
  severity: z.enum(['notice', 'warning', 'mute', 'suspend', 'ban']),
  reason: z.string().min(1).max(500),
  durationHours: z.number().int().positive().max(8760).nullable().optional(),
});

const BanSchema = z.object({
  reason: z.string().min(1).max(500),
});

const SuspendSchema = z.object({
  hours: z.number().int().positive().max(8760),
  reason: z.string().min(1).max(500),
});

async function resolveActorId(firebaseUid: string): Promise<string | null> {
  try {
    const u = await prisma.user.findUnique({ where: { firebaseUid }, select: { id: true } });
    return u?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Active warnings for a user ────────────────────────

adminModerationRouter.get('/warnings', validate({ query: UserQuery }), async (req, res, next) => {
  try {
    const { userId } = req.query as unknown as z.infer<typeof UserQuery>;
    const warnings = await prisma.userWarning.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: { displayName: true } } },
    });
    res.json({
      success: true,
      data: warnings.map((w) => ({
        id: w.id,
        severity: w.severity,
        reason: w.reason,
        durationHours: w.durationHours,
        active: w.active,
        actorName: w.actor?.displayName ?? 'system',
        createdAt: w.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── Warn / mute / suspend / ban ───────────────────────

adminModerationRouter.post('/users/:id/warn', requirePermission('moderation:act'), validate({ params: IdParams, body: WarnSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof WarnSchema>;
    const acting = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    const actorId = acting?.id ?? null;

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new NotFoundError('User', id);
    if (target.role === 'admin' || target.role === 'super_admin') {
      throw new ForbiddenError('Admins cannot be warned');
    }

    // Severity ladder: mute → suspend → ban escalate the stored state.
    const updates: Record<string, unknown> = {};
    if (body.severity === 'suspend') {
      updates.suspendedUntil = new Date(Date.now() + (body.durationHours ?? 24) * 3_600_000);
    } else if (body.severity === 'ban') {
      updates.bannedAt = new Date();
      updates.suspendedUntil = null;
    }

    await prisma.userWarning.create({
      data: {
        userId: id,
        actorId,
        reason: body.reason,
        severity: body.severity,
        durationHours: body.durationHours ?? null,
      },
    });

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { id }, data: updates as never });
    }

    await logAudit({
      actorId,
      action: 'user.warn',
      resource: 'user',
      resourceId: id,
      targetUserId: id,
      details: { severity: body.severity, reason: body.reason, durationHours: body.durationHours ?? null },
      ip: req.ip,
    });

    res.json({ success: true, data: { severity: body.severity, applied: Object.keys(updates) } });
  } catch (err) {
    next(err);
  }
});

adminModerationRouter.post('/users/:id/suspend', requirePermission('moderation:act'), validate({ params: IdParams, body: SuspendSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof SuspendSchema>;
    const actorId = await resolveActorId(req.user!.uid);

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new NotFoundError('User', id);
    if (target.role === 'admin' || target.role === 'super_admin') {
      throw new ForbiddenError('Admins cannot be suspended');
    }

    const until = new Date(Date.now() + body.hours * 3_600_000);
    await prisma.user.update({ where: { id }, data: { suspendedUntil: until } });
    await prisma.userWarning.create({
      data: { userId: id, actorId, reason: body.reason, severity: 'suspend', durationHours: body.hours },
    });

    await logAudit({
      actorId,
      action: 'user.suspend',
      resource: 'user',
      resourceId: id,
      targetUserId: id,
      details: { hours: body.hours, until: until.toISOString(), reason: body.reason },
      ip: req.ip,
    });
    void createSystemNotification([id], '⏸️ Account temporarily suspended', `Your account is suspended for ${body.hours}h. ${body.reason}`).catch(() => {});

    res.json({ success: true, data: { suspended: true, until: until.toISOString() } });
  } catch (err) {
    next(err);
  }
});

adminModerationRouter.post('/users/:id/ban', requirePermission('moderation:act'), validate({ params: IdParams, body: BanSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof BanSchema>;
    const actorId = await resolveActorId(req.user!.uid);

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new NotFoundError('User', id);
    if (target.role === 'admin' || target.role === 'super_admin') {
      throw new ForbiddenError('Admins cannot be banned');
    }

    await prisma.user.update({ where: { id }, data: { bannedAt: new Date(), suspendedUntil: null } });
    await prisma.userWarning.create({
      data: { userId: id, actorId, reason: body.reason, severity: 'ban' },
    });

    await logAudit({
      actorId,
      action: 'user.ban',
      resource: 'user',
      resourceId: id,
      targetUserId: id,
      details: { reason: body.reason },
      ip: req.ip,
    });
    void createSystemNotification([id], '🚫 Account banned', body.reason).catch(() => {});

    res.json({ success: true, data: { banned: true } });
  } catch (err) {
    next(err);
  }
});

adminModerationRouter.post('/users/:id/unban', requirePermission('moderation:act'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const actorId = await resolveActorId(req.user!.uid);

    await prisma.user.update({ where: { id }, data: { bannedAt: null, suspendedUntil: null } });
    await prisma.userWarning.updateMany({
      where: { userId: id, active: true },
      data: { active: false },
    });

    await logAudit({
      actorId,
      action: 'user.unban',
      resource: 'user',
      resourceId: id,
      targetUserId: id,
      ip: req.ip,
    });

    res.json({ success: true, data: { unbanned: true } });
  } catch (err) {
    next(err);
  }
});
