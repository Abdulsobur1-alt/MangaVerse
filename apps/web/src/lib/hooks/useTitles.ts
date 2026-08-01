'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface TitleListItem {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  genres: string[];
  author: string | null;
  coverUrl: string | null;
  rating: number | null;
  totalChapters: number | null;
  createdAt: string;
}

export interface ChapterProgress {
  pageNumber: number;
  completed: boolean;
}

export interface TitleChapter {
  id: string;
  number: number;
  title: string | null;
  pageCount: number | null;
  coinLocked: boolean;
  freeAt: string | null;
  isLocked: boolean;
  createdAt: string;
  progress: ChapterProgress | null;
}

export interface ChapterPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface TitleDetail extends TitleListItem {
  alternativeTitles?: string | null;
  tags: string[];
  artist: string | null;
  bannerUrl: string | null;
  synopsis: string | null;
  releaseYear: number | null;
  _count: { chapters: number; bookmarks: number; reviews: number };
  chapters: TitleChapter[];
  chaptersPagination: ChapterPagination;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ─── Hooks ────────────────────────────────────────────

export function useTitles(params?: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  genre?: string;
  genres?: string;
  sort?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.type) searchParams.set('type', params.type);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.genre) searchParams.set('genre', params.genre);
  if (params?.genres) searchParams.set('genres', params.genres);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.search) searchParams.set('search', params.search);

  return useQuery<PaginatedResult<TitleListItem>>({
    queryKey: ['titles', params],
    queryFn: () => api.get<PaginatedResult<TitleListItem>>(`/titles?${searchParams}`),
  });
}

export interface RecentlyUpdatedTitle {
  id: string;
  slug: string;
  title: string;
  type: string;
  genres: string[];
  coverUrl: string | null;
  rating: number | null;
  totalChapters: number | null;
  _count: { chapters: number };
  latestChapter: { number: number; createdAt: string } | null;
}

export function useRecentlyUpdated() {
  return useQuery<RecentlyUpdatedTitle[]>({
    queryKey: ['titles', 'recently-updated'],
    queryFn: () => api.get<RecentlyUpdatedTitle[]>('/titles/recently-updated'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrendingTitles() {
  return useQuery<TitleListItem[]>({
    queryKey: ['titles', 'trending'],
    queryFn: () => api.get<TitleListItem[]>('/titles/trending'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTitle(slug: string, chaptersPage?: number, chaptersLimit?: number) {
  const params = new URLSearchParams();
  if (chaptersPage) params.set('chaptersPage', String(chaptersPage));
  if (chaptersLimit) params.set('chaptersLimit', String(chaptersLimit));
  const qs = params.toString();

  return useQuery<TitleDetail>({
    queryKey: ['title', slug, chaptersPage, chaptersLimit],
    queryFn: () => api.get<TitleDetail>(`/titles/${slug}${qs ? `?${qs}` : ''}`),
    enabled: !!slug,
  });
}

export function useSearchTitles(query: string, options?: {
  limit?: number;
  genre?: string;
  type?: string;
}) {
  const params = new URLSearchParams({ q: query });
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.genre) params.set('genre', options.genre);
  if (options?.type) params.set('type', options.type);

  return useQuery<PaginatedResult<TitleListItem>>({
    queryKey: ['search', query, options],
    queryFn: () => api.get<PaginatedResult<TitleListItem>>(`/search?${params}`),
    enabled: query.length > 1,
  });
}

export function useSearchSuggestions(query: string) {
  return useQuery<{ slug: string; title: string; type: string; coverUrl: string | null }[]>({
    queryKey: ['suggestions', query],
    queryFn: () => api.get<{ slug: string; title: string; type: string; coverUrl: string | null }[]>(
      `/search/suggestions?q=${encodeURIComponent(query)}`,
    ),
    enabled: query.length > 1,
  });
}
