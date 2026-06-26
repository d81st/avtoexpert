import { create } from 'zustand';
import type { Report } from '../types';

interface ReportState {
  currentReport: Report | null;
  isLoading: boolean;
  error: string | null;
  setCurrentReport: (report: Report | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  currentReport: null,
  isLoading: false,
  error: null,
  setCurrentReport: (report) => set({ currentReport: report }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
