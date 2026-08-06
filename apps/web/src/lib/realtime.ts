'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';

/* ═══════════════════════════════════════════════════════════════
   Realtime (web) — the live channel to the API's WebSocket hub.
   • One shared socket per session, token-authenticated (?token=).
   • Exponential backoff reconnect; the socket survives route changes.
   • useRealtime() connects while signed in and lets listeners react
     to events; by default it invalidates the notifications + unread
     queries so the bell updates the moment a notification lands.
   • Graceful degradation: when WebSockets are unavailable the hooks'
     normal polling (refetchInterval) still keeps things fresh.
   ═══════════════════════════════════════════════════════════════ */

export interface RealtimeEvent<T = Record<string, unknown>> {
  type: string;
  data: T;
  at: number;
}

type Listener = (event: RealtimeEvent) => void;

let socket: WebSocket | null = null;
let socketToken: string | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let attempts = 0;
const listeners = new Set<Listener>();
const MAX_ATTEMPTS = 8;

function getWsUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  return `${base.replace(/^http/, 'ws')}/ws`;
}

function dispatch(event: RealtimeEvent): void {
  listeners.forEach((l) => {
    try {
      l(event);
    } catch {
      // listener errors must never kill the socket
    }
  });
}

function connect(token: string): void {
  if (socket && socketToken === token) return;
  teardown();

  socketToken = token;
  const url = `${getWsUrl()}?token=${encodeURIComponent(token)}`;
  let ws: WebSocket;
  try {
    ws = new WebSocket(url);
  } catch {
    return;
  }
  socket = ws;

  ws.onopen = () => {
    attempts = 0;
  };

  ws.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data as string) as RealtimeEvent;
      if (event.type === 'connected') return;
      dispatch(event);
    } catch {
      // malformed frame — ignore
    }
  };

  ws.onclose = () => {
    if (socket !== ws) return; // a newer socket replaced us
    socket = null;
    if (!socketToken) return;
    scheduleRetry();
  };

  ws.onerror = () => {
    ws.close();
  };
}

function scheduleRetry(): void {
  if (retryTimer) return;
  attempts += 1;
  if (attempts > MAX_ATTEMPTS) {
    socketToken = null;
    return;
  }
  const delay = Math.min(1000 * 2 ** attempts, 30_000);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    const token = socketToken;
    if (token) connect(token);
  }, delay);
}

function teardown(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    socket.close();
    socket = null;
  }
  attempts = 0;
}

/** Module-level subscription (used by useRealtime). */
export function subscribeRealtime(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Connect to the realtime hub while signed in. By default incoming
 * notification events invalidate the notification queries; pass your
 * own handler to react to specific event types (e.g. announcements).
 */
export function useRealtime(onEvent?: (event: RealtimeEvent) => void): void {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) {
      socketToken = null;
      teardown();
      return;
    }

    const sync: Listener = (event) => {
      if (event.type === 'notification:new' || event.type === 'notification:update') {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      }
      onEvent?.(event);
    };

    const unsubscribe = subscribeRealtime(sync);
    connect(token);
    return () => unsubscribe();
  }, [token, queryClient, onEvent]);
}
