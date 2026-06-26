/**
 * Browser-side helper that downloads a blob to disk.
 *
 * Authentication is provided exclusively by the HttpOnly `access_token`
 * cookie set on `POST /api/login` (Requirement 6.5). We use the native
 * `fetch` with `credentials: 'include'` so the cookie is attached to the
 * request automatically; the SPA does NOT see, store, or forward the JWT
 * itself (no `Authorization: Bearer …` header, no `localStorage` read).
 */
export async function downloadBlob(downloadUrl: string, filename: string): Promise<void> {
  const response = await fetch(downloadUrl, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Не удалось скачать документ');
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(objectUrl);
  document.body.removeChild(link);
}
