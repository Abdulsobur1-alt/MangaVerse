'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Where to redirect if not authenticated. Defaults to /login */
  redirectTo?: string;
}

/**
 * Wraps pages that require authentication.
 * Shows a loading skeleton while auth state is initializing,
 * then redirects to login if the user is not authenticated.
 */
export function ProtectedRoute({ children, redirectTo = '/login' }: ProtectedRouteProps) {
  const router = useRouter();
  const { isInitialized, token } = useAuthStore();

  useEffect(() => {
    if (isInitialized && !token) {
      router.push(redirectTo);
    }
  }, [isInitialized, token, router, redirectTo]);

  // Show nothing while initializing
  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mv-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
          <p className="text-xs text-mv-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show nothing (redirect will happen)
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mv-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
          <p className="text-xs text-mv-text-muted">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
