import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { notify } from '@/shared/notifications/notify';
import { type PhotoPatch, photoService } from '../api/photoApi';
import { useDebouncedSideEffect } from '../hooks/useDebouncedSideEffect';
import {
  PHOTO_MIME_WHITELIST,
  type ValidationReason,
  validatePhotoFile,
} from '../lib/photoClientValidator';
import { reportQueryKeys, usePhotosQuery } from '../model/reportQueries';
import type { ReportPhoto } from '../types';

/**
 * Maximum number of Photo_Asset persisted per report (R4.11). Mirrors the server
 * constant `PHOTO_MAX_PER_REPORT` (`backend/src/modules/reports/photoValidator.ts`).
 * The server remains the source of truth; this client-side bound only avoids
 * obviously-doomed uploads and gives fast inline feedback.
 */
export const PHOTO_MAX_PER_REPORT = 20;

/**
 * Maximum caption length in Unicode code points after NFC normalisation (R8.1).
 * Mirrors the server `photoPatchSchema` upper bound.
 */
export const PHOTO_CAPTION_MAX_LEN = 200;

/**
 * Debounce window for caption PATCH requests. Matches the 300–500 ms guidance
 * for `useDebouncedSideEffect` (R1.4) so keystrokes never block the input.
 */
const CAPTION_PATCH_DEBOUNCE_MS = 400;

const ACCEPT_ATTR = PHOTO_MIME_WHITELIST.join(',');

/**
 * User-facing rejection messages for the client validator (R4.4). Each maps a
 * {@link ValidationReason} to a Russian Notification_System message (≤200 chars,
 * AC 5.1).
 */
const REASON_MESSAGES: Record<ValidationReason, string> = {
  mime_not_allowed: 'Неподдерживаемый формат. Разрешены PNG, JPEG и WebP.',
  magic_mismatch: 'Файл повреждён или его содержимое не соответствует формату.',
  corrupt: 'Не удалось прочитать файл — возможно, он повреждён.',
  empty: 'Файл пустой (0 байт) и не может быть загружен.',
  too_large: 'Файл превышает максимальный размер 10 МБ.',
};

/**
 * Maps a failed server upload/delete response to a user-facing message. The
 * server is authoritative: it re-validates MIME/magic/size (413/415, R4.5,
 * R4.12) and enforces the 20-photo limit (400, R4.11). Requests are issued
 * `silent` so the global axios interceptor does not also toast — this component
 * owns the messaging.
 */
export function serverErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 413) {
      return 'Сервер отклонил файл: превышен максимальный размер 10 МБ.';
    }
    if (status === 415) {
      return 'Сервер отклонил файл: неподдерживаемый формат или повреждённое изображение.';
    }
    if (status === 400) {
      return `Достигнут лимит в ${PHOTO_MAX_PER_REPORT} фотографий для этого заключения.`;
    }
    if (typeof error.message === 'string' && error.message.length > 0) {
      return error.message;
    }
  }
  return fallback;
}

/**
 * Maps a failed `PATCH /photos/:id` response to a user-facing message for the
 * Notification_System (Requirement 8.1, 8.2, 8.10). Reads the Zod
 * `flatten().fieldErrors` shape produced by the shared `validate` middleware
 * (see `backend/src/common/middleware/errorHandler.ts`) so caption-length and
 * position-range violations surface their specific code; 404 collapses the
 * three-way ownership / not-found / URL-mismatch case per design §3.8.
 */
export function patchErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 404) {
      return 'Фотография не найдена.';
    }
    if (status === 400) {
      const data = error.response?.data as
        | {
            details?: {
              fieldErrors?: Record<string, string[] | undefined>;
              formErrors?: string[];
            };
          }
        | undefined;
      const fieldErrors = data?.details?.fieldErrors;
      const formErrors = data?.details?.formErrors;
      const flat = [
        ...(fieldErrors?.caption ?? []),
        ...(fieldErrors?.position ?? []),
        ...(formErrors ?? []),
      ];
      if (flat.some((code) => code === 'caption_too_long_200')) {
        return `Подпись не может быть длиннее ${PHOTO_CAPTION_MAX_LEN} символов.`;
      }
      if (flat.some((code) => code === 'position_out_of_range')) {
        return `Допустимая позиция: от 1 до ${PHOTO_MAX_PER_REPORT}.`;
      }
      if (flat.some((code) => code === 'position_must_be_integer')) {
        return 'Позиция должна быть целым числом.';
      }
      if (flat.some((code) => code === 'empty_patch_body')) {
        return 'Не указано поле для обновления.';
      }
      return 'Неверные данные для обновления фотографии.';
    }
    if (status === 500) {
      return 'Не удалось сохранить изменения. Попробуйте ещё раз.';
    }
  }
  return 'Не удалось сохранить изменения. Попробуйте ещё раз.';
}

/** Counts Unicode code points in a string (matches the server R8.1 oracle). */
function codePointLength(value: string): number {
  let n = 0;
  for (const _ of value) n++;
  return n;
}

export interface PhotoUploaderProps {
  /** The report whose photos are being managed. */
  reportId: string;
}

/**
 * Photo_Upload UI (Requirement 4 + Requirement 8): drag-and-drop area + file
 * picker, per-file client validation (R4.4), thumbnail list, per-photo delete
 * (R4.10), caption editing with a 200-char counter (R8.1), and ↑/↓ reorder
 * controls (R8.2, R8.10). Caption + position updates are persisted via
 * `PATCH /api/reports/:reportId/photos/:photoId` with optimistic-then-rollback
 * semantics — the local order/caption is applied immediately for snappy
 * feedback, and on any non-2xx server response the pre-mutation state is
 * restored byte-for-byte and a `sonner.error` toast is raised (R8.4 transaction
 * invariant on the client side).
 */
function PhotoUploader({ reportId }: PhotoUploaderProps) {
  const inputId = useId();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);

  const photosQuery = usePhotosQuery(reportId);
  const photos: ReportPhoto[] = photosQuery.data ?? [];

  const photosKey: QueryKey = reportQueryKeys.photos(reportId);

  const invalidatePhotos = useCallback(
    () => queryClient.invalidateQueries({ queryKey: photosKey }),
    [queryClient, photosKey],
  );

  const uploadMutation = useMutation({
    // `silent: true` suppresses the global interceptor toast so this component is
    // the single source of error messaging (R4.4, R4.11, R4.12).
    mutationFn: (files: File[]) => photoService.uploadPhotos(reportId, files, { silent: true }),
    onSuccess: () => {
      void invalidatePhotos();
    },
    onError: (error) => {
      notify.error(serverErrorMessage(error, 'Не удалось загрузить фотографии.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => photoService.deletePhoto(reportId, photoId, { silent: true }),
    onSuccess: () => {
      void invalidatePhotos();
    },
    onError: (error) => {
      notify.error(serverErrorMessage(error, 'Не удалось удалить фотографию.'));
    },
  });

  /**
   * Optimistic PATCH mutation for caption + position. The caller supplies a
   * pure cache-updater (`optimisticUpdater`) describing the desired post-PATCH
   * state of the `ReportPhoto[]` cache. `onMutate` snapshots the previous
   * cache and applies the updater immediately so the UI updates without
   * waiting for the network round-trip. On any non-2xx response `onError`
   * restores the snapshot byte-for-byte and surfaces a sonner.error toast —
   * matching the server's "either fully applied or fully rolled back"
   * transactional invariant (R8.4).
   */
  const patchMutation = useMutation<
    unknown,
    unknown,
    {
      photoId: string;
      patch: PhotoPatch;
      optimisticUpdater: (prev: ReportPhoto[]) => ReportPhoto[];
    },
    { previous: ReportPhoto[] }
  >({
    mutationFn: ({ photoId, patch }) =>
      photoService.patchPhoto(reportId, photoId, patch, { silent: true }),
    onMutate: async ({ optimisticUpdater }) => {
      await queryClient.cancelQueries({ queryKey: photosKey });
      const previous = queryClient.getQueryData<ReportPhoto[]>(photosKey) ?? [];
      queryClient.setQueryData<ReportPhoto[]>(photosKey, optimisticUpdater(previous));
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context) {
        queryClient.setQueryData<ReportPhoto[]>(photosKey, context.previous);
      }
      notify.error(patchErrorMessage(error));
    },
  });

  const uploading = uploadMutation.isPending;
  const atLimit = photos.length >= PHOTO_MAX_PER_REPORT;

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) {
        return;
      }

      // R4.11 (client pre-check) — reject the whole batch if it would exceed the
      // 20-photo limit; the server re-enforces this authoritatively.
      const remaining = PHOTO_MAX_PER_REPORT - photos.length;
      if (files.length > remaining) {
        notify.error(
          remaining <= 0
            ? `Достигнут лимит в ${PHOTO_MAX_PER_REPORT} фотографий.`
            : `Можно добавить ещё ${remaining} фото (максимум ${PHOTO_MAX_PER_REPORT}).`,
        );
        return;
      }

      // R4.4 — per-file client validation; surface each rejection via toast.
      const valid: File[] = [];
      for (const file of files) {
        const result = await validatePhotoFile(file);
        if (result.ok) {
          valid.push(file);
        } else {
          const reason = result.reason ?? 'corrupt';
          notify.error(`«${file.name}»: ${REASON_MESSAGES[reason]}`);
        }
      }

      if (valid.length > 0) {
        uploadMutation.mutate(valid);
      }
    },
    [photos.length, uploadMutation],
  );

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      void processFiles(event.target.files);
      // Reset so selecting the same file again re-triggers `onChange`.
      event.target.value = '';
    }
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (!atLimit && !uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (atLimit || uploading) {
      return;
    }
    if (event.dataTransfer.files.length > 0) {
      void processFiles(event.dataTransfer.files);
    }
  };

  const handleDelete = (photo: ReportPhoto) => {
    deleteMutation.mutate(photo.id);
  };

  /**
   * Patches the caption for a single photo. The optimistic updater rewrites
   * the matching row's `caption` so the cache mirrors the user's input even
   * before the server responds; on PATCH failure the previous cache is
   * restored and a toast surfaces the specific reason (R8.1).
   */
  const handleCaptionPatch = useCallback(
    (photoId: string, newCaption: string) => {
      patchMutation.mutate({
        photoId,
        patch: { caption: newCaption.length === 0 ? null : newCaption },
        optimisticUpdater: (prev) =>
          prev.map((p) =>
            p.id === photoId ? { ...p, caption: newCaption.length === 0 ? null : newCaption } : p,
          ),
      });
    },
    [patchMutation],
  );

  /**
   * Reorders a photo by one slot in the given direction (R8.2). The
   * optimistic updater swaps the photo with its neighbour and renumbers every
   * row's `position` so the multiset is `{1..k}` — exactly what the server
   * will produce after the transactional reorder runs (R8.4). On PATCH
   * failure the cache is restored to the pre-click array and order.
   */
  const handleMove = useCallback(
    (photoId: string, direction: 'up' | 'down') => {
      const currentIndex = photos.findIndex((p) => p.id === photoId);
      if (currentIndex < 0) return;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= photos.length) return;
      const newPosition = targetIndex + 1; // 1-based, R8.2

      patchMutation.mutate({
        photoId,
        patch: { position: newPosition },
        optimisticUpdater: (prev) => {
          const idx = prev.findIndex((p) => p.id === photoId);
          if (idx < 0) return prev;
          const tgt = direction === 'up' ? idx - 1 : idx + 1;
          if (tgt < 0 || tgt >= prev.length) return prev;
          const next = prev.slice();
          const tmp = next[idx];
          next[idx] = next[tgt];
          next[tgt] = tmp;
          // Renumber positions 1..k to mirror the server's invariant (R8.4).
          return next.map((p, i) => ({ ...p, position: i + 1 }));
        },
      });
    },
    [patchMutation, photos],
  );

  return (
    <div className="space-y-4">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop dropzone enhancement; the keyboard-accessible path is the labeled file input below */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          onChange={handleFileInput}
          className="hidden"
          id={inputId}
          disabled={uploading || atLimit}
        />
        <label
          htmlFor={inputId}
          className={`block cursor-pointer ${
            uploading || atLimit ? 'cursor-not-allowed opacity-50' : ''
          }`}
        >
          <p className="font-medium text-gray-700">
            {uploading ? 'Загрузка...' : 'Перетащите файлы или нажмите для выбора'}
          </p>
          <p className="mt-2 text-xs text-gray-500">PNG, JPEG, WebP — до 10 МБ каждый</p>
          <p className="mt-3 text-sm font-medium text-blue-600">
            Загружено: {photos.length} из {PHOTO_MAX_PER_REPORT}
          </p>
        </label>
      </div>

      {photos.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {photos.map((photo, index) => (
            <PhotoThumbnailCard
              key={photo.id}
              photo={photo}
              index={index}
              total={photos.length}
              onCaptionPatch={handleCaptionPatch}
              onMoveUp={() => handleMove(photo.id, 'up')}
              onMoveDown={() => handleMove(photo.id, 'down')}
              onDelete={() => handleDelete(photo)}
              deleteDisabled={deleteMutation.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface PhotoThumbnailCardProps {
  photo: ReportPhoto;
  /** Zero-based index in the displayed array; drives ↑/↓ disabled state. */
  index: number;
  total: number;
  onCaptionPatch: (photoId: string, newCaption: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  deleteDisabled: boolean;
}

/**
 * One thumbnail in the Photo_Upload grid. Owns its own local caption state so
 * keystrokes never go through the React Query cache (R1.4 debounced
 * side-effect, R8.1). The parent's optimistic-update path keeps the cache in
 * sync after each debounced PATCH; on rollback the cache reverts (toast
 * surfaces the error) and the local input intentionally keeps the user's
 * typed text so they can correct and retry without re-typing — the cache is
 * the authoritative truth and will re-seed the input on the next refetch.
 */
function PhotoThumbnailCard({
  photo,
  index,
  total,
  onCaptionPatch,
  onMoveUp,
  onMoveDown,
  onDelete,
  deleteDisabled,
}: PhotoThumbnailCardProps) {
  const captionInputId = useId();
  const ordinal = photo.position ?? photo.sequence_number ?? index + 1;
  const altText = `Фото ${ordinal}`;

  const [caption, setCaption] = useState<string>(photo.caption ?? '');
  const pendingRef = useRef(false);

  // Re-seed the local input from the server when the cache caption changes
  // (e.g. an external refetch after a fresh upload or a sibling action) and
  // the user is not mid-edit. On a rollback the cache reverts but React 18 +
  // React Query may batch the optimistic and rollback writes into a single
  // observer notification, so this effect intentionally does NOT see a
  // 'old → new → old' transition. That is fine — keeping the user's typed
  // text after a rejected PATCH is the better UX (see component docs).
  useEffect(() => {
    if (!pendingRef.current) {
      setCaption(photo.caption ?? '');
    }
  }, [photo.caption]);

  const debouncedPatch = useDebouncedSideEffect((value: string) => {
    pendingRef.current = false;
    onCaptionPatch(photo.id, value);
  }, CAPTION_PATCH_DEBOUNCE_MS);

  const handleCaptionChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCaption(value);
    // Code-point length is the authoritative R8.1 measure; the HTML maxLength
    // attribute below is a UTF-16 belt-and-suspenders. If the user still
    // manages to paste a longer value (some browsers do not enforce maxLength
    // on paste), skip scheduling the PATCH and surface the toast locally —
    // mirrors the server's `caption_too_long_200` rejection.
    if (codePointLength(value) > PHOTO_CAPTION_MAX_LEN) {
      pendingRef.current = false;
      notify.error(`Подпись не может быть длиннее ${PHOTO_CAPTION_MAX_LEN} символов.`);
      return;
    }
    pendingRef.current = true;
    debouncedPatch(value);
  };

  const captionLen = codePointLength(caption);
  const counterCritical = captionLen >= PHOTO_CAPTION_MAX_LEN;

  return (
    <li className="group relative rounded-lg border-2 border-gray-200 bg-white p-2">
      <div className="relative">
        <img src={photo.url} alt={altText} className="h-36 w-full rounded object-cover" />
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
          {ordinal}
        </span>
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            aria-label={`Переместить «${altText}» вверх`}
            onClick={onMoveUp}
            disabled={index === 0}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-700 text-white disabled:opacity-40"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Переместить «${altText}» вниз`}
            onClick={onMoveDown}
            disabled={index >= total - 1}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-700 text-white disabled:opacity-40"
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={`Удалить ${altText.toLowerCase()}`}
            onClick={onDelete}
            disabled={deleteDisabled}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white disabled:opacity-50"
          >
            ×
          </button>
        </div>
      </div>

      <div className="mt-2">
        <label htmlFor={captionInputId} className="sr-only">
          Подпись к {altText.toLowerCase()}
        </label>
        <input
          id={captionInputId}
          type="text"
          value={caption}
          onChange={handleCaptionChange}
          maxLength={PHOTO_CAPTION_MAX_LEN}
          placeholder="Подпись (необязательно)"
          aria-label={`Подпись к ${altText.toLowerCase()}`}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
        <p
          className={`mt-1 text-right text-xs ${
            counterCritical ? 'text-red-600' : 'text-gray-500'
          }`}
          aria-live="polite"
        >
          {captionLen} / {PHOTO_CAPTION_MAX_LEN}
        </p>
      </div>
    </li>
  );
}

export default PhotoUploader;
