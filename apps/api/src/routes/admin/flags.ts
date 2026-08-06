import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { NotFoundError } from '../../lib/errors.js';
import { requirePermission } from '../../services/rbac.js';
import { logAudit } from '../../services/audit.js';

/* ═══════════════════════════════════════════════════════════════
   Admin Feature Flags — kill switches, beta features and seasonal
   experiments with rollout percentages and per-user overrides.
   ═══════════════════════════════════════════════════════════════ */

export const adminFlagsRouter = Router();

adminFlagsRouter.use(requirePermission('flags:read'));

const FlagSchema = z.object({
  key: z.string().min(2).max(80).regex(/^[a-z0-9_.-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  enabled: z.boolean().default(false),
  rolloutPct: z.number().int().min(0).max(100).default(100),
  environments: z.array(z.string().max(30)).max(20).default([]),
});

const IdParams = z.object({ id: z.string().uuid() });

const OverrideSchema = z.object({
  userId: z.string().uuid(),
  enabled: z.boolean(),
});

const OverrideDeleteParams = z.object({ id: z.string().uuid(), userId: z.string().uuid() });

async function resolveActorId(firebaseUid: string): Promise<string | null> {
  try {
    const u = await prisma.user.findUnique({ where: { firebaseUid }, select: { id: true } });
    return u?.id ?? null;
  } catch {
    return null;
  }
}

adminFlagsRouter.get('/flags', async (_req, res, next) => {
  try {
    const flags = await prisma.featureFlag.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { overrides: true } } },
    });
    res.json({
      success: true,
      data: flags.map((f) => ({
        id: f.id,
        key: f.key,
        name: f.name,
        description: f.description,
        enabled: f.enabled,
        rolloutPct: f.rolloutPct,
        environments: f.environments,
        overrideCount: f._count.overrides,
        updatedAt: f.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminFlagsRouter.get('/flags/:id', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const flag = await prisma.featureFlag.findUnique({
      where: { id },
      include: {
        overrides: {
          take: 50,
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });
    if (!flag) throw new NotFoundError('FeatureFlag', id);
    res.json({ success: true, data: flag });
  } catch (err) {
    next(err);
  }
});

adminFlagsRouter.post('/flags', requirePermission('flags:manage'), validate({ body: FlagSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof FlagSchema>;
    const flag = await prisma.featureFlag.create({
      data: {
        key: body.key,
        name: body.name,
        description: body.description ?? null,
        enabled: body.enabled,
        rolloutPct: body.rolloutPct,
        environments: body.environments,
        updatedById: await resolveActorId(req.user!.uid),
      },
    });
    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'flag.create',
      resource: 'feature_flag',
      resourceId: flag.id,
      details: { key: body.key, enabled: body.enabled },
      ip: req.ip,
    });
    res.status(201).json({ success: true, data: flag });
  } catch (err) {
    next(err);
  }
});

adminFlagsRouter.patch('/flags/:id', requirePermission('flags:manage'), validate({ params: IdParams, body: FlagSchema.partial() }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as Partial<z.infer<typeof FlagSchema>>;
    const existing = await prisma.featureFlag.findUnique({ where: { id }, select: { id: true, key: true, enabled: true } });
    if (!existing) throw new NotFoundError('FeatureFlag', id);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.rolloutPct !== undefined) data.rolloutPct = body.rolloutPct;
    if (body.environments !== undefined) data.environments = body.environments;
    data.updatedById = await resolveActorId(req.user!.uid);

    const updated = await prisma.featureFlag.update({ where: { id }, data: data as never });
    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'flag.toggle',
      resource: 'feature_flag',
      resourceId: id,
      details: { key: existing.key, enabled: body.enabled ?? existing.enabled },
      ip: req.ip,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

adminFlagsRouter.delete('/flags/:id', requirePermission('flags:manage'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await prisma.featureFlag.deleteMany({ where: { id } });
    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'flag.delete',
      resource: 'feature_flag',
      resourceId: id,
      ip: req.ip,
    });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
});

// ─── Per-user overrides ────────────────────────────────

adminFlagsRouter.post('/flags/:id/override', requirePermission('flags:manage'), validate({ params: IdParams, body: OverrideSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof OverrideSchema>;
    const override = await prisma.featureFlagOverride.upsert({
      where: { flagId_userId: { flagId: id, userId: body.userId } },
      create: { flagId: id, userId: body.userId, enabled: body.enabled },
      update: { enabled: body.enabled },
    });
    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'flag.override',
      resource: 'feature_flag',
      resourceId: id,
      targetUserId: body.userId,
      details: { enabled: body.enabled },
      ip: req.ip,
    });
    res.json({ success: true, data: override });
  } catch (err) {
    next(err);
  }
});

adminFlagsRouter.delete('/flags/:id/override/:userId', requirePermission('flags:manage'), validate({ params: OverrideDeleteParams }), async (req, res, next) => {
  try {
    const { id, userId } = req.params as unknown as z.infer<typeof OverrideDeleteParams>;
    await prisma.featureFlagOverride.deleteMany({ where: { flagId: id, userId } });
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
