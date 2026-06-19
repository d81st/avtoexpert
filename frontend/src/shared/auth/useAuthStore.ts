import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/shared/types/auth";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (token, user) => {
        set({ token, user, isAuthenticated: true });
      },
      setUser: (user) => {
        set((state) => ({
          user,
          isAuthenticated: Boolean(state.token),
        }));
      },
      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: "auth-storage",
    },
  ),
);
