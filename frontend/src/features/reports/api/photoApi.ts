import apiClient from '@/shared/api/client';
import type { ReportPhoto } from '../types';

/** Per-request overrides shared across photo endpoints (mirrors `reportApi`). */
type PhotoRequestConfig = { background?: boolean; silent?: boolean };

/**
 * Body shape accepted by `PATCH /api/reports/:reportId/photos/:photoId`
 * (Requirement 8.1–8.4). Mirrors the server `photoPatchSchema` — at least one
 * of `caption` / `position` must be present; an empty body is rejected with
 * HTTP 400 (`empty_patch_body`).
 *
 * - `caption`: `null` clears the caption; a string up to 200 NFC code points
 *   (R8.1) sets a new caption. Longer strings are rejected by the server with
 *   `caption_too_long_200`.
 * - `position`: integer in `[1, 20]` (R8.2). The server runs the transactional
 *   reorder algorithm so the set of positions for the report remains
 *   `{1, …, k}` after every successful PATCH (R8.4).
 */
export interface PhotoPatch {
  caption?: string | null;
  position?: number;
}

/**
 * Subset of the PATCH success body we consume on the client. The server returns
 * the updated row (design.md §3.8 PhotoPatchResponse) — we only forward the
 * caption/position fields plus the id, since the blob URL is owned locally and
 * does not need refreshing on metadata-only updates.
 */
interface PhotoPatchServerResponse {
  id: string;
  caption: string | null;
  position: number;
  sequence_number?: number;
}

export const photoService = {
  async getPhotos(reportId: string): Promise<ReportPhoto[]> {
    const response = await apiClient.get<{
      photos: Array<{
        id: string;
        url: string;
        file_path?: string;
        sequence_number?: number;
        caption?: string | null;
        position?: number;
      }>;
    }>(`/reports/${reportId}/photos`);

    // Load actual image blobs for each photo (auth required). The server sorts
    // the array by `position` ASC once task 19.8 lands (R8.10); until then the
    // order is `sequence_number` ASC (R4.6). Either way the array order is the
    // visual display order — we preserve it as-is and forward `caption` /
    // `position` for the metadata UI introduced by task 19.18.
    const photos = await Promise.all(
      response.data.photos.map(async (photo) => {
        const blobUrl = await photoService.getPhotoBlobUrl(reportId, photo.id);
        return {
          id: photo.id,
          url: blobUrl,
          file_path: photo.file_path,
          sequence_number: photo.sequence_number,
          caption: photo.caption,
          position: photo.position,
        };
      }),
    );

    return photos;
  },

  async getPhotoBlobUrl(reportId: string, photoId: string): Promise<string> {
    const response = await apiClient.get(`/reports/${reportId}/photos/${photoId}/file`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(response.data as Blob);
  },

  async uploadPhotos(
    reportId: string,
    files: File[],
    config?: PhotoRequestConfig,
  ): Promise<ReportPhoto[]> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('photos', file);
    });

    const response = await apiClient.post<{
      photos: Array<{ id: string; file_path: string; sequence_number?: number }>;
    }>(`/reports/${reportId}/photos`, formData, {
      ...config,
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    // Create local preview URLs for just-uploaded photos
    const uploadedPhotos: ReportPhoto[] = [];
    let fileIndex = 0;
    for (const photo of response.data.photos) {
      uploadedPhotos.push({
        id: photo.id,
        url: URL.createObjectURL(files[fileIndex]),
        file_path: photo.file_path,
        sequence_number: photo.sequence_number,
      });
      fileIndex++;
    }

    return uploadedPhotos;
  },

  async deletePhoto(reportId: string, photoId: string, config?: PhotoRequestConfig): Promise<void> {
    await apiClient.delete(`/reports/${reportId}/photos/${photoId}`, config);
  },

  /**
   * `PATCH /api/reports/:reportId/photos/:photoId` — updates a Photo_Asset's
   * caption and/or display position (Requirement 8.1–8.4). At least one of
   * `caption` / `position` must be present; the server runs the transactional
   * reorder for position updates so the set of positions for the report
   * remains `{1, …, k}` after every successful patch (R8.4). On any failure
   * (`400`, `404`, `500`) the server's transaction is rolled back byte-for-byte
   * and this method rejects with the original `AxiosError` for the caller to
   * handle (e.g. optimistic-update rollback in PhotoUploader).
   */
  async patchPhoto(
    reportId: string,
    photoId: string,
    patch: PhotoPatch,
    config?: PhotoRequestConfig,
  ): Promise<PhotoPatchServerResponse> {
    const response = await apiClient.patch<PhotoPatchServerResponse>(
      `/reports/${reportId}/photos/${photoId}`,
      patch,
      config,
    );
    return response.data;
  },
};
