import { describe, expect, it } from 'vitest';
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from './errors.js';

describe('API error classes', () => {
  it('AppError carries status, code and name', () => {
    const e = new AppError(503, 'AUTH_NOT_CONFIGURED', 'not configured');
    expect(e).toBeInstanceOf(Error);
    expect(e.statusCode).toBe(503);
    expect(e.code).toBe('AUTH_NOT_CONFIGURED');
    expect(e.message).toBe('not configured');
    expect(e.name).toBe('AppError');
  });

  it('NotFoundError → 404 NOT_FOUND', () => {
    const e = new NotFoundError('Title', 'abc');
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
    expect(e.message).toContain('abc');
  });

  it('ValidationError → 400 with details', () => {
    const e = new ValidationError({ email: ['required'] });
    expect(e.statusCode).toBe(400);
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.details?.email).toEqual(['required']);
  });

  it('UnauthorizedError → 401', () => {
    const e = new UnauthorizedError();
    expect(e.statusCode).toBe(401);
    expect(e.code).toBe('UNAUTHORIZED');
  });

  it('ForbiddenError → 403', () => {
    const e = new ForbiddenError();
    expect(e.statusCode).toBe(403);
    expect(e.code).toBe('FORBIDDEN');
  });

  it('ConflictError → 409', () => {
    const e = new ConflictError('exists');
    expect(e.statusCode).toBe(409);
    expect(e.code).toBe('CONFLICT');
  });
});
