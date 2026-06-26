import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MAGIC_BYTES,
  PHOTO_HEADER_BYTES,
  PHOTO_MAX_BYTES,
  PHOTO_MIME_WHITELIST,
  type ValidationResult,
  validatePhotoBytes,
  validatePhotoFile,
} from '@/features/reports/lib/photoClientValidator';

/**
 * Property 11: File upload validation oracle (client-side branch).
 *
 * For any photo upload (`declared_mime`, `header_bytes`, `byte_size`), the
 * client validator MUST return the status/reason computed by the oracle, with
 * the rejection ordering fixed by design §3.4:
 *   1. status 415 / `mime_not_allowed` if `declared_mime ∉ whitelist`,
 *   2. else status 415 / `magic_mismatch` if header bytes do not match the
 *      signature registered for `declared_mime`,
 *   3. else status 413 / `empty` if `byte_size < 1`,
 *   4. else status 413 / `too_large` if `byte_size > PHOTO_MAX_BYTES`,
 *   5. else accept (`ok: true`).
 *
 * The oracle below is an independent re-statement of the server validator's
 * contract (`backend/src/modules/reports/photoValidator.ts`); the photo branch
 * carries no docx/VBA stage, so accept here corresponds 1:1 to a server accept
 * and every reason/status code maps 1:1 to the server's.
 *
 * **Validates: Requirements 4.2, 4.3, 4.4**
 */

const WHITELIST = PHOTO_MIME_WHITELIST as readonly string[];

// MIME values outside the whitelist, including near-misses (`image/jpg`),
// empty string, and unrelated types — to exercise the mime-rejection branch.
const NON_WHITELIST_MIMES = [
  '',
  'image/jpg',
  'image/gif',
  'image/svg+xml',
  'image/bmp',
  'application/pdf',
  'application/octet-stream',
  'text/plain',
] as const;

const mimeArb = fc.oneof(
  fc.constantFrom(...WHITELIST),
  fc.constantFrom(...NON_WHITELIST_MIMES),
);

// Bias size toward the exact bounds (0, 1, max-1, max, max+1) plus a broad
// random spread so the empty / too_large / in-range branches are all hit.
const sizeArb = fc.oneof(
  fc.constantFrom(
    0,
    1,
    PHOTO_MAX_BYTES - 1,
    PHOTO_MAX_BYTES,
    PHOTO_MAX_BYTES + 1,
  ),
  fc.integer({ min: 0, max: PHOTO_MAX_BYTES + 4096 }),
);

/**
 * Produces a header that matches `signature` (filling wildcard `-1` slots with
 * a random byte) followed by a random tail, exercising real magic-byte hits
 * including the WebP RIFF wildcard chunk-size bytes.
 */
const validHeaderGen = (signature: readonly number[]): fc.Arbitrary<Uint8Array> =>
  fc
    .tuple(
      ...signature.map((b) =>
        b === -1 ? fc.integer({ min: 0, max: 255 }) : fc.constant(b),
      ),
    )
    .chain((head) =>
      fc
        .uint8Array({ minLength: 0, maxLength: 6 })
        .map((tail) => new Uint8Array([...head, ...tail])),
    );

const randomHeaderArb = fc.uint8Array({
  minLength: 0,
  maxLength: PHOTO_HEADER_BYTES + 4,
});

/** A header arbitrary biased toward valid signatures for whitelisted MIMEs. */
const headerArbForMime = (mime: string): fc.Arbitrary<Uint8Array> => {
  const signatures = MAGIC_BYTES[mime];
  if (!signatures) {
    return randomHeaderArb;
  }
  return fc.oneof(randomHeaderArb, ...signatures.map(validHeaderGen));
};

// ── Oracle (independent re-statement of the server/client contract) ──────────

function oracleMatchesMagic(mime: string, header: Uint8Array): boolean {
  const signatures = MAGIC_BYTES[mime];
  if (!signatures) {
    return false;
  }
  return signatures.some(
    (sig) =>
      header.length >= sig.length &&
      sig.every((b, i) => b === -1 || header[i] === b),
  );
}

function oracle(mime: string, size: number, header: Uint8Array): ValidationResult {
  if (!WHITELIST.includes(mime)) {
    return { ok: false, status: 415, reason: 'mime_not_allowed' };
  }
  if (!oracleMatchesMagic(mime, header)) {
    return { ok: false, status: 415, reason: 'magic_mismatch' };
  }
  if (size < 1) {
    return { ok: false, status: 413, reason: 'empty' };
  }
  if (size > PHOTO_MAX_BYTES) {
    return { ok: false, status: 413, reason: 'too_large' };
  }
  return { ok: true };
}

const caseArb = mimeArb.chain((mime) =>
  fc.record({
    mime: fc.constant(mime),
    size: sizeArb,
    header: headerArbForMime(mime),
  }),
);

describe('Property 11: File upload validation oracle (client-side branch)', () => {
  it('validatePhotoBytes matches the oracle status/reason for any input', () => {
    fc.assert(
      fc.property(caseArb, ({ mime, size, header }) => {
        const actual = validatePhotoBytes(mime, size, header);
        const expected = oracle(mime, size, header);
        expect(actual).toEqual(expected);
      }),
      { numRuns: 300, verbose: true },
    );
  });

  it('rejection ordering: MIME precedes magic precedes size', () => {
    fc.assert(
      fc.property(caseArb, ({ mime, size, header }) => {
        const result = validatePhotoBytes(mime, size, header);

        // 1. A non-whitelisted MIME is always reported first, regardless of
        //    header bytes or size.
        if (!WHITELIST.includes(mime)) {
          expect(result).toEqual({
            ok: false,
            status: 415,
            reason: 'mime_not_allowed',
          });
          return;
        }

        // 2. With a whitelisted MIME, a magic mismatch wins over any size error.
        if (!oracleMatchesMagic(mime, header)) {
          expect(result).toEqual({
            ok: false,
            status: 415,
            reason: 'magic_mismatch',
          });
          return;
        }

        // 3. MIME + magic valid: only size can now reject, with 413.
        if (result.ok) {
          expect(size).toBeGreaterThanOrEqual(1);
          expect(size).toBeLessThanOrEqual(PHOTO_MAX_BYTES);
        } else {
          expect(result.status).toBe(413);
          expect(['empty', 'too_large']).toContain(result.reason);
        }
      }),
      { numRuns: 300, verbose: true },
    );
  });

  it('validatePhotoFile matches the oracle over the first 12 header bytes', async () => {
    await fc.assert(
      fc.asyncProperty(
        mimeArb.chain((mime) =>
          fc.record({
            mime: fc.constant(mime),
            // Build the file content so its leading bytes can form a valid
            // signature; `File.size` equals the content byte length.
            content: fc.oneof(
              randomHeaderArb,
              ...((MAGIC_BYTES[mime] ?? []).map(validHeaderGen)),
              fc.uint8Array({ minLength: 0, maxLength: 64 }),
            ),
          }),
        ),
        async ({ mime, content }) => {
          const file = new File([content], 'photo', { type: mime });
          const header = content.slice(0, PHOTO_HEADER_BYTES);

          const actual = await validatePhotoFile(file);
          const expected = oracle(mime, content.length, header);
          expect(actual).toEqual(expected);
        },
      ),
      { numRuns: 150, verbose: true },
    );
  });
});
