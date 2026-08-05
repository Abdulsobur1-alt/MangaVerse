import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { verifyFirebaseToken, firebaseConfigured } from '../lib/firebase.js';
import { config } from '../config/index.js';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        displayName?: string;
        dbUserId?: string;
      };
    }
  }
}

export type UserRole = 'user' | 'moderator' | 'admin';

/**
 * Middleware that requires a valid Firebase auth token.
 * The token must be sent as `Authorization: Bearer <token>`.
 *
 * In production the token is a Firebase ID token verified via firebase-admin.
 * In development a `dev_<uid>` token is accepted so the full stack remains
 * testable locally — but ONLY when dev auth is explicitly enabled
 * (config.devAuth). It is never enabled in production.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return next(new UnauthorizedError('Missing or invalid authorization header'));
  }

  try {
    // Dev token flow (config.devAuth is only true locally)
    if (config.devAuth && !firebaseConfigured() && token.startsWith('dev_')) {
      req.user = {
        uid: token.replace('dev_', ''),
        email: 'dev@mangaverse.app',
        displayName: 'Developer',
      };
      return next();
    }

    // Production: verify the Firebase ID token
    const decoded = await verifyFirebaseToken(token);
    if (!decoded) {
      return next(new UnauthorizedError('Invalid or expired token'));
    }
    req.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      displayName: decoded.name || undefined,
    };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

/**
 * Optional auth — attaches user if a valid token is present, but never blocks.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    if (config.devAuth && !firebaseConfigured() && token.startsWith('dev_')) {
      req.user = {
        uid: token.replace('dev_', ''),
        email: 'dev@mangaverse.app',
        displayName: 'Developer',
      };
    } else {
      const decoded = await verifyFirebaseToken(token);
      if (decoded) {
        req.user = {
          uid: decoded.uid,
          email: decoded.email || '',
          displayName: decoded.name || undefined,
        };
      }
    }
  } catch {
    // Invalid token — treat as anonymous
  }
  next();
}

/**
 * Require the authenticated user to hold one of the given roles.
 * Must be composed AFTER requireAuth (or optionalAuth) — reads req.user.uid.
 */
export function requireRole(...roles: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.uid) {
        return next(new UnauthorizedError('Missing or invalid authorization header'));
      }

      const user = await prisma.user.findUnique({
        where: { firebaseUid: req.user.uid },
        select: { role: true },
      });

      if (!user || !roles.includes(user.role as UserRole)) {
        return next(new ForbiddenError('You do not have permission to perform this action'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}
