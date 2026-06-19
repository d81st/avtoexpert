import apiClient from "@/shared/api/client";
import type {
  PaginatedResponse,
  ReportsQueryParams,
} from "@/features/reports/api/reportApi";

export const adminService = {
  async getAllReports(
    params?: ReportsQueryParams,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
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

  async getReportDetails(id: string): Promise<Record<string, unknown>> {
    const response = await apiClient.get<Record<string, unknown>>(
      `/admin/reports/${id}`,
    );

    return response.data;
  },

  async getAllCreators(): Promise<
    Array<{ id: string; full_name: string; role: string; created_at: string }>
  > {
    const response =
      await apiClient.get<Array<Record<string, unknown>>>("/admin/creators");

    return response.data.map((creator) => ({
      id: creator.id as string,
      full_name: (creator.full_name ?? creator.fullName) as string,
      role: creator.role as string,
      created_at: (creator.created_at ?? creator.createdAt) as string,
    }));
  },

  async getTemplateInfo(): Promise<{
    exists: boolean;
    name: string;
    size: number;
    lastModified: string;
  }> {
    const response = await apiClient.get("/admin/template");
    return response.data;
  },
};
