import { useMutation } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import { authService } from '../api/authApi';

export interface LoginPayload {
  login: string;
  password: string;
  /**
   * Опциональный axios config. Передаётся в `authService.login` и далее в
   * `apiClient.post`. Используется для `{ silent: true }` (AC 5.12), чтобы
   * локально обработанные ошибки не дублировались тостами от interceptor'а.
   */
  config?: AxiosRequestConfig;
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: ({ login, password, config }: LoginPayload) =>
      authService.login(login, password, config),
  });
}
