import apiClient from "@/shared/api/client";
import { useAuthStore } from "@/shared/auth/useAuthStore";
import type { AxiosRequestConfig } from "axios";
import type { LoginResponse } from "../types";

export const authService = {
  /**
   * Выполняет вход в систему.
   *
   * @param config — опциональный axios config. Поддерживает `silent: true`
   *   (AC 5.12) для подавления автоматического error-toast в interceptor'е и
   *   `background: true` (AC 4.4), если потребуется в будущем.
   */
  async login(
    login: string,
    password: string,
    config?: AxiosRequestConfig,
  ): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      "/login",
      { login, password },
      config,
    );

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
