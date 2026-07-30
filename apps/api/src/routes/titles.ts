import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';

export const titlesRouter = Router();

// ─── Schemas ──────────────────────────────────────────

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.string().optional(),
  status: z.string().optional(),
  genre: z.string().optional(),
  sort: z.enum(['trending', 'newest', 'rating', 'title']).default('trending'),
  search: z.string().optional(),
});

const TitleSlugParams = z.object({
  slug: z.string().min(1),
});

// ─── GET /api/titles ──────────────────────────────────

titlesRouter.get('/', validate({ query: ListQuerySchema }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof ListQuerySchema>;
    const { page, limit, type, status, genre, sort, search } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (genre) where.genres = { has: genre };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' as const } },
        { author: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    // Build orderBy
    const orderBy: Record<string, string> =
      sort === 'newest' ? { createdAt: 'desc' } :
      sort === 'rating' ? { rating: 'desc' } :
      sort === 'title' ? { title: 'asc' } :
      { rating: 'desc' };

    const cacheKey = `titles:list:${JSON.stringify({ page, limit, type, status, genre, sort, search })}`;
    const cached = await cacheGet<{ titles: unknown[]; total: number }>(cacheKey);
    if (cached) {
      res.json({ success: true, data: { items: cached.titles, total: cached.total, page, limit } });
      return;
    }

    const [titles, total] = await Promise.all([
      prisma.title.findMany({
        where: where as any,
        orderBy: orderBy as any,
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
          createdAt: true,
        },
      }),
      prisma.title.count({ where: where as any }),
    ]);

    await cacheSet(cacheKey, { titles, total }, 300);

    res.json({
      success: true,
      data: { items: titles, total, page, limit, hasMore: skip + titles.length < total },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/titles/trending ─────────────────────────

titlesRouter.get('/trending', async (_req, res, next) => {
  try {
    const cached = await cacheGet<any[]>('titles:trending');
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    const titles = await prisma.title.findMany({
      orderBy: { rating: 'desc' },
      take: 20,
      select: {
        id: true,
        slug: true,
        title: true,
        type: true,
        coverUrl: true,
        rating: true,
        totalChapters: true,
      },
    });

    await cacheSet('titles:trending', titles, 600);

    res.json({ success: true, data: titles });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/titles/:slug ────────────────────────────

titlesRouter.get('/:slug', optionalAuth, validate({ params: TitleSlugParams }), async (req, res, next) => {
  try {
    const params = req.params as { slug: string };
    const slug = params.slug;

    // Pagination for chapters
    const chaptersPage = parseInt(req.query.chaptersPage as string) || 1;
    const chaptersLimit = parseInt(req.query.chaptersLimit as string) || 50;
    const chaptersSkip = (chaptersPage - 1) * chaptersLimit;

    const cached = await cacheGet<any>(`titles:${slug}:${chaptersPage}:${chaptersLimit}`);
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    const [title, chapters, totalChapters] = await Promise.all([
      prisma.title.findUnique({
        where: { slug },
        include: {
          _count: { select: { chapters: true, bookmarks: true, reviews: true } },
        },
      }),
      prisma.chapter.findMany({
        where: { series: { slug } },
        orderBy: { number: 'desc' },
        skip: chaptersSkip,
        take: chaptersLimit,
        select: { id: true, number: true, title: true, pageCount: true, createdAt: true },
      }),
      prisma.chapter.count({
        where: { series: { slug } },
      }),
    ]);

    if (!title) throw new NotFoundError('Title', slug);

    // If user is authenticated (via optionalAuth middleware), fetch reading progress
    let progressMap: Record<string, { pageNumber: number; completed: boolean }> = {};
    try {
      const userId = req.user?.uid;
      if (userId && chapters.length > 0) {
        const chapterIds = chapters.map(c => c.id);
        const progressEntries = await prisma.readingProgress.findMany({
          where: { userId, chapterId: { in: chapterIds } },
          select: { chapterId: true, pageNumber: true, completed: true },
        });
        for (const entry of progressEntries) {
          progressMap[entry.chapterId] = { pageNumber: entry.pageNumber, completed: entry.completed };
        }
      }
    } catch {
      // Silently fail — reading progress is a bonus feature
    }

    const result = {
      ...title,
      chapters: chapters.map(ch => ({
        ...ch,
        progress: progressMap[ch.id] || null,
      })),
      chaptersPagination: {
        page: chaptersPage,
        limit: chaptersLimit,
        total: totalChapters,
        hasMore: chaptersSkip + chapters.length < totalChapters,
      },
    };

    await cacheSet(`titles:${slug}:${chaptersPage}:${chaptersLimit}`, result, 300);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
