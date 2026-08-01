import { prisma } from '../lib/prisma.js';
import { notifyPredictionResolved } from './notifications.js';
import { checkAndAwardAchievements } from './achievements.js';

// ─── Payout math ──────────────────────────────────────

/**
 * Parimutuel payout for a winning bettor.
 *
 * The total pot is the sum of all stakes. Winners (those who backed the
 * winning option) get their stake back plus a proportional share of the
 * losers' stakes:
 *
 *   return = stake + floor(stake * loserPool / winningPool)
 *
 * If nobody backed the winning option, the pot is not paid out.
 */
export function computePredictionReturn(
  stake: number,
  winningPool: number,
  loserPool: number,
): number {
  if (winningPool <= 0) return 0;
  return stake + Math.floor((stake * loserPool) / winningPool);
}

// ─── Resolution ───────────────────────────────────────

export interface ResolveResult {
  resolved: boolean; // false = already resolved or missing
  payouts: number;   // total coins paid out (winnings only, not stake returns)
}

/**
 * Resolve a single prediction with a winning option.
 *
 * Idempotent: the `updateMany ... where result: null` acts as an atomic guard
 * inside the transaction, so concurrent resolutions can't double-pay — the
 * second caller sees 0 claimed rows and does nothing.
 */
export async function resolvePrediction(
  predictionId: string,
  result: string,
): Promise<ResolveResult> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.prediction.updateMany({
      where: { id: predictionId, result: null },
      data: { result },
    });
    if (claimed.count === 0) return { resolved: false, payouts: 0 };

    const prediction = await tx.prediction.findUnique({
      where: { id: predictionId },
      select: { question: true },
    });
    if (!prediction) return { resolved: false, payouts: 0 };

    const votes = await tx.predictionVote.findMany({ where: { predictionId } });

    const winningPool = votes
      .filter((v) => v.option === result)
      .reduce((a, v) => a + v.coinsStaked, 0);
    const totalStaked = votes.reduce((a, v) => a + v.coinsStaked, 0);
    const loserPool = totalStaked - winningPool;

    // Pay out winners: winnings = return - stake. Losers get nothing.
    const winners: { userId: string; winnings: number }[] = [];
    for (const v of votes) {
      if (v.option !== result) continue;
      const returned = computePredictionReturn(v.coinsStaked, winningPool, loserPool);
      const winnings = returned - v.coinsStaked;
      if (winnings <= 0) continue;

      await tx.user.update({
        where: { id: v.userId },
        data: { coinBalance: { increment: winnings } },
      });
      await tx.coinTransaction.create({
        data: {
          userId: v.userId,
          amount: winnings,
          type: 'reward',
          referenceId: predictionId,
          description: `Prediction won: ${prediction.question}`,
        },
      });
      winners.push({ userId: v.userId, winnings });
    }

    const payouts = winners.reduce((a, w) => a + w.winnings, 0);

    // Fire-and-forget: notify all voters of the outcome (win/lose). Winners
    // also get checked for prediction-win achievements.
    const userIds = votes.map((v) => v.userId);
    const winMap = new Map(winners.map((w) => [w.userId, w.winnings]));
    notifyAllVoters(prediction.question, result, userIds, winMap).catch(() => {});
    for (const w of winners) {
      checkAndAwardAchievements(w.userId).catch(() => {});
    }

    return { resolved: true, payouts };
  });
}

/**
 * Resolve all predictions whose `resolvesAt` has passed and that have no
 * result yet. The winning option is the plurality pick (highest total stake);
 * ties break to the first-listed option. Predictions with zero votes resolve
 * to the first option with no payouts.
 */
export async function resolveDuePredictions(): Promise<number> {
  const due = await prisma.prediction.findMany({
    where: { result: null, resolvesAt: { lte: new Date() } },
    select: { id: true },
  });

  let resolved = 0;
  for (const p of due) {
    try {
      const pred = await prisma.prediction.findUnique({
        where: { id: p.id },
        select: { options: true },
      });
      if (!pred) continue;

      const votes = await prisma.predictionVote.findMany({
        where: { predictionId: p.id },
        select: { option: true, coinsStaked: true },
      });

      // Aggregate stakes per option
      const stakeMap = new Map<string, number>();
      for (const v of votes) {
        stakeMap.set(v.option, (stakeMap.get(v.option) || 0) + v.coinsStaked);
      }

      // Plurality winner; ties break to the first-listed option. With zero
      // votes the first option wins (no payouts).
      let winner = pred.options[0] || 'Resolved';
      let best = -1;
      for (const option of pred.options) {
        const stake = stakeMap.get(option) || 0;
        if (stake > best) {
          best = stake;
          winner = option;
        }
      }

      const outcome = await resolvePrediction(p.id, winner);
      if (outcome.resolved) resolved++;
    } catch {
      // Skip individual failures — next run will retry
    }
  }

  return resolved;
}

// ─── Voter notifications ──────────────────────────────

/** Notify every voter whether they won or lost. */
async function notifyAllVoters(
  question: string,
  winningOption: string,
  userIds: string[],
  winMap: Map<string, number>,
): Promise<void> {
  for (const userId of userIds) {
    const winnings = winMap.get(userId);
    await notifyPredictionResolved(
      userId,
      question,
      winningOption,
      winnings !== undefined,
      winnings || 0,
    );
  }
}
