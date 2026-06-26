import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/features/auth/api/authApi';
import { useAuthStore } from '@/shared/auth/useAuthStore';
import type { AdminTab } from '../types';

export interface UseAdminReturn {
  isAdmin: boolean;
  userName: string | undefined;
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  handleLogout: () => Promise<void>;
  isLoggingOut: boolean;
  handleGoToDashboard: () => void;
}

export function useAdmin(): UseAdminReturn {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isAdmin = user?.role === 'admin';

  const handleLogout = useCallback(async () => {
    // R2.8 — идемпотентность: повторные клики игнорируются, пока идёт logout.
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      // R2.3 — серверный POST /logout; R2.4 — локальный logout сработает
      // даже при сетевой/серверной ошибке (внутри authService.logout()).
      await authService.logout();
    } finally {
      navigate('/login');
    }
  }, [isLoggingOut, navigate]);

  const handleGoToDashboard = () => {
    navigate('/');
  };

  return {
    isAdmin,
    userName: user?.full_name,
    activeTab,
    setActiveTab,
    handleLogout,
    isLoggingOut,
    handleGoToDashboard,
  };
}
