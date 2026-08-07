'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   ShareDialog — premium share experience.
   • Copy link (with success feedback) · native Web Share (mobile)
   • QR code preview (qrserver image API, graceful fallback)
   • Deep-link / keyboard hint row · closes on Esc / outside click
   ═══════════════════════════════════════════════════════════════ */

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  slug: string;
  coverUrl?: string | null;
}

export function ShareDialog({ open, onClose, title, slug, coverUrl }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const url = typeof window !== 'undefined' ? `${window.location.origin}/title/${slug}` : '';
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&bgcolor=111113&color=a78bfa&data=${encodeURIComponent(url)}`;

  // Esc + outside click + scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!dialogRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setQrFailed(false);
  }, [open]);

  // Basic Tab focus trap inside the dialog
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href], input');
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback for insecure contexts
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const nativeShare = async () => {
    if ('share' in navigator) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user dismissed — ignore
      }
    } else {
      copy();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label={`Share ${title}`}>
      <div ref={dialogRef} className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-mv-border bg-mv-darker shadow-modal animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-mv-border px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-white">Share this title</h2>
            <p className="mt-0.5 text-[10px] text-mv-text-muted">Spread the story, one link at a time</p>
          </div>
          <button onClick={onClose} aria-label="Close share dialog" className="flex h-8 w-8 items-center justify-center rounded-lg text-mv-text-muted transition-colors hover:bg-white/5 hover:text-white">
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Rich preview */}
        <div className="flex items-center gap-3 border-b border-mv-border bg-mv-surface/30 px-5 py-4">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-16 w-12 shrink-0 rounded-md object-cover ring-1 ring-white/10" />
          ) : (
            <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-mv-surface text-lg">📖</div>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{title}</p>
            <p className="mt-0.5 truncate text-[10px] text-mv-text-muted">mangaverse.app/title/{slug}</p>
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-mv-violet/30 bg-mv-violet/10 px-2 py-0.5 text-[9px] font-medium text-mv-violet">
              <Icon name="zap" size={10} /> Read on MangaVerse
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 px-5 py-5">
          <button
            onClick={copy}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-[10px] font-medium transition-all',
              copied ? 'border-mv-success/40 bg-mv-success/10 text-mv-success' : 'border-mv-border-light bg-mv-surface/60 text-mv-text-secondary hover:border-mv-violet/40 hover:text-white',
            )}
          >
            <Icon name={copied ? 'check' : 'link'} size={18} strokeWidth={1.8} />
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button
            onClick={nativeShare}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-mv-border-light bg-mv-surface/60 px-3 py-3.5 text-[10px] font-medium text-mv-text-secondary transition-all hover:border-mv-violet/40 hover:text-white"
          >
            <Icon name="send" size={18} strokeWidth={1.8} />
            {'share' in navigator ? 'Share via…' : 'Copy for chat'}
          </button>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center gap-2 border-t border-mv-border px-5 py-5">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-mv-border-light bg-mv-surface">
            {qrFailed ? (
              <span className="flex flex-col items-center gap-1 text-mv-text-dim" role="img" aria-label="QR code unavailable">
                <Icon name="close" size={16} />
                <span className="text-[8px]">Offline</span>
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrSrc} alt="QR code linking to this title" width={104} height={104} className="h-24 w-24 object-contain" loading="lazy" onError={() => setQrFailed(true)} />
            )}
          </div>
          <p className="text-center text-[9px] text-mv-text-dim">Scan to open on your phone</p>
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-center gap-4 border-t border-mv-border px-5 py-3 text-[9px] text-mv-text-dim">
          <span className="flex items-center gap-1"><Icon name="lock" size={10} /> Works everywhere</span>
          <span className="flex items-center gap-1"><Icon name="check" size={10} /> No account needed</span>
        </div>
      </div>
    </div>
  );
}
