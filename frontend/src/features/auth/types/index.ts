import type { AuthUser } from '@/shared/types/auth';

/**
 * Body of a successful `POST /api/login` response.
 *
 * Under Requirement 6.5 the access JWT is delivered ONLY in an HttpOnly
 * cookie, so the response body is the bare profile — there is no `token`
 * field on the wire. We model the response as `AuthUser` directly to keep a
 * single source of truth for the profile shape.
 */
export type LoginResponse = AuthUser;
