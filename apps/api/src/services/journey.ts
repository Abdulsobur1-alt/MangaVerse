import { prisma } from '../lib/prisma.js';

/* ═══════════════════════════════════════════════════════════════
   Journey — the reader's origin story (Phase 9).
   Every milestone is a "first": first chapter, first review, first
   streak, first completed series. Detected idempotently — the
   (userId, type) unique constraint guarantees a milestone is never
   recorded twice. The timeline (oldest → newest) reads like a life
   story on the profile.
   ═══════════════════════════════════════════════════════════════ */

export interface JourneyMilestone {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  emoji: string;
  achievedAt: string;
}

export interface JourneyData {
  items: JourneyMilestone[];
  count: number;
  /** The very first milestone date — when the story began. */
  startedAt: string | null;
}

interface MilestoneDef {
  type: string;
  title: string;
  detail: string;
  emoji: string;
  /** Condition evaluated against the stats object below. */
  test: (s: MilestoneStats) => boolean;
}

export interface MilestoneStats {
  chapters: number;
  seriesRead: number;
  seriesCompleted: number;
  reviews: number;
  collections: number;
  lists: number;
  posts: number;
  comments: number;
  followers: number;
  badges: number;
  streak: number;
  wikiEdits: number;
  predictions: number;
  bookmarks: number;
  clubs: number;
}

const MILESTONES: MilestoneDef[] = [
  { type: 'joined', title: 'Joined MangaVerse', detail: 'The story begins', emoji: '🌱', test: () => true },
  { type: 'first_bookmark', title: 'First library add', detail: 'Picked your first series', emoji: '📚', test: (s) => s.bookmarks >= 1 },
  { type: 'first_chapter', title: 'First chapter read', detail: 'Turned your first page', emoji: '📖', test: (s) => s.chapters >= 1 },
  { type: 'chapters_10', title: '10 chapters read', detail: 'Warming up', emoji: '📕', test: (s) => s.chapters >= 10 },
  { type: 'chapters_50', title: '50 chapters read', detail: 'A proper reader', emoji: '📗', test: (s) => s.chapters >= 50 },
  { type: 'chapters_100', title: '100 chapters read', detail: 'Three figures', emoji: '🎓', test: (s) => s.chapters >= 100 },
  { type: 'chapters_500', title: '500 chapters read', detail: 'Fully committed', emoji: '📘', test: (s) => s.chapters >= 500 },
  { type: 'chapters_1000', title: '1,000 chapters read', detail: 'A thousand worlds', emoji: '📚', test: (s) => s.chapters >= 1000 },
  { type: 'first_review', title: 'First review', detail: 'Put your opinion out there', emoji: '✍️', test: (s) => s.reviews >= 1 },
  { type: 'first_collection', title: 'First collection', detail: 'Curated your first shelf', emoji: '🗂️', test: (s) => s.collections >= 1 },
  { type: 'first_list', title: 'First list', detail: 'Shared your taste with the world', emoji: '📋', test: (s) => s.lists >= 1 },
  { type: 'first_post', title: 'First community post', detail: 'Started a discussion', emoji: '📣', test: (s) => s.posts >= 1 },
  { type: 'first_comment', title: 'First comment', detail: 'Joined the conversation', emoji: '💬', test: (s) => s.comments >= 1 },
  { type: 'first_follower', title: 'First follower', detail: 'Someone wants to read along', emoji: '🤝', test: (s) => s.followers >= 1 },
  { type: 'first_badge', title: 'First badge earned', detail: 'The collection begins', emoji: '🏅', test: (s) => s.badges >= 1 },
  { type: 'badges_5', title: '5 badges earned', detail: 'A worthy cabinet', emoji: '🎖️', test: (s) => s.badges >= 5 },
  { type: 'badges_10', title: '10 badges earned', detail: 'A decorated reader', emoji: '🌟', test: (s) => s.badges >= 10 },
  { type: 'streak_7', title: '7-day streak', detail: 'A week unbroken', emoji: '🔥', test: (s) => s.streak >= 7 },
  { type: 'streak_30', title: '30-day streak', detail: 'A month of daily reading', emoji: '⚡', test: (s) => s.streak >= 30 },
  { type: 'streak_100', title: '100-day streak', detail: 'A hundred days straight', emoji: '💎', test: (s) => s.streak >= 100 },
  { type: 'series_completed_1', title: 'First series completed', detail: 'Saw a story through to the end', emoji: '✅', test: (s) => s.seriesCompleted >= 1 },
  { type: 'series_completed_5', title: '5 series completed', detail: 'Five stories finished', emoji: '🏁', test: (s) => s.seriesCompleted >= 5 },
  { type: 'first_wiki_edit', title: 'First wiki contribution', detail: 'Gave back to the community', emoji: '📜', test: (s) => s.wikiEdits >= 1 },
  { type: 'first_prediction', title: 'First prediction', detail: 'Called your first shot', emoji: '🔮', test: (s) => s.predictions >= 1 },
  { type: 'first_club', title: 'Joined a reading club', detail: 'Reading together', emoji: '🎉', test: (s) => s.clubs >= 1 },
];

/** Aggregate the raw counts every milestone condition needs. */
export async function getJourneyStats(userId: string): Promise<MilestoneStats> {
  const [chapters, seriesProgress, reviews, collections, lists, posts, comments, followers, badges, user, wikiPages, wikiRevisions, resolvedVotes, bookmarks, clubs] = await Promise.all([
    prisma.readingProgress.count({ where: { userId, completed: true } }),
    prisma.readingProgress.findMany({
      where: { userId, completed: true },
      select: { chapter: { select: { titleId: true, number: true, series: { select: { totalChapters: true } } } } },
    }),
    prisma.review.count({ where: { userId } }),
    prisma.collection.count({ where: { userId } }),
    prisma.userList.count({ where: { userId } }),
    prisma.communityPost.count({ where: { authorId: userId } }),
    prisma.postComment.count({ where: { authorId: userId } }),
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.achievement.count({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { streakDays: true, createdAt: true } }),
    prisma.wikiPage.findMany({ where: { authorId: userId }, select: { id: true } }),
    prisma.wikiRevision.findMany({ where: { authorId: userId }, select: { wikiId: true }, distinct: ['wikiId'] }),
    prisma.predictionVote.findMany({
      where: { userId, prediction: { result: { not: null } } },
      select: { option: true, prediction: { select: { result: true } } },
    }),
    prisma.bookmark.count({ where: { userId } }),
    prisma.readingClubMember.count({ where: { userId } }),
  ]);

  // Series completed: finished every published chapter (totalChapters set)
  // or the latest available chapter (totalChapters unknown).
  const byTitle = new Map<string, { completed: number; total: number | null; maxChapter: number }>();
  for (const p of seriesProgress) {
    const tid = p.chapter.titleId;
    const entry = byTitle.get(tid) ?? { completed: 0, total: p.chapter.series.totalChapters, maxChapter: 0 };
    entry.completed += 1;
    entry.maxChapter = Math.max(entry.maxChapter, p.chapter.number);
    byTitle.set(tid, entry);
  }
  const seriesCompleted = [...byTitle.values()].filter((t) => {
    if (t.total && t.total > 0) return t.completed >= t.total;
    return t.completed >= t.maxChapter && t.maxChapter > 0;
  }).length;

  const wikiEditIds = new Set([...wikiPages.map((w) => w.id), ...wikiRevisions.map((r) => r.wikiId)]);
  const predictionsWon = resolvedVotes.filter((v) => v.option === v.prediction.result).length;

  return {
    chapters,
    seriesRead: byTitle.size,
    seriesCompleted,
    reviews,
    collections,
    lists,
    posts,
    comments,
    followers,
    badges,
    streak: user?.streakDays ?? 0,
    wikiEdits: wikiEditIds.size,
    predictions: predictionsWon,
    bookmarks,
    clubs,
  };
}

/**
 * Record any milestones the user has just earned (idempotent).
 * Safe to call fire-and-forget after reading/review/library/community events.
 */
export async function checkAndRecordMilestones(userId: string): Promise<JourneyMilestone[]> {
  const [stats, user, existing] = await Promise.all([
    getJourneyStats(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.profileMilestone.findMany({ where: { userId }, select: { type: true } }),
  ]);

  const existingSet = new Set(existing.map((m) => m.type));
  const pending = MILESTONES.filter((m) => !existingSet.has(m.type) && m.test(stats));

  const created: JourneyMilestone[] = [];
  for (const m of pending) {
    // The unique constraint makes this safe under concurrency (P2002 = skip).
    try {
      const row = await prisma.profileMilestone.create({
        data: {
          userId,
          type: m.type,
          title: m.title,
          detail: m.detail,
          emoji: m.emoji,
          achievedAt: m.type === 'joined' && user ? user.createdAt : new Date(),
        },
      });
      created.push({
        id: row.id,
        type: row.type,
        title: row.title,
        detail: row.detail,
        emoji: row.emoji,
        achievedAt: row.achievedAt.toISOString(),
      });
    } catch (err) {
      if ((err as { code?: string })?.code !== 'P2002') throw err;
    }
  }

  return created;
}

/** The user's full journey, oldest → newest (their life story). */
export async function getJourney(userId: string): Promise<JourneyData> {
  const rows = await prisma.profileMilestone.findMany({
    where: { userId },
    orderBy: { achievedAt: 'asc' },
  });

  const items: JourneyMilestone[] = rows.map((m) => ({
    id: m.id,
    type: m.type,
    title: m.title,
    detail: m.detail,
    emoji: m.emoji,
    achievedAt: m.achievedAt.toISOString(),
  }));

  return {
    items,
    count: items.length,
    startedAt: items[0]?.achievedAt ?? null,
  };
}
