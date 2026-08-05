import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';

/* ═══════════════════════════════════════════════════════════════
   Collections — user-curated shelves beyond the five default lists.
   • Full CRUD on collections (name / description / tags / privacy)
   • Items are (collectionId, titleId) unique — idempotent adds
   • Cover previews derived from first item, counts from item queries
   ═══════════════════════════════════════════════════════════════ */

export const collectionsRouter = Router();

collectionsRouter.use(requireAuth);

// ─── Schemas ──────────────────────────────────────────

const CreateCollectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  coverUrl: z.string().url().max(500).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  isPrivate: z.boolean().optional(),
});

const UpdateCollectionSchema = CreateCollectionSchema.partial();

const AddItemSchema = z.object({
  titleId: z.string().uuid(),
  note: z.string().trim().max(300).nullable().optional(),
});

const ReorderSchema = z.object({
  titleIds: z.array(z.string().uuid()).max(500),
});

// ─── Helpers ──────────────────────────────────────────

/** Fetch one collection scoped to the user (404 for other users' rows). */
async function getOwnedCollection(collectionId: string, userId: string) {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
  });
  if (!collection) throw new NotFoundError('Collection');
  return collection;
}

/** Resolve the authed user's DB row to an id. */
async function getUserId(firebaseUid: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { firebaseUid },
    select: { id: true },
  });
  if (!user) throw new NotFoundError('User');
  return user.id;
}

// ─── GET /api/collections ─────────────────────────────
// List the user's collections with item counts + a cover preview
// (the cover of the first-added item) for card collages.

collectionsRouter.get('/', async (req, res, next) => {
  try {
    const userId = await getUserId(req.user!.uid);

    const collections = await prisma.collection.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { title: { select: { coverUrl: true } } },
        },
      },
    });

    const items = await prisma.collectionItem.groupBy({
      by: ['collectionId'],
      where: { collectionId: { in: collections.map((c) => c.id) } },
      _count: { _all: true },
    });
    const countMap = new Map(items.map((i) => [i.collectionId, i._count._all]));

    res.json({
      success: true,
      data: collections.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        coverUrl: c.coverUrl,
        tags: c.tags,
        isPrivate: c.isPrivate,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        itemCount: countMap.get(c.id) ?? 0,
        cover: c.items[0]?.title.coverUrl ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/collections/:id ─────────────────────────

collectionsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const userId = await getUserId(req.user!.uid);

    const collection = await prisma.collection.findFirst({
      where: { id, userId },
      include: {
        items: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          include: {
            title: {
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
            },
          },
        },
      },
    });
    if (!collection) throw new NotFoundError('Collection');

    res.json({
      success: true,
      data: {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        coverUrl: collection.coverUrl,
        tags: collection.tags,
        isPrivate: collection.isPrivate,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
        items: collection.items.map((item) => ({
          id: item.id,
          collectionId: item.collectionId,
          titleId: item.titleId,
          note: item.note,
          sortOrder: item.sortOrder,
          createdAt: item.createdAt.toISOString(),
          title: item.title,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/collections ────────────────────────────

collectionsRouter.post('/', validate({ body: CreateCollectionSchema }), async (req, res, next) => {
  try {
    const userId = await getUserId(req.user!.uid);

    const body = req.body as z.infer<typeof CreateCollectionSchema>;
    const collection = await prisma.collection.create({
      data: {
        userId,
        name: body.name,
        description: body.description ?? null,
        coverUrl: body.coverUrl ?? null,
        tags: body.tags ?? [],
        isPrivate: body.isPrivate ?? true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        coverUrl: collection.coverUrl,
        tags: collection.tags,
        isPrivate: collection.isPrivate,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
        itemCount: 0,
        cover: null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/collections/:id ───────────────────────

collectionsRouter.patch('/:id', validate({ body: UpdateCollectionSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const userId = await getUserId(req.user!.uid);
    await getOwnedCollection(id, userId);

    const body = req.body as z.infer<typeof UpdateCollectionSchema>;
    const [updated, itemCount] = await Promise.all([
      prisma.collection.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description ?? null } : {}),
          ...(body.coverUrl !== undefined ? { coverUrl: body.coverUrl ?? null } : {}),
          ...(body.tags !== undefined ? { tags: body.tags } : {}),
          ...(body.isPrivate !== undefined ? { isPrivate: body.isPrivate } : {}),
        },
      }),
      prisma.collectionItem.count({ where: { collectionId: id } }),
    ]);

    res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        coverUrl: updated.coverUrl,
        tags: updated.tags,
        isPrivate: updated.isPrivate,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        itemCount,
        cover: null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/collections/:id ──────────────────────

collectionsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const userId = await getUserId(req.user!.uid);
    await getOwnedCollection(id, userId);

    await prisma.collection.delete({ where: { id } });

    res.json({ success: true, data: { message: 'Collection deleted' } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/collections/:id/items ──────────────────
// Add a title to a collection. Idempotent — re-adding returns the
// existing row (200) instead of a 409, since shelves are about intent.

collectionsRouter.post('/:id/items', validate({ body: AddItemSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const userId = await getUserId(req.user!.uid);
    await getOwnedCollection(id, userId);

    const { titleId, note } = req.body as z.infer<typeof AddItemSchema>;

    const title = await prisma.title.findUnique({ where: { id: titleId }, select: { id: true } });
    if (!title) throw new NotFoundError('Title', titleId);

    const existing = await prisma.collectionItem.findUnique({
      where: { collectionId_titleId: { collectionId: id, titleId } },
      include: {
        title: {
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
        },
      },
    });
    if (existing) {
      res.json({
        success: true,
        data: {
          id: existing.id,
          collectionId: existing.collectionId,
          titleId: existing.titleId,
          note: note ?? existing.note,
          sortOrder: existing.sortOrder,
          createdAt: existing.createdAt.toISOString(),
          title: existing.title,
        },
      });
      return;
    }

    const maxSort = await prisma.collectionItem.aggregate({
      where: { collectionId: id },
      _max: { sortOrder: true },
    });

    const item = await prisma.collectionItem.create({
      data: {
        collectionId: id,
        titleId,
        note: note ?? null,
        sortOrder: (maxSort._max?.sortOrder ?? -1) + 1,
      },
      include: {
        title: {
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
        },
      },
    });

    // Touch the collection so it floats to the top of the list.
    await prisma.collection.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({
      success: true,
      data: {
        id: item.id,
        collectionId: item.collectionId,
        titleId: item.titleId,
        note: item.note,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
        title: item.title,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/collections/:id/items ─────────────────
// Reorder items by passing the desired titleId order.

collectionsRouter.patch('/:id/items', validate({ body: ReorderSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const userId = await getUserId(req.user!.uid);
    await getOwnedCollection(id, userId);

    const { titleIds } = req.body as z.infer<typeof ReorderSchema>;

    // Verify every title is actually in this collection (no silent drops).
    const existing = await prisma.collectionItem.findMany({
      where: { collectionId: id, titleId: { in: titleIds } },
      select: { titleId: true },
    });
    if (existing.length !== titleIds.length) {
      throw new ConflictError('Some titles are not in this collection');
    }

    await prisma.$transaction(
      titleIds.map((titleId, idx) =>
        prisma.collectionItem.updateMany({
          where: { collectionId: id, titleId },
          data: { sortOrder: idx },
        }),
      ),
    );

    await prisma.collection.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    res.json({ success: true, data: { message: 'Collection reordered' } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/collections/:id/items/:titleId ───────

collectionsRouter.delete('/:id/items/:titleId', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const titleId = req.params.titleId as string;
    const userId = await getUserId(req.user!.uid);
    await getOwnedCollection(id, userId);

    const item = await prisma.collectionItem.findUnique({
      where: { collectionId_titleId: { collectionId: id, titleId } },
    });
    if (!item) throw new NotFoundError('Collection item');

    await prisma.collectionItem.delete({
      where: { collectionId_titleId: { collectionId: id, titleId } },
    });

    res.json({ success: true, data: { message: 'Removed from collection' } });
  } catch (err) {
    next(err);
  }
});
