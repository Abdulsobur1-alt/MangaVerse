'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  variant: 'info' | 'success' | 'warning' | 'seasonal' | 'maintenance';
  link: string | null;
  dismissible: boolean;
  createdAt: string;
}

export function useAnnouncements() {
  return useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: () => api.get<Announcement[]>('/announcements'),
    staleTime: 5 * 60_000,
  });
}

export function useDismissAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/announcements/${id}/dismiss`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}
