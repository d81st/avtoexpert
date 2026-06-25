import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";
import { useDashboard } from "../hooks/useDashboard";
import { Button } from "@/components/ui/button";
import AppLayout from "@/app/routing/AppLayout";
import { notify } from "@/shared/notifications/notify";
import { sanitizeErrorMessage } from "@/shared/api/error-mapping";
import { DashboardSearchBar } from "./DashboardSearchBar";
import { DashboardTableArea } from "./DashboardTableArea";

type DashboardLocationState = { justGenerated?: boolean } | null;

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as DashboardLocationState;
  const justGenerated = Boolean(locationState?.justGenerated);

  const {
    reports,
    pagination,
    isInitialLoading,
    error,
    currentPage,
    searchQuery,
    handleClearSearch,
    handleDeleteReport,
    reportsQuery,
    deleteReportMutation,
    register,
    setCurrentPage,
  } = useDashboard();

  // AC 5.3 — успешная генерация заключения отображается как transient toast.
  // Sonner сам отвечает за auto-dismiss (AC 5.7), поэтому локальный таймер
  // 5 с удалён. История маршрута очищается сразу, чтобы рефреш страницы не
  // показал toast повторно.
  useEffect(() => {
    if (!justGenerated) return;
    notify.success("Заключение успешно сгенерировано");
    navigate(location.pathname, { replace: true, state: null });
  }, [justGenerated, navigate, location.pathname]);

  // AC 1.9, 5.4 — ошибки `Reports_Query` направляются в Notification_System,
  // когда у нас уже есть ранее закэшированные данные (refetch при наличии
  // списка или повторный запрос после первой успешной загрузки). Случай
  // первичной загрузки без кэша (`reportsQuery.data === undefined`)
  // обрабатывается отдельным persistent inline-блоком внутри
  // `DashboardTableArea` ниже (AC 1.8, 5.11).
  //
  // Запрос помечен `silent: true` в `useReportsQuery`, поэтому глобальный
  // error-interceptor (AC 5.12) не показывает дублирующий toast.
  useEffect(() => {
    if (!reportsQuery.isError) return;
    if (reportsQuery.data === undefined) return;
    notify.error(sanitizeErrorMessage(reportsQuery.error as AxiosError));
  }, [reportsQuery.isError, reportsQuery.error, reportsQuery.data]);

  // Persistent inline-ошибка показывается только когда нет ни одного
  // отчёта для рендера (AC 5.11). При наличии кэшированных строк ошибка
  // уже покрыта transient toast выше и список остаётся видимым (AC 1.7).
  const persistentError =
    error && reports.length === 0 ? error : null;

  return (
    <AppLayout>
      <div
        data-testid="dashboard-header"
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
      >
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            Мои заключения
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Всего: {pagination?.total ?? reports.length} | Страница{" "}
            {pagination?.page ?? 1} из {pagination?.totalPages ?? 1}
          </p>
        </div>
        <Button onClick={() => navigate("/report/new")} size="lg">
          + Создать заключение
        </Button>
      </div>

      <DashboardSearchBar
        register={register}
        isFetching={reportsQuery.isFetching}
        searchQuery={searchQuery}
        onClear={handleClearSearch}
      />

      <DashboardTableArea
        isInitialLoading={isInitialLoading}
        error={persistentError}
        reports={reports}
        pagination={pagination}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onDelete={handleDeleteReport}
        isDeletePending={deleteReportMutation.isPending}
      />
    </AppLayout>
  );
}

export default Dashboard;
