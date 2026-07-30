import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { checkAndNotifyMilestone } from '../services/notifications.js';

export const readingRouter = Router();

readingRouter.use(requireAuth);

// ─── Schemas ──────────────────────────────────────────

const SaveProgressSchema = z.object({
  chapterId: z.string().uuid(),
  pageNumber: z.number().int().nonnegative().default(0),
  completed: z.boolean().default(false),
});

// ─── GET /api/reading/progress ────────────────────────

readingRouter.get('/progress', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
    });
    if (!user) throw new NotFoundError('User');

    const progress = await prisma.readingProgress.findMany({
      where: { userId: user.id },
      include: {
        chapter: {
          include: {
            series: {
              select: { slug: true, title: true, coverUrl: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: progress });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/reading/progress ───────────────────────

readingRouter.post('/progress', validate({ body: SaveProgressSchema }), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
    });
    if (!user) throw new NotFoundError('User');

    const { chapterId, pageNumber, completed } = req.body;

    // Upsert progress
    const progress = await prisma.readingProgress.upsert({
      where: {
        userId_chapterId: { userId: user.id, chapterId },
      },
      update: { pageNumber, completed, updatedAt: new Date() },
      create: { userId: user.id, chapterId, pageNumber, completed },
    });

    // If chapter completed, update streak and check milestones
    if (completed) {
      await prisma.user.update({
        where: { id: user.id },
        data: { streakDays: { increment: 1 } },
      });

      // Fire-and-forget milestone check
      checkAndNotifyMilestone(user.id);
    }

    res.json({ success: true, data: progress });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reading/history ─────────────────────────

readingRouter.get('/history', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
    });
    if (!user) throw new NotFoundError('User');

    const history = await prisma.readingProgress.findMany({
      where: { userId: user.id },
      include: {
        chapter: {
          include: {
            series: {
              select: { slug: true, title: true, coverUrl: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});
