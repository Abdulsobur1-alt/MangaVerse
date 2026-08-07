'use client';

import { useEffect, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   useMediaQuery — SSR-safe matchMedia hook. Returns whether the
   given media query currently matches; re-evaluates on change.
   ═══════════════════════════════════════════════════════════════ */

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange(); // sync on mount (window is available here)
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
