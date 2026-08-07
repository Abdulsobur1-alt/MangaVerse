'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface AdminStats {
  users: number;
  posts: number;
  comments: number;
  clubs: number;
  wikiPages: number;
  predictions: number;
  openPredictions: number;
  reviews: number;
  chapters: number;
  pendingReports: number;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  roles?: string[];
  streakDays: number;
  bannedAt: string | null;
  suspendedUntil: string | null;
  warnings: number;
  createdAt: string;
  _count: { communityPosts: number; postComments: number; reviews: number };
}

export interface AdminPost {
  id: string;
  title: string;
  body: string;
  tag: string;
  author: { id: string; displayName: string; email: string };
  upvotes: number;
  comments: number;
  createdAt: string;
}

export interface AdminComment {
  id: string;
  body: string;
  author: { id: string; displayName: string; email: string };
  post: { id: string; title: string };
  createdAt: string;
}

export interface AdminWikiPage {
  id: string;
  slug: string;
  version: number;
  contentPreview: string;
  author: { id: string; displayName: string; email: string };
  title: { slug: string; title: string };
  updatedAt: string;
}

export interface AdminClub {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

export interface AdminReport {
  id: string;
  contentType: 'post' | 'comment' | 'wiki';
  targetId: string;
  reason: string;
  details: string | null;
  status: 'pending' | 'resolved' | 'dismissed' | 'escalated';
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; displayName: string; email: string };
  resolver: { id: string; displayName: string; email: string } | null;
  target: {
    id: string;
    title?: string;
    bodyPreview?: string;
    authorName?: string;
    postTitle?: string;
    slug?: string;
    titleSlug?: string;
    titleName?: string;
  } | null;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ─── Stats ────────────────────────────────────────────

export function useAdminStats(enabled = true) {
  return useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<AdminStats>('/admin/stats'),
    enabled,
    staleTime: 30 * 1000,
  });
}

// ─── Users ────────────────────────────────────────────

export function useAdminUsers(params?: { page?: number; search?: string }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.search) sp.set('search', params.search);

  return useQuery<Paginated<AdminUser>>({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.get<Paginated<AdminUser>>(`/admin/users?${sp}`),
    enabled,
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { userId: string; roles: string[] }) =>
      api.patch<AdminUser>(`/admin/users/${data.userId}/role`, { roles: data.roles }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

// ─── Posts moderation ─────────────────────────────────

export function useAdminPosts(params?: { page?: number }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));

  return useQuery<Paginated<AdminPost>>({
    queryKey: ['admin', 'posts', params],
    queryFn: () => api.get<Paginated<AdminPost>>(`/admin/posts?${sp}`),
    enabled,
  });
}

export function useAdminDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => api.delete(`/admin/posts/${postId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

// ─── Comments moderation ──────────────────────────────

export function useAdminComments(params?: { page?: number }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));

  return useQuery<Paginated<AdminComment>>({
    queryKey: ['admin', 'comments', params],
    queryFn: () => api.get<Paginated<AdminComment>>(`/admin/comments?${sp}`),
    enabled,
  });
}

export function useAdminDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => api.delete(`/admin/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

// ─── Wiki moderation ──────────────────────────────────

export function useAdminWiki(params?: { page?: number }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));

  return useQuery<Paginated<AdminWikiPage>>({
    queryKey: ['admin', 'wiki', params],
    queryFn: () => api.get<Paginated<AdminWikiPage>>(`/admin/wiki?${sp}`),
    enabled,
  });
}

export function useAdminDeleteWiki() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => api.delete(`/admin/wiki/${slug}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'wiki'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

// ─── Clubs moderation ─────────────────────────────────

export function useAdminClubs(params?: { page?: number }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));

  return useQuery<Paginated<AdminClub>>({
    queryKey: ['admin', 'clubs', params],
    queryFn: () => api.get<Paginated<AdminClub>>(`/admin/clubs?${sp}`),
    enabled,
  });
}

export function useAdminDeleteClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clubId: string) => api.delete(`/admin/clubs/${clubId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clubs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

// ─── Content reports (flags) ─────────────────────────

export function useAdminReports(params?: { page?: number; status?: string }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.status) sp.set('status', params.status);

  return useQuery<Paginated<AdminReport>>({
    queryKey: ['admin', 'reports', params],
    queryFn: () => api.get<Paginated<AdminReport>>(`/admin/reports?${sp}`),
    enabled,
  });
}

export function useAdminUpdateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { reportId: string; status: 'resolved' | 'dismissed' }) =>
      api.patch<AdminReport>(`/admin/reports/${data.reportId}`, { status: data.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

// ─── Engagement tools (Phase 10) ──────────────────────

export interface EngagementStats {
  totals: {
    notifications: number;
    last7Days: number;
    pushSubscriptions: number;
    announcements: number;
    digestEnabledUsers: number;
  };
  perDay: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

export function useEngagementStats(enabled = true) {
  return useQuery<EngagementStats>({
    queryKey: ['admin', 'engagement', 'stats'],
    queryFn: () => api.get<EngagementStats>('/admin/engagement/stats'),
    enabled,
    staleTime: 60 * 1000,
  });
}

export interface BroadcastInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
  priority?: string;
  audience: string;
}

export function useAdminBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BroadcastInput) => api.post('/admin/notifications/broadcast', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'engagement', 'stats'] });
    },
  });
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string | null;
  variant: string;
  audience: string;
  link: string | null;
  dismissible: boolean;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  dismissals: number;
  createdAt: string;
}

export function useAdminAnnouncements(enabled = true) {
  return useQuery<Paginated<AdminAnnouncement>>({
    queryKey: ['admin', 'announcements'],
    queryFn: () => api.get<Paginated<AdminAnnouncement>>('/announcements/manage?page=1&limit=50'),
    enabled,
  });
}

export function useAdminCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AdminAnnouncement> & { title: string }) => api.post('/announcements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useAdminToggleAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/announcements/${id}`, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useAdminDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useAdminNotifyAnnouncement() {
  return useMutation({
    mutationFn: (id: string) => api.post(`/announcements/${id}/notify`, {}),
  });
}

export interface NotificationTemplate {
  key: string;
  name: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  body: string | null;
  link: string | null;
  active: boolean;
  updatedAt: string;
}

export function useAdminTemplates(enabled = true) {
  return useQuery<{ items: NotificationTemplate[] }>({
    queryKey: ['admin', 'templates'],
    queryFn: () => api.get<{ items: NotificationTemplate[] }>('/admin/notification-templates'),
    enabled,
  });
}

export function useAdminSaveTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NotificationTemplate> & { key: string; title: string; name: string; type: string }) =>
      api.post('/admin/notification-templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
   Phase 11 — Admin Platform hooks (dashboard, CMS, media,
   moderation, flags, audit, tickets, health, analytics, settings,
   roles, impersonation).
   ═══════════════════════════════════════════════════════════════ */

// ─── Executive dashboard ───────────────────────────────

export interface AdminDashboard {
  stats: {
    users: number;
    titles: number;
    chapters: number;
    reviews: number;
    posts: number;
    comments: number;
    openTickets: number;
    pendingReports: number;
    flagsEnabled: number;
    activeWarnings: number;
  };
  recentUsers: { id: string; displayName: string; avatarUrl: string | null; role: string; createdAt: string }[];
  topTitles: { id: string; slug: string; title: string; coverUrl: string | null; type: string; rating: number | null; saves: number }[];
  recentAudit: { id: string; action: string; resource: string; resourceId: string | null; actorName: string; createdAt: string }[];
}

export function useAdminDashboard(enabled = true) {
  return useQuery<AdminDashboard>({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api.get<AdminDashboard>('/admin/dashboard'),
    enabled,
    staleTime: 30 * 1000,
  });
}

// ─── Role catalog ──────────────────────────────────────

export interface RoleMeta {
  key: string;
  label: string;
  description: string;
}

export function useAdminRoles(enabled = true) {
  return useQuery<{ items: RoleMeta[] }>({
    queryKey: ['admin', 'roles'],
    queryFn: () => api.get<{ items: RoleMeta[] }>('/admin/roles'),
    enabled,
  });
}

// ─── CMS: titles ───────────────────────────────────────

export interface AdminCmsTitle {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  coverUrl: string | null;
  rating: number | null;
  totalChapters: number | null;
  chapters: number;
  saves: number;
  reviews: number;
  updatedAt: string;
}

export function useAdminTitles(params?: { page?: number; search?: string; status?: string; type?: string }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.search) sp.set('search', params.search);
  if (params?.status) sp.set('status', params.status);
  if (params?.type) sp.set('type', params.type);

  return useQuery<Paginated<AdminCmsTitle>>({
    queryKey: ['admin', 'cms', 'titles', params],
    queryFn: () => api.get<Paginated<AdminCmsTitle>>(`/admin/cms/titles?${sp}`),
    enabled,
  });
}

export function useAdminTitle(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'cms', 'title', id],
    queryFn: () => api.get(`/admin/cms/titles/${id}`),
    enabled: enabled && !!id,
  });
}

export function useAdminUpdateTitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; patch: Record<string, unknown> }) =>
      api.patch(`/admin/cms/titles/${data.id}`, data.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cms'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}

export function useAdminPublishTitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/admin/cms/titles/${id}/publish`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cms'] }),
  });
}

export function useAdminReindexTitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/admin/cms/titles/${id}/reindex`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cms'] }),
  });
}

export interface AdminChapter {
  id: string;
  number: number;
  title: string | null;
  pageCount: number | null;
  coinLocked: boolean;
  freeAt: string | null;
  createdAt: string;
}

export function useAdminChapters(titleId: string | null, enabled = true) {
  return useQuery<AdminChapter[]>({
    queryKey: ['admin', 'cms', 'chapters', titleId],
    queryFn: () => api.get<AdminChapter[]>(`/admin/cms/titles/${titleId}/chapters`),
    enabled: enabled && !!titleId,
  });
}

// ─── CMS: revisions ────────────────────────────────────

export interface AdminRevision {
  id: string;
  version: number;
  note: string | null;
  actorName: string;
  createdAt: string;
  changedKeys: string[];
}

export function useAdminRevisions(entityType: string, entityId: string | null, enabled = true) {
  return useQuery<AdminRevision[]>({
    queryKey: ['admin', 'cms', 'revisions', entityType, entityId],
    queryFn: () => api.get<AdminRevision[]>(`/admin/cms/revisions?entityType=${entityType}&entityId=${entityId}`),
    enabled: enabled && !!entityId,
  });
}

export function useAdminRollbackRevision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/admin/cms/revisions/${id}/rollback`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cms'] }),
  });
}

// ─── CMS: editorial picks ──────────────────────────────

export interface AdminPick {
  id: string;
  position: number;
  label: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  title: { id: string; slug: string; title: string; coverUrl: string | null; type: string };
  createdByName: string;
}

export function useAdminPicks(enabled = true) {
  return useQuery<AdminPick[]>({
    queryKey: ['admin', 'cms', 'picks'],
    queryFn: () => api.get<AdminPick[]>('/admin/cms/picks'),
    enabled,
  });
}

export function useAdminCreatePick() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { titleId: string; position?: number; label?: string | null; active?: boolean }) =>
      api.post('/admin/cms/picks', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cms', 'picks'] }),
  });
}

export function useAdminDeletePick() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/cms/picks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cms', 'picks'] }),
  });
}

export function useAdminTogglePick() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/admin/cms/picks/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cms', 'picks'] }),
  });
}

// ─── Media library ─────────────────────────────────────

export interface AdminMediaAsset {
  id: string;
  url: string;
  type: string;
  name: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  tags: string[];
  folder: string | null;
  usageCount: number;
  createdAt: string;
}

export function useAdminMedia(params?: { page?: number; type?: string }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.type) sp.set('type', params.type);

  return useQuery<Paginated<AdminMediaAsset> & { byType: Record<string, number> }>({
    queryKey: ['admin', 'media', params],
    queryFn: () => api.get(`/admin/media?${sp}`),
    enabled,
  });
}

export function useAdminCreateMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { url: string; type: string; name?: string | null; tags?: string[]; folder?: string | null }) =>
      api.post('/admin/media', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'media'] }),
  });
}

export function useAdminDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/media/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'media'] }),
  });
}

// ─── Moderation: warn / suspend / ban ──────────────────

export interface AdminWarning {
  id: string;
  severity: string;
  reason: string;
  durationHours: number | null;
  active: boolean;
  actorName: string;
  createdAt: string;
}

export function useAdminWarnings(userId: string | null, enabled = true) {
  return useQuery<AdminWarning[]>({
    queryKey: ['admin', 'warnings', userId],
    queryFn: () => api.get(`/admin/warnings?userId=${userId}`),
    enabled: enabled && !!userId,
  });
}

export function useAdminWarnUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; severity: string; reason: string; durationHours?: number | null }) =>
      api.post(`/admin/users/${data.userId}/warn`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'warnings'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
  });
}

export function useAdminSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; hours: number; reason: string }) =>
      api.post(`/admin/users/${data.userId}/suspend`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'warnings'] });
    },
  });
}

export function useAdminBanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; reason: string }) => api.post(`/admin/users/${data.userId}/ban`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'warnings'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
  });
}

export function useAdminUnbanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.post(`/admin/users/${userId}/unban`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'warnings'] });
    },
  });
}

export function useAdminSetPermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; rolePermissions: string[] }) =>
      api.patch(`/admin/users/${data.userId}/permissions`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

// ─── Feature flags ─────────────────────────────────────

export interface AdminFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rolloutPct: number;
  environments: string[];
  overrideCount: number;
  updatedAt: string;
}

export function useAdminFlags(enabled = true) {
  return useQuery<AdminFlag[]>({
    queryKey: ['admin', 'flags'],
    queryFn: () => api.get<AdminFlag[]>('/admin/flags'),
    enabled,
  });
}

export function useAdminCreateFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { key: string; name: string; description?: string | null; enabled?: boolean; rolloutPct?: number }) =>
      api.post('/admin/flags', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'flags'] }),
  });
}

export function useAdminUpdateFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; patch: Record<string, unknown> }) => api.patch(`/admin/flags/${data.id}`, data.patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'flags'] }),
  });
}

export function useAdminDeleteFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/flags/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'flags'] }),
  });
}

export function useAdminFlagOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { flagId: string; userId: string; enabled: boolean }) =>
      api.post(`/admin/flags/${data.flagId}/override`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'flags'] }),
  });
}

// ─── Audit log ─────────────────────────────────────────

export interface AdminAuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  actor: { id: string; displayName: string; avatarUrl: string | null } | null;
  actorName: string;
  targetUser: { id: string; displayName: string } | null;
  createdAt: string;
}

export function useAdminAuditLog(params?: { page?: number; resource?: string; action?: string; q?: string }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.resource) sp.set('resource', params.resource);
  if (params?.action) sp.set('action', params.action);
  if (params?.q) sp.set('q', params.q);

  return useQuery<Paginated<AdminAuditEntry>>({
    queryKey: ['admin', 'audit', params],
    queryFn: () => api.get(`/admin/audit?${sp}`),
    enabled,
  });
}

export function useAdminAuditMeta(enabled = true) {
  return useQuery<{ resources: string[]; actions: string[] }>({
    queryKey: ['admin', 'audit', 'meta'],
    queryFn: () => api.get('/admin/audit/meta'),
    enabled,
  });
}

export function useAdminAuditExport() {
  return useMutation({
    mutationFn: async () => {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${base}/admin/audit/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      return res.json();
    },
  });
}

// ─── Support tickets ───────────────────────────────────

export interface AdminTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  user: { id: string; displayName: string; avatarUrl: string | null; email: string };
  assignee: { id: string; displayName: string } | null;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
}

export function useAdminTickets(params?: { page?: number; status?: string; priority?: string }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.status) sp.set('status', params.status);
  if (params?.priority) sp.set('priority', params.priority);

  return useQuery<Paginated<AdminTicket>>({
    queryKey: ['admin', 'tickets', params],
    queryFn: () => api.get(`/admin/tickets?${sp}`),
    enabled,
  });
}

export function useAdminTicket(id: string | null, enabled = true) {
  return useQuery<Record<string, unknown>>({
    queryKey: ['admin', 'tickets', id],
    queryFn: () => api.get(`/admin/tickets/${id}`),
    enabled: enabled && !!id,
  });
}

export function useAdminUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; patch: Record<string, string> }) => api.patch(`/admin/tickets/${data.id}`, data.patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] }),
  });
}

export function useAdminAssignTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; assigneeId: string | null }) => api.post(`/admin/tickets/${data.id}/assign`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] }),
  });
}

export function useAdminTicketNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; body: string }) => api.post(`/admin/tickets/${data.id}/notes`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] }),
  });
}

// ─── System health ─────────────────────────────────────

export interface AdminHealth {
  status: string;
  uptime: number;
  environment: string;
  memory: number;
  totalMs: number;
  checks: Record<string, { ok: boolean; latencyMs?: number; detail?: string }>;
}

export function useAdminHealth(enabled = true, refetchInterval = 30_000) {
  return useQuery<AdminHealth>({
    queryKey: ['admin', 'health'],
    queryFn: () => api.get('/admin/health'),
    enabled,
    refetchInterval,
  });
}

// ─── Platform analytics ────────────────────────────────

export interface AdminAnalytics {
  users: { total: number; newToday: number; newWeek: number };
  content: { titles: number; chapters: number; reviews: number; posts: number };
  engagement: { activeUsers7d: number; reads7d: number; bookmarks7d: number };
  topTitles: { id: string; slug: string; title: string; coverUrl: string | null; type: string; saves: number }[];
  topAuthors: { author: string; saves: number }[];
  generatedAt: string;
}

export function useAdminAnalytics(enabled = true) {
  return useQuery<AdminAnalytics>({
    queryKey: ['admin', 'analytics'],
    queryFn: () => api.get('/admin/analytics'),
    enabled,
    staleTime: 60 * 1000,
  });
}

// ─── Platform settings + maintenance ───────────────────

export interface PlatformSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}

export function useAdminSettings(enabled = true) {
  return useQuery<PlatformSetting[]>({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get('/admin/settings'),
    enabled,
  });
}

export function useAdminUpdateSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { key: string; value: unknown }) => api.patch(`/admin/settings/${data.key}`, { value: data.value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  });
}

export function useAdminMaintenance(enabled = true) {
  return useQuery<{ enabled: boolean; message: string | null }>({
    queryKey: ['admin', 'settings', 'maintenance'],
    queryFn: () => api.get('/admin/settings/maintenance'),
    enabled,
  });
}

export function useAdminSetMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { enabled: boolean; message?: string | null }) => api.post('/admin/settings/maintenance', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'maintenance'] });
    },
  });
}

// ─── Impersonation (dev) ───────────────────────────────

export function useAdminImpersonate() {
  return useMutation({
    mutationFn: (userId: string) => api.post<{ token: string }>(`/admin/impersonate/${userId}`, {}),
  });
}
