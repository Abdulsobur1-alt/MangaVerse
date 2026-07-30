import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '../../store/authStore';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  coinBalance: number;
  subscriptionTier: string;
  streakDays?: number;
  libraryCount?: number;
  createdAt: string;
}

export function useUserStats() {
  const token = useAuthStore((s) => s.token);

  return useQuery<{
    chaptersRead: number;
    totalBookmarks: number;
    totalReviews: number;
    totalAchievements: number;
    streakDays: number;
    readingCalendar: { date: string; read: boolean }[];
  }>({
    queryKey: ['user', 'stats'],
    queryFn: () => api.get('/users/stats'),
    enabled: !!token,
  });
}
