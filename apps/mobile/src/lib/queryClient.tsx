import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, TitleItem, TitleDetail, PaginatedResult, ChapterDetail, ChapterItem, ReviewItem, ReviewsResponse } from './api';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// ─── Hooks ────────────────────────────────────────────

export function useTrending() {
  return useQuery<TitleItem[]>({
    queryKey: ['titles', 'trending'],
    queryFn: () => api.get<TitleItem[]>('/titles/trending'),
  });
}

export function useTitles(params?: {
  page?: number;
  limit?: number;
  type?: string;
  genre?: string;
  sort?: string;
  search?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.type) sp.set('type', params.type);
  if (params?.genre) sp.set('genre', params.genre);
  if (params?.sort) sp.set('sort', params.sort);
  if (params?.search) sp.set('search', params.search);

  return useQuery<PaginatedResult<TitleItem>>({
    queryKey: ['titles', params],
    queryFn: () => api.get<PaginatedResult<TitleItem>>(`/titles?${sp}`),
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

export function useChapter(id: string) {
  return useQuery<ChapterDetail>({
    queryKey: ['chapter', id],
    queryFn: () => api.get<ChapterDetail>(`/chapters/${id}`),
    enabled: !!id,
  });
}

export function useChapters(titleSlug?: string) {
  return useQuery<{ items: ChapterItem[]; total: number }>({
    queryKey: ['chapters', titleSlug],
    queryFn: () => api.get(`/chapters?titleSlug=${titleSlug}`),
    enabled: !!titleSlug,
  });
}

// ─── Reviews Hooks ────────────────────────────

export function useTitleReviews(slug: string, options?: {
  page?: number;
  limit?: number;
  sort?: string;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.sort) params.set('sort', options.sort);

  return useQuery<ReviewsResponse>({
    queryKey: ['reviews', slug, options],
    queryFn: () => api.get<ReviewsResponse>(`/reviews/title/${slug}?${params}`),
    enabled: !!slug,
  });
}

export function useCreateReview(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { rating: number; body: string }) =>
      api.post(`/reviews/title/${slug}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', slug] });
      queryClient.invalidateQueries({ queryKey: ['title', slug] });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/reviews/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['title'] });
    },
  });
}

export function useSearch(query: string) {
  return useQuery<PaginatedResult<TitleItem>>({
    queryKey: ['search', query],
    queryFn: () => api.get<PaginatedResult<TitleItem>>(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.length > 1,
  });
}
