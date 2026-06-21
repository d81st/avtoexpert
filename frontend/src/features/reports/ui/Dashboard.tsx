import { useNavigate } from "react-router-dom";
import { useDashboard } from "../hooks/useDashboard";
import { formatDate, formatProgress } from "@/shared/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { getStatusConfig } from "@/lib/status-variants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppAlert } from "@/components/ui/app-alert";
import { Card, CardContent } from "@/components/ui/card";
import AppLayout from "@/app/routing/AppLayout";

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
    return (
      <AppLayout>
        <div className="space-y-3">
          <Skeleton className="h-10 w-1/3" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </AppLayout>
    );
  }

  if (error && reports.length === 0) {
    return <AppAlert type="error" message={error} />;
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
          <Button onClick={() => navigate("/report/new")} size="lg">
            + Создать заключение
          </Button>
        </div>

        <form onSubmit={onSearch} className="mb-6 flex flex-col gap-2 sm:flex-row">
          <Input
            type="text"
            placeholder="Поиск по номеру, госномеру, владельцу..."
            className="flex-1"
            {...register("search")}
          />
          <Button type="submit" variant="outline" disabled={reportsQuery.isFetching}>
            {reportsQuery.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Найти
          </Button>
          {searchQuery && (
            <Button type="button" variant="outline" onClick={handleClearSearch}>
              Сбросить
            </Button>
          )}
        </form>

        {error && (
          <AppAlert
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
                {reports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                    <TableCell className="font-medium">
                      {report.report_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(report.report_date)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const { variant, label } = getStatusConfig(report.status);
                        return <Badge variant={variant}>{label}</Badge>;
                      })()}
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
                          onClick={() => handleDeleteReport(report.id)}
                          disabled={deleteReportMutation.isPending}
                        >
                          Удалить
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  variant="outline"
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
                  variant="outline"
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
