import axios, { AxiosError } from "axios";
import { useAuthStore } from "@/shared/auth/useAuthStore";
import { useGlobalLoadingStore } from "@/shared/loading/useGlobalLoadingStore";
import { notify } from "@/shared/notifications/notify";
import { sanitizeErrorMessage } from "@/shared/api/error-mapping";

const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Decrement the Global_Loading_Manager counter for non-background requests.
 *
 * Called from both success and error branches of the response interceptor and
 * **before** any conditional handling (401 redirect, error rejection) so the
 * counter never gets stuck for special response codes (AC 4.3, 4.13).
 */
const finalizeRequest = (config: { background?: boolean } | undefined) => {
  if (!config?.background) {
    useGlobalLoadingStore.getState().decrementRequests();
  }
};

// --- REQUEST INTERCEPTOR ---
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // AC 4.2 + 4.4 — increment only for non-background requests
    if (!config.background) {
      useGlobalLoadingStore.getState().incrementRequests();
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// --- RESPONSE INTERCEPTOR ---
apiClient.interceptors.response.use(
  (response) => {
    // AC 4.3 — decrement on success
    finalizeRequest(response.config);
    return response;
  },
  (error: AxiosError) => {
    // AC 4.3, 4.13 — decrement even on error/cancel, before any other branch
    finalizeRequest(error.config);

    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    // AC 5.12 — derive user-facing message via the central sanitizer and
    // surface it on `error.message` for any consumers that read it directly.
    const userMessage = sanitizeErrorMessage(error);
    error.message = userMessage;

    // AC 5.12 — automatic toast for unhandled errors. Background requests
    // (e.g. autosave) and locally-handled requests (silent) are excluded
    // to avoid duplicate or misleading notifications.
    if (!error.config?.silent && !error.config?.background) {
      notify.error(userMessage);
    }

    return Promise.reject(error);
  },
);

export default apiClient;
