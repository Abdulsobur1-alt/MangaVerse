import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { api, TitleItem, TitleDetail, PaginatedResult, ChapterDetail, ChapterItem } from './api';

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

export function useSearch(query: string) {
  return useQuery<PaginatedResult<TitleItem>>({
    queryKey: ['search', query],
    queryFn: () => api.get<PaginatedResult<TitleItem>>(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.length > 1,
  });
}
