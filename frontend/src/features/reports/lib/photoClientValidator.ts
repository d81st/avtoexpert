/**
 * Client-side File_Upload_Validator (photo branch) — Requirement 4
 * (§4.2, §4.3, §4.4).
 *
 * Best-effort pre-flight validation performed in the browser before a photo is
 * sent to `POST /api/reports/:id/photos`. It mirrors the server validator
 * (`backend/src/modules/reports/photoValidator.ts`) 1:1 so that a file rejected
 * here would also be rejected by the authoritative server check, and uses the
 * identical rejection ordering fixed by design §3.4 / Property 11:
 *   1. MIME whitelist
 *   2. magic-byte / header signature match
 *   3. size bounds (empty / too large)
 *
 * Each failure yields a single rejection, carrying the same HTTP-status and
 * reason codes the server would return: HTTP 415 (mime / magic / corrupt) or
 * HTTP 413 (size). The server remains the source of truth; this check only
 * avoids obviously-doomed uploads and surfaces fast inline feedback.
 */

/** Allowed photo MIME types (R4.2). Mirrors server `PHOTO_MIME_WHITELIST`. */
export const PHOTO_MIME_WHITELIST = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Maximum accepted photo size in bytes — 10 MB (R4.3). */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** Minimum accepted photo size in bytes — empty files are rejected (R4.3). */
export const PHOTO_MIN_BYTES = 1;

/**
 * Number of leading bytes sniffed for magic-byte detection. 12 bytes covers the
 * longest signature (WebP's `RIFF....WEBP`); PNG (8) and JPEG (3) are shorter.
 */
export const PHOTO_HEADER_BYTES = 12;

/**
 * Header magic-byte signatures per MIME type. A value of `-1` is a wildcard
 * that matches any single byte (used for the 4-byte RIFF chunk size in WebP).
 * Mirrors the server `MAGIC_BYTES` table exactly.
 */
export const MAGIC_BYTES: Record<string, readonly number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x57, 0x45, 0x42, 0x50]],
};

export type ValidationReason =
  | 'empty'
  | 'too_large'
  | 'mime_not_allowed'
  | 'magic_mismatch'
  | 'corrupt';

export interface ValidationResult {
  ok: boolean;
  status?: 413 | 415;
  reason?: ValidationReason;
}

function isAllowedPhotoMime(mime: string): boolean {
  return (PHOTO_MIME_WHITELIST as readonly string[]).includes(mime);
}

/**
 * Returns true when `header` matches at least one signature registered for
 * `mime`. Wildcard bytes (`-1`) match any value. A header shorter than a
 * signature can never match it.
 */
function matchesMagicBytes(mime: string, header: Uint8Array): boolean {
  const signatures = MAGIC_BYTES[mime];
  if (!signatures) {
    return false;
  }

  return signatures.some((signature) => {
    if (header.length < signature.length) {
      return false;
    }
    for (let i = 0; i < signature.length; i++) {
      const expected = signature[i];
      if (expected === -1) {
        continue;
      }
      if (header[i] !== expected) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Pure validation core: validates a photo's declared MIME type, leading header
 * bytes and byte size against the whitelist, magic-byte signatures and size
 * bounds, in that order (design §3.4). Synchronous and side-effect free so it
 * can be exercised directly by property tests.
 *
 * @param mime   The file's declared MIME type (`File.type`).
 * @param size   The file's size in bytes (`File.size`).
 * @param header The leading bytes of the file used for magic-byte sniffing.
 */
export function validatePhotoBytes(
  mime: string,
  size: number,
  header: Uint8Array,
): ValidationResult {
  // 1. MIME whitelist.
  if (!isAllowedPhotoMime(mime)) {
    return { ok: false, status: 415, reason: 'mime_not_allowed' };
  }

  // 2. Magic-byte header signature.
  if (!matchesMagicBytes(mime, header)) {
    return { ok: false, status: 415, reason: 'magic_mismatch' };
  }

  // 3. Size bounds.
  if (size < PHOTO_MIN_BYTES) {
    return { ok: false, status: 413, reason: 'empty' };
  }
  if (size > PHOTO_MAX_BYTES) {
    return { ok: false, status: 413, reason: 'too_large' };
  }

  return { ok: true };
}

/**
 * Best-effort client-side validation of a `File` selected for upload. Reads the
 * first {@link PHOTO_HEADER_BYTES} bytes for magic-byte sniffing, then delegates
 * to {@link validatePhotoBytes}. If the header cannot be read at all the file is
 * treated as corrupt (HTTP 415), matching the server's decode-failure outcome.
 */
export async function validatePhotoFile(file: File): Promise<ValidationResult> {
  let header: Uint8Array;
  try {
    const slice = file.slice(0, PHOTO_HEADER_BYTES);
    header = new Uint8Array(await slice.arrayBuffer());
  } catch {
    return { ok: false, status: 415, reason: 'corrupt' };
  }

  return validatePhotoBytes(file.type, file.size, header);
}
