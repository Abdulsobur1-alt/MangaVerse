'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export interface ChapterItem {
  id: string;
  number: number;
  title: string | null;
  pageCount: number | null;
  coinLocked: boolean;
  createdAt: string;
}

export interface ChapterDetail extends ChapterItem {
  titleId: string;
  freeAt?: string | null;
  sourceUrl?: string | null;
  locked: boolean;
  unlocked: boolean;
  unlockCost: number | null;
  series: {
    id: string;
    slug: string;
    title: string;
    coverUrl: string | null;
  };
}

export function useChapters(titleId?: string, titleSlug?: string, options?: { page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (titleId) params.set('titleId', titleId);
  if (titleSlug) params.set('titleSlug', titleSlug);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));

  return useQuery<{ items: ChapterItem[]; total: number; page: number; limit: number; hasMore: boolean }>({
    queryKey: ['chapters', titleId || titleSlug, options],
    queryFn: () => api.get(`/chapters?${params}`),
    enabled: !!(titleId || titleSlug),
  });
}

export function useChapter(id: string) {
  return useQuery<ChapterDetail>({
    queryKey: ['chapter', id],
    queryFn: () => api.get<ChapterDetail>(`/chapters/${id}`),
    enabled: !!id,
  });
}
