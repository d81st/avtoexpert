import apiClient from "@/services/api";
import type { FinalizeResponse } from "@/types";
import { downloadBlob } from "@/utils/download";

export const documentService = {
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
    await downloadBlob(downloadUrl, filename);
  },
};
