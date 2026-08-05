'use client';

import { useEffect, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   useAdaptiveColors — sample the cover artwork on a tiny canvas and
   derive a cinematic palette (base / accent / soft) plus a luminance
   flag so glass overlays can pick dark or light chrome. Pure client
   canvas, no dependencies; degrades gracefully to the Obsidian
   defaults when the image can't be sampled (CORS, failure).
   ═══════════════════════════════════════════════════════════════ */

export interface AdaptivePalette {
  /** Darkest sampled tone — hero backdrop base. */
  base: string;
  /** Most saturated tone — accent glows / rings. */
  accent: string;
  /** Muted mid-tone — secondary gradients. */
  soft: string;
  /** Whether the artwork is bright (→ dark glass text). */
  light: boolean;
}

const FALLBACK: AdaptivePalette = {
  base: '#150b2e',
  accent: '#7c3aed',
  soft: '#3b2a6b',
  light: false,
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

/** Quantize to reduce noise, then bucket pixels by color. */
function samplePalette(img: HTMLImageElement): AdaptivePalette | null {
  const SIZE = 32;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // Taint-safe: draw into a scratch canvas from a blob/object URL when possible.
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  } catch {
    return null; // cross-origin taint — fall back
  }

  const buckets = new Map<string, { count: number; r: number; g: number; b: number; s: number; l: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 100) continue; // skip transparent
    // Skip near-black and near-white edges that are usually gradients/borders.
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < 14 || lum > 245) continue;
    const [, s, l] = rgbToHsl(r, g, b);
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const hit = buckets.get(key);
    if (hit) {
      hit.count++;
      hit.r += r; hit.g += g; hit.b += b;
      hit.s += s; hit.l += l;
    } else {
      buckets.set(key, { count: 1, r, g, b, s, l });
    }
  }
  if (buckets.size === 0) return null;

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 14);
  const total = sorted.reduce((sum, b) => sum + b.count, 0);
  const avg = (b: (typeof sorted)[0]) => ({
    r: Math.round(b.r / b.count),
    g: Math.round(b.g / b.count),
    b: Math.round(b.b / b.count),
    s: b.s / b.count,
    l: b.l / b.count,
  });

  const dominant = avg(sorted[0]);
  const vibrant = [...sorted].map(avg).sort((a, b) => b.s - a.s)[0] || dominant;
  const soft = [...sorted].map(avg).sort((a, b) => Math.abs(a.l - 0.55) - Math.abs(b.l - 0.55))[1] || dominant;

  const light = (0.2126 * dominant.r + 0.7152 * dominant.g + 0.0722 * dominant.b) / 255 > 0.55;
  const totalFrac = total / (SIZE * SIZE);

  // Very flat/border-heavy images → use fallback rather than a muddy tint.
  if (totalFrac < 0.25) return null;

  return {
    base: `rgb(${Math.round(dominant.r * 0.42)}, ${Math.round(dominant.g * 0.42)}, ${Math.round(dominant.b * 0.42)})`,
    accent: `rgb(${vibrant.r}, ${vibrant.g}, ${vibrant.b})`,
    soft: `rgb(${soft.r}, ${soft.g}, ${soft.b})`,
    light,
  };
}

export function useAdaptiveColors(coverUrl?: string | null, bannerUrl?: string | null): AdaptivePalette {
  const [palette, setPalette] = useState<AdaptivePalette>(FALLBACK);

  useEffect(() => {
    const src = bannerUrl ?? coverUrl;
    if (!src) {
      setPalette(FALLBACK);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      const sampled = samplePalette(img);
      if (sampled) setPalette(sampled);
      // If sampling fails we keep the previous (fallback) palette.
    };
    img.onerror = () => {
      if (!cancelled) setPalette(FALLBACK);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [coverUrl, bannerUrl]);

  return palette;
}
