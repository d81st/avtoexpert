import crypto from 'node:crypto';
import type { RequestHandler } from 'express';
import { forbidden } from '../errors/httpError.js';
import { CSRF_TOKEN_COOKIE } from '../../modules/auth/auth.service.js';

/** Methods that do not mutate state bypass CSRF verification (R6.7). */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Auth bootstrap routes that must work before a `csrf_token` cookie exists.
 * `POST /login` mints the first token triple; `POST /logout` and
 * `POST /refresh` are authenticated via cookies, not the double-submit header.
 */
const CSRF_EXEMPT_PATHS = new Set(['/login', '/logout', '/refresh']);

/** Header carrying the double-submit CSRF token (R6.7). */
const CSRF_HEADER = 'X-CSRF-Token';

/**
 * Constant-time string equality. Returns `false` when either value is
 * missing or the lengths differ, without leaking timing information for
 * equal-length comparisons.
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Double-submit cookie CSRF protection (R6.7, design §3.6.4).
 *
 * Safe methods (GET, HEAD, OPTIONS) bypass the check. For every other
 * (state-changing) method the request is rejected with 403 when the
 * `csrf_token` cookie or the `X-CSRF-Token` header is missing, or when the
 * two values are not byte-equal.
 */
export const csrfMiddleware: RequestHandler = (req, _res, next) => {
  const method = req.method.toUpperCase();
  if (SAFE_METHODS.has(method)) {
    next();
    return;
  }

  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[
    CSRF_TOKEN_COOKIE
  ];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken || !timingSafeEqualStr(cookieToken, headerToken)) {
    next(forbidden('CSRF token mismatch'));
    return;
  }

  next();
};
