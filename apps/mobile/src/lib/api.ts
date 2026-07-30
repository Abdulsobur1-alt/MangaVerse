import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 for host, iOS simulator uses localhost
// Override with EXPO_PUBLIC_API_URL env var for custom API hosts
const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const DEFAULT_BASE = `http://${DEFAULT_HOST}:3001`;
const API_BASE = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_BASE) + '/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Token retrieval for authenticated requests
// Uses global variable set by auth store — async-storage will be added in a future phase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAny = globalThis as any;
function getToken(): string | null {
  return globalAny.__AUTH_TOKEN__ || null;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getToken();

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new ApiError(
      json.error?.code || 'UNKNOWN',
      json.error?.message || 'An error occurred',
      res.status,
    );
  }

  return json.data;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export interface TitleItem {
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

export interface ChapterProgress {
  pageNumber: number;
  completed: boolean;
}

export interface TitleDetail extends TitleItem {
  alternativeTitles?: string | null;
  tags: string[];
  artist: string | null;
  synopsis: string | null;
  releaseYear: number | null;
  _count: { chapters: number; bookmarks: number; reviews: number };
  chapters: {
    id: string;
    number: number;
    title: string | null;
    pageCount: number | null;
    createdAt: string;
    progress: ChapterProgress | null;
  }[];
  chaptersPagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ─── Review Types ────────────────────────────────

export interface ReviewUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ReviewItem {
  id: string;
  rating: number;
  body: string | null;
  subScores: Record<string, number> | null;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  user: ReviewUser;
}

// ─── Notification Types ─────────────────────────

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  imageUrl: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
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

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ChapterItem {
  id: string;
  number: number;
  title: string | null;
  pageCount: number | null;
  coinLocked: boolean;
  createdAt: string;
}

export interface ChapterDetail extends ChapterItem {
  series: {
    id: string;
    slug: string;
    title: string;
    coverUrl: string | null;
  };
}
