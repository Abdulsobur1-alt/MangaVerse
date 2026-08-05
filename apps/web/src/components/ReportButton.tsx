'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCreateReport } from '@/lib/hooks/useCommunity';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/lib/api';

const REASONS = [
  { id: 'spam', label: 'Spam', emoji: '📣' },
  { id: 'harassment', label: 'Harassment', emoji: '🚫' },
  { id: 'spoiler', label: 'Spoiler', emoji: '🙈' },
  { id: 'misinformation', label: 'Misinformation', emoji: '🤥' },
  { id: 'other', label: 'Other', emoji: '📝' },
] as const;

type ReasonId = (typeof REASONS)[number]['id'];

interface ReportButtonProps {
  contentType: 'post' | 'comment' | 'wiki';
  targetId: string;
  label?: string;
}

export default function ReportButton({ contentType, targetId, label = 'Report' }: ReportButtonProps) {
  const { token } = useAuthStore();
  const createReport = useCreateReport();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReasonId | null>(null);
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!token || !reason) return;
    setError(null);
    try {
      await createReport.mutateAsync({
        contentType,
        targetId,
        reason,
        details: details.trim() || undefined,
      });
      setDone(true);
      setOpen(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not submit report. Please try again.');
      }
    }
  };

  // Signed-out users get pointed at the login page
  if (!token) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1 text-[9px] text-mv-text-dim transition-colors hover:text-mv-gold"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {label}
      </Link>
    );
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-medium text-green-400">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Reported — thanks!
      </span>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => { setOpen(!open); setError(null); setReason(null); setDetails(''); }}
        className="inline-flex items-center gap-1 text-[9px] text-mv-text-dim transition-colors hover:text-mv-gold"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
        {label}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-mv-border-light bg-mv-darker p-3 shadow-xl shadow-black/40 animate-fade-in">
          <p className="mb-2 text-[10px] font-medium text-mv-text">Report this {contentType}</p>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setReason(r.id)}
                className={`rounded-full px-2 py-1 text-[9px] transition-colors ${
                  reason === r.id
                    ? 'bg-mv-accent text-white'
                    : 'bg-mv-surface text-mv-text-secondary hover:text-mv-text'
                }`}
              >
                {r.emoji} {r.label}
              </button>
            ))}
          </div>
          {reason && (
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Optional details (max 2000 chars)"
              rows={2}
              className="mt-2 w-full rounded-lg border border-mv-border-light bg-mv-surface px-2.5 py-1.5 text-[10px] text-mv-text placeholder:text-mv-text-dim outline-none focus:border-mv-accent resize-none"
            />
          )}
          {error && <p className="mt-2 text-[9px] text-red-400">{error}</p>}
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-[9px] text-mv-text-dim hover:text-mv-text"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!reason || createReport.isPending}
              className="rounded-md bg-mv-accent px-2.5 py-1 text-[9px] font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
            >
              {createReport.isPending ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
