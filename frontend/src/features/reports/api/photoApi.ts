import apiClient from "@/shared/api/client";
import type { ReportPhoto } from "../types";

export const photoService = {
  async getPhotos(reportId: string): Promise<ReportPhoto[]> {
    const response = await apiClient.get<{
      photos: Array<{ id: string; url: string; file_path?: string }>;
    }>(`/reports/${reportId}/photos`);

    // Load actual image blobs for each photo (auth required)
    const photos = await Promise.all(
      response.data.photos.map(async (photo) => {
        const blobUrl = await photoService.getPhotoBlobUrl(reportId, photo.id);
        return {
          id: photo.id,
          url: blobUrl,
          file_path: photo.file_path,
        };
      }),
    );

    return photos;
  },

  async getPhotoBlobUrl(reportId: string, photoId: string): Promise<string> {
    const response = await apiClient.get(
      `/reports/${reportId}/photos/${photoId}/file`,
      { responseType: "blob" },
    );
    return URL.createObjectURL(response.data as Blob);
  },

  async uploadPhotos(reportId: string, files: File[]): Promise<ReportPhoto[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append("photos", file));

    const response = await apiClient.post<{
      photos: Array<{ id: string; file_path: string }>;
    }>(`/reports/${reportId}/photos`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // Create local preview URLs for just-uploaded photos
    const uploadedPhotos: ReportPhoto[] = [];
    let fileIndex = 0;
    for (const photo of response.data.photos) {
      uploadedPhotos.push({
        id: photo.id,
        url: URL.createObjectURL(files[fileIndex]),
        file_path: photo.file_path,
      });
      fileIndex++;
    }

    return uploadedPhotos;
  },

  async deletePhoto(reportId: string, photoId: string): Promise<void> {
    await apiClient.delete(`/reports/${reportId}/photos/${photoId}`);
  },
};
