import { useState } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";
import {
  useDeleteReportMutation,
  useReportsQuery,
} from "../model/reportQueries";
import type { Report } from "../types";

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
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  searchQuery: string;
  onSearch: (e?: React.BaseSyntheticEvent) => Promise<void>;
  handleClearSearch: () => void;
  handleDeleteReport: (reportId: string) => Promise<void>;
  reportsQuery: ReturnType<typeof useReportsQuery>;
  deleteReportMutation: ReturnType<typeof useDeleteReportMutation>;
  register: UseFormRegister<SearchForm>;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

export function useDashboard(): UseDashboardReturn {
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

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Удалить это заключение?")) return;
    await deleteReportMutation.mutateAsync(reportId);
  };

  const error =
    reportsQuery.error instanceof Error
      ? reportsQuery.error.message
      : deleteReportMutation.error instanceof Error
        ? deleteReportMutation.error.message
        : null;

  return {
    reports,
    pagination,
    isLoading: reportsQuery.isLoading,
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
  };
}
