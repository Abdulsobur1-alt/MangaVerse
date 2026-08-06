'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface PageBookmarkItem {
  id: string;
  userId: string;
  titleId: string;
  chapterId: string;
  pageNumber: number;
  quote: string | null;
  note: string | null;
  folder: string | null;
  tags: string[];
  createdAt: string;
  title: {
    id: string;
    slug: string;
    title: string;
    coverUrl: string | null;
    type: string;
  };
  chapter: {
    id: string;
    number: number;
    title: string | null;
  };
}

export interface BookmarkList {
  items: PageBookmarkItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  folders: { name: string; count: number }[];
  tags: { name: string; count: number }[];
}

export interface CreateBookmarkData {
  titleId: string;
  chapterId: string;
  pageNumber: number;
  quote?: string;
  note?: string;
  folder?: string | null;
  tags?: string[];
}

export interface UpdateBookmarkData {
  pageNumber?: number;
  quote?: string | null;
  note?: string | null;
  folder?: string | null;
  tags?: string[];
}

// ─── Hooks ────────────────────────────────────────────

export function useBookmarks(filters?: { folder?: string; tag?: string; chapterId?: string; search?: string; page?: number; limit?: number }, enabled = true) {
  const params = new URLSearchParams();
  if (filters?.folder) params.set('folder', filters.folder);
  if (filters?.tag) params.set('tag', filters.tag);
  if (filters?.chapterId) params.set('chapterId', filters.chapterId);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.page && filters.page > 1) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();

  return useQuery<BookmarkList>({
    queryKey: ['bookmarks', filters ?? {}],
    queryFn: () => api.get<BookmarkList>(`/bookmarks${qs ? `?${qs}` : ''}`),
    enabled,
  });
}

/** Convenience: is there a page bookmark for this exact chapter? */
export function useChapterBookmark(chapterId: string | undefined, enabled = true) {
  return useQuery<PageBookmarkItem | null>({
    queryKey: ['bookmarks', 'chapter', chapterId],
    queryFn: async () => {
      const data = await api.get<BookmarkList>(`/bookmarks?chapterId=${chapterId}&limit=1`);
      return data.items[0] ?? null;
    },
    enabled: enabled && !!chapterId,
  });
}

export function useCreateBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBookmarkData) => api.post<PageBookmarkItem>('/bookmarks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}

export function useUpdateBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateBookmarkData) =>
      api.patch<PageBookmarkItem>(`/bookmarks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}

export function useDeleteBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ message: string }>(`/bookmarks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
