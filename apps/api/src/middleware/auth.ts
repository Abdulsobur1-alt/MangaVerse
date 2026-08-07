import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { verifySupabaseToken, supabaseConfigured } from '../lib/supabase.js';
import { config } from '../config/index.js';
import { effectiveRoles } from '../services/rbac.js';

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
 * Middleware that requires a valid auth token (Supabase access token in
 * production, `dev_` token in dev mode).
 * The token must be sent as `Authorization: Bearer <token>`.
 *
 * In production the token is a Supabase access token verified against the
 * project's JWKS. In development a `dev_<uid>` token is accepted so the
 * full stack remains testable locally — but ONLY when dev auth is
 * explicitly enabled (config.devAuth). It is never enabled in production.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return next(new UnauthorizedError('Missing or invalid authorization header'));
  }

  try {
    let uid: string;
    let email: string;
    let displayName: string | undefined;

    // Dev token flow (config.devAuth is only true locally)
    if (config.devAuth && !supabaseConfigured() && token.startsWith('dev_')) {
      uid = token.replace('dev_', '');
      email = 'dev@mangaverse.app';
      displayName = 'Developer';
    } else {
      // Production: verify the Supabase access token
      const decoded = await verifySupabaseToken(token);
      if (!decoded) {
        return next(new UnauthorizedError('Invalid or expired token'));
      }
      uid = decoded.uid;
      email = decoded.email || '';
      displayName = decoded.displayName || undefined;
    }

    // Phase 11 moderation gate: banned accounts and active suspensions are
    // blocked at the auth boundary, so every authed route is covered.
    const dbUser = await prisma.user.findUnique({
      where: { firebaseUid: uid },
      select: { id: true, bannedAt: true, suspendedUntil: true },
    });
    if (!dbUser) {
      return next(new UnauthorizedError('Account not found'));
    }
    if (dbUser.bannedAt) {
      return next(new ForbiddenError('This account has been banned'));
    }
    if (dbUser.suspendedUntil && dbUser.suspendedUntil > new Date()) {
      return next(new ForbiddenError('This account is temporarily suspended'));
    }

    req.user = { uid, email, displayName, dbUserId: dbUser.id };
    next();
  } catch (err) {
    if (err instanceof ForbiddenError) return next(err);
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
    let uid: string | null = null;
    let email = '';
    let displayName: string | undefined;

    if (config.devAuth && !supabaseConfigured() && token.startsWith('dev_')) {
      uid = token.replace('dev_', '');
      email = 'dev@mangaverse.app';
      displayName = 'Developer';
    } else {
      const decoded = await verifySupabaseToken(token);
      if (decoded) {
        uid = decoded.uid;
        email = decoded.email || '';
        displayName = decoded.displayName || undefined;
      }
    }

    // Banned/suspended users are treated as anonymous on public routes
    // (they must never leak into profile views or feeds while gated).
    if (uid) {
      const dbUser = await prisma.user.findUnique({
        where: { firebaseUid: uid },
        select: { id: true, bannedAt: true, suspendedUntil: true },
      });
      if (!dbUser || dbUser.bannedAt || (dbUser.suspendedUntil && dbUser.suspendedUntil > new Date())) {
        uid = null;
      } else {
        req.user = { uid, email, displayName, dbUserId: dbUser.id };
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
 * Multi-role aware: ANY held role (User.roles) matching the gate admits the
 * user, with the legacy single `role` column as fallback for pre-migration
 * rows. An 'admin' gate also admits the granular admin-equivalent roles
 * (platform_admin, super_admin) so canonical RBAC roles can use the console.
 */
export function requireRole(...roles: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.uid) {
        return next(new UnauthorizedError('Missing or invalid authorization header'));
      }

      const user = await prisma.user.findUnique({
        where: { firebaseUid: req.user.uid },
        select: { role: true, roles: true },
      });

      // Expand the requested roles with their equivalents: an 'admin' gate
      // must not lock out super_admin/platform_admin accounts.
      const allowed = new Set<string>();
      for (const r of roles) {
        allowed.add(r);
        if (r === 'admin') {
          allowed.add('platform_admin');
          allowed.add('super_admin');
        }
      }

      if (!user || !effectiveRoles(user).some((r) => allowed.has(r))) {
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
