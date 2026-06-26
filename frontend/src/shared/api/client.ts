import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { sanitizeErrorMessage } from '@/shared/api/error-mapping';
import { useAuthStore } from '@/shared/auth/useAuthStore';
import { useGlobalLoadingStore } from '@/shared/loading/useGlobalLoadingStore';
import { notify } from '@/shared/notifications/notify';

/**
 * HTTP verbs that change server state. For these verbs the request interceptor
 * mirrors the non-HttpOnly `csrf_token` cookie into the `X-CSRF-Token` header
 * so the backend `csrfMiddleware` can perform double-submit validation
 * (design §3.6.4, Requirement 6.7). Safe methods (GET/HEAD/OPTIONS) are
 * bypassed.
 */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // Requirement 6.5 — JWTs are delivered exclusively via HttpOnly cookies set
  // by the backend on POST /api/login. axios must include those cookies on
  // every request so the cookie-based authMiddleware can read `access_token`.
  withCredentials: true,
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

/**
 * Read the value of a cookie by name from `document.cookie`.
 *
 * The `csrf_token` cookie is intentionally non-HttpOnly so the SPA can
 * mirror it into the `X-CSRF-Token` header for double-submit validation
 * (design §3.6.4).
 */
const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const target = `${name}=`;
  const parts = document.cookie ? document.cookie.split('; ') : [];
  for (const part of parts) {
    if (part.startsWith(target)) {
      return decodeURIComponent(part.slice(target.length));
    }
  }
  return null;
};

// --- REQUEST INTERCEPTOR ---
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Requirement 6.7 — for mutating verbs, copy the csrf_token cookie into
    // the X-CSRF-Token header so the backend csrfMiddleware can verify the
    // double-submit. Safe verbs (GET/HEAD/OPTIONS) are skipped.
    const method = (config.method ?? 'get').toUpperCase();
    if (MUTATING_METHODS.has(method)) {
      const csrfToken = readCookie('csrf_token');
      if (csrfToken) {
        config.headers.set('X-CSRF-Token', csrfToken);
      }
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
      // Requirement 6.5 — skip auto-logout/redirect for endpoints that
      // legitimately return 401 to an unauthenticated caller: `/login` (bad
      // credentials) and `/refresh` (expired refresh cookie). Forcing a
      // `window.location.href = '/login'` here would hard-reload the page
      // before the caller's `onError` could surface an inline toast (e.g.
      // "Неверный логин или пароль" / "Слишком много попыток"). For any
      // other endpoint a 401 means the access cookie expired mid-session,
      // so we still clear local state and bounce to /login.
      const requestUrl = error.config?.url ?? '';
      const isAuthBootstrapEndpoint = requestUrl === '/login' || requestUrl === '/refresh';
      if (!isAuthBootstrapEndpoint) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
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
