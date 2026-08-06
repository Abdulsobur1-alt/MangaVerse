import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';
import { resolveUserId } from '../services/coins.js';

export const bookmarksRouter = Router();

bookmarksRouter.use(requireAuth);

// ─── Schemas ──────────────────────────────────────────

const ListQuerySchema = z.object({
  folder: z.string().trim().max(60).optional(),
  tag: z.string().trim().max(40).optional(),
  chapterId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const CreateBookmarkSchema = z.object({
  titleId: z.string().uuid(),
  chapterId: z.string().uuid(),
  pageNumber: z.number().int().min(0).max(100000),
  quote: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(5000).optional(),
  folder: z.string().trim().max(60).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
});

const UpdateBookmarkSchema = z.object({
  pageNumber: z.number().int().min(0).max(100000).optional(),
  quote: z.string().trim().max(2000).nullable().optional(),
  note: z.string().trim().max(5000).nullable().optional(),
  folder: z.string().trim().max(60).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
});

const BookmarkParams = z.object({ id: z.string().uuid() });

// ─── GET /api/bookmarks ───────────────────────────────
// List the viewer's page bookmarks, newest first, with optional
// folder / tag / text filters. Also returns the folder + tag index
// so the UI can render filter chips in one round trip.

bookmarksRouter.get('/', validate({ query: ListQuerySchema }), async (req, res, next) => {
  try {
    const dbUserId = await resolveUserId(req.user!.uid);
    const query = req.query as unknown as z.infer<typeof ListQuerySchema>;
    const { folder, tag, chapterId, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId: dbUserId };
    if (folder) where.folder = folder;
    if (tag) where.tags = { has: tag };
    if (chapterId) where.chapterId = chapterId;
    if (search) {
      where.OR = [
        { quote: { contains: search, mode: 'insensitive' as const } },
        { note: { contains: search, mode: 'insensitive' as const } },
        { folder: { contains: search, mode: 'insensitive' as const } },
        { tags: { has: search } },
        { chapter: { title: { contains: search, mode: 'insensitive' as const } } },
        { title: { title: { contains: search, mode: 'insensitive' as const } } },
      ];
    }

    const [items, total, all] = await Promise.all([
      prisma.pageBookmark.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          title: { select: { id: true, slug: true, title: true, coverUrl: true, type: true } },
          chapter: { select: { id: true, number: true, title: true } },
        },
      }),
      prisma.pageBookmark.count({ where: where as any }),
      // Full (unfiltered) set — cheap enough for personal bookmark counts.
      prisma.pageBookmark.findMany({
        where: { userId: dbUserId },
        select: { folder: true, tags: true },
      }),
    ]);

    const folderCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    for (const b of all) {
      if (b.folder) folderCounts.set(b.folder, (folderCounts.get(b.folder) ?? 0) + 1);
      for (const t of b.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }

    res.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        hasMore: skip + items.length < total,
        folders: [...folderCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        tags: [...tagCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/bookmarks ──────────────────────────────
// Create a page bookmark. The chapter must belong to the given title.

bookmarksRouter.post('/', validate({ body: CreateBookmarkSchema }), async (req, res, next) => {
  try {
    const dbUserId = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof CreateBookmarkSchema>;

    const chapter = await prisma.chapter.findUnique({
      where: { id: body.chapterId },
      select: { id: true, titleId: true },
    });
    if (!chapter) throw new NotFoundError('Chapter', body.chapterId);
    if (chapter.titleId !== body.titleId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Chapter does not belong to that title' },
      });
      return;
    }

    const bookmark = await prisma.pageBookmark.create({
      data: {
        userId: dbUserId,
        titleId: body.titleId,
        chapterId: body.chapterId,
        pageNumber: body.pageNumber,
        quote: body.quote ?? null,
        note: body.note ?? null,
        folder: body.folder ?? null,
        tags: body.tags ?? [],
      },
      include: {
        title: { select: { id: true, slug: true, title: true, coverUrl: true, type: true } },
        chapter: { select: { id: true, number: true, title: true } },
      },
    });

    res.status(201).json({ success: true, data: bookmark });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/bookmarks/:id ─────────────────────────
// Edit note / folder / tags / page / quote (owner only).

bookmarksRouter.patch('/:id', validate({ params: BookmarkParams, body: UpdateBookmarkSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const dbUserId = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof UpdateBookmarkSchema>;

    const existing = await prisma.pageBookmark.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Bookmark', id);
    if (existing.userId !== dbUserId) throw new ForbiddenError();

    const updated = await prisma.pageBookmark.update({
      where: { id },
      data: {
        ...(body.pageNumber !== undefined && { pageNumber: body.pageNumber }),
        ...(body.quote !== undefined && { quote: body.quote }),
        ...(body.note !== undefined && { note: body.note }),
        ...(body.folder !== undefined && { folder: body.folder }),
        ...(body.tags !== undefined && { tags: body.tags }),
      },
      include: {
        title: { select: { id: true, slug: true, title: true, coverUrl: true, type: true } },
        chapter: { select: { id: true, number: true, title: true } },
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/bookmarks/:id ────────────────────────
// Remove a page bookmark (owner only).

bookmarksRouter.delete('/:id', validate({ params: BookmarkParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const dbUserId = await resolveUserId(req.user!.uid);

    const existing = await prisma.pageBookmark.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Bookmark', id);
    if (existing.userId !== dbUserId) throw new ForbiddenError();

    await prisma.pageBookmark.delete({ where: { id } });
    res.json({ success: true, data: { message: 'Bookmark removed' } });
  } catch (err) {
    next(err);
  }
});
