import { useEffect, useState } from "react";
import { adminService } from "@/features/admin/api/adminApi";
import type { AdminCreator } from "@/features/admin/types";
import { formatDate } from "@/shared/lib/formatters";
import Loader from "@/shared/ui/Loader";
import Alert from "@/shared/ui/Alert";

export default function AdminCreatorsTab() {
  const [creators, setCreators] = useState<AdminCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCreators = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminService.getAllCreators();
      setCreators(data);
    } catch (err) {
      setError((err as Error).message || "Ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCreators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {isLoading ? (
        <Loader message="Загрузка создателей..." />
      ) : (
        <div className="data-table-wrap">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Имя
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Роль
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Дата регистрации
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {creators.map((creator) => (
                <tr key={creator.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">
                    {creator.full_name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        creator.role === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {creator.role === "admin" ? "Админ" : "Создатель"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(creator.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
