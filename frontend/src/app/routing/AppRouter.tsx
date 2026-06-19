import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthSession } from "@/features/auth/hooks/useAuthSession";
import Login from "@/features/auth/ui/Login";
import Dashboard from "@/features/reports/ui/Dashboard";
import ReportPage from "@/features/reports/ui/ReportPage";
import AdminPage from "@/features/admin/ui/AdminPage";
import Loader from "@/shared/ui/Loader";
import NotFound from "./NotFound";
import PrivateRoute from "./PrivateRoute";

export default function AppRouter() {
  const { isAuthenticated, isInitializing } = useAuthSession();

  if (isInitializing) {
    return <Loader message="Р—Р°РіСЂСѓР·РєР°..." />;
  }

  return (
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
  );
}
