import { describe, expect, it, beforeAll } from 'vitest';

describe('Studio reorder validation', () => {
  let validateReorderOrder: (typeof import('./studio.js'))['validateReorderOrder'];

  beforeAll(async () => {
    // studio.ts imports lib/prisma + services; a dummy URL keeps the
    // PrismaClient construction fully offline (same convention as rbac.test.ts).
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    validateReorderOrder = (await import('./studio.js')).validateReorderOrder;
  });

  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  const c = '33333333-3333-4333-8333-333333333333';
  const foreign = '99999999-9999-4999-8999-999999999999';

  it('accepts a complete, non-duplicate order', () => {
    expect(validateReorderOrder(
      [{ id: a, number: 1 }, { id: b, number: 2 }, { id: c, number: 3 }],
      [a, b, c],
      3,
    )).toBeNull();
  });

  it('accepts an order that swaps numbers (the two-phase renumber case)', () => {
    expect(validateReorderOrder(
      [{ id: a, number: 3 }, { id: b, number: 1 }, { id: c, number: 2 }],
      [a, b, c],
      3,
    )).toBeNull();
  });

  it('rejects duplicate ids', () => {
    expect(validateReorderOrder(
      [{ id: a, number: 1 }, { id: a, number: 2 }],
      [a, b],
      2,
    )).toBe('duplicate chapter ids in order');
  });

  it('rejects ids that do not belong to the title', () => {
    // The DB lookup for [a, foreign] would only find a — existingIds mirrors
    // that, so the mismatch (1 found vs 2 requested) triggers the guard.
    expect(validateReorderOrder(
      [{ id: a, number: 1 }, { id: foreign, number: 2 }],
      [a],
      2,
    )).toBe('one or more ids do not belong to this title');
  });

  it('rejects partial orders (omitted chapters keep stale numbers)', () => {
    expect(validateReorderOrder(
      [{ id: a, number: 1 }],
      [a],
      3,
    )).toBe('order must include all 3 chapters of the title');
  });

  it('rejects an empty order against a non-empty title', () => {
    expect(validateReorderOrder([], [], 2)).toBe('order must include all 2 chapters of the title');
  });
});
