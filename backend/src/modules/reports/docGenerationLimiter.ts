import type { NextFunction, Request, Response } from 'express';
import rateLimit, { type Options } from 'express-rate-limit';
import type { AuthRequest } from '../../common/middleware/auth.js';

const WINDOW_MS = 60_000;
const LIMIT = 5;

/**
 * Per-user rate limiter for the document generation endpoint
 * (`POST /api/reports/:id/finalize-and-generate`).
 *
 * Allows up to {@link LIMIT} requests per {@link WINDOW_MS} window, keyed by
 * the authenticated creator's id (falling back to the client IP only if the
 * request is somehow unauthenticated). On limit breach the middleware responds
 * with HTTP 429, a `Retry-After` header (in seconds), and a machine-readable
 * JSON body. Counters live in the built-in in-memory store — no external
 * dependencies required.
 */
export const docGenerationLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const auth = req as AuthRequest;
    return auth.creator?.id ?? `ip:${req.ip ?? 'unknown'}`;
  },
  handler: (
    _req: Request,
    res: Response,
    _next: NextFunction,
    options: Options,
  ) => {
    const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: 'Too many generation requests',
      retry_after_seconds: retryAfterSeconds,
    });
  },
});

/**
 * Public configuration of {@link docGenerationLimiter} exposed for tests and
 * any consumer that needs to reason about the limit (e.g. documentation).
 */
export const DOC_GEN_LIMITER_CONFIG = {
  windowMs: WINDOW_MS,
  limit: LIMIT,
} as const;
