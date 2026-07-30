'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

/**
 * Initializes the auth store on app mount by checking for an existing
 * auth token in localStorage and fetching the user profile if found.
 *
 * Place this in the root layout (above children) so the auth state
 * is restored before any page renders.
 */
export function AuthInitializer() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return null;
}
