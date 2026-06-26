import PizZip from 'pizzip';
import { payloadTooLarge, unsupportedMediaType } from '../errors/httpError.js';

/**
 * DOCX upload validation (Requirements 6.8, 6.9).
 *
 * Enforces, in this order:
 *   1. MIME-type whitelist     -> 415 on mismatch (R6.8)
 *   2. ZIP magic bytes PK\x03\x04 -> 415 on mismatch (R6.8)
 *   3. Size <= 25 MB           -> 413 when exceeded (R6.8)
 *   4. No VBA-macro ZIP entries -> 415 when present (R6.9)
 *
 * `pizzip` (already a project dependency) is used to walk the ZIP entries.
 */

/** Canonical MIME type for an Office Open XML Word document. */
export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Maximum allowed `.docx` upload size: 25 MB (R6.8). */
export const DOCX_MAX_BYTES = 25 * 1024 * 1024; // 26_214_400

/** Local ZIP file-header signature shared by every `.docx` container. */
export const DOCX_MAGIC_BYTES: readonly number[] = [0x50, 0x4b, 0x03, 0x04];

/** ZIP entries whose presence indicates embedded VBA macros (R6.9). */
export const FORBIDDEN_DOCX_ENTRIES: ReadonlySet<string> = new Set([
  'word/vbaProject.bin',
  'word/vbaData.xml',
]);

export type DocxValidationReason =
  | 'mime_not_allowed'
  | 'magic_mismatch'
  | 'too_large'
  | 'macro_detected'
  | 'corrupt';

export interface DocxValidationResult {
  ok: boolean;
  status?: 413 | 415;
  reason?: DocxValidationReason;
}

function hasDocxMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < DOCX_MAGIC_BYTES.length) {
    return false;
  }
  return DOCX_MAGIC_BYTES.every((byte, index) => buffer[index] === byte);
}

/**
 * Pure validation of a `.docx` buffer against the declared MIME type.
 * Returns a structured result without throwing.
 */
export function validateDocx(
  buffer: Buffer,
  declaredMime: string,
): DocxValidationResult {
  // 1. MIME whitelist (R6.8).
  if (declaredMime !== DOCX_MIME) {
    return { ok: false, status: 415, reason: 'mime_not_allowed' };
  }

  // 2. Magic bytes (R6.8).
  if (!hasDocxMagicBytes(buffer)) {
    return { ok: false, status: 415, reason: 'magic_mismatch' };
  }

  // 3. Size limit (R6.8).
  if (buffer.length > DOCX_MAX_BYTES) {
    return { ok: false, status: 413, reason: 'too_large' };
  }

  // 4. Macro detection by walking ZIP entries (R6.9).
  let entryNames: string[];
  try {
    const zip = new PizZip(buffer);
    entryNames = Object.keys(zip.files);
  } catch {
    return { ok: false, status: 415, reason: 'corrupt' };
  }

  for (const name of entryNames) {
    if (FORBIDDEN_DOCX_ENTRIES.has(name)) {
      return { ok: false, status: 415, reason: 'macro_detected' };
    }
  }

  return { ok: true };
}

const REASON_MESSAGES: Record<DocxValidationReason, string> = {
  mime_not_allowed: 'Unsupported file type: only .docx documents are allowed',
  magic_mismatch: 'File content does not match a valid .docx (ZIP) container',
  too_large: 'Document exceeds the maximum allowed size of 25 MB',
  macro_detected: 'Macro-enabled documents are not allowed',
  corrupt: 'Document is corrupt or not a valid .docx container',
};

/**
 * Validates a `.docx` buffer and throws the appropriate {@link HttpError}
 * (413 / 415) on failure. On success it returns normally.
 *
 * Use this from route/service layers that receive the raw document buffer
 * (e.g. the admin template upload, which carries the file as base64 in the
 * request body rather than as a multipart stream).
 */
export function assertValidDocx(buffer: Buffer, declaredMime: string): void {
  const result = validateDocx(buffer, declaredMime);
  if (result.ok) {
    return;
  }

  const message = result.reason
    ? REASON_MESSAGES[result.reason]
    : 'Invalid document upload';
  const details = { reason: result.reason };

  if (result.status === 413) {
    throw payloadTooLarge(message, details);
  }
  throw unsupportedMediaType(message, details);
}
