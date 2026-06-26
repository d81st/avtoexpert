import apiClient from '@/shared/api/client';
import { downloadBlob } from '@/shared/lib/download';
import type { FinalizeResponse } from '../types';

export const documentService = {
  async finalizeAndGenerate(id: string): Promise<FinalizeResponse> {
    const response = await apiClient.post<FinalizeResponse>(`/reports/${id}/finalize-and-generate`);

    return response.data;
  },

  async downloadDocument(downloadUrl: string, filename: string): Promise<void> {
    await downloadBlob(downloadUrl, filename);
  },
};
