import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';

/**
 * Unit test verifying the placeholder inventory of `Docx_Template_V3`
 * (spec `docx-photo-slots`, task 4.2, requirements R3.3–R3.5).
 *
 * `Docx_Template_V3` (the current revision of `original_example.docx`)
 * contains exactly 12 docxtemplater tokens:
 *
 *   - 6 raw image tags:  `{%photo_1}` … `{%photo_6}`
 *   - 6 scalar captions: `{caption_1}` … `{caption_6}`
 *
 * The legacy append-loop tokens `{#photos}`, `{/photos}`, `{%image}` and
 * the bare-name `{caption}` MUST NOT appear. No `{%photo_K}` or
 * `{caption_K}` for `K ∉ {1..6}` is allowed.
 *
 * The authoritative inventory is mirrored in `backend/templates/README.md`
 * (R3.1, R3.2); the README pinning sub-test ensures the human-readable
 * documentation stays in sync with the binary template.
 *
 * Requirements: 3.3, 3.4, 3.5
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '../../../..');
const templatePath = path.join(
  backendRoot,
  'templates',
  'original_example.docx',
);
const readmePath = path.join(backendRoot, 'templates', 'README.md');

/**
 * Pinned `Docx_Template_V3` placeholder inventory. Token -> exact
 * occurrence count.
 */
const PINNED_INVENTORY: Record<string, number> = {
  '{%photo_1}': 1,
  '{%photo_2}': 1,
  '{%photo_3}': 1,
  '{%photo_4}': 1,
  '{%photo_5}': 1,
  '{%photo_6}': 1,
  '{caption_1}': 1,
  '{caption_2}': 1,
  '{caption_3}': 1,
  '{caption_4}': 1,
  '{caption_5}': 1,
  '{caption_6}': 1,
};

/** Legacy append-loop tokens explicitly forbidden by R3.4. */
const FORBIDDEN_LEGACY_TOKENS = [
  '{#photos}',
  '{/photos}',
  '{%image}',
  '{caption}',
] as const;

/**
 * Extract docxtemplater placeholder tokens from the template, mirroring
 * `backend/scripts/inventory-placeholders.cjs`:
 *   1. scan ZIP parts `word/(document|header\d*|footer\d*).xml`
 *   2. strip XML tags so split-across-runs tokens and GUID attribute braces
 *      (which live inside tags) are excluded
 *   3. regex `{...}` tokens including loop/raw/inverted prefixes # / % ^
 */
function extractPlaceholders(buffer: Buffer): Map<string, number> {
  const zip = new PizZip(buffer);
  const partNames = Object.keys(zip.files).filter((n) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(n),
  );

  const tokens = new Map<string, number>();
  const tokenRe = /\{[#/%^]?[^{}]+\}/g;

  for (const name of partNames) {
    const xml = zip.file(name)?.asText() ?? '';
    const text = xml.replace(/<[^>]+>/g, '');
    for (const m of text.matchAll(tokenRe)) {
      const tok = m[0];
      tokens.set(tok, (tokens.get(tok) ?? 0) + 1);
    }
  }
  return tokens;
}

describe('Docx_Template_V3 placeholder inventory (R3.3, R3.4, R3.5)', () => {
  const extracted = extractPlaceholders(readFileSync(templatePath));

  it('R3.3: extracts exactly the 12 V3 slot/caption tokens, one occurrence each', () => {
    const extractedObj = Object.fromEntries(
      [...extracted.entries()].sort(([a], [b]) => a.localeCompare(b)),
    );
    expect(extractedObj).toEqual(PINNED_INVENTORY);
  });

  it('R3.4: contains none of the legacy append-loop tokens', () => {
    for (const token of FORBIDDEN_LEGACY_TOKENS) {
      expect(extracted.has(token)).toBe(false);
    }
  });

  it('R3.5: no {%photo_K} or {caption_K} for K ∉ {1..6}', () => {
    const photoRe = /^\{%photo_(\d+)\}$/;
    const captionRe = /^\{caption_(\d+)\}$/;
    const offendingPhotoSlots: string[] = [];
    const offendingCaptionSlots: string[] = [];

    for (const token of extracted.keys()) {
      const pm = token.match(photoRe);
      if (pm) {
        const n = Number(pm[1]);
        if (!Number.isInteger(n) || n < 1 || n > 6) {
          offendingPhotoSlots.push(token);
        }
        continue;
      }
      const cm = token.match(captionRe);
      if (cm) {
        const n = Number(cm[1]);
        if (!Number.isInteger(n) || n < 1 || n > 6) {
          offendingCaptionSlots.push(token);
        }
      }
    }

    expect(offendingPhotoSlots).toEqual([]);
    expect(offendingCaptionSlots).toEqual([]);
  });
});

describe('Docx_Template_V3 README pinning (R3.3, R3.4)', () => {
  it('templates/README.md lists all 12 V3 tokens in the authoritative inventory', () => {
    const readme = readFileSync(readmePath, 'utf8');
    for (const token of Object.keys(PINNED_INVENTORY)) {
      expect(readme).toContain(token);
    }
  });

  it('templates/README.md does not advertise any legacy append-loop token as present in the active template', () => {
    const readme = readFileSync(readmePath, 'utf8');
    // The README may still mention legacy tokens in a historical/contextual
    // note, but the authoritative inventory tables must not list them.
    // Conservative check: legacy tokens must not appear in any markdown table
    // row (lines starting with `|` containing the token).
    const tableLines = readme
      .split(/\r?\n/)
      .filter((line) => line.trimStart().startsWith('|'));
    for (const token of FORBIDDEN_LEGACY_TOKENS) {
      const offending = tableLines.filter((line) => line.includes(token));
      expect(offending).toEqual([]);
    }
  });
});
