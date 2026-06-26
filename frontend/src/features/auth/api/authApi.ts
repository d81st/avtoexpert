import type { AxiosRequestConfig } from 'axios';
import apiClient from '@/shared/api/client';
import { useAuthStore } from '@/shared/auth/useAuthStore';
import type { AuthUser } from '@/shared/types/auth';
import type { LoginResponse } from '../types';

export const authService = {
  /**
   * Выполняет вход в систему.
   *
   * Под Requirement 6.5 backend возвращает в теле ответа только профиль
   * (`{ id, full_name, role }`) — access/refresh/csrf токены приходят
   * исключительно в HttpOnly cookies, которые axios автоматически
   * прикрепляет ко всем последующим запросам благодаря `withCredentials: true`.
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
    const response = await apiClient.post<LoginResponse>('/login', { login, password }, config);

    return response.data;
  },

  async getCurrentUser(): Promise<AuthUser> {
    const response = await apiClient.get<AuthUser>('/me');
    return response.data;
  },

  /**
   * Серверный logout (A2).
   *
   * Шлёт `POST /api/logout` через `apiClient` с `background: true`, чтобы
   * запрос не подсвечивался Global_Loading_Manager'ом. Серверная ошибка
   * (сеть/4xx/5xx) проглатывается — Requirement 2.4 требует, чтобы
   * локальный `Auth_Store.logout()` отработал независимо от исхода
   * серверного вызова. `useAuthStore.getState().logout()` вызывается
   * ровно один раз в `finally`.
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/logout', null, { background: true });
    } catch {
      // R2.4 — серверная ошибка не должна блокировать локальный logout.
    } finally {
      useAuthStore.getState().logout();
    }
  },

  /**
   * Тонкий wrapper над `POST /api/refresh` (A3).
   *
   * Используется `Refresh_Coordinator`-ом внутри `API_Client` для
   * single-flight продления сессии. Стор не трогается — backend
   * перевыпускает все три auth-cookie, профиль уже в `Auth_Store`.
   * `silent: true` (AC 5.12) глушит автоматический error-toast: фейл
   * refresh уходит в terminal sink (`forceLogout()`), отдельный toast
   * пользователю не нужен. `background: true` (AC 4.4) — refresh не
   * показывается как видимый сетевой round-trip.
   */
  async refreshSession(): Promise<void> {
    await apiClient.post('/refresh', null, { background: true, silent: true });
  },
};
