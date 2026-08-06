'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface ReviewUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ReviewItem {
  id: string;
  rating: number;
  headline: string | null;
  spoiler: boolean;
  body: string | null;
  subScores: {
    story?: number;
    art?: number;
    characters?: number;
    enjoyment?: number;
  } | null;
  helpfulCount: number;
  helpful: boolean;
  createdAt: string;
  updatedAt: string;
  user: ReviewUser;
}

export interface ReviewsResponse {
  items: ReviewItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  averageRating: number | null;
  totalReviews: number;
}

export interface MyReviewItem extends ReviewItem {
  title: {
    id: string;
    slug: string;
    title: string;
    type: string;
    coverUrl: string | null;
  };
}

// ─── Hooks ────────────────────────────────────────────

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

export function useMyReviews() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  return useQuery<MyReviewItem[]>({
    queryKey: ['reviews', 'mine'],
    queryFn: () => api.get<MyReviewItem[]>('/reviews/mine'),
    enabled: !!token,
  });
}

export function useCreateReview(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { rating: number; headline?: string; spoiler?: boolean; body?: string; subScores?: Record<string, number> }) =>
      api.post(`/reviews/title/${slug}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', slug] });
      queryClient.invalidateQueries({ queryKey: ['title', slug] });
      queryClient.invalidateQueries({ queryKey: ['reviews', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'stats'] });
    },
  });
}

export function useUpdateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: string; rating?: number; headline?: string; spoiler?: boolean; body?: string; subScores?: Record<string, number> }) =>
      api.put(`/reviews/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['title'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'stats'] });
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
      queryClient.invalidateQueries({ queryKey: ['user', 'stats'] });
    },
  });
}

// ─── Phase 8: helpful-vote toggle ─────────────────────

export function useToggleHelpful() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reviewId: string) => api.post<{ helpful: boolean }>(`/reviews/${reviewId}/helpful`),
    onSuccess: () => {
      // Refetch review lists so counts + per-user state stay in sync
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}
