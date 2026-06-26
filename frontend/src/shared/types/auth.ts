export type UserRole = 'creator' | 'admin';

export interface AuthUser {
  id: string;
  full_name: string;
  role: UserRole;
}
