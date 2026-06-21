import { useAdminCreatorsQuery } from "../model/adminQueries";
import { formatDate } from "@/shared/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { AppAlert } from "@/components/ui/app-alert";

export default function AdminCreatorsTab() {
  const creatorsQuery = useAdminCreatorsQuery();
  const creators = creatorsQuery.data ?? [];
  const error =
    creatorsQuery.error instanceof Error ? creatorsQuery.error.message : null;

  if (creatorsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <AppAlert
        type="error"
        message={error}
        onClose={() => void creatorsQuery.refetch()}
      />
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Role
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Registered
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
                  {creator.role === "admin"
                    ? "Админ"
                    : "Создатель"}
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
  );
}
