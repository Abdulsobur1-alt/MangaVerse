import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { prisma } from './prisma.js';
import { verifyFirebaseToken, firebaseConfigured } from './firebase.js';
import { config } from '../config/index.js';

/* ═══════════════════════════════════════════════════════════════
   Realtime — the live WebSocket hub (Phase 10).
   • One WSS mounted on the API's HTTP server at /api/ws.
   • Auth via ?token= (same JWT the REST layer accepts, incl. the
     dev_* token flow). Connections are mapped to db user ids.
   • broadcastToUser / broadcastToRole / broadcastToAll push events
     (e.g. { type: 'notification', data: {...} }) to live clients.
   • The web client (apps/web/src/lib/realtime.ts) connects here and
     falls back to polling when WebSockets are unavailable.
   • The hub degrades gracefully: if no server is attached, sends
     are no-ops — the REST + polling path still works.
   ═══════════════════════════════════════════════════════════════ */

export interface RealtimeEvent<T = unknown> {
  type: string;
  data: T;
  at: number;
}

let wss: WebSocketServer | null = null;
const clientsByUser = new Map<string, Set<WebSocket>>();
const userBySocket = new WeakMap<WebSocket, string>();
const HEARTBEAT_MS = 30_000;

function send(ws: WebSocket, event: RealtimeEvent): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(event));
  } catch {
    // Socket died mid-write — the heartbeat will clean it up
  }
}

/** Attach the realtime hub to the API's HTTP server (call once at boot). */
export function startRealtimeServer(server: Server): void {
  if (wss) return; // idempotent

  wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });

  server.on('upgrade', (req, socket, head) => {
    // Only handle our own path; anything else is destroyed (with no other
    // upgrade listener registered, an ignored upgrade would leave the
    // socket half-open until the client gives up).
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== '/api/ws') {
      socket.destroy();
      return;
    }

    wss!.handleUpgrade(req, socket, head, (ws) => {
      const token = url.searchParams.get('token') || '';
      void authenticate(token).then((userId) => {
        if (!userId) {
          ws.close(4001, 'Unauthorized');
          return;
        }
        attach(ws, userId);
      });
    });
  });

  // Heartbeat runs from boot so idle/dead connections are pruned even
  // when no events flow (not lazily on first broadcast).
  ensureHeartbeat();

  wss.on('error', (err) => {
    console.warn('⚠️  Realtime hub error:', (err as Error).message);
  });

  console.log('⚡ Realtime hub mounted at /api/ws');
}

/** Resolve a token to a db user id (mirrors requireAuth's two flows). */
async function authenticate(token: string): Promise<string | null> {
  if (!token) return null;
  try {
    let uid: string;
    if (config.devAuth && !firebaseConfigured() && token.startsWith('dev_')) {
      uid = token.replace('dev_', '');
    } else {
      const decoded = await verifyFirebaseToken(token);
      if (!decoded) return null;
      uid = decoded.uid;
    }
    const user = await prisma.user.findUnique({
      where: { firebaseUid: uid },
      select: { id: true },
    });
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function attach(ws: WebSocket, userId: string): void {
  userBySocket.set(ws, userId);
  let set = clientsByUser.get(userId);
  if (!set) {
    set = new Set();
    clientsByUser.set(userId, set);
  }
  set.add(ws);

  // Heartbeat: keep the socket alive and prune dead ones
  ws.on('pong', () => {
    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
  });
  (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
  ws.on('close', () => detach(ws));

  ws.send(
    JSON.stringify({
      type: 'connected',
      data: { userId },
      at: Date.now(),
    } satisfies RealtimeEvent),
  );
}

function detach(ws: WebSocket): void {
  const userId = userBySocket.get(ws);
  userBySocket.delete(ws);
  if (!userId) return;
  const set = clientsByUser.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) clientsByUser.delete(userId);
}

// Heartbeat interval (cleared on close to avoid leaking the timer)
let heartbeatTimer: NodeJS.Timeout | null = null;

function ensureHeartbeat(): void {
  if (heartbeatTimer || !wss) return;
  heartbeatTimer = setInterval(() => {
    for (const ws of wss!.clients) {
      const live = (ws as WebSocket & { isAlive?: boolean }).isAlive;
      if (live === false) {
        ws.terminate();
        continue;
      }
      (ws as WebSocket & { isAlive?: boolean }).isAlive = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    }
  }, HEARTBEAT_MS);
  heartbeatTimer.unref?.();
}

/** Push an event to a specific user's live connections. */
export function broadcastToUser(userId: string, event: RealtimeEvent): void {
  const set = clientsByUser.get(userId);
  if (!set || set.size === 0) return;
  ensureHeartbeat();
  for (const ws of set) send(ws, event);
}

/** Push an event to all currently-connected users. */
export function broadcastToAll(event: RealtimeEvent): void {
  if (!wss || wss.clients.size === 0) return;
  ensureHeartbeat();
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) send(ws, event);
  }
}

/** Push an event to every user with a live connection. */
export function broadcastToMany(userIds: string[], event: RealtimeEvent): void {
  if (!userIds.length) return;
  ensureHeartbeat();
  for (const id of userIds) broadcastToUser(id, event);
}

export function realtimeConnectedUserCount(): number {
  return clientsByUser.size;
}
