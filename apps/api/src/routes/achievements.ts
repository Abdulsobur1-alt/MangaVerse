import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { getAchievementsForUser } from '../services/achievements.js';

export const achievementsRouter = Router();

// All achievement routes require authentication
achievementsRouter.use(requireAuth);

// ─── GET /api/achievements ───────────────────────────
// Returns the full badge catalog with per-user earned state + progress.

achievementsRouter.get('/', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    const data = await getAchievementsForUser(user.id);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
