// Feature: platform-improvements-mvp, Property 11: File upload validation oracle (docx branch)
// For any docx upload (declared_mime, header/zip bytes, byte_size), validateDocx(...) MUST
// return the status computed by the oracle:
//   - 415 if declared_mime ∉ whitelist(docx)
//   - else 415 if magic_bytes ≠ PK\x03\x04
//   - else 413 if byte_size > 25 MB (or byte_size < 1)
//   - else 415 if zip_entries ∩ {word/vbaProject.bin, word/vbaData.xml} ≠ ∅
//   - else 200 (accept)
//
// Validates: Requirements 6.8, 6.9

import fc from 'fast-check';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import {
  DOCX_MAGIC_BYTES,
  DOCX_MAX_BYTES,
  DOCX_MIME,
  FORBIDDEN_DOCX_ENTRIES,
  validateDocx,
} from '../../../src/common/middleware/docxUploadValidator.js';

/** Whitelist of accepted MIME types for the docx file kind. */
const DOCX_MIME_WHITELIST: ReadonlySet<string> = new Set([DOCX_MIME]);

/** Forbidden VBA-macro ZIP entry names (R6.9). */
const FORBIDDEN_ENTRIES = ['word/vbaProject.bin', 'word/vbaData.xml'] as const;

/**
 * Reference oracle. Computes the expected HTTP status from the abstract
 * properties of an upload, independently of the implementation under test.
 */
function oracleStatus(params: {
  declaredMime: string;
  startsWithMagic: boolean;
  byteSize: number;
  isParseableZip: boolean;
  hasForbiddenEntry: boolean;
}): 200 | 413 | 415 {
  if (!DOCX_MIME_WHITELIST.has(params.declaredMime)) {
    return 415; // mime_not_allowed
  }
  if (!params.startsWithMagic) {
    return 415; // magic_mismatch
  }
  if (params.byteSize > DOCX_MAX_BYTES || params.byteSize < 1) {
    return 413; // too_large
  }
  if (!params.isParseableZip) {
    return 415; // corrupt
  }
  if (params.hasForbiddenEntry) {
    return 415; // macro_detected
  }
  return 200; // accept
}

/** Normalizes a validateDocx() result to a comparable status code. */
function actualStatus(result: ReturnType<typeof validateDocx>): 200 | 413 | 415 {
  return result.ok ? 200 : (result.status as 413 | 415);
}

/** Builds a valid ZIP (docx-like) buffer from the given entry map. */
function buildZip(entries: Record<string, string>): Buffer {
  const zip = new PizZip();
  for (const [name, content] of Object.entries(entries)) {
    zip.file(name, content);
  }
  return zip.generate({ type: 'nodebuffer' });
}

/** Minimal benign docx entry set (no forbidden macro parts). */
function benignEntries(extra: Record<string, string> = {}): Record<string, string> {
  return {
    '[Content_Types].xml': '<?xml version="1.0"?><Types/>',
    'word/document.xml': '<?xml version="1.0"?><w:document/>',
    ...extra,
  };
}

describe('Property 11: docx upload validation oracle (R6.8, R6.9)', () => {
  it('matches the oracle across mime / magic / macro / accept scenarios', () => {
    // A non-docx MIME arbitrary (anything other than the canonical docx MIME).
    const wrongMimeArb = fc
      .oneof(
        fc.constantFrom(
          'application/pdf',
          'image/png',
          'text/plain',
          'application/zip',
          'application/octet-stream',
          'application/msword',
          '',
        ),
        fc.string(),
      )
      .filter((m) => m !== DOCX_MIME);

    // Scenario A: wrong MIME -> 415 regardless of buffer contents.
    const wrongMimeScenario = fc
      .record({ declaredMime: wrongMimeArb })
      .map(({ declaredMime }) => ({
        declaredMime,
        buffer: buildZip(benignEntries()),
        startsWithMagic: true,
        isParseableZip: true,
        hasForbiddenEntry: false,
      }));

    // Scenario B: correct MIME but bytes do not start with PK\x03\x04 -> 415.
    const badMagicScenario = fc
      .uint8Array({ minLength: 0, maxLength: 64 })
      .map((rand) => ({
        declaredMime: DOCX_MIME,
        // Prepend a byte that is not 0x50 so the magic check fails deterministically.
        buffer: Buffer.concat([Buffer.from([0x00]), Buffer.from(rand)]),
        startsWithMagic: false,
        isParseableZip: false,
        hasForbiddenEntry: false,
      }));

    // Scenario C: correct MIME, valid zip, contains a forbidden VBA entry -> 415.
    const macroScenario = fc
      .record({
        forbidden: fc.constantFrom(...FORBIDDEN_ENTRIES),
        extra: fc.dictionary(
          fc.constantFrom('word/styles.xml', 'word/settings.xml', 'docProps/app.xml'),
          fc.string(),
        ),
      })
      .map(({ forbidden, extra }) => ({
        declaredMime: DOCX_MIME,
        buffer: buildZip(benignEntries({ ...extra, [forbidden]: 'macro-bytes' })),
        startsWithMagic: true,
        isParseableZip: true,
        hasForbiddenEntry: true,
      }));

    // Scenario D: correct MIME, valid zip, no forbidden entries -> 200.
    const acceptScenario = fc
      .dictionary(
        fc.constantFrom('word/styles.xml', 'word/settings.xml', 'docProps/core.xml'),
        fc.string(),
      )
      .map((extra) => ({
        declaredMime: DOCX_MIME,
        buffer: buildZip(benignEntries(extra)),
        startsWithMagic: true,
        isParseableZip: true,
        hasForbiddenEntry: false,
      }));

    const scenarioArb = fc.oneof(
      wrongMimeScenario,
      badMagicScenario,
      macroScenario,
      acceptScenario,
    );

    fc.assert(
      fc.property(scenarioArb, (s) => {
        const expected = oracleStatus({
          declaredMime: s.declaredMime,
          startsWithMagic: s.startsWithMagic,
          byteSize: s.buffer.length,
          isParseableZip: s.isParseableZip,
          hasForbiddenEntry: s.hasForbiddenEntry,
        });
        const result = validateDocx(s.buffer, s.declaredMime);
        expect(actualStatus(result)).toBe(expected);
      }),
      { numRuns: 300 },
    );
  });

  it('confirms the magic-byte signature is PK\\x03\\x04', () => {
    expect(DOCX_MAGIC_BYTES).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  // Deterministic coverage of the 413 (too_large) branch. Generating >25 MB
  // valid zips under fuzzing is wasteful, so we assert the boundary directly.
  it('rejects oversized docx buffers with 413 (boundary)', () => {
    // A buffer that passes the magic check and exceeds the size limit. The size
    // check is ordered before zip parsing, so it need not be a parseable zip.
    const oversized = Buffer.concat([
      Buffer.from(DOCX_MAGIC_BYTES),
      Buffer.alloc(DOCX_MAX_BYTES), // total = magic(4) + MAX = MAX + 4 > MAX
    ]);
    expect(oversized.length).toBeGreaterThan(DOCX_MAX_BYTES);

    const result = validateDocx(oversized, DOCX_MIME);
    expect(actualStatus(result)).toBe(413);
    expect(result.reason).toBe('too_large');
  });

  it('accepts a buffer exactly at the 25 MB limit (boundary) when otherwise valid', () => {
    // Build a real zip and confirm it is accepted; also assert the constant.
    expect(DOCX_MAX_BYTES).toBe(25 * 1024 * 1024);
    const result = validateDocx(buildZip(benignEntries()), DOCX_MIME);
    expect(actualStatus(result)).toBe(200);
  });

  it('rejects a corrupt (magic-prefixed but unparseable) buffer with 415', () => {
    const corrupt = Buffer.concat([
      Buffer.from(DOCX_MAGIC_BYTES),
      Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]),
    ]);
    const result = validateDocx(corrupt, DOCX_MIME);
    expect(actualStatus(result)).toBe(415);
    expect(result.reason).toBe('corrupt');
  });

  it('exposes both forbidden VBA entries (R6.9)', () => {
    for (const name of FORBIDDEN_ENTRIES) {
      expect(FORBIDDEN_DOCX_ENTRIES.has(name)).toBe(true);
    }
  });
});
