import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';

// ─── Constants ────────────────────────────────────────

export const COIN_UNLOCK_COST = 10;
export const COIN_CHAPTER_REWARD = 2;

// ─── Types ────────────────────────────────────────────

export type CoinTxnType = 'earn' | 'spend' | 'purchase' | 'reward' | 'refund';

// ─── Helpers ──────────────────────────────────────────

/** Resolve an auth UID (from auth middleware) to a DB user id. */
export async function resolveUserId(firebaseUid: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { firebaseUid },
    select: { id: true },
  });
  if (!user) throw new NotFoundError('User');
  return user.id;
}

/**
 * Determine whether a chapter is currently locked (and if so, its unlock cost).
 * A chapter is locked when coinLocked is true AND freeAt has not passed.
 */
export function getChapterLockInfo(chapter: {
  coinLocked: boolean;
  freeAt: Date | null;
}): { locked: boolean; unlockCost: number | null } {
  const isFree = chapter.freeAt ? chapter.freeAt.getTime() <= Date.now() : false;
  const locked = chapter.coinLocked && !isFree;
  return { locked, unlockCost: locked ? COIN_UNLOCK_COST : null };
}

/** Check whether a user already paid to unlock a chapter. */
export async function isChapterUnlockedByUser(dbUserId: string, chapterId: string): Promise<boolean> {
  const txn = await prisma.coinTransaction.findFirst({
    where: { userId: dbUserId, type: 'spend', referenceId: chapterId },
  });
  return !!txn;
}

// ─── Ledger operations (atomic) ───────────────────────

export async function getCoinBalance(dbUserId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: dbUserId },
    select: { coinBalance: true },
  });
  return user?.coinBalance ?? 0;
}

export async function earnCoins(
  dbUserId: string,
  amount: number,
  type: CoinTxnType,
  referenceId?: string,
  description?: string,
): Promise<number> {
  if (amount <= 0) return getCoinBalance(dbUserId);

  const balance = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: dbUserId },
      data: { coinBalance: { increment: amount } },
      select: { coinBalance: true },
    });
    await tx.coinTransaction.create({
      data: {
        userId: dbUserId,
        amount,
        type,
        referenceId: referenceId || null,
        description: description || null,
      },
    });
    return updated.coinBalance;
  });

  return balance;
}

export interface DebitResult {
  ok: boolean;
  balance: number;
  error?: 'INSUFFICIENT_COINS';
}

/**
 * Atomically debit coins from a user's balance, writing the ledger entry,
 * inside an *existing* transaction. Callers pass their transaction client so
 * the spend is atomic with whatever else they do (vote insert, chapter
 * unlock). The guarded updateMany (coinBalance >= amount) prevents
 * double-spend races from concurrent requests.
 */
export async function debitCoins(
  tx: Prisma.TransactionClient,
  dbUserId: string,
  amount: number,
  type: CoinTxnType,
  referenceId?: string,
  description?: string,
): Promise<DebitResult> {
  const guarded = await tx.user.updateMany({
    where: { id: dbUserId, coinBalance: { gte: amount } },
    data: { coinBalance: { decrement: amount } },
  });
  if (guarded.count === 0) {
    const user = await tx.user.findUnique({
      where: { id: dbUserId },
      select: { coinBalance: true },
    });
    return { ok: false, balance: user?.coinBalance ?? 0, error: 'INSUFFICIENT_COINS' as const };
  }
  await tx.coinTransaction.create({
    data: {
      userId: dbUserId,
      amount: -amount,
      type,
      referenceId: referenceId || null,
      description: description || null,
    },
  });
  const user = await tx.user.findUnique({
    where: { id: dbUserId },
    select: { coinBalance: true },
  });
  return { ok: true, balance: user?.coinBalance ?? 0 };
}

// ─── Chapter unlock flow ──────────────────────────────

export interface UnlockResult {
  unlocked: boolean;
  balance: number;
  error?: 'INSUFFICIENT_COINS' | 'ALREADY_UNLOCKED' | 'NOT_LOCKED';
}

/**
 * Unlock a coin-locked chapter for a user.
 * Returns the new balance and whether the chapter is now accessible.
 */
export async function unlockChapter(
  dbUserId: string,
  chapterId: string,
): Promise<UnlockResult> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true, number: true, coinLocked: true, freeAt: true },
  });
  if (!chapter) throw new NotFoundError('Chapter', chapterId);

  const { locked, unlockCost } = getChapterLockInfo(chapter);
  if (!locked) {
    return { unlocked: true, balance: await getCoinBalance(dbUserId), error: 'NOT_LOCKED' };
  }

  const cost = unlockCost || COIN_UNLOCK_COST;

  // All-or-nothing: check already-unlocked + spend inside one SERIALIZABLE
  // transaction so concurrent unlock requests can't double-charge the user for
  // the same chapter. If a serialization conflict occurs (another unlock for the
  // same chapter committed first), retry once — the retry sees the existing
  // spend and returns ALREADY_UNLOCKED without charging.
  const run = () =>
    prisma.$transaction(
      async (tx) => {
        const already = await tx.coinTransaction.findFirst({
          where: { userId: dbUserId, type: 'spend', referenceId: chapterId },
        });
        if (already) {
          const user = await tx.user.findUnique({
            where: { id: dbUserId },
            select: { coinBalance: true },
          });
          return { unlocked: true, balance: user?.coinBalance ?? 0, error: 'ALREADY_UNLOCKED' as const };
        }

        const debit = await debitCoins(
          tx,
          dbUserId,
          cost,
          'spend',
          chapterId,
          `Unlocked Ch. ${chapter.number}`,
        );
        if (!debit.ok) {
          return { unlocked: false, balance: debit.balance, error: 'INSUFFICIENT_COINS' as const };
        }

        return { unlocked: true, balance: debit.balance };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

  // Bounded retry: P2034 (serialization failure) can fire when a concurrent
  // transaction touches the same user row. On retry the `already` check
  // naturally sees the committed spend and returns ALREADY_UNLOCKED without
  // charging; unrelated conflicts just succeed on the next attempt.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034')) {
        throw err;
      }
      lastErr = err;
    }
  }
  throw lastErr;
}
