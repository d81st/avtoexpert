import apiClient from "@/services/api";
import type {
  Report,
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
} from "@/types";
import {
  toApiStep2,
  toApiStep3,
  toApiStep4,
  toApiAutosave,
  normalizeReport,
} from "@/utils/reportMapper";

export interface ReportsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "draft" | "completed";
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const reportService = {
  getReports: async (
    params?: ReportsQueryParams,
  ): Promise<PaginatedResponse<Report>> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.search) searchParams.set("search", params.search);
    if (params?.status) searchParams.set("status", params.status);

    const queryString = searchParams.toString();
    const url = queryString ? `/reports?${queryString}` : "/reports";

    const response =
      await apiClient.get<PaginatedResponse<Record<string, unknown>>>(url);
    return {
      data: response.data.data.map(normalizeReport),
      pagination: response.data.pagination,
    };
  },

  getReport: async (id: string): Promise<Record<string, unknown>> => {
    const response = await apiClient.get<Record<string, unknown>>(
      `/reports/${id}`,
    );
    return response.data;
  },

  createReport: async (step1Data: Step1Data): Promise<Report> => {
    const response = await apiClient.post<Record<string, unknown>>(
      "/reports",
      step1Data,
    );
    return normalizeReport({ ...response.data, ...step1Data });
  },

  updateStep2: async (id: string, step2Data: Step2Data): Promise<void> => {
    await apiClient.patch(`/reports/${id}/step-2`, toApiStep2(step2Data));
  },

  updateStep3: async (id: string, step3Data: Step3Data): Promise<void> => {
    await apiClient.patch(`/reports/${id}/step-3`, toApiStep3(step3Data));
  },

  updateStep4: async (id: string, step4Data: Step4Data): Promise<void> => {
    await apiClient.patch(`/reports/${id}/step-4`, toApiStep4(step4Data));
  },

  updateStep5: async (id: string, _step5Data: Step5Data): Promise<void> => {
    await apiClient.patch(`/reports/${id}/step-5`, { currentStep: 5 });
  },

  autosave: async (
    id: string,
    data: {
      step2?: Step2Data | null;
      step3?: Step3Data | null;
      step4?: Step4Data | null;
    },
  ): Promise<{ saved_at: string }> => {
    const response = await apiClient.patch<{ saved_at: string }>(
      `/reports/${id}/autosave`,
      toApiAutosave(data),
    );
    return response.data;
  },

  deleteReport: async (id: string): Promise<void> => {
    await apiClient.delete(`/reports/${id}`);
  },
};
