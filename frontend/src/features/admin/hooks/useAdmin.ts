import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/auth/useAuthStore';
import type { AdminTab } from '../types';

export interface UseAdminReturn {
  isAdmin: boolean;
  userName: string | undefined;
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  handleLogout: () => void;
  handleGoToDashboard: () => void;
}

export function useAdmin(): UseAdminReturn {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');

  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    useAuthStore.getState().logout();
    navigate('/login');
  };

  const handleGoToDashboard = () => {
    navigate('/');
  };

  return {
    isAdmin,
    userName: user?.full_name,
    activeTab,
    setActiveTab,
    handleLogout,
    handleGoToDashboard,
  };
}
