import apiClient from "@/shared/api/client";
import { useAuthStore } from "@/shared/auth/useAuthStore";
import type { LoginResponse } from "../types";

export const authService = {
  async login(login: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>("/login", {
      login,
      password,
    });

    return response.data;
  },

  async getCurrentUser() {
    const response = await apiClient.get("/me");
    return response.data;
  },

  logout() {
    useAuthStore.getState().logout();
  },
};
