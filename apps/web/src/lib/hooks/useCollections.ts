'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface CollectionTitle {
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
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  tags: string[];
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  cover: string | null; // first item's cover, for card collages
}

export interface CollectionItem {
  id: string;
  collectionId: string;
  titleId: string;
  note: string | null;
  sortOrder: number;
  createdAt: string;
  title: CollectionTitle;
}

export interface CollectionDetail extends CollectionSummary {
  items: CollectionItem[];
}

export interface CreateCollectionData {
  name: string;
  description?: string;
  tags?: string[];
  isPrivate?: boolean;
}

// ─── Hooks ────────────────────────────────────────────

export function useCollections(enabled = true) {
  return useQuery<CollectionSummary[]>({
    queryKey: ['collections'],
    queryFn: () => api.get<CollectionSummary[]>('/collections'),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useCollection(id: string | undefined, enabled = true) {
  return useQuery<CollectionDetail>({
    queryKey: ['collections', id],
    queryFn: () => api.get<CollectionDetail>(`/collections/${id}`),
    enabled: !!id && enabled,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCollectionData) => api.post<CollectionSummary>('/collections', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CreateCollectionData>) =>
      api.patch<CollectionSummary>(`/collections/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/collections/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  });
}

export function useAddCollectionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, titleId, note }: { collectionId: string; titleId: string; note?: string | null }) =>
      api.post<CollectionItem>(`/collections/${collectionId}/items`, { titleId, note }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['collections', vars.collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useRemoveCollectionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, titleId }: { collectionId: string; titleId: string }) =>
      api.delete(`/collections/${collectionId}/items/${titleId}`),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['collections', vars.collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
