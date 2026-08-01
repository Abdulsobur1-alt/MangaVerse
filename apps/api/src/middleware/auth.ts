import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

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
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return next(new UnauthorizedError('Missing or invalid authorization header'));
  }

  // TODO: Verify Firebase token when Firebase is configured
  // For now, extract the user ID from a dev token format
  if (process.env.NODE_ENV === 'development' && token.startsWith('dev_')) {
    req.user = {
      uid: token.replace('dev_', ''),
      email: 'dev@mangaverse.app',
      displayName: 'Developer',
    };
    return next();
  }

  // In production with Firebase configured:
  // try {
  //   const decoded = await admin.auth().verifyIdToken(token);
  //   req.user = { uid: decoded.uid, email: decoded.email || '', displayName: decoded.name };
  //   next();
  // } catch {
  //   next(new UnauthorizedError('Invalid or expired token'));
  // }

  next(new UnauthorizedError('Authentication not configured yet'));
}

/**
 * Optional auth — attaches user if token present, but doesn't block.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token && process.env.NODE_ENV === 'development' && token.startsWith('dev_')) {
    req.user = {
      uid: token.replace('dev_', ''),
      email: 'dev@mangaverse.app',
      displayName: 'Developer',
    };
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
