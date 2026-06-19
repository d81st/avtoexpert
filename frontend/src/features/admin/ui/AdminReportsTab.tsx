import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminService } from "@/features/admin/api/adminApi";
import type { AdminReport, AdminPagination } from "@/features/admin/types";
import { formatDate, formatProgress, formatSum } from "@/shared/lib/formatters";
import StatusBadge from "@/shared/ui/StatusBadge";
import Button from "@/shared/ui/Button";
import Loader from "@/shared/ui/Loader";
import Alert from "@/shared/ui/Alert";
import Card from "@/shared/ui/Card";

export default function AdminReportsTab() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState<AdminPagination | null>(null);

  const fetchReports = async (search?: string, page = currentPage) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await adminService.getAllReports({
        page,
        search: search || searchQuery || undefined,
        limit: 20,
      });
      setReports(response.data as unknown as AdminReport[]);
      setPagination(response.pagination);
    } catch (err) {
      setError((err as Error).message || "Ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(undefined, currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchReports(searchQuery, 1);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
    fetchReports("", 1);
  };

  const handleViewReport = (reportId: string) => {
    navigate(`/report/${reportId}`);
  };

  return (
    <>
      <form onSubmit={handleSearch} className="mb-6 flex flex-col gap-2 sm:flex-row">
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
          <Button type="button" variant="secondary" onClick={handleClearSearch}>
            Сбросить
          </Button>
        )}
      </form>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {isLoading ? (
        <Loader message="Загрузка заключений..." />
      ) : reports.length === 0 ? (
        <Card className="text-center">
          <p className="text-gray-500">Заключения не найдены</p>
        </Card>
      ) : (
        <>
          <div className="data-table-wrap">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">№</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Прогресс</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Госномер</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Владелец</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сумма</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">
                      {report.reportNumber || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(report.reportDate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatProgress(report.currentStep)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {report.licensePlate || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {report.ownerName || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatSum(report.grandTotal)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewReport(report.id)}
                        className="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        Открыть
                      </button>
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
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                ←
              </Button>
              <span className="px-4 py-2 text-sm text-gray-600">
                {currentPage} из {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= pagination.totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                →
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
