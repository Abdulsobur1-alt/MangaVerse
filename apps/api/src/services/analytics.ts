import { prisma } from '../lib/prisma.js';

/* ═══════════════════════════════════════════════════════════════
   Analytics — the premium statistics engine (Phase 9).
   Everything a profile story needs: pages & hours read, volumes,
   completion rate, best streak, monthly rhythm, favorite authors
   and artists, the 365-day heatmap, longest / fastest series.
   Reading time is estimated (≈0.75 min per manga page, prose by
   word count) — labeled as such in the UI; it needs no session
   tracking to work for existing accounts.
   ═══════════════════════════════════════════════════════════════ */

export interface AnalyticsData {
  totalChapters: number;
  totalSeries: number;
  pagesRead: number;
  volumesRead: number;
  seriesCompleted: number;
  completionRate: number; // 0-100
  streakDays: number; // current
  bestStreak: number; // longest run, last 365 days
  daysActive: number; // last 90 days
  totalReadingMinutes: number;
  hoursRead: number; // 1 decimal
  averageChaptersPerDay: number;
  averageRatingGiven: number | null;
  nightShare: number; // % of reading after 22:00 / before 05:00
  genreDistribution: { genre: string; count: number }[];
  favoriteAuthors: { author: string; chapters: number; titles: number }[];
  favoriteArtists: { artist: string; chapters: number; titles: number }[];
  readingCalendar: { date: string; read: boolean; count: number }[]; // 365 days, oldest → newest
  readingByMonth: { key: string; label: string; chapters: number; minutes: number }[]; // last 12 months
  longestSeries: { titleId: string; title: string; slug: string; coverUrl: string | null; chaptersRead: number } | null;
  fastestCompletedSeries: { titleId: string; title: string; slug: string; coverUrl: string | null; days: number; chaptersRead: number } | null;
  perTitle: { titleId: string; title: string; slug: string; type: string; coverUrl: string | null; author: string | null; chaptersRead: number }[];
  completedSeries: { titleId: string; title: string; slug: string; coverUrl: string | null; chaptersRead: number; totalChapters: number | null }[];
  totalReadingDays: number; // lifetime distinct days
}

const PAGE_MINUTES = 0.75; // per manga page
const WORDS_PER_MINUTE = 200;

// Short-TTL in-memory cache: analytics are heavy (all completed progress +
// a year of touches) and get hit by the dashboard AND every public profile
// view. 60s staleness is invisible to users but avoids recomputation storms.
const analyticsCache = new Map<string, { at: number; data: AnalyticsData }>();
const CACHE_TTL_MS = 60_000;

export function chapterMinutes(pageCount: number | null, contentText: string | null): number {
  if (contentText) {
    const words = contentText.split(/\s+/).length;
    return Math.max(2, Math.round(words / WORDS_PER_MINUTE));
  }
  return Math.max(4, Math.round((pageCount ?? 15) * PAGE_MINUTES));
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Build the last-12-months buckets (oldest first). */
function monthBuckets(): { key: string; label: string; chapters: number; minutes: number }[] {
  const now = new Date();
  const buckets: { key: string; label: string; chapters: number; minutes: number }[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MONTH_LABELS[d.getMonth()], chapters: 0, minutes: 0 });
  }
  return buckets;
}

/** Longest run of consecutive active days (365-day window). */
function bestStreak(activeDays: Set<string>): number {
  const sorted = [...activeDays].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const day of sorted) {
    const d = new Date(day);
    if (prev && d.getTime() - prev.getTime() <= 24 * 60 * 60 * 1000 + 60 * 1000) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export async function getReadingAnalytics(userId: string): Promise<AnalyticsData> {
  const cached = analyticsCache.get(userId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { streakDays: true } });
  if (!user) throw new Error('User not found');

  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // 1. All touches in the last year (calendar, streak, night share, pace).
  const touches = await prisma.readingProgress.findMany({
    where: { userId, updatedAt: { gte: yearAgo } },
    select: { updatedAt: true },
    take: 50000,
  });

  // 2. All completed chapters, ever (lifetime counts, minutes, months, series).
  const completed = await prisma.readingProgress.findMany({
    where: { userId, completed: true },
    select: {
      updatedAt: true,
      chapter: {
        select: {
          titleId: true,
          number: true,
          pageCount: true,
          contentText: true,
          series: {
            select: { id: true, title: true, slug: true, coverUrl: true, type: true, totalChapters: true, genres: true, author: true, artist: true },
          },
        },
      },
    },
  });

  // 3. Average rating given + window-consistent completion metrics.
  const [ratingAgg, totalProgressRows, chapters90] = await Promise.all([
    prisma.review.aggregate({ where: { userId }, _avg: { rating: true } }),
    prisma.readingProgress.count({ where: { userId } }),
    prisma.readingProgress.count({ where: { userId, completed: true, updatedAt: { gte: ninetyDaysAgo } } }),
  ]);

  // ─── Calendar + days ───────────────────────────────
  const dayCounts = new Map<string, number>();
  for (const t of touches) {
    const key = t.updatedAt.toISOString().split('T')[0];
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }
  const allTouches = touches.map((t) => t.updatedAt);
  const nightCount = allTouches.filter((d) => {
    const h = d.getUTCHours();
    return h >= 22 || h < 5;
  }).length;
  const nightShare = allTouches.length > 0 ? Math.round((nightCount / allTouches.length) * 100) : 0;

  const ninetyDayKeys = new Set(
    touches.filter((t) => t.updatedAt >= ninetyDaysAgo).map((t) => t.updatedAt.toISOString().split('T')[0]),
  );

  const readingCalendar: { date: string; read: boolean; count: number }[] = [];
  for (let i = 364; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = date.toISOString().split('T')[0];
    const count = dayCounts.get(key) ?? 0;
    readingCalendar.push({ date: key, read: count > 0, count: Math.min(count, 4) });
  }

  // ─── Lifetime aggregates ───────────────────────────
  const totalChapters = completed.length;
  let pagesRead = 0;
  let totalMinutes = 0;
  const byTitle = new Map<string, { rows: typeof completed; title: (typeof completed)[number]['chapter']['series'] }>();
  for (const row of completed) {
    pagesRead += row.chapter.pageCount ?? 15;
    totalMinutes += chapterMinutes(row.chapter.pageCount, row.chapter.contentText);
    const s = row.chapter.series;
    const entry = byTitle.get(s.id) ?? { rows: [], title: s };
    entry.rows.push(row);
    byTitle.set(s.id, entry);
  }

  // Series completed (finished latest chapter / declared total).
  const completedSeries: AnalyticsData['completedSeries'] = [];
  for (const [tid, e] of byTitle) {
    const total = e.title.totalChapters;
    const maxChapter = Math.max(...e.rows.map((r) => r.chapter.number));
    const done = total && total > 0 ? e.rows.length >= total : e.rows.length >= maxChapter && maxChapter > 0;
    if (done) {
      completedSeries.push({
        titleId: tid,
        title: e.title.title,
        slug: e.title.slug,
        coverUrl: e.title.coverUrl,
        chaptersRead: e.rows.length,
        totalChapters: total,
      });
    }
  }

  // Longest series + fastest completed (≥ 5 chapters, wall-clock span).
  let longest: AnalyticsData['longestSeries'] = null;
  let fastest: AnalyticsData['fastestCompletedSeries'] = null;
  for (const [tid, e] of byTitle) {
    if (!longest || e.rows.length > longest.chaptersRead) {
      longest = { titleId: tid, title: e.title.title, slug: e.title.slug, coverUrl: e.title.coverUrl, chaptersRead: e.rows.length };
    }
    const isComplete = completedSeries.some((c) => c.titleId === tid);
    if (isComplete && e.rows.length >= 5) {
      const times = e.rows.map((r) => r.updatedAt.getTime());
      const spanDays = Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / (24 * 60 * 60 * 1000)));
      if (!fastest || spanDays < fastest.days) {
        fastest = { titleId: tid, title: e.title.title, slug: e.title.slug, coverUrl: e.title.coverUrl, days: spanDays, chaptersRead: e.rows.length };
      }
    }
  }

  // ─── Per-title + genre + authors + artists ─────────
  const perTitle = [...byTitle.entries()]
    .sort((a, b) => b[1].rows.length - a[1].rows.length)
    .slice(0, 10)
    .map(([tid, e]) => ({
      titleId: tid,
      title: e.title.title,
      slug: e.title.slug,
      type: e.title.type,
      coverUrl: e.title.coverUrl,
      author: e.title.author ?? null,
      chaptersRead: e.rows.length,
    }));

  const genreCounts = new Map<string, number>();
  const authorCounts = new Map<string, { chapters: number; titles: number }>();
  const artistCounts = new Map<string, { chapters: number; titles: number }>();
  for (const [tid, e] of byTitle) {
    for (const g of e.title.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    if (e.title.author) {
      const a = authorCounts.get(e.title.author) ?? { chapters: 0, titles: 0 };
      a.chapters += e.rows.length;
      a.titles += 1;
      authorCounts.set(e.title.author, a);
    }
    if (e.title.artist) {
      const a = artistCounts.get(e.title.artist) ?? { chapters: 0, titles: 0 };
      a.chapters += e.rows.length;
      a.titles += 1;
      artistCounts.set(e.title.artist, a);
    }
  }

  // ─── Monthly rhythm ────────────────────────────────
  const months = monthBuckets();
  const monthIndex = new Map(months.map((m) => [m.key, m]));
  for (const row of completed) {
    const d = row.updatedAt;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const bucket = monthIndex.get(key);
    if (bucket) {
      bucket.chapters += 1;
      bucket.minutes += chapterMinutes(row.chapter.pageCount, row.chapter.contentText);
    }
  }

  // Completion rate compares like with like: lifetime completed vs lifetime
  // progress rows ever touched (a chapter opened but never finished counts
  // as incomplete).
  const completionRate = totalProgressRows > 0 ? Math.round((totalChapters / Math.max(totalProgressRows, totalChapters)) * 100) : 0;
  // Chapters per active day uses the same 90-day window on both sides.
  const averageChaptersPerDay =
    ninetyDayKeys.size > 0 ? Math.round((chapters90 / ninetyDayKeys.size) * 10) / 10 : 0;
  const best = bestStreak(new Set(dayCounts.keys()));
  const hoursRead = Math.round((totalMinutes / 60) * 10) / 10;

  const data: AnalyticsData = {
    totalChapters,
    totalSeries: byTitle.size,
    pagesRead,
    volumesRead: Math.round(pagesRead / 190),
    seriesCompleted: completedSeries.length,
    completionRate,
    streakDays: user.streakDays,
    bestStreak: Math.max(best, user.streakDays),
    daysActive: ninetyDayKeys.size,
    totalReadingMinutes: totalMinutes,
    hoursRead,
    averageChaptersPerDay,
    averageRatingGiven: ratingAgg._avg.rating ?? null,
    nightShare,
    genreDistribution: [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).map(([genre, count]) => ({ genre, count })),
    favoriteAuthors: [...authorCounts.entries()].sort((a, b) => b[1].chapters - a[1].chapters).slice(0, 6).map(([author, v]) => ({ author, ...v })),
    favoriteArtists: [...artistCounts.entries()].sort((a, b) => b[1].chapters - a[1].chapters).slice(0, 6).map(([artist, v]) => ({ artist, ...v })),
    readingCalendar,
    readingByMonth: months,
    longestSeries: longest,
    fastestCompletedSeries: fastest,
    perTitle,
    completedSeries: completedSeries.sort((a, b) => b.chaptersRead - a.chaptersRead).slice(0, 6),
    totalReadingDays: dayCounts.size,
  };
  analyticsCache.set(userId, { at: Date.now(), data });
  return data;
}

/** Drop the cached analytics for a user (call after a completion event). */
export function invalidateAnalytics(userId: string): void {
  analyticsCache.delete(userId);
}
