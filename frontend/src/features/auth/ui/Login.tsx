import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/auth/useAuthStore";
import { authService } from "@/features/auth/api/authApi";
import { AxiosError } from "axios";
import Card from "@/shared/ui/Card";
import Input from "@/shared/ui/Input";
import Button from "@/shared/ui/Button";
import Alert from "@/shared/ui/Alert";

function Login() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!login.trim() || !password.trim()) {
        setError("Логин и пароль не могут быть пустыми");
        return;
      }

      const response = await authService.login(login, password);
      setAuth(response.token, response.creator);
      navigate("/");
    } catch (err) {
      const axiosError = err as AxiosError;
      const errorMessage =
        (axiosError.response?.data as any)?.message ||
        "Неверный логин или пароль";
      setError(errorMessage);
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-shell flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-3xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-2xl text-white shadow-md">
            🚗
          </div>
          <h1 className="brand-title text-3xl font-bold text-slate-900">
            AvtoExpert Pro
          </h1>
          <p className="page-subtitle mt-1 text-sm">
            Система экспертизы автомобилей
          </p>
        </div>

        {error && (
          <Alert type="error" message={error} onClose={() => setError("")} />
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            type="text"
            id="login"
            label="Логин"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            disabled={isLoading}
          />

          <Input
            type="password"
            id="password"
            label="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />

          <Button
            type="submit"
            disabled={isLoading}
            isLoading={isLoading}
            fullWidth
          >
            {isLoading ? "Вход в систему..." : "Войти"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default Login;
