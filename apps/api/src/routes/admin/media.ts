import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { NotFoundError } from '../../lib/errors.js';
import { requirePermission } from '../../services/rbac.js';
import { logAudit } from '../../services/audit.js';

/* ═══════════════════════════════════════════════════════════════
   Admin Media Library — centralized asset manager.
   Covers, banners, icons, illustrations. Register URL-based assets
   (the platform proxies images; uploads can land on any CDN and be
   recorded here for reuse + usage tracking).
   ═══════════════════════════════════════════════════════════════ */

export const adminMediaRouter = Router();

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  type: z.string().max(30).optional(),
  folder: z.string().max(80).optional(),
  search: z.string().max(120).optional(),
});

const IdParams = z.object({ id: z.string().uuid() });

const CreateMediaSchema = z.object({
  url: z.string().url().max(1000),
  type: z.enum(['image', 'banner', 'cover', 'icon', 'video']).default('image'),
  name: z.string().max(200).nullable().optional(),
  size: z.number().int().nonnegative().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string().max(40)).max(30).default([]),
  folder: z.string().max(80).nullable().optional(),
});

const UpdateMediaSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  type: z.enum(['image', 'banner', 'cover', 'icon', 'video']).optional(),
  tags: z.array(z.string().max(40)).max(30).optional(),
  folder: z.string().max(80).nullable().optional(),
});

async function resolveActorId(firebaseUid: string): Promise<string | null> {
  try {
    const u = await prisma.user.findUnique({ where: { firebaseUid }, select: { id: true } });
    return u?.id ?? null;
  } catch {
    return null;
  }
}

adminMediaRouter.get('/media', requirePermission('media:read'), validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof ListQuery>;
    const skip = (q.page - 1) * q.limit;
    const where: Record<string, unknown> = {};
    if (q.type) where.type = q.type;
    if (q.folder) where.folder = q.folder;
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' };

    const [items, total, byType] = await Promise.all([
      prisma.mediaAsset.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: q.limit }),
      prisma.mediaAsset.count({ where }),
      prisma.mediaAsset.groupBy({ by: ['type'], _count: { _all: true } }),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
        total,
        page: q.page,
        limit: q.limit,
        hasMore: skip + items.length < total,
        byType: Object.fromEntries(byType.map((t) => [t.type, t._count._all])),
      },
    });
  } catch (err) {
    next(err);
  }
});

adminMediaRouter.post('/media', requirePermission('media:create'), validate({ body: CreateMediaSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof CreateMediaSchema>;
    const asset = await prisma.mediaAsset.create({
      data: {
        url: body.url,
        type: body.type,
        name: body.name ?? null,
        size: body.size ?? null,
        width: body.width ?? null,
        height: body.height ?? null,
        tags: body.tags,
        folder: body.folder ?? null,
        createdById: await resolveActorId(req.user!.uid),
      },
    });
    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'media.create',
      resource: 'media',
      resourceId: asset.id,
      details: { type: body.type, folder: body.folder ?? null },
      ip: req.ip,
    });
    res.status(201).json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
});

adminMediaRouter.patch('/media/:id', requirePermission('media:update'), validate({ params: IdParams, body: UpdateMediaSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof UpdateMediaSchema>;
    const existing = await prisma.mediaAsset.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('MediaAsset', id);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.type !== undefined) data.type = body.type;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.folder !== undefined) data.folder = body.folder;

    const updated = await prisma.mediaAsset.update({ where: { id }, data: data as never });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

adminMediaRouter.delete('/media/:id', requirePermission('media:delete'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await prisma.mediaAsset.deleteMany({ where: { id } });
    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'media.delete',
      resource: 'media',
      resourceId: id,
      ip: req.ip,
    });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
});
