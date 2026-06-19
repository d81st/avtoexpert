import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { authService } from "@/features/auth/api/authApi";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ReportPage from "@/pages/ReportPage";
import AdminPage from "@/pages/AdminPage";
import NotFound from "@/pages/NotFound";
import PrivateRoute from "@/components/PrivateRoute";
import ErrorBoundary from "@/components/ErrorBoundary";

function App() {
  const { isAuthenticated, token, setAuth, logout } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      if (!token) {
        setIsInitializing(false);
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();
        setAuth(token, currentUser);
      } catch (error) {
        console.error("Error restoring auth state:", error);
        logout();
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();
  }, [token, setAuth, logout]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
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
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
