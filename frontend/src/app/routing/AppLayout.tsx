import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
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
            <Button onClick={handleLogout} variant="destructive" size="sm">
              Выйти
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
