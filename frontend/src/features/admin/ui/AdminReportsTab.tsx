import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { AppAlert } from '@/components/ui/app-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useIsolatedField } from '@/features/reports/hooks/useIsolatedField';
import { getStatusConfig } from '@/lib/status-variants';
import { formatDate, formatProgress, formatSum } from '@/shared/lib/formatters';
import { useAdminReportsQuery } from '../model/adminQueries';

interface SearchForm {
  search: string;
}

/**
 * Isolated search input (Requirement 1.1, 1.3, 1.8).
 *
 * Registering through `useIsolatedField` keeps each keystroke confined to this
 * field's own subtree: the uncontrolled native handler updates the DOM `value`
 * without a parent `setState`, so typing never re-renders the reports table, the
 * pagination controls, or the surrounding form buttons.
 */
function ReportSearchField() {
  const field = useIsolatedField<SearchForm>('search');
  return (
    <Input
      type="text"
      placeholder="Поиск по номеру, госномеру, владельцу..."
      className="flex-1"
      {...field}
    />
  );
}

export default function AdminReportsTab() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const formMethods = useForm<SearchForm>({
    defaultValues: { search: '' },
  });
  const { handleSubmit, reset } = formMethods;
  const reportsQuery = useAdminReportsQuery({
    page: currentPage,
    search: searchQuery || undefined,
    limit: 20,
  });
  const reports = reportsQuery.data?.data ?? [];
  const pagination = reportsQuery.data?.pagination ?? null;
  const error = reportsQuery.error instanceof Error ? reportsQuery.error.message : null;

  const onSearch = handleSubmit(({ search }) => {
    setCurrentPage(1);
    setSearchQuery(search.trim());
  });

  const handleClearSearch = () => {
    reset({ search: '' });
    setCurrentPage(1);
    setSearchQuery('');
  };

  if (reportsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static fixed-length loading skeletons never reorder
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <AppAlert type="error" message={error} onClose={() => void reportsQuery.refetch()} />;
  }

  return (
    <>
      <FormProvider {...formMethods}>
        <form onSubmit={onSearch} className="mb-6 flex flex-col gap-2 sm:flex-row">
          <ReportSearchField />
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
      </FormProvider>

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
                  <TableCell className="font-medium">{report.reportNumber || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(report.reportDate)}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const { variant, label } = getStatusConfig(report.status);
                      return <Badge variant={variant}>{label}</Badge>;
                    })()}
                  </TableCell>
                  <TableCell>{formatProgress(report.currentStep)}</TableCell>
                  <TableCell>{report.licensePlate || '-'}</TableCell>
                  <TableCell>{report.ownerName || '-'}</TableCell>
                  <TableCell>{formatSum(report.grandTotal)}</TableCell>
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
