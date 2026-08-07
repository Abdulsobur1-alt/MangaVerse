import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

/* ═══════════════════════════════════════════════════════════════
   RBAC — the Phase 11 permission system.
   • Granular permissions are `<resource>:<action>` strings, e.g.
     "titles:publish", "users:ban", "flags:manage", "audit:read".
   • Every role maps to a base permission set; individual users can
     extend/trim it via `rolePermissions` (add "x:y", remove "-x:y").
   • Wildcards: "titles:*" covers every action on titles.
   • Multi-role: accounts hold 1+ roles in `User.roles` (primary = roles[0],
     mirrored to the legacy `User.role`). The matrix UNIONS permissions
     across every held role — a moderator who is also an editor keeps both
     permission sets.
   • requirePermission(...) gates routes AND enforces bans/suspensions.
   Legacy roles ("user"/"moderator"/"admin") keep working — they map
   onto the matrix (admin ≈ platform_admin, moderator ≈ moderator).
   ═══════════════════════════════════════════════════════════════ */

export interface RoleMeta {
  key: string;
  label: string;
  description: string;
}

export const ROLES: RoleMeta[] = [
  { key: 'super_admin', label: 'Super Admin', description: 'Full control incl. impersonation and role management' },
  { key: 'platform_admin', label: 'Platform Admin', description: 'Operates the entire platform' },
  { key: 'content_manager', label: 'Content Manager', description: 'CMS, media, editorial picks, publishing' },
  { key: 'editor', label: 'Editor', description: 'Writes and publishes content' },
  { key: 'moderator', label: 'Moderator', description: 'Resolves reports, moderates community' },
  { key: 'support_agent', label: 'Support Agent', description: 'Handles support tickets' },
  { key: 'data_analyst', label: 'Data Analyst', description: 'Reads analytics and exports data' },
  { key: 'translator', label: 'Translator', description: 'Updates title and chapter translations' },
  { key: 'uploader', label: 'Uploader', description: 'Uploads chapters and media' },
  { key: 'qa_tester', label: 'QA Tester', description: 'Read-only access to preview and health' },
  { key: 'guest_admin', label: 'Guest Admin', description: 'Read-only dashboard, reports and audit' },
];

export const LEGACY_ROLE_MAP: Record<string, string> = {
  user: 'user',
  moderator: 'moderator',
  admin: 'platform_admin',
};

// ─── Permission matrix ────────────────────────────────

const RESOURCES = ['dashboard', 'titles', 'chapters', 'media', 'picks', 'moderation', 'users', 'roles', 'flags', 'audit', 'tickets', 'analytics', 'health', 'settings', 'announcements', 'notifications'];
const ACTIONS = ['read', 'create', 'update', 'delete', 'approve', 'reject', 'publish', 'archive', 'restore', 'export', 'act', 'assign', 'manage', 'impersonate'];

function all(resource: string): string[] {
  return ACTIONS.map((a) => `${resource}:${a}`);
}

export const ALL_PERMISSIONS: string[] = RESOURCES.flatMap(all);

const BASE: Record<string, string[]> = {
  super_admin: ['*'],
  platform_admin: [...RESOURCES.filter((r) => r !== 'roles').flatMap(all), 'roles:read', 'roles:manage', 'impersonate:read', 'impersonate:act'],
  content_manager: [
    ...all('dashboard'),
    ...all('titles'),
    ...all('chapters'),
    ...all('media'),
    ...all('picks'),
    'content:export',
    'analytics:read',
  ],
  // Full content self-management: staff create, edit, publish, delete and
  // arrange titles/chapters. "Staff self-manage" — no extra hierarchy
  // beyond the role itself (admins only assign roles).
  editor: [
    'dashboard:read',
    ...all('titles'),
    ...all('chapters'),
    ...all('media'),
    ...all('picks'),
    'content:export',
    'analytics:read',
  ],
  // Uploaders are content staff too: full create/edit/delete on titles,
  // chapters and media (the "upload" role).
  uploader: [
    ...all('titles'),
    ...all('chapters'),
    ...all('media'),
  ],
  // Moderators manage community AND content: the user's staff model assigns
  // moderator/editor/uploader roles and expects all three to upload, edit
  // and arrange every series (full titles/chapters/media CRUD) plus the
  // community moderation duties.
  moderator: [
    'dashboard:read',
    ...all('titles'),
    ...all('chapters'),
    ...all('media'),
    'moderation:read', 'moderation:act', 'moderation:approve', 'moderation:reject',
    'users:read', 'users:update',
    'reports:read', 'reports:act',
    'posts:read', 'posts:delete',
    'comments:read', 'comments:delete',
    'wiki:read', 'wiki:update',
    'audit:read',
  ],
  support_agent: ['tickets:read', 'tickets:create', 'tickets:update', 'tickets:assign', 'users:read', 'reports:read'],
  data_analyst: ['dashboard:read', 'analytics:read', 'content:export', 'audit:read'],
  translator: ['titles:read', 'titles:update', 'chapters:read', 'chapters:update'],
  qa_tester: ['dashboard:read', 'health:read', 'titles:read', 'chapters:read', 'flags:read', 'analytics:read'],
  guest_admin: ['dashboard:read', 'users:read', 'reports:read', 'audit:read', 'analytics:read', 'health:read', 'titles:read', 'flags:read'],
};

/** Base permission set for a role key (legacy roles mapped). */
export function basePermissions(role: string): string[] {
  const key = LEGACY_ROLE_MAP[role] ?? role;
  return BASE[key] ?? [];
}

/**
 * Roles effective for a user: the `roles` list when populated (multi-role),
 * otherwise the legacy single `role` column (pre-migration rows).
 */
export function effectiveRoles(user: { role: string; roles?: string[] | null }): string[] {
  if (Array.isArray(user.roles) && user.roles.length > 0) return [...new Set(user.roles)];
  return [user.role];
}

/**
 * Effective permissions for a user holding MULTIPLE roles: base permission
 * sets are unioned across every entry, so the RBAC matrix composes. A
 * `['*']` set (super_admin) short-circuits to everything. The per-user
 * rolePermissions override is applied once to the union ("x:y" adds,
 * "-x:y" removes).
 */
export function permissionsForRoles(roles: string[], override: unknown): string[] {
  const perms = new Set<string>();
  for (const role of roles) {
    const base = basePermissions(role);
    if (base.includes('*')) return ['*'];
    for (const p of base) perms.add(p);
  }
  if (!Array.isArray(override)) return [...perms];
  for (const entry of override) {
    if (typeof entry !== 'string') continue;
    if (entry.startsWith('-')) {
      perms.delete(entry.slice(1));
    } else {
      perms.add(entry);
    }
  }
  return [...perms];
}

/**
 * Effective permissions for a single role — kept for the RBAC unit tests
 * and legacy callers; multi-role accounts go through permissionsForRoles.
 */
export function permissionsForUser(role: string, override: unknown): string[] {
  return permissionsForRoles([role], override);
}

/** Wildcard-aware check: "titles:*" matches "titles:update"; "*" matches all. */
export function hasPermission(perms: string[], permission: string): boolean {
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) return true;
  const [res, act] = permission.split(':');
  return perms.some((p) => p === `${res}:*` || (p === '*' && act !== undefined));
}

// ─── Middleware ───────────────────────────────────────

interface AuthedRequest extends Request {
  user?: { uid: string; email: string; dbUserId?: string };
}

/** Require the actor to hold every listed permission (AND). */
export function requirePermission(...permissions: string[]) {
  return async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.uid) return next(new UnauthorizedError('Missing or invalid authorization header'));

      const user = await prisma.user.findUnique({
        where: { firebaseUid: req.user.uid },
        select: { id: true, role: true, roles: true, rolePermissions: true, bannedAt: true, suspendedUntil: true },
      });
      if (!user) return next(new ForbiddenError('Account not found'));

      // Moderation gate: banned accounts and active suspensions are blocked.
      if (user.bannedAt) return next(new ForbiddenError('This account has been banned'));
      if (user.suspendedUntil && user.suspendedUntil > new Date()) {
        return next(new ForbiddenError('This account is temporarily suspended'));
      }

      const perms = permissionsForRoles(effectiveRoles(user), user.rolePermissions);
      if (!permissions.every((p) => hasPermission(perms, p))) {
        return next(new ForbiddenError('You do not have permission to perform this action'));
      }

      req.user.dbUserId = user.id;
      next();
    } catch (err) {
      next(err);
    }
  };
}
