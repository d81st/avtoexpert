import type { AuthUser } from "@/shared/types/auth";

export interface LoginResponse {
  token: string;
  creator: AuthUser;
}
