import apiClient from "@/services/api";
import type { ReportPhoto } from "@/types";

const API_BASE = "/api";

export const photoService = {
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
};
