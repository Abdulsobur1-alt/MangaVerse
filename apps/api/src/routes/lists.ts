import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../lib/errors.js';
import { resolveUserId } from '../services/coins.js';

export const listsRouter = Router();

// ─── Schemas ──────────────────────────────────────────

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['popular', 'newest']).default('popular'),
  search: z.string().trim().max(120).optional(),
  userId: z.string().uuid().optional(),
});

const CreateListSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(15).optional(),
  coverUrl: z.string().url().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
});

const UpdateListSchema = CreateListSchema.partial();

const ListParams = z.object({ id: z.string().uuid() });

const AddItemSchema = z.object({
  titleId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

const ItemParams = z.object({ id: z.string().uuid(), titleId: z.string().uuid() });

// ─── Helpers ──────────────────────────────────────────

const LIST_INCLUDE = {
  user: { select: { id: true, displayName: true, avatarUrl: true } },
  items: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: {
      title: {
        select: { id: true, slug: true, title: true, type: true, coverUrl: true, rating: true, totalChapters: true },
      },
    },
  },
  _count: { select: { likes: true } },
} satisfies Prisma.UserListInclude;

type ListWithItems = Prisma.UserListGetPayload<{ include: typeof LIST_INCLUDE }>;

async function getListOrThrow(id: string, allowPrivate: boolean): Promise<ListWithItems | null> {
  const list = await prisma.userList.findUnique({ where: { id }, include: LIST_INCLUDE });
  if (!list) throw new NotFoundError('List', id);
  if (!list.isPublic && !allowPrivate) throw new ForbiddenError('This list is private');
  return list;
}

async function resolveViewer(req: any): Promise<string | null> {
  if (!req.user?.uid) return null;
  try {
    return await resolveUserId(req.user.uid);
  } catch {
    return null;
  }
}

// ─── GET /api/lists ───────────────────────────────────
// Browse public lists (community), with the viewer's like-state merged.

listsRouter.get('/', optionalAuth, validate({ query: ListQuerySchema }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof ListQuerySchema>;
    const { page, limit, sort, search, userId } = query;
    const skip = (page - 1) * limit;

    const viewerId = await resolveViewer(req);
    // Public lists; a user's own lists are visible to them even when private.
    const where: Record<string, unknown> = userId
      ? { userId, ...(userId === viewerId ? {} : { isPublic: true }) }
      : { isPublic: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { tags: { has: search } },
      ];
    }

    const [lists, total] = await Promise.all([
      prisma.userList.findMany({
        where: where as any,
        orderBy: sort === 'popular' ? { likeCount: 'desc' } : { createdAt: 'desc' },
        skip,
        take: limit,
        include: LIST_INCLUDE,
      }),
      prisma.userList.count({ where: where as any }),
    ]);

    let likedIds = new Set<string>();
    if (viewerId) {
      const likes = await prisma.userListLike.findMany({
        where: { userId: viewerId, listId: { in: lists.map((l) => l.id) } },
        select: { listId: true },
      });
      likedIds = new Set(likes.map((l) => l.listId));
    }

    res.json({
      success: true,
      data: {
        items: lists.map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          tags: l.tags,
          coverUrl: l.coverUrl,
          likeCount: l.likeCount,
          viewCount: l.viewCount,
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
          user: l.user,
          itemCount: l.items.length,
          liked: likedIds.has(l.id),
          cover: l.items.find((i) => i.title.coverUrl)?.title.coverUrl ?? null,
        })),
        total,
        page,
        limit,
        hasMore: skip + lists.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/lists/mine ──────────────────────────────

listsRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const me = await resolveUserId(req.user!.uid);
    const lists = await prisma.userList.findMany({
      where: { userId: me },
      orderBy: { createdAt: 'desc' },
      include: LIST_INCLUDE,
    });
    res.json({
      success: true,
      data: lists.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        tags: l.tags,
        coverUrl: l.coverUrl,
        isPublic: l.isPublic,
        likeCount: l.likeCount,
        viewCount: l.viewCount,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        itemCount: l.items.length,
        liked: false,
        cover: l.items.find((i) => i.title.coverUrl)?.title.coverUrl ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/lists ──────────────────────────────────

listsRouter.post('/', requireAuth, validate({ body: CreateListSchema }), async (req, res, next) => {
  try {
    const me = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof CreateListSchema>;

    const list = await prisma.userList.create({
      data: {
        userId: me,
        name: body.name,
        description: body.description ?? null,
        tags: body.tags ?? [],
        coverUrl: body.coverUrl ?? null,
        isPublic: body.isPublic ?? true,
      },
    });
    res.status(201).json({ success: true, data: { id: list.id, name: list.name, isPublic: list.isPublic } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/lists/:id ───────────────────────────────
// Detail with items + like-state. Private lists are 403 unless owner.

listsRouter.get('/:id', optionalAuth, validate({ params: ListParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const viewerId = await resolveViewer(req);

    const list = await prisma.userList.findUnique({ where: { id }, include: LIST_INCLUDE });
    if (!list) throw new NotFoundError('List', id);
    if (!list.isPublic && list.userId !== viewerId) throw new ForbiddenError('This list is private');

    // Fire-and-forget view increment (only for non-owners)
    if (list.userId !== viewerId) {
      prisma.userList.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
    }

    const liked = viewerId
      ? !!(await prisma.userListLike.findUnique({
          where: { listId_userId: { listId: id, userId: viewerId } },
          select: { id: true },
        }))
      : false;

    res.json({
      success: true,
      data: {
        id: list.id,
        name: list.name,
        description: list.description,
        tags: list.tags,
        coverUrl: list.coverUrl,
        isPublic: list.isPublic,
        likeCount: list.likeCount,
        viewCount: list.viewCount,
        createdAt: list.createdAt.toISOString(),
        updatedAt: list.updatedAt.toISOString(),
        user: list.user,
        owner: list.userId === viewerId,
        liked,
        items: list.items.map((i) => ({
          id: i.id,
          note: i.note,
          sortOrder: i.sortOrder,
          addedAt: i.createdAt.toISOString(),
          title: i.title,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/lists/:id ─────────────────────────────

listsRouter.patch('/:id', requireAuth, validate({ params: ListParams, body: UpdateListSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const me = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof UpdateListSchema>;

    const list = await prisma.userList.findUnique({ where: { id }, select: { userId: true } });
    if (!list) throw new NotFoundError('List', id);
    if (list.userId !== me) throw new ForbiddenError();

    const updated = await prisma.userList.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.coverUrl !== undefined && { coverUrl: body.coverUrl }),
        ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
      },
    });
    res.json({ success: true, data: { id: updated.id, name: updated.name, isPublic: updated.isPublic } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/lists/:id ────────────────────────────

listsRouter.delete('/:id', requireAuth, validate({ params: ListParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const me = await resolveUserId(req.user!.uid);

    const list = await prisma.userList.findUnique({ where: { id }, select: { userId: true } });
    if (!list) throw new NotFoundError('List', id);
    if (list.userId !== me) throw new ForbiddenError();

    await prisma.userList.delete({ where: { id } });
    res.json({ success: true, data: { message: 'List deleted' } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/lists/:id/items ────────────────────────
// Add a title to the list (owner only). Duplicates → 409.

listsRouter.post('/:id/items', requireAuth, validate({ params: ListParams, body: AddItemSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const me = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof AddItemSchema>;

    const list = await prisma.userList.findUnique({ where: { id }, select: { userId: true } });
    if (!list) throw new NotFoundError('List', id);
    if (list.userId !== me) throw new ForbiddenError();

    const title = await prisma.title.findUnique({ where: { id: body.titleId }, select: { id: true } });
    if (!title) throw new NotFoundError('Title', body.titleId);

    try {
      const item = await prisma.userListItem.create({
        data: { listId: id, titleId: body.titleId, note: body.note ?? null },
        include: {
          title: {
            select: { id: true, slug: true, title: true, type: true, coverUrl: true, rating: true, totalChapters: true },
          },
        },
      });
      res.status(201).json({
        success: true,
        data: { id: item.id, note: item.note, sortOrder: item.sortOrder, addedAt: item.createdAt.toISOString(), title: item.title },
      });
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') throw new ConflictError('That title is already in this list');
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/lists/:id/items/:titleId ─────────────

listsRouter.delete('/:id/items/:titleId', requireAuth, validate({ params: ItemParams }), async (req, res, next) => {
  try {
    const { id, titleId } = req.params as z.infer<typeof ItemParams>;
    const me = await resolveUserId(req.user!.uid);

    const list = await prisma.userList.findUnique({ where: { id }, select: { userId: true } });
    if (!list) throw new NotFoundError('List', id);
    if (list.userId !== me) throw new ForbiddenError();

    await prisma.userListItem.deleteMany({ where: { listId: id, titleId } });
    res.json({ success: true, data: { removed: true } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/lists/:id/like ─────────────────────────
// Toggle the viewer's like on a list. likeCount stays in sync atomically.

listsRouter.post('/:id/like', requireAuth, validate({ params: ListParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const me = await resolveUserId(req.user!.uid);

    const list = await prisma.userList.findUnique({
      where: { id },
      select: { id: true, userId: true, isPublic: true, likeCount: true },
    });
    if (!list) throw new NotFoundError('List', id);
    if (!list.isPublic && list.userId !== me) throw new ForbiddenError('This list is private');
    if (list.userId === me) throw new ConflictError('You cannot like your own list');

    const existing = await prisma.userListLike.findUnique({
      where: { listId_userId: { listId: id, userId: me } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.userListLike.delete({ where: { id: existing.id } }),
        prisma.userList.update({ where: { id }, data: { likeCount: { decrement: 1 } } }),
      ]);
      res.json({ success: true, data: { liked: false, likeCount: Math.max(0, list.likeCount - 1) } });
      return;
    }

    await prisma.$transaction([
      prisma.userListLike.create({ data: { listId: id, userId: me } }),
      prisma.userList.update({ where: { id }, data: { likeCount: { increment: 1 } } }),
    ]);
    res.json({ success: true, data: { liked: true, likeCount: list.likeCount + 1 } });
  } catch (err) {
    next(err);
  }
});
