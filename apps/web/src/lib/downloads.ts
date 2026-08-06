'use client';

import { useSyncExternalStore } from 'react';

/* ═══════════════════════════════════════════════════════════════
   Downloads — the offline reading engine (Phase 7 completion).
   • IndexedDB store of downloaded chapters (one record per chapter)
   • Fetch-queue manager with per-page progress + byte accounting
   • Writes page images into the Cache Storage API ("mangaverse-offline")
     which the service worker (public/sw.js) serves when offline
   • Preferences: auto-download new chapters, Wi-Fi only
   • React integration via useSyncExternalStore (stable snapshots)
   ═══════════════════════════════════════════════════════════════ */

const DB_NAME = 'mangaverse-downloads';
const DB_VERSION = 1;
const STORE = 'chapters';
export const OFFLINE_CACHE = 'mangaverse-offline-v1';
const PREFS_KEY = 'mangaverse_download_prefs';

export type DownloadStatus = 'queued' | 'downloading' | 'complete' | 'error';

export interface DownloadRecord {
  chapterId: string;
  titleId: string;
  seriesSlug: string;
  seriesTitle: string;
  coverUrl: string | null;
  chapterNumber: number;
  chapterTitle: string | null;
  totalPages: number;
  donePages: number;
  bytes: number;
  /** Exact page URLs (already proxied) so we can evict them from the cache. */
  pages: string[];
  status: DownloadStatus;
  error?: string;
  addedAt: number;
  updatedAt: number;
}

export interface DownloadPrefs {
  /** Automatically download new chapters of titles on your Reading shelf. */
  autoDownload: boolean;
  /** Only download while on a Wi-Fi connection. */
  wifiOnly: boolean;
  /** Epoch ms of the last background sync pass. */
  lastSynced: number;
}

export interface EnqueueInput {
  chapterId: string;
  titleId: string;
  seriesSlug: string;
  seriesTitle: string;
  coverUrl: string | null;
  chapterNumber: number;
  chapterTitle: string | null;
}

const DEFAULT_PREFS: DownloadPrefs = { autoDownload: false, wifiOnly: true, lastSynced: 0 };

// ─── Store plumbing ───────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'chapterId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open downloads DB'));
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Downloads DB error'));
      }),
  );
}

async function getAll(): Promise<DownloadRecord[]> {
  try {
    return await tx<DownloadRecord[]>('readonly', (s) => s.getAll());
  } catch {
    return [];
  }
}

async function putRecord(record: DownloadRecord): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(record));
  } catch {
    // storage failure
  }
}

async function deleteRecord(chapterId: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(chapterId));
  } catch {
    // ignore
  }
}

// ─── Snapshot + pub/sub (for useSyncExternalStore) ───

let snapshot: DownloadRecord[] = [];
const listeners = new Set<() => void>();

function refreshSnapshot(): void {
  void getAll().then((rows) => {
    rows.sort((a, b) => b.addedAt - a.addedAt);
    snapshot = rows;
    listeners.forEach((l) => l());
  });
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSnapshot(): DownloadRecord[] {
  return snapshot;
}

/** React hook — live list of download records. */
export function useDownloads(): DownloadRecord[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => []);
}

/** React hook — live download prefs. */
export function useDownloadPrefs(): DownloadPrefs {
  return useSyncExternalStore(
    (cb) => {
      const onStorage = (e: StorageEvent) => e.key === PREFS_KEY && cb();
      const onSameTab = () => cb();
      window.addEventListener('storage', onStorage);
      window.addEventListener(PREFS_KEY as any, onSameTab as any);
      return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(PREFS_KEY as any, onSameTab as any);
      };
    },
    () => loadDownloadPrefs(),
    () => DEFAULT_PREFS,
  );
}

// ─── Preferences ──────────────────────────────────────

export function loadDownloadPrefs(): DownloadPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveDownloadPrefs(prefs: DownloadPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // quota — ignore
  }
  // Same-tab subscribers (the storage event only fires in other tabs).
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PREFS_KEY));
}

// ─── Cache helpers ────────────────────────────────────

async function getCache(): Promise<Cache> {
  return caches.open(OFFLINE_CACHE);
}

async function evictFromCache(urls: string[]): Promise<void> {
  try {
    const cache = await getCache();
    await Promise.all(urls.map((u) => cache.delete(new Request(u))));
  } catch {
    // ignore
  }
}

// ─── Connection gating ────────────────────────────────

export function isOnWifi(): boolean {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) return true;
  const conn = (navigator as unknown as { connection?: { type?: string; effectiveType?: string; saveData?: boolean } }).connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  const eff = (conn.effectiveType ?? '').toLowerCase();
  return conn.type === 'wifi' || eff === '4g' || eff === '3g';
}

// ─── Queue engine ─────────────────────────────────────

interface QueueEntry {
  input: EnqueueInput;
  cancelled: boolean;
}

let queue: QueueEntry[] = [];
let running = false;
/** Chapter ids cancelled/removed mid-flight — checked inside the fetch loop. */
const cancelled = new Set<string>();

export function enqueueDownload(input: EnqueueInput): void {
  if (queue.some((q) => q.input.chapterId === input.chapterId)) return;
  queue.push({ input, cancelled: false });
  const record: DownloadRecord = {
    ...input,
    totalPages: 0,
    donePages: 0,
    bytes: 0,
    pages: [],
    status: 'queued',
    addedAt: Date.now(),
    updatedAt: Date.now(),
  };
  void putRecord(record).then(refreshSnapshot);
  void pump();
}

export function cancelDownload(chapterId: string): void {
  const entry = queue.find((q) => q.input.chapterId === chapterId);
  if (entry) entry.cancelled = true;
  cancelled.add(chapterId);
}

export async function removeDownload(chapterId: string): Promise<void> {
  cancelDownload(chapterId);
  const rec = await getDownload(chapterId);
  if (rec && rec.pages.length > 0) await evictFromCache(rec.pages);
  await deleteRecord(chapterId);
  refreshSnapshot();
}

export async function removeSeriesDownloads(seriesSlug: string): Promise<void> {
  const rows = await getAll();
  await Promise.all(rows.filter((r) => r.seriesSlug === seriesSlug).map((r) => removeDownload(r.chapterId)));
}

export async function clearAllDownloads(): Promise<void> {
  queue = [];
  try {
    await tx('readwrite', (s) => s.clear());
    await caches.delete(OFFLINE_CACHE);
  } catch {
    // ignore
  }
  refreshSnapshot();
}

export function getDownload(chapterId: string): Promise<DownloadRecord | undefined> {
  return tx<DownloadRecord | undefined>('readonly', (s) => s.get(chapterId)).catch(() => undefined);
}

export async function isDownloaded(chapterId: string): Promise<boolean> {
  const rec = await getDownload(chapterId);
  return !!rec;
}

/** Browser storage estimate (bytes used / quota) when available. */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number | null }> {
  if (typeof navigator !== 'undefined' && 'storage' in navigator && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      return { usage: est.usage ?? 0, quota: est.quota ?? null };
    } catch {
      // fall through
    }
  }
  const rows = await getAll();
  return { usage: rows.reduce((sum, r) => sum + r.bytes, 0), quota: null };
}

async function pump(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length > 0) {
      const entry = queue.shift()!;
      if (entry.cancelled) continue;
      await downloadChapter(entry.input);
    }
  } finally {
    running = false;
  }
}

async function downloadChapter(input: EnqueueInput): Promise<void> {
  const chapterId = input.chapterId;
  const update = async (patch: Partial<DownloadRecord>) => {
    const rec = await getDownload(chapterId);
    if (!rec) return;
    const next = { ...rec, ...patch, updatedAt: Date.now() };
    await putRecord(next);
    refreshSnapshot();
  };

  const finish = (status: DownloadStatus, error?: string) =>
    void update({ status, error }).then(() => {
      if (status === 'complete') {
        saveDownloadPrefs({ ...loadDownloadPrefs(), lastSynced: Date.now() });
      }
    });

  try {
    // Wi-Fi only gate
    const prefs = loadDownloadPrefs();
    if (prefs.wifiOnly && !isOnWifi()) {
      await finish('error', 'Wi-Fi only is on — connect to Wi-Fi to download');
      return;
    }

    await update({ status: 'downloading', error: undefined });

    // 1. Resolve the page list (same-origin rewrite → API)
    let pages: { index: number; url: string }[] = [];
    try {
      const res = await fetch(`/api/chapters/${chapterId}/pages`);
      const json = await res.json();
      if (!json.success) {
        await finish('error', json.error?.message ?? 'Could not fetch chapter pages');
        return;
      }
      pages = json.data.pages ?? [];
      await update({ totalPages: pages.length, pages: pages.map((p: { url: string }) => p.url) });
    } catch {
      await finish('error', 'Network error while resolving chapter');
      return;
    }

    // 2. Fetch each page into the offline cache (pool of 3), honouring cancels
    const cache = await getCache();
    let done = 0;
    let bytes = 0;
    let errors = 0;
    const CONCURRENCY = 3;

    const fetchPage = async (p: { url: string }): Promise<void> => {
      try {
        const res = await fetch(p.url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const len = Number(res.headers.get('content-length') || 0);
        if (!len) {
          const blob = await res.clone().blob();
          bytes += blob.size;
        } else {
          bytes += len;
        }
        await cache.put(new Request(p.url), res);
        done += 1;
      } catch {
        errors += 1;
      }
    };

    for (let i = 0; i < pages.length; i += CONCURRENCY) {
      if (cancelled.has(chapterId)) break;
      const batch = pages.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(fetchPage));
      await update({ donePages: done, bytes });
    }

    const rec = await getDownload(chapterId);
    if (cancelled.has(chapterId)) {
      await finish('error', 'Cancelled');
      return;
    }
    if (!rec || rec.status !== 'downloading') return;

    if (errors > 0 && done === 0) {
      await finish('error', 'Could not download any pages');
    } else {
      await finish('complete');
    }
  } catch {
    // Never let one bad chapter strand the queue or leave a zombie record.
    await finish('error', 'Download failed');
  } finally {
    cancelled.delete(chapterId);
  }
}
