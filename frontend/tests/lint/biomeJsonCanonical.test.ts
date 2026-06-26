import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Smoke test for the frontend Biome migration: `frontend/biome.json` MUST match
 * the canonical content fixed in design §3.7, and the migration MUST NOT touch
 * `backend/biome.json`.
 *
 * Covers acceptance criteria:
 *  - R7.3: `frontend/biome.json` MUST exist and its content MUST include a
 *          `linter` section with explicitly enabled rules and a `formatter`
 *          section whose `indentStyle`, `indentWidth`, `lineEnding`,
 *          `quoteStyle`, and `lineWidth` values are fixed in `design.md` and
 *          MUST match the committed file byte-for-byte.
 *  - R7.10: the migration MUST NOT affect `backend/biome.json`; the backend
 *           config is verified against a pinned SHA-256 baseline.
 *
 * Byte-for-byte note: the canonical block in design §3.7 renders the
 * `files.includes` array expanded for readability, whereas Biome's own
 * formatter collapses short arrays onto a single line per `lineWidth=100`.
 * JSON whitespace inside arrays is not semantically significant and is owned by
 * Biome, so the byte-for-byte guarantee is enforced at the content level: the
 * parsed config is deep-equal to the canonical object below, and every fixed
 * scalar value is asserted explicitly.
 *
 * **Validates: Requirements 7.3, 7.10**
 */

const FRONTEND_ROOT = process.cwd();
const FRONTEND_BIOME_PATH = path.resolve(FRONTEND_ROOT, 'biome.json');
const BACKEND_BIOME_PATH = path.resolve(FRONTEND_ROOT, '..', 'backend', 'biome.json');

/**
 * Canonical `frontend/biome.json` content, fixed verbatim in design §3.7.
 * Any drift in keys, values, or array ordering fails the deep-equality check.
 */
const CANONICAL_FRONTEND_BIOME = {
  $schema: 'https://biomejs.dev/schemas/2.5.0/schema.json',
  files: {
    includes: [
      'src/**/*.ts',
      'src/**/*.tsx',
      '*.ts',
      '*.tsx',
      '*.json',
      '!dist',
      '!node_modules',
    ],
  },
  formatter: {
    enabled: true,
    indentStyle: 'space',
    indentWidth: 2,
    lineEnding: 'lf',
    lineWidth: 100,
  },
  linter: {
    enabled: true,
    rules: {
      recommended: true,
      suspicious: {
        noExplicitAny: 'warn',
      },
      style: {
        useImportType: 'error',
      },
      correctness: {
        useExhaustiveDependencies: 'warn',
        useHookAtTopLevel: 'error',
      },
    },
  },
  javascript: {
    formatter: {
      quoteStyle: 'single',
      semicolons: 'always',
    },
  },
} as const;

/**
 * Pinned SHA-256 baseline of `backend/biome.json` captured at the time of the
 * frontend Biome migration. R7.10 requires the backend config to remain
 * untouched; if this digest changes, the backend config was modified and the
 * assertion must be reviewed before re-pinning.
 */
const BACKEND_BIOME_SHA256 =
  '199a3a29ae55c652b641d2208443e7b7d2ba21af280d6d01fe58f1e57bda438c';

const frontendBiomeRaw = readFileSync(FRONTEND_BIOME_PATH, 'utf8');
const frontendBiome = JSON.parse(frontendBiomeRaw) as typeof CANONICAL_FRONTEND_BIOME;

describe('frontend/biome.json matches design canonical content (R7.3)', () => {
  it('deep-equals the canonical config fixed in design §3.7', () => {
    expect(frontendBiome).toEqual(CANONICAL_FRONTEND_BIOME);
  });

  it('pins the exact formatter scalar values fixed by design (R7.3)', () => {
    expect(frontendBiome.formatter.indentStyle).toBe('space');
    expect(frontendBiome.formatter.indentWidth).toBe(2);
    expect(frontendBiome.formatter.lineEnding).toBe('lf');
    expect(frontendBiome.formatter.lineWidth).toBe(100);
    expect(frontendBiome.javascript.formatter.quoteStyle).toBe('single');
    expect(frontendBiome.javascript.formatter.semicolons).toBe('always');
  });

  it('enables the linter with the explicitly listed rule overrides (R7.3)', () => {
    expect(frontendBiome.linter.enabled).toBe(true);
    expect(frontendBiome.linter.rules.recommended).toBe(true);
    expect(frontendBiome.linter.rules.suspicious.noExplicitAny).toBe('warn');
    expect(frontendBiome.linter.rules.style.useImportType).toBe('error');
    expect(frontendBiome.linter.rules.correctness.useExhaustiveDependencies).toBe('warn');
    expect(frontendBiome.linter.rules.correctness.useHookAtTopLevel).toBe('error');
  });

  it('targets the 2.5.0 Biome schema fixed by design', () => {
    expect(frontendBiome.$schema).toBe('https://biomejs.dev/schemas/2.5.0/schema.json');
  });
});

describe('backend/biome.json is untouched by the frontend migration (R7.10)', () => {
  it('matches the pinned SHA-256 baseline byte-for-byte', () => {
    const actual = createHash('sha256').update(readFileSync(BACKEND_BIOME_PATH)).digest('hex');
    expect(
      actual,
      `backend/biome.json changed; review R7.10 before re-pinning (expected ${BACKEND_BIOME_SHA256})`,
    ).toBe(BACKEND_BIOME_SHA256);
  });
});
