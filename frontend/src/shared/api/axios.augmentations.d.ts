// Module augmentation — расширяем axios config двумя флагами,
// используемыми Global Loading Manager (req 4) и Notification System (req 5).
import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** AC 4.4 — пометка фонового запроса; не влияет на Global_Loading_Manager. */
    background?: boolean;
    /** AC 5.12 — отключает автоматический error-toast (для запросов, ошибки которых обрабатываются локально). */
    silent?: boolean;
  }
}
