import { useMutation } from "@tanstack/react-query";
import { authService } from "../api/authApi";

export interface LoginPayload {
  login: string;
  password: string;
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: ({ login, password }: LoginPayload) =>
      authService.login(login, password),
  });
}
