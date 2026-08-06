import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError, ConflictError, ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import { seedDemoNotifications } from '../services/notifications.js';
import { verifySupabaseToken, supabaseConfigured } from '../lib/supabase.js';
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
  authToken: z.string().min(1),
});

// ─── POST /api/auth/register ─────────────────────────
// Local-dev only: creates a DB user without an auth-provider account. The
// client does not call this endpoint when Supabase auth is configured.
// Exposing it in production would let anyone mint user rows with an
// arbitrary auth uid, so it's hard-gated behind config.devAuth.

authRouter.post('/register', validate({ body: RegisterSchema }), async (req, res, next) => {
  try {
    // Async handlers convert sync throws into rejected promises, which Express 4
    // does NOT catch — an unhandled rejection crashes the whole process. The
    // devAuth gate therefore lives inside the try so it flows to next(err).
    if (!config.devAuth) {
      throw new ForbiddenError(
        'Sign-ups are currently disabled. Configure Supabase auth on the server (SUPABASE_URL), or run with DEV_AUTH=1 in development.',
      );
    }

    const { email, displayName, firebaseUid } = req.body;

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    // The first account registered in dev mode becomes the local admin — dev
    // login always returns the first user, so this gives the person running
    // the stack one admin account to explore the Phase 11 admin console.
    const wasFirstUser = (await prisma.user.count()) === 0;

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        firebaseUid: firebaseUid ?? null,
        ...(wasFirstUser && config.devAuth ? { role: 'admin' } : {}),
      },
    });

    // Dev mode aliases firebaseUid to the user's own db id (always — even if
    // a caller supplied one), because the dev token is dev_<dbUserId> and
    // every authed route + the realtime hub resolve tokens through
    // findUnique({ firebaseUid }). Without this the local stack 404s on
    // every authenticated call.
    if (config.devAuth && !supabaseConfigured()) {
      await prisma.user.update({ where: { id: user.id }, data: { firebaseUid: user.id } });
    }

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
// Verifies a Supabase access token and returns the matching DB user.
// If the Supabase account has no DB row yet, one is created (upsert by uid).

authRouter.post('/login', validate({ body: LoginSchema }), async (req, res, next) => {
  try {
    const { authToken } = req.body;

    // Dev fallback (config.devAuth — never in production): accept a dev token
    // formatted as dev_<dbUserId> so the full stack stays testable locally.
    if (config.devAuth && !supabaseConfigured()) {
      // Deterministic + admin-preferring: sign in lands on the oldest admin
      // (stable across runs — findFirst() without ORDER BY is arbitrary in
      // Postgres), falling back to the oldest user when no admin exists yet.
      let user =
        (await prisma.user.findFirst({
          where: { role: { in: ['admin', 'super_admin', 'platform_admin'] } },
          orderBy: { createdAt: 'asc' },
        })) ??
        (await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } }));
      if (!user) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTH_FAILED', message: 'No users found. Register first.' },
        });
        return;
      }
      // Same firebaseUid alias as register — makes dev_<dbUserId> tokens
      // resolve for rows created before this backfill existed.
      if (!user.firebaseUid) {
        user = await prisma.user.update({ where: { id: user.id }, data: { firebaseUid: user.id } });
      }

      // Dev convenience: if no admin exists on the stack yet, promote the
      // first user so the Phase 11 admin console is reachable by simply
      // signing in. Prod flow untouched (devAuth is never on there).
      const adminCount = await prisma.user.count({ where: { role: { in: ['admin', 'super_admin', 'platform_admin'] } } });
      if (adminCount === 0) {
        user = await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
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

    // Production: verify the Supabase access token. If the project URL is
    // missing, no token can ever verify — fail with an actionable config
    // error instead of the misleading 'Invalid or expired token'.
    if (!supabaseConfigured()) {
      throw new AppError(
        503,
        'AUTH_NOT_CONFIGURED',
        'Supabase auth is not configured on the server (SUPABASE_URL is missing). ' +
          'Set it in the API service environment to enable sign-in, or run locally with DEV_AUTH=1.',
      );
    }
    const decoded = await verifySupabaseToken(authToken);
    if (!decoded) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const email = decoded.email || `user-${decoded.uid.slice(0, 8)}@mangaverse.app`;
    const displayName = decoded.displayName || 'Reader';

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
          ...(decoded.displayName ? { displayName: decoded.displayName } : {}),
        },
        create: {
          firebaseUid: decoded.uid,
          email,
          displayName,
        },
      });

      return sendUser(res, user, authToken);
    } catch (err) {
      // P2002 on email: a legacy dev-mode row already exists with this email
      // but no auth uid. Attach the provider uid to that row instead of
      // failing — the migration path for accounts created before a provider
      // was configured.
      if ((err as { code?: string })?.code === 'P2002') {
        const existing = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, displayName: true, avatarUrl: true, coinBalance: true, role: true, subscriptionTier: true, streakDays: true, createdAt: true },
        });
        if (existing) {
          const user = await prisma.user.update({
            where: { id: existing.id },
            data: { firebaseUid: decoded.uid, ...(decoded.displayName ? { displayName: decoded.displayName } : {}) },
            select: { id: true, email: true, displayName: true, avatarUrl: true, coinBalance: true, role: true, subscriptionTier: true, streakDays: true, createdAt: true },
          });
          return sendUser(res, user, authToken);
        }
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/** Serialize a DB user + auth token into the login response. */
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
  authToken: string,
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
      token: authToken,
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
