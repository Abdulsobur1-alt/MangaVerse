'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export type LibraryView = 'grid' | 'list' | 'compact';
export type CardDensity = 'cozy' | 'compact';

export interface UserPrefs {
  libraryView: LibraryView;
  preferredGenres: string[]; // DB-form slugs (e.g. `sci_fi`)
  homepageRecs: boolean;
  cardDensity: CardDensity;
  publicProfile: boolean;
  shareActivity: boolean;
  // ─── Privacy (Phase 9) — per-section visibility ───
  shareStats: boolean;
  shareReading: boolean;
  shareCollections: boolean;
  shareBookmarks: boolean;
  shareAchievements: boolean;
  shareGoals: boolean;
  shareLists: boolean;
  shareReviews: boolean;
  shareFollowers: boolean;
  shareFollowing: boolean;
}

export const DEFAULT_PREFS: UserPrefs = {
  libraryView: 'grid',
  preferredGenres: [],
  homepageRecs: true,
  cardDensity: 'cozy',
  publicProfile: true,
  shareActivity: true,
  shareStats: true,
  shareReading: true,
  shareCollections: true,
  shareBookmarks: true,
  shareAchievements: true,
  shareGoals: true,
  shareLists: true,
  shareReviews: true,
  shareFollowers: true,
  shareFollowing: true,
};

// ─── Hooks ────────────────────────────────────────────

export function usePrefs(enabled = true) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery<UserPrefs>({
    queryKey: ['user', 'prefs'],
    queryFn: () => api.get<UserPrefs>('/users/prefs'),
    enabled: enabled && !!token,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdatePrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserPrefs>) => api.put<UserPrefs>('/users/prefs', data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['user', 'prefs'], updated);
      queryClient.invalidateQueries({ queryKey: ['user', 'prefs'] });
    },
  });
}
