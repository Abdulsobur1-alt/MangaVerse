import { prisma } from '../lib/prisma.js';

/* ═══════════════════════════════════════════════════════════════
   Personality — the Reader Profile (Phase 9).
   Turns raw reading behavior into a human archetype: The Explorer,
   The Completionist, The Night Owl… Every archetype is scored 0-100
   from real signals; the top scorer becomes the primary personality
   and a runner-up (≥ 40) becomes the secondary. Public profiles see
   only the primary archetype — never scores or raw data.
   ═══════════════════════════════════════════════════════════════ */

export interface Archetype {
  key: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  /** Tailwind gradient classes for the card. */
  gradient: string;
  /** 0-100 — how strongly this archetype fits. */
  score: number;
}

export interface PersonalityData {
  primary: Archetype;
  secondary: Archetype | null;
  all: Archetype[];
}

interface Signals {
  chapters: number;
  seriesRead: number;
  seriesCompleted: number;
  reviews: number;
  library: number;
  streak: number;
  chaptersPerActiveDay: number;
  completionRate: number; // 0-100
  genreShare: Record<string, number>; // genre → 0-100 share
  nightShare: number; // 0-100 share of reading after 22:00 / before 05:00
}

const ARCHETYPES = [
  {
    key: 'explorer',
    name: 'The Explorer',
    emoji: '🧭',
    tagline: 'Always chasing new worlds',
    description: 'Tastes everything the library has to offer — hopping between series, following the curiosity of the moment.',
    gradient: 'from-sky-500/25 to-emerald-500/10',
    score: (s: Signals) => Math.min(100, s.seriesRead * 6 + (s.seriesRead > 0 && s.chapters / s.seriesRead < 6 ? 25 : 0)),
  },
  {
    key: 'completionist',
    name: 'The Completionist',
    emoji: '✅',
    tagline: 'No series left unfinished',
    description: 'Sees every story through to the final page. An empty chapter list is a personal failure.',
    gradient: 'from-emerald-500/25 to-teal-500/10',
    score: (s: Signals) => Math.min(100, s.seriesCompleted * 30 + s.completionRate * 0.7),
  },
  {
    key: 'collector',
    name: 'The Collector',
    emoji: '🗃️',
    tagline: 'A library that never stops growing',
    description: 'Curates a shelf to be proud of — stacking series to read, collecting the ones that matter.',
    gradient: 'from-amber-500/25 to-orange-500/10',
    score: (s: Signals) => Math.min(100, s.library * 4),
  },
  {
    key: 'critic',
    name: 'The Critic',
    emoji: '✍️',
    tagline: 'Every story gets a verdict',
    description: 'Has opinions and shares them — scoring art, story, and characters for the good of the community.',
    gradient: 'from-violet-500/25 to-fuchsia-500/10',
    score: (s: Signals) => Math.min(100, s.reviews * 20),
  },
  {
    key: 'speed_reader',
    name: 'The Speed Reader',
    emoji: '⚡',
    tagline: 'Pages before the kettle boils',
    description: 'Burns through chapters at a pace most readers can only dream of.',
    gradient: 'from-yellow-500/25 to-red-500/10',
    score: (s: Signals) => Math.min(100, s.chaptersPerActiveDay * 28),
  },
  {
    key: 'romantic',
    name: 'The Romantic',
    emoji: '💘',
    tagline: 'Here for the feelings',
    description: 'Lives for slow burns, meet-cutes, and the moments that make your heart ache.',
    gradient: 'from-pink-500/25 to-rose-500/10',
    score: (s: Signals) => s.genreShare['romance'] ?? 0,
  },
  {
    key: 'mystery_solver',
    name: 'The Mystery Solver',
    emoji: '🕵️',
    tagline: 'One step ahead of the reveal',
    description: 'Mysteries, thrillers, and mind-benders — loves a puzzle that keeps its secrets.',
    gradient: 'from-indigo-500/25 to-blue-500/10',
    score: (s: Signals) => Math.min(100, (s.genreShare['mystery'] ?? 0) + (s.genreShare['thriller'] ?? 0) + (s.genreShare['psychological'] ?? 0) + (s.genreShare['horror'] ?? 0)),
  },
  {
    key: 'night_owl',
    name: 'The Night Owl',
    emoji: '🦉',
    tagline: 'The best reading happens after midnight',
    description: 'The world sleeps; the pages turn. Peak reading hours are well past your bedtime.',
    gradient: 'from-indigo-600/25 to-purple-500/10',
    score: (s: Signals) => s.nightShare,
  },
  {
    key: 'devoted',
    name: 'The Devoted',
    emoji: '🔥',
    tagline: 'A streak that refuses to die',
    description: 'Shows up every single day. Consistency is the whole game, and you are winning it.',
    gradient: 'from-orange-500/25 to-amber-500/10',
    score: (s: Signals) => Math.min(100, s.streak * 3.3),
  },
] as const;

const PIONEER: Archetype = {
  key: 'pioneer',
  name: 'The Pioneer',
  emoji: '🌱',
  tagline: 'A journey of a thousand pages begins',
  description: 'A brand-new reader, standing at the edge of an infinite library. Every story from here is a first.',
  gradient: 'from-emerald-500/25 to-lime-500/10',
  score: 0,
};

/** Gather the behavioral signals used to score archetypes. */
async function getSignals(userId: string): Promise<Signals> {
  const [user, chapters, seriesProgress, reviews, librarySize, nightStats, libraryRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { streakDays: true } }),
    prisma.readingProgress.count({ where: { userId, completed: true } }),
    prisma.readingProgress.findMany({
      where: { userId, completed: true },
      select: { chapter: { select: { titleId: true } } },
      distinct: ['chapterId'],
    }),
    prisma.review.count({ where: { userId } }),
    prisma.bookmark.count({ where: { userId } }),
    prisma.readingProgress.findMany({
      where: { userId, updatedAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
      select: { updatedAt: true, completed: true },
      take: 20000,
    }),
    prisma.bookmark.findMany({ where: { userId }, select: { title: { select: { genres: true } } }, take: 300 }),
  ]);

  const seriesRead = new Set(seriesProgress.map((p) => p.chapter.titleId)).size;

  // Genre share from the library.
  const genreTotals = new Map<string, number>();
  let genreSum = 0;
  for (const b of libraryRows) {
    for (const g of b.title.genres) {
      genreTotals.set(g, (genreTotals.get(g) ?? 0) + 1);
      genreSum += 1;
    }
  }
  const genreShare: Record<string, number> = {};
  for (const [g, n] of genreTotals) genreShare[g] = genreSum > 0 ? Math.round((n / genreSum) * 100) : 0;

  // Night-owl share + per-active-day chapters from the last 365 days.
  const activeDays = new Set<string>();
  let nightCount = 0;
  let touchCount = 0;
  for (const r of nightStats) {
    const d = r.updatedAt;
    const dayKey = d.toISOString().split('T')[0];
    activeDays.add(dayKey);
    touchCount += 1;
    const h = d.getUTCHours();
    if (h >= 22 || h < 5) nightCount += 1;
  }
  const nightShare = touchCount > 0 ? Math.round((nightCount / touchCount) * 100) : 0;

  // Completion rate at the chapter level (completed vs any progress touch).
  const completionRate = touchCount > 0 ? Math.round((chapters / Math.max(touchCount, chapters)) * 100) : 0;
  const chaptersPerActiveDay = activeDays.size > 0 ? chapters / activeDays.size : 0;

  return {
    chapters,
    seriesRead,
    seriesCompleted: 0, // filled below
    reviews,
    library: librarySize,
    streak: user?.streakDays ?? 0,
    chaptersPerActiveDay,
    completionRate,
    genreShare,
    nightShare,
  };
}

/** Score every archetype and pick primary + secondary. */
export async function computePersonality(userId: string): Promise<PersonalityData> {
  const signals = await getSignals(userId);

  // Series completed (same logic as journey): finished the latest chapter.
  const progress = await prisma.readingProgress.findMany({
    where: { userId, completed: true },
    select: { chapter: { select: { titleId: true, number: true, series: { select: { totalChapters: true } } } } },
  });
  const byTitle = new Map<string, { completed: number; total: number | null; max: number }>();
  for (const p of progress) {
    const e = byTitle.get(p.chapter.titleId) ?? { completed: 0, total: p.chapter.series.totalChapters, max: 0 };
    e.completed += 1;
    e.max = Math.max(e.max, p.chapter.number);
    byTitle.set(p.chapter.titleId, e);
  }
  signals.seriesCompleted = [...byTitle.values()].filter((t) =>
    t.total && t.total > 0 ? t.completed >= t.total : t.completed >= t.max && t.max > 0,
  ).length;

  const all: Archetype[] = ARCHETYPES.map((a) => ({
    key: a.key,
    name: a.name,
    emoji: a.emoji,
    tagline: a.tagline,
    description: a.description,
    gradient: a.gradient,
    score: Math.round(a.score(signals)),
  })).sort((a, b) => b.score - a.score);

  const primary = all[0] && all[0].score >= 15 ? all[0] : PIONEER;
  const secondary = all[1] && all[1].score >= 40 ? all[1] : null;

  return { primary, secondary, all };
}

/** Public-safe personality payload (no scores beyond the primary pick). */
export async function getPublicPersonality(userId: string) {
  const { primary } = await computePersonality(userId);
  return {
    key: primary.key,
    name: primary.name,
    emoji: primary.emoji,
    tagline: primary.tagline,
    description: primary.description,
    gradient: primary.gradient,
  };
}
