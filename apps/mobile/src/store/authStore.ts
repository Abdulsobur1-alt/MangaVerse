import { create } from 'zustand';
import { api } from '../lib/api';
import { supabaseSignIn, supabaseSignUp, supabaseAuthConfigured } from '../lib/supabaseClient';

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

// The API client reads the token from a global (no async-storage yet), so
// login must mirror the token there as well as in the store.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAny = globalThis as any;

interface LoginResponse {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  coinBalance: number;
  role?: string;
  subscriptionTier: string;
  streakDays?: number;
  token: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  setAuth: (user: AuthUser, token: string) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  logout: () => void;
}

function persistAuth(data: LoginResponse) {
  globalAny.__AUTH_TOKEN__ = data.token;
  useAuthStore.setState({
    token: data.token,
    user: {
      id: data.id,
      email: data.email,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      coinBalance: data.coinBalance,
      role: data.role,
      subscriptionTier: data.subscriptionTier,
      streakDays: data.streakDays,
      createdAt: new Date().toISOString(),
    },
    isLoading: false,
  });
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isInitialized: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      // Production: sign in with Supabase, send the access token to our API.
      // Dev fallback (Supabase not configured): email acts as the identifier.
      const authToken = supabaseAuthConfigured()
        ? await supabaseSignIn(email, password)
        : email;

      const data = await api.post<LoginResponse>('/auth/login', { authToken });
      persistAuth(data);
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (email: string, password: string, displayName: string) => {
    set({ isLoading: true });
    try {
      if (supabaseAuthConfigured()) {
        let authToken = await supabaseSignUp(email, password, displayName);
        if (!authToken) {
          authToken = await supabaseSignIn(email, password);
        }
        const data = await api.post<LoginResponse>('/auth/login', { authToken });
        persistAuth(data);
        return;
      }

      // Dev fallback: legacy register + auto-login
      await api.post('/auth/register', { email, password, displayName });
      const data = await api.post<LoginResponse>('/auth/login', { authToken: email });
      persistAuth(data);
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  setAuth: (user, token) => {
    globalAny.__AUTH_TOKEN__ = token;
    set({ user, token, isLoading: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  logout: () => {
    globalAny.__AUTH_TOKEN__ = null;
    set({ user: null, token: null, isLoading: false });
  },
}));
