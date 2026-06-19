import { useCallback, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { ACCEPTED_PHOTO_TYPES, MAX_PHOTOS } from "@/constants/reference";
import { useFormStore } from "../model/useFormStore";
import { useReportStore } from "../model/useReportStore";
import {
  useDeletePhotoMutation,
  usePhotosQuery,
  useUploadPhotosMutation,
} from "../model/reportQueries";
import type { ReportPhoto } from "../types";

export interface UsePhotoUploadReturn {
  photos: ReportPhoto[];
  uploading: boolean;
  uploadError: string | null;
  setUploadError: (error: string | null) => void;
  isDragging: boolean;
  handleFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (event: DragEvent) => void;
  handleDragLeave: () => void;
  handleDrop: (event: DragEvent) => void;
  removePhoto: (photo: ReportPhoto) => Promise<void>;
}

export function usePhotoUpload(): UsePhotoUploadReturn {
  const { setStep5 } = useFormStore();
  const { currentReport } = useReportStore();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const reportId = currentReport?.id;

  // Load photos via useQuery instead of useEffect
  const photosQuery = usePhotosQuery(reportId);
  const photos: ReportPhoto[] = photosQuery.data ?? [];

  const uploadMutation = useUploadPhotosMutation(reportId ?? "");
  const deleteMutation = useDeletePhotoMutation(reportId ?? "");

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!reportId) {
        setUploadError("Сначала сохраните шаг 1, чтобы загрузить фото");
        return;
      }

      const fileArray = Array.from(files);
      const remaining = MAX_PHOTOS - photos.length;

      if (fileArray.length > remaining) {
        setUploadError(
          `Можно загрузить ещё ${remaining} фото (максимум ${MAX_PHOTOS})`,
        );
        return;
      }

      const invalid = fileArray.filter(
        (file) =>
          !ACCEPTED_PHOTO_TYPES.includes(file.type) &&
          !file.name.match(/\.(jpe?g|png|heic|heif)$/i),
      );
      if (invalid.length > 0) {
        setUploadError("Допустимые форматы: JPG, PNG, HEIC");
        return;
      }

      setUploadError(null);

      try {
        const uploaded = await uploadMutation.mutateAsync(fileArray);
        const next = [...photos, ...uploaded];
        setStep5({ photos: next });
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : "Ошибка загрузки фото",
        );
      }
    },
    [photos, reportId, uploadMutation, setStep5],
  );

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      void uploadFiles(event.target.files);
      event.target.value = "";
    }
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) {
      void uploadFiles(event.dataTransfer.files);
    }
  };

  const removePhoto = async (photo: ReportPhoto) => {
    if (!reportId) return;

    try {
      await deleteMutation.mutateAsync(photo.id);
      const next = photos.filter((item) => item.id !== photo.id);
      setStep5({ photos: next });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Ошибка удаления фото",
      );
    }
  };

  return {
    photos,
    uploading: uploadMutation.isPending,
    uploadError,
    setUploadError,
    isDragging,
    handleFileInput,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removePhoto,
  };
}
