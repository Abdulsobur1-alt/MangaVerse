import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';

export const searchRouter = Router();

// ─── Schemas ──────────────────────────────────────────

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  type: z.string().optional(),
  genre: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ─── GET /api/search ──────────────────────────────────

searchRouter.get('/', validate({ query: SearchQuerySchema }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof SearchQuerySchema>;
    const { q, type, genre, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { author: { contains: q, mode: 'insensitive' as const } },
        { artist: { contains: q, mode: 'insensitive' as const } },
        { synopsis: { contains: q, mode: 'insensitive' as const } },
      ],
    };

    if (type) where.type = type;
    if (genre) where.genres = { has: genre };

    const [results, total] = await Promise.all([
      prisma.title.findMany({
        where: where as any,
        orderBy: { rating: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          type: true,
          status: true,
          genres: true,
          author: true,
          coverUrl: true,
          rating: true,
          totalChapters: true,
        },
      }),
      prisma.title.count({ where: where as any }),
    ]);

    res.json({
      success: true,
      data: {
        items: results,
        total,
        page,
        limit,
        hasMore: skip + results.length < total,
        query: q,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/search/suggestions ──────────────────────

searchRouter.get('/suggestions', validate({ query: z.object({ q: z.string().min(1).max(100) }) }), async (req, res, next) => {
  try {
    const query = req.query as unknown as { q: string };
    const { q } = query;

    const titles = await prisma.title.findMany({
      where: {
        title: { contains: q, mode: 'insensitive' },
      },
      take: 8,
      select: {
        slug: true,
        title: true,
        type: true,
        coverUrl: true,
      },
    });

    res.json({ success: true, data: titles });
  } catch (err) {
    next(err);
  }
});
