import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/auth/useAuthStore";
import { useLoginMutation, type LoginPayload } from "../model/authMutations";
import Card from "@/shared/ui/Card";
import Input from "@/shared/ui/Input";
import Button from "@/shared/ui/Button";
import Alert from "@/shared/ui/Alert";

function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const loginMutation = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginPayload>({
    mode: "onBlur",
    defaultValues: {
      login: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (payload) => {
    const response = await loginMutation.mutateAsync(payload);
    setAuth(response.token, response.creator);
    navigate("/");
  });

  const errorMessage =
    loginMutation.error instanceof Error
      ? loginMutation.error.message
      : "Неверный логин или пароль";

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

        {loginMutation.isError && (
          <Alert
            type="error"
            message={errorMessage}
            onClose={() => loginMutation.reset()}
          />
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input
            type="text"
            id="login"
            label="Логин"
            error={errors.login?.message}
            disabled={loginMutation.isPending}
            {...register("login", {
              required:
                "Логин и пароль не могут быть пустыми",
              setValueAs: (value) => value.trim(),
            })}
          />

          <Input
            type="password"
            id="password"
            label="Пароль"
            error={errors.password?.message}
            disabled={loginMutation.isPending}
            {...register("password", {
              required:
                "Логин и пароль не могут быть пустыми",
              setValueAs: (value) => value.trim(),
            })}
          />

          <Button
            type="submit"
            disabled={loginMutation.isPending}
            isLoading={loginMutation.isPending}
            fullWidth
          >
            {loginMutation.isPending
              ? "Вход в систему..."
              : "Войти"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default Login;
