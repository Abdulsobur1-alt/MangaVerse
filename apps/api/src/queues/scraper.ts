import { Queue, Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { mangadex } from '../services/mangadex.js';
import { prisma } from '../lib/prisma.js';
import { meilisearch } from '../services/meilisearch.js';
import { notifyNewChapter } from '../services/notifications.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let connection: Redis | null = null;
let scraperQueue: Queue | null = null;

async function getConnection(): Promise<Redis | null> {
  if (connection?.status === 'ready') return connection;
  // Once retryStrategy has given up, the client is permanently dead — treat
  // Redis as unavailable instead of constructing a new instance per call.
  if (connection && ['close', 'end'].includes(connection.status)) return null;
  try {
    connection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      // Bound the retry window: if Redis is down, give up after ~2.5s
      // (500ms + 1s + 1s) so the API boots anyway (workers degrade to
      // disabled) instead of hanging forever on a dead connection.
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 1000)),
    });
    // A Redis connection error must never crash the process — without an
    // 'error' listener ioredis throws and takes the whole API down with it.
    connection.on('error', (err) => {
      console.warn('⚠️  Redis connection error:', (err as Error).message);
    });

    // Probe BEFORE handing the client to BullMQ. BullMQ's internal
    // waitUntilReady() rejects when the connection closes, and that
    // rejection is unhandled — on Node 22 an unhandled rejection crashes
    // the process, killing the API before app.listen. By connecting and
    // waiting for 'ready' ourselves, we only return clients that are
    // actually up; a dead Redis yields null (graceful degradation) and
    // BullMQ never sees the dead client.
    const ready = await new Promise<boolean>((resolve) => {
      let settled = false;
      let timeout: NodeJS.Timeout | undefined;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        connection!.off('ready', onReady);
        connection!.off('end', onEnd);
        resolve(ok);
      };
      const onReady = () => finish(true);
      const onEnd = () => finish(false);
      timeout = setTimeout(() => finish(false), 5000);
      connection!.on('ready', onReady);
      connection!.on('end', onEnd);
      connection!.connect().catch(() => finish(false));
    });

    if (!ready) {
      connection = null; // reset so a later call can retry fresh
      return null;
    }
    return connection;
  } catch {
    connection = null;
    return null;
  }
}

// ─── Queue ───────────────────────────────────────────

export async function getScraperQueue(): Promise<Queue | null> {
  if (scraperQueue) return scraperQueue;
  const conn = await getConnection();
  if (!conn) {
    console.warn('⚠️  Redis not available — scraper queue disabled');
    return null;
  }
  scraperQueue = new Queue('mangaverse-scraper', {
    connection: conn,
    defaultJobOptions: config.bullmq.defaultJobOptions,
  });
  // BullMQ re-emits Redis connection errors on the Queue itself — without
  // an 'error' listener, that event throws and kills the whole process.
  scraperQueue.on('error', (err) => {
    console.warn('⚠️  Scraper queue error:', (err as Error).message);
  });
  return scraperQueue;
}

// ─── Worker ──────────────────────────────────────────

export async function startScraperWorker(): Promise<Worker | null> {
  const conn = await getConnection();
  if (!conn) return null;

  const worker = new Worker(
    'mangaverse-scraper',
    async (job) => {
      switch (job.name) {
        case 'refresh-popular':
          await refreshPopularTitles(job.data?.limit || 50);
          break;
        case 'refresh-chapters':
          await refreshChaptersForTitle(job.data?.titleId);
          break;
        case 'seed-database':
          await seedDatabase(job.data?.count || 100);
          break;
        default:
          console.warn(`Unknown job type: ${job.name}`);
      }
    },
    { connection: conn },
  );

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.name} completed (id: ${job.id})`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.name} failed:`, err.message);
  });

  // Worker-level errors (e.g. connection dropped mid-run) must not crash
  // the process either.
  worker.on('error', (err) => {
    console.warn('⚠️  Scraper worker error:', (err as Error).message);
  });

  return worker;
}

// ─── Job Handlers ────────────────────────────────────

/**
 * Refresh popular titles from MangaDex.
 */
async function refreshPopularTitles(limit: number) {
  console.log(`🔄 Refreshing popular titles (limit: ${limit})...`);

  try {
    const response = await mangadex.getPopular(limit);

    for (const manga of response.data) {
      const normalized = mangadex.normalizeTitle(manga);
      const slug = mangadex.normalizeTitle(manga).slug;

      try {
        const sourceUrl = `https://mangadex.org/title/${manga.id}`;

        await prisma.title.upsert({
          where: { slug },
          update: {
            title: normalized.title,
            type: normalized.type,
            status: normalized.status,
            genres: normalized.genres,
            tags: normalized.tags,
            author: normalized.author,
            artist: normalized.artist,
            coverUrl: normalized.coverUrl,
            synopsis: normalized.synopsis,
            releaseYear: normalized.releaseYear,
            sourceUrl,
          },
          create: {
            slug,
            title: normalized.title,
            alternativeTitles: normalized.alternativeTitles,
            type: normalized.type,
            status: normalized.status,
            genres: normalized.genres,
            tags: normalized.tags,
            author: normalized.author,
            artist: normalized.artist,
            coverUrl: normalized.coverUrl,
            synopsis: normalized.synopsis,
            releaseYear: normalized.releaseYear,
            sourceUrl,
          },
        });

        // Index in Meilisearch
        const title = await prisma.title.findUnique({ where: { slug } });
        if (title) {
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
        }
      } catch (err) {
        console.warn(`⚠️  Error processing title "${normalized.title}":`, (err as Error).message);
      }
    }

    console.log(`✅ Refreshed ${response.data.length} titles`);
  } catch (err) {
    console.error('❌ Failed to refresh popular titles:', (err as Error).message);
    throw err;
  }
}

/**
 * Refresh chapters for a specific title.
 * Fetches chapters from MangaDex and creates new ones in the database,
 * then notifies bookmarkers about new chapters.
 */
async function refreshChaptersForTitle(titleId: string) {
  console.log(`🔄 Refreshing chapters for title ${titleId}...`);

  try {
    const title = await prisma.title.findUnique({ where: { id: titleId } });
    if (!title) {
      console.warn(`⚠️  Title ${titleId} not found`);
      return;
    }

    // Get the highest existing chapter number
    const latestExisting = await prisma.chapter.findFirst({
      where: { titleId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const maxExistingNumber = latestExisting?.number || 0;

    // Fetch chapters from MangaDex
    // Note: This requires the MangaDex ID to be stored. We'll use sourceUrl as a proxy.
    // In a production system, a dedicated mangadex_id field on the Title model would be better.
    if (!title.sourceUrl) {
      console.log(`ℹ️  Title "${title.title}" has no source URL — cannot fetch chapters from MangaDex`);
      return;
    }

    const mangadexMatch = title.sourceUrl.match(/mangadex\.org\/title\/([a-f0-9-]+)/i);
    if (!mangadexMatch) {
      console.log(`ℹ️  Title "${title.title}" source URL is not MangaDex — skipping chapter refresh`);
      return;
    }

    const mangadexId = mangadexMatch[1];
    const chapterData = await mangadex.getChapters(mangadexId, 100, 0);

    let newChaptersCount = 0;

    for (const ch of chapterData.data) {
      const chapterNumber = parseFloat(ch.attributes.chapter || '0');

      // Skip if chapter already exists
      if (chapterNumber <= maxExistingNumber) continue;

      try {
        await prisma.chapter.create({
          data: {
            titleId,
            number: chapterNumber,
            title: ch.attributes.title || null,
            pageCount: ch.attributes.pages,
            sourceUrl: `https://mangadex.org/chapter/${ch.id}`,
            createdAt: new Date(ch.attributes.publishAt),
          },
        });
        newChaptersCount++;

        // Notify bookmarkers about each new chapter
        notifyNewChapter(titleId, chapterNumber, ch.attributes.title || null);
      } catch {
        // Skip duplicates (unique constraint on titleId + number)
      }
    }

    // Update total chapters count
    if (newChaptersCount > 0) {
      const totalChapters = await prisma.chapter.count({ where: { titleId } });
      await prisma.title.update({
        where: { id: titleId },
        data: {
          totalChapters,
          updatedAt: new Date(),
        },
      });
    }

    // Update the title source URL with the manga ID if not already set
    if (!title.sourceUrl) {
      await prisma.title.update({
        where: { id: titleId },
        data: { sourceUrl: `https://mangadex.org/title/${mangadexId}` },
      });
    }

    console.log(`✅ Refreshed ${newChaptersCount} new chapters for "${title.title}"`);
  } catch (err) {
    console.error('❌ Failed to refresh chapters:', (err as Error).message);
  }
}

/**
 * Fetch and create chapters for a title from MangaDex during seeding.
 * Returns the number of chapters created.
 */
async function syncChaptersFromMangaDex(titleId: string, mangadexId: string): Promise<number> {
  try {
    const chapterData = await mangadex.getChapters(mangadexId, 100, 0);
    let created = 0;

    for (const ch of chapterData.data) {
      const chapterNumber = parseFloat(ch.attributes.chapter || '0');
      if (chapterNumber === 0) continue;

      try {
        await prisma.chapter.create({
          data: {
            titleId,
            number: chapterNumber,
            title: ch.attributes.title || null,
            pageCount: ch.attributes.pages,
            sourceUrl: `https://mangadex.org/chapter/${ch.id}`,
            createdAt: new Date(ch.attributes.publishAt),
          },
        });
        created++;
      } catch {
        // Skip duplicates
      }
    }

    return created;
  } catch {
    return 0;
  }
}

/**
 * Seed the database with initial content from MangaDex.
 */
async function seedDatabase(count: number) {
  console.log(`🌱 Seeding database with ${count} titles from MangaDex...`);

  // Fetch popular and latest
  const [popular, latest] = await Promise.all([
    mangadex.getPopular(count / 2),
    mangadex.getLatest(count / 2),
  ]);

  const allManga = [...popular.data, ...latest.data];
  const seen = new Set<string>();
  let imported = 0;

  for (const manga of allManga) {
    if (seen.has(manga.id)) continue;
    seen.add(manga.id);

    try {
      const normalized = mangadex.normalizeTitle(manga);
      const slug = normalized.slug;

      await prisma.title.upsert({
        where: { slug },
        update: {
          title: normalized.title,
          type: normalized.type,
          status: normalized.status,
          genres: normalized.genres,
          tags: normalized.tags,
          author: normalized.author,
          artist: normalized.artist,
          coverUrl: normalized.coverUrl,
          synopsis: normalized.synopsis,
          releaseYear: normalized.releaseYear,
        },
        create: {
          slug,
          title: normalized.title,
          alternativeTitles: normalized.alternativeTitles,
          type: normalized.type,
          status: normalized.status,
          genres: normalized.genres,
          tags: normalized.tags,
          author: normalized.author,
          artist: normalized.artist,
          coverUrl: normalized.coverUrl,
          synopsis: normalized.synopsis,
          releaseYear: normalized.releaseYear,
        },
      });

      // Get the title's actual database ID
      const titleRecord = await prisma.title.findUnique({ where: { slug }, select: { id: true } });
      if (titleRecord) {
        const mangaId = manga.id;
        await syncChaptersFromMangaDex(titleRecord.id, mangaId);
      }

      imported++;
    } catch (err) {
      // skip individual failures
    }
  }

  // Update totalChapters for all titles
  const allTitles = await prisma.title.findMany({ select: { id: true } });
  for (const t of allTitles) {
    const count = await prisma.chapter.count({ where: { titleId: t.id } });
    await prisma.title.update({ where: { id: t.id }, data: { totalChapters: count } });
  }

  // Index in Meilisearch
  const titles = await prisma.title.findMany({ take: count });
  await meilisearch.bulkUpsert(
    titles.map((t) => ({
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
    })),
  );

  console.log(`✅ Imported ${imported} titles and indexed in Meilisearch`);
}
