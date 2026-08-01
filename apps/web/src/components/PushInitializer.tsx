'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';

const SW_PATH = '/sw.js';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the push service worker and keeps the browser subscription
 * in sync with the auth state: subscribes when logged in, unsubscribes
 * when logged out. Silently no-ops when push isn't supported or VAPID
 * keys aren't configured on the API.
 */
export function PushInitializer() {
  const token = useAuthStore((s) => s.token);
  const subscribedRef = useRef(false);
  const lastTokenRef = useRef<string | null>(null);

  // Keep the last-known token available for the logout cleanup (the store
  // clears localStorage before token flips to null). Render-phase write is
  // idempotent, but an effect keeps side effects out of the render pass.
  useEffect(() => {
    if (token) lastTokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const sync = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_PATH);

        if (!token) {
          // Logged out — unsubscribe locally if we had a subscription. The auth
          // store clears localStorage before token flips to null, so we use the
          // last-known token to authenticate the server-side cleanup.
          const sub = await registration.pushManager.getSubscription();
          if (sub) {
            const savedToken = lastTokenRef.current;
            if (savedToken) {
              await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
                {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${savedToken}` },
                },
              ).catch(() => {});
            }
            await sub.unsubscribe().catch(() => {});
          }
          subscribedRef.current = false;
          lastTokenRef.current = null;
          return;
        }

        // Logged in — subscribe if not already
        let sub = await registration.pushManager.getSubscription();
        if (!sub) {
          const vapidRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/push/vapid-public-key`,
          );
          const vapidJson = await vapidRes.json();
          if (!vapidJson.success || !vapidJson.data?.publicKey) return; // push not configured

          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidJson.data.publicKey),
          });
        }

        if (sub && !subscribedRef.current) {
          const raw = sub.toJSON();
          if (raw.endpoint && raw.keys) {
            await api.post('/push/subscribe', {
              endpoint: raw.endpoint,
              p256dh: raw.keys.p256dh,
              auth: raw.keys.auth,
            }).catch(() => {});
            subscribedRef.current = true;
          }
        }
      } catch {
        // Permission denied or push unavailable — no-op
      }
    };

    sync();
  }, [token]);

  return null;
}
