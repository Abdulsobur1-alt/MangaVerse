import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { checkAndNotifyMilestone } from '../services/notifications.js';
import { earnCoins, COIN_CHAPTER_REWARD } from '../services/coins.js';
import { checkAndAwardAchievements } from '../services/achievements.js';
import { checkAndRecordMilestones } from '../services/journey.js';
import { chapterMinutes, invalidateAnalytics } from '../services/analytics.js';

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
              // id + type are load-bearing: the web Continue Reading rail
              // keys list items by series.id and renders type-aware covers.
              select: { id: true, slug: true, title: true, coverUrl: true, type: true },
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

    // Fetch existing progress to detect first-time completion (for coin rewards)
    const existing = await prisma.readingProgress.findUnique({
      where: {
        userId_chapterId: { userId: user.id, chapterId },
      },
      select: { completed: true },
    });

    // Upsert progress
    const progress = await prisma.readingProgress.upsert({
      where: {
        userId_chapterId: { userId: user.id, chapterId },
      },
      update: { pageNumber, completed, updatedAt: new Date() },
      create: { userId: user.id, chapterId, pageNumber, completed },
    });

    // If chapter newly completed, update streak, award coins, check milestones
    const newlyCompleted = completed && !existing?.completed;
    if (newlyCompleted) {
      // Streak counts one increment per distinct UTC day — reading 10 chapters
      // in a single day must not inflate it. Skip the increment if the user
      // already completed a (different) chapter today.
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const completedToday = await prisma.readingProgress.findFirst({
        where: {
          userId: user.id,
          completed: true,
          chapterId: { not: chapterId },
          updatedAt: { gte: todayStart },
        },
        select: { id: true },
      });
      if (!completedToday) {
        await prisma.user.update({
          where: { id: user.id },
          data: { streakDays: { increment: 1 } },
        });
      }

      // Award coins for completing a chapter (fire-and-forget)
      earnCoins(user.id, COIN_CHAPTER_REWARD, 'reward', chapterId, 'Completed a chapter').catch(() => {});

      // Fire-and-forget milestone + achievement checks
      checkAndNotifyMilestone(user.id);
      checkAndAwardAchievements(user.id).catch(() => {});
      checkAndRecordMilestones(user.id).catch(() => {});
      // Drop the cached analytics so the dashboard reflects the new chapter.
      invalidateAnalytics(user.id);

      // Accrue estimated reading minutes for the completed chapter
      // (Phase 9) — image chapters ≈ 0.75 min/page, prose by word count.
      prisma.chapter
        .findUnique({ where: { id: chapterId }, select: { pageCount: true, contentText: true } })
        .then((ch) => {
          if (!ch) return;
          const minutes = chapterMinutes(ch.pageCount, ch.contentText);
          return prisma.user.update({
            where: { id: user.id },
            data: { totalReadingMinutes: { increment: minutes }, lastActiveAt: new Date() },
          });
        })
        .catch(() => {});
    }

    // Touch activity even on partial progress saves.
    prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).catch(() => {});

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

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      prisma.readingProgress.findMany({
        where: { userId: user.id },
        include: {
          chapter: {
            include: {
              series: {
                select: { id: true, slug: true, title: true, coverUrl: true, type: true },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.readingProgress.count({ where: { userId: user.id } }),
    ]);

    res.json({
      success: true,
      data: {
        items: history.map((h) => ({
          id: h.id,
          pageNumber: h.pageNumber,
          completed: h.completed,
          chapter: h.chapter,
          updatedAt: h.updatedAt.toISOString(),
        })),
        total,
        page,
        limit,
        hasMore: skip + history.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reading/stats ───────────────────────────

readingRouter.get('/stats', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true, streakDays: true },
    });
    if (!user) throw new NotFoundError('User');

    // Total completed chapters
    const totalChapters = await prisma.readingProgress.count({
      where: { userId: user.id, completed: true },
    });

    // Total distinct series read (at least 1 chapter)
    const seriesWithProgress = await prisma.readingProgress.findMany({
      where: { userId: user.id, completed: true },
      select: { chapter: { select: { titleId: true } } },
      distinct: ['chapterId'],
    });

    // Get unique title IDs from chapters
    const titleIds = [...new Set(seriesWithProgress.map((s) => s.chapter.titleId))];
    const totalSeries = titleIds.length;

    // Per-title stats (top 10 by chapters read)
    const titleChaptersMap = new Map<string, number>();
    for (const s of seriesWithProgress) {
      const tid = s.chapter.titleId;
      titleChaptersMap.set(tid, (titleChaptersMap.get(tid) || 0) + 1);
    }

    const sortedTitles = [...titleChaptersMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const titleDetails = await prisma.title.findMany({
      where: { id: { in: sortedTitles.map((t) => t[0]) } },
      select: { id: true, slug: true, title: true, type: true, coverUrl: true, genres: true, author: true },
    });

    const titleDetailMap = new Map(titleDetails.map((t) => [t.id, t]));

    const perTitleStats = sortedTitles.map(([tid, count]) => {
      const detail = titleDetailMap.get(tid);
      return {
        titleId: tid,
        title: detail?.title || 'Unknown',
        slug: detail?.slug || '',
        type: detail?.type || '',
        coverUrl: detail?.coverUrl || null,
        author: detail?.author ?? null,
        chaptersRead: count,
      };
    });

    // Genre distribution
    const genreCounts = new Map<string, number>();
    for (const tid of titleIds) {
      const detail = titleDetailMap.get(tid);
      if (detail?.genres) {
        for (const genre of detail.genres) {
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        }
      }
    }

    const genreDistribution = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([genre, count]) => ({ genre, count }));

    // Days active (last 90 days reading calendar)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const readingDays = await prisma.readingProgress.findMany({
      where: {
        userId: user.id,
        updatedAt: { gte: ninetyDaysAgo },
      },
      select: { updatedAt: true },
      // distinct on 'updatedAt' is a no-op for timestamps — dedupe by calendar
      // day in JS below instead (the Set already collapses same-day reads).
      take: 5000,
    });

    const readingDates = new Set(
      readingDays.map((d) => d.updatedAt.toISOString().split('T')[0]),
    );

    const readingCalendar = Array.from({ length: 90 }, (_, i) => {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      return { date: dateStr, read: readingDates.has(dateStr) };
    });

    res.json({
      success: true,
      data: {
        totalChapters,
        totalSeries,
        streakDays: user.streakDays,
        daysActive: readingDates.size,
        perTitle: perTitleStats,
        genreDistribution,
        readingCalendar,
      },
    });
  } catch (err) {
    next(err);
  }
});
