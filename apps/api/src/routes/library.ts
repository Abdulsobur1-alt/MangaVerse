import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import { checkAndAwardAchievements } from '../services/achievements.js';

export const libraryRouter = Router();

libraryRouter.use(requireAuth);

// ─── Schemas ──────────────────────────────────────────

const AddBookmarkSchema = z.object({
  titleId: z.string().uuid(),
  listName: z.string().min(1).max(50).default('Reading'),
});

const UpdateBookmarkSchema = z.object({
  listName: z.string().min(1).max(50),
});

const ListQuerySchema = z.object({
  listName: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── GET /api/library ─────────────────────────────────

libraryRouter.get('/', validate({ query: ListQuerySchema }), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
    });
    if (!user) throw new NotFoundError('User');

    const query = req.query as unknown as z.infer<typeof ListQuerySchema>;
    const { listName, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId: user.id };
    if (listName) where.listName = listName;

    const [bookmarks, total] = await Promise.all([
      prisma.bookmark.findMany({
        where: where as any,
        include: {
          title: {
            select: {
              id: true,
              slug: true,
              title: true,
              type: true,
              coverUrl: true,
              rating: true,
              totalChapters: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bookmark.count({ where: where as any }),
    ]);

    res.json({
      success: true,
      data: { items: bookmarks, total, page, limit, hasMore: skip + bookmarks.length < total },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/library ────────────────────────────────

libraryRouter.post('/', validate({ body: AddBookmarkSchema }), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
    });
    if (!user) throw new NotFoundError('User');

    const { titleId, listName } = req.body;

    // Check title exists
    const title = await prisma.title.findUnique({ where: { id: titleId } });
    if (!title) throw new NotFoundError('Title', titleId);

    // Check for duplicate
    const existing = await prisma.bookmark.findUnique({
      where: { userId_titleId: { userId: user.id, titleId } },
    });
    if (existing) throw new ConflictError('Title is already in your library');

    const bookmark = await prisma.bookmark.create({
      data: { userId: user.id, titleId, listName },
    });

    // Check for library-related achievements (fire-and-forget)
    checkAndAwardAchievements(user.id).catch(() => {});

    res.status(201).json({ success: true, data: bookmark });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/library/:titleId ─────────────────────

libraryRouter.delete('/:titleId', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
    });
    if (!user) throw new NotFoundError('User');

    const { titleId } = req.params;

    const bookmark = await prisma.bookmark.findUnique({
      where: { userId_titleId: { userId: user.id, titleId } },
    });
    if (!bookmark) throw new NotFoundError('Bookmark');

    await prisma.bookmark.delete({
      where: { userId_titleId: { userId: user.id, titleId } },
    });

    res.json({ success: true, data: { message: 'Removed from library' } });
  } catch (err) {
    next(err);
  }
});
