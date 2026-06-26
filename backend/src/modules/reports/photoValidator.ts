/**
 * File_Upload_Validator (photo branch) — Requirement 4 (§4.2, §4.3, §4.5, §4.11)
 * and Requirement 6 (§6.8).
 *
 * Performs the server-side photo validation contract with the rejection ordering
 * fixed by design §3.4 / Property 11:
 *   1. MIME whitelist
 *   2. magic-byte / header signature match
 *   3. size bounds (empty / too large)
 *
 * Each failure yields a single rejection: HTTP 415 (mime / magic / corrupt)
 * or HTTP 413 (size).
 */

/** Allowed photo MIME types (R4.2, R6.8). */
export const PHOTO_MIME_WHITELIST = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/** Maximum accepted photo size in bytes — 10 MB (R4.3, R6.8). */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** Minimum accepted photo size in bytes — empty files are rejected (R4.3). */
export const PHOTO_MIN_BYTES = 1;

/** Maximum number of photos persisted per report (R4.11). */
export const PHOTO_MAX_PER_REPORT = 20;

/** Maximum accepted `.docx` size in bytes — 25 MB (R6.8). */
export const DOCX_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Header magic-byte signatures per MIME type. A value of `-1` is a wildcard
 * that matches any single byte (used for the 4-byte RIFF chunk size in WebP).
 */
export const MAGIC_BYTES: Record<string, readonly number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x57, 0x45, 0x42, 0x50],
  ],
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
function matchesMagicBytes(mime: string, header: Buffer): boolean {
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
 * Validates an uploaded photo against the MIME whitelist, header magic bytes
 * and size bounds, in that order (design §3.4 / R6.8).
 *
 * @param file        The multer file (uses `mimetype` and `size`).
 * @param headerBytes The leading bytes of the file used for magic-byte sniffing.
 */
export function validatePhoto(
  file: Express.Multer.File,
  headerBytes: Buffer,
): ValidationResult {
  // 1. MIME whitelist.
  if (!isAllowedPhotoMime(file.mimetype)) {
    return { ok: false, status: 415, reason: 'mime_not_allowed' };
  }

  // 2. Magic-byte header signature.
  if (!matchesMagicBytes(file.mimetype, headerBytes)) {
    return { ok: false, status: 415, reason: 'magic_mismatch' };
  }

  // 3. Size bounds.
  if (file.size < PHOTO_MIN_BYTES) {
    return { ok: false, status: 413, reason: 'empty' };
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return { ok: false, status: 413, reason: 'too_large' };
  }

  return { ok: true };
}
