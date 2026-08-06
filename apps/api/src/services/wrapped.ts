import { prisma } from '../lib/prisma.js';
import { ACHIEVEMENT_CATALOG } from './achievements.js';
import { chapterMinutes } from './analytics.js';

/* ═══════════════════════════════════════════════════════════════
   Wrapped — the annual "MangaVerse Wrapped" (Phase 9).
   One snapshot per user per year, generated on demand and cached in
   wrapped_reports. Story-first: hours read, pages turned, top series,
   reading mood, achievements, growth — presented as a shareable card.
   ═══════════════════════════════════════════════════════════════ */

export interface WrappedMood {
  key: string;
  label: string;
  emoji: string;
  description: string;
}

const MOODS: Record<string, WrappedMood> = {
  adventure: { key: 'adventure', label: 'Adventurous', emoji: '🗺️', description: 'Chasing quests and new horizons all year long.' },
  romance: { key: 'romance', label: 'Romantic', emoji: '💘', description: 'A year full of heart, longing, and slow burns.' },
  mystery: { key: 'mystery', label: 'Sleuthing', emoji: '🕵️', description: 'You solved every mystery before the reveal.' },
  action: { key: 'action', label: 'Pumped', emoji: '⚔️', description: 'Non-stop battles and hype — a year of adrenaline.' },
  comedy: { key: 'comedy', label: 'Laughing', emoji: '😂', description: 'A year of smile-inducing, gut-busting comedy.' },
  drama: { key: 'drama', label: 'Deeply Felt', emoji: '🎭', description: 'Emotional arcs that left you staring at the ceiling.' },
  fantasy: { key: 'fantasy', label: 'Dreaming', emoji: '🐉', description: 'You lived in worlds that never were — and loved it.' },
  psychological: { key: 'psychological', label: 'Deep in Thought', emoji: '🧠', description: 'Mind-bending plots that stuck with you.' },
  horror: { key: 'horror', label: 'Sleeping with the Lights On', emoji: '🕯️', description: 'You braved the dark, page after page.' },
  scifi: { key: 'scifi', label: 'Sci-Fi', emoji: '🚀', description: 'A year among starships, AIs, and the far future.' },
  default: { key: 'default', label: 'Balanced', emoji: '📖', description: 'A well-rounded year of reading across everything.' },
};

function moodForGenres(genres: { genre: string; count: number }[]): WrappedMood {
  const top = genres[0]?.genre ?? '';
  if (MOODS[top]) return MOODS[top];
  const g = top.toLowerCase();
  if (g.includes('mystery') || g.includes('thriller') || g.includes('detective')) return MOODS.mystery;
  if (g.includes('psych') || g.includes('horror')) return MOODS.psychological;
  if (g.includes('action') || g.includes('martial') || g.includes('mecha')) return MOODS.action;
  if (g.includes('fantasy') || g.includes('isekai') || g.includes('cultivation')) return MOODS.fantasy;
  if (g.includes('sci') || g.includes('mecha')) return MOODS.scifi;
  return MOODS.default;
}

export interface WrappedData {
  year: number;
  generatedAt: string;
  chaptersRead: number;
  pagesRead: number;
  hoursRead: number;
  daysActive: number;
  totalSeries: number;
  longestStreak: number;
  favoriteGenre: { genre: string; count: number } | null;
  mood: WrappedMood;
  topSeries: { slug: string; title: string; coverUrl: string | null; chapters: number }[];
  achievements: { badgeId: string; name: string; emoji: string; description: string }[];
  achievementsEarned: number;
  growth: { chaptersThisYear: number; chaptersLastYear: number; pct: number | null } | null;
  community: { posts: number; comments: number; reviews: number; listsCreated: number; followersGained: number };
  averageRatingGiven: number | null;
  genresTried: number;
  firstReadAt: string | null;
  lastReadAt: string | null;
  opener: string;
  closer: string;
}

function openerFor(year: number, mood: WrappedMood, chapters: number): string {
  if (chapters === 0) return `${year} was a quiet year — but every great story needs a first page.`;
  return `In ${year}, you read ${chapters.toLocaleString()} chapters across ${mood.label.toLowerCase()} adventures.`;
}

/** Generate (and cache) the Wrapped report for a user + year. */
export async function generateWrapped(userId: string, year: number): Promise<WrappedData> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const yearStart = new Date(Date.UTC(year - 1, 0, 1));

  const [progress, prevYearProgress, achievements, reviews, posts, comments, lists, follows, user, library] = await Promise.all([
    prisma.readingProgress.findMany({
      where: { userId, updatedAt: { gte: start, lt: end } },
      select: {
        updatedAt: true,
        chapter: {
          select: {
            pageCount: true,
            contentText: true,
            series: { select: { id: true, title: true, slug: true, coverUrl: true, genres: true } },
          },
        },
      },
      take: 50000,
    }),
    prisma.readingProgress.count({ where: { userId, updatedAt: { gte: yearStart, lt: start } } }),
    prisma.achievement.findMany({ where: { userId, earnedAt: { gte: start, lt: end } } }),
    prisma.review.findMany({ where: { userId, createdAt: { gte: start, lt: end } }, select: { rating: true } }),
    prisma.communityPost.count({ where: { authorId: userId, createdAt: { gte: start, lt: end } } }),
    prisma.postComment.count({ where: { authorId: userId, createdAt: { gte: start, lt: end } } }),
    prisma.userList.count({ where: { userId, createdAt: { gte: start, lt: end } } }),
    prisma.follow.count({ where: { followerId: userId, createdAt: { gte: start, lt: end } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
    prisma.bookmark.findMany({ where: { userId }, select: { title: { select: { genres: true } } }, take: 300 }),
  ]);

  // Lifetime genre shares (stable "reading mood" even in a quiet year).
  const genreTotals = new Map<string, number>();
  for (const b of library) for (const g of b.title.genres) genreTotals.set(g, (genreTotals.get(g) ?? 0) + 1);
  const genreDistribution = [...genreTotals.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);

  const pagesRead = progress.reduce((sum, p) => sum + (p.chapter.pageCount ?? 15), 0);
  const minutes = progress.reduce((sum, p) => sum + chapterMinutes(p.chapter.pageCount, p.chapter.contentText), 0);
  const hoursRead = Math.round((minutes / 60) * 10) / 10;

  const activeDays = new Set<string>();
  let earliest: Date | null = null;
  let latest: Date | null = null;
  for (const p of progress) {
    const key = p.updatedAt.toISOString().split('T')[0];
    activeDays.add(key);
    if (!earliest || p.updatedAt < earliest) earliest = p.updatedAt;
    if (!latest || p.updatedAt > latest) latest = p.updatedAt;
  }

  // Longest streak within the year.
  const sorted = [...activeDays].sort();
  let streak = 0;
  let run = 0;
  let prevDay: Date | null = null;
  for (const day of sorted) {
    const d = new Date(day);
    if (prevDay && d.getTime() - prevDay.getTime() <= 24 * 60 * 60 * 1000 + 60 * 1000) run += 1;
    else run = 1;
    streak = Math.max(streak, run);
    prevDay = d;
  }

  // Top series by chapters in the year.
  const bySeries = new Map<string, { title: string; slug: string; coverUrl: string | null; chapters: number }>();
  for (const p of progress) {
    const s = p.chapter.series;
    const e = bySeries.get(s.id) ?? { title: s.title, slug: s.slug, coverUrl: s.coverUrl, chapters: 0 };
    e.chapters += 1;
    bySeries.set(s.id, e);
  }
  const topSeries = [...bySeries.values()].sort((a, b) => b.chapters - a.chapters).slice(0, 5);

  const earnedBadges = achievements
    .map((a) => ACHIEVEMENT_CATALOG.find((c) => c.id === a.badgeId))
    .filter((b): b is NonNullable<typeof b> => !!b);

  const averageRatingGiven = reviews.length > 0 ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null;

  const chaptersThisYear = progress.length;
  const growth = prevYearProgress > 0 ? { chaptersThisYear, chaptersLastYear: prevYearProgress, pct: Math.round(((chaptersThisYear - prevYearProgress) / prevYearProgress) * 100) } : { chaptersThisYear, chaptersLastYear: prevYearProgress, pct: null };

  const mood = moodForGenres(genreDistribution);
  const favoriteGenre = genreDistribution[0] ?? null;
  const userName = user?.displayName?.split(' ')[0] || 'Reader';

  const data: WrappedData = {
    year,
    generatedAt: new Date().toISOString(),
    chaptersRead: chaptersThisYear,
    pagesRead,
    hoursRead,
    daysActive: activeDays.size,
    totalSeries: bySeries.size,
    longestStreak: streak,
    favoriteGenre,
    mood,
    topSeries,
    achievements: earnedBadges.map((b) => ({ badgeId: b.id, name: b.name, emoji: b.emoji, description: b.description })),
    achievementsEarned: earnedBadges.length,
    growth: growth.pct === null ? null : growth,
    community: { posts, comments: comments, reviews: reviews.length, listsCreated: lists, followersGained: follows },
    averageRatingGiven,
    genresTried: genreTotals.size,
    firstReadAt: earliest ? earliest.toISOString() : null,
    lastReadAt: latest ? latest.toISOString() : null,
    opener: openerFor(year, mood, chaptersThisYear),
    closer: `Here's to another year of turning pages, ${userName}.`,
  };

  await prisma.wrappedReport.upsert({
    where: { userId_year: { userId, year } },
    update: { data: data as object },
    create: { userId, year, data: data as object },
  });

  return data;
}

/** Cached wrapped report for a user + year, or null. */
export async function getWrapped(userId: string, year: number): Promise<WrappedData | null> {
  const row = await prisma.wrappedReport.findUnique({
    where: { userId_year: { userId, year } },
  });
  if (!row || !row.data) return null;
  return { year, ...(row.data as unknown as Omit<WrappedData, 'year'>) } as WrappedData;
}

/** Latest wrapped report (any year) — the dashboard teaser. */
export async function getLatestWrapped(userId: string): Promise<WrappedData | null> {
  const row = await prisma.wrappedReport.findFirst({
    where: { userId },
    orderBy: { year: 'desc' },
  });
  if (!row || !row.data) return null;
  return { year: row.year, ...(row.data as unknown as Omit<WrappedData, 'year'>) } as WrappedData;
}
