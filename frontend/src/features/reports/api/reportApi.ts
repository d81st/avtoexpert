import apiClient from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/api/types';
import {
  normalizeReport,
  toApiAutosave,
  toApiStep2,
  toApiStep3,
  toApiStep4,
} from '../lib/reportMapper';
import type { Report, Step1Data, Step2Data, Step3Data, Step4Data, Step5Data } from '../types';

export interface ReportsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'draft' | 'completed';
}

export const reportService = {
  async getReports(
    params?: ReportsQueryParams,
    config?: { background?: boolean; silent?: boolean },
  ): Promise<PaginatedResponse<Report>> {
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);

    const queryString = searchParams.toString();
    const url = queryString ? `/reports?${queryString}` : '/reports';
    const response = await apiClient.get<PaginatedResponse<Record<string, unknown>>>(url, config);

    return {
      data: response.data.data.map(normalizeReport),
      pagination: response.data.pagination,
    };
  },

  async getReport(id: string): Promise<Record<string, unknown>> {
    const response = await apiClient.get<Record<string, unknown>>(`/reports/${id}`);

    return response.data;
  },

  async createReport(step1Data: Step1Data): Promise<Report> {
    const response = await apiClient.post<Record<string, unknown>>('/reports', step1Data);

    return normalizeReport({ ...response.data, ...step1Data });
  },

  async updateStep2(id: string, step2Data: Step2Data): Promise<void> {
    await apiClient.patch(`/reports/${id}/step-2`, toApiStep2(step2Data));
  },

  async updateStep3(id: string, step3Data: Step3Data): Promise<void> {
    await apiClient.patch(`/reports/${id}/step-3`, toApiStep3(step3Data));
  },

  async updateStep4(id: string, step4Data: Step4Data): Promise<void> {
    await apiClient.patch(`/reports/${id}/step-4`, toApiStep4(step4Data));
  },

  async updateStep5(id: string, step5Data: Step5Data): Promise<void> {
    void step5Data;
    await apiClient.patch(`/reports/${id}/step-5`, { currentStep: 5 });
  },

  async autosave(
    id: string,
    payload: {
      step2?: Step2Data | null;
      step3?: Step3Data | null;
      step4?: Step4Data | null;
    },
    config?: { background?: boolean; silent?: boolean },
  ): Promise<{ saved_at: string }> {
    const response = await apiClient.patch<{ saved_at: string }>(
      `/reports/${id}/autosave`,
      toApiAutosave(payload),
      config,
    );

    return response.data;
  },

  /**
   * Dirty-field autosave for Smart_Autosave (Requirement 2).
   *
   * Unlike {@link reportService.autosave}, which groups `step2`/`step3`/`step4`
   * snapshots through `toApiAutosave`, this method forwards the already-flat
   * Autosave_Payload built by the coordinator verbatim. The backend endpoint
   * `PATCH /api/reports/:id/autosave` accepts an arbitrary subset of fields via
   * `autosaveSchema.passthrough()`, so no transformation is applied here.
   *
   * Accepts an optional `signal` so the coordinator can enforce its 30 s
   * `AbortController` timeout (AC 2.9 timeout branch is wired downstream).
   */
  async autosaveDirty(
    id: string,
    payload: Record<string, unknown>,
    config?: { background?: boolean; silent?: boolean; signal?: AbortSignal },
  ): Promise<{ saved_at: string }> {
    const response = await apiClient.patch<{ saved_at: string }>(
      `/reports/${id}/autosave`,
      payload,
      config,
    );

    return response.data;
  },

  async deleteReport(id: string): Promise<void> {
    await apiClient.delete(`/reports/${id}`);
  },
};
