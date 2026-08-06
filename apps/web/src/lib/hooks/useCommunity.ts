'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface CommunityUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface PostSeries {
  slug: string;
  title: string;
  coverUrl: string | null;
}

export interface CommunityPost {
  id: string;
  title: string;
  body: string;
  tag: string;
  tagColor: string;
  views: number;
  createdAt: string;
  updatedAt: string;
  author: CommunityUser;
  series: PostSeries | null;
  upvotes: number;
  comments: number;
  voted: boolean;
  /** Phase 8: reaction tallies + the viewer's own reaction. */
  reactions: Record<string, number>;
  totalReactions: number;
  myReaction: string | null;
}

export interface PostComment {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  author: CommunityUser;
}

/** The six meaningful reactions (Phase 8). */
export const REACTIONS = [
  { key: 'upvote', emoji: '👍', label: 'Upvote' },
  { key: 'helpful', emoji: '🤝', label: 'Helpful' },
  { key: 'insightful', emoji: '💡', label: 'Insightful' },
  { key: 'funny', emoji: '😂', label: 'Funny' },
  { key: 'agree', emoji: '✅', label: 'Agree' },
  { key: 'love', emoji: '❤️', label: 'Love' },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]['key'];

export interface PostDetail extends Omit<CommunityPost, 'comments'> {
  comments: PostComment[];
}

export interface PaginatedPosts {
  items: CommunityPost[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ReadingClub {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
  joined: boolean;
}

export interface PredictionItem {
  id: string;
  question: string;
  options: string[];
  resolvesAt: string | null;
  result: string | null;
  createdAt: string;
  title: { slug: string; title: string; coverUrl: string | null } | null;
  optionStakes: Record<string, number>;
  totalStaked: number;
  totalVotes: number;
  myVote: { option: string; coinsStaked: number; won?: boolean; payout?: number } | null;
}

export interface WikiRevisionItem {
  id: string;
  version: number;
  contentMd: string;
  createdAt: string;
  author: { id: string; displayName: string };
}

export interface WikiData {
  titleId: string;
  title: string;
  coverUrl: string | null;
  wiki: {
    id: string;
    slug: string;
    contentMd: string;
    version: number;
    updatedAt: string;
    author: { id: string; displayName: string };
    revisions: WikiRevisionItem[];
  } | null;
}

// ─── Posts Hooks ──────────────────────────────────────

export function useCommunityPosts(params?: { page?: number; tag?: string; sort?: string }) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.tag) sp.set('tag', params.tag);
  if (params?.sort) sp.set('sort', params.sort);

  return useQuery<PaginatedPosts>({
    queryKey: ['community', 'posts', params],
    queryFn: () => api.get<PaginatedPosts>(`/community/posts?${sp}`),
  });
}

export function useCommunityPost(id: string) {
  return useQuery<PostDetail>({
    queryKey: ['community', 'post', id],
    queryFn: () => api.get<PostDetail>(`/community/posts/${id}`),
    enabled: !!id,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; body: string; tag: string; titleId?: string }) =>
      api.post('/community/posts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', 'posts'] });
    },
  });
}

export function useVotePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => api.post(`/community/posts/${postId}/vote`),
    onSuccess: (_data, postId) => {
      queryClient.invalidateQueries({ queryKey: ['community', 'post', postId] });
      queryClient.invalidateQueries({ queryKey: ['community', 'posts'] });
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { postId: string; body: string; parentId?: string }) =>
      api.post(`/community/posts/${data.postId}/comments`, { body: data.body, parentId: data.parentId }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['community', 'post', vars.postId] });
      queryClient.invalidateQueries({ queryKey: ['community', 'posts'] });
    },
  });
}

/** Set / switch / clear the viewer's reaction on a post (Phase 8). */
export function useReactToPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, reaction }: { postId: string; reaction: ReactionKey }) =>
      api.post(`/community/posts/${postId}/reaction`, { reaction }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['community', 'post', vars.postId] });
      queryClient.invalidateQueries({ queryKey: ['community', 'posts'] });
    },
  });
}

// ─── Clubs Hooks ──────────────────────────────────────

export function useReadingClubs() {
  return useQuery<{ items: ReadingClub[] }>({
    queryKey: ['community', 'clubs'],
    queryFn: () => api.get<{ items: ReadingClub[] }>('/community/clubs'),
  });
}

export function useCreateClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.post('/community/clubs', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', 'clubs'] });
    },
  });
}

export function useJoinClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clubId: string) => api.post(`/community/clubs/${clubId}/join`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', 'clubs'] });
    },
  });
}

export function useLeaveClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clubId: string) => api.post(`/community/clubs/${clubId}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', 'clubs'] });
    },
  });
}

// ─── Predictions Hooks ────────────────────────────────

export function usePredictions() {
  return useQuery<{ items: PredictionItem[] }>({
    queryKey: ['community', 'predictions'],
    queryFn: () => api.get<{ items: PredictionItem[] }>('/community/predictions'),
    staleTime: 60 * 1000,
  });
}

export function useVotePrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { predictionId: string; option: string; coins: number }) =>
      api.post(`/community/predictions/${data.predictionId}/vote`, {
        option: data.option,
        coins: data.coins,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', 'predictions'] });
      queryClient.invalidateQueries({ queryKey: ['coins'] });
    },
  });
}

// ─── Wiki Hooks ───────────────────────────────────────

export function useWiki(slug: string) {
  return useQuery<WikiData>({
    queryKey: ['community', 'wiki', slug],
    queryFn: () => api.get<WikiData>(`/community/wiki/${slug}`),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertWiki() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { slug: string; contentMd: string }) =>
      api.put(`/community/wiki/${data.slug}`, { contentMd: data.contentMd }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['community', 'wiki', vars.slug] });
    },
  });
}

export function useRevertWiki() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { slug: string; version: number }) =>
      api.post(`/community/wiki/${data.slug}/revert`, { version: data.version }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['community', 'wiki', vars.slug] });
    },
  });
}

// ─── Report / Flag ────────────────────────────────────

export interface CreateReportInput {
  contentType: 'post' | 'comment' | 'wiki';
  targetId: string;
  reason: 'spam' | 'harassment' | 'spoiler' | 'misinformation' | 'other';
  details?: string;
}

export function useCreateReport() {
  return useMutation({
    mutationFn: (data: CreateReportInput) => api.post('/community/reports', data),
  });
}
