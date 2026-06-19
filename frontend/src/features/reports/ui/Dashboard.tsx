import { useNavigate } from "react-router-dom";
import { useDashboard } from "../hooks/useDashboard";
import { formatDate, formatProgress } from "@/shared/lib/formatters";
import StatusBadge from "@/shared/ui/StatusBadge";
import Loader from "@/shared/ui/Loader";
import Button from "@/shared/ui/Button";
import Alert from "@/shared/ui/Alert";
import Card from "@/shared/ui/Card";
import AppLayout from "@/shared/ui/AppLayout";

function Dashboard() {
  const navigate = useNavigate();

  const {
    reports,
    pagination,
    isLoading,
    error,
    currentPage,
    searchQuery,
    onSearch,
    handleClearSearch,
    handleDeleteReport,
    reportsQuery,
    deleteReportMutation,
    register,
    setCurrentPage,
  } = useDashboard();

  if (isLoading) {
    return <Loader message="Загрузка отчётов..." />;
  }

  if (error && reports.length === 0) {
    return <Alert type="error" message={error} />;
  }

  return (
    <AppLayout>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Мои заключения
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Всего: {pagination?.total ?? reports.length} | Страница{" "}
              {pagination?.page ?? 1} из {pagination?.totalPages ?? 1}
            </p>
          </div>
          <Button onClick={() => navigate("/report/new")} variant="primary" size="lg">
            + Создать заключение
          </Button>
        </div>

        <form onSubmit={onSearch} className="mb-6 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="Поиск по номеру, госномеру, владельцу..."
            className="form-control flex-1 px-4 py-3"
            {...register("search")}
          />
          <Button type="submit" variant="secondary" isLoading={reportsQuery.isFetching}>
            Найти
          </Button>
          {searchQuery && (
            <Button type="button" variant="secondary" onClick={handleClearSearch}>
              Сбросить
            </Button>
          )}
        </form>

        {error && (
          <Alert
            type="error"
            message={error}
            onClose={() => {
              reportsQuery.refetch();
              deleteReportMutation.reset();
            }}
          />
        )}

        {reports.length === 0 ? (
          <Card className="text-center">
            <p className="text-gray-500 text-lg mb-4">
              У вас пока нет заключений
            </p>
            <p className="text-gray-400 text-sm">
              Создайте первое заключение, чтобы начать работу
            </p>
          </Card>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      № Заключения
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Прогресс
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {report.report_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(report.report_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${(report.current_step / 5) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium">
                            {formatProgress(report.current_step)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                        <button
                          onClick={() => navigate(`/report/${report.id}`)}
                          className="text-blue-600 hover:text-blue-900 hover:underline transition-colors"
                        >
                          Открыть
                        </button>
                        {report.status === "draft" && (
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            className="text-red-600 hover:text-red-900 hover:underline transition-colors"
                            disabled={deleteReportMutation.isPending}
                          >
                            Удалить
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                >
                  ← Назад
                </Button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  Страница {currentPage} из {pagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= pagination.totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                >
                  Вперёд →
                </Button>
              </div>
            )}
          </>
        )}
    </AppLayout>
  );
}

export default Dashboard;
