import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  full_name: string;
  role: "creator" | "admin";
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
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
