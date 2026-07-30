'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export interface UpdateProfileData {
  displayName?: string;
  avatarUrl?: string | null;
}

export interface ProfileResponse {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  coinBalance: number;
  subscriptionTier: string;
  streakDays: number;
  createdAt: string;
}

// ─── Hooks ────────────────────────────────────────────

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileData) =>
      api.put<ProfileResponse>('/users/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.delete('/users/account'),
    onSuccess: () => {
      localStorage.removeItem('auth_token');
      queryClient.clear();
      window.location.href = '/';
    },
  });
}
