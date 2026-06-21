import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAdminReportsQuery } from "../model/adminQueries";
import { formatDate, formatProgress, formatSum } from "@/shared/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { getStatusConfig } from "@/lib/status-variants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppAlert } from "@/components/ui/app-alert";
import { Card, CardContent } from "@/components/ui/card";

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

  if (reportsQuery.isLoading) {
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
        onClose={() => void reportsQuery.refetch()}
      />
    );
  }

  return (
    <>
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

      {reports.length === 0 ? (
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-gray-500">Заключения не найдены</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>№</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Прогресс</TableHead>
                <TableHead>Госномер</TableHead>
                <TableHead>Владелец</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">
                    {report.reportNumber || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(report.reportDate)}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const { variant, label } = getStatusConfig(report.status);
                      return <Badge variant={variant}>{label}</Badge>;
                    })()}
                  </TableCell>
                  <TableCell>
                    {formatProgress(report.currentStep)}
                  </TableCell>
                  <TableCell>
                    {report.licensePlate || "-"}
                  </TableCell>
                  <TableCell>
                    {report.ownerName || "-"}
                  </TableCell>
                  <TableCell>
                    {formatSum(report.grandTotal)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-blue-600 hover:text-blue-900 p-0 h-auto"
                      onClick={() => navigate(`/report/${report.id}`)}
                    >
                      Открыть
                    </Button>
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
                ←
              </Button>
              <span className="px-4 py-2 text-sm text-gray-600">
                {currentPage} из {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= pagination.totalPages}
                onClick={() => setCurrentPage((page) => page + 1)}
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
