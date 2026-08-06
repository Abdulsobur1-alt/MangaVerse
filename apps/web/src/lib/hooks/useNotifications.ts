'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  imageUrl: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const NOTIFICATION_ICONS: Record<string, string> = {
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
};

/** Filter chips for the notification center (Phase 8). */
export const NOTIFICATION_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'new_follower', label: 'Followers' },
  { key: 'reply', label: 'Replies' },
  { key: 'comment', label: 'Comments' },
  { key: 'review_helpful', label: 'Helpful votes' },
  { key: 'review_added', label: 'Reviews' },
  { key: 'new_chapter', label: 'New chapters' },
  { key: 'achievement', label: 'Achievements' },
  { key: 'system', label: 'System' },
];

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
    case 'system': return '#888';
    default: return '#888';
  }
}

// ─── Hooks ────────────────────────────────────────────

export function useNotifications(page = 1, limit = 20, type = '') {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', page, limit, type],
    queryFn: () => api.get<NotificationsResponse>(`/notifications?page=${page}&limit=${limit}${type ? `&type=${encodeURIComponent(type)}` : ''}`),
    enabled: !!token,
  });
}

export function useUnreadCount() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    enabled: !!token,
    refetchInterval: 30_000, // Poll every 30 seconds
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
