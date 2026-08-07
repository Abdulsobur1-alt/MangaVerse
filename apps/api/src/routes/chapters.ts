import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet } from '../lib/redis.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { mangadex } from '../services/mangadex.js';
import { getChapterLockInfo, isChapterUnlockedByUser, resolveUserId, unlockChapter } from '../services/coins.js';

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
// Returns chapter detail. When authenticated, includes per-user lock status.

chaptersRouter.get('/:id', optionalAuth, validate({ params: ChapterIdParams }), async (req, res, next) => {
  try {
    const id: string = req.params.id as string;

    const cached = await cacheGet<unknown>(`chapter:${id}`);
    if (cached) {
      const base = cached as Record<string, unknown>;
      // Merge per-user lock info on top of cached base chapter
      res.json({ success: true, data: await mergeLockInfo(req, base as any) });
      return;
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        series: {
          select: { id: true, slug: true, title: true, coverUrl: true, type: true },
        },
      },
    });

    if (!chapter) throw new NotFoundError('Chapter', id);

    await cacheSet(`chapter:${id}`, chapter, 600);

    res.json({ success: true, data: await mergeLockInfo(req, chapter as any) });
  } catch (err) {
    next(err);
  }
});

// Helper: add per-user locked/unlocked fields to a chapter object
async function mergeLockInfo(req: any, chapter: any): Promise<Record<string, unknown>> {
  const { locked, unlockCost } = getChapterLockInfo(chapter);
  let unlocked = !locked; // Free chapters are always accessible
  if (locked && req.user?.uid) {
    try {
      const dbUserId = await resolveUserId(req.user.uid);
      unlocked = await isChapterUnlockedByUser(dbUserId, chapter.id);
    } catch {
      unlocked = false;
    }
  }
  return { ...chapter, locked, unlocked, unlockCost };
}

// ─── GET /api/chapters/:id/pages ───────────────────────
// Returns page image URLs for a chapter.
// Tries MangaDex API if sourceUrl contains a MangaDex chapter ID,
// otherwise generates placeholder image URLs.
// If the chapter is coin-locked and the user hasn't unlocked it, returns 403.

chaptersRouter.get('/:id/pages', optionalAuth, async (req, res, next) => {
  try {
    const id: string = req.params.id as string;

    const chapter = await prisma.chapter.findUnique({
      where: { id },
      select: { id: true, number: true, pageCount: true, sourceUrl: true, pageUrls: true, titleId: true, coinLocked: true, freeAt: true },
    });

    if (!chapter) throw new NotFoundError('Chapter', id);

    // Enforce coin lock: locked chapters need an unlock spend (or freeAt passed)
    const { locked, unlockCost } = getChapterLockInfo(chapter as any);
    if (locked) {
      let unlocked = false;
      if (req.user?.uid) {
        try {
          const dbUserId = await resolveUserId(req.user.uid);
          unlocked = await isChapterUnlockedByUser(dbUserId, id);
        } catch {
          unlocked = false;
        }
      }
      if (!unlocked) {
        res.status(403).json({
          success: false,
          error: {
            code: 'CHAPTER_LOCKED',
            message: 'This chapter requires coins to unlock',
            details: { unlockCost },
          },
        });
        return;
      }
    }

    const pageCount = chapter.pageCount || 12;

    // Studio-uploaded pages take priority: when staff uploaded images for
    // this chapter (Chapter.pageUrls), serve those directly — no MangaDex
    // lookup or placeholder generation needed.
    if (chapter.pageUrls && chapter.pageUrls.length > 0) {
      return res.json({
        success: true,
        data: {
          pages: chapter.pageUrls.map((url: string, i: number) => ({
            index: i,
            url,
            width: 800,
            height: 1200,
          })),
          total: chapter.pageUrls.length,
          chapterId: chapter.id,
          chapterNumber: chapter.number,
        },
      });
    }

    // Try to get real pages from MangaDex if we have a source URL
    // MangaDex source URLs look like: https://mangadex.org/chapter/{chapterId}
    const mangadexMatch = chapter.sourceUrl?.match(/mangadex\.org\/chapter\/([a-f0-9-]+)/i);
    if (mangadexMatch) {
      try {
        const pageUrls = await mangadex.getChapterPageUrls(mangadexMatch[1]);
        return res.json({
          success: true,
          data: {
            pages: pageUrls.map((url: string, i: number) => ({
              index: i,
              url: `/api/proxy/image?url=${encodeURIComponent(url)}`,
              width: 800,
              height: 1200,
            })),
            total: pageUrls.length,
            chapterId: chapter.id,
            chapterNumber: chapter.number,
          },
        });
      } catch {
        // Fall through to placeholder generation
      }
    }

    // Generate placeholder images wrapped through the image proxy
    const pages = Array.from({ length: pageCount }, (_, i) => {
      const placeholderUrl = `/api/proxy/placeholder?chapter=${chapter.number}&page=${i + 1}&total=${pageCount}`;
      return {
        index: i,
        url: `/api/proxy/image?url=${encodeURIComponent(placeholderUrl)}`,
        width: 800,
        height: 1200,
      };
    });

    res.json({
      success: true,
      data: {
        pages,
        total: pageCount,
        chapterId: chapter.id,
        chapterNumber: chapter.number,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/chapters/:id/unlock ─────────────────────
// Spend coins to unlock a coin-locked chapter.

chaptersRouter.post('/:id/unlock', requireAuth, validate({ params: ChapterIdParams }), async (req, res, next) => {
  try {
    const id: string = req.params.id as string;
    const dbUserId = await resolveUserId(req.user!.uid);

    const result = await unlockChapter(dbUserId, id);

    if (result.error === 'INSUFFICIENT_COINS') {
      res.status(402).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_COINS',
          message: 'Not enough coins to unlock this chapter',
          details: { balance: result.balance },
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        unlocked: result.unlocked,
        balance: result.balance,
        chapterId: id,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/chapters/:id/adjacent ────────────────────
// Returns prev/next chapter IDs for navigation.

chaptersRouter.get('/:id/adjacent', async (req, res, next) => {
  try {
    const id: string = req.params.id as string;

    const chapter = await prisma.chapter.findUnique({
      where: { id },
      select: { id: true, number: true, titleId: true },
    });

    if (!chapter) throw new NotFoundError('Chapter', id);

    const [prev, next] = await Promise.all([
      prisma.chapter.findFirst({
        where: { titleId: chapter.titleId, number: { lt: chapter.number } },
        orderBy: { number: 'desc' },
        select: { id: true, number: true },
      }),
      prisma.chapter.findFirst({
        where: { titleId: chapter.titleId, number: { gt: chapter.number } },
        orderBy: { number: 'asc' },
        select: { id: true, number: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        prevChapter: prev ? { id: prev.id, number: prev.number } : null,
        nextChapter: next ? { id: next.id, number: next.number } : null,
      },
    });
  } catch (err) {
    next(err);
  }
});
