'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export interface ActivityItem {
  id: string;
  kind: 'friend' | 'highlight' | 'mine' | 'platform';
  type: string;
  actor: { id: string; name: string; avatar: string | null } | null;
  emoji: string;
  title: string;
  body: string | null;
  link: string | null;
  time: string;
}

export interface ActivityResponse {
  items: ActivityItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  sources?: { following: number };
}

export function useActivityFeed(kind: 'all' | 'friends' | 'highlights' | 'mine' = 'all', page = 1, limit = 20) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useQuery<ActivityResponse>({
    queryKey: ['activity', kind, page, limit],
    queryFn: () => api.get<ActivityResponse>(`/activity?kind=${kind}&page=${page}&limit=${limit}`),
    // Anonymous visitors can still see highlights
    enabled: true,
  });
}
