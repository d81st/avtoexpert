import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAdminReportsQuery } from "../model/adminQueries";
import { formatDate, formatProgress, formatSum } from "@/shared/lib/formatters";
import StatusBadge from "@/shared/ui/StatusBadge";
import Button from "@/shared/ui/Button";
import Loader from "@/shared/ui/Loader";
import Alert from "@/shared/ui/Alert";
import Card from "@/shared/ui/Card";

interface SearchForm {
  search: string;
}

export default function AdminReportsTab() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const { register, handleSubmit, reset } = useForm<SearchForm>({
    defaultValues: { search: "" },
  });
  const reportsQuery = useAdminReportsQuery({
    page: currentPage,
    search: searchQuery || undefined,
    limit: 20,
  });
  const reports = reportsQuery.data?.data ?? [];
  const pagination = reportsQuery.data?.pagination ?? null;
  const error =
    reportsQuery.error instanceof Error ? reportsQuery.error.message : null;

  const onSearch = handleSubmit(({ search }) => {
    setCurrentPage(1);
    setSearchQuery(search.trim());
  });

  const handleClearSearch = () => {
    reset({ search: "" });
    setCurrentPage(1);
    setSearchQuery("");
  };

  return (
    <>
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
          onClose={() => void reportsQuery.refetch()}
        />
      )}

      {reportsQuery.isLoading ? (
        <Loader message="Р—Р°РіСЂСѓР·РєР° Р·Р°РєР»СЋС‡РµРЅРёР№..." />
      ) : reports.length === 0 ? (
        <Card className="text-center">
          <p className="text-gray-500">Р—Р°РєР»СЋС‡РµРЅРёСЏ РЅРµ РЅР°Р№РґРµРЅС‹</p>
        </Card>
      ) : (
        <>
          <div className="data-table-wrap">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">в„–</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Р”Р°С‚Р°</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">РЎС‚Р°С‚СѓСЃ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">РџСЂРѕРіСЂРµСЃСЃ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Р“РѕСЃРЅРѕРјРµСЂ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Р’Р»Р°РґРµР»РµС†</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">РЎСѓРјРјР°</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Р”РµР№СЃС‚РІРёСЏ</th>
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
                        onClick={() => navigate(`/report/${report.id}`)}
                        className="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        РћС‚РєСЂС‹С‚СЊ
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
                onClick={() => setCurrentPage((page) => page - 1)}
              >
                в†ђ
              </Button>
              <span className="px-4 py-2 text-sm text-gray-600">
                {currentPage} РёР· {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= pagination.totalPages}
                onClick={() => setCurrentPage((page) => page + 1)}
              >
                в†’
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
