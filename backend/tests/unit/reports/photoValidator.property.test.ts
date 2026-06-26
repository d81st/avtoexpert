import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MAGIC_BYTES,
  PHOTO_MAX_BYTES,
  PHOTO_MIME_WHITELIST,
  type ValidationResult,
  validatePhoto,
} from '../../../src/modules/reports/photoValidator';

/**
 * Feature: platform-improvements-mvp, Property 11: File upload validation oracle
 * (photo branch).
 *
 * For any photo upload (`declared_mime`, `header_bytes`, `byte_size`),
 * `validatePhoto(...)` MUST return the status computed by the oracle, in this
 * rejection order (design §3.4):
 *   1. status 415 if `declared_mime ∉ PHOTO_MIME_WHITELIST`,
 *   2. else status 415 if `header_bytes` do not match the magic-byte signature
 *      for `declared_mime`,
 *   3. else status 413 if `byte_size < 1` or `byte_size > PHOTO_MAX_BYTES`,
 *   4. else accept (`ok = true`).
 *
 * Validates: Requirements 4.2, 4.3, 4.5, 6.8
 */

const WHITELIST = PHOTO_MIME_WHITELIST as readonly string[];

/** A reference oracle implementing the spec ordering independently of the SUT. */
function oracle(mime: string, header: Buffer, size: number): ValidationResult {
  // 1. MIME whitelist.
  if (!WHITELIST.includes(mime)) {
    return { ok: false, status: 415, reason: 'mime_not_allowed' };
  }
  // 2. Magic bytes.
  if (!oracleMagicMatch(mime, header)) {
    return { ok: false, status: 415, reason: 'magic_mismatch' };
  }
  // 3. Size bounds.
  if (size < 1) {
    return { ok: false, status: 413, reason: 'empty' };
  }
  if (size > PHOTO_MAX_BYTES) {
    return { ok: false, status: 413, reason: 'too_large' };
  }
  return { ok: true };
}

function oracleMagicMatch(mime: string, header: Buffer): boolean {
  const signatures = MAGIC_BYTES[mime];
  if (!signatures) {
    return false;
  }
  return signatures.some((sig) => {
    if (header.length < sig.length) {
      return false;
    }
    return sig.every((b, i) => b === -1 || header[i] === b);
  });
}

/** Build a multer-like file object. Only `mimetype` and `size` are read. */
function fileOf(mime: string, size: number): Express.Multer.File {
  return { mimetype: mime, size } as Express.Multer.File;
}

/** A valid leading header for each whitelisted MIME (wildcards filled with 0x00). */
function validHeaderFor(mime: string): number[] {
  const sig = MAGIC_BYTES[mime][0];
  return sig.map((b) => (b === -1 ? 0x00 : b));
}

/** Arbitrary MIME drawn from a mix of allowed and clearly-disallowed values. */
const mimeArb = fc.constantFrom(
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'application/octet-stream',
  '',
);

/** Arbitrary header bytes: small enough to keep runs fast, wide value range. */
const headerArb = fc
  .array(fc.integer({ min: 0, max: 255 }), { minLength: 0, maxLength: 16 })
  .map((bytes) => Buffer.from(bytes));

/** Sizes spanning empty, valid, boundary and oversized regions. */
const sizeArb = fc.oneof(
  fc.constant(0),
  fc.constant(1),
  fc.integer({ min: 1, max: PHOTO_MAX_BYTES }),
  fc.constant(PHOTO_MAX_BYTES),
  fc.constant(PHOTO_MAX_BYTES + 1),
  fc.integer({ min: PHOTO_MAX_BYTES + 1, max: PHOTO_MAX_BYTES * 4 }),
);

describe('Property 11: photo upload validation oracle', () => {
  it('matches the reference oracle over arbitrary mime/header/size', () => {
    fc.assert(
      fc.property(mimeArb, headerArb, sizeArb, (mime, header, size) => {
        const actual = validatePhoto(fileOf(mime, size), header);
        const expected = oracle(mime, header, size);
        expect(actual).toEqual(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('accepts well-formed photos with a valid header and in-bounds size', () => {
    const validMimeArb = fc.constantFrom(...WHITELIST);
    fc.assert(
      fc.property(
        validMimeArb,
        fc.integer({ min: 1, max: PHOTO_MAX_BYTES }),
        // Extra trailing bytes after a valid signature must not affect the result.
        fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 8 }),
        (mime, size, trailing) => {
          const header = Buffer.from([...validHeaderFor(mime), ...trailing]);
          const result = validatePhoto(fileOf(mime, size), header);
          expect(result).toEqual({ ok: true });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects disallowed MIME types before any header/size check (415)', () => {
    const badMimeArb = mimeArb.filter((m) => !WHITELIST.includes(m));
    fc.assert(
      fc.property(badMimeArb, headerArb, sizeArb, (mime, header, size) => {
        const result = validatePhoto(fileOf(mime, size), header);
        // MIME failure takes precedence regardless of header/size validity.
        expect(result).toEqual({
          ok: false,
          status: 415,
          reason: 'mime_not_allowed',
        });
      }),
      { numRuns: 100 },
    );
  });

  it('rejects header/magic mismatch with 415 before size bounds are considered', () => {
    const validMimeArb = fc.constantFrom(...WHITELIST);
    fc.assert(
      fc.property(
        validMimeArb,
        // Headers that do NOT match the signature for the chosen mime.
        fc
          .array(fc.integer({ min: 0, max: 255 }), { minLength: 0, maxLength: 16 })
          .map((b) => Buffer.from(b)),
        sizeArb,
        (mime, header, size) => {
          fc.pre(!oracleMagicMatch(mime, header));
          const result = validatePhoto(fileOf(mime, size), header);
          expect(result).toEqual({
            ok: false,
            status: 415,
            reason: 'magic_mismatch',
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects empty and oversized files with 413 when mime+magic are valid', () => {
    const validMimeArb = fc.constantFrom(...WHITELIST);
    const outOfBoundsSizeArb = fc.oneof(
      fc.constant(0),
      fc.integer({ min: PHOTO_MAX_BYTES + 1, max: PHOTO_MAX_BYTES * 4 }),
    );
    fc.assert(
      fc.property(validMimeArb, outOfBoundsSizeArb, (mime, size) => {
        const header = Buffer.from(validHeaderFor(mime));
        const result = validatePhoto(fileOf(mime, size), header);
        const expectedReason = size < 1 ? 'empty' : 'too_large';
        expect(result).toEqual({
          ok: false,
          status: 413,
          reason: expectedReason,
        });
      }),
      { numRuns: 100 },
    );
  });
});
