'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface AchievementItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: 'reading' | 'streak' | 'exploration' | 'social' | 'library' | 'coins';
  metric: string;
  threshold: number;
  current: number;
  target: number;
  progress: number; // 0-100
  earned: boolean;
  earnedAt: string | null;
}

export interface AchievementsData {
  items: AchievementItem[];
  total: number;
  earned: number;
  categories: { key: string; label: string }[];
}

export function useAchievements() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useQuery<AchievementsData>({
    queryKey: ['achievements'],
    queryFn: () => api.get<AchievementsData>('/achievements'),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}
