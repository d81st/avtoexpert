import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { Loader2 } from 'lucide-react';
import { memo } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useDebouncedSideEffect } from '@/features/reports/hooks/useDebouncedSideEffect';
import { FieldError, useIsolatedField } from '@/features/reports/hooks/useIsolatedField';
import { type LoginFormData, loginSchema } from '@/schemas/login.schema';
import { useAuthStore } from '@/shared/auth/useAuthStore';
import { notify } from '@/shared/notifications/notify';
import { useLoginMutation } from '../model/authMutations';

/**
 * Trim leading/trailing whitespace at form-read time instead of mutating the DOM
 * value on every keystroke. Used as `register`'s `setValueAs`, so the native input
 * stays uncontrolled: typing never triggers a parent `setState`, the caret is
 * preserved (R1.1, R1.2) and the submitted/validated value is still normalized.
 */
function trimValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Map a login-mutation error into a Sonner-toast string (Requirement 6.5).
 *
 * Specifically targets the two status codes the cookie-based auth flow can
 * return on `POST /api/login`:
 *
 *   - **401 Unauthorized** — credentials are wrong. We deliberately surface
 *     a generic "неверный логин или пароль" message so an attacker cannot
 *     enumerate valid accounts (R6.5).
 *   - **429 Too Many Requests** — the (client_ip, email) key is in the
 *     15-minute lockout window (R6.12). The backend's `tooManyRequests`
 *     helper sets a Russian-language `message`; we forward it as-is so the
 *     user sees the same "слишком много неудачных попыток" wording that
 *     the audit log records.
 *
 * For any other error (network failure, 5xx, validation) we fall back to
 * the message that the `apiClient` response interceptor has already
 * sanitized via `sanitizeErrorMessage` and written onto `error.message`.
 */
function getLoginErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    if (status === 401) {
      return 'Неверный логин или пароль';
    }
    if (status === 429) {
      const retryAfter = err.response?.headers?.['retry-after'];
      const seconds = typeof retryAfter === 'string' ? Number.parseInt(retryAfter, 10) : NaN;
      if (Number.isFinite(seconds) && seconds > 0) {
        const minutes = Math.ceil(seconds / 60);
        return `Слишком много неудачных попыток входа. Повторите попытку через ${minutes} мин.`;
      }
      return err.message || 'Слишком много неудачных попыток входа. Повторите попытку позже.';
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Не удалось выполнить вход. Попробуйте ещё раз.';
}

/**
 * Per-field render isolation for a single Login_Form input (Requirement 1.1–1.5).
 *
 * `useIsolatedField` registers an UNCONTROLLED native input (no external `value`
 * prop), so a sibling/parent re-render never resets the value or caret (R1.1–R1.3).
 * The validation side effect (`trigger`) is moved OFF the keystroke handler into a
 * `useDebouncedSideEffect(fn, 400)` callback: the DOM `value` update is never
 * blocked waiting on validation, and revalidation runs at most once per 400 ms
 * quiet window (R1.4, R1.5). Validation output is confined to the sibling
 * {@link FieldError}, which subscribes to a single-field `useFormState` selector.
 */
const LoginTextField = memo(function LoginTextField({
  name,
  label,
  type,
  disabled,
}: {
  name: keyof LoginFormData;
  label: string;
  type: 'text' | 'password';
  disabled: boolean;
}) {
  const { trigger } = useFormContext<LoginFormData>();
  const field = useIsolatedField<LoginFormData>(name, {
    setValueAs: trimValue,
  });

  // R1.4 / R1.5 — debounce the validation side effect off the input handler so it
  // never blocks the keystroke's DOM update and fires within a 300–500 ms window.
  const debouncedValidate = useDebouncedSideEffect(() => {
    void trigger(name);
  }, 400);

  return (
    <div className="space-y-2">
      <label htmlFor={`login-${name}`} className="text-sm font-medium leading-none">
        {label}
      </label>
      <Input
        id={`login-${name}`}
        type={type}
        disabled={disabled}
        {...field}
        onChange={(e) => {
          field.onChange(e);
          debouncedValidate();
        }}
      />
      <FieldError name={name} />
    </div>
  );
});

function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const loginMutation = useLoginMutation();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: {
      login: '',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit((payload) => {
    // AC 5.12 — silent: true подавляет автоматический error-toast от axios
    // interceptor'а, чтобы не дублировать toast, выпускаемый из onError ниже.
    loginMutation.mutate(
      { ...payload, config: { silent: true } },
      {
        onSuccess: (creator) => {
          // R6.5 — JWT приходит исключительно в HttpOnly cookie, теле ответа
          // — только профиль. Локально кэшируем профиль и переходим на дашборд.
          setAuth(creator);
          navigate('/');
        },
        onError: (err) => {
          // R6.5 / R6.12 — inline-toast для 401 (неверные креды) и 429
          // (lockout). Текст 429 формируется бэкендом и содержит время
          // ожидания; для 401 показываем явное сообщение, не раскрывая,
          // что именно — логин или пароль — оказалось неверным.
          notify.error(getLoginErrorMessage(err));
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
            <h1 className="brand-title text-3xl font-bold text-slate-900">AvtoExpert Pro</h1>
            <p className="page-subtitle mt-1 text-sm">Система экспертизы автомобилей</p>
          </div>

          <Form {...form}>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <LoginTextField
                name="login"
                label="Логин"
                type="text"
                disabled={loginMutation.isPending}
              />

              <LoginTextField
                name="password"
                label="Пароль"
                type="password"
                disabled={loginMutation.isPending}
              />

              <Button type="submit" disabled={loginMutation.isPending} className="w-full">
                {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loginMutation.isPending ? 'Вход в систему...' : 'Войти'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default Login;
