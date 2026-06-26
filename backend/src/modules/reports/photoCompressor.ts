/**
 * Photo_Compressor — Requirement 4 (§4.7, §4.12).
 *
 * Thin wrapper over `sharp` that resizes a decoded image so that its long edge
 * does not exceed `maxDimension` pixels (aspect ratio preserved, never upscaled)
 * and re-encodes it as JPEG or WebP at the configured quality.
 *
 * Decode failures (corrupt image or bytes that do not match the declared MIME
 * type) surface as a {@link PhotoDecodeError} so the upload layer can map them
 * to HTTP 415 and clean up temporary data (R4.12). All other inputs produce a
 * {@link CompressionResult}.
 */

import sharp from 'sharp';

/** Long-edge cap in pixels applied during compression (R4.7). */
export const DEFAULT_MAX_DIMENSION = 1600;

/** Default JPEG / WebP encoding quality (R4.7). */
export const DEFAULT_QUALITY = 85;

export type CompressFormat = 'jpeg' | 'webp';

export interface CompressOptions {
  /** Long-edge cap in pixels (R4.7). */
  maxDimension: number;
  /** JPEG / WebP quality, 1–100 (R4.7 requires ≥ 85). */
  quality: number;
  /** Output encoding format. */
  format: CompressFormat;
}

export interface CompressionResult {
  /** Re-encoded image bytes. */
  buffer: Buffer;
  /** Output width in pixels. */
  width: number;
  /** Output height in pixels. */
  height: number;
  /** Output encoding format. */
  format: CompressFormat;
  /** Size of `buffer` in bytes. */
  bytes: number;
}

/**
 * Raised when `sharp` cannot decode the input image (corrupt file or bytes that
 * do not match the declared MIME type). The upload layer maps this to HTTP 415
 * and removes any temporary data already persisted for the photo (R4.12).
 */
export class PhotoDecodeError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PhotoDecodeError';
  }
}

/**
 * Resizes and re-encodes a photo.
 *
 * The long edge is bounded by `options.maxDimension` while preserving the
 * aspect ratio (`fit: 'inside'`); images smaller than the cap are never
 * enlarged (`withoutEnlargement: true`). On a decode failure the function
 * throws {@link PhotoDecodeError} rather than returning a result.
 *
 * @param input   Raw uploaded image bytes.
 * @param options Resize cap, encoding quality and output format.
 */
export async function compressPhoto(
  input: Buffer,
  options: CompressOptions,
): Promise<CompressionResult> {
  const { maxDimension, quality, format } = options;

  const pipeline = sharp(input, { failOn: 'error' });

  // Decode metadata first so that corrupt input / MIME mismatch surfaces as a
  // decode failure before any encoding work (R4.12).
  try {
    await pipeline.metadata();
  } catch (error) {
    throw new PhotoDecodeError(
      'Failed to decode image: corrupt file or MIME mismatch',
      error,
    );
  }

  const resized = pipeline.resize({
    width: maxDimension,
    height: maxDimension,
    fit: 'inside',
    withoutEnlargement: true,
  });

  const encoded =
    format === 'webp' ? resized.webp({ quality }) : resized.jpeg({ quality });

  try {
    const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
    return {
      buffer: data,
      width: info.width,
      height: info.height,
      format,
      bytes: data.length,
    };
  } catch (error) {
    throw new PhotoDecodeError(
      'Failed to encode image: corrupt file or MIME mismatch',
      error,
    );
  }
}
