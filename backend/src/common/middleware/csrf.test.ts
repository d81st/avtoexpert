import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { CSRF_TOKEN_COOKIE } from '../../modules/auth/auth.service.js';
import { csrfMiddleware } from './csrf.js';

function runMiddleware(
  req: Partial<Request>,
): { next: ReturnType<typeof vi.fn>; error: unknown } {
  const next = vi.fn();
  csrfMiddleware(req as Request, {} as Response, next as NextFunction);
  return { next, error: next.mock.calls[0]?.[0] };
}

describe('csrfMiddleware', () => {
  it('allows POST /login without a CSRF token (auth bootstrap)', () => {
    const { next, error } = runMiddleware({
      method: 'POST',
      path: '/login',
      cookies: {},
    });

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects other mutating routes when the CSRF token is missing', () => {
    const { next, error } = runMiddleware({
      method: 'POST',
      path: '/reports',
      cookies: {},
      get: () => undefined,
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({
      statusCode: 403,
      message: 'CSRF token mismatch',
    });
  });

  it('allows mutating routes when cookie and header tokens match', () => {
    const token = 'test-csrf-token';
    const { next, error } = runMiddleware({
      method: 'POST',
      path: '/reports',
      cookies: { [CSRF_TOKEN_COOKIE]: token },
      get: ((header: string) =>
        header === 'X-CSRF-Token' ? token : undefined) as Request['get'],
    });

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });
});