// Feature: platform-improvements-mvp
// Property 18: JWT issuance contract
//
// For any successful login that issues tokens, the resulting
// (access_jwt, refresh_jwt, set-cookie attributes) MUST satisfy:
//   1. decode(access_jwt).exp  - decode(access_jwt).iat  <= 900,
//   2. decode(refresh_jwt).exp - decode(refresh_jwt).iat <= 604_800,
//   3. The access_token and refresh_token cookies MUST carry HttpOnly,
//      SameSite=Strict, and Secure iff NODE_ENV !== 'development',
//   4. (csrf) the double-submit token MUST be 32 random bytes, base64url.
//
// Validates: Requirements 6.4, 6.5, 6.6

import type { CookieOptions, Response } from 'express';
import fc from 'fast-check';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';

// env is mocked so the property can drive NODE_ENV (controls the Secure flag,
// R6.6) and supply a deterministic signing secret without touching .env or the
// database. The auth.service reads env.NODE_ENV at call time, so flipping the
// field on this object before each invocation exercises both branches.
vi.mock('../../config/env.js', () => ({
  env: {
    NODE_ENV: 'production',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
  },
}));

import { env } from '../../config/env.js';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  authService,
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.service.js';

// --- Fake Response capturing res.cookie(...) calls --------------------------

interface CapturedCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

function createFakeResponse() {
  const cookies: CapturedCookie[] = [];
  const res = {
    cookie(name: string, value: string, options: CookieOptions) {
      cookies.push({ name, value, options });
      return res;
    },
  } as unknown as Response;
  return { res, cookies };
}

// --- Generators -------------------------------------------------------------

const NODE_ENVS = ['development', 'test', 'production'] as const;

const optionsArb = fc.record({
  creatorId: fc.uuid(),
  fullName: fc.string({ minLength: 1, maxLength: 60 }),
  role: fc.constantFrom('creator' as const, 'admin' as const),
});

const nodeEnvArb = fc.constantFrom(...NODE_ENVS);

const BASE64URL = /^[A-Za-z0-9_-]+$/;

describe('Property 18: JWT issuance contract (R6.4, R6.5, R6.6)', () => {
  it('issues tokens with correct claims, TTL bounds, csrf entropy, and cookie flags', () => {
    fc.assert(
      fc.property(optionsArb, nodeEnvArb, (options, nodeEnv) => {
        // Drive the Secure-flag branch (R6.6).
        (env as { NODE_ENV: string }).NODE_ENV = nodeEnv;

        const { accessJwt, refreshJwt, csrfToken } =
          authService.issueTokens(options);

        // --- (1) Access JWT: claims + TTL <= 900s (R6.4) ---
        const access = jwt.decode(accessJwt) as {
          id: string;
          fullName: string;
          role: string;
          iat: number;
          exp: number;
          type?: string;
        };
        expect(access.id).toBe(options.creatorId);
        expect(access.fullName).toBe(options.fullName);
        expect(access.role).toBe(options.role);
        expect(access.exp - access.iat).toBeLessThanOrEqual(
          ACCESS_TOKEN_TTL_SECONDS,
        );
        expect(access.exp - access.iat).toBeLessThanOrEqual(900);
        // Access token is not flagged as a refresh token.
        expect(access.type).toBeUndefined();

        // --- (2) Refresh JWT: claims + TTL <= 604800s (R6.4) ---
        const refresh = jwt.decode(refreshJwt) as {
          id: string;
          fullName: string;
          role: string;
          iat: number;
          exp: number;
          type?: string;
        };
        expect(refresh.id).toBe(options.creatorId);
        expect(refresh.fullName).toBe(options.fullName);
        expect(refresh.role).toBe(options.role);
        expect(refresh.type).toBe('refresh');
        expect(refresh.exp - refresh.iat).toBeLessThanOrEqual(
          REFRESH_TOKEN_TTL_SECONDS,
        );
        expect(refresh.exp - refresh.iat).toBeLessThanOrEqual(604_800);

        // Both tokens verify under the signing secret.
        expect(() => jwt.verify(accessJwt, env.JWT_SECRET)).not.toThrow();
        expect(() => jwt.verify(refreshJwt, env.JWT_SECRET)).not.toThrow();

        // --- (4) CSRF token: 32 random bytes, base64url (R6.7 entropy) ---
        expect(BASE64URL.test(csrfToken)).toBe(true);
        expect(Buffer.from(csrfToken, 'base64url').length).toBe(32);

        // --- (3) Cookie flags via setAuthCookies (R6.5, R6.6) ---
        const { res, cookies } = createFakeResponse();
        authService.setAuthCookies(res, {
          accessJwt,
          refreshJwt,
          csrfToken,
        });

        const secureExpected = nodeEnv !== 'development';
        const byName = (name: string) => cookies.find((c) => c.name === name);

        // Exactly the three auth cookies are set.
        expect(cookies).toHaveLength(3);

        const access_token = byName(ACCESS_TOKEN_COOKIE);
        expect(access_token).toBeDefined();
        expect(access_token?.value).toBe(accessJwt);
        expect(access_token?.options.httpOnly).toBe(true);
        expect(access_token?.options.sameSite).toBe('strict');
        expect(access_token?.options.secure).toBe(secureExpected);
        expect(access_token?.options.path).toBe('/');
        expect(access_token?.options.maxAge).toBe(
          ACCESS_TOKEN_TTL_SECONDS * 1000,
        );

        const refresh_token = byName(REFRESH_TOKEN_COOKIE);
        expect(refresh_token).toBeDefined();
        expect(refresh_token?.value).toBe(refreshJwt);
        expect(refresh_token?.options.httpOnly).toBe(true);
        expect(refresh_token?.options.sameSite).toBe('strict');
        expect(refresh_token?.options.secure).toBe(secureExpected);
        expect(refresh_token?.options.path).toBe('/api/refresh');
        expect(refresh_token?.options.maxAge).toBe(
          REFRESH_TOKEN_TTL_SECONDS * 1000,
        );

        // CSRF cookie must be readable by client JS (NOT HttpOnly) for the
        // double-submit header, but otherwise share Strict/Secure attributes.
        const csrf_cookie = byName(CSRF_TOKEN_COOKIE);
        expect(csrf_cookie).toBeDefined();
        expect(csrf_cookie?.value).toBe(csrfToken);
        expect(csrf_cookie?.options.httpOnly).toBe(false);
        expect(csrf_cookie?.options.sameSite).toBe('strict');
        expect(csrf_cookie?.options.secure).toBe(secureExpected);
      }),
      { numRuns: 200 },
    );
  });
});
