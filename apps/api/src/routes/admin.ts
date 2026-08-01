import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';

export const adminRouter = Router();

// All admin routes require auth + at least moderator role
adminRouter.use(requireAuth);
adminRouter.use(requireRole('moderator', 'admin'));

// ─── Schemas ──────────────────────────────────────────

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
});

const IdParams = z.object({
  id: z.string().uuid(),
});

const SetRoleSchema = z.object({
  role: z.enum(['user', 'moderator', 'admin']),
});

const WikiParams = z.object({
  slug: z.string().min(1),
});

// ─── GET /api/admin/stats ─────────────────────────────

adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const [
      users,
      posts,
      comments,
      clubs,
      wikiPages,
      predictions,
      openPredictions,
      reviews,
      chapters,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.communityPost.count(),
      prisma.postComment.count(),
      prisma.readingClub.count(),
      prisma.wikiPage.count(),
      prisma.prediction.count(),
      prisma.prediction.count({ where: { result: null, resolvesAt: { gt: new Date() } } }),
      prisma.review.count(),
      prisma.chapter.count(),
    ]);

    res.json({
      success: true,
      data: {
        users,
        posts,
        comments,
        clubs,
        wikiPages,
        predictions,
        openPredictions,
        reviews,
        chapters,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/users ─────────────────────────────

adminRouter.get('/users', validate({ query: ListQuery }), async (req, res, next) => {
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
          streakDays: true,
          createdAt: true,
          _count: { select: { communityPosts: true, postComments: true, reviews: true } },
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

adminRouter.patch('/users/:id/role', requireRole('admin'), validate({ params: IdParams, body: SetRoleSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof SetRoleSchema>;

    // Resolve the acting user's DB id from their firebase uid
    const acting = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!acting) throw new NotFoundError('User');

    // Admins cannot change their own role (prevents locking out the last admin)
    if (acting.id === id) {
      throw new ForbiddenError('You cannot change your own role');
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundError('User', id);

    const updated = await prisma.user.update({
      where: { id },
      data: { role: body.role },
      select: { id: true, displayName: true, email: true, role: true },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── Moderation: posts ────────────────────────────────

// List recent posts (for moderation queue)
adminRouter.get('/posts', validate({ query: ListQuery }), async (req, res, next) => {
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

// Delete any post (moderator+)
adminRouter.delete('/posts/:id', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const post = await prisma.communityPost.findUnique({ where: { id }, select: { id: true } });
    if (!post) throw new NotFoundError('Post', id);

    await prisma.communityPost.delete({ where: { id } });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
});

// ─── Moderation: comments ─────────────────────────────

// List recent comments (for moderation queue)
adminRouter.get('/comments', validate({ query: ListQuery }), async (req, res, next) => {
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
        items: comments.map((c) => ({
          id: c.id,
          body: c.body,
          author: c.author,
          post: c.post,
          createdAt: c.createdAt.toISOString(),
        })),
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

// Delete any comment (moderator+)
adminRouter.delete('/comments/:id', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const comment = await prisma.postComment.findUnique({ where: { id }, select: { id: true } });
    if (!comment) throw new NotFoundError('Comment', id);

    await prisma.postComment.delete({ where: { id } });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
});

// ─── Moderation: wiki pages ───────────────────────────

// List wiki pages (for moderation queue)
adminRouter.get('/wiki', validate({ query: ListQuery }), async (req, res, next) => {
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

// Delete a wiki page by title slug (moderator+)
adminRouter.delete('/wiki/:slug', validate({ params: WikiParams }), async (req, res, next) => {
  try {
    const slug = req.params.slug as string;
    const title = await prisma.title.findUnique({ where: { slug }, select: { id: true } });
    if (!title) throw new NotFoundError('Title', slug);

    const deleted = await prisma.wikiPage.deleteMany({
      where: { titleId: title.id, slug },
    });
    if (deleted.count === 0) throw new NotFoundError('WikiPage', slug);

    res.json({ success: true, data: { deleted: true, slug } });
  } catch (err) {
    next(err);
  }
});

// ─── Moderation: clubs ────────────────────────────────

// List clubs (for moderation queue)
adminRouter.get('/clubs', validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof ListQuery>;
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [clubs, total] = await Promise.all([
      prisma.readingClub.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          memberCount: true,
          createdAt: true,
        },
      }),
      prisma.readingClub.count(),
    ]);

    res.json({
      success: true,
      data: {
        items: clubs.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
        total,
        page,
        limit,
        hasMore: skip + clubs.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Delete a club (moderator+)
adminRouter.delete('/clubs/:id', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const club = await prisma.readingClub.findUnique({ where: { id }, select: { id: true } });
    if (!club) throw new NotFoundError('ReadingClub', id);

    await prisma.readingClub.delete({ where: { id } });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
});
