/**
 * Image_Pipeline — Requirement 8 (§8.5–§8.8), design §3.8.
 *
 * Orchestrates byte-level normalization of an uploaded photo so that the bytes
 * persisted (and later embedded into the generated `.docx`) are:
 *
 *   1. correctly oriented — EXIF `Orientation` is baked into the pixels via
 *      `sharp(...).rotate()` *before* any downsampling, so a rotated capture is
 *      not resized in the wrong orientation (R8.6);
 *   2. metadata-free — every EXIF IFD (notably GPS coordinates and device
 *      fingerprints) is dropped on re-encode, leaving `metadata().exif`
 *      `undefined` (R8.7);
 *   3. bounded in dimension and size — the long edge is resized to ≤ 1600 px by
 *      the existing {@link compressPhoto} (R4.7) and the final byte length is
 *      guarded against {@link MAX_NORMALIZED_BYTES} (R8.8).
 *
 * The pipeline wraps {@link compressPhoto} (sharp) with the rotate + strip-EXIF
 * stages placed strictly before resize. `compressPhoto`'s signature is left
 * unchanged; `reports.service` is migrated to call {@link imagePipeline.normalize}
 * instead of `compressPhoto` directly.
 *
 * Output format is derived from the declared MIME type:
 *   - `image/jpeg` / `image/webp` → JPEG (quality 85), via {@link compressPhoto};
 *   - `image/png`                 → PNG  (compressionLevel 9), encoded here.
 *
 * Any decode failure, or a final size exceeding {@link MAX_NORMALIZED_BYTES},
 * surfaces as a {@link PhotoDecodeError} (R4.12) so the upload layer maps it to
 * HTTP 415 and cleans up any temporary data (§3.8 size guard).
 */

import sharp from 'sharp';
import {
  compressPhoto,
  DEFAULT_MAX_DIMENSION,
  DEFAULT_QUALITY,
  PhotoDecodeError,
} from './photoCompressor.js';

/**
 * Upper bound on the size of a normalized image in bytes (2 MiB). A normalized
 * image larger than this is treated as an R4.12 decode failure (§3.8 size
 * guard, R8.8).
 */
export const MAX_NORMALIZED_BYTES = 2 * 1024 * 1024;

/** PNG `compressionLevel` used for `image/png` inputs (§3.8). */
export const PNG_COMPRESSION_LEVEL = 9;

export type NormalizedFormat = 'jpeg' | 'png';

export interface NormalizedImage {
  /** Normalized, EXIF-free image bytes. */
  buffer: Buffer;
  /** Output width in pixels. */
  width: number;
  /** Output height in pixels. */
  height: number;
  /** Output encoding format (`jpeg` for jpeg/webp inputs, `png` for png). */
  format: NormalizedFormat;
  /** Size of `buffer` in bytes (guaranteed ≤ {@link MAX_NORMALIZED_BYTES}). */
  bytes: number;
}

export type NormalizableMime = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Applies EXIF orientation to pixels and re-encodes the image, dropping all
 * metadata in the process.
 *
 * sharp drops metadata on encode unless the caller explicitly opts in via
 * `withMetadata()` / `keepMetadata()` / `keepExif()`. The pipeline therefore
 * strips EXIF by *omitting* `withMetadata()` entirely after `.rotate()`, which
 * yields the single auditable invariant `metadata().exif === undefined`
 * (§3.8 "EXIF stripping choice"). The intermediate buffer keeps the input
 * encoding so no quality is lost before the resize stage.
 */
async function rotateAndStrip(input: Buffer): Promise<Buffer> {
  try {
    // `.rotate()` with no argument applies the EXIF Orientation tag to the
    // pixels; encoding without `withMetadata()` drops every metadata IFD.
    return await sharp(input, { failOn: 'error' }).rotate().toBuffer();
  } catch (error) {
    throw new PhotoDecodeError(
      'Failed to decode image: corrupt file or MIME mismatch',
      error,
    );
  }
}

/**
 * Resizes (long edge ≤ 1600 px, aspect preserved, no upscaling) and re-encodes
 * an already-rotated, EXIF-free PNG buffer at `compressionLevel` 9. Mirrors the
 * R4.7 resize semantics delegated to {@link compressPhoto} for the jpeg/webp
 * branch, since `compressPhoto` only emits jpeg/webp (§3.4).
 */
async function resizeEncodePng(input: Buffer): Promise<NormalizedImage> {
  try {
    const { data, info } = await sharp(input, { failOn: 'error' })
      .resize({
        width: DEFAULT_MAX_DIMENSION,
        height: DEFAULT_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: PNG_COMPRESSION_LEVEL })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      width: info.width,
      height: info.height,
      format: 'png',
      bytes: data.length,
    };
  } catch (error) {
    throw new PhotoDecodeError(
      'Failed to encode image: corrupt file or MIME mismatch',
      error,
    );
  }
}

export const imagePipeline = {
  /**
   * Orchestrates EXIF-rotate → strip-EXIF → resize/encode → size-guard.
   *
   * `declaredMime` determines the output format:
   *   - `image/jpeg` | `image/webp` → JPEG (quality 85);
   *   - `image/png`                 → PNG  (compressionLevel 9).
   *
   * @throws {PhotoDecodeError} when the input fails to decode, or when the
   *   final normalized size exceeds {@link MAX_NORMALIZED_BYTES} (R4.12 / R8.8).
   */
  async normalize(
    buffer: Buffer,
    declaredMime: NormalizableMime,
  ): Promise<NormalizedImage> {
    // Stages 1 + 2: apply EXIF orientation, then strip all metadata.
    const oriented = await rotateAndStrip(buffer);

    // Stages 3 + 4: resize to long-edge ≤ 1600 px and re-encode.
    const result: NormalizedImage =
      declaredMime === 'image/png'
        ? await resizeEncodePng(oriented)
        : await (async () => {
            const compressed = await compressPhoto(oriented, {
              maxDimension: DEFAULT_MAX_DIMENSION,
              quality: DEFAULT_QUALITY,
              format: 'jpeg',
            });
            return {
              buffer: compressed.buffer,
              width: compressed.width,
              height: compressed.height,
              format: 'jpeg' as const,
              bytes: compressed.bytes,
            };
          })();

    // Size guard (§3.8): an oversized normalized image is an R4.12 decode error
    // mapped to HTTP 415 with temp-data cleanup.
    if (result.bytes > MAX_NORMALIZED_BYTES) {
      throw new PhotoDecodeError(
        `Normalized image exceeds ${MAX_NORMALIZED_BYTES} bytes (${result.bytes})`,
      );
    }

    return result;
  },
};
