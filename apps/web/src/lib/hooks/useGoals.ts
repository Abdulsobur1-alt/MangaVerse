'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ─── Types ────────────────────────────────────────────

export type GoalType =
  | 'chapters_week'
  | 'chapters_day'
  | 'chapters_total'
  | 'series_total'
  | 'series_completed'
  | 'streak_days';

export interface GoalItem {
  id: string;
  title: string;
  type: GoalType;
  target: number;
  active: boolean;
  endsAt: string | null;
  createdAt: string;
  current: number;
  progress: number; // 0-100
  done: boolean;
}

export interface CreateGoalData {
  title: string;
  type: GoalType;
  target: number;
  endsAt?: string | null;
}

// ─── Display metadata (kept in the hook layer so pages stay lean) ──

export const GOAL_TYPE_META: Record<GoalType, { label: string; unit: string; hint: string }> = {
  chapters_week: { label: 'Chapters / week', unit: 'chapters', hint: 'Resets every Monday (UTC)' },
  chapters_day: { label: 'Chapters / day', unit: 'chapters', hint: 'Resets every day' },
  chapters_total: { label: 'Total chapters', unit: 'chapters', hint: 'Lifetime completed chapters' },
  series_total: { label: 'Series started', unit: 'series', hint: 'Distinct series with ≥1 chapter read' },
  series_completed: { label: 'Series completed', unit: 'series', hint: 'Read the final chapter' },
  streak_days: { label: 'Streak', unit: 'days', hint: 'Maintain a current streak' },
};

// ─── Hooks ────────────────────────────────────────────

export function useGoals(enabled = true) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return useQuery<GoalItem[]>({
    queryKey: ['goals'],
    queryFn: () => api.get<GoalItem[]>('/goals'),
    enabled: enabled && !!token,
    staleTime: 60 * 1000,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGoalData) => api.post<GoalItem>('/goals', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CreateGoalData> & { active?: boolean }) =>
      api.patch<GoalItem>(`/goals/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/goals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });
}
