import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth, requireRole } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { broadcastToAll } from '../lib/realtime.js';
import { broadcastNotification } from '../services/notifications.js';
import { effectiveRoles } from '../services/rbac.js';

export const announcementsRouter = Router();

// ─── Schemas ──────────────────────────────────────────

const IdParams = z.object({ id: z.string().uuid() });

const AnnouncementSchema = z.object({
  title: z.string().min(1).max(140),
  body: z.string().max(2000).optional(),
  variant: z.enum(['info', 'success', 'warning', 'seasonal', 'maintenance']).default('info'),
  audience: z.enum(['all', 'logged_in', 'moderators']).default('all'),
  link: z.string().max(500).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  dismissible: z.boolean().default(true),
  active: z.boolean().default(true),
});

// ─── GET /api/announcements ───────────────────────────
// Active announcements for the current visitor (public; auth optional).
// Respects audience scoping and per-user dismissals.

announcementsRouter.get('/', optionalAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const where = {
      active: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    };

    // Audience filtering
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audienceWhere: Record<string, any> = {};
    if (!req.user) {
      audienceWhere.audience = 'all';
    } else if (req.user.uid) {
      const viewer = await prisma.user.findUnique({
        where: { firebaseUid: req.user.uid },
        select: { id: true, role: true, roles: true },
      });
      if (viewer) {
        // Staff = any held role beyond the default `user` (multi-role aware).
        if (effectiveRoles(viewer).every((r) => r === 'user')) {
          audienceWhere.audience = { in: ['all', 'logged_in'] };
        } else {
          audienceWhere.audience = { in: ['all', 'logged_in', 'moderators'] };
        }
      } else {
        audienceWhere.audience = 'all';
      }
    }

    const announcements = await prisma.announcement.findMany({
      where: { ...where, ...audienceWhere },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, body: true, variant: true, link: true, dismissible: true, createdAt: true },
    });

    // Filter out dismissed ones (if signed in)
    let dismissedIds = new Set<string>();
    if (req.user) {
      const viewer = await prisma.user.findUnique({
        where: { firebaseUid: req.user.uid },
        select: { id: true },
      });
      if (viewer) {
        const dismissals = await prisma.announcementDismissal.findMany({
          where: { userId: viewer.id, announcementId: { in: announcements.map((a) => a.id) } },
          select: { announcementId: true },
        });
        dismissedIds = new Set(dismissals.map((d) => d.announcementId));
      }
    }

    res.json({
      success: true,
      data: announcements
        .filter((a) => !dismissedIds.has(a.id))
        .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/announcements/:id/dismiss ──────────────

announcementsRouter.post('/:id/dismiss', requireAuth, validate({ params: IdParams }), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof IdParams>;
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    const announcement = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
    if (!announcement) throw new NotFoundError('Announcement', id);

    await prisma.announcementDismissal.upsert({
      where: { announcementId_userId: { announcementId: id, userId: user.id } },
      create: { announcementId: id, userId: user.id },
      update: { dismissedAt: new Date() },
    });

    res.json({ success: true, data: { dismissed: true, id } });
  } catch (err) {
    next(err);
  }
});

// ═══ Admin / moderator endpoints ═════════════════════

// ─── GET /api/announcements/manage ────────────────────
// All announcements with dismissal counts + broadcast analytics.

announcementsRouter.get(
  '/manage',
  requireAuth,
  requireRole('moderator', 'admin'),
  validate({ query: z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }) }),
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        prisma.announcement.findMany({
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { _count: { select: { dismissals: true } } },
        }),
        prisma.announcement.count(),
      ]);

      res.json({
        success: true,
        data: {
          items: items.map((a) => ({
            id: a.id,
            title: a.title,
            body: a.body,
            variant: a.variant,
            audience: a.audience,
            link: a.link,
            dismissible: a.dismissible,
            active: a.active,
            startsAt: a.startsAt?.toISOString() || null,
            endsAt: a.endsAt?.toISOString() || null,
            dismissals: a._count.dismissals,
            createdAt: a.createdAt.toISOString(),
          })),
          total,
          page,
          limit,
          hasMore: skip + items.length < total,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /api/announcements ──────────────────────────

announcementsRouter.post('/', requireAuth, requireRole('moderator', 'admin'), validate({ body: AnnouncementSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof AnnouncementSchema>;
    const creator = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });

    const announcement = await prisma.announcement.create({
      data: {
        title: body.title,
        body: body.body || null,
        variant: body.variant,
        audience: body.audience,
        link: body.link || null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        dismissible: body.dismissible,
        active: body.active,
        createdById: creator?.id ?? null,
      },
    });

    // Announcement goes live immediately if active + within window
    const now = Date.now();
    const inWindow = (!announcement.startsAt || announcement.startsAt.getTime() <= now) && (!announcement.endsAt || announcement.endsAt.getTime() >= now);
    if (body.active && inWindow) {
      broadcastToAll({ type: 'announcement:new', data: { id: announcement.id }, at: now });
    }

    res.status(201).json({
      success: true,
      data: { id: announcement.id, title: announcement.title, active: announcement.active },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/announcements/:id ─────────────────────

announcementsRouter.patch('/:id', requireAuth, requireRole('moderator', 'admin'), validate({ params: IdParams, body: AnnouncementSchema.partial() }), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof IdParams>;
    const body = req.body as Partial<z.infer<typeof AnnouncementSchema>>;

    const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Announcement', id);

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.body !== undefined ? { body: body.body || null } : {}),
        ...(body.variant !== undefined ? { variant: body.variant } : {}),
        ...(body.audience !== undefined ? { audience: body.audience } : {}),
        ...(body.link !== undefined ? { link: body.link || null } : {}),
        ...(body.startsAt !== undefined ? { startsAt: body.startsAt ? new Date(body.startsAt) : null } : {}),
        ...(body.endsAt !== undefined ? { endsAt: body.endsAt ? new Date(body.endsAt) : null } : {}),
        ...(body.dismissible !== undefined ? { dismissible: body.dismissible } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
      select: { id: true, title: true, active: true },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/announcements/:id ────────────────────

announcementsRouter.delete('/:id', requireAuth, requireRole('moderator', 'admin'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof IdParams>;
    await prisma.announcement.deleteMany({ where: { id } });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/announcements/:id/notify ───────────────
// Send an in-app notification (with push for high priority) to the
// announcement's audience — the announcement banner stays separate.

announcementsRouter.post('/:id/notify', requireAuth, requireRole('moderator', 'admin'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof IdParams>;
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true, title: true, body: true, link: true, audience: true },
    });
    if (!announcement) throw new NotFoundError('Announcement', id);

    const sent = await broadcastNotification({
      type: 'announcement',
      title: `📣 ${announcement.title}`,
      body: announcement.body || undefined,
      link: announcement.link || '/announcements',
      audience: announcement.audience as 'all' | 'logged_in' | 'moderators',
    });

    res.json({ success: true, data: { sent } });
  } catch (err) {
    next(err);
  }
});
