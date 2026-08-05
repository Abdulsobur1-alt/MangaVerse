'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface HistoryItem {
  id: string;
  pageNumber: number;
  completed: boolean;
  chapter: {
    id: string;
    number: number;
    title: string | null;
    series: {
      slug: string;
      title: string;
      coverUrl: string | null;
    };
  };
  updatedAt: string;
}

export interface PaginatedHistory {
  items: HistoryItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface PerTitleStat {
  titleId: string;
  title: string;
  slug: string;
  type: string;
  coverUrl: string | null;
  author: string | null;
  chaptersRead: number;
}

export interface GenreStat {
  genre: string;
  count: number;
}

export interface ReadingStats {
  totalChapters: number;
  totalSeries: number;
  streakDays: number;
  daysActive: number;
  perTitle: PerTitleStat[];
  genreDistribution: GenreStat[];
  readingCalendar: { date: string; read: boolean }[];
}

const GENRE_COLORS: Record<string, string> = {
  action: '#e94560',
  adventure: '#1b5e3d',
  comedy: '#d4a017',
  drama: '#5e1b3a',
  fantasy: '#7b2fbe',
  horror: '#2d1b69',
  mystery: '#0066cc',
  romance: '#e94560',
  scifi: '#0066ff',
  slice_of_life: '#4a9eff',
  sports: '#22c55e',
  thriller: '#9333ea',
  isekai: '#f59e0b',
  cultivation: '#10b981',
  mecha: '#6366f1',
  historical: '#a855f7',
  supernatural: '#ec4899',
  psychological: '#8b5cf6',
};

export function getGenreColor(genre: string): string {
  return GENRE_COLORS[genre.toLowerCase()] || '#555';
}

// ─── Hooks ────────────────────────────────────────────

export function useReadingHistory(page = 1, limit = 30) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useQuery<PaginatedHistory>({
    queryKey: ['reading', 'history', page, limit],
    queryFn: () => api.get<PaginatedHistory>(`/reading/history?page=${page}&limit=${limit}`),
    enabled: !!token,
  });
}

export function useReadingStats() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useQuery<ReadingStats>({
    queryKey: ['reading', 'stats'],
    queryFn: () => api.get<ReadingStats>('/reading/stats'),
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
  });
}
