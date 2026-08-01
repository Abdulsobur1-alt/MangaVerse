import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { resolveUserId } from '../services/coins.js';

export const coinsRouter = Router();

// All coin routes require authentication
coinsRouter.use(requireAuth);

// ─── GET /api/coins ───────────────────────────────────
// Returns the current balance + recent coin transactions.

coinsRouter.get('/', async (req, res, next) => {
  try {
    const dbUserId = await resolveUserId(req.user!.uid);

    const [balance, recent] = await Promise.all([
      prisma.user.findUnique({
        where: { id: dbUserId },
        select: { coinBalance: true },
      }),
      prisma.coinTransaction.findMany({
        where: { userId: dbUserId },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    if (!balance) throw new NotFoundError('User');

    res.json({
      success: true,
      data: {
        balance: balance.coinBalance,
        transactions: recent.map((t) => ({
          id: t.id,
          amount: t.amount,
          type: t.type,
          referenceId: t.referenceId,
          description: t.description,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/coins/transactions ─────────────────────
// Paginated coin ledger history.

coinsRouter.get('/transactions', async (req, res, next) => {
  try {
    const dbUserId = await resolveUserId(req.user!.uid);

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.coinTransaction.findMany({
        where: { userId: dbUserId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.coinTransaction.count({ where: { userId: dbUserId } }),
    ]);

    res.json({
      success: true,
      data: {
        items: transactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          type: t.type,
          referenceId: t.referenceId,
          description: t.description,
          createdAt: t.createdAt.toISOString(),
        })),
        total,
        page,
        limit,
        hasMore: skip + transactions.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});
