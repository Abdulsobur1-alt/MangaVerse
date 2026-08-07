/**
 * Studio uploads — covers, banners and chapter page images.
 *
 * Primary path: Supabase Storage (the API already authenticates against
 * Supabase; the service-role key is used server-side only to write files
 * into the configured public bucket).
 *
 * Dev fallback: when Supabase storage is not configured (local dev without
 * a project), images are written to apps/api/public/uploads and served via
 * the existing static mount at /api/download/uploads/... so the full Studio
 * flow stays testable with zero external credentials.
 */

import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// public/ is resolved from the compiled output (dist) in production and from
// src in dev — both sit one level under the repo app dir, so ../../public
// lands on apps/api/public in either layout.
const PUBLIC_DIR = join(__dirname, '../../public');
const UPLOAD_ROOT = join(PUBLIC_DIR, 'uploads');

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per image
const ALLOWED_MIME = /^image\/(png|jpeg|jpg|webp|gif|avif)$/i;

export interface UploadedImage {
  url: string;
  width: number | null;
  height: number | null;
  size: number;
}

export function parseDataUrl(dataUrl: string): { buffer: Buffer; ext: string; mime: string } | null {
  const match = dataUrl.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext = (mime.split('/')[1] || 'img').replace('jpeg', 'jpg');
  return { buffer: Buffer.from(match[2], 'base64'), ext, mime };
}

export function sanitizeName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || `img-${Date.now()}`;
}

/**
 * Verify the actual file content matches the declared MIME type. Trusting
 * the data-URL header alone lets arbitrary bytes ride along as "image/png" —
 * the declared type must agree with the magic bytes we actually store.
 */
export function verifyMagicBytes(buffer: Buffer, mime: string): boolean {
  // PNG: 89 50 4E 47
  if (mime === 'image/png') return buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  // JPEG: FF D8 FF
  if (mime === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // WebP: RIFF .... WEBP
  if (mime === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  // GIF: GIF87a / GIF89a
  if (mime === 'image/gif') return buffer.toString('ascii', 0, 4) === 'GIF8';
  // AVIF: ftyp box with avif brand (first 12 bytes contain 'ftyp')
  if (mime === 'image/avif') return buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp';
  return false;
}

export function ensureSafePath(parts: string[]): string {
  // Reject any traversal; folder is used inside the upload root only.
  const safe = parts.map((p) => p.replace(/\.\./g, '').replace(/[\\/]/g, '-')).filter(Boolean);
  return safe.join('/');
}

/**
 * Upload an image (base64 data URL) and return its public URL.
 * @param dataUrl `data:image/png;base64,...`
 * @param folder sub-folder under the bucket (e.g. covers, chapters/<titleId>)
 * @param name optional file name (sanitized)
 */
export async function uploadImage(dataUrl: string, folder: string, name?: string): Promise<UploadedImage> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error('INVALID_IMAGE_DATA');
  if (!ALLOWED_MIME.test(parsed.mime)) throw new Error('UNSUPPORTED_IMAGE_TYPE');
  if (parsed.buffer.length > MAX_BYTES) throw new Error('IMAGE_TOO_LARGE');
  if (!verifyMagicBytes(parsed.buffer, parsed.mime)) throw new Error('INVALID_IMAGE_DATA');

  const safeFolder = ensureSafePath(folder.split('/'));
  const fileName = `${sanitizeName(name || `img-${Date.now()}`)}.${parsed.ext}`;
  const objectPath = `${safeFolder}/${fileName}`;

  // ── Supabase Storage (primary) ─────────────────────
  if (config.supabase.url && config.supabase.serviceRoleKey) {
    const base = config.supabase.url.replace(/\/+$/, '');
    const bucket = config.supabase.storageBucket;

    // Best-effort bucket creation (public) — a 404/400 just means the bucket
    // already exists; the upload below is the real test.
    await fetch(`${base}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
        apikey: config.supabase.serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: bucket, name: bucket, public: true }),
    }).catch(() => null);

    const upload = await fetch(`${base}/storage/v1/object/${bucket}/${objectPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
        apikey: config.supabase.serviceRoleKey,
        'Content-Type': parsed.mime,
      },
      // Node's fetch BodyInit types reject Buffer — pass a Uint8Array view.
      body: new Uint8Array(parsed.buffer),
    });
    if (!upload.ok) {
      throw new Error('UPLOAD_FAILED');
    }

    return {
      url: `${base}/storage/v1/object/public/${bucket}/${objectPath}`,
      width: null,
      height: null,
      size: parsed.buffer.length,
    };
  }

  // ── Dev fallback: local static uploads ─────────────
  // rel = uploads/<safeFolder>/<fileName> — safeFolder already had its
  // segments cleaned, so joining with '/' is safe (no traversal possible).
  const rel = `uploads/${safeFolder}/${fileName}`;
  const abs = join(PUBLIC_DIR, ...rel.split('/'));
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, parsed.buffer);

  return {
    url: `/api/download/${rel}`,
    width: null,
    height: null,
    size: parsed.buffer.length,
  };
}
