/**
 * Minimal structured logger.
 *
 * Production emits single-line JSON (parseable by any log aggregator —
 * Render, Loki, Datadog, etc.). Development keeps readable text. Every
 * entry carries a `level` + `msg`, plus any caller-provided fields.
 */

const isProd = process.env.NODE_ENV === 'production';

function line(fields: Record<string, unknown>): string {
  try {
    return JSON.stringify(fields);
  } catch {
    return JSON.stringify({ level: fields.level ?? 'error', msg: '[unserializable log fields]' });
  }
}

export const logger = {
  info(msg: string, fields: Record<string, unknown> = {}): void {
    if (isProd) console.log(line({ level: 'info', msg, ...fields }));
    else console.log(`ℹ️  ${msg}`, Object.keys(fields).length ? fields : '');
  },

  warn(msg: string, fields: Record<string, unknown> = {}): void {
    if (isProd) console.warn(line({ level: 'warn', msg, ...fields }));
    else console.warn(`⚠️  ${msg}`, Object.keys(fields).length ? fields : '');
  },

  error(msg: string, fields: Record<string, unknown> = {}): void {
    if (isProd) console.error(line({ level: 'error', msg, ...fields }));
    else console.error(`❌ ${msg}`, Object.keys(fields).length ? fields : '');
  },

  /** HTTP access log (method, path, status, duration). */
  http(method: string, path: string, status: number, durationMs: number, ip: string, userId?: string): void {
    if (isProd) {
      console.log(line({ level: 'http', method, path, status, durationMs, ip, userId: userId ?? null }));
    } else {
      console.log(`${method} ${path} ${status} ${durationMs}ms`);
    }
  },
};

/**
 * Express middleware: one JSON access-log line per completed request.
 * Used in place of morgan('dev') in production.
 */
export function httpLogger() {
  return (req: { method: string; originalUrl: string; ip?: string; user?: { uid?: string } }, res: { statusCode: number; on: (event: 'finish', cb: () => void) => void }, next: () => void): void => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
      logger.http(req.method, req.originalUrl, res.statusCode, durationMs, req.ip ?? '-', req.user?.uid);
    });
    next();
  };
}
