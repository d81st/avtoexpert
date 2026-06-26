import { Router } from 'express';
import type { z } from 'zod';
import { HttpError, tooManyRequests } from '../../common/errors/httpError.js';
import {
  type AuthRequest,
  authMiddleware,
} from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { logger } from '../../shared/logger/logger.js';
import {
  REFRESH_TOKEN_COOKIE,
  authService,
} from './auth.service.js';
import { loginSchema } from './auth.schemas.js';
import { LOCKOUT_WINDOW_MS, lockoutService } from './lockout.service.js';

const router = Router();

/**
 * Seconds advertised to clients via the `Retry-After` header (and mirrored in
 * `error.details.retry_after_seconds`) when a request is denied because the
 * (client_ip, email) key is in the 15-minute lockout window (R6.12).
 */
const LOCKOUT_RETRY_AFTER_SECONDS = Math.ceil(LOCKOUT_WINDOW_MS / 1000);

/** Stable fallback when `req.ip` cannot be derived (e.g. unit-test harness). */
const UNKNOWN_CLIENT_IP = 'unknown';

/**
 * Login endpoint (R6.4–R6.7, R6.10, R6.12).
 *
 * Sequence:
 *   1. Resolve `(client_ip, email)` lockout key.
 *   2. **Before** verifying the password, ask `lockoutService.isLocked` — if
 *      the key has accumulated ≥ `LOCKOUT_THRESHOLD` failures in the sliding
 *      window, reject with 429 and `Retry-After: 900` (R6.12). This ordering
 *      is mandatory: it ensures bcrypt is not even invoked for locked keys.
 *      The locked branch has no side effects on the failure counter.
 *   3. Verify credentials via `authService.login`. On failure emit one
 *      `logger.warn('auth_failure', ...)` security log line and then call
 *      `lockoutService.recordFailure` (which itself emits an `auth_lockout`
 *      log line on threshold crossing). Re-throw the 401.
 *   4. On success: clear the failure counter via `lockoutService.recordSuccess`,
 *      mint tokens, set the three cookies, emit one
 *      `logger.info('auth_success', ...)` security log line, and return ONLY
 *      the profile in the body — no JWT in the response body (R6.5).
 */
router.post('/login', validate({ body: loginSchema }), async (req, res) => {
  const { login, password } = req.body as z.infer<typeof loginSchema>;
  const clientIp = req.ip ?? UNKNOWN_CLIENT_IP;
  const userAgent = req.get('user-agent') ?? null;
  const lockoutKey = { clientIp, email: login };

  // R6.12: lockout check MUST run before password verification.
  if (await lockoutService.isLocked(lockoutKey)) {
    throw tooManyRequests(
      'Too many failed login attempts. Try again later.',
      LOCKOUT_RETRY_AFTER_SECONDS,
    );
  }

  let creator: Awaited<ReturnType<typeof authService.login>>;
  try {
    creator = await authService.login(login, password);
  } catch (err) {
    // Only 401 from authService.login counts as an authentication failure;
    // unexpected errors (DB outage, etc.) are not lockout-eligible.
    if (err instanceof HttpError && err.statusCode === 401) {
      logger.warn('auth_failure', {
        category: 'security',
        eventType: 'auth_failure',
        emailOrUserId: login,
        clientIp,
        userAgent,
      });
      await lockoutService.recordFailure(lockoutKey);
    }
    throw err;
  }

  await lockoutService.recordSuccess(lockoutKey);

  const tokens = authService.issueTokens({
    creatorId: creator.id,
    fullName: creator.full_name,
    // `role` is stored as `varchar(50)` but constrained to the
    // 'creator' | 'admin' set by R6.11 / schema comment; cast accordingly.
    role: creator.role as 'creator' | 'admin',
  });
  authService.setAuthCookies(res, tokens);

  logger.info('auth_success', {
    category: 'security',
    eventType: 'auth_success',
    actorUserId: creator.id,
    emailOrUserId: login,
    clientIp,
    userAgent,
  });

  // R6.5: response body MUST NOT contain a JWT.
  res.json(creator);
});

/**
 * Logout endpoint (R6.5). Stateless — simply clears all three auth cookies
 * with the same attributes used when they were set so browsers actually
 * remove them. Authentication is intentionally NOT required: clearing
 * cookies on an unauthenticated session is harmless and avoids surfacing
 * 401s in the UI's "Log out" flow.
 */
router.post('/logout', (_req, res) => {
  authService.clearAuthCookies(res);
  res.status(204).end();
});

/**
 * Refresh endpoint (R6.4, R6.5). Verifies the `refresh_token` cookie, mints
 * a fresh access + refresh + CSRF token triple, re-sets all three cookies
 * and returns `{ ok: true }`. No JWT is returned in the body (R6.5).
 */
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
    | string
    | undefined;

  // Throws 401 when the cookie is missing, malformed, expired, or is not a
  // refresh-type token.
  const claims = authService.verifyRefreshToken(refreshToken);

  const tokens = authService.issueTokens({
    creatorId: claims.id,
    fullName: claims.fullName,
    role: claims.role,
  });
  authService.setAuthCookies(res, tokens);

  res.json({ ok: true });
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const user = await authService.getCurrentUser(req.creator!.id);
  res.json(user);
});

export default router;
