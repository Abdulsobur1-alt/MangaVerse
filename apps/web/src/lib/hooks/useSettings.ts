'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface UpdateProfileData {
  displayName?: string;
  avatarUrl?: string | null;
  // ─── Identity + customization (Phase 9) ───
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  socialLinks?: Partial<Record<'x' | 'instagram' | 'discord' | 'youtube' | 'twitch', string>>;
  bannerUrl?: string | null;
  accentColor?: string | null;
  profileTheme?: 'aurora' | 'midnight' | 'sunset' | 'forest' | 'ocean';
  layoutStyle?: 'editorial' | 'compact';
  cardStyle?: 'rounded' | 'sharp';
  pinnedItems?: { lists?: string[]; reviews?: string[]; collections?: string[] };
  pinnedManga?: string[];
}

export interface ProfileResponse {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  socialLinks: Record<string, string> | null;
  bannerUrl: string | null;
  accentColor: string | null;
  profileTheme: string;
  layoutStyle: string;
  cardStyle: string;
  pinnedItems: Record<string, string[]> | null;
  pinnedManga: string[];
  coinBalance: number;
  subscriptionTier: string;
  streakDays: number;
  reputation: number;
  totalReadingMinutes: number;
  createdAt: string;
}

export interface NotificationPrefs {
  new_chapter: boolean;
  reviews: boolean;
  milestones: boolean;
  achievements: boolean;
}

// ─── Hooks ────────────────────────────────────────────

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileData) =>
      api.put<ProfileResponse>('/users/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.delete('/users/account'),
    onSuccess: () => {
      localStorage.removeItem('auth_token');
      queryClient.clear();
      window.location.href = '/';
    },
  });
}

export function useNotificationPrefs() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useQuery<NotificationPrefs>({
    queryKey: ['user', 'preferences'],
    queryFn: () => api.get<NotificationPrefs>('/users/preferences'),
    enabled: !!token,
  });
}

export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<NotificationPrefs>) =>
      api.put<NotificationPrefs>('/users/preferences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'preferences'] });
    },
  });
}
