'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: Record<string, string[]> };
}

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  // Guard against non-JSON responses (proxy 404s, HTML error pages, timeouts)
  // — res.json() would throw a confusing SyntaxError.
  const raw = await res.text();
  let json: ApiResponse<T>;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ApiError(
      'INVALID_RESPONSE',
      res.ok ? 'Unexpected response from server' : `Request failed (${res.status})`,
      res.status,
    );
  }

  if (!json.success) {
    throw new ApiError(
      json.error?.code || 'UNKNOWN',
      json.error?.message || 'An error occurred',
      res.status,
      json.error?.details,
    );
  }

  return json.data;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export { ApiError };
export type { ApiResponse };
