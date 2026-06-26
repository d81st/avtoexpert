import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';

/**
 * Unit test verifying the placeholder inventory of Docx_Template_V2 (task 7.5).
 *
 * Task 7.3 pinned the authoritative inventory in `backend/templates/README.md`:
 * the active template `original_example.docx` contains exactly the
 * Photo_Insertion_Block — `{#photos}`×1, `{%image}`×1, `{caption}`×1,
 * `{/photos}`×1 — and NO legacy `photo_N` slots (N = 0).
 *
 * This test extracts the docxtemplater placeholders from `original_example.docx`
 * via `pizzip` (mirroring `backend/scripts/inventory-placeholders.cjs`) and
 * asserts the extracted set matches the inventory pinned in the README.
 *
 * Requirements: 3.4
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
 * The authoritative placeholder inventory pinned by task 7.3 in
 * `backend/templates/README.md`. Token -> expected occurrence count.
 */
const PINNED_INVENTORY: Record<string, number> = {
  '{#photos}': 1,
  '{%image}': 1,
  '{caption}': 1,
  '{/photos}': 1,
};

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
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(text)) !== null) {
      const tok = m[0];
      tokens.set(tok, (tokens.get(tok) ?? 0) + 1);
    }
  }
  return tokens;
}

describe('Docx_Template_V2 placeholder inventory matches README (R3.4)', () => {
  const extracted = extractPlaceholders(readFileSync(templatePath));

  it('extracts exactly the placeholder set pinned in templates/README.md', () => {
    const extractedObj = Object.fromEntries(
      [...extracted.entries()].sort(([a], [b]) => a.localeCompare(b)),
    );
    expect(extractedObj).toEqual(PINNED_INVENTORY);
  });

  it('contains no legacy photo_N slots (N = 0 per README)', () => {
    const legacySlots = [...extracted.keys()].filter((t) =>
      /photo_\d+/.test(t),
    );
    expect(legacySlots).toEqual([]);
  });

  it('pins the same Photo_Insertion_Block tokens in README.md as in the template', () => {
    const readme = readFileSync(readmePath, 'utf8');
    for (const token of Object.keys(PINNED_INVENTORY)) {
      expect(readme).toContain(token);
    }
    // README explicitly records that legacy photo_N slots are absent (N = 0).
    expect(readme).toMatch(/N\s*=\s*0/);
  });
});
