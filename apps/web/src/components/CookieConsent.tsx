'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

/* ═══════════════════════════════════════════════════════════════
   CookieConsent — the one-time cookie banner.
   • Essential cookies are always active (auth, preferences); the
     banner only gates optional analytics consent.
   • Choice persists in localStorage under mv-cookie-consent.
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'mv-cookie-consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true); // storage unavailable — show it anyway
    }
  }, []);

  const choose = (analytics: boolean) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          essential: true,
          analytics,
          savedAt: new Date().toISOString(),
        }),
      );
    } catch {
      /* storage unavailable — nothing to persist */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-[4.5rem] left-3 right-3 z-[90] mx-auto max-w-sm rounded-2xl border border-mv-border bg-mv-darker/95 p-4 shadow-glow-sm backdrop-blur-md md:bottom-6 md:left-6 md:mx-0 md:right-auto"
    >
      <p className="text-[11px] font-semibold text-white">We use cookies 🍪</p>
      <p className="mt-1 text-[10px] leading-relaxed text-mv-text-secondary">
        Essential cookies keep you signed in and remember your preferences. Optional analytics help
        us improve the site. See our{' '}
        <Link href="/privacy" className="text-mv-accent hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => choose(true)}>
          Accept all
        </Button>
        <Button size="sm" variant="outline" onClick={() => choose(false)}>
          Essential only
        </Button>
      </div>
    </div>
  );
}
