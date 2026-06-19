import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { useReportStore } from "@/store/useReportStore";
import {
  reportService,
  type ReportsQueryParams,
} from "@/features/reports/api/reportApi";
import { formatDate, formatProgress } from "@/shared/lib/formatters";
import StatusBadge from "@/shared/ui/StatusBadge";
import Loader from "@/components/Loader";
import Button from "@/components/Button";
import Alert from "@/components/Alert";
import Card from "@/components/Card";

function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const {
    reports,
    setReportsWithPagination,
    isLoading,
    setLoading,
    error,
    setError,
    pagination,
  } = useReportStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchReports({ page: currentPage, search: searchQuery || undefined });
  }, [currentPage]);

  const fetchReports = async (params?: ReportsQueryParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await reportService.getReports({ ...params, limit: 20 });
      setReportsWithPagination(response.data, response.pagination);
    } catch (err) {
      const errorMsg = (err as any)?.message || "Ошибка загрузки отчетов";
      setError(errorMsg);
      console.error("Error fetching reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchReports({ page: 1, search: searchQuery || undefined });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleCreateReport = () => {
    navigate("/report/new");
  };

  const handleViewReport = (reportId: string) => {
    navigate(`/report/${reportId}`);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Удалить это заключение?")) return;
    try {
      await reportService.deleteReport(reportId);
      fetchReports({ page: currentPage, search: searchQuery || undefined });
    } catch (err) {
      setError((err as Error).message || "Ошибка удаления");
    }
  };

  if (isLoading && reports.length === 0) {
    return <Loader message="Загрузка отчетов..." />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="brand-title text-2xl font-bold text-slate-900">
              AvtoExpert Pro
            </h1>
            <p className="page-subtitle mt-1 text-sm">
              Управление заключениями об экспертизе
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700 font-medium">{user?.full_name}</span>
            <Button onClick={handleLogout} variant="danger" size="sm">
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <Button onClick={handleCreateReport} variant="primary" size="lg">
            + Создать заключение
          </Button>
        </div>

        {/* Поиск */}
        <form
          onSubmit={handleSearch}
          className="mb-6 flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по номеру, госномеру, владельцу..."
            className="form-control flex-1 px-4 py-3"
          />
          <Button type="submit" variant="secondary">
            Найти
          </Button>
          {searchQuery && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
                fetchReports({ page: 1 });
              }}
            >
              Сбросить
            </Button>
          )}
        </form>

        {error && (
          <Alert type="error" message={error} onClose={() => setError(null)} />
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
                    <tr
                      key={report.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
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
                          onClick={() => handleViewReport(report.id)}
                          className="text-blue-600 hover:text-blue-900 hover:underline transition-colors"
                        >
                          Открыть
                        </button>
                        {report.status === "draft" && (
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            className="text-red-600 hover:text-red-900 hover:underline transition-colors"
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

            {/* Пагинация */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
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
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Вперёд →
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
