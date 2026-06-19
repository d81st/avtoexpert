import apiClient from "@/shared/api/client";
import type { Expert } from "../types";

export const expertService = {
  async getExperts(): Promise<Expert[]> {
    const response = await apiClient.get<Record<string, unknown>[]>("/experts");

    return response.data.map((expert) => ({
      id: (expert.id as string) || "",
      full_name: (expert.full_name ?? expert.fullName) as string,
    }));
  },

  async createExpert(fullName: string): Promise<Expert> {
    const response = await apiClient.post<Record<string, unknown>>("/experts", {
      full_name: fullName,
    });

    return {
      id: response.data.id as string,
      full_name: response.data.full_name as string,
    };
  },

  async updateExpert(id: string, fullName: string): Promise<Expert> {
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

  async deleteExpert(id: string): Promise<void> {
    await apiClient.delete(`/experts/${id}`);
  },
};
