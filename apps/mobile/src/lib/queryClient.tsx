import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, TitleItem, TitleDetail, PaginatedResult, ChapterDetail, ChapterItem, ReviewItem, ReviewsResponse, NotificationItem, NotificationsResponse, CoinBalanceData, CoinTransactionItem } from './api';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// ─── Hooks ────────────────────────────────────────────

export function useTrending() {
  return useQuery<TitleItem[]>({
    queryKey: ['titles', 'trending'],
    queryFn: () => api.get<TitleItem[]>('/titles/trending'),
  });
}

export interface RecentlyUpdatedTitle {
  id: string;
  slug: string;
  title: string;
  type: string;
  genres: string[];
  coverUrl: string | null;
  rating: number | null;
  totalChapters: number | null;
  _count: { chapters: number };
  latestChapter: { number: number; createdAt: string } | null;
}

export function useRecentlyUpdated() {
  return useQuery<RecentlyUpdatedTitle[]>({
    queryKey: ['titles', 'recently-updated'],
    queryFn: () => api.get<RecentlyUpdatedTitle[]>('/titles/recently-updated'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTitles(params?: {
  page?: number;
  limit?: number;
  type?: string;
  genre?: string;
  sort?: string;
  search?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.type) sp.set('type', params.type);
  if (params?.genre) sp.set('genre', params.genre);
  if (params?.sort) sp.set('sort', params.sort);
  if (params?.search) sp.set('search', params.search);

  return useQuery<PaginatedResult<TitleItem>>({
    queryKey: ['titles', params],
    queryFn: () => api.get<PaginatedResult<TitleItem>>(`/titles?${sp}`),
  });
}

export function useTitle(slug: string, chaptersPage?: number, chaptersLimit?: number) {
  const params = new URLSearchParams();
  if (chaptersPage) params.set('chaptersPage', String(chaptersPage));
  if (chaptersLimit) params.set('chaptersLimit', String(chaptersLimit));
  const qs = params.toString();

  return useQuery<TitleDetail>({
    queryKey: ['title', slug, chaptersPage, chaptersLimit],
    queryFn: () => api.get<TitleDetail>(`/titles/${slug}${qs ? `?${qs}` : ''}`),
    enabled: !!slug,
  });
}

export function useChapter(id: string) {
  return useQuery<ChapterDetail>({
    queryKey: ['chapter', id],
    queryFn: () => api.get<ChapterDetail>(`/chapters/${id}`),
    enabled: !!id,
  });
}

export function useChapters(titleSlug?: string) {
  return useQuery<{ items: ChapterItem[]; total: number }>({
    queryKey: ['chapters', titleSlug],
    queryFn: () => api.get(`/chapters?titleSlug=${titleSlug}`),
    enabled: !!titleSlug,
  });
}

// ─── Notification Hooks ───────────────────────

const globalAny = globalThis as any;

function getNotifToken(): string | null {
  return globalAny.__AUTH_TOKEN__ || null;
}

export function useUnreadCount() {
  const token = getNotifToken();

  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    enabled: !!token,
    refetchInterval: 30_000,
  });
}

export function useNotifications(page = 1, limit = 20) {
  const token = getNotifToken();

  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', page, limit],
    queryFn: () => api.get<NotificationsResponse>(`/notifications?page=${page}&limit=${limit}`),
    enabled: !!token,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ─── Coin Hooks ───────────────────────────────

export function useCoinBalance() {
  const token = getNotifToken();

  return useQuery<CoinBalanceData>({
    queryKey: ['coins', 'balance'],
    queryFn: () => api.get<CoinBalanceData>('/coins'),
    enabled: !!token,
  });
}

export function useCoinTransactions(page = 1, limit = 20) {
  const token = getNotifToken();

  return useQuery<{
    items: CoinTransactionItem[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }>({
    queryKey: ['coins', 'transactions', page, limit],
    queryFn: () => api.get(`/coins/transactions?page=${page}&limit=${limit}`),
    enabled: !!token,
  });
}

export function useUnlockChapter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chapterId: string) => api.post<{ unlocked: boolean; balance: number; chapterId: string }>(
      `/chapters/${chapterId}/unlock`,
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coins'] });
      queryClient.invalidateQueries({ queryKey: ['chapter'] });
    },
  });
}

// ─── Achievement Hooks ─────────────────────────

export interface AchievementItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: string;
  metric: string;
  threshold: number;
  current: number;
  target: number;
  progress: number;
  earned: boolean;
  earnedAt: string | null;
}

export interface AchievementsData {
  items: AchievementItem[];
  total: number;
  earned: number;
  categories: { key: string; label: string }[];
}

export function useAchievements() {
  const token = getNotifToken();

  return useQuery<AchievementsData>({
    queryKey: ['achievements'],
    queryFn: () => api.get<AchievementsData>('/achievements'),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

// ─── Community Hooks ─────────────────────────

export interface CommunityPost {
  id: string;
  title: string;
  body: string;
  tag: string;
  tagColor: string;
  views: number;
  createdAt: string;
  updatedAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
  series: { slug: string; title: string; coverUrl: string | null } | null;
  upvotes: number;
  comments: number;
  voted: boolean;
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
  myVote: { option: string; coinsStaked: number } | null;
}

export function useCommunityPosts() {
  return useQuery<{ items: CommunityPost[]; total: number; page: number; limit: number; hasMore: boolean }>({
    queryKey: ['community', 'posts'],
    queryFn: () => api.get(`/community/posts`),
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; body: string; tag: string }) =>
      api.post('/community/posts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', 'posts'] });
    },
  });
}

export interface PostComment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
}

export interface PostDetail extends Omit<CommunityPost, 'comments'> {
  comments: PostComment[];
}

export function useCommunityPost(id: string) {
  return useQuery<PostDetail>({
    queryKey: ['community', 'post', id],
    queryFn: () => api.get<PostDetail>(`/community/posts/${id}`),
    enabled: !!id,
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
    mutationFn: (data: { postId: string; body: string }) =>
      api.post(`/community/posts/${data.postId}/comments`, { body: data.body }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['community', 'post', vars.postId] });
      queryClient.invalidateQueries({ queryKey: ['community', 'posts'] });
    },
  });
}

export function useReadingClubs() {
  return useQuery<{ items: ReadingClub[] }>({
    queryKey: ['community', 'clubs'],
    queryFn: () => api.get(`/community/clubs`),
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

export function usePredictions() {
  return useQuery<{ items: PredictionItem[] }>({
    queryKey: ['community', 'predictions'],
    queryFn: () => api.get(`/community/predictions`),
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

// ─── Reviews Hooks ────────────────────────────

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

export function useCreateReview(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { rating: number; body: string }) =>
      api.post(`/reviews/title/${slug}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', slug] });
      queryClient.invalidateQueries({ queryKey: ['title', slug] });
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
    },
  });
}

export function useSearch(query: string) {
  return useQuery<PaginatedResult<TitleItem>>({
    queryKey: ['search', query],
    queryFn: () => api.get<PaginatedResult<TitleItem>>(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.length > 1,
  });
}
