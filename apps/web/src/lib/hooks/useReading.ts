'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export function useReadingProgress() {
  return useQuery({
    queryKey: ['reading', 'progress'],
    queryFn: () => api.get('/reading/progress'),
  });
}

export function useSaveProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { chapterId: string; pageNumber?: number; completed?: boolean }) =>
      api.post('/reading/progress', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading'] });
    },
  });
}

export function useReadingHistory() {
  return useQuery({
    queryKey: ['reading', 'history'],
    queryFn: () => api.get('/reading/history'),
  });
}
