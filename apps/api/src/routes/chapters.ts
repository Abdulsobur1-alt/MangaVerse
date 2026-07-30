import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet } from '../lib/redis.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';

export const chaptersRouter = Router();

// ─── Schemas ──────────────────────────────────────────

const ChapterListQuery = z.object({
  titleId: z.string().uuid().optional(),
  titleSlug: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const ChapterIdParams = z.object({
  id: z.string().uuid(),
});

// ─── GET /api/chapters ────────────────────────────────

chaptersRouter.get('/', validate({ query: ChapterListQuery }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof ChapterListQuery>;
    const { titleId, titleSlug, page, limit } = query;
    const skip = (page - 1) * limit;

    let resolvedTitleId: string | undefined = titleId;

    // Resolve slug to UUID if provided
    if (titleSlug && !titleId) {
      const title = await prisma.title.findUnique({
        where: { slug: titleSlug },
        select: { id: true },
      });
      if (!title) throw new NotFoundError('Title', titleSlug);
      resolvedTitleId = title.id;
    }

    if (!resolvedTitleId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Either titleId or titleSlug is required' },
      });
      return;
    }

    // Use non-null assertion after the early return guard above
    const titleIdGuaranteed: string = resolvedTitleId;

    const cacheKey = `chapters:${titleIdGuaranteed}:${page}:${limit}`;
    const cached = await cacheGet<{ items: unknown[]; total: number }>(cacheKey);
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    const [chapters, total] = await Promise.all([
      prisma.chapter.findMany({
        where: { titleId: titleIdGuaranteed },
        orderBy: { number: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          number: true,
          title: true,
          pageCount: true,
          coinLocked: true,
          createdAt: true,
        },
      }),
      prisma.chapter.count({ where: { titleId: titleIdGuaranteed } }),
    ]);

    const result = { items: chapters, total, page, limit, hasMore: skip + chapters.length < total };
    await cacheSet(cacheKey, result, 300);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/chapters/:id ────────────────────────────

chaptersRouter.get('/:id', validate({ params: ChapterIdParams }), async (req, res, next) => {
  try {
    const id: string = req.params.id as string;

    const cached = await cacheGet<unknown>(`chapter:${id}`);
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        series: {
          select: { id: true, slug: true, title: true, coverUrl: true },
        },
      },
    });

    if (!chapter) throw new NotFoundError('Chapter', id);

    await cacheSet(`chapter:${id}`, chapter, 600);

    res.json({ success: true, data: chapter });
  } catch (err) {
    next(err);
  }
});
