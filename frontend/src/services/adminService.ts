import apiClient from "@/services/api";
import type { PaginatedResponse, ReportsQueryParams } from "@/services/reportService";

export const adminService = {
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
