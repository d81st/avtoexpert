import apiClient from "./api";
import type {
  Expert,
  Report,
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
  ReportPhoto,
  FinalizeResponse,
} from "../types";
import {
  toApiStep2,
  toApiStep3,
  toApiStep4,
  toApiAutosave,
  normalizeReport,
} from "../utils/reportMapper";

const API_BASE = "/api";

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
  // === Эксперты ===

  getExperts: async (): Promise<Expert[]> => {
    const response = await apiClient.get<Record<string, unknown>[]>("/experts");
    return response.data.map((e) => ({
      id: (e.id as string) || "",
      full_name: (e.full_name ?? e.fullName) as string,
    }));
  },

  createExpert: async (fullName: string): Promise<Expert> => {
    const response = await apiClient.post<Record<string, unknown>>("/experts", {
      full_name: fullName,
    });
    return {
      id: response.data.id as string,
      full_name: response.data.full_name as string,
    };
  },

  updateExpert: async (id: string, fullName: string): Promise<Expert> => {
    const response = await apiClient.patch<Record<string, unknown>>(
      `/experts/${id}`,
      {
        full_name: fullName,
      },
    );
    return {
      id: response.data.id as string,
      full_name: response.data.full_name as string,
    };
  },

  deleteExpert: async (id: string): Promise<void> => {
    await apiClient.delete(`/experts/${id}`);
  },

  // === Заключения ===

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

  // === Фото ===

  getPhotos: async (reportId: string): Promise<ReportPhoto[]> => {
    const response = await apiClient.get<{
      photos: Array<{ id: string; url: string; file_path?: string }>;
    }>(`/reports/${reportId}/photos`);

    return response.data.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      file_path: photo.file_path,
    }));
  },

  uploadPhotos: async (
    reportId: string,
    files: File[],
  ): Promise<ReportPhoto[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append("photos", file));

    const response = await apiClient.post<{
      photos: Array<{ id: string; file_path: string }>;
    }>(`/reports/${reportId}/photos`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return response.data.photos.map((photo) => ({
      id: photo.id,
      url: `${API_BASE}/reports/${reportId}/photos/${photo.id}/file`,
      file_path: photo.file_path,
    }));
  },

  deletePhoto: async (reportId: string, photoId: string): Promise<void> => {
    await apiClient.delete(`/reports/${reportId}/photos/${photoId}`);
  },

  // === Генерация документа ===

  finalizeAndGenerate: async (id: string): Promise<FinalizeResponse> => {
    const response = await apiClient.post<FinalizeResponse>(
      `/reports/${id}/finalize-and-generate`,
    );
    return response.data;
  },

  downloadDocument: async (
    downloadUrl: string,
    filename: string,
  ): Promise<void> => {
    const url = downloadUrl;
    const token = localStorage.getItem("token");

    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error("Не удалось скачать документ");
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(objectUrl);
    document.body.removeChild(a);
  },

  // === Admin ===

  getAllReports: async (
    params?: ReportsQueryParams,
  ): Promise<PaginatedResponse<Record<string, unknown>>> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.search) searchParams.set("search", params.search);
    if (params?.status) searchParams.set("status", params.status);

    const queryString = searchParams.toString();
    const url = queryString
      ? `/admin/reports?${queryString}`
      : "/admin/reports";

    const response =
      await apiClient.get<PaginatedResponse<Record<string, unknown>>>(url);
    return response.data;
  },

  getReportDetails: async (id: string): Promise<Record<string, unknown>> => {
    const response = await apiClient.get<Record<string, unknown>>(
      `/admin/reports/${id}`,
    );
    return response.data;
  },

  getAllCreators: async (): Promise<
    Array<{ id: string; full_name: string; role: string; created_at: string }>
  > => {
    const response =
      await apiClient.get<Array<Record<string, unknown>>>("/admin/creators");
    return response.data.map((creator) => ({
      id: creator.id as string,
      full_name: (creator.full_name ?? creator.fullName) as string,
      role: creator.role as string,
      created_at: (creator.created_at ?? creator.createdAt) as string,
    }));
  },

  getTemplateInfo: async (): Promise<{
    exists: boolean;
    name: string;
    size: number;
    lastModified: string;
  }> => {
    const response = await apiClient.get("/admin/template");
    return response.data;
  },
};
