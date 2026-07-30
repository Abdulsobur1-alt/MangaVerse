import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { cacheDel } from '../lib/redis.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';

export const reviewsRouter = Router();

// ─── Schemas ──────────────────────────────────────────

const CreateReviewSchema = z.object({
  rating: z.number().int().min(1).max(10),
  body: z.string().min(10).max(5000).optional(),
  subScores: z
    .object({
      story: z.number().min(1).max(10).optional(),
      art: z.number().min(1).max(10).optional(),
      characters: z.number().min(1).max(10).optional(),
      enjoyment: z.number().min(1).max(10).optional(),
    })
    .optional(),
});

const UpdateReviewSchema = z.object({
  rating: z.number().int().min(1).max(10).optional(),
  body: z.string().min(10).max(5000).optional(),
  subScores: z
    .object({
      story: z.number().min(1).max(10).optional(),
      art: z.number().min(1).max(10).optional(),
      characters: z.number().min(1).max(10).optional(),
      enjoyment: z.number().min(1).max(10).optional(),
    })
    .optional(),
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['newest', 'oldest', 'highest', 'lowest', 'helpful']).default('newest'),
});

// ─── GET /api/reviews/mine ────────────────────────────
// Returns the current user's reviews across all titles

reviewsRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    const reviews = await prisma.review.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        title: {
          select: {
            id: true,
            slug: true,
            title: true,
            type: true,
            coverUrl: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body,
        subScores: r.subScores,
        helpfulCount: r.helpfulCount,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        title: r.title,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reviews/:slug (title reviews, paginated) ─
// Note: this route is mounted under /api/titles/:slug/reviews in index.ts

reviewsRouter.get('/title/:slug', optionalAuth, validate({ query: PaginationSchema }), async (req, res, next) => {
  try {
    const slug = req.params.slug as string;
    const query = req.query as unknown as z.infer<typeof PaginationSchema>;
    const { page, limit, sort } = query;
    const skip = (page - 1) * limit;

    const title = await prisma.title.findUnique({
      where: { slug },
      select: { id: true, rating: true, _count: { select: { reviews: true } } },
    });
    if (!title) throw new NotFoundError('Title', slug);

    // Build orderBy
    const orderBy: Record<string, string> =
      sort === 'oldest' ? { createdAt: 'asc' } :
      sort === 'highest' ? { rating: 'desc' } :
      sort === 'lowest' ? { rating: 'asc' } :
      sort === 'helpful' ? { helpfulCount: 'desc' } :
      { createdAt: 'desc' };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { titleId: title.id },
        orderBy: orderBy as any,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.review.count({ where: { titleId: title.id } }),
    ]);

    // Compute average rating
    const avgRating =
      total > 0
        ? await prisma.review.aggregate({
            where: { titleId: title.id },
            _avg: { rating: true },
          })
        : null;

    res.json({
      success: true,
      data: {
        items: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          body: r.body,
          subScores: r.subScores,
          helpfulCount: r.helpfulCount,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          user: r.user,
        })),
        total,
        page,
        limit,
        hasMore: skip + reviews.length < total,
        averageRating: avgRating?._avg?.rating ? Math.round(avgRating._avg.rating * 10) / 10 : title.rating,
        totalReviews: total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/reviews/:slug ──────────────────────────

reviewsRouter.post('/title/:slug', requireAuth, validate({ body: CreateReviewSchema }), async (req, res, next) => {
  try {
    const slug = req.params.slug as string;
    const body = req.body as z.infer<typeof CreateReviewSchema>;

    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    const title = await prisma.title.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!title) throw new NotFoundError('Title', slug);

    // Check for existing review — one per user per title
    const existing = await prisma.review.findUnique({
      where: { userId_titleId: { userId: user.id, titleId: title.id } },
    });
    if (existing) {
      // Update instead
      const updated = await prisma.review.update({
        where: { id: existing.id },
        data: {
          rating: body.rating,
          body: body.body,
          subScores: (body.subScores ?? existing.subScores) as any,
        },
        include: {
          user: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
        },
      });

      // Update title average rating
      await recalcTitleRating(title.id);

      res.json({
        success: true,
        data: {
          id: updated.id,
          rating: updated.rating,
          body: updated.body,
          subScores: updated.subScores,
          helpfulCount: updated.helpfulCount,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          user: updated.user,
        },
      });
      return;
    }

    // Create new review
    const review = await prisma.review.create({
      data: {
        userId: user.id,
        titleId: title.id,
        rating: body.rating,
        body: body.body,
        subScores: body.subScores ?? undefined as any,
      },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    // Update title average rating
    await recalcTitleRating(title.id);

    // Clear cache for this title
    await cacheDel(`titles:list:*`);

    res.status(201).json({
      success: true,
      data: {
        id: review.id,
        rating: review.rating,
        body: review.body,
        subScores: review.subScores,
        helpfulCount: review.helpfulCount,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        user: review.user,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/reviews/:id ─────────────────────────────

reviewsRouter.put('/:id', requireAuth, validate({ body: UpdateReviewSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof UpdateReviewSchema>;

    const review = await prisma.review.findUnique({ where: { id }, select: { id: true, userId: true, titleId: true } });
    if (!review) throw new NotFoundError('Review', id);

    // Ownership check
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user || user.id !== review.userId) {
      throw new ForbiddenError('You can only edit your own reviews');
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        ...(body.rating !== undefined && { rating: body.rating }),
        ...(body.body !== undefined && { body: body.body }),
        ...(body.subScores !== undefined && { subScores: body.subScores as any }),
      },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    // Update title average rating if rating changed
    if (body.rating !== undefined) {
      await recalcTitleRating(review.titleId);
    }

    res.json({
      success: true,
      data: {
        id: updated.id,
        rating: updated.rating,
        body: updated.body,
        subScores: updated.subScores,
        helpfulCount: updated.helpfulCount,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        user: updated.user,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/reviews/:id ──────────────────────────

reviewsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;

    const review = await prisma.review.findUnique({ where: { id }, select: { id: true, userId: true, titleId: true } });
    if (!review) throw new NotFoundError('Review', id);

    // Ownership check
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user || user.id !== review.userId) {
      throw new ForbiddenError('You can only delete your own reviews');
    }

    await prisma.review.delete({ where: { id } });

    // Update title average rating
    await recalcTitleRating(review.titleId);

    // Clear cache
    await cacheDel(`titles:list:*`);

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ──────────────────────────────────────────

async function recalcTitleRating(titleId: string) {
  const agg = await prisma.review.aggregate({
    where: { titleId },
    _avg: { rating: true },
    _count: true,
  });
  const avg = agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null;
  await prisma.title.update({
    where: { id: titleId },
    data: { rating: avg },
  });
}
