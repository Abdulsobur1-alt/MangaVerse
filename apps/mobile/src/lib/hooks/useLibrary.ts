import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export interface BookmarkItem {
  id: string;
  userId: string;
  titleId: string;
  listName: string;
  createdAt: string;
  title: {
    id: string;
    slug: string;
    title: string;
    type: string;
    coverUrl: string | null;
    rating: number | null;
    totalChapters: number | null;
  };
}

export function useLibrary(listName?: string) {
  const params = listName ? `?listName=${encodeURIComponent(listName)}` : '';
  return useQuery<{ items: BookmarkItem[]; total: number }>({
    queryKey: ['library', listName],
    queryFn: () => api.get<{ items: BookmarkItem[]; total: number }>(`/library${params}`),
  });
}

export function useAddBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { titleId: string; listName?: string }) =>
      api.post('/library', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
}

export function useRemoveBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (titleId: string) => api.delete(`/library/${titleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
}
