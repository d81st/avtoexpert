import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppAlert } from "@/components/ui/app-alert";
import { getStatusConfig } from "@/lib/status-variants";
import { formatDate, formatProgress } from "@/shared/lib/formatters";
import type { UseDashboardReturn } from "../hooks/useDashboard";
import type { Report } from "../types";

type Pagination = UseDashboardReturn["pagination"];

export interface DashboardTableAreaProps {
  /**
   * True only on the very first load when no cached data is available yet.
   * Drives skeleton rendering (AC 1.5, 1.8).
   */
  isInitialLoading: boolean;
  /**
   * Persistent error message shown inline when there is no cached data
   * to display (replaces main content; AC 5.11). Pass `null` to suppress.
   */
  error: string | null;
  reports: Report[];
  pagination: Pagination;
  currentPage: number;
  onPageChange: (page: number) => void;
  onDelete: (reportId: string) => void | Promise<void>;
  isDeletePending: boolean;
}

const SKELETON_ROWS = 5;

/**
 * Renders the list area of the Dashboard — skeleton, persistent error,
 * empty state, or the reports table — inside a single `<section>` whose
 * identity stays stable across state transitions. Header and search bar
 * live outside of this component so the search input is never unmounted
 * by a list-area state change (Requirement 1.5, 1.8, 5.11).
 */
function DashboardTableArea({
  isInitialLoading,
  error,
  reports,
  pagination,
  currentPage,
  onPageChange,
  onDelete,
  isDeletePending,
}: DashboardTableAreaProps) {
  const navigate = useNavigate();

  return (
    <section data-testid="dashboard-list-area">
      {isInitialLoading ? (
        <div className="space-y-3">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <AppAlert type="error" message={error} />
      ) : reports.length === 0 ? (
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-gray-500 text-lg mb-4">
              У вас пока нет заключений
            </p>
            <p className="text-gray-400 text-sm">
              Создайте первое заключение, чтобы начать работу
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>№ Заключения</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Прогресс</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => {
                const { variant, label } = getStatusConfig(report.status);
                return (
                  <TableRow
                    key={report.id}
                    className="hover:bg-blue-50/50 transition-colors duration-150"
                  >
                    <TableCell className="font-medium">
                      {report.report_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(report.report_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={variant}>{label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-blue-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full bg-gradient-to-r ${
                              report.current_step >= 5
                                ? "from-green-500 to-emerald-500"
                                : "from-blue-500 to-indigo-500"
                            }`}
                            style={{
                              width: `${(report.current_step / 5) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium">
                          {formatProgress(report.current_step)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="space-x-3">
                      <Button
                        variant="link"
                        size="sm"
                        className="text-blue-600 hover:text-blue-900 p-0 h-auto"
                        onClick={() => navigate(`/report/${report.id}`)}
                      >
                        Открыть
                      </Button>
                      {report.status === "draft" && (
                        <Button
                          variant="link"
                          size="sm"
                          className="text-red-600 hover:text-red-900 p-0 h-auto"
                          onClick={() => onDelete(report.id)}
                          disabled={isDeletePending}
                        >
                          Удалить
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                ← Назад
              </Button>
              <span className="px-4 py-2 text-sm text-gray-600">
                Страница {currentPage} из {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= pagination.totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                Вперёд →
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export { DashboardTableArea };
export default DashboardTableArea;
