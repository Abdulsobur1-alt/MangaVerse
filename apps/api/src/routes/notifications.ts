import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';

export const notificationsRouter = Router();

// All notification routes require authentication
notificationsRouter.use(requireAuth);

// ─── GET /api/notifications ──────────────────────────
// Returns paginated notifications for the current user

notificationsRouter.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId: user.id } }),
    ]);

    res.json({
      success: true,
      data: {
        items: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          imageUrl: n.imageUrl,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        })),
        total,
        page,
        limit,
        hasMore: skip + notifications.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/notifications/unread-count ──────────────
// Returns the count of unread notifications

notificationsRouter.get('/unread-count', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    const count = await prisma.notification.count({
      where: { userId: user.id, read: false },
    });

    res.json({
      success: true,
      data: { count },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/notifications/:id/read ───────────────

notificationsRouter.patch('/:id/read', async (req, res, next) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!notification) throw new NotFoundError('Notification', id);
    if (notification.userId !== user.id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your notification' } });
    }

    await prisma.notification.update({
      where: { id },
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
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });

    res.json({ success: true, data: { message: 'All notifications marked as read' } });
  } catch (err) {
    next(err);
  }
});

// ─── Delete /api/notifications/:id ───────────────────

notificationsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!notification) throw new NotFoundError('Notification', id);
    if (notification.userId !== user.id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your notification' } });
    }

    await prisma.notification.delete({ where: { id } });

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});
