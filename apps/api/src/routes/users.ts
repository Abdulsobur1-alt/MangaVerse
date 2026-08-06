import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';

export const usersRouter = Router();

// All user routes require authentication
usersRouter.use(requireAuth);

// ─── Schemas ──────────────────────────────────────────

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
});

const UpdatePrefsSchema = z.object({
  new_chapter: z.boolean().optional(),
  reviews: z.boolean().optional(),
  milestones: z.boolean().optional(),
  achievements: z.boolean().optional(),
});

const DEFAULT_NOTIF_PREFS = {
  new_chapter: true,
  reviews: true,
  milestones: true,
  achievements: true,
};

// ─── GET /api/users/profile ───────────────────────────

usersRouter.get('/profile', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      include: {
        _count: {
          select: {
            bookmarks: true,
            reviews: true,
            readingProgress: true,
            achievements: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundError('User');

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        coinBalance: user.coinBalance,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        streakDays: user.streakDays,
        stats: user._count,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/users/profile ───────────────────────────

usersRouter.put('/profile', validate({ body: UpdateProfileSchema }), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    const updates: Record<string, unknown> = {};
    const body = req.body as z.infer<typeof UpdateProfileSchema>;

    if (body.displayName !== undefined) updates.displayName = body.displayName;
    if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' },
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updates,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        coinBalance: true,
        role: true,
        subscriptionTier: true,
        streakDays: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl,
        coinBalance: updated.coinBalance,
        role: updated.role,
        subscriptionTier: updated.subscriptionTier,
        streakDays: updated.streakDays,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/users/preferences ─────────────────────

usersRouter.get('/preferences', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { notificationPrefs: true },
    });
    if (!user) throw new NotFoundError('User');

    const prefs = user.notificationPrefs as Record<string, boolean> | null;

    res.json({
      success: true,
      data: {
        ...DEFAULT_NOTIF_PREFS,
        ...(prefs || {}),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/users/preferences ───────────────────────

usersRouter.put('/preferences', validate({ body: UpdatePrefsSchema }), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    const body = req.body as z.infer<typeof UpdatePrefsSchema>;
    const currentPrefs = await prisma.user.findUnique({
      where: { id: user.id },
      select: { notificationPrefs: true },
    });

    const existingPrefs = (currentPrefs?.notificationPrefs as Record<string, boolean>) || {};
    const updatedPrefs = {
      ...DEFAULT_NOTIF_PREFS,
      ...existingPrefs,
      ...body,
    };

    await prisma.user.update({
      where: { id: user.id },
      data: { notificationPrefs: updatedPrefs as any },
    });

    res.json({ success: true, data: updatedPrefs });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/users/prefs ────────────────────────────
// Personalization preferences (library view, preferred genres, homepage
// recommendations). Synced across devices — unlike the transient UI state.

const DEFAULT_PREFS = {
  libraryView: 'grid',
  preferredGenres: [] as string[],
  homepageRecs: true,
  cardDensity: 'cozy',
  publicProfile: true,
  shareActivity: true,
};

const UpdatePersonalPrefsSchema = z.object({
  libraryView: z.enum(['grid', 'list', 'compact']).optional(),
  preferredGenres: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  homepageRecs: z.boolean().optional(),
  cardDensity: z.enum(['cozy', 'compact']).optional(),
  publicProfile: z.boolean().optional(),
  shareActivity: z.boolean().optional(),
});

usersRouter.get('/prefs', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { prefs: true },
    });
    if (!user) throw new NotFoundError('User');

    const prefs = user.prefs as Record<string, unknown> | null;
    res.json({
      success: true,
      data: {
        ...DEFAULT_PREFS,
        ...(prefs || {}),
      },
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.put('/prefs', validate({ body: UpdatePersonalPrefsSchema }), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true, prefs: true },
    });
    if (!user) throw new NotFoundError('User');

    const body = req.body as z.infer<typeof UpdatePersonalPrefsSchema>;
    const existing = user.prefs as Record<string, unknown> | null;
    const updatedPrefs = {
      ...DEFAULT_PREFS,
      ...(existing || {}),
      ...body,
    };

    await prisma.user.update({
      where: { id: user.id },
      data: { prefs: updatedPrefs as any },
    });

    res.json({ success: true, data: updatedPrefs });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/users/account ─────────────────────────

usersRouter.delete('/account', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    // Delete user — cascading deletes will handle related records
    await prisma.user.delete({ where: { id: user.id } });

    res.json({ success: true, data: { message: 'Account deleted successfully' } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/users/stats ─────────────────────────────

usersRouter.get('/stats', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      include: {
        _count: {
          select: {
            bookmarks: true,
            reviews: true,
            readingProgress: { where: { completed: true } },
            achievements: true,
            coinTransactions: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundError('User');

    // Get streak calendar (last 28 days)
    const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const readingDays = await prisma.readingProgress.findMany({
      where: {
        userId: user.id,
        updatedAt: { gte: twentyEightDaysAgo },
      },
      select: { updatedAt: true },
      distinct: ['updatedAt'],
    });

    const readingDates = new Set(
      readingDays.map((d: { updatedAt: Date }) => d.updatedAt.toISOString().split('T')[0]),
    );

    res.json({
      success: true,
      data: {
        chaptersRead: user._count.readingProgress,
        totalBookmarks: user._count.bookmarks,
        totalReviews: user._count.reviews,
        totalAchievements: user._count.achievements,
        totalTransactions: user._count.coinTransactions,
        streakDays: user.streakDays,
        readingCalendar: Array.from({ length: 28 }, (_, i) => {
          const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          return { date: dateStr, read: readingDates.has(dateStr) };
        }),
      },
    });
  } catch (err) {
    next(err);
  }
});
