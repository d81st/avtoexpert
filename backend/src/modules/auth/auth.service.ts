import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { notFound, unauthorized } from '../../common/errors/httpError.js';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { creators } from '../../db/schema.js';

// Pre-hashed dummy to prevent timing attacks on non-existent users
const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWX012';

// --- Token / cookie constants (R6.4, R6.5, R6.6) ---

/** Access JWT lifetime: 900 s (15 min) — R6.4. */
export const ACCESS_TOKEN_TTL_SECONDS = 900;
/** Refresh JWT lifetime: 604800 s (7 days) — R6.4. */
export const REFRESH_TOKEN_TTL_SECONDS = 604_800;
/** CSRF token entropy: 32 random bytes encoded as base64url — R6.7. */
const CSRF_TOKEN_BYTES = 32;

/** Cookie names used by the Auth_Token_Manager. */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const CSRF_TOKEN_COOKIE = 'csrf_token';

/** Refresh cookie is scoped to the refresh endpoint per design §3.6.3. */
const REFRESH_TOKEN_COOKIE_PATH = '/api/refresh';

type Role = 'creator' | 'admin';

export interface IssueTokensOptions {
  creatorId: string;
  fullName: string;
  role: Role;
}

export interface IssuedTokens {
  /** Access JWT, ttl ≤ 900 s (R6.4). */
  accessJwt: string;
  /** Refresh JWT, ttl ≤ 604800 s (R6.4). */
  refreshJwt: string;
  /** 32-byte base64url double-submit CSRF token (R6.7). */
  csrfToken: string;
}

/** Claims embedded in the access/refresh JWTs (consumed by authMiddleware). */
export interface TokenPayload {
  id: string;
  fullName: string;
  role: Role;
}

/**
 * Cookies carrying JWTs are `Secure` in every environment except
 * `development`, where TLS is typically absent (R6.6).
 */
function useSecureCookies(): boolean {
  return env.NODE_ENV !== 'development';
}

/**
 * Shared cookie attributes enforcing HttpOnly + SameSite=Strict + Secure
 * (R6.5, R6.6). Callers override `httpOnly`, `path` and `maxAge` per cookie.
 */
function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: useSecureCookies(),
    path: '/',
  };
}

export const authService = {
  /**
   * Verify credentials in constant time. Returns the creator profile on
   * success; token issuance is a separate concern (see {@link issueTokens}).
   */
  async login(login: string, password: string) {
    const [creator] = await db
      .select()
      .from(creators)
      .where(eq(creators.login, login))
      .limit(1);

    // Always run bcrypt.compare to prevent timing-based user enumeration
    const hashToCompare = creator?.passwordHash ?? DUMMY_HASH;
    const isValidPassword = await bcrypt.compare(password, hashToCompare);

    if (!creator || !isValidPassword) {
      throw unauthorized('Invalid login or password');
    }

    return {
      id: creator.id,
      full_name: creator.fullName,
      role: creator.role,
    };
  },

  /**
   * Issue an access JWT (≤900 s), a refresh JWT (≤604800 s) and a fresh
   * 32-byte base64url CSRF token. No JWT is ever returned in a response body
   * — these values are delivered to the client exclusively via cookies
   * (R6.4, R6.5).
   */
  issueTokens(options: IssueTokensOptions): IssuedTokens {
    const payload: TokenPayload = {
      id: options.creatorId,
      fullName: options.fullName,
      role: options.role,
    };

    const accessJwt = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

    const refreshJwt = jwt.sign({ ...payload, type: 'refresh' }, env.JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });

    const csrfToken = crypto.randomBytes(CSRF_TOKEN_BYTES).toString('base64url');

    return { accessJwt, refreshJwt, csrfToken };
  },

  /**
   * Set the three auth cookies on the response:
   *  - `access_token`  HttpOnly, SameSite=Strict, path `/`
   *  - `refresh_token` HttpOnly, SameSite=Strict, path `/api/refresh`
   *  - `csrf_token`    NOT HttpOnly (readable by the SPA), SameSite=Strict
   * All carry `Secure` unless NODE_ENV==='development' (R6.5, R6.6, R6.7).
   */
  setAuthCookies(res: Response, tokens: IssuedTokens): void {
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessJwt, {
      ...baseCookieOptions(),
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshJwt, {
      ...baseCookieOptions(),
      path: REFRESH_TOKEN_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    });

    // CSRF token must be readable by client JS for the double-submit header.
    res.cookie(CSRF_TOKEN_COOKIE, tokens.csrfToken, {
      ...baseCookieOptions(),
      httpOnly: false,
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });
  },

  /**
   * Clear all three auth cookies. Attributes (path, sameSite, secure) MUST
   * match those used when setting them so browsers actually remove them.
   */
  clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, baseCookieOptions());

    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...baseCookieOptions(),
      path: REFRESH_TOKEN_COOKIE_PATH,
    });

    res.clearCookie(CSRF_TOKEN_COOKIE, {
      ...baseCookieOptions(),
      httpOnly: false,
    });
  },

  /**
   * Verify a refresh JWT and return its principal claims. Throws 401 when the
   * token is missing, malformed, expired, or is not a refresh-type token.
   * Reusable by the `POST /api/refresh` route (wired in task 3.8).
   */
  verifyRefreshToken(token: string | undefined): TokenPayload {
    if (!token) {
      throw unauthorized('Refresh token is required');
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload & {
        type?: string;
      };

      if (decoded.type !== 'refresh') {
        throw unauthorized('Invalid refresh token');
      }

      return {
        id: decoded.id,
        fullName: decoded.fullName,
        role: decoded.role,
      };
    } catch {
      throw unauthorized('Invalid refresh token');
    }
  },

  async getCurrentUser(creatorId: string) {
    const [creator] = await db
      .select({
        id: creators.id,
        fullName: creators.fullName,
        role: creators.role,
      })
      .from(creators)
      .where(eq(creators.id, creatorId))
      .limit(1);

    if (!creator) {
      throw notFound('User not found');
    }

    return {
      id: creator.id,
      full_name: creator.fullName,
      role: creator.role,
    };
  },
};
