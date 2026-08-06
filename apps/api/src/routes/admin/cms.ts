import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { NotFoundError } from '../../lib/errors.js';
import { requirePermission } from '../../services/rbac.js';
import { logAudit } from '../../services/audit.js';
import { meilisearch } from '../../services/meilisearch.js';

/* ═══════════════════════════════════════════════════════════════
   Admin CMS — titles & chapters management, content versioning
   (ContentRevision), and editorial picks (featured content).
   Every write records a ContentRevision (for preview/rollback) and
   an AuditLog row.
   ═══════════════════════════════════════════════════════════════ */

export const adminCmsRouter = Router();

// ─── Titles ────────────────────────────────────────────

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(120).optional(),
  status: z.string().max(30).optional(),
  type: z.string().max(30).optional(),
});

const IdParams = z.object({ id: z.string().uuid() });

const UpdateTitleSchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    alternativeTitles: z.string().max(1000).nullable().optional(),
    synopsis: z.string().max(20_000).nullable().optional(),
    status: z.string().max(30).optional(), // ongoing | completed | hiatus | dropped
    genres: z.array(z.string().max(40)).max(30).optional(),
    tags: z.array(z.string().max(40)).max(30).optional(),
    author: z.string().max(200).nullable().optional(),
    artist: z.string().max(200).nullable().optional(),
    coverUrl: z.string().url().max(500).nullable().optional(),
    bannerUrl: z.string().url().max(500).nullable().optional(),
    releaseYear: z.number().int().min(1900).max(2100).nullable().optional(),
    rating: z.number().min(0).max(10).nullable().optional(),
    totalChapters: z.number().int().positive().nullable().optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

async function resolveActorId(firebaseUid: string): Promise<string | null> {
  try {
    const u = await prisma.user.findUnique({ where: { firebaseUid }, select: { id: true } });
    return u?.id ?? null;
  } catch {
    return null;
  }
}

adminCmsRouter.get('/cms/titles', requirePermission('titles:read'), validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof ListQuery>;
    const skip = (q.page - 1) * q.limit;
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { slug: { contains: q.search, mode: 'insensitive' } },
        { author: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;

    const [items, total] = await Promise.all([
      prisma.title.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: q.limit,
        select: {
          id: true,
          slug: true,
          title: true,
          type: true,
          status: true,
          coverUrl: true,
          rating: true,
          totalChapters: true,
          updatedAt: true,
          _count: { select: { chapters: true, bookmarks: true, reviews: true } },
        },
      }),
      prisma.title.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map((t) => ({
          id: t.id,
          slug: t.slug,
          title: t.title,
          type: t.type,
          status: t.status,
          coverUrl: t.coverUrl,
          rating: t.rating,
          totalChapters: t.totalChapters,
          chapters: t._count.chapters,
          saves: t._count.bookmarks,
          reviews: t._count.reviews,
          updatedAt: t.updatedAt.toISOString(),
        })),
        total,
        page: q.page,
        limit: q.limit,
        hasMore: skip + items.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

adminCmsRouter.get('/cms/titles/:id', requirePermission('titles:read'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const title = await prisma.title.findUnique({
      where: { id },
      include: { _count: { select: { chapters: true, bookmarks: true, reviews: true } } },
    });
    if (!title) throw new NotFoundError('Title', id);
    res.json({ success: true, data: title });
  } catch (err) {
    next(err);
  }
});

// Update + revision + audit + reindex
adminCmsRouter.patch('/cms/titles/:id', requirePermission('titles:update'), validate({ params: IdParams, body: UpdateTitleSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof UpdateTitleSchema>;

    const existing = await prisma.title.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Title', id);

    const data: Record<string, unknown> = {};
    const fields: (keyof z.infer<typeof UpdateTitleSchema>)[] = [
      'title', 'alternativeTitles', 'synopsis', 'status', 'genres', 'tags',
      'author', 'artist', 'coverUrl', 'bannerUrl', 'releaseYear', 'rating', 'totalChapters',
    ];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f] as never;
    }

    const updated = await prisma.title.update({
      where: { id },
      data: data as never,
      select: { id: true, slug: true, title: true, status: true, updatedAt: true },
    });

    // Version history — full snapshot after the change (version = count+1).
    const versionCount = await prisma.contentRevision.count({
      where: { entityType: 'title', entityId: id },
    });
    await prisma.contentRevision.create({
      data: {
        entityType: 'title',
        entityId: id,
        version: versionCount + 1,
        data: { ...existing, ...data } as never,
        note: body.note ?? null,
        actorId: await resolveActorId(req.user!.uid),
      },
    });

    const actorId = await resolveActorId(req.user!.uid);
    await logAudit({
      actorId,
      action: 'title.update',
      resource: 'title',
      resourceId: id,
      details: { status: body.status ?? existing.status },
      ip: req.ip,
    });

    // Keep search in sync (best-effort).
    const fresh = await prisma.title.findUnique({ where: { id } });
    if (fresh) {
      void meilisearch.upsertTitle({
        id: fresh.id,
        slug: fresh.slug,
        title: fresh.title,
        alternativeTitles: fresh.alternativeTitles,
        type: fresh.type,
        genres: fresh.genres,
        tags: fresh.tags,
        author: fresh.author,
        artist: fresh.artist,
        synopsis: fresh.synopsis,
        rating: fresh.rating,
        totalChapters: fresh.totalChapters,
        coverUrl: fresh.coverUrl,
        status: fresh.status,
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Publish gate — flips status + records the publish event.
adminCmsRouter.post('/cms/titles/:id/publish', requirePermission('titles:publish'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const title = await prisma.title.findUnique({ where: { id }, select: { id: true, slug: true, status: true } });
    if (!title) throw new NotFoundError('Title', id);

    const updated = await prisma.title.update({
      where: { id },
      data: { status: 'ongoing' },
      select: { id: true, slug: true, status: true },
    });

    const actorId = await resolveActorId(req.user!.uid);
    await logAudit({
      actorId,
      action: 'title.publish',
      resource: 'title',
      resourceId: id,
      details: { from: title.status, to: 'ongoing' },
      ip: req.ip,
    });

    // Keep search in sync with the real, freshly-updated record.
    const fresh = await prisma.title.findUnique({ where: { id } });
    if (fresh) {
      void meilisearch.upsertTitle({
        id: fresh.id,
        slug: fresh.slug,
        title: fresh.title,
        alternativeTitles: fresh.alternativeTitles,
        type: fresh.type,
        genres: fresh.genres,
        tags: fresh.tags,
        author: fresh.author,
        artist: fresh.artist,
        synopsis: fresh.synopsis,
        rating: fresh.rating,
        totalChapters: fresh.totalChapters,
        coverUrl: fresh.coverUrl,
        status: fresh.status,
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Reindex one title into Meilisearch.
adminCmsRouter.post('/cms/titles/:id/reindex', requirePermission('titles:update'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const title = await prisma.title.findUnique({ where: { id } });
    if (!title) throw new NotFoundError('Title', id);
    await meilisearch.upsertTitle({
      id: title.id,
      slug: title.slug,
      title: title.title,
      alternativeTitles: title.alternativeTitles,
      type: title.type,
      genres: title.genres,
      tags: title.tags,
      author: title.author,
      artist: title.artist,
      synopsis: title.synopsis,
      rating: title.rating,
      totalChapters: title.totalChapters,
      coverUrl: title.coverUrl,
      status: title.status,
    });
    res.json({ success: true, data: { reindexed: true, slug: title.slug } });
  } catch (err) {
    next(err);
  }
});

// ─── Chapters ──────────────────────────────────────────

adminCmsRouter.get('/cms/titles/:id/chapters', requirePermission('chapters:read'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const title = await prisma.title.findUnique({ where: { id }, select: { id: true } });
    if (!title) throw new NotFoundError('Title', id);

    const chapters = await prisma.chapter.findMany({
      where: { titleId: id },
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        title: true,
        pageCount: true,
        coinLocked: true,
        freeAt: true,
        createdAt: true,
      },
    });
    res.json({
      success: true,
      data: chapters.map((c) => ({
        ...c,
        freeAt: c.freeAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

const UpdateChapterSchema = z.object({
  title: z.string().max(300).nullable().optional(),
  pageCount: z.number().int().positive().nullable().optional(),
  coinLocked: z.boolean().optional(),
  freeAt: z.string().datetime().nullable().optional(),
  contentText: z.string().max(200_000).nullable().optional(),
  note: z.string().max(500).optional(),
});

adminCmsRouter.patch('/cms/chapters/:id', requirePermission('chapters:update'), validate({ params: IdParams, body: UpdateChapterSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof UpdateChapterSchema>;

    const existing = await prisma.chapter.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Chapter', id);

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.pageCount !== undefined) data.pageCount = body.pageCount;
    if (body.coinLocked !== undefined) data.coinLocked = body.coinLocked;
    if (body.freeAt !== undefined) data.freeAt = body.freeAt ? new Date(body.freeAt) : null;
    if (body.contentText !== undefined) data.contentText = body.contentText;

    const updated = await prisma.chapter.update({
      where: { id },
      data: data as never,
      select: { id: true, number: true, title: true, coinLocked: true },
    });

    const versionCount = await prisma.contentRevision.count({
      where: { entityType: 'chapter', entityId: id },
    });
    await prisma.contentRevision.create({
      data: {
        entityType: 'chapter',
        entityId: id,
        version: versionCount + 1,
        data: { ...existing, ...data } as never,
        note: body.note ?? null,
        actorId: await resolveActorId(req.user!.uid),
      },
    });

    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'chapter.update',
      resource: 'chapter',
      resourceId: id,
      details: { number: existing.number },
      ip: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── Content revisions ────────────────────────────────

const RevisionsQuery = z.object({
  entityType: z.enum(['title', 'chapter', 'editorial_pick']).default('title'),
  entityId: z.string().uuid(),
});

adminCmsRouter.get('/cms/revisions', requirePermission('titles:read'), validate({ query: RevisionsQuery }), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof RevisionsQuery>;
    const revisions = await prisma.contentRevision.findMany({
      where: { entityType: q.entityType, entityId: q.entityId },
      orderBy: { version: 'desc' },
      take: 50,
      include: { actor: { select: { displayName: true } } },
    });
    res.json({
      success: true,
      data: revisions.map((r) => ({
        id: r.id,
        version: r.version,
        note: r.note,
        actorName: r.actor?.displayName ?? 'system',
        createdAt: r.createdAt.toISOString(),
        changedKeys: r.data ? Object.keys(r.data as Record<string, unknown>).slice(0, 12) : [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminCmsRouter.post('/cms/revisions/:id/rollback', requirePermission('titles:update'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const revision = await prisma.contentRevision.findUnique({ where: { id } });
    if (!revision) throw new NotFoundError('ContentRevision', id);

    const snapshot = revision.data as Record<string, unknown>;
    const { entityType, entityId } = revision;

    if (entityType === 'title') {
      const current = await prisma.title.findUnique({ where: { id: entityId }, select: { id: true } });
      if (!current) throw new NotFoundError('Title', entityId);
      const patch: Record<string, unknown> = {};
      for (const key of ['title', 'alternativeTitles', 'synopsis', 'status', 'genres', 'tags', 'author', 'artist', 'coverUrl', 'bannerUrl', 'releaseYear']) {
        if (key in snapshot) patch[key] = snapshot[key] as never;
      }
      await prisma.title.update({ where: { id: entityId }, data: patch as never });
    } else if (entityType === 'chapter') {
      const current = await prisma.chapter.findUnique({ where: { id: entityId }, select: { id: true } });
      if (!current) throw new NotFoundError('Chapter', entityId);
      const patch: Record<string, unknown> = {};
      for (const key of ['title', 'pageCount', 'coinLocked', 'freeAt', 'contentText']) {
        if (key in snapshot) patch[key] = snapshot[key] as never;
      }
      await prisma.chapter.update({ where: { id: entityId }, data: patch as never });
    } else {
      throw new NotFoundError('Rollback target', entityType);
    }

    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'content.rollback',
      resource: entityType,
      resourceId: entityId,
      details: { version: revision.version },
      ip: req.ip,
    });

    res.json({ success: true, data: { rolledBack: true, entityType, entityId, version: revision.version } });
  } catch (err) {
    next(err);
  }
});

// ─── Editorial picks ───────────────────────────────────

const PickSchema = z.object({
  titleId: z.string().uuid(),
  position: z.number().int().min(0).default(0),
  label: z.string().max(80).nullable().optional(),
  active: z.boolean().default(true),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

adminCmsRouter.get('/cms/picks', requirePermission('picks:read'), async (_req, res, next) => {
  try {
    const picks = await prisma.editorialPick.findMany({
      orderBy: [{ active: 'desc' }, { position: 'asc' }],
      take: 100,
      include: {
        title: { select: { id: true, slug: true, title: true, coverUrl: true, type: true } },
        createdBy: { select: { displayName: true } },
      },
    });
    res.json({
      success: true,
      data: picks.map((p) => ({
        id: p.id,
        position: p.position,
        label: p.label,
        active: p.active,
        startsAt: p.startsAt?.toISOString() ?? null,
        endsAt: p.endsAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        title: p.title,
        createdByName: p.createdBy?.displayName ?? 'system',
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminCmsRouter.post('/cms/picks', requirePermission('picks:update'), validate({ body: PickSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof PickSchema>;
    const title = await prisma.title.findUnique({ where: { id: body.titleId }, select: { id: true } });
    if (!title) throw new NotFoundError('Title', body.titleId);

    const pick = await prisma.editorialPick.create({
      data: {
        titleId: body.titleId,
        position: body.position,
        label: body.label ?? null,
        active: body.active,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        createdById: await resolveActorId(req.user!.uid),
      },
    });

    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'pick.create',
      resource: 'editorial_pick',
      resourceId: pick.id,
      details: { titleId: body.titleId, position: body.position },
      ip: req.ip,
    });

    res.status(201).json({ success: true, data: pick });
  } catch (err) {
    next(err);
  }
});

adminCmsRouter.patch('/cms/picks/:id', requirePermission('picks:update'), validate({ params: IdParams, body: PickSchema.partial() }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as Partial<z.infer<typeof PickSchema>>;
    const pick = await prisma.editorialPick.findUnique({ where: { id }, select: { id: true } });
    if (!pick) throw new NotFoundError('EditorialPick', id);

    const data: Record<string, unknown> = {};
    if (body.position !== undefined) data.position = body.position;
    if (body.label !== undefined) data.label = body.label;
    if (body.active !== undefined) data.active = body.active;
    if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;

    const updated = await prisma.editorialPick.update({ where: { id }, data: data as never });
    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'pick.update',
      resource: 'editorial_pick',
      resourceId: id,
      details: { active: body.active },
      ip: req.ip,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

adminCmsRouter.delete('/cms/picks/:id', requirePermission('picks:update'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await prisma.editorialPick.deleteMany({ where: { id } });
    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'pick.delete',
      resource: 'editorial_pick',
      resourceId: id,
      ip: req.ip,
    });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
});
