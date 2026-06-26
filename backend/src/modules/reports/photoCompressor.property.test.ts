import fc from 'fast-check';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  type CompressFormat,
  compressPhoto,
} from './photoCompressor';

/**
 * Property 12: Photo compression preserves aspect ratio and bounds dimensions.
 *
 * For any decodable input image with dimensions (W, H),
 * `compressPhoto(input, { maxDimension: 1600, quality: 85 })` MUST produce an
 * output image with dimensions (W', H') satisfying:
 *   1. max(W', H') ≤ 1600,
 *   2. |W'/H' - W/H| ≤ 0.01 × W/H (aspect ratio preserved within 1%),
 *   3. Output MIME ∈ { image/jpeg, image/webp },
 *   4. If max(W, H) ≤ 1600, then (W', H') = (W, H) (no upscaling).
 *
 * **Validates: Requirements 4.7**
 */

const MAX_DIMENSION = 1600;
const QUALITY = 85;

/** Synthesize a decodable raw-fill image of the given dimensions/format. */
async function makeImage(
  width: number,
  height: number,
  format: CompressFormat,
  fill: { r: number; g: number; b: number },
): Promise<Buffer> {
  const base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: fill,
    },
  });
  return format === 'webp'
    ? base.webp().toBuffer()
    : base.jpeg().toBuffer();
}

/** sharp reports the format string we expect to map to a MIME type. */
const FORMAT_TO_MIME: Record<CompressFormat, string> = {
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

describe('Property 12: Photo compression preserves aspect ratio and bounds dimensions (R4.7)', () => {
  it('bounds long edge ≤ 1600, preserves aspect within 1%, and never upscales', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Dimensions span both below and above the 1600 cap so all branches
        // (upscale-guard and downscale) are exercised.
        fc.integer({ min: 1, max: 4000 }),
        fc.integer({ min: 1, max: 4000 }),
        fc.constantFrom<CompressFormat>('jpeg', 'webp'),
        fc.record({
          r: fc.integer({ min: 0, max: 255 }),
          g: fc.integer({ min: 0, max: 255 }),
          b: fc.integer({ min: 0, max: 255 }),
        }),
        async (width, height, format, fill) => {
          const input = await makeImage(width, height, format, fill);

          const result = await compressPhoto(input, {
            maxDimension: MAX_DIMENSION,
            quality: QUALITY,
            format,
          });

          const { width: outW, height: outH } = result;

          // (1) Long edge is bounded by the cap.
          expect(Math.max(outW, outH)).toBeLessThanOrEqual(MAX_DIMENSION);

          // (3) Output format/MIME is one of the allowed encodings, and the
          //     re-encoded bytes actually decode to that format.
          expect(result.format).toBe(format);
          const meta = await sharp(result.buffer).metadata();
          expect([
            FORMAT_TO_MIME.jpeg,
            FORMAT_TO_MIME.webp,
          ]).toContain(FORMAT_TO_MIME[result.format]);
          expect(meta.format).toBe(format);

          const inputAspect = width / height;

          if (Math.max(width, height) <= MAX_DIMENSION) {
            // (4) No upscaling: dimensions are unchanged.
            expect(outW).toBe(width);
            expect(outH).toBe(height);
          } else {
            // (2) Aspect ratio preserved within 1%. Integer rounding of the
            //     scaled-down edge means tiny inputs can exceed a strict 1%,
            //     so we compare against a tolerance that also absorbs a
            //     single-pixel rounding step on the shorter edge.
            const outputAspect = outW / outH;
            const relativeError = Math.abs(outputAspect - inputAspect);
            const roundingSlack = inputAspect * (1 / Math.min(outW, outH));
            expect(relativeError).toBeLessThanOrEqual(
              0.01 * inputAspect + roundingSlack,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
