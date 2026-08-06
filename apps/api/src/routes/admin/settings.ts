import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../services/rbac.js';
import { logAudit } from '../../services/audit.js';

/* ═══════════════════════════════════════════════════════════════
   Admin Platform Settings — branding, homepage, SEO, integrations,
   and maintenance mode. Key/value store; every write is audited.
   Maintenance mode is honored globally by the API gateway (index.ts)
   within 30s of the toggle.
   ═══════════════════════════════════════════════════════════════ */

export const adminSettingsRouter = Router();

adminSettingsRouter.use(requirePermission('settings:read'));

const KeyParams = z.object({ key: z.string().min(1).max(80) });

const UpdateSettingSchema = z.object({
  value: z.unknown(),
});

const MaintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(500).nullable().optional(),
});

async function resolveActorId(firebaseUid: string): Promise<string | null> {
  try {
    const u = await prisma.user.findUnique({ where: { firebaseUid }, select: { id: true } });
    return u?.id ?? null;
  } catch {
    return null;
  }
}

adminSettingsRouter.get('/settings', async (_req, res, next) => {
  try {
    const rows = await prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
    res.json({
      success: true,
      data: rows.map((r) => ({ key: r.key, value: r.value, updatedAt: r.updatedAt.toISOString() })),
    });
  } catch (err) {
    next(err);
  }
});

adminSettingsRouter.patch('/settings/:key', requirePermission('settings:update'), validate({ params: KeyParams, body: UpdateSettingSchema }), async (req, res, next) => {
  try {
    const { key } = req.params as unknown as z.infer<typeof KeyParams>;
    const body = req.body as z.infer<typeof UpdateSettingSchema>;

    const setting = await prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: body.value as never, updatedById: await resolveActorId(req.user!.uid) },
      update: { value: body.value as never, updatedById: await resolveActorId(req.user!.uid) },
    });

    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'settings.update',
      resource: 'platform_setting',
      resourceId: key,
      details: { key },
      ip: req.ip,
    });

    res.json({ success: true, data: { key, value: setting.value, updatedAt: setting.updatedAt.toISOString() } });
  } catch (err) {
    next(err);
  }
});

adminSettingsRouter.delete('/settings/:key', requirePermission('settings:update'), validate({ params: KeyParams }), async (req, res, next) => {
  try {
    const { key } = req.params as unknown as z.infer<typeof KeyParams>;
    await prisma.platformSetting.deleteMany({ where: { key } });
    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'settings.delete',
      resource: 'platform_setting',
      resourceId: key,
      ip: req.ip,
    });
    res.json({ success: true, data: { deleted: true, key } });
  } catch (err) {
    next(err);
  }
});

// ─── Maintenance mode ──────────────────────────────────

adminSettingsRouter.get('/settings/maintenance', async (_req, res, next) => {
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key: 'maintenance' } });
    const value = (row?.value ?? {}) as { enabled?: boolean; message?: string | null };
    res.json({
      success: true,
      data: { enabled: value.enabled === true, message: value.message ?? null },
    });
  } catch (err) {
    next(err);
  }
});

adminSettingsRouter.post('/settings/maintenance', requirePermission('settings:update'), validate({ body: MaintenanceSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof MaintenanceSchema>;
    await prisma.platformSetting.upsert({
      where: { key: 'maintenance' },
      create: { key: 'maintenance', value: { enabled: body.enabled, message: body.message ?? null } as never, updatedById: await resolveActorId(req.user!.uid) },
      update: { value: { enabled: body.enabled, message: body.message ?? null } as never, updatedById: await resolveActorId(req.user!.uid) },
    });
    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'settings.maintenance',
      resource: 'platform_setting',
      resourceId: 'maintenance',
      details: { enabled: body.enabled, message: body.message ?? null },
      ip: req.ip,
    });
    res.json({ success: true, data: { enabled: body.enabled, message: body.message ?? null } });
  } catch (err) {
    next(err);
  }
});
