import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';
import { broadcastNotification } from '../../services/notifications.js';
import { logAudit } from '../../services/audit.js';
import { ROLES, effectiveRoles } from '../../services/rbac.js';

export const adminCoreRouter = Router();

// All admin routes require auth + at least moderator role (legacy gate —
// the granular modules mount their own requirePermission checks).
adminCoreRouter.use(requireAuth);
adminCoreRouter.use(requireRole('moderator', 'admin'));

// ─── Schemas ──────────────────────────────────────────

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
});

const IdParams = z.object({ id: z.string().uuid() });

const SetRoleSchema = z
  .object({
    // Legacy single-role payloads send `role`; the console sends `roles`.
    role: z.string().min(1).max(40).optional(),
    roles: z.array(z.string().min(1).max(40)).min(1).max(20).optional(),
    rolePermissions: z.array(z.string().min(1).max(60)).max(100).optional(),
  })
  .refine((v) => v.role !== undefined || v.roles !== undefined, {
    message: 'Provide `role` (legacy) or `roles` (multi-role list)',
  });

const WikiParams = z.object({ slug: z.string().min(1) });

const ReportsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'resolved', 'dismissed', 'escalated']).optional(),
});

const ResolveReportSchema = z.object({
  status: z.enum(['resolved', 'dismissed', 'escalated']),
  note: z.string().max(500).optional(),
});

const BroadcastSchema = z.object({
  type: z.enum(['system', 'announcement', 'security', 'moderator', 'recommendation', 'milestone']),
  title: z.string().min(1).max(140),
  body: z.string().max(1000).optional(),
  link: z.string().max(500).optional(),
  imageUrl: z.string().max(500).optional(),
  priority: z.enum(['critical', 'high', 'normal', 'silent', 'background']).optional(),
  audience: z.enum(['all', 'logged_in', 'moderators']).default('all'),
});

const TemplateSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  type: z.string().min(1).max(40),
  category: z.string().default('system'),
  priority: z.enum(['critical', 'high', 'normal', 'silent', 'background']).default('normal'),
  title: z.string().min(1).max(200),
  body: z.string().max(1000).optional(),
  link: z.string().max(500).optional(),
  active: z.boolean().default(true),
});

// ─── GET /api/admin/roles ─────────────────────────────
// Exposes the role catalog (for the RBAC UI).

adminCoreRouter.get('/roles', async (_req, res) => {
  res.json({ success: true, data: { items: ROLES } });
});

// ─── GET /api/admin/stats ─────────────────────────────

adminCoreRouter.get('/stats', async (_req, res, next) => {
  try {
    const [users, posts, comments, clubs, wikiPages, predictions, openPredictions, reviews, chapters, pendingReports] =
      await Promise.all([
        prisma.user.count(),
        prisma.communityPost.count(),
        prisma.postComment.count(),
        prisma.readingClub.count(),
        prisma.wikiPage.count(),
        prisma.prediction.count(),
        prisma.prediction.count({ where: { result: null, resolvesAt: { gt: new Date() } } }),
        prisma.review.count(),
        prisma.chapter.count(),
        prisma.contentReport.count({ where: { status: 'pending' } }),
      ]);

    res.json({
      success: true,
      data: { users, posts, comments, clubs, wikiPages, predictions, openPredictions, reviews, chapters, pendingReports },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/users ─────────────────────────────

adminCoreRouter.get('/users', validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof ListQuery>;
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          roles: true,
          streakDays: true,
          bannedAt: true,
          suspendedUntil: true,
          createdAt: true,
          _count: { select: { communityPosts: true, postComments: true, reviews: true, warningsReceived: { where: { active: true } } } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
          bannedAt: u.bannedAt?.toISOString() ?? null,
          suspendedUntil: u.suspendedUntil?.toISOString() ?? null,
          warnings: u._count.warningsReceived,
        })),
        total,
        page,
        limit,
        hasMore: skip + users.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/users/:id/role ──────────────────

adminCoreRouter.patch('/users/:id/role', requireRole('admin'), validate({ params: IdParams, body: SetRoleSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof SetRoleSchema>;

    const acting = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true, role: true, roles: true } });
    if (!acting) throw new NotFoundError('User');

    if (acting.id === id) {
      throw new ForbiddenError('You cannot change your own role');
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, roles: true } });
    if (!target) throw new NotFoundError('User', id);

    // Multi-role list wins; legacy single `role` wraps into one entry. The
    // `role` column always mirrors the PRIMARY role (roles[0]) so legacy
    // role-based checks keep working.
    const nextRoles = body.roles ? [...new Set(body.roles)] : [body.role as string];

    const actorRoles = effectiveRoles(acting);
    const targetRoles = effectiveRoles(target);
    const actorIsSuper = actorRoles.includes('super_admin');

    // Super admins can only be modified by another super admin — role
    // management is the one power even platform admins do not hold over them.
    if (targetRoles.includes('super_admin') && !actorIsSuper) {
      throw new ForbiddenError('Only a super admin can modify another super admin');
    }
    // ...and only super admins may grant the super_admin role (prevents a
    // platform admin from minting new super admins via the role console).
    if (!actorIsSuper && nextRoles.includes('super_admin')) {
      throw new ForbiddenError('Only a super admin can grant the super_admin role');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        role: nextRoles[0],
        roles: nextRoles,
        ...(body.rolePermissions !== undefined ? { rolePermissions: body.rolePermissions as never } : {}),
      },
      select: { id: true, displayName: true, email: true, role: true, roles: true },
    });

    await logAudit({
      actorId: acting.id,
      action: 'role.change',
      resource: 'user',
      resourceId: id,
      targetUserId: id,
      details: { from: target.role, fromRoles: effectiveRoles(target), to: nextRoles[0], roles: nextRoles },
      ip: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/users/:id/permissions ───────────
// Granular override (add "x:y", remove "-x:y").

const PermissionsSchema = z.object({
  rolePermissions: z.array(z.string().min(1).max(60)).max(100),
});

adminCoreRouter.patch('/users/:id/permissions', validate({ params: IdParams, body: PermissionsSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof PermissionsSchema>;
    const acting = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true, role: true, roles: true } });
    if (!acting) throw new NotFoundError('User');

    // Same super-admin protection as the role route: granular permission
    // overrides must not be applied to a super admin by anyone else.
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, roles: true } });
    if (!target) throw new NotFoundError('User', id);
    if (effectiveRoles(target).includes('super_admin') && !effectiveRoles(acting).includes('super_admin')) {
      throw new ForbiddenError('Only a super admin can modify another super admin');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { rolePermissions: body.rolePermissions as never },
      select: { id: true, displayName: true, role: true, roles: true },
    });

    await logAudit({
      actorId: acting.id,
      action: 'role.permissions',
      resource: 'user',
      resourceId: id,
      targetUserId: id,
      details: { permissions: body.rolePermissions },
      ip: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── Moderation: posts ────────────────────────────────

adminCoreRouter.get('/posts', validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof ListQuery>;
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, displayName: true, email: true } },
          _count: { select: { votes: true, comments: true } },
        },
      }),
      prisma.communityPost.count(),
    ]);

    res.json({
      success: true,
      data: {
        items: posts.map((p) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          tag: p.tag,
          author: p.author,
          upvotes: p._count.votes,
          comments: p._count.comments,
          createdAt: p.createdAt.toISOString(),
        })),
        total,
        page,
        limit,
        hasMore: skip + posts.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Moderation: content reports (flags) ─────────────

adminCoreRouter.get('/reports', validate({ query: ReportsQuery }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof ReportsQuery>;
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [reports, total] = await Promise.all([
      prisma.contentReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          reporter: { select: { id: true, displayName: true, email: true } },
          resolver: { select: { id: true, displayName: true, email: true } },
        },
      }),
      prisma.contentReport.count({ where }),
    ]);

    const postIds = reports.filter((r) => r.contentType === 'post').map((r) => r.targetId);
    const commentIds = reports.filter((r) => r.contentType === 'comment').map((r) => r.targetId);
    const wikiIds = reports.filter((r) => r.contentType === 'wiki').map((r) => r.targetId);

    const [posts, comments, wikis] = await Promise.all([
      postIds.length
        ? prisma.communityPost.findMany({
            where: { id: { in: postIds } },
            select: { id: true, title: true, body: true, author: { select: { displayName: true } } },
          })
        : Promise.resolve([] as { id: string; title: string; body: string; author: { displayName: string } }[]),
      commentIds.length
        ? prisma.postComment.findMany({
            where: { id: { in: commentIds } },
            select: { id: true, body: true, author: { select: { displayName: true } }, post: { select: { title: true } } },
          })
        : Promise.resolve([] as { id: string; body: string; author: { displayName: string }; post: { title: string } }[]),
      wikiIds.length
        ? prisma.wikiPage.findMany({
            where: { id: { in: wikiIds } },
            select: { id: true, slug: true, title: { select: { slug: true, title: true } } },
          })
        : Promise.resolve([] as { id: string; slug: string; title: { slug: string; title: string } }[]),
    ]);

    const postMap = new Map(posts.map((p) => [p.id, p]));
    const commentMap = new Map(comments.map((c) => [c.id, c]));
    const wikiMap = new Map(wikis.map((w) => [w.id, w]));

    res.json({
      success: true,
      data: {
        items: reports.map((r) => {
          let target: Record<string, unknown> | null = null;
          if (r.contentType === 'post') {
            const p = postMap.get(r.targetId);
            if (p) target = { id: p.id, title: p.title, bodyPreview: p.body.slice(0, 200), authorName: p.author.displayName };
          } else if (r.contentType === 'comment') {
            const c = commentMap.get(r.targetId);
            if (c) target = { id: c.id, bodyPreview: c.body.slice(0, 200), authorName: c.author.displayName, postTitle: c.post.title };
          } else {
            const w = wikiMap.get(r.targetId);
            if (w) target = { id: w.id, slug: w.slug, titleSlug: w.title.slug, titleName: w.title.title };
          }

          return {
            id: r.id,
            contentType: r.contentType,
            targetId: r.targetId,
            reason: r.reason,
            details: r.details,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
            resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
            reporter: r.reporter,
            resolver: r.resolver,
            target,
          };
        }),
        total,
        page,
        limit,
        hasMore: skip + reports.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update a report's status (moderator+)

adminCoreRouter.patch('/reports/:id', validate({ params: IdParams, body: ResolveReportSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof ResolveReportSchema>;

    const acting = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!acting) throw new NotFoundError('User');

    const report = await prisma.contentReport.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!report) throw new NotFoundError('Report', id);

    const updated = await prisma.contentReport.update({
      where: { id },
      data: { status: body.status, resolvedById: acting.id, resolvedAt: new Date() },
      select: { id: true, status: true, resolvedAt: true },
    });

    await logAudit({
      actorId: acting.id,
      action: 'report.update',
      resource: 'report',
      resourceId: id,
      details: { from: report.status, to: body.status, note: body.note ?? null },
      ip: req.ip,
    });

    res.json({
      success: true,
      data: { id: updated.id, status: updated.status, resolvedAt: updated.resolvedAt?.toISOString() || null },
    });
  } catch (err) {
    next(err);
  }
});

// Delete any post (moderator+)

adminCoreRouter.delete('/posts/:id', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const post = await prisma.communityPost.findUnique({ where: { id }, select: { id: true } });
    if (!post) throw new NotFoundError('Post', id);

    await prisma.communityPost.delete({ where: { id } });
    const acting = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    await logAudit({ actorId: acting?.id ?? null, action: 'post.delete', resource: 'post', resourceId: id, ip: req.ip });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
});

// ─── Moderation: comments ─────────────────────────────

adminCoreRouter.get('/comments', validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof ListQuery>;
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      prisma.postComment.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, displayName: true, email: true } },
          post: { select: { id: true, title: true } },
        },
      }),
      prisma.postComment.count(),
    ]);

    res.json({
      success: true,
      data: {
        items: comments.map((c) => ({ id: c.id, body: c.body, author: c.author, post: c.post, createdAt: c.createdAt.toISOString() })),
        total,
        page,
        limit,
        hasMore: skip + comments.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

adminCoreRouter.delete('/comments/:id', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const comment = await prisma.postComment.findUnique({ where: { id }, select: { id: true } });
    if (!comment) throw new NotFoundError('Comment', id);

    await prisma.postComment.delete({ where: { id } });
    const acting = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    await logAudit({ actorId: acting?.id ?? null, action: 'comment.delete', resource: 'comment', resourceId: id, ip: req.ip });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
});

// ─── Moderation: wiki pages ───────────────────────────

adminCoreRouter.get('/wiki', validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof ListQuery>;
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [pages, total] = await Promise.all([
      prisma.wikiPage.findMany({
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, displayName: true, email: true } },
          title: { select: { slug: true, title: true } },
        },
      }),
      prisma.wikiPage.count(),
    ]);

    res.json({
      success: true,
      data: {
        items: pages.map((p) => ({
          id: p.id,
          slug: p.slug,
          version: p.version,
          contentPreview: p.contentMd.slice(0, 200),
          author: p.author,
          title: p.title,
          updatedAt: p.updatedAt.toISOString(),
        })),
        total,
        page,
        limit,
        hasMore: skip + pages.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

adminCoreRouter.delete('/wiki/:slug', validate({ params: WikiParams }), async (req, res, next) => {
  try {
    const slug = req.params.slug as string;
    const title = await prisma.title.findUnique({ where: { slug }, select: { id: true } });
    if (!title) throw new NotFoundError('Title', slug);

    const deleted = await prisma.wikiPage.deleteMany({ where: { titleId: title.id, slug } });
    if (deleted.count === 0) throw new NotFoundError('WikiPage', slug);

    const acting = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    await logAudit({ actorId: acting?.id ?? null, action: 'wiki.delete', resource: 'wiki', resourceId: slug, ip: req.ip });
    res.json({ success: true, data: { deleted: true, slug } });
  } catch (err) {
    next(err);
  }
});

// ─── Moderation: clubs ────────────────────────────────

adminCoreRouter.get('/clubs', validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof ListQuery>;
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [clubs, total] = await Promise.all([
      prisma.readingClub.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, name: true, memberCount: true, createdAt: true },
      }),
      prisma.readingClub.count(),
    ]);

    res.json({
      success: true,
      data: { items: clubs.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })), total, page, limit, hasMore: skip + clubs.length < total },
    });
  } catch (err) {
    next(err);
  }
});

adminCoreRouter.delete('/clubs/:id', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const club = await prisma.readingClub.findUnique({ where: { id }, select: { id: true } });
    if (!club) throw new NotFoundError('ReadingClub', id);

    await prisma.readingClub.delete({ where: { id } });
    const acting = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    await logAudit({ actorId: acting?.id ?? null, action: 'club.delete', resource: 'club', resourceId: id, ip: req.ip });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
});

// ═══ Engagement tools (Phase 10) ═══════════════════════

adminCoreRouter.get('/engagement/stats', async (_req, res, next) => {
  try {
    const days = 7;
    const since = new Date(Date.now() - days * 86_400_000);

    const [recent, totals, pushSubs, announcements, digestUsers] = await Promise.all([
      prisma.notification.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, category: true, priority: true, type: true },
      }),
      prisma.notification.count(),
      prisma.pushSubscription.count(),
      prisma.announcement.count(),
      prisma.user.count({ where: { notificationPrefs: { path: ['digest'], not: 'off' } } }),
    ]);

    const perDay = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const byPriority = new Map<string, number>();
    for (const n of recent) {
      const day = n.createdAt.toISOString().slice(0, 10);
      perDay.set(day, (perDay.get(day) || 0) + 1);
      byCategory.set(n.category, (byCategory.get(n.category) || 0) + 1);
      byPriority.set(n.priority, (byPriority.get(n.priority) || 0) + 1);
    }

    res.json({
      success: true,
      data: {
        totals: { notifications: totals, last7Days: recent.length, pushSubscriptions: pushSubs, announcements, digestEnabledUsers: digestUsers },
        perDay: Object.fromEntries([...perDay.entries()].sort()),
        byCategory: Object.fromEntries(byCategory),
        byPriority: Object.fromEntries(byPriority),
      },
    });
  } catch (err) {
    next(err);
  }
});

adminCoreRouter.post('/notifications/broadcast', validate({ body: BroadcastSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof BroadcastSchema>;
    const sent = await broadcastNotification({
      type: body.type,
      title: body.title,
      body: body.body,
      link: body.link,
      imageUrl: body.imageUrl,
      priority: body.priority,
      audience: body.audience,
    });
    const acting = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    await logAudit({
      actorId: acting?.id ?? null,
      action: 'notification.broadcast',
      resource: 'notification',
      details: { type: body.type, audience: body.audience, sent },
      ip: req.ip,
    });
    res.json({ success: true, data: { sent } });
  } catch (err) {
    next(err);
  }
});

// ─── Notification templates (editor) ───────────────────

const TemplateKeyParams = z.object({ key: z.string().min(1) });

adminCoreRouter.get('/notification-templates', async (_req, res, next) => {
  try {
    const templates = await prisma.notificationTemplate.findMany({ orderBy: { key: 'asc' } });
    res.json({ success: true, data: { items: templates } });
  } catch (err) {
    next(err);
  }
});

adminCoreRouter.post('/notification-templates', validate({ body: TemplateSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof TemplateSchema>;
    const created = await prisma.notificationTemplate.upsert({ where: { key: body.key }, create: body, update: body });
    const acting = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    await logAudit({ actorId: acting?.id ?? null, action: 'template.update', resource: 'notification_template', resourceId: body.key, ip: req.ip });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

adminCoreRouter.patch('/notification-templates/:key', validate({ params: TemplateKeyParams, body: TemplateSchema.partial() }), async (req, res, next) => {
  try {
    const { key } = req.params as unknown as z.infer<typeof TemplateKeyParams>;
    const body = req.body as Partial<z.infer<typeof TemplateSchema>>;
    const updated = await prisma.notificationTemplate.update({ where: { key }, data: body });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

adminCoreRouter.delete('/notification-templates/:key', validate({ params: TemplateKeyParams }), async (req, res, next) => {
  try {
    const { key } = req.params as unknown as z.infer<typeof TemplateKeyParams>;
    await prisma.notificationTemplate.deleteMany({ where: { key } });
    res.json({ success: true, data: { deleted: true, key } });
  } catch (err) {
    next(err);
  }
});
