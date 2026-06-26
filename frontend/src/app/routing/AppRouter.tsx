import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ErrorBoundary from '@/app/errors/ErrorBoundary';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import PrivateRoute from './PrivateRoute';

const Dashboard = lazy(() => import('@/features/reports/ui/Dashboard'));
const ReportPage = lazy(() => import('@/features/reports/ui/ReportPage'));
const AdminPage = lazy(() => import('@/features/admin/ui/AdminPage'));
const Login = lazy(() => import('@/features/auth/ui/Login'));
const NotFound = lazy(() => import('./NotFound'));

function PageLoader({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="mt-4 text-gray-600">{message}</p>
    </div>
  );
}

export default function AppRouter() {
  const { isAuthenticated, isInitializing } = useAuthSession();

  if (isInitializing) {
    return <PageLoader message="Загрузка..." />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader message="Загрузка страницы..." />}>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
          />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/report/new"
            element={
              <PrivateRoute>
                <ReportPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/report/:id"
            element={
              <PrivateRoute>
                <ReportPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute requireAdmin>
                <AdminPage />
              </PrivateRoute>
            }
          />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
