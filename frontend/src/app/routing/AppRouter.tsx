import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthSession } from "@/features/auth/hooks/useAuthSession";
import Loader from "@/shared/ui/Loader";
import ErrorBoundary from "@/app/errors/ErrorBoundary";
import PrivateRoute from "./PrivateRoute";

const Dashboard = lazy(() => import("@/features/reports/ui/Dashboard"));
const ReportPage = lazy(() => import("@/features/reports/ui/ReportPage"));
const AdminPage = lazy(() => import("@/features/admin/ui/AdminPage"));
const Login = lazy(() => import("@/features/auth/ui/Login"));
const NotFound = lazy(() => import("./NotFound"));

export default function AppRouter() {
  const { isAuthenticated, isInitializing } = useAuthSession();

  if (isInitializing) {
    return <Loader message="Загрузка..." />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<Loader message="Загрузка страницы..." />}>
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <Login />
            }
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
