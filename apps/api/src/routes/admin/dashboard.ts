import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../services/rbac.js';

/* ═══════════════════════════════════════════════════════════════
   Admin Dashboard — the executive overview.
   Platform pulse (counts), recent signups, top titles by library
   saves, and the latest audit activity.
   ═══════════════════════════════════════════════════════════════ */

export const adminDashboardRouter = Router();

adminDashboardRouter.use(requirePermission('dashboard:read'));

adminDashboardRouter.get('/dashboard', async (_req, res, next) => {
  try {
    const [users, titles, chapters, reviews, posts, comments, tickets, pendingReports, flagsEnabled, activeWarnings] =
      await Promise.all([
        prisma.user.count(),
        prisma.title.count(),
        prisma.chapter.count(),
        prisma.review.count(),
        prisma.communityPost.count(),
        prisma.postComment.count(),
        prisma.supportTicket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
        prisma.contentReport.count({ where: { status: 'pending' } }),
        prisma.featureFlag.count({ where: { enabled: true } }),
        prisma.userWarning.count({ where: { active: true } }),
      ]);

    const [recentUsers, topTitles, recentAudit] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, displayName: true, avatarUrl: true, role: true, createdAt: true },
      }),
      prisma.bookmark.groupBy({
        by: ['titleId'],
        _count: { _all: true },
        orderBy: { _count: { titleId: 'desc' } },
        take: 5,
      }).then((rows) =>
        rows.length
          ? prisma.title.findMany({
              where: { id: { in: rows.map((r) => r.titleId) } },
              select: { id: true, slug: true, title: true, coverUrl: true, type: true, rating: true },
            }).then((titlesList) =>
              titlesList
                .map((t) => ({
                  ...t,
                  saves: rows.find((r) => r.titleId === t.id)?._count._all ?? 0,
                }))
                .sort((a, b) => b.saves - a.saves),
            )
          : Promise.resolve([]),
      ),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { actor: { select: { displayName: true, avatarUrl: true } } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          users,
          titles,
          chapters,
          reviews,
          posts,
          comments,
          openTickets: tickets,
          pendingReports,
          flagsEnabled,
          activeWarnings,
        },
        recentUsers: recentUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
        topTitles,
        recentAudit: recentAudit.map((a) => ({
          id: a.id,
          action: a.action,
          resource: a.resource,
          resourceId: a.resourceId,
          actorName: a.actor?.displayName ?? 'system',
          createdAt: a.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});
