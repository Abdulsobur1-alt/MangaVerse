'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface AdminStats {
  users: number;
  posts: number;
  comments: number;
  clubs: number;
  wikiPages: number;
  predictions: number;
  openPredictions: number;
  reviews: number;
  chapters: number;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  streakDays: number;
  createdAt: string;
  _count: { communityPosts: number; postComments: number; reviews: number };
}

export interface AdminPost {
  id: string;
  title: string;
  body: string;
  tag: string;
  author: { id: string; displayName: string; email: string };
  upvotes: number;
  comments: number;
  createdAt: string;
}

export interface AdminComment {
  id: string;
  body: string;
  author: { id: string; displayName: string; email: string };
  post: { id: string; title: string };
  createdAt: string;
}

export interface AdminWikiPage {
  id: string;
  slug: string;
  version: number;
  contentPreview: string;
  author: { id: string; displayName: string; email: string };
  title: { slug: string; title: string };
  updatedAt: string;
}

export interface AdminClub {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ─── Stats ────────────────────────────────────────────

export function useAdminStats(enabled = true) {
  return useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<AdminStats>('/admin/stats'),
    enabled,
    staleTime: 30 * 1000,
  });
}

// ─── Users ────────────────────────────────────────────

export function useAdminUsers(params?: { page?: number; search?: string }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.search) sp.set('search', params.search);

  return useQuery<Paginated<AdminUser>>({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.get<Paginated<AdminUser>>(`/admin/users?${sp}`),
    enabled,
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { userId: string; role: string }) =>
      api.patch<AdminUser>(`/admin/users/${data.userId}/role`, { role: data.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

// ─── Posts moderation ─────────────────────────────────

export function useAdminPosts(params?: { page?: number }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));

  return useQuery<Paginated<AdminPost>>({
    queryKey: ['admin', 'posts', params],
    queryFn: () => api.get<Paginated<AdminPost>>(`/admin/posts?${sp}`),
    enabled,
  });
}

export function useAdminDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => api.delete(`/admin/posts/${postId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

// ─── Comments moderation ──────────────────────────────

export function useAdminComments(params?: { page?: number }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));

  return useQuery<Paginated<AdminComment>>({
    queryKey: ['admin', 'comments', params],
    queryFn: () => api.get<Paginated<AdminComment>>(`/admin/comments?${sp}`),
    enabled,
  });
}

export function useAdminDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => api.delete(`/admin/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

// ─── Wiki moderation ──────────────────────────────────

export function useAdminWiki(params?: { page?: number }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));

  return useQuery<Paginated<AdminWikiPage>>({
    queryKey: ['admin', 'wiki', params],
    queryFn: () => api.get<Paginated<AdminWikiPage>>(`/admin/wiki?${sp}`),
    enabled,
  });
}

export function useAdminDeleteWiki() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => api.delete(`/admin/wiki/${slug}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'wiki'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

// ─── Clubs moderation ─────────────────────────────────

export function useAdminClubs(params?: { page?: number }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));

  return useQuery<Paginated<AdminClub>>({
    queryKey: ['admin', 'clubs', params],
    queryFn: () => api.get<Paginated<AdminClub>>(`/admin/clubs?${sp}`),
    enabled,
  });
}

export function useAdminDeleteClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clubId: string) => api.delete(`/admin/clubs/${clubId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clubs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}
