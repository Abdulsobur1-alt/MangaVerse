'use client';

import { useQuery, useQueries } from '@tanstack/react-query';
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
  /** @since Phase 6 — returned by /api/titles list queries. */
  artist?: string | null;
  /** @since Phase 6 — returned by /api/titles list queries. */
  releaseYear?: number | null;
  /** @since Phase 6 — bookmark counts for popularity sorting. */
  _count?: { bookmarks?: number };
  coverUrl: string | null;
  rating: number | null;
  totalChapters: number | null;
  createdAt: string;
  latestChapter: { number: number; createdAt: string } | null;
}

/** Filter surface for /api/titles (Phase 6: author / year / rating / bookmarks). */
export interface TitlesQuery {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  genre?: string;
  genres?: string;
  author?: string;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  sort?: string;
  search?: string;
  enabled?: boolean;
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
  updatedAt: string;
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

function titlesToSearchParams(params: TitlesQuery): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.type) searchParams.set('type', params.type);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.genre) searchParams.set('genre', params.genre);
  if (params?.genres) searchParams.set('genres', params.genres);
  if (params?.author) searchParams.set('author', params.author);
  if (params?.yearFrom != null) searchParams.set('yearFrom', String(params.yearFrom));
  if (params?.yearTo != null) searchParams.set('yearTo', String(params.yearTo));
  if (params?.minRating != null) searchParams.set('minRating', String(params.minRating));
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.search) searchParams.set('search', params.search);
  return searchParams;
}

export function useTitles(params?: TitlesQuery) {
  const searchParams = titlesToSearchParams(params ?? {});
  return useQuery<PaginatedResult<TitleListItem>>({
    queryKey: ['titles', params],
    queryFn: () => api.get<PaginatedResult<TitleListItem>>(`/titles?${searchParams}`),
    enabled: params?.enabled ?? true,
  });
}

/**
 * Accumulate N pages of the title list (for infinite load-more). Each page is
 * its own cached react-query entry; items are flattened + deduped by id. Uses
 * the same Phase 6 filter surface as `useTitles`.
 */
export function useTitlesPages(params: TitlesQuery, pages: number) {
  const pageSize = params.limit ?? 24;
  const queries = Array.from({ length: pages }, (_, i) => {
    const pageParams = { ...params, page: i + 1, limit: pageSize };
    return {
      queryKey: ['titles', pageParams] as const,
      queryFn: () => api.get<PaginatedResult<TitleListItem>>(`/titles?${titlesToSearchParams(pageParams)}`),
      enabled: params.enabled ?? true,
    };
  });

  const results = useQueries({ queries });

  const items = Array.from(
    new Map(results.flatMap((r) => r.data?.items ?? []).map((t) => [t.id, t])).values(),
  );
  const last = results[results.length - 1];

  return {
    items,
    total: last?.data?.total ?? 0,
    hasMore: last?.data?.hasMore ?? false,
    isFetching: results.some((r) => r.isFetching),
    // Only the very first load (no data at all yet) counts as loading —
    // appended pages must not blank the grid.
    isLoading: !results[0]?.data && results.some((r) => r.isLoading),
    error: results.find((r) => r.error)?.error ?? undefined,
  };
}

/** Genre → title-count aggregation (GET /api/titles/genres). */
export function useGenreCounts() {
  return useQuery<{ genre: string; count: number }[]>({
    queryKey: ['titles', 'genre-counts'],
    queryFn: () => api.get<{ genre: string; count: number }[]>('/titles/genres'),
    staleTime: 10 * 60 * 1000,
  });
}

export interface RecentlyUpdatedTitle {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
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

/**
 * Fetch a title with multiple chapter pages accumulated (for load-more).
 * Uses useQueries so every page is individually cached; the first page's
 * detail is the title, chapters are flattened + deduped by id.
 */
export function useTitleChapters(slug: string, pages: number, limit: number) {
  const queries = Array.from({ length: pages }, (_, i) => ({
    queryKey: ['title', slug, i + 1, limit] as const,
    queryFn: () => api.get<TitleDetail>(`/titles/${slug}?chaptersPage=${i + 1}&chaptersLimit=${limit}`),
    enabled: !!slug,
  }));

  const results = useQueries({ queries });

  const first = results.find((r) => r.data)?.data;
  const last = results[results.length - 1];
  const chapters = Array.from(
    new Map(results.flatMap((r) => r.data?.chapters ?? []).map((c) => [c.id, c])).values(),
  );

  return {
    title: first ?? undefined,
    chapters,
    pagination: last?.data?.chaptersPagination ?? { page: pages, limit, total: 0, hasMore: false },
    // isLoading only matters while we have NO title yet — additional pages
    // appended by load-more must not re-trigger the full-page skeleton.
    isLoading: !first && results.some((r) => r.isLoading),
    // Any in-flight request (page 2+ during load-more).
    isFetching: results.some((r) => r.isFetching),
    error: results.find((r) => r.error)?.error ?? undefined,
  };
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
