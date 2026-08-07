'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface StudioTitle {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  coverUrl: string | null;
  rating: number | null;
  totalChapters: number | null;
  chapters: number;
  saves: number;
  reviews: number;
  updatedAt: string;
}

export interface StudioChapter {
  id: string;
  number: number;
  title: string | null;
  pageCount: number | null;
  pageUrls: string[];
  coinLocked: boolean;
  freeAt: string | null;
  createdAt: string;
}

export interface StudioTitleDetail extends StudioTitle {
  synopsis: string | null;
  alternativeTitles: string | null;
  genres: string[];
  tags: string[];
  author: string | null;
  artist: string | null;
  bannerUrl: string | null;
  releaseYear: number | null;
  sourceUrl: string | null;
}

// ─── Content types the studio supports ────────────────

export const STUDIO_TYPES = [
  { value: 'manga', label: 'Manga', emoji: '📗' },
  { value: 'manhwa', label: 'Manhwa', emoji: '🇰🇷' },
  { value: 'manhua', label: 'Manhua', emoji: '🇨🇳' },
  { value: 'light_novel', label: 'Light Novel', emoji: '📕' },
  { value: 'novel', label: 'Novel', emoji: '📖' },
  { value: 'webtoon', label: 'Webtoon', emoji: '🎨' },
] as const;

export const STUDIO_STATUSES = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'hiatus', label: 'Hiatus' },
  { value: 'dropped', label: 'Dropped' },
] as const;

export const GENRES = [
  'action', 'romance', 'isekai', 'horror', 'fantasy', 'cultivation', 'slice_of_life',
  'mystery', 'sports', 'mecha', 'ecchi', 'comedy', 'drama', 'sci_fi', 'thriller',
  'adventure', 'supernatural', 'historical', 'psychological', 'bl', 'gl',
] as const;

// ─── Titles list ──────────────────────────────────────

export function useStudioTitles(params?: { page?: number; search?: string; status?: string; type?: string }, enabled = true) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.search) sp.set('search', params.search);
  if (params?.status) sp.set('status', params.status);
  if (params?.type) sp.set('type', params.type);

  return useQuery<{ items: StudioTitle[]; total: number; page: number; limit: number; hasMore: boolean }>({
    queryKey: ['studio', 'titles', params],
    queryFn: () => api.get(`/admin/cms/titles?${sp}`),
    enabled,
  });
}

export function useStudioTitle(id: string | null, enabled = true) {
  return useQuery<StudioTitleDetail>({
    queryKey: ['studio', 'title', id],
    queryFn: () => api.get(`/admin/cms/titles/${id}`),
    enabled: enabled && !!id,
  });
}

export function useStudioChapters(titleId: string | null, enabled = true) {
  return useQuery<StudioChapter[]>({
    queryKey: ['studio', 'chapters', titleId],
    queryFn: () => api.get<StudioChapter[]>(`/admin/cms/titles/${titleId}/chapters`),
    enabled: enabled && !!titleId,
  });
}

// ─── Create / delete title ────────────────────────────

export function useStudioCreateTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/admin/studio/titles', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['studio', 'titles'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}

export function useStudioDeleteTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/studio/titles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['studio', 'titles'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}

export function useStudioUpdateTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; patch: Record<string, unknown> }) =>
      api.patch(`/admin/cms/titles/${data.id}`, data.patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['studio', 'titles'] });
      qc.invalidateQueries({ queryKey: ['studio', 'title', v.id] });
      qc.invalidateQueries({ queryKey: ['admin', 'cms'] });
    },
  });
}

// ─── Chapter create / delete / reorder ────────────────

export function useStudioCreateChapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { titleId: string; chapter: Record<string, unknown> }) =>
      api.post(`/admin/studio/titles/${data.titleId}/chapters`, data.chapter),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['studio', 'chapters', v.titleId] });
      qc.invalidateQueries({ queryKey: ['studio', 'title', v.titleId] });
      qc.invalidateQueries({ queryKey: ['studio', 'titles'] });
    },
  });
}

export function useStudioDeleteChapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; titleId: string }) => api.delete(`/admin/studio/chapters/${data.id}`),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['studio', 'chapters', v.titleId] });
      qc.invalidateQueries({ queryKey: ['studio', 'title', v.titleId] });
      qc.invalidateQueries({ queryKey: ['studio', 'titles'] });
    },
  });
}

export function useStudioReorderChapters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { titleId: string; order: { id: string; number: number }[] }) =>
      api.post(`/admin/studio/titles/${data.titleId}/reorder`, { order: data.order }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['studio', 'chapters', v.titleId] });
      qc.invalidateQueries({ queryKey: ['studio', 'title', v.titleId] });
    },
  });
}

export function useStudioUpdateChapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; titleId: string; patch: Record<string, unknown> }) =>
      api.patch(`/admin/cms/chapters/${data.id}`, data.patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['studio', 'chapters', v.titleId] });
      qc.invalidateQueries({ queryKey: ['studio', 'title', v.titleId] });
    },
  });
}

// ─── Upload (cover / banner / chapter pages) ──────────

export function useStudioUpload() {
  return useMutation({
    mutationFn: (data: {
      file: File;
      folder: string;
      type?: 'image' | 'banner' | 'cover' | 'icon';
      name?: string;
    }) => fileToDataUrl(data.file).then((dataUrl) =>
      api.post<{ url: string; assetId: string }>('/admin/studio/upload', {
        data: dataUrl,
        folder: data.folder,
        name: data.name || data.file.name,
        type: data.type || 'image',
      }),
    ),
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// ─── Staff role gate ──────────────────────────────────

export const STAFF_ROLES = [
  'admin', 'super_admin', 'platform_admin', 'content_manager', 'editor', 'uploader', 'moderator',
] as const;

export function isStaffRole(role?: string | null): boolean {
  if (!role) return false;
  return (STAFF_ROLES as readonly string[]).includes(role);
}
