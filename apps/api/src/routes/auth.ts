import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import { seedDemoNotifications } from '../services/notifications.js';
import { verifyFirebaseToken, firebaseConfigured } from '../lib/firebase.js';
import { config } from '../config/index.js';
import { checkAndRecordMilestones } from '../services/journey.js';

export const authRouter = Router();

// ─── Schemas ──────────────────────────────────────────

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50),
  firebaseUid: z.string().optional(),
});

const LoginSchema = z.object({
  firebaseToken: z.string().min(1),
});

// ─── POST /api/auth/register ─────────────────────────
// Local-dev only: creates a DB user without a Firebase account. The client
// does not call this endpoint when Firebase auth is configured. Exposing it
// in production would let anyone mint user rows with an arbitrary firebaseUid,
// so it's hard-gated behind config.devAuth.

authRouter.post('/register', validate({ body: RegisterSchema }), async (req, res, next) => {
  try {
    // Async handlers convert sync throws into rejected promises, which Express 4
    // does NOT catch — an unhandled rejection crashes the whole process. The
    // devAuth gate therefore lives inside the try so it flows to next(err).
    if (!config.devAuth) {
      throw new ForbiddenError('Registration is not available');
    }

    const { email, displayName, firebaseUid } = req.body;

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        firebaseUid,
      },
    });

    // Seed welcome notifications for new users (fire-and-forget, but caught —
    // an unhandled rejection on Node 22 crashes the whole process).
    seedDemoNotifications(user.id).catch((err) =>
      console.warn('⚠️  Could not seed welcome notifications:', (err as Error).message),
    );

    // The journey begins — the “Joined MangaVerse” milestone.
    checkAndRecordMilestones(user.id).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        coinBalance: user.coinBalance,
        subscriptionTier: user.subscriptionTier,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/login ────────────────────────────
// Verifies a Firebase ID token and returns the matching DB user.
// If the Firebase account has no DB row yet, one is created (upsert by uid).

authRouter.post('/login', validate({ body: LoginSchema }), async (req, res, next) => {
  try {
    const { firebaseToken } = req.body;

    // Dev fallback (config.devAuth — never in production): accept a dev token
    // formatted as dev_<dbUserId> so the full stack stays testable locally.
    if (config.devAuth && !firebaseConfigured()) {
      const user = await prisma.user.findFirst();
      if (!user) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTH_FAILED', message: 'No users found. Register first.' },
        });
        return;
      }
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          coinBalance: user.coinBalance,
          subscriptionTier: user.subscriptionTier,
          role: user.role,
          token: `dev_${user.id}`,
        },
      });
      return;
    }

    // Production: verify the Firebase ID token
    const decoded = await verifyFirebaseToken(firebaseToken);
    if (!decoded) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const email = decoded.email || `user-${decoded.uid.slice(0, 8)}@mangaverse.app`;
    const displayName = decoded.name || 'Reader';

    // Activity touch + journey seeding on every sign-in.
    void (async () => {
      try {
        const me = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid }, select: { id: true } });
        if (me) {
          await prisma.user.update({ where: { id: me.id }, data: { lastActiveAt: new Date() } });
          // Seed the journey only for accounts that have none yet (new or
          // pre-Phase-9) — never on every login.
          const milestoneCount = await prisma.profileMilestone.count({ where: { userId: me.id } });
          if (milestoneCount === 0) checkAndRecordMilestones(me.id).catch(() => {});
        }
      } catch { /* best-effort */ }
    })();

    try {
      const user = await prisma.user.upsert({
        where: { firebaseUid: decoded.uid },
        update: {
          email,
          ...(decoded.name ? { displayName: decoded.name } : {}),
        },
        create: {
          firebaseUid: decoded.uid,
          email,
          displayName,
        },
      });

      return sendUser(res, user, firebaseToken);
    } catch (err) {
      // P2002 on email: a legacy dev-mode row already exists with this email
      // but no firebaseUid. Attach the Firebase uid to that row instead of
      // failing — the migration path for pre-Firebase accounts.
      if ((err as { code?: string })?.code === 'P2002') {
        const existing = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, displayName: true, avatarUrl: true, coinBalance: true, role: true, subscriptionTier: true, streakDays: true, createdAt: true },
        });
        if (existing) {
          const user = await prisma.user.update({
            where: { id: existing.id },
            data: { firebaseUid: decoded.uid, ...(decoded.name ? { displayName: decoded.name } : {}) },
            select: { id: true, email: true, displayName: true, avatarUrl: true, coinBalance: true, role: true, subscriptionTier: true, streakDays: true, createdAt: true },
          });
          return sendUser(res, user, firebaseToken);
        }
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/** Serialize a DB user + Firebase token into the login response. */
function sendUser(
  res: Response,
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    coinBalance: number;
    role: string;
    subscriptionTier: string;
    streakDays: number;
    createdAt: Date;
  },
  firebaseToken: string,
) {
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
      createdAt: user.createdAt.toISOString(),
      token: firebaseToken,
    },
  });
}

// ─── GET /api/auth/me ─────────────────────────────────

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user!.uid },
      include: {
        _count: { select: { bookmarks: true } },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found in database' },
      });
      return;
    }

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
        libraryCount: user._count.bookmarks,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});
