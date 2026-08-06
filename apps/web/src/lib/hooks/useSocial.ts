'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  type: 'post' | 'review' | 'achievement' | 'library';
  title: string;
  body?: string;
  link: string;
  at: string;
}

export interface CurrentReadingItem {
  slug: string;
  title: string;
  coverUrl: string | null;
  type: string;
  chapterId: string;
  chapterNumber: number;
  pct: number;
}

export interface PublicProfile {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  socialLinks: Record<string, string>;
  accentColor: string | null;
  profileTheme: string;
  layoutStyle: string;
  cardStyle: string;
  role: string;
  createdAt: string;
  streakDays: number;
  followerCount: number;
  followingCount: number;
  reviewCount: number;
  postCount: number;
  achievementCount: number;
  isFollowing: boolean;
  followsYou: boolean;
  mutual: boolean;
  private: boolean;
  shareActivity?: boolean;
  reputationTier?: { key: string; label: string; emoji: string; min: number; description: string };
  mutualCount?: number;
  sharedGenres?: string[];
  favoriteGenres?: { genre: string; count: number }[];
  currentReading?: CurrentReadingItem[];
  activity?: ActivityItem[];
  sections?: Record<string, unknown>;
}

export interface FollowListUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isFollowing?: boolean;
  followsYou?: boolean;
  mutual?: boolean;
  since?: string;
}

export interface SuggestionUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  followerCount: number;
  postCount: number;
  sharedGenres: number;
  mutual: boolean;
  score: number;
}

function token() {
  return typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
}

// ─── Profile ──────────────────────────────────────────

export function usePublicProfile(id: string | undefined, enabled = true) {
  const t = token();
  return useQuery<PublicProfile>({
    queryKey: ['social', 'profile', id],
    queryFn: () => api.get<PublicProfile>(`/social/users/${id}`),
    enabled: enabled && !!id,
    staleTime: 30 * 1000,
  });
}

/** The ids the viewer follows — a cached Set used across the UI. */
export function useMyFollowing() {
  const t = token();
  return useQuery<string[]>({
    queryKey: ['social', 'me', 'following'],
    queryFn: () => api.get<string[]>('/social/me/following'),
    enabled: !!t,
    staleTime: 60 * 1000,
  });
}

export function useFollowUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.post(`/social/users/${userId}/follow`),
    onSuccess: (_d, userId) => {
      queryClient.invalidateQueries({ queryKey: ['social', 'profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['social', 'me', 'following'] });
      queryClient.invalidateQueries({ queryKey: ['social', 'suggestions'] });
    },
  });
}

export function useUnfollowUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/social/users/${userId}/follow`),
    onSuccess: (_d, userId) => {
      queryClient.invalidateQueries({ queryKey: ['social', 'profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['social', 'me', 'following'] });
      queryClient.invalidateQueries({ queryKey: ['social', 'suggestions'] });
    },
  });
}

// ─── Lists ────────────────────────────────────────────

export function useUserFollowers(userId: string | undefined, enabled = true) {
  return useQuery<FollowListUser[]>({
    queryKey: ['social', 'followers', userId],
    queryFn: () => api.get<FollowListUser[]>(`/social/users/${userId}/followers`),
    enabled: enabled && !!userId,
  });
}

export function useUserFollowing(userId: string | undefined, enabled = true) {
  return useQuery<FollowListUser[]>({
    queryKey: ['social', 'following', userId],
    queryFn: () => api.get<FollowListUser[]>(`/social/users/${userId}/following`),
    enabled: enabled && !!userId,
  });
}

// ─── Suggestions ──────────────────────────────────────

export function useSuggestions() {
  const t = token();
  return useQuery<SuggestionUser[]>({
    queryKey: ['social', 'suggestions'],
    queryFn: () => api.get<SuggestionUser[]>('/social/suggestions'),
    enabled: !!t,
    staleTime: 5 * 60 * 1000,
  });
}
