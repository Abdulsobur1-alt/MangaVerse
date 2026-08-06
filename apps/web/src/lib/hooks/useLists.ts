'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface ListUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ListSummary {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  coverUrl: string | null;
  isPublic: boolean;
  likeCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  user: ListUser;
  itemCount: number;
  liked: boolean;
  cover: string | null;
}

export interface ListTitle {
  id: string;
  slug: string;
  title: string;
  type: string;
  coverUrl: string | null;
  rating: number | null;
  totalChapters: number | null;
}

export interface ListItem {
  id: string;
  note: string | null;
  sortOrder: number;
  addedAt: string;
  title: ListTitle;
}

export interface ListDetail {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  coverUrl: string | null;
  isPublic: boolean;
  likeCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  user: ListUser;
  owner: boolean;
  liked: boolean;
  items: ListItem[];
}

export interface PaginatedLists {
  items: ListSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateListData {
  name: string;
  description?: string | null;
  tags?: string[];
  coverUrl?: string | null;
  isPublic?: boolean;
}

// ─── Hooks ────────────────────────────────────────────

export function usePublicLists(params?: { page?: number; sort?: 'popular' | 'newest'; search?: string; userId?: string }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page && params.page > 1) sp.set('page', String(params.page));
  if (params?.sort) sp.set('sort', params.sort);
  if (params?.search) sp.set('search', params.search);
  if (params?.userId) sp.set('userId', params.userId);

  return useQuery<PaginatedLists>({
    queryKey: ['lists', 'public', params ?? {}],
    queryFn: () => api.get<PaginatedLists>(`/lists${sp.toString() ? `?${sp}` : ''}`),
    enabled,
  });
}

export function useMyLists() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery<ListSummary[]>({
    queryKey: ['lists', 'mine'],
    queryFn: () => api.get<ListSummary[]>('/lists/mine'),
    enabled: !!token,
  });
}

export function useList(id: string | undefined, enabled = true) {
  return useQuery<ListDetail>({
    queryKey: ['lists', id],
    queryFn: () => api.get<ListDetail>(`/lists/${id}`),
    enabled: enabled && !!id,
  });
}

export function useCreateList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateListData) => api.post<{ id: string; name: string; isPublic: boolean }>('/lists', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useUpdateList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CreateListData>) => api.patch(`/lists/${id}`, data),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['lists', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/lists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useAddListItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, titleId, note }: { listId: string; titleId: string; note?: string }) =>
      api.post<ListItem>(`/lists/${listId}/items`, { titleId, note }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['lists', vars.listId] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useRemoveListItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, titleId }: { listId: string; titleId: string }) =>
      api.delete(`/lists/${listId}/items/${titleId}`),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['lists', vars.listId] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useToggleListLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => api.post<{ liked: boolean; likeCount: number }>(`/lists/${listId}/like`),
    onSuccess: (_d, listId) => {
      queryClient.invalidateQueries({ queryKey: ['lists', listId] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}
