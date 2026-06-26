// Module augmentation — расширяем axios config флагами,
// используемыми Global Loading Manager (req 4), Notification System (req 5)
// и Refresh_Coordinator (auth-cookie-flow-completion R3.10/R3.11).
import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** AC 4.4 — пометка фонового запроса; не влияет на Global_Loading_Manager. */
    background?: boolean;
    /** AC 5.12 — отключает автоматический error-toast (для запросов, ошибки которых обрабатываются локально). */
    silent?: boolean;
    /**
     * @internal
     * R3.10, R3.11 — гард, что запрос уже был ретраен один раз после
     * успешного refresh. Ставится `Refresh_Coordinator`-ом перед retry,
     * проверяется 401-веткой response interceptor, чтобы 401 от retry
     * не запустил вторую refresh-эпоху, а ушёл в terminal sink
     * (`forceLogout()`). Не предназначен для использования call-site'ами.
     */
    _retried?: boolean;
  }

  export interface InternalAxiosRequestConfig {
    /**
     * @internal
     * R3.10, R3.11 — см. {@link AxiosRequestConfig._retried}.
     */
    _retried?: boolean;
  }
}
