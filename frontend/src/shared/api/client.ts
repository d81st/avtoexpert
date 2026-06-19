import axios, { AxiosError } from "axios";
import { useAuthStore } from "@/store/useAuthStore";

const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }

    const responseData = error.response?.data as
      | { message?: string; error?: string }
      | undefined;

    error.message =
      responseData?.message ??
      responseData?.error ??
      error.message ??
      "Произошла ошибка";

    return Promise.reject(error);
  },
);

export default apiClient;
