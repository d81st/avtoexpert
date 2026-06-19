import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/auth/useAuthStore";
import {
  useDeleteReportMutation,
  useReportsQuery,
} from "../model/reportQueries";
import { formatDate, formatProgress } from "@/shared/lib/formatters";
import StatusBadge from "@/shared/ui/StatusBadge";
import Loader from "@/shared/ui/Loader";
import Button from "@/shared/ui/Button";
import Alert from "@/shared/ui/Alert";
import Card from "@/shared/ui/Card";

interface SearchForm {
  search: string;
}

function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const { register, handleSubmit, reset } = useForm<SearchForm>({
    defaultValues: { search: "" },
  });
  const reportsQuery = useReportsQuery({
    page: currentPage,
    search: searchQuery || undefined,
    limit: 20,
  });
  const deleteReportMutation = useDeleteReportMutation();
  const reports = reportsQuery.data?.data ?? [];
  const pagination = reportsQuery.data?.pagination ?? null;

  const onSearch = handleSubmit(({ search }) => {
    setCurrentPage(1);
    setSearchQuery(search.trim());
  });

  const handleClearSearch = () => {
    reset({ search: "" });
    setCurrentPage(1);
    setSearchQuery("");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("РЈРґР°Р»РёС‚СЊ СЌС‚Рѕ Р·Р°РєР»СЋС‡РµРЅРёРµ?")) return;
    await deleteReportMutation.mutateAsync(reportId);
  };

  const error =
    reportsQuery.error instanceof Error
      ? reportsQuery.error.message
      : deleteReportMutation.error instanceof Error
        ? deleteReportMutation.error.message
        : null;

  if (reportsQuery.isLoading) {
    return <Loader message="Р—Р°РіСЂСѓР·РєР° РѕС‚С‡РµС‚РѕРІ..." />;
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
              РЈРїСЂР°РІР»РµРЅРёРµ Р·Р°РєР»СЋС‡РµРЅРёСЏРјРё РѕР± СЌРєСЃРїРµСЂС‚РёР·Рµ
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700 font-medium">{user?.full_name}</span>
            <Button onClick={handleLogout} variant="danger" size="sm">
              Р’С‹Р№С‚Рё
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              РњРѕРё Р·Р°РєР»СЋС‡РµРЅРёСЏ
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Р’СЃРµРіРѕ: {pagination?.total ?? reports.length} | РЎС‚СЂР°РЅРёС†Р°{" "}
              {pagination?.page ?? 1} РёР· {pagination?.totalPages ?? 1}
            </p>
          </div>
          <Button onClick={() => navigate("/report/new")} variant="primary" size="lg">
            + РЎРѕР·РґР°С‚СЊ Р·Р°РєР»СЋС‡РµРЅРёРµ
          </Button>
        </div>

        <form onSubmit={onSearch} className="mb-6 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="РџРѕРёСЃРє РїРѕ РЅРѕРјРµСЂСѓ, РіРѕСЃРЅРѕРјРµСЂСѓ, РІР»Р°РґРµР»СЊС†Сѓ..."
            className="form-control flex-1 px-4 py-3"
            {...register("search")}
          />
          <Button type="submit" variant="secondary" isLoading={reportsQuery.isFetching}>
            РќР°Р№С‚Рё
          </Button>
          {searchQuery && (
            <Button type="button" variant="secondary" onClick={handleClearSearch}>
              РЎР±СЂРѕСЃРёС‚СЊ
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
              РЈ РІР°СЃ РїРѕРєР° РЅРµС‚ Р·Р°РєР»СЋС‡РµРЅРёР№
            </p>
            <p className="text-gray-400 text-sm">
              РЎРѕР·РґР°Р№С‚Рµ РїРµСЂРІРѕРµ Р·Р°РєР»СЋС‡РµРЅРёРµ, С‡С‚РѕР±С‹ РЅР°С‡Р°С‚СЊ СЂР°Р±РѕС‚Сѓ
            </p>
          </Card>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      в„– Р—Р°РєР»СЋС‡РµРЅРёСЏ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Р”Р°С‚Р°
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      РЎС‚Р°С‚СѓСЃ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      РџСЂРѕРіСЂРµСЃСЃ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Р”РµР№СЃС‚РІРёСЏ
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
                          РћС‚РєСЂС‹С‚СЊ
                        </button>
                        {report.status === "draft" && (
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            className="text-red-600 hover:text-red-900 hover:underline transition-colors"
                            disabled={deleteReportMutation.isPending}
                          >
                            РЈРґР°Р»РёС‚СЊ
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
                  в†ђ РќР°Р·Р°Рґ
                </Button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  РЎС‚СЂР°РЅРёС†Р° {currentPage} РёР· {pagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= pagination.totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                >
                  Р’РїРµСЂС‘Рґ в†’
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
