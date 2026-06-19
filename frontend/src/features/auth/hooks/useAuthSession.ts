import { useQuery } from "@tanstack/react-query";
import { authService } from "../api/authApi";
import { useAuthStore } from "@/shared/auth/useAuthStore";

export function useAuthSession() {
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  const sessionQuery = useQuery({
    queryKey: ["auth", "me", token],
    enabled: Boolean(token),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    queryFn: async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setAuth(token as string, currentUser);
        return currentUser;
      } catch (error) {
        logout();
        throw error;
      }
    },
  });

  return {
    isAuthenticated,
    isInitializing: Boolean(token) && sessionQuery.isPending,
  };
}
