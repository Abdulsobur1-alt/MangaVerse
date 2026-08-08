import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { NotFoundError } from '../../lib/errors.js';
import { requirePermission } from '../../services/rbac.js';
import { logAudit } from '../../services/audit.js';
import { meilisearch } from '../../services/meilisearch.js';
import { uploadImage } from '../../services/uploads.js';

/* ═══════════════════════════════════════════════════════════════
   Studio — the staff content workspace (create/arrange layer).
   • POST   /studio/titles                    create a title
   • POST   /studio/titles/:id/chapters       create a chapter
   • POST   /studio/titles/:id/reorder        renumber chapters
   • DELETE /studio/titles/:id                delete a title (+ chapters)
   • DELETE /studio/chapters/:id              delete a chapter
   • POST   /studio/upload                    upload an image (Supabase Storage)
   Every write records a ContentRevision + AuditLog row, and keeps
   Meilisearch in sync — mirroring the CMS edit layer (admin/cms.ts),
   which holds the list/update/publish/revision endpoints.
   ═══════════════════════════════════════════════════════════════ */

export const adminStudioRouter = Router();

// ─── Shared helpers ───────────────────────────────────

async function resolveActorId(firebaseUid: string): Promise<string | null> {
  try {
    const u = await prisma.user.findUnique({ where: { firebaseUid }, select: { id: true } });
    return u?.id ?? null;
  } catch {
    return null;
  }
}

/** Build a unique slug from a title (appends -2, -3 … on collision). */
async function uniqueSlug(base: string): Promise<string> {
  const slug = base
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `title-${Date.now()}`;
  let candidate = slug;
  let n = 2;
  while (await prisma.title.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${slug}-${n++}`;
  }
  return candidate;
}

async function syncTotalChapters(titleId: string): Promise<number> {
  const count = await prisma.chapter.count({ where: { titleId } });
  await prisma.title.update({ where: { id: titleId }, data: { totalChapters: count } });
  return count;
}

async function upsertSearchIndex(titleId: string): Promise<void> {
  const t = await prisma.title.findUnique({ where: { id: titleId } });
  if (!t) return;
  void meilisearch.upsertTitle({
    id: t.id,
    slug: t.slug,
    title: t.title,
    alternativeTitles: t.alternativeTitles,
    type: t.type,
    genres: t.genres,
    tags: t.tags,
    author: t.author,
    artist: t.artist,
    synopsis: t.synopsis,
    rating: t.rating,
    totalChapters: t.totalChapters,
    coverUrl: t.coverUrl,
    status: t.status,
  });
}

// ─── Schemas ──────────────────────────────────────────

const IdParams = z.object({ id: z.string().uuid() });

const CreateTitleSchema = z.object({
  title: z.string().min(1).max(300),
  type: z.string().min(1).max(30).default('manga'), // manga | manhwa | manhua | light_novel | novel
  status: z.string().min(1).max(30).default('ongoing'),
  alternativeTitles: z.string().max(1000).nullable().optional(),
  synopsis: z.string().max(20_000).nullable().optional(),
  genres: z.array(z.string().max(40)).max(30).default([]),
  tags: z.array(z.string().max(40)).max(30).default([]),
  author: z.string().max(200).nullable().optional(),
  artist: z.string().max(200).nullable().optional(),
  coverUrl: z.string().url().max(500).nullable().optional(),
  bannerUrl: z.string().url().max(500).nullable().optional(),
  releaseYear: z.number().int().min(1900).max(2100).nullable().optional(),
});

const CreateChapterSchema = z.object({
  number: z.number().nonnegative(),
  title: z.string().max(300).nullable().optional(),
  // Uploaded page image URLs (staff uploads). When present, the reader
  // serves these instead of MangaDex/placeholders.
  pageUrls: z.array(z.string().max(2000)).max(500).default([]),
  contentText: z.string().max(200_000).nullable().optional(),
  coinLocked: z.boolean().default(false),
  freeAt: z.string().datetime().nullable().optional(),
});

const ReorderSchema = z.object({
  // id → new number. All chapters of the title must be included.
  order: z.array(z.object({ id: z.string().uuid(), number: z.number().nonnegative() })).min(1).max(2000),
});

/**
 * Pure validation for a chapter-reorder payload — exported for unit tests.
 * Returns a human-readable problem description, or null when the order is
 * well-formed (every chapter of the title present, no duplicates, no
 * foreign ids).
 */
export function validateReorderOrder(
  order: { id: string; number: number }[],
  existingIds: string[],
  chapterCount: number,
): string | null {
  const ids = order.map((o) => o.id);
  // Reject duplicate ids — a duplicated entry would silently corrupt the
  // arrangement (last-write-wins on the same row).
  if (new Set(ids).size !== ids.length) return 'duplicate chapter ids in order';
  // Some ids don't belong to this title — reject the whole batch.
  if (existingIds.length !== ids.length) return 'one or more ids do not belong to this title';
  // The order must cover EVERY chapter of the title — an omitted chapter
  // keeps a stale number that can collide with a new one (unique
  // constraint) or get orphaned.
  if (ids.length !== chapterCount) return `order must include all ${chapterCount} chapters of the title`;
  return null;
}

const UploadSchema = z.object({
  data: z.string().min(20).max(15_000_000), // base64 data URL
  folder: z.string().max(200).default('general'),
  name: z.string().max(120).optional(),
  type: z.enum(['image', 'banner', 'cover', 'icon']).default('image'),
  tags: z.array(z.string().max(40)).max(30).default([]),
});

// ─── POST /studio/titles — create a title ─────────────

adminStudioRouter.post('/studio/titles', requirePermission('titles:create'), validate({ body: CreateTitleSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof CreateTitleSchema>;
    const slug = await uniqueSlug(body.title);

    const created = await prisma.title.create({
      data: {
        slug,
        title: body.title,
        alternativeTitles: body.alternativeTitles ?? null,
        type: body.type,
        status: body.status,
        genres: body.genres,
        tags: body.tags,
        author: body.author ?? null,
        artist: body.artist ?? null,
        coverUrl: body.coverUrl ?? null,
        bannerUrl: body.bannerUrl ?? null,
        synopsis: body.synopsis ?? null,
        releaseYear: body.releaseYear ?? null,
      },
      select: { id: true, slug: true, title: true, type: true },
    });

    await prisma.contentRevision.create({
      data: { entityType: 'title', entityId: created.id, version: 1, data: body as never, note: 'Title created in Studio', actorId: await resolveActorId(req.user!.uid) },
    });
    await logAudit({ actorId: await resolveActorId(req.user!.uid), action: 'title.create', resource: 'title', resourceId: created.id, details: { slug }, ip: req.ip });
    void upsertSearchIndex(created.id);

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// ─── POST /studio/titles/:id/chapters — create a chapter ─

adminStudioRouter.post('/studio/titles/:id/chapters', requirePermission('chapters:create'), validate({ params: IdParams, body: CreateChapterSchema }), async (req, res, next) => {
  try {
    const { id: titleId } = req.params as unknown as z.infer<typeof IdParams>;
    const body = req.body as z.infer<typeof CreateChapterSchema>;

    const title = await prisma.title.findUnique({ where: { id: titleId }, select: { id: true } });
    if (!title) throw new NotFoundError('Title', titleId);

    const created = await prisma.chapter.create({
      data: {
        titleId,
        number: body.number,
        title: body.title ?? null,
        pageUrls: body.pageUrls,
        pageCount: body.pageUrls.length > 0 ? body.pageUrls.length : undefined,
        contentText: body.contentText ?? null,
        coinLocked: body.coinLocked,
        freeAt: body.freeAt ? new Date(body.freeAt) : null,
      },
      select: { id: true, number: true, title: true, pageCount: true },
    });

    const total = await syncTotalChapters(titleId);
    await prisma.contentRevision.create({
      data: { entityType: 'chapter', entityId: created.id, version: 1, data: body as never, note: 'Chapter created in Studio', actorId: await resolveActorId(req.user!.uid) },
    });
    await logAudit({ actorId: await resolveActorId(req.user!.uid), action: 'chapter.create', resource: 'chapter', resourceId: created.id, details: { titleId, number: body.number }, ip: req.ip });
    void upsertSearchIndex(titleId);

    res.status(201).json({ success: true, data: { ...created, totalChapters: total } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /studio/titles/:id/reorder — renumber chapters ─

adminStudioRouter.post('/studio/titles/:id/reorder', requirePermission('chapters:update'), validate({ params: IdParams, body: ReorderSchema }), async (req, res, next) => {
  try {
    const { id: titleId } = req.params as unknown as z.infer<typeof IdParams>;
    const body = req.body as z.infer<typeof ReorderSchema>;

    const title = await prisma.title.findUnique({ where: { id: titleId }, select: { id: true } });
    if (!title) throw new NotFoundError('Title', titleId);

    const existing = await prisma.chapter.findMany({ where: { titleId, id: { in: body.order.map((o) => o.id) } }, select: { id: true } });
    const chapterCount = await prisma.chapter.count({ where: { titleId } });
    const problem = validateReorderOrder(
      body.order,
      existing.map((c) => c.id),
      chapterCount,
    );
    if (problem) {
      throw new NotFoundError('Chapter', problem);
    }

    // Two-phase renumber: the (titleId, number) unique constraint makes a
    // naive single pass fail whenever two rows swap numbers (A→2 while B
    // still holds 2). First move everyone to a temporary offset (no clash),
    // then apply the final numbers.
    const OFFSET = 10_000_000;
    await prisma.$transaction([
      ...body.order.map((o, i) =>
        prisma.chapter.update({ where: { id: o.id }, data: { number: OFFSET + i } }),
      ),
      ...body.order.map((o) =>
        prisma.chapter.update({ where: { id: o.id }, data: { number: o.number } }),
      ),
    ]);

    await logAudit({ actorId: await resolveActorId(req.user!.uid), action: 'chapter.reorder', resource: 'title', resourceId: titleId, details: { count: body.order.length }, ip: req.ip });
    res.json({ success: true, data: { reordered: body.order.length, titleId } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /studio/titles/:id — delete a title ───────

adminStudioRouter.delete('/studio/titles/:id', requirePermission('titles:delete'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof IdParams>;
    const title = await prisma.title.findUnique({ where: { id }, select: { id: true, slug: true } });
    if (!title) throw new NotFoundError('Title', id);

    await prisma.title.delete({ where: { id } }); // chapters cascade
    await prisma.contentRevision.deleteMany({ where: { entityType: 'title', entityId: id } });
    void meilisearch.removeTitle(id);

    await logAudit({ actorId: await resolveActorId(req.user!.uid), action: 'title.delete', resource: 'title', resourceId: id, details: { slug: title.slug }, ip: req.ip });
    res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /studio/chapters/:id — delete a chapter ────

adminStudioRouter.delete('/studio/chapters/:id', requirePermission('chapters:delete'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as z.infer<typeof IdParams>;
    const chapter = await prisma.chapter.findUnique({ where: { id }, select: { id: true, titleId: true, number: true } });
    if (!chapter) throw new NotFoundError('Chapter', id);

    await prisma.chapter.delete({ where: { id } });
    await prisma.contentRevision.deleteMany({ where: { entityType: 'chapter', entityId: id } });
    const total = await syncTotalChapters(chapter.titleId);
    void upsertSearchIndex(chapter.titleId);

    await logAudit({ actorId: await resolveActorId(req.user!.uid), action: 'chapter.delete', resource: 'chapter', resourceId: id, details: { titleId: chapter.titleId, number: chapter.number }, ip: req.ip });
    res.json({ success: true, data: { deleted: true, id, totalChapters: total } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /studio/upload — upload an image ─────────────

adminStudioRouter.post('/studio/upload', requirePermission('media:create'), validate({ body: UploadSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof UploadSchema>;
    const uploaded = await uploadImage(body.data, body.folder, body.name);

    const asset = await prisma.mediaAsset.create({
      data: {
        url: uploaded.url,
        type: body.type,
        name: body.name ?? null,
        size: uploaded.size,
        width: uploaded.width,
        height: uploaded.height,
        tags: body.tags,
        folder: body.folder,
        createdById: await resolveActorId(req.user!.uid),
      },
    });
    await logAudit({ actorId: await resolveActorId(req.user!.uid), action: 'media.create', resource: 'media', resourceId: asset.id, details: { type: body.type, folder: body.folder }, ip: req.ip });

    res.status(201).json({ success: true, data: { url: uploaded.url, assetId: asset.id } });
  } catch (err) {
    if (err instanceof Error && /INVALID_IMAGE_DATA|UNSUPPORTED_IMAGE_TYPE|IMAGE_TOO_LARGE|UPLOAD_FAILED/.test(err.message)) {
      res.status(400).json({ success: false, error: { code: err.message, message: err.message.replace(/_/g, ' ').toLowerCase() } });
      return;
    }
    next(err);
  }
});
