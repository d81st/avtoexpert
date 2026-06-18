import { create } from "zustand";
import type { Report, Expert } from "@/types";

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ReportState {
  reports: Report[];
  currentReport: Report | null;
  experts: Expert[];
  isLoading: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  setReports: (reports: Report[]) => void;
  setReportsWithPagination: (reports: Report[], pagination: PaginationInfo) => void;
  setCurrentReport: (report: Report | null) => void;
  setExperts: (experts: Expert[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  reports: [],
  currentReport: null,
  experts: [],
  isLoading: false,
  error: null,
  pagination: null,
  setReports: (reports) => set({ reports }),
  setReportsWithPagination: (reports, pagination) => set({ reports, pagination }),
  setCurrentReport: (report) => set({ currentReport: report }),
  setExperts: (experts) => set({ experts }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
