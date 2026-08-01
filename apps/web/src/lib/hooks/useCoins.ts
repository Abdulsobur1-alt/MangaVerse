'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore } from '@/store/authStore';

// ─── Types ────────────────────────────────────────────

export interface CoinTransactionItem {
  id: string;
  amount: number;
  type: string;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

export interface CoinBalanceData {
  balance: number;
  transactions: CoinTransactionItem[];
}

// ─── Hooks ────────────────────────────────────────────

export function useCoinBalance() {
  const token = useAuthStore((s) => s.token);

  return useQuery<CoinBalanceData>({
    queryKey: ['coins', 'balance'],
    queryFn: () => api.get<CoinBalanceData>('/coins'),
    enabled: !!token,
  });
}

export function useCoinTransactions(page = 1, limit = 20) {
  const token = useAuthStore((s) => s.token);

  return useQuery<{
    items: CoinTransactionItem[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }>({
    queryKey: ['coins', 'transactions', page, limit],
    queryFn: () => api.get(`/coins/transactions?page=${page}&limit=${limit}`),
    enabled: !!token,
  });
}

export function useUnlockChapter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chapterId: string) => api.post<{ unlocked: boolean; balance: number; chapterId: string }>(
      `/chapters/${chapterId}/unlock`,
    ),
    onSuccess: () => {
      // Refresh coin balance + chapter data (and title progress)
      queryClient.invalidateQueries({ queryKey: ['coins'] });
      queryClient.invalidateQueries({ queryKey: ['chapter'] });
    },
  });
}

// ─── Formatters ───────────────────────────────────────

export function formatCoinAmount(amount: number): string {
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount} 🪙`;
}

export function coinTxnLabel(type: string): string {
  switch (type) {
    case 'earn':
      return 'Earned';
    case 'spend':
      return 'Spent';
    case 'purchase':
      return 'Purchased';
    case 'reward':
      return 'Reward';
    case 'refund':
      return 'Refund';
    default:
      return type;
  }
}
