'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

/* ═══════════════════════════════════════════════════════════════
   Identity — Phase 9 types + hooks for the reader's own profile:
   the composed /users/me/identity payload and the Wrapped report.
   ═══════════════════════════════════════════════════════════════ */

// ─── Types ────────────────────────────────────────────

export interface ReadingLevel {
  current: { key: string; label: string; emoji: string; min: number };
  next: { key: string; label: string; emoji: string; min: number } | null;
  progress: number; // 0-100
}

export interface ReputationTier {
  key: string;
  label: string;
  emoji: string;
  min: number;
  description: string;
}

export interface ReputationSignal {
  key: string;
  label: string;
  points: number;
  weight: number;
}

export interface ReputationData {
  score: number;
  tier: ReputationTier;
  signals: ReputationSignal[];
}

export interface Archetype {
  key: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  gradient: string;
  score: number;
}

export interface PersonalityData {
  primary: Archetype;
  secondary: Archetype | null;
  all: Archetype[];
}

export interface JourneyMilestone {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  emoji: string;
  achievedAt: string;
}

export interface JourneyData {
  items: JourneyMilestone[];
  count: number;
  startedAt: string | null;
}

export interface GenreStat {
  genre: string;
  count: number;
}

export interface MonthStat {
  key: string;
  label: string;
  chapters: number;
  minutes: number;
}

export interface AuthorStat {
  author: string;
  chapters: number;
  titles: number;
}

export interface ArtistStat {
  artist: string;
  chapters: number;
  titles: number;
}

export interface SeriesStat {
  titleId: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  chaptersRead: number;
}

export interface AnalyticsData {
  totalChapters: number;
  totalSeries: number;
  pagesRead: number;
  volumesRead: number;
  seriesCompleted: number;
  completionRate: number;
  streakDays: number;
  bestStreak: number;
  daysActive: number;
  totalReadingMinutes: number;
  hoursRead: number;
  averageChaptersPerDay: number;
  averageRatingGiven: number | null;
  nightShare: number;
  genreDistribution: GenreStat[];
  favoriteAuthors: AuthorStat[];
  favoriteArtists: ArtistStat[];
  readingCalendar: { date: string; read: boolean; count: number }[];
  readingByMonth: MonthStat[];
  longestSeries: SeriesStat | null;
  fastestCompletedSeries: (SeriesStat & { days: number }) | null;
  perTitle: (SeriesStat & { type: string; author: string | null })[];
  completedSeries: (SeriesStat & { totalChapters: number | null })[];
  totalReadingDays: number;
}

export interface WrappedMood {
  key: string;
  label: string;
  emoji: string;
  description: string;
}

export interface WrappedData {
  year: number;
  generatedAt: string;
  chaptersRead: number;
  pagesRead: number;
  hoursRead: number;
  daysActive: number;
  totalSeries: number;
  longestStreak: number;
  favoriteGenre: GenreStat | null;
  mood: WrappedMood;
  topSeries: { slug: string; title: string; coverUrl: string | null; chapters: number }[];
  achievements: { badgeId: string; name: string; emoji: string; description: string }[];
  achievementsEarned: number;
  growth: { chaptersThisYear: number; chaptersLastYear: number; pct: number } | null;
  community: { posts: number; comments: number; reviews: number; listsCreated: number; followersGained: number };
  averageRatingGiven: number | null;
  genresTried: number;
  firstReadAt: string | null;
  lastReadAt: string | null;
  opener: string;
  closer: string;
}

export interface OwnIdentity {
  user: {
    id: string;
    email: string;
    displayName: string;
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
    subscriptionTier: string;
    streakDays: number;
    reputation: number;
    totalReadingMinutes: number;
    lastActiveAt: string | null;
    pinnedItems: Record<string, string[]>;
    pinnedManga: string[];
    createdAt: string;
  };
  username: string;
  prefs: Record<string, unknown>;
  readingLevel: ReadingLevel;
  reputation: ReputationData;
  personality: PersonalityData;
  journey: JourneyData;
  stats: AnalyticsData;
  wrapped: WrappedData | null;
}

// ─── Hooks ────────────────────────────────────────────

export function useOwnIdentity(enabled = true) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery<OwnIdentity>({
    queryKey: ['identity', 'me'],
    queryFn: () => api.get<OwnIdentity>('/users/me/identity'),
    enabled: enabled && !!token,
    staleTime: 60 * 1000,
  });
}

/** Cached Wrapped report for a year (null if not generated yet). */
export function useWrapped(year: number, enabled = true) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery<WrappedData | null>({
    queryKey: ['identity', 'wrapped', year],
    queryFn: () => api.get<WrappedData | null>(`/users/me/wrapped?year=${year}`),
    enabled: enabled && !!token,
    staleTime: 10 * 60 * 1000,
  });
}

/** Generate (and cache) the Wrapped report for a year. */
export function useGenerateWrapped() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (year: number) => api.post<WrappedData>('/users/me/wrapped', { year }),
    onSuccess: (data) => {
      queryClient.setQueryData(['identity', 'wrapped', data.year], data);
      queryClient.invalidateQueries({ queryKey: ['identity', 'me'] });
    },
  });
}
