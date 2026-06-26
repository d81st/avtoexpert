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

// --- Refresh_Coordinator module-level state (A3 / R3.2, R3.7, R3.8, R3.11) ---

/**
 * Общий in-flight Promise для single-flight refresh.
 *
 * `null` означает, что Refresh_Coordinator находится в состоянии `Idle`
 * (см. design.md «State Diagram — Refresh_Coordinator»). Любой 401 от
 * non-bootstrap endpoint'а либо подписывается на существующий Promise,
 * либо инициирует новый через `ensureRefresh()`. Сбрасывается в `null`
 * в `finally`-обёртке — это поддерживает инвариант R3.8 (idempotence
 * across epochs): следующий 401 запустит новую refresh-эпоху.
 *
 * @internal
 */
let inFlightRefresh: Promise<void> | null = null;

/**
 * Гард, что `forceLogout()` уже исполнялся в текущем процессе.
 *
 * `window.location.href = '/login'` асинхронен в браузере: страница
 * начнёт выгружаться, но JS успеет выполнить ещё несколько тиков. Без
 * guard'а вторая 401-ветка (например, от уже-отретраенного запроса или
 * от `/refresh`) могла бы повторно дёрнуть `Auth_Store.logout()` и
 * перезаписать `window.location.href`. `logoutTriggered` гарантирует
 * ровно один вызов каждого destination'а (R3.7, R5.4).
 *
 * @internal
 */
let logoutTriggered = false;

/**
 * Single-flight gate для `POST /api/refresh` (R3.2, R3.5, R3.6, R3.8).
 *
 * Если уже есть in-flight refresh — возвращает тот же Promise, чтобы
 * все конкурентные 401-handler'ы дождались одного outbound запроса
 * (R3.9). Если нет — стартует новый и прокидывает `finally`-сброс
 * `inFlightRefresh` в `null`, чтобы следующая эпоха (R3.8) могла
 * стартовать с чистого листа.
 *
 * `authService` грузится через динамический import, чтобы избежать
 * циклической зависимости (`authApi.ts` импортит `apiClient`). Возвращаемый
 * Promise семантически идентичен `authService.refreshSession()`.
 */
const ensureRefresh = (): Promise<void> => {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }
  inFlightRefresh = import('@/features/auth/api/authApi')
    .then(({ authService }) => authService.refreshSession())
    .finally(() => {
      inFlightRefresh = null;
    });
  return inFlightRefresh;
};

/**
 * Terminal sink — ровно один глобальный logout + hard-redirect на /login.
 *
 * Вызывается из трёх 401-веток (см. design.md «Branch-table 401 handler»):
 *   - 401 от `/refresh` (refresh expired/revoked) — R3.4, R3.7.
 *   - 401 от уже-отретраенного запроса (`_retried === true`) — R3.11.
 *   - reject от `ensureRefresh()` (network error / non-2xx) — R3.7.
 *
 * `logoutTriggered` guard защищает от двойного дёрганья `store.logout()`
 * и перезаписи `window.location.href`, когда несколько 401-handler'ов
 * получают reject одного и того же `inFlightRefresh`.
 */
const forceLogout = (): void => {
  if (logoutTriggered) {
    return;
  }
  logoutTriggered = true;
  useAuthStore.getState().logout();
  window.location.href = '/login';
};

/**
 * Test-only сброс module-level state Refresh_Coordinator'а.
 *
 * В production это никогда не вызывается: `logoutTriggered` де-факто
 * сбрасывается hard-reload'ом (`window.location.href = '/login'`
 * перезагружает страницу и заново инициализирует модуль), а
 * `inFlightRefresh` обнуляется в `finally`-блоке `ensureRefresh`. В
 * JSDOM, где hard-reload не происходит, unit/property-тестам нужен
 * явный reset между прогонами, иначе `logoutTriggered === true` от
 * предыдущего теста заблокирует terminal sink в следующем.
 *
 * Не предназначен для использования из production-кода — только из
 * spec-файлов (`*.test.ts`, `*.property.test.ts`).
 *
 * @internal
 */
export const __resetAuthClientForTests = (): void => {
  inFlightRefresh = null;
  logoutTriggered = false;
};

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
  async (error: AxiosError) => {
    // AC 4.3, 4.13 — decrement even on error/cancel, before any other branch
    finalizeRequest(error.config);

    if (error.response?.status === 401) {
      // Branch-table 401 handler (design.md «Branch-table 401 handler»):
      //
      //   | config.url  | _retried | Refresh? | Retry? | forceLogout? |
      //   |-------------|----------|----------|--------|--------------|
      //   | /login      | —        | no       | no     | no           |
      //   | /logout     | —        | no       | no     | no           |
      //   | /refresh    | —        | no       | no     | yes          |
      //   | any other   | false    | yes      | yes/no | yes (reject) |
      //   | any other   | true     | no       | no     | yes          |
      const cfg = error.config as
        | (InternalAxiosRequestConfig & { _retried?: boolean })
        | undefined;
      const url = cfg?.url ?? '';

      // R3.3, R5.2 — /login: bad creds / lockout. Reject caller; никакого
      // refresh и никакого forceLogout, иначе login-форма не сможет
      // показать inline-toast перед hard-redirect'ом.
      if (url === '/login') {
        return Promise.reject(error);
      }

      // R2.7 — /logout: серверный logout сам по себе не должен запускать
      // refresh-эпоху. Reject пробрасывается в `authService.logout()`,
      // который проглатывает ошибку в catch.
      if (url === '/logout') {
        return Promise.reject(error);
      }

      // R3.4, R3.7 — /refresh: refresh expired/revoked. Terminal sink.
      if (url === '/refresh') {
        forceLogout();
        return Promise.reject(error);
      }

      // R3.11 — retry уже исчерпан, второй refresh запрещён.
      if (cfg?._retried) {
        forceLogout();
        return Promise.reject(error);
      }

      // R3.2, R3.5, R3.6, R3.10 — single-flight refresh + однократный retry.
      // На retry request interceptor отработает повторно и подставит свежий
      // `X-CSRF-Token` из обновлённой `csrf_token` cookie.
      try {
        await ensureRefresh();
      } catch {
        // R3.7 — refresh провалился (401 / network error). Terminal sink.
        forceLogout();
        return Promise.reject(error);
      }

      if (!cfg) {
        // Edge: axios отдал error без config (теоретически невозможно для
        // нашего request flow, но TS требует guard). Идём в terminal sink,
        // чтобы не зависнуть в неопределённом состоянии.
        forceLogout();
        return Promise.reject(error);
      }

      cfg._retried = true;
      return apiClient(cfg);
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
