import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/auth/useAuthStore';
import { authService } from '../api/authApi';

export interface UseAuthSessionReturn {
  isAuthenticated: boolean;
  isInitializing: boolean;
}

/**
 * Bootstrap the session from the persisted `isAuthenticated` flag (R6.5).
 *
 * Under cookie-based auth the SPA cannot read the HttpOnly `access_token`
 * cookie, so we use the persisted profile flag as the gating signal: if a
 * previous login is remembered in `auth-storage`, verify the cookie is still
 * valid by hitting `/me`. The endpoint relies on `withCredentials: true` in
 * `apiClient` to attach the cookie automatically. A 401 from `/me` means
 * the cookie expired or was cleared server-side — we then `logout()` to
 * drop the cached profile and the user is redirected to `/login`.
 */
export function useAuthSession(): UseAuthSessionReturn {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  const sessionQuery = useQuery({
    queryKey: ['auth', 'me'],
    enabled: isAuthenticated,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    queryFn: async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        return currentUser;
      } catch (error) {
        logout();
        throw error;
      }
    },
  });

  return {
    isAuthenticated,
    isInitializing: isAuthenticated && sessionQuery.isPending,
  };
}
