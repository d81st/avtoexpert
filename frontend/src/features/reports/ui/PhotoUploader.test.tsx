import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks -----------------------------------------------------------------

const notifyError = vi.fn();
vi.mock('@/shared/notifications/notify', () => ({
  notify: {
    error: (msg: string) => notifyError(msg),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const getPhotos = vi.fn();
const uploadPhotos = vi.fn();
const deletePhoto = vi.fn();
const patchPhoto = vi.fn();
vi.mock('../api/photoApi', () => ({
  photoService: {
    getPhotos: (...args: unknown[]) => getPhotos(...args),
    uploadPhotos: (...args: unknown[]) => uploadPhotos(...args),
    deletePhoto: (...args: unknown[]) => deletePhoto(...args),
    patchPhoto: (...args: unknown[]) => patchPhoto(...args),
  },
}));

import type { ReportPhoto } from '../types';
import PhotoUploader, {
  PHOTO_CAPTION_MAX_LEN,
  PHOTO_MAX_PER_REPORT,
  patchErrorMessage,
  serverErrorMessage,
} from './PhotoUploader';

function renderUploader(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  render(<PhotoUploader reportId="report-1" />, { wrapper });
  return queryClient;
}

/** Builds a `File` whose first bytes match the given magic signature. */
function makeFile(name: string, type: string, magic: number[], totalBytes = 64): File {
  const bytes = new Uint8Array(totalBytes);
  bytes.set(magic, 0);
  return new File([bytes], name, { type });
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function axiosErrorWithStatus(status: number, data: unknown = {}): AxiosError {
  const err = new AxiosError('boom');
  err.response = {
    status,
    statusText: '',
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return err;
}

beforeEach(() => {
  getPhotos.mockResolvedValue([]);
  uploadPhotos.mockResolvedValue([]);
  deletePhoto.mockResolvedValue(undefined);
  patchPhoto.mockResolvedValue({ id: 'a', caption: null, position: 1 });
});

afterEach(() => {
  // Tear down the React tree before clearing mocks so a test that timed out
  // mid-mutation cannot fire onError into the next test's `notifyError` mock.
  cleanup();
  vi.clearAllMocks();
});

describe('PhotoUploader', () => {
  it('renders the dropzone with a file picker and an upload counter (R4.1)', async () => {
    renderUploader();
    await waitFor(() => {
      expect(screen.getByText(`Загружено: 0 из ${PHOTO_MAX_PER_REPORT}`)).not.toBeNull();
    });
    // file picker input present and accepts the photo whitelist
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.accept).toContain('image/png');
  });

  it('rejects an unsupported file on the client and surfaces the reason (R4.4)', async () => {
    renderUploader();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(['hello world'], 'note.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [badFile] } });

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyError.mock.calls[0][0]).toContain('Неподдерживаемый формат');
    expect(uploadPhotos).not.toHaveBeenCalled();
  });

  it('uploads a valid photo through the API client', async () => {
    renderUploader();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const goodFile = makeFile('car.png', 'image/png', PNG_MAGIC);

    fireEvent.change(input, { target: { files: [goodFile] } });

    await waitFor(() => expect(uploadPhotos).toHaveBeenCalledTimes(1));
    expect(uploadPhotos).toHaveBeenCalledWith('report-1', [goodFile], { silent: true });
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('rejects a batch that would exceed the 20-photo limit (R4.11)', async () => {
    const full: ReportPhoto[] = Array.from({ length: PHOTO_MAX_PER_REPORT }, (_, i) => ({
      id: `p${i}`,
      url: `blob:${i}`,
      sequence_number: i + 1,
    }));
    getPhotos.mockResolvedValue(full);

    renderUploader();
    await waitFor(() => {
      expect(screen.getByText(`Загружено: 20 из ${PHOTO_MAX_PER_REPORT}`)).not.toBeNull();
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const goodFile = makeFile('extra.png', 'image/png', PNG_MAGIC);
    fireEvent.change(input, { target: { files: [goodFile] } });

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyError.mock.calls[0][0]).toContain('лимит');
    expect(uploadPhotos).not.toHaveBeenCalled();
  });

  it('lists thumbnails by server sequence_number and deletes via the API (R4.6, R4.10)', async () => {
    getPhotos.mockResolvedValue([
      { id: 'a', url: 'blob:a', sequence_number: 1 },
      { id: 'b', url: 'blob:b', sequence_number: 2 },
    ] satisfies ReportPhoto[]);

    renderUploader();

    await waitFor(() => {
      expect(screen.getByAltText('Фото 1')).not.toBeNull();
      expect(screen.getByAltText('Фото 2')).not.toBeNull();
    });

    fireEvent.click(screen.getByLabelText('Удалить фото 1'));
    await waitFor(() => expect(deletePhoto).toHaveBeenCalledTimes(1));
    expect(deletePhoto).toHaveBeenCalledWith('report-1', 'a', { silent: true });
  });
});

describe('PhotoUploader caption editing (R8.1)', () => {
  it('renders a caption input + counter for each photo seeded from the server', async () => {
    getPhotos.mockResolvedValue([
      { id: 'a', url: 'blob:a', sequence_number: 1, position: 1, caption: 'hello' },
    ] satisfies ReportPhoto[]);

    renderUploader();

    const input = (await screen.findByLabelText(/подпись к фото 1/i)) as HTMLInputElement;
    expect(input.value).toBe('hello');
    expect(input.maxLength).toBe(PHOTO_CAPTION_MAX_LEN);
    expect(screen.getByText(`5 / ${PHOTO_CAPTION_MAX_LEN}`)).not.toBeNull();
  });

  it('debounces caption edits into a single PATCH and clears empty captions to null', async () => {
    getPhotos.mockResolvedValue([
      { id: 'a', url: 'blob:a', sequence_number: 1, position: 1, caption: null },
    ] satisfies ReportPhoto[]);
    patchPhoto.mockResolvedValue({ id: 'a', caption: 'hi', position: 1 });

    renderUploader();
    const input = (await screen.findByLabelText(/подпись к фото 1/i)) as HTMLInputElement;

    // Two rapid keystrokes within the debounce window — exactly ONE PATCH
    // should fire, carrying the latest value (R1.4 trailing-edge debounce).
    fireEvent.change(input, { target: { value: 'h' } });
    fireEvent.change(input, { target: { value: 'hi' } });

    await waitFor(() => expect(patchPhoto).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(patchPhoto).toHaveBeenCalledWith('report-1', 'a', { caption: 'hi' }, { silent: true });

    // Clearing the caption sends `null` so the server clears the column.
    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => expect(patchPhoto).toHaveBeenCalledTimes(2), { timeout: 2000 });
    expect(patchPhoto).toHaveBeenLastCalledWith(
      'report-1',
      'a',
      { caption: null },
      { silent: true },
    );
  });

  it('rolls back the cached caption and shows a toast on PATCH failure', async () => {
    getPhotos.mockResolvedValue([
      { id: 'a', url: 'blob:a', sequence_number: 1, position: 1, caption: 'old' },
    ] satisfies ReportPhoto[]);
    patchPhoto.mockRejectedValueOnce(
      axiosErrorWithStatus(400, {
        error: 'Validation error',
        details: { fieldErrors: { caption: ['caption_too_long_200'] }, formErrors: [] },
      }),
    );

    const queryClient = renderUploader();
    const input = (await screen.findByLabelText(/подпись к фото 1/i)) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'attempted update' } });

    // The mock PATCH rejects — the rollback path should restore the cache
    // caption AND surface a sonner.error toast naming the 200-char limit.
    await waitFor(() => expect(notifyError).toHaveBeenCalled(), { timeout: 2000 });
    expect(notifyError.mock.calls[0][0]).toContain('200');

    // The cache is the source of truth for "what the server has". After
    // rollback it must be byte-for-byte the pre-mutation state — the local
    // input intentionally keeps the user's typed value so they can correct
    // and retry without re-typing.
    await waitFor(() => {
      const cache = queryClient.getQueryData<ReportPhoto[]>(['reports', 'photos', 'report-1']);
      expect(cache?.[0]?.caption).toBe('old');
    });
  });
});

describe('PhotoUploader reorder (R8.2, R8.10)', () => {
  it('optimistically swaps two photos and PATCHes the new position', async () => {
    getPhotos.mockResolvedValue([
      { id: 'a', url: 'blob:a', sequence_number: 1, position: 1, caption: null },
      { id: 'b', url: 'blob:b', sequence_number: 2, position: 2, caption: null },
    ] satisfies ReportPhoto[]);
    patchPhoto.mockResolvedValue({ id: 'a', caption: null, position: 2 });

    renderUploader();
    await screen.findByAltText('Фото 1');

    fireEvent.click(screen.getByLabelText(/переместить «фото 1» вниз/i));

    await waitFor(() => expect(patchPhoto).toHaveBeenCalledTimes(1));
    expect(patchPhoto).toHaveBeenCalledWith('report-1', 'a', { position: 2 }, { silent: true });
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('disables ↑ on the first photo and ↓ on the last photo', async () => {
    getPhotos.mockResolvedValue([
      { id: 'a', url: 'blob:a', sequence_number: 1, position: 1, caption: null },
      { id: 'b', url: 'blob:b', sequence_number: 2, position: 2, caption: null },
    ] satisfies ReportPhoto[]);

    renderUploader();
    await screen.findByAltText('Фото 1');

    const upFirst = screen.getByLabelText(/переместить «фото 1» вверх/i) as HTMLButtonElement;
    const downLast = screen.getByLabelText(/переместить «фото 2» вниз/i) as HTMLButtonElement;
    expect(upFirst.disabled).toBe(true);
    expect(downLast.disabled).toBe(true);
  });

  it('rolls back the optimistic order on a PATCH failure', async () => {
    getPhotos.mockResolvedValue([
      { id: 'a', url: 'blob:a', sequence_number: 1, position: 1, caption: null },
      { id: 'b', url: 'blob:b', sequence_number: 2, position: 2, caption: null },
    ] satisfies ReportPhoto[]);
    patchPhoto.mockRejectedValueOnce(axiosErrorWithStatus(500, { error: 'internal' }));

    const queryClient = renderUploader();
    await screen.findByAltText('Фото 1');

    fireEvent.click(screen.getByLabelText(/переместить «фото 1» вниз/i));

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyError.mock.calls[0][0]).toMatch(/сохранить/i);

    // The cache must be restored to the pre-click order, photo "a" first.
    const cache = queryClient.getQueryData<ReportPhoto[]>(['reports', 'photos', 'report-1']);
    expect(cache?.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('serverErrorMessage', () => {
  it('maps HTTP 413 to a payload-too-large message', () => {
    expect(serverErrorMessage(axiosErrorWithStatus(413), 'fallback')).toContain('размер');
  });

  it('maps HTTP 415 to an unsupported-media message', () => {
    expect(serverErrorMessage(axiosErrorWithStatus(415), 'fallback')).toContain('формат');
  });

  it('maps HTTP 400 to a photo-limit message', () => {
    expect(serverErrorMessage(axiosErrorWithStatus(400), 'fallback')).toContain('лимит');
  });

  it('falls back for non-axios errors', () => {
    expect(serverErrorMessage(new Error('x'), 'fallback')).toBe('fallback');
  });
});

describe('patchErrorMessage', () => {
  it('maps 400 + caption_too_long_200 to the 200-char message', () => {
    const err = axiosErrorWithStatus(400, {
      error: 'Validation error',
      details: { fieldErrors: { caption: ['caption_too_long_200'] }, formErrors: [] },
    });
    expect(patchErrorMessage(err)).toContain('200');
  });

  it('maps 400 + position_out_of_range to the range message', () => {
    const err = axiosErrorWithStatus(400, {
      error: 'Validation error',
      details: { fieldErrors: { position: ['position_out_of_range'] }, formErrors: [] },
    });
    expect(patchErrorMessage(err)).toMatch(/1 до \d+/);
  });

  it('maps 404 to a photo-not-found message', () => {
    expect(patchErrorMessage(axiosErrorWithStatus(404))).toContain('не найден');
  });

  it('falls back for non-axios errors', () => {
    expect(patchErrorMessage(new Error('x'))).toMatch(/сохранить/i);
  });
});
