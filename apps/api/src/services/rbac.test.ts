import { describe, expect, it, beforeAll } from 'vitest';

describe('RBAC', () => {
  let rbac: typeof import('./rbac.js');

  beforeAll(async () => {
    // rbac.ts imports lib/prisma, which constructs a PrismaClient at module
    // load — give it a dummy URL so construction stays fully offline.
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    rbac = await import('./rbac.js');
  });

  it('maps legacy admin onto the platform_admin permission set', () => {
    const perms = rbac.basePermissions('admin');
    expect(perms).toContain('users:manage');
    expect(perms).toContain('settings:manage');
    expect(perms).toContain('audit:read');
  });

  it('maps legacy moderator onto the moderator set (no platform powers)', () => {
    const perms = rbac.basePermissions('moderator');
    expect(perms).toContain('moderation:act');
    expect(perms).not.toContain('settings:manage');
    expect(perms).not.toContain('roles:manage');
  });

  it('grants super_admin everything', () => {
    expect(rbac.basePermissions('super_admin')).toEqual(['*']);
  });

  it('applies granular overrides (add and remove)', () => {
    const perms = rbac.permissionsForUser('editor', ['media:delete', '-titles:update']);
    expect(perms).toContain('media:delete');
    expect(perms).not.toContain('titles:update');
    expect(perms).toContain('titles:create');
  });

  it('ignores non-string override entries', () => {
    const perms = rbac.permissionsForUser('editor', [42 as never, null as never]);
    expect(perms).toEqual(rbac.basePermissions('editor'));
  });

  it('honors wildcards in hasPermission', () => {
    expect(rbac.hasPermission(['titles:*'], 'titles:update')).toBe(true);
    expect(rbac.hasPermission(['*'], 'anything:at_all')).toBe(true);
    expect(rbac.hasPermission(['users:read'], 'users:manage')).toBe(false);
  });

  // ── Multi-role (User.roles) ─────────────────────────

  it('unions permissions across every held role', () => {
    // A moderator who is also an editor keeps both permission sets.
    const perms = rbac.permissionsForRoles(['moderator', 'editor'], null);
    expect(perms).toContain('moderation:act');
    expect(perms).toContain('titles:publish');
    expect(perms).toContain('chapters:create');
    expect(perms).toContain('comments:delete');
    expect(perms).not.toContain('roles:manage'); // neither holds promotion powers
    expect(perms).not.toContain('settings:manage');
  });

  it('short-circuits to wildcard when any role is super_admin', () => {
    expect(rbac.permissionsForRoles(['user', 'super_admin'], null)).toEqual(['*']);
    expect(rbac.permissionsForRoles(['moderator', 'super_admin'], ['-titles:update'])).toEqual(['*']);
  });

  it('applies the override once to the unioned set', () => {
    const perms = rbac.permissionsForRoles(['editor', 'uploader'], ['-titles:update']);
    expect(perms).toContain('titles:create');
    expect(perms).not.toContain('titles:update');
    expect(perms).toContain('chapters:create');
  });

  it('ignores unknown roles in the union', () => {
    const perms = rbac.permissionsForRoles(['editor', 'not_a_role'], null);
    expect(perms).toEqual(rbac.basePermissions('editor'));
  });

  it('permissionsForUser stays equivalent to a single-role union', () => {
    expect(rbac.permissionsForUser('moderator', null)).toEqual(rbac.permissionsForRoles(['moderator'], null));
  });

  it('effectiveRoles prefers the roles list over the legacy role column', () => {
    expect(rbac.effectiveRoles({ role: 'admin', roles: ['editor', 'moderator'] })).toEqual(['editor', 'moderator']);
    expect(rbac.effectiveRoles({ role: 'admin', roles: [] })).toEqual(['admin']);
    expect(rbac.effectiveRoles({ role: 'moderator' })).toEqual(['moderator']);
    expect(rbac.effectiveRoles({ role: 'user', roles: null })).toEqual(['user']);
  });

  it('effectiveRoles dedupes repeated entries', () => {
    expect(rbac.effectiveRoles({ role: 'user', roles: ['editor', 'editor'] })).toEqual(['editor']);
  });

  it('exposes the role catalog for the admin UI', () => {
    const keys = rbac.ROLES.map((r) => r.key);
    expect(keys).toContain('super_admin');
    expect(keys).toContain('moderator');
    expect(keys.length).toBeGreaterThan(5);
  });

  // ── Staff content powers (Studio) ────────────────────

  it('gives uploaders full content CRUD but no promotion powers', () => {
    const perms = rbac.basePermissions('uploader');
    for (const p of ['titles:create', 'titles:update', 'titles:delete', 'chapters:create', 'chapters:update', 'chapters:delete', 'media:create', 'media:update', 'media:delete']) {
      expect(perms).toContain(p);
    }
    // Role assignment stays admin-only.
    expect(perms).not.toContain('users:manage');
    expect(perms).not.toContain('roles:manage');
  });

  it('gives editors content CRUD plus publishing, no promotion powers', () => {
    const perms = rbac.basePermissions('editor');
    expect(perms).toContain('titles:publish');
    expect(perms).toContain('chapters:create');
    expect(perms).not.toContain('users:manage');
    expect(perms).not.toContain('roles:manage');
  });

  it('gives moderators content CRUD alongside community duties', () => {
    const perms = rbac.basePermissions('moderator');
    expect(perms).toContain('titles:create');
    expect(perms).toContain('chapters:delete');
    expect(perms).toContain('media:create');
    expect(perms).toContain('moderation:act');
    expect(perms).not.toContain('users:manage');
    expect(perms).not.toContain('roles:manage');
  });

  it('only admins hold roles:manage', () => {
    for (const role of ['user', 'uploader', 'editor', 'moderator', 'content_manager', 'support_agent', 'translator']) {
      expect(rbac.basePermissions(role)).not.toContain('roles:manage');
    }
    expect(rbac.basePermissions('platform_admin')).toContain('roles:manage');
    expect(rbac.basePermissions('admin')).toContain('roles:manage'); // legacy admin maps on
    expect(rbac.basePermissions('super_admin')).toEqual(['*']);
  });
});
