'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface NotificationItem {
  id: string;
  type: 'new_chapter' | 'review_added' | 'review_reply' | 'achievement' | 'milestone' | 'system' | 'comment';
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
  achievement: '🏆',
  milestone: '🎉',
  system: '🔔',
  comment: '💬',
};

export function getNotificationIcon(type: string): string {
  return NOTIFICATION_ICONS[type] || '🔔';
}

export function getNotificationTypeColor(type: string): string {
  switch (type) {
    case 'new_chapter': return '#4a9eff';
    case 'review_added': return '#f0c040';
    case 'review_reply': return '#7b2fbe';
    case 'achievement': return '#4ade80';
    case 'milestone': return '#e94560';
    case 'comment': return '#a05bdf';
    case 'system': return '#888';
    default: return '#888';
  }
}

// ─── Hooks ────────────────────────────────────────────

export function useNotifications(page = 1, limit = 20) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', page, limit],
    queryFn: () => api.get<NotificationsResponse>(`/notifications?page=${page}&limit=${limit}`),
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
