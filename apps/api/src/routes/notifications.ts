import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { loadNotifPrefs, normalizeNotifPrefs, toPublicRow, type NotificationPrefs } from '../services/notifications.js';

export const notificationsRouter = Router();

// All notification routes require authentication
notificationsRouter.use(requireAuth);

// ─── Helpers ──────────────────────────────────────────

async function resolveUser(req: Express.Request) {
  const user = await prisma.user.findUnique({
    where: { firebaseUid: req.user!.uid },
    select: { id: true },
  });
  if (!user) throw new NotFoundError('User');
  return user;
}

// ─── Schemas ──────────────────────────────────────────

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(60).default(20),
  scope: z.enum(['inbox', 'archived']).default('inbox'),
  read: z.enum(['all', 'unread', 'read']).default('all'),
  category: z.string().optional(),
  priority: z.string().optional(),
  q: z.string().max(120).optional(),
});

const IdParams = z.object({ id: z.string().uuid() });

const PrefsPatch = z
  .object({
    new_chapter: z.boolean().optional(),
    reviews: z.boolean().optional(),
    milestones: z.boolean().optional(),
    achievements: z.boolean().optional(),
    community: z.boolean().optional(),
    system: z.boolean().optional(),
    reminders: z.boolean().optional(),
    recommendations: z.boolean().optional(),
    push: z.enum(['all', 'important', 'off']).optional(),
    email: z.enum(['all', 'important', 'off']).optional(),
    digest: z.enum(['off', 'daily', 'weekly', 'monthly']).optional(),
    quietHours: z
      .object({
        enabled: z.boolean().optional(),
        start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      })
      .optional(),
    dndUntil: z.number().int().min(0).optional(),
    announcementVisibility: z.enum(['all', 'important', 'off']).optional(),
  })
  .strict();

// ─── GET /api/notifications ──────────────────────────
// Paginated, filterable, searchable inbox/archive.

notificationsRouter.get('/', validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof ListQuery>;
    const user = await resolveUser(req);
    const skip = (q.page - 1) * q.limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { userId: user.id };
    where.archivedAt = q.scope === 'archived' ? { not: null } : null;
    if (q.read === 'unread') where.read = false;
    if (q.read === 'read') where.read = true;
    if (q.category) where.category = q.category;
    if (q.priority) where.priority = q.priority;
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { body: { contains: q.q, mode: 'insensitive' } },
      ];
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ pinnedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: q.limit,
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: notifications.map(toPublicRow),
        total,
        page: q.page,
        limit: q.limit,
        hasMore: skip + notifications.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/notifications/unread-count ──────────────

notificationsRouter.get('/unread-count', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    const count = await prisma.notification.count({
      where: { userId: user.id, read: false, archivedAt: null },
    });
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/notifications/:id/read ───────────────

notificationsRouter.patch('/:id/read', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params as unknown as z.infer<typeof IdParams>;
    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { read: true },
    });
    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/notifications/read-all ───────────────

notificationsRouter.patch('/read-all', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    res.json({ success: true, data: { message: 'All notifications marked as read' } });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/notifications/:id/pin ────────────────

notificationsRouter.patch('/:id/pin', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params as unknown as z.infer<typeof IdParams>;
    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { pinnedAt: new Date() },
    });
    res.json({ success: true, data: { id, pinned: true } });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/notifications/:id/unpin ──────────────

notificationsRouter.patch('/:id/unpin', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params as unknown as z.infer<typeof IdParams>;
    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { pinnedAt: null },
    });
    res.json({ success: true, data: { id, pinned: false } });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/notifications/:id/archive ─────────────

notificationsRouter.patch('/:id/archive', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params as unknown as z.infer<typeof IdParams>;
    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { archivedAt: new Date() },
    });
    res.json({ success: true, data: { id, archived: true } });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/notifications/:id/restore ─────────────

notificationsRouter.patch('/:id/restore', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params as unknown as z.infer<typeof IdParams>;
    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { archivedAt: null },
    });
    res.json({ success: true, data: { id, archived: false } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/notifications/:id ───────────────────

notificationsRouter.delete('/:id', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    const { id } = req.params as unknown as z.infer<typeof IdParams>;
    await prisma.notification.deleteMany({ where: { id, userId: user.id } });
    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/notifications/prefs ─────────────────────

notificationsRouter.get('/prefs', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    const prefs = await loadNotifPrefs(user.id);
    res.json({ success: true, data: prefs });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/notifications/prefs ───────────────────
// Partial update — merges onto the stored notificationPrefs JSON.

notificationsRouter.patch('/prefs', validate({ body: PrefsPatch }), async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    const patch = req.body as z.infer<typeof PrefsPatch>;
    const current = await loadNotifPrefs(user.id);

    const merged: NotificationPrefs = {
      ...current,
      ...patch,
      quietHours: {
        ...current.quietHours,
        ...(patch.quietHours ?? {}),
      },
    };

    await prisma.user.update({
      where: { id: user.id },
      data: { notificationPrefs: merged as never },
    });

    res.json({ success: true, data: normalizeNotifPrefs(merged) });
  } catch (err) {
    next(err);
  }
});
