'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface NotificationItem {
  id: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  body: string | null;
  link: string | null;
  imageUrl: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  pinnedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface NotificationPrefs {
  new_chapter: boolean;
  reviews: boolean;
  milestones: boolean;
  achievements: boolean;
  community: boolean;
  system: boolean;
  reminders: boolean;
  recommendations: boolean;
  push: 'all' | 'important' | 'off';
  email: 'all' | 'important' | 'off';
  digest: 'off' | 'daily' | 'weekly' | 'monthly';
  quietHours: { enabled: boolean; start: string; end: string };
  dndUntil: number;
  announcementVisibility: 'all' | 'important' | 'off';
}

export interface NotificationFilters {
  scope?: 'inbox' | 'archived';
  read?: 'all' | 'unread' | 'read';
  category?: string;
  priority?: string;
  q?: string;
}

// ─── Visual metadata ──────────────────────────────────

export const NOTIFICATION_ICONS: Record<string, string> = {
  new_chapter: '📖',
  review_added: '⭐',
  review_reply: '💬',
  review_helpful: '👍',
  achievement: '🏆',
  milestone: '🎉',
  system: '🔔',
  comment: '💬',
  reply: '💬',
  new_follower: '👤',
  reminder: '⏰',
  recommendation: '✨',
  announcement: '📣',
  security: '🛡️',
  moderator: '⚖️',
  prediction: '🔮',
};

export const NOTIFICATION_FILTERS: { key: string; label: string; emoji: string }[] = [
  { key: '', label: 'All', emoji: '🔔' },
  { key: 'new_chapter', label: 'Chapters', emoji: '📖' },
  { key: 'new_follower', label: 'Followers', emoji: '👤' },
  { key: 'reply', label: 'Replies', emoji: '💬' },
  { key: 'comment', label: 'Comments', emoji: '💬' },
  { key: 'review_helpful', label: 'Helpful votes', emoji: '👍' },
  { key: 'review_added', label: 'Reviews', emoji: '⭐' },
  { key: 'achievement', label: 'Achievements', emoji: '🏆' },
  { key: 'milestone', label: 'Milestones', emoji: '🎉' },
  { key: 'reminder', label: 'Reminders', emoji: '⏰' },
  { key: 'system', label: 'System', emoji: '🔔' },
];

export const PRIORITY_META: Record<string, { label: string; color: string; ring: string }> = {
  critical: { label: 'Critical', color: '#f43f5e', ring: 'ring-rose-500/40' },
  high: { label: 'High', color: '#f59e0b', ring: 'ring-amber-500/40' },
  normal: { label: 'Normal', color: '#8b5cf6', ring: 'ring-violet-500/30' },
  silent: { label: 'Silent', color: '#64748b', ring: 'ring-slate-500/30' },
  background: { label: 'Background', color: '#475569', ring: 'ring-slate-600/30' },
};

export function getNotificationIcon(type: string): string {
  return NOTIFICATION_ICONS[type] || '🔔';
}

export function getNotificationTypeColor(type: string): string {
  switch (type) {
    case 'new_chapter': return '#4a9eff';
    case 'review_added': return '#f0c040';
    case 'review_reply': return '#7b2fbe';
    case 'review_helpful': return '#4a9eff';
    case 'achievement': return '#4ade80';
    case 'milestone': return '#e94560';
    case 'comment': return '#a05bdf';
    case 'reply': return '#7b2fbe';
    case 'new_follower': return '#4ade80';
    case 'reminder': return '#38bdf8';
    case 'recommendation': return '#a78bfa';
    case 'announcement': return '#f59e0b';
    case 'security': return '#f43f5e';
    case 'moderator': return '#fb923c';
    case 'system': return '#888';
    default: return '#888';
  }
}

export function getPriorityMeta(priority: string): { label: string; color: string } {
  return PRIORITY_META[priority] || PRIORITY_META.normal;
}

// ─── Feed hooks ───────────────────────────────────────

function buildParams(filters: NotificationFilters): string {
  const params = new URLSearchParams();
  if (filters.scope) params.set('scope', filters.scope);
  if (filters.read) params.set('read', filters.read);
  if (filters.category) params.set('category', filters.category);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.q) params.set('q', filters.q);
  const qs = params.toString();
  return qs ? `&${qs}` : '';
}

export function useNotifications(page = 1, limit = 20, filters: NotificationFilters = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', page, limit, filters],
    queryFn: () => api.get<NotificationsResponse>(`/notifications?page=${page}&limit=${limit}${buildParams(filters)}`),
    enabled: !!token,
  });
}

/** Infinite feed for the notification center (cursor pagination). */
export function useInfiniteNotifications(limit = 20, filters: NotificationFilters = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useInfiniteQuery<NotificationsResponse>({
    queryKey: ['notifications', 'feed', limit, filters],
    queryFn: ({ pageParam = 1 }) =>
      api.get<NotificationsResponse>(`/notifications?page=${pageParam}&limit=${limit}${buildParams(filters)}`),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    initialPageParam: 1,
    enabled: !!token,
  });
}

export function useUnreadCount() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    enabled: !!token,
    refetchInterval: 30_000, // polling fallback when realtime is unavailable
  });
}

// ─── Mutations ────────────────────────────────────────

function invalidateNotifs(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => invalidateNotifs(queryClient),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onSuccess: () => invalidateNotifs(queryClient),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => invalidateNotifs(queryClient),
  });
}

export function usePinNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api.patch(`/notifications/${id}/${pinned ? 'unpin' : 'pin'}`, {}),
    onSuccess: () => invalidateNotifs(queryClient),
  });
}

export function useArchiveNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.patch(`/notifications/${id}/${archived ? 'restore' : 'archive'}`, {}),
    onSuccess: () => invalidateNotifs(queryClient),
  });
}

// ─── Preferences ──────────────────────────────────────

export function useNotificationPrefs() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useQuery<NotificationPrefs>({
    queryKey: ['notifications', 'prefs'],
    queryFn: () => api.get<NotificationPrefs>('/notifications/prefs'),
    enabled: !!token,
  });
}

export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) => api.patch('/notifications/prefs', patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'prefs'] });
    },
  });
}
