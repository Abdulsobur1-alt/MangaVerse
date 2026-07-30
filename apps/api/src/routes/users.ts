import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';

export const usersRouter = Router();

// All user routes require authentication
usersRouter.use(requireAuth);

// ─── GET /api/users/profile ───────────────────────────

usersRouter.get('/profile', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      include: {
        _count: {
          select: {
            bookmarks: true,
            reviews: true,
            readingProgress: true,
            achievements: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundError('User');

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        coinBalance: user.coinBalance,
        subscriptionTier: user.subscriptionTier,
        streakDays: user.streakDays,
        stats: user._count,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/users/stats ─────────────────────────────

usersRouter.get('/stats', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      include: {
        _count: {
          select: {
            bookmarks: true,
            reviews: true,
            readingProgress: { where: { completed: true } },
            achievements: true,
            coinTransactions: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundError('User');

    // Get streak calendar (last 28 days)
    const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const readingDays = await prisma.readingProgress.findMany({
      where: {
        userId: user.id,
        updatedAt: { gte: twentyEightDaysAgo },
      },
      select: { updatedAt: true },
      distinct: ['updatedAt'],
    });

    const readingDates = new Set(
      readingDays.map((d: { updatedAt: Date }) => d.updatedAt.toISOString().split('T')[0]),
    );

    res.json({
      success: true,
      data: {
        chaptersRead: user._count.readingProgress,
        totalBookmarks: user._count.bookmarks,
        totalReviews: user._count.reviews,
        totalAchievements: user._count.achievements,
        totalTransactions: user._count.coinTransactions,
        streakDays: user.streakDays,
        readingCalendar: Array.from({ length: 28 }, (_, i) => {
          const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          return { date: dateStr, read: readingDates.has(dateStr) };
        }),
      },
    });
  } catch (err) {
    next(err);
  }
});
