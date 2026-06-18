import apiClient from "@/services/api";
import type { Expert } from "@/types";

export const expertService = {
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
};
