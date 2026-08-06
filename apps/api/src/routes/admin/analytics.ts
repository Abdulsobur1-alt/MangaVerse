import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../services/rbac.js';

/* ═══════════════════════════════════════════════════════════════
   Admin Analytics — platform pulse: growth, engagement, and top
   content over trailing windows.
   ═══════════════════════════════════════════════════════════════ */

export const adminAnalyticsRouter = Router();

adminAnalyticsRouter.use(requirePermission('analytics:read'));

adminAnalyticsRouter.get('/analytics', async (_req, res, next) => {
  try {
    const now = Date.now();
    const day = 86_400_000;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now - 7 * day);
    const monthAgo = new Date(now - 30 * day);

    const topTitlesPromise = (async () => {
      const rows = await prisma.bookmark.groupBy({
        by: ['titleId'],
        where: { createdAt: { gte: monthAgo } },
        _count: { _all: true },
        orderBy: { _count: { titleId: 'desc' } },
        take: 5,
      });
      if (rows.length === 0) return [];
      const titles = await prisma.title.findMany({
        where: { id: { in: rows.map((r) => r.titleId) } },
        select: { id: true, slug: true, title: true, coverUrl: true, type: true },
      });
      return titles
        .map((t) => ({ ...t, saves: rows.find((r) => r.titleId === t.id)?._count._all ?? 0 }))
        .sort((a, b) => b.saves - a.saves);
    })();

    const topAuthorsPromise = prisma.title
      .groupBy({
        by: ['author'],
        _count: { _all: true },
        orderBy: { _count: { author: 'desc' } },
        take: 5,
        where: { author: { not: null } },
      })
      .then((rows) => rows.map((r) => ({ author: r.author as string, saves: r._count._all })));

    const [
      totalUsers,
      newToday,
      newWeek,
      totalTitles,
      totalChapters,
      totalReviews,
      totalPosts,
      active7d,
      reads7d,
      bookmarks7d,
      topTitleRows,
      topAuthorRows,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.title.count(),
      prisma.chapter.count(),
      prisma.review.count(),
      prisma.communityPost.count(),
      prisma.readingProgress.groupBy({ by: ['userId'], where: { updatedAt: { gte: weekAgo } } }).then((r) => r.length),
      prisma.readingProgress.count({ where: { updatedAt: { gte: weekAgo } } }),
      prisma.bookmark.count({ where: { createdAt: { gte: weekAgo } } }),
      topTitlesPromise,
      topAuthorsPromise,
    ]);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, newToday, newWeek },
        content: { titles: totalTitles, chapters: totalChapters, reviews: totalReviews, posts: totalPosts },
        engagement: { activeUsers7d: active7d, reads7d, bookmarks7d },
        topTitles: topTitleRows,
        topAuthors: topAuthorRows,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});
