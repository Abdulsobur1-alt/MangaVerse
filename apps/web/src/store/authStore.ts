'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import { supabaseSignIn, supabaseSignUp, supabaseAuthConfigured } from '@/lib/supabaseClient';

// ─── Types ────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  coinBalance: number;
  role?: string;
  subscriptionTier: string;
  streakDays?: number;
  libraryCount?: number;
  createdAt: string;
}

interface AuthState {
  // State
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithToken: (authToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

// ─── Store ────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    const storedToken = localStorage.getItem('auth_token');
    if (!storedToken) {
      set({ isInitialized: true });
      return;
    }

    set({ token: storedToken, isLoading: true });

    try {
      const user = await api.get<AuthUser>('/auth/me');
      set({ user, isInitialized: true, isLoading: false });
    } catch {
      // Token invalid — clear it
      localStorage.removeItem('auth_token');
      set({ token: null, user: null, isInitialized: true, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });

    try {
      // Production: sign in with Supabase, send the access token to our API.
      // Dev fallback (Supabase not configured): email acts as the identifier.
      const authToken = supabaseAuthConfigured()
        ? await supabaseSignIn(email, password)
        : email;

      const data = await api.post<{
        id: string;
        email: string;
        displayName: string;
        token: string;
      }>('/auth/login', { authToken });

      localStorage.setItem('auth_token', data.token);
      set({
        token: data.token,
        user: {
          id: data.id,
          email: data.email,
          displayName: data.displayName,
          avatarUrl: null,
          coinBalance: 0,
          subscriptionTier: 'free',
          createdAt: new Date().toISOString(),
        },
        isLoading: false,
      });

      // Fetch full user data in background
      get().refreshUser();
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (email: string, password: string, displayName: string) => {
    try {
      set({ isLoading: true });

      if (supabaseAuthConfigured()) {
        // Production: create the Supabase account, then log in with its token.
        // With email confirmation enabled, signup returns no session — a
        // follow-up sign-in is then the confirmation gate.
        let authToken = await supabaseSignUp(email, password, displayName);
        if (!authToken) {
          authToken = await supabaseSignIn(email, password);
        }
        await get().loginWithToken(authToken);
        return;
      }

      // Dev fallback: legacy register + auto-login
      await api.post<AuthUser>('/auth/register', {
        email,
        password,
        displayName,
      });
      await get().login(email, password);
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  loginWithToken: async (authToken: string) => {
    set({ isLoading: true });

    try {
      const data = await api.post<{
        id: string;
        email: string;
        displayName: string;
        token: string;
        avatarUrl: string | null;
        coinBalance: number;
        subscriptionTier: string;
      }>('/auth/login', { authToken });

      localStorage.setItem('auth_token', data.token);
      set({
        token: data.token,
        user: {
          id: data.id,
          email: data.email,
          displayName: data.displayName,
          avatarUrl: data.avatarUrl,
          coinBalance: data.coinBalance,
          subscriptionTier: data.subscriptionTier,
          createdAt: new Date().toISOString(),
        },
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, isLoading: false });
  },

  refreshUser: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const user = await api.get<AuthUser>('/auth/me');
      set({ user });
    } catch {
      // Silently fail — user data will be stale but app still works
    }
  },

  setUser: (user) => set({ user }),
}));
