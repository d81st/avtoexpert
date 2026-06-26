import type { RequestHandler } from 'express';

/**
 * Asserts the explicit charset suffix on every JSON response.
 *
 * Express 5 already sets `Content-Type: application/json; charset=utf-8` for
 * `res.json(...)` by default. This middleware enforces the contract at the
 * framework boundary so a future handler that calls `res.setHeader('Content-Type', ...)`
 * cannot accidentally regress the value (e.g. dropping the `charset=utf-8`
 * suffix or switching to `text/html`). HTML output is forbidden by design
 * (R6.3); `helmet()` remains responsible for the broader security headers.
 *
 * Implementation: wrap `res.json` once per request so the header is set
 * immediately before the body is serialized and dispatched.
 *
 * @see Requirements 6.3 — Content-Type: application/json; charset=utf-8
 */
export const setJsonContentType: RequestHandler = (_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body?: unknown) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson(body);
  }) as typeof res.json;
  next();
};
