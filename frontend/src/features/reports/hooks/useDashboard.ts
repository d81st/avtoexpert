import { useEffect, useState } from 'react';
import { type UseFormRegister, useForm, useWatch } from 'react-hook-form';
import { useDeleteReportMutation, useReportsQuery } from '../model/reportQueries';
import type { Report } from '../types';

const SEARCH_DEBOUNCE_MS = 300;

interface SearchForm {
  search: string;
}

interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface UseDashboardReturn {
  reports: Report[];
  pagination: Pagination | null;
  /**
   * @deprecated Prefer `isInitialLoading` for skeleton rendering. Mirrors
   * `reportsQuery.isLoading` and is retained for backward compatibility.
   */
  isLoading: boolean;
  /**
   * True only during the very first load when no cached data is available
   * yet (`reportsQuery.isLoading && !reportsQuery.data`). Stays `false` on
   * subsequent refetches caused by search/page changes once `keepPreviousData`
   * is in effect, so the Search_Input remains mounted across queryKey
   * transitions (AC 1.5, 1.7, 1.8).
   */
  isInitialLoading: boolean;
  error: string | null;
  currentPage: number;
  searchQuery: string;
  handleClearSearch: () => void;
  handleDeleteReport: (reportId: string) => Promise<void>;
  reportsQuery: ReturnType<typeof useReportsQuery>;
  deleteReportMutation: ReturnType<typeof useDeleteReportMutation>;
  register: UseFormRegister<SearchForm>;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

export function useDashboard(): UseDashboardReturn {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const { register, control, reset } = useForm<SearchForm>({
    defaultValues: { search: '' },
  });

  // Live-source of the search input. `useWatch` re-renders on every keystroke.
  const watchedSearch = useWatch({ control, name: 'search' }) ?? '';
  const trimmed = watchedSearch.trim();

  // Debounced commit: the trimmed input becomes the active `searchQuery`
  // after SEARCH_DEBOUNCE_MS of inactivity. When trimmed already equals the
  // committed value, skip scheduling so we don't trigger redundant requests.
  useEffect(() => {
    if (trimmed === searchQuery) return;

    const timer = setTimeout(() => {
      setSearchQuery(trimmed);
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed, searchQuery]);

  const reportsQuery = useReportsQuery({
    page: currentPage,
    search: searchQuery || undefined,
    limit: 20,
  });

  const deleteReportMutation = useDeleteReportMutation();

  const reports = reportsQuery.data?.data ?? [];
  const pagination = reportsQuery.data?.pagination ?? null;

  const handleClearSearch = () => {
    reset({ search: '' });
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Удалить это заключение?')) return;
    await deleteReportMutation.mutateAsync(reportId);
  };

  const error =
    reportsQuery.error instanceof Error
      ? reportsQuery.error.message
      : deleteReportMutation.error instanceof Error
        ? deleteReportMutation.error.message
        : null;

  // AC 1.5, 1.7, 1.8: distinguish the very first load (no cached data) from
  // a refetch that occurs after a queryKey change. With `keepPreviousData`
  // enabled in `useReportsQuery`, `reportsQuery.data` is preserved across
  // search/page transitions, so `isInitialLoading` flips back to `false`
  // once any data has been observed — keeping the Search_Input mounted.
  const isInitialLoading = reportsQuery.isLoading && !reportsQuery.data;

  return {
    reports,
    pagination,
    isLoading: reportsQuery.isLoading,
    isInitialLoading,
    error,
    currentPage,
    searchQuery,
    handleClearSearch,
    handleDeleteReport,
    reportsQuery,
    deleteReportMutation,
    register,
    setCurrentPage,
  };
}
