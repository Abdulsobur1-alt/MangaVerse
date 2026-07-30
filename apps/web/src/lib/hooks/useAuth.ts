'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

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

export function useAuth() {
  const queryClient = useQueryClient();
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const userQuery = useQuery<AuthUser>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<AuthUser>('/auth/me'),
    enabled: !!token,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (firebaseToken: string) =>
      api.post<{ id: string; email: string; displayName: string; token: string }>('/auth/login', {
        firebaseToken,
      }),
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: { email: string; password: string; displayName: string; firebaseUid?: string }) =>
      api.post<AuthUser>('/auth/register', data),
  });

  const logout = () => {
    localStorage.removeItem('auth_token');
    queryClient.invalidateQueries({ queryKey: ['auth'] });
    window.location.href = '/';
  };

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    isAuthenticated: !!token && !!userQuery.data,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout,
    loginError: loginMutation.error,
  };
}

export function useUserStats() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

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
