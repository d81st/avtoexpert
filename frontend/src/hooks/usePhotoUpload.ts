import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { ACCEPTED_PHOTO_TYPES, MAX_PHOTOS } from "@/constants/reference";
import { photoService } from "@/features/reports/api/photoApi";
import { useFormStore } from "@/store/useFormStore";
import { useReportStore } from "@/store/useReportStore";
import type { ReportPhoto } from "@/types";

export function usePhotoUpload() {
  const { step5, setStep5 } = useFormStore();
  const { currentReport } = useReportStore();
  const [photos, setPhotos] = useState<ReportPhoto[]>(step5?.photos || []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const reportId = currentReport?.id;

  useEffect(() => {
    if (!reportId) return;

    let cancelled = false;

    const loadPhotos = async () => {
      try {
        const loaded = await photoService.getPhotos(reportId);
        if (cancelled) return;
        setPhotos(loaded);
        setStep5({ photos: loaded });
      } catch {
        // Черновик без фото - нормальная ситуация.
      }
    };

    void loadPhotos();

    return () => {
      cancelled = true;
    };
  }, [reportId, setStep5]);

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

      setUploading(true);
      setUploadError(null);

      try {
        const uploaded = await photoService.uploadPhotos(reportId, fileArray);
        const next = [...photos, ...uploaded];
        setPhotos(next);
        setStep5({ photos: next });
      } catch (err) {
        setUploadError(
          err instanceof Error
            ? err.message
            : "Ошибка загрузки фото",
        );
      } finally {
        setUploading(false);
      }
    },
    [photos, reportId, setStep5],
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
      await photoService.deletePhoto(reportId, photo.id);
      const next = photos.filter((item) => item.id !== photo.id);
      setPhotos(next);
      setStep5({ photos: next });
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Ошибка удаления фото",
      );
    }
  };

  return {
    photos,
    uploading,
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
