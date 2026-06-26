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

  logout() {
    useAuthStore.getState().logout();
  },
};
