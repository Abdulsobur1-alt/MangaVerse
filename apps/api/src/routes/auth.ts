import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { ConflictError } from '../lib/errors.js';

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

authRouter.post('/register', validate({ body: RegisterSchema }), async (req, res, next) => {
  try {
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

authRouter.post('/login', validate({ body: LoginSchema }), async (req, res, next) => {
  try {
    const { firebaseToken } = req.body;

    // TODO: Verify Firebase token in production
    // const decoded = await admin.auth().verifyIdToken(firebaseToken);
    // const { uid, email, name } = decoded;

    // Dev mode: use token as user lookup
    if (process.env.NODE_ENV === 'development') {
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
          token: `dev_${user.id}`,
        },
      });
      return;
    }

    res.status(501).json({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Firebase auth not configured' },
    });
  } catch (err) {
    next(err);
  }
});

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
