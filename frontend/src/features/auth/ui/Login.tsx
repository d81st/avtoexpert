import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/auth/useAuthStore";
import { useLoginMutation } from "../model/authMutations";
import { loginSchema, type LoginFormData } from "@/schemas/login.schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { notify } from "@/shared/notifications/notify";

function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const loginMutation = useLoginMutation();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: {
      login: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit((payload) => {
    // AC 5.12 — silent: true подавляет автоматический error-toast от axios
    // interceptor'а, чтобы не дублировать toast, выпускаемый из onError ниже.
    loginMutation.mutate(
      { ...payload, config: { silent: true } },
      {
        onSuccess: (response) => {
          setAuth(response.token, response.creator);
          navigate("/");
        },
        onError: (err) => {
          // AC 5.4 — transient ошибка авторизации показывается через
          // Notification_System (Sonner toast), а не inline AppAlert.
          const errorMessage =
            err instanceof Error ? err.message : "Неверный логин или пароль";
          notify.error(errorMessage);
        },
      },
    );
  });

  return (
    <div className="app-shell flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-3xl shadow-xl bg-white/80 backdrop-blur-sm">
        <CardContent className="pt-6">
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

          <Form {...form}>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <FormField
                control={form.control}
                name="login"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Логин</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        disabled={loginMutation.isPending}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.trim())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пароль</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        disabled={loginMutation.isPending}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.trim())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full"
              >
                {loginMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {loginMutation.isPending ? "Вход в систему..." : "Войти"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default Login;
