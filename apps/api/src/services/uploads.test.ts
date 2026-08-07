import { describe, expect, it, beforeAll } from 'vitest';

describe('uploads', () => {
  let uploads: typeof import('./uploads.js');

  beforeAll(async () => {
    // uploads.ts imports config only, but keep the rbac.test.ts convention
    // so a future import change stays offline-safe.
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    uploads = await import('./uploads.js');
  });

  // A real 1x1 red PNG.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  describe('verifyMagicBytes', () => {
    it('accepts a real PNG', () => {
      expect(uploads.verifyMagicBytes(PNG, 'image/png')).toBe(true);
    });

    it('rejects text masquerading as a PNG (declared mime lies)', () => {
      const fake = Buffer.from('Hello world, definitely not an image!');
      expect(uploads.verifyMagicBytes(fake, 'image/png')).toBe(false);
    });

    it('accepts JPEG, WebP, GIF and AVIF magic bytes', () => {
      expect(uploads.verifyMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), 'image/jpeg')).toBe(true);

      const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
      expect(uploads.verifyMagicBytes(webp, 'image/webp')).toBe(true);

      expect(uploads.verifyMagicBytes(Buffer.from('GIF89a....'), 'image/gif')).toBe(true);

      const avif = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypavif')]);
      expect(uploads.verifyMagicBytes(avif, 'image/avif')).toBe(true);
    });

    it('rejects a real PNG with a mismatched declared mime', () => {
      expect(uploads.verifyMagicBytes(PNG, 'image/heic')).toBe(false);
    });

    it('rejects empty/too-short buffers', () => {
      expect(uploads.verifyMagicBytes(Buffer.alloc(0), 'image/png')).toBe(false);
      expect(uploads.verifyMagicBytes(Buffer.from([0x89]), 'image/png')).toBe(false);
    });
  });

  describe('parseDataUrl', () => {
    it('parses a base64 data URL with mime + ext', () => {
      const parsed = uploads.parseDataUrl(`data:image/png;base64,${PNG.toString('base64')}`);
      expect(parsed).not.toBeNull();
      expect(parsed!.mime).toBe('image/png');
      expect(parsed!.ext).toBe('png');
      expect(parsed!.buffer.equals(PNG)).toBe(true);
    });

    it('normalizes jpeg to jpg extension', () => {
      const parsed = uploads.parseDataUrl('data:image/jpeg;base64,AAAA');
      expect(parsed!.ext).toBe('jpg');
    });

    it('rejects non-data-url input and empty payloads', () => {
      expect(uploads.parseDataUrl('not-a-data-url')).toBeNull();
      expect(uploads.parseDataUrl('data:image/png;base64,')).toBeNull();
    });
  });

  describe('sanitizeName', () => {
    it('lowercases and replaces unsafe characters (dots are legal)', () => {
      expect(uploads.sanitizeName('My Cover Page 01.PNG')).toBe('my-cover-page-01.png');
    });

    it('neutralizes traversal attempts', () => {
      // Dots survive but slashes are replaced — joined with a sanitized
      // folder + forced extension, no path escape is possible (the folder
      // segments are also scrubbed by ensureSafePath).
      const out = uploads.sanitizeName('../../etc/passwd');
      expect(out).not.toMatch(/[\\/]/);
      expect(out).toBe('..-..-etc-passwd'); // deterministic, slash-free
    });

    it('falls back to a timestamped name when empty', () => {
      expect(uploads.sanitizeName('   ')).toMatch(/^img-\d+$/);
    });

    it('caps length at 80 chars', () => {
      expect(uploads.sanitizeName('a'.repeat(300)).length).toBeLessThanOrEqual(80);
    });
  });

  describe('ensureSafePath', () => {
    it('strips traversal segments', () => {
      expect(uploads.ensureSafePath(['chapters', '..', '..', 'covers'])).toBe('chapters/covers');
    });

    it('replaces mixed slashes inside segments', () => {
      expect(uploads.ensureSafePath(['a/b', 'c\\d'])).toBe('a-b/c-d');
    });

    it('drops empty segments', () => {
      expect(uploads.ensureSafePath(['', 'general'])).toBe('general');
    });
  });
});
