import { prisma } from '../lib/prisma.js';

/* ═══════════════════════════════════════════════════════════════
   Reputation — the trust system (Phase 9).
   Rewards quality contributions: helpful reviews, community
   participation, verified reports, curation. The raw score is opaque —
   public profiles expose only the tier, so reputation stays a signal
   of trust rather than a leaderboard.
   ═══════════════════════════════════════════════════════════════ */

export interface ReputationTier {
  key: string;
  label: string;
  emoji: string;
  min: number;
  description: string;
}

export const REPUTATION_TIERS: ReputationTier[] = [
  { key: 'newcomer', label: 'Newcomer', emoji: '🌱', min: 0, description: 'Every legend starts with a single page.' },
  { key: 'reader', label: 'Regular Reader', emoji: '📖', min: 25, description: 'A familiar face in the reading rooms.' },
  { key: 'trusted', label: 'Trusted Reader', emoji: '⭐', min: 100, description: 'The community knows your name.' },
  { key: 'esteemed', label: 'Esteemed Reader', emoji: '🏅', min: 250, description: 'Your takes carry weight around here.' },
  { key: 'veteran', label: 'Veteran Reader', emoji: '💎', min: 500, description: 'A cornerstone of the MangaVerse.' },
  { key: 'legend', label: 'Legendary Reader', emoji: '👑', min: 1000, description: 'A living part of the site’s history.' },
];

export interface ReputationSignal {
  key: string;
  label: string;
  points: number;
  weight: number;
}

export interface ReputationData {
  score: number;
  tier: ReputationTier;
  signals: ReputationSignal[];
}

/** Compute (and persist) a user's reputation from quality signals. */
export async function computeReputation(userId: string): Promise<ReputationData> {
  const [helpfulVotes, reviewsWritten, postsWritten, commentsWritten, listLikes, followers, wikiEdits, predictionsWon, reportsResolved, chapters, publicCollections] = await Promise.all([
    // Helpful votes received on this user's reviews.
    prisma.reviewVote.count({ where: { review: { userId } } }),
    prisma.review.count({ where: { userId } }),
    prisma.communityPost.count({ where: { authorId: userId } }),
    prisma.postComment.count({ where: { authorId: userId } }),
    prisma.userListLike.count({ where: { list: { userId } } }),
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.wikiRevision.count({ where: { authorId: userId } }),
    prisma.predictionVote
      .findMany({
        where: { userId, prediction: { result: { not: null } } },
        select: { option: true, prediction: { select: { result: true } } },
        take: 200,
      })
      .then((votes) => votes.filter((v) => v.option === v.prediction.result).length),
    prisma.contentReport.count({ where: { reporterId: userId, status: 'resolved' } }),
    prisma.readingProgress.count({ where: { userId, completed: true } }),
    prisma.collection.count({ where: { userId, isPrivate: false } }),
  ]);

  const signals: ReputationSignal[] = [
    { key: 'helpful', label: 'Helpful reviews', points: helpfulVotes * 3, weight: 3 },
    { key: 'reviews', label: 'Reviews written', points: reviewsWritten * 2, weight: 2 },
    { key: 'posts', label: 'Community posts', points: postsWritten * 2, weight: 2 },
    { key: 'comments', label: 'Discussion replies', points: commentsWritten * 1, weight: 1 },
    { key: 'curation', label: 'Liked lists', points: listLikes * 2, weight: 2 },
    { key: 'followers', label: 'Followers', points: followers * 1, weight: 1 },
    { key: 'wiki', label: 'Wiki contributions', points: wikiEdits * 2, weight: 2 },
    { key: 'predictions', label: 'Prediction wins', points: predictionsWon * 2, weight: 2 },
    { key: 'reports', label: 'Verified reports', points: reportsResolved * 3, weight: 3 },
    { key: 'expertise', label: 'Reading expertise', points: Math.min(25, Math.floor(chapters / 20)), weight: 1 },
    { key: 'curator', label: 'Public collections', points: publicCollections * 1, weight: 1 },
  ];

  const score = Math.round(signals.reduce((sum, s) => sum + s.points, 0));
  const tier = [...REPUTATION_TIERS].reverse().find((t) => score >= t.min) ?? REPUTATION_TIERS[0];

  // Persist (opaque) so profile queries don't recompute every time.
  await prisma.user.update({ where: { id: userId }, data: { reputation: score } }).catch(() => {});

  return { score, tier, signals };
}

/** Tier lookup without any computation — for cheap public display. */
export function tierForScore(score: number): ReputationTier {
  return [...REPUTATION_TIERS].reverse().find((t) => score >= t.min) ?? REPUTATION_TIERS[0];
}
