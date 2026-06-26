import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { authService } from '@/features/auth/api/authApi';
import { useAuthStore } from '@/shared/auth/useAuthStore';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
}

export default function AppLayout({
  children,
  title = 'AvtoExpert Pro',
  subtitle = 'Управление заключениями об экспертизе',
  headerActions,
}: AppLayoutProps) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    // R2.8 — идемпотентность: повторные клики игнорируются, пока идёт logout.
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      // R2.2 — серверный POST /logout; R2.4 — локальный logout сработает
      // даже при сетевой/серверной ошибке (внутри authService.logout()).
      await authService.logout();
    } finally {
      navigate('/login');
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="brand-title text-2xl font-bold text-slate-900">{title}</h1>
            <p className="page-subtitle mt-1 text-sm">{subtitle}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700 font-medium">{user?.full_name}</span>
            {headerActions}
            <Button
              onClick={handleLogout}
              disabled={isLoggingOut}
              variant="destructive"
              size="sm"
            >
              Выйти
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
