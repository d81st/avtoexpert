import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Smoke test for Docx_Template_V1 archival (task 7.4).
 *
 * Verifies the two observable outcomes of Requirement 3.2 / 3.3:
 *   - R3.3: the legacy template `expertise.docx` was moved to
 *     `backend/templates/archive/expertise.docx` (archive presence).
 *   - R3.2: no production source file under `backend/src/**` loads, reads or
 *     references the legacy template `expertise.docx` (V1 absence).
 *
 * Requirements: 3.2, 3.3
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '../../../..');
const archivedTemplatePath = path.join(
  backendRoot,
  'templates',
  'archive',
  'expertise.docx',
);
const srcRoot = path.join(backendRoot, 'src');

// The legacy template file name, assembled at runtime so this test file's own
// source does not register as a "reference" if it were ever scanned.
const LEGACY_TEMPLATE = ['expertise', 'docx'].join('.');

/** Production source files only: TypeScript under src/, excluding test files. */
function collectProductionSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      out.push(...collectProductionSources(full));
      continue;
    }
    if (!/\.(ts|tsx|js|cjs|mjs)$/.test(entry)) continue;
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

describe('Docx template V2 migration — archive presence (R3.3)', () => {
  it('keeps the legacy template archived at templates/archive/expertise.docx', () => {
    expect(existsSync(archivedTemplatePath)).toBe(true);
    expect(statSync(archivedTemplatePath).size).toBeGreaterThan(0);
  });
});

describe('Docx template V2 migration — V1 absence in src/ (R3.2)', () => {
  it('has no production source under backend/src/** referencing expertise.docx', () => {
    const offenders: string[] = [];
    for (const file of collectProductionSources(srcRoot)) {
      const contents = readFileSync(file, 'utf8');
      if (contents.includes(LEGACY_TEMPLATE)) {
        offenders.push(path.relative(backendRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
