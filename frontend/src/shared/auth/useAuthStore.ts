import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/shared/types/auth';

/**
 * Auth store backing the SPA's view of the current session.
 *
 * Under the cookie-based auth flow introduced by Requirement 6.5 the JWT is
 * delivered exclusively via HttpOnly cookies set by `POST /api/login` — the
 * client SHALL NOT see, store or transmit the JWT itself. Consequently this
 * store does NOT keep a `token` field: it only caches the lightweight
 * `AuthUser` profile returned in the response body (`id`, `full_name`,
 * `role`) plus a derived `isAuthenticated` flag. Persisting the profile in
 * `localStorage` is safe (no credentials, no JWT) and lets the UI render the
 * authenticated chrome immediately on cold start; cookie validity is
 * re-verified by `useAuthSession`'s call to `/me`, which will trigger a
 * `logout()` on 401 if the cookie has expired or is missing.
 */
interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /**
   * Records a successful authentication. Takes only the profile — the JWT is
   * already in an HttpOnly cookie at this point (R6.5).
   */
  setAuth: (user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setAuth: (user) => {
        set({ user, isAuthenticated: true });
      },
      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    },
  ),
);
