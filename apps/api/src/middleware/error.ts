import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import { captureException } from '../lib/sentry.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Handle known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.');
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
      },
    });
    return;
  }

  // Handle malformed JSON bodies (body-parser entity.parse.failed) — a client
  // mistake, not a server error. Must be 400, never 500.
  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON in request body',
      },
    });
    return;
  }

  // Log unexpected errors (structured JSON in production) + report to Sentry
  // when configured. AppError/ZodError paths above are expected failures and
  // are intentionally NOT reported.
  logger.error('Unhandled error', {
    name: err.name,
    message: err.message,
    stack: err.stack?.slice(0, 2000),
  });
  captureException(err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist',
    },
  });
}
