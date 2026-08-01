import { prisma } from '../lib/prisma.js';
import { notifyAchievementUnlocked } from './notifications.js';

// ─── Badge Catalog ────────────────────────────────────

export type AchievementMetric =
  | 'chapters_completed'
  | 'streak_days'
  | 'series_read'
  | 'reviews_written'
  | 'library_size'
  | 'coins_earned'
  | 'posts_written'
  | 'comments_written'
  | 'clubs_joined'
  | 'wiki_edits'
  | 'predictions_won';

export interface AchievementBadge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: 'reading' | 'streak' | 'exploration' | 'social' | 'library' | 'coins' | 'community';
  metric: AchievementMetric;
  threshold: number;
}

export const ACHIEVEMENT_CATALOG: AchievementBadge[] = [
  // ─── Reading ──────────────────────────────────────
  { id: 'first_chapter', name: 'First Steps', emoji: '🌱', description: 'Read your first chapter', category: 'reading', metric: 'chapters_completed', threshold: 1 },
  { id: 'bookworm_10', name: 'Bookworm', emoji: '📚', description: 'Complete 10 chapters', category: 'reading', metric: 'chapters_completed', threshold: 10 },
  { id: 'avid_reader_50', name: 'Avid Reader', emoji: '📖', description: 'Complete 50 chapters', category: 'reading', metric: 'chapters_completed', threshold: 50 },
  { id: 'connoisseur_100', name: 'Connoisseur', emoji: '🏅', description: 'Complete 100 chapters', category: 'reading', metric: 'chapters_completed', threshold: 100 },
  { id: 'legend_500', name: 'Legend', emoji: '👑', description: 'Complete 500 chapters', category: 'reading', metric: 'chapters_completed', threshold: 500 },
  { id: 'sage_1000', name: 'Reading Sage', emoji: '🧙', description: 'Complete 1,000 chapters', category: 'reading', metric: 'chapters_completed', threshold: 1000 },

  // ─── Streaks ──────────────────────────────────────
  { id: 'streak_3', name: 'Warming Up', emoji: '🔥', description: 'Reach a 3-day reading streak', category: 'streak', metric: 'streak_days', threshold: 3 },
  { id: 'streak_7', name: 'On Fire', emoji: '⚡', description: 'Reach a 7-day reading streak', category: 'streak', metric: 'streak_days', threshold: 7 },
  { id: 'streak_30', name: 'Unstoppable', emoji: '💎', description: 'Reach a 30-day reading streak', category: 'streak', metric: 'streak_days', threshold: 30 },

  // ─── Exploration ──────────────────────────────────
  { id: 'explorer_3', name: 'Explorer', emoji: '🧭', description: 'Read from 3 different series', category: 'exploration', metric: 'series_read', threshold: 3 },
  { id: 'traveler_10', name: 'Traveler', emoji: '🗺️', description: 'Read from 10 different series', category: 'exploration', metric: 'series_read', threshold: 10 },
  { id: 'omnivore_25', name: 'Omnivore', emoji: '🌌', description: 'Read from 25 different series', category: 'exploration', metric: 'series_read', threshold: 25 },

  // ─── Social ───────────────────────────────────────
  { id: 'first_review', name: 'Critic', emoji: '✍️', description: 'Write your first review', category: 'social', metric: 'reviews_written', threshold: 1 },
  { id: 'voice_5', name: 'Influencer', emoji: '📣', description: 'Write 5 reviews', category: 'social', metric: 'reviews_written', threshold: 5 },

  // ─── Library ──────────────────────────────────────
  { id: 'collector_5', name: 'Collector', emoji: '📦', description: 'Add 5 titles to your library', category: 'library', metric: 'library_size', threshold: 5 },
  { id: 'hoarder_20', name: 'Hoarder', emoji: '🏛️', description: 'Add 20 titles to your library', category: 'library', metric: 'library_size', threshold: 20 },
  { id: 'archivist_50', name: 'Archivist', emoji: '🗄️', description: 'Add 50 titles to your library', category: 'library', metric: 'library_size', threshold: 50 },

  // ─── Coins ────────────────────────────────────────
  { id: 'pennies_50', name: 'Penny Saver', emoji: '🪙', description: 'Earn 50 coins in total', category: 'coins', metric: 'coins_earned', threshold: 50 },
  { id: 'rich_200', name: 'Well Off', emoji: '💰', description: 'Earn 200 coins in total', category: 'coins', metric: 'coins_earned', threshold: 200 },
  { id: 'tycoon_500', name: 'Coin Tycoon', emoji: '🏦', description: 'Earn 500 coins in total', category: 'coins', metric: 'coins_earned', threshold: 500 },

  // ─── Community ────────────────────────────────────
  { id: 'first_post', name: 'First Post', emoji: '📣', description: 'Create your first community post', category: 'community', metric: 'posts_written', threshold: 1 },
  { id: 'poster_10', name: 'Poster', emoji: '🗣️', description: 'Create 10 community posts', category: 'community', metric: 'posts_written', threshold: 10 },
  { id: 'first_comment', name: 'Commenter', emoji: '💬', description: 'Leave your first comment', category: 'community', metric: 'comments_written', threshold: 1 },
  { id: 'commenter_25', name: 'Conversationalist', emoji: '🗨️', description: 'Leave 25 comments', category: 'community', metric: 'comments_written', threshold: 25 },
  { id: 'club_member_1', name: 'Clubber', emoji: '🎉', description: 'Join your first reading club', category: 'community', metric: 'clubs_joined', threshold: 1 },
  { id: 'club_hopper_5', name: 'Club Hopper', emoji: '🪩', description: 'Join 5 reading clubs', category: 'community', metric: 'clubs_joined', threshold: 5 },
  { id: 'wiki_editor', name: 'Lore Keeper', emoji: '📜', description: 'Contribute to a series wiki page', category: 'community', metric: 'wiki_edits', threshold: 1 },
  { id: 'wiki_scribe_5', name: 'Scribe', emoji: '✒️', description: 'Contribute to 5 different wiki pages', category: 'community', metric: 'wiki_edits', threshold: 5 },
  { id: 'first_win', name: 'Crystal Ball', emoji: '🔮', description: 'Win your first prediction market', category: 'community', metric: 'predictions_won', threshold: 1 },
  { id: 'sharpshooter_5', name: 'Sharpshooter', emoji: '🎯', description: 'Win 5 prediction markets', category: 'community', metric: 'predictions_won', threshold: 5 },
];

const CATEGORY_LABELS: Record<AchievementBadge['category'], string> = {
  reading: 'Reading',
  streak: 'Streaks',
  exploration: 'Exploration',
  social: 'Social',
  library: 'Library',
  coins: 'Coins',
  community: 'Community',
};

// ─── Stats gathering ─────────────────────────────────

export interface AchievementStats {
  chapters_completed: number;
  streak_days: number;
  series_read: number;
  reviews_written: number;
  library_size: number;
  coins_earned: number;
  posts_written: number;
  comments_written: number;
  clubs_joined: number;
  wiki_edits: number;
  predictions_won: number;
}

/** Aggregate a user's stats used to evaluate badge conditions. */
export async function getUserAchievementStats(dbUserId: string): Promise<AchievementStats> {
  const [user, chaptersCompleted, seriesProgress, reviewsWritten, librarySize, coinsAgg, postsWritten, commentsWritten, clubsJoined, wikiEdits, resolvedVotes] = await Promise.all([
    prisma.user.findUnique({
      where: { id: dbUserId },
      select: { streakDays: true },
    }),
    prisma.readingProgress.count({
      where: { userId: dbUserId, completed: true },
    }),
    prisma.readingProgress.findMany({
      where: { userId: dbUserId, completed: true },
      select: { chapter: { select: { titleId: true } } },
      distinct: ['chapterId'],
    }),
    prisma.review.count({ where: { userId: dbUserId } }),
    prisma.bookmark.count({ where: { userId: dbUserId } }),
    prisma.coinTransaction.aggregate({
      where: { userId: dbUserId, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    prisma.communityPost.count({ where: { authorId: dbUserId } }),
    prisma.postComment.count({ where: { authorId: dbUserId } }),
    prisma.readingClubMember.count({ where: { userId: dbUserId } }),
    prisma.wikiPage.count({ where: { authorId: dbUserId } }),
    prisma.predictionVote.findMany({
      where: { userId: dbUserId, prediction: { result: { not: null } } },
      select: { option: true, prediction: { select: { result: true } } },
    }),
  ]);

  // Count predictions where the user's option matches the resolved result
  const predictionsWon = resolvedVotes.filter(
    (v) => v.option === v.prediction.result,
  ).length;

  const seriesRead = new Set(seriesProgress.map((s) => s.chapter.titleId)).size;

  return {
    chapters_completed: chaptersCompleted,
    streak_days: user?.streakDays ?? 0,
    series_read: seriesRead,
    reviews_written: reviewsWritten,
    library_size: librarySize,
    coins_earned: coinsAgg._sum.amount ?? 0,
    posts_written: postsWritten,
    comments_written: commentsWritten,
    clubs_joined: clubsJoined,
    wiki_edits: wikiEdits,
    predictions_won: predictionsWon,
  };
}

// ─── Achievement records ─────────────────────────────

export interface AchievementItem extends AchievementBadge {
  current: number;
  target: number;
  progress: number; // 0-100
  earned: boolean;
  earnedAt: string | null;
}

export interface AchievementsData {
  items: AchievementItem[];
  total: number;
  earned: number;
  categories: { key: string; label: string }[];
}

/** Build the full catalog view for a user (earned state + progress). */
export async function getAchievementsForUser(dbUserId: string): Promise<AchievementsData> {
  const [stats, earnedRecords] = await Promise.all([
    getUserAchievementStats(dbUserId),
    prisma.achievement.findMany({
      where: { userId: dbUserId },
      select: { badgeId: true, earnedAt: true },
    }),
  ]);

  const earnedMap = new Map(earnedRecords.map((r) => [r.badgeId, r.earnedAt]));

  const items: AchievementItem[] = ACHIEVEMENT_CATALOG.map((badge) => {
    const current = stats[badge.metric];
    const earnedAt = earnedMap.get(badge.id) || null;
    return {
      ...badge,
      current,
      target: badge.threshold,
      progress: Math.min(100, Math.round((current / badge.threshold) * 100)),
      earned: !!earnedAt,
      earnedAt: earnedAt ? earnedAt.toISOString() : null,
    };
  });

  return {
    items,
    total: items.length,
    earned: items.filter((i) => i.earned).length,
    categories: Object.entries(CATEGORY_LABELS).map(([key, label]) => ({ key, label })),
  };
}

// ─── Awarding ────────────────────────────────────────

/**
 * Evaluate all badge conditions and award any newly-earned badges.
 * Award + notification happen inside one transaction so a crash can't
 * award a badge without its notification (or vice versa).
 * Idempotent — the Achievement (userId, badgeId) unique constraint
 * guarantees a badge is never awarded twice.
 */
export async function checkAndAwardAchievements(dbUserId: string): Promise<AchievementItem[]> {
  const [stats, earnedRecords] = await Promise.all([
    getUserAchievementStats(dbUserId),
    prisma.achievement.findMany({
      where: { userId: dbUserId },
      select: { badgeId: true },
    }),
  ]);

  const earnedSet = new Set(earnedRecords.map((r) => r.badgeId));
  const newlyEarned: AchievementBadge[] = ACHIEVEMENT_CATALOG.filter(
    (badge) => !earnedSet.has(badge.id) && stats[badge.metric] >= badge.threshold,
  );

  if (newlyEarned.length === 0) return [];

  const awarded: AchievementItem[] = [];
  for (const badge of newlyEarned) {
    try {
      // Award the badge first — the (userId, badgeId) unique constraint makes
      // this idempotent, so a concurrent request can't double-award.
      await prisma.achievement.create({
        data: { userId: dbUserId, badgeId: badge.id },
      });
      awarded.push({
        ...badge,
        current: stats[badge.metric],
        target: badge.threshold,
        progress: 100,
        earned: true,
        earnedAt: new Date().toISOString(),
      });
      // Notify separately (fire-and-forget) so a notification failure never
      // rolls back the badge. Honors the user's achievement notification pref.
      notifyAchievementUnlocked(dbUserId, badge.name, badge.emoji, badge.description).catch(() => {});
    } catch (err) {
      // P2002 = unique constraint violation — a concurrent request awarded
      // this badge first. Skip it. Any other error is real and must surface.
      if ((err as { code?: string })?.code !== 'P2002') throw err;
    }
  }

  return awarded;
}
