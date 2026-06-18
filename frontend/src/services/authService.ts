import apiClient from "./api";
import type { LoginResponse } from "../types";

export const authService = {
  login: async (login: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/login", {
      login,
      password,
    });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get("/me");
    return response.data;
  },

  logout: () => {
    localStorage.removeItem("token");
  },
};
