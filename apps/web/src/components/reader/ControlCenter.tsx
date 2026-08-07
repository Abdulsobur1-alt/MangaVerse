'use client';

import { Icon } from '@/components/ui/Icon';
import { THEMES, type ProseTheme, type ReaderMode, type ReaderPrefs } from './readerPrefs';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   ControlCenter — the floating command deck for the reader.
   Opens from the bottom bar; groups every setting into labeled rows
   with live values. Non-invasive: it overlays the bottom edge and
   closes on outside-click / Esc.
   ═══════════════════════════════════════════════════════════════ */

interface ControlCenterProps {
  open: boolean;
  onClose: () => void;
  prefs: ReaderPrefs;
  setPrefs: (updater: (p: ReaderPrefs) => ReaderPrefs) => void;
  effectiveMode: ReaderMode;
  setMode: (m: ReaderMode | null) => void;
  hasProse: boolean;
  formatKey: string;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  autoScroll: boolean;
  autoScrollSpeed: 1 | 2 | 3;
  setAutoScroll: (v: boolean) => void;
  setAutoScrollSpeed: (v: 1 | 2 | 3) => void;
  /** "?" help */
  onHelp: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-mv-text-muted">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition-all',
        active
          ? 'border-mv-accent/60 bg-mv-accent/20 text-mv-accent'
          : 'border-mv-border-light bg-mv-surface/70 text-mv-text-secondary hover:border-mv-violet/40 hover:text-mv-text',
      )}
    >
      {children}
    </button>
  );
}

export function ControlCenter({
  open, onClose, prefs, setPrefs, effectiveMode, setMode, hasProse, formatKey,
  isFullscreen, toggleFullscreen, autoScroll, autoScrollSpeed, setAutoScroll, setAutoScrollSpeed, onHelp,
}: ControlCenterProps) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 mx-auto w-[min(94vw,26rem)] overflow-hidden rounded-2xl border border-mv-border-light bg-mv-darker/95 shadow-modal backdrop-blur-xl animate-scale-in"
      role="dialog"
      aria-label="Reader controls"
    >
      <div className="flex items-center justify-between border-b border-mv-border px-4 py-2.5">
        <p className="text-[11px] font-semibold text-white">Reader controls</p>
        <button onClick={onClose} aria-label="Close controls" className="flex h-7 w-7 items-center justify-center rounded-lg text-mv-text-muted transition-colors hover:bg-white/5 hover:text-white">
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="max-h-[52vh] overflow-y-auto px-4 py-1">
        {/* Brightness */}
        <Row label="Brightness">
          <div className="flex w-44 items-center gap-2">
            <Icon name="brightness" size={13} className="shrink-0 text-mv-text-muted" />
            <input
              type="range" min={0.6} max={1.2} step={0.05} value={prefs.brightness}
              onChange={(e) => setPrefs((p) => ({ ...p, brightness: Number(e.target.value) }))}
              aria-label="Brightness"
              className="h-1.5 flex-1 accent-violet-500"
            />
            <span className="w-8 text-right text-[9px] text-mv-text-dim">{Math.round(prefs.brightness * 100)}%</span>
          </div>
        </Row>

        {/* Control opacity */}
        <Row label="UI opacity">
          <div className="flex w-44 items-center gap-2">
            <Icon name="eye" size={13} className="shrink-0 text-mv-text-muted" />
            <input
              type="range" min={0.35} max={1} step={0.05} value={prefs.controlOpacity}
              onChange={(e) => setPrefs((p) => ({ ...p, controlOpacity: Number(e.target.value) }))}
              aria-label="Control opacity"
              className="h-1.5 flex-1 accent-violet-500"
            />
            <span className="w-8 text-right text-[9px] text-mv-text-dim">{Math.round(prefs.controlOpacity * 100)}%</span>
          </div>
        </Row>

        <div className="border-t border-mv-border" />

        {/* Reading mode */}
        <Row label="Mode">
          <Chip active={effectiveMode === 'page'} onClick={() => setMode('page')}>Page</Chip>
          <Chip active={effectiveMode === 'strip'} onClick={() => setMode('strip')}>{formatKey === 'MANGA' ? 'Strip' : 'Scroll'}</Chip>
          {hasProse && <Chip active={effectiveMode === 'prose'} onClick={() => setMode('prose')}>Prose</Chip>}
        </Row>

        {/* Direction + zoom (page/strip) */}
        {effectiveMode === 'page' && (
          <Row label="Direction">
            <Chip active={!prefs.rtl} onClick={() => setPrefs((p) => ({ ...p, rtl: false }))}>↪ LTR</Chip>
            <Chip active={prefs.rtl} onClick={() => setPrefs((p) => ({ ...p, rtl: true }))}>↩ RTL</Chip>
          </Row>
        )}
        {effectiveMode === 'strip' && (
          <Row label="Zoom">
            <Chip active={!prefs.zoomed} onClick={() => setPrefs((p) => ({ ...p, zoomed: false }))}>Fit width</Chip>
            <Chip active={prefs.zoomed} onClick={() => setPrefs((p) => ({ ...p, zoomed: true }))}>Actual size</Chip>
          </Row>
        )}

        {/* Prose theme + typography */}
        {effectiveMode === 'prose' && (
          <>
            <Row label="Theme">
              {(Object.keys(THEMES) as ProseTheme[]).map((t) => (
                <Chip key={t} active={prefs.theme === t} onClick={() => setPrefs((p) => ({ ...p, theme: t }))}>
                  {THEMES[t].label}
                </Chip>
              ))}
            </Row>
            <Row label="Font">
              <Chip active={prefs.fontFamily === 'serif'} onClick={() => setPrefs((p) => ({ ...p, fontFamily: 'serif' }))}>Serif</Chip>
              <Chip active={prefs.fontFamily === 'sans'} onClick={() => setPrefs((p) => ({ ...p, fontFamily: 'sans' }))}>Sans</Chip>
            </Row>
            <Row label="Size">
              <Chip onClick={() => setPrefs((p) => ({ ...p, fontSize: Math.max(14, p.fontSize - 2) }))}>A−</Chip>
              <span className="w-8 text-center text-[10px] text-mv-text-secondary">{prefs.fontSize}</span>
              <Chip onClick={() => setPrefs((p) => ({ ...p, fontSize: Math.min(30, p.fontSize + 2) }))}>A+</Chip>
            </Row>
            <Row label="Line height">
              <Chip onClick={() => setPrefs((p) => ({ ...p, lineHeight: Math.max(1.4, +(p.lineHeight - 0.15).toFixed(2)) }))}>−</Chip>
              <span className="w-8 text-center text-[10px] text-mv-text-secondary">{prefs.lineHeight.toFixed(2)}</span>
              <Chip onClick={() => setPrefs((p) => ({ ...p, lineHeight: Math.min(2.4, +(p.lineHeight + 0.15).toFixed(2)) }))}>+</Chip>
            </Row>
          </>
        )}

        <div className="border-t border-mv-border" />

        {/* Auto-scroll */}
        {effectiveMode !== 'prose' && (
          <Row label="Auto scroll">
            <Chip active={autoScroll} onClick={() => setAutoScroll(!autoScroll)}>{autoScroll ? 'On' : 'Off'}</Chip>
            {autoScroll && (
              <Chip active onClick={() => setAutoScrollSpeed(autoScrollSpeed === 3 ? 1 : ((autoScrollSpeed + 1) as 1 | 2 | 3))}>
                {autoScrollSpeed}×
              </Chip>
            )}
          </Row>
        )}

        {/* Preferences */}
        <Row label="Feel">
          <Chip active={prefs.pageTransitions} onClick={() => setPrefs((p) => ({ ...p, pageTransitions: !p.pageTransitions }))}>
            Transitions
          </Chip>
          <Chip active={prefs.gestures} onClick={() => setPrefs((p) => ({ ...p, gestures: !p.gestures }))}>Gestures</Chip>
          <Chip active={prefs.autoHideChrome} onClick={() => setPrefs((p) => ({ ...p, autoHideChrome: !p.autoHideChrome }))}>Auto-hide UI</Chip>
        </Row>

        <Row label="Screen">
          <Chip active={isFullscreen} onClick={toggleFullscreen}>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</Chip>
          <Chip onClick={onHelp}>Shortcuts</Chip>
        </Row>
      </div>

      {/* Live stats */}
      <div className="flex items-center justify-between border-t border-mv-border px-4 py-2 text-[9px] text-mv-text-dim">
        <span className="flex items-center gap-1"><Icon name="clock" size={11} className="text-mv-violet" /> ETA computed as you read</span>
        <span className="flex items-center gap-1"><Icon name="settings" size={11} /> Prefs saved locally</span>
      </div>
    </div>
  );
}
