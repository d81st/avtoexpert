import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Smoke test for the frontend Biome migration: ESLint/Prettier config files
 * MUST be absent from the `frontend/` directory after the migration (the
 * configs were deleted in favour of the single `biome.json`).
 *
 * Covers acceptance criteria:
 *  - R7.2: `frontend/` MUST NOT contain ESLint/Prettier config files:
 *          `.eslintrc`, `.eslintrc.{js,cjs,mjs,json,yaml,yml}`,
 *          `eslint.config.{js,cjs,mjs,ts}`, `.prettierrc`,
 *          `.prettierrc.{js,cjs,json,yaml,yml}`, `prettier.config.{js,cjs,mjs}`,
 *          `.eslintignore`, `.prettierignore`.
 *
 * **Validates: Requirements 7.2**
 */

const FRONTEND_ROOT = process.cwd();

// Explicit enumeration of every config file name forbidden by R7.2.
const FORBIDDEN_CONFIG_FILES = [
  // ESLint legacy (.eslintrc) configs
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.mjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  // ESLint flat configs
  'eslint.config.js',
  'eslint.config.cjs',
  'eslint.config.mjs',
  'eslint.config.ts',
  // Prettier configs
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.json',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  // Ignore files
  '.eslintignore',
  '.prettierignore',
];

// Defensive glob-style guard: catch any `.eslintrc*`, `.prettierrc*`,
// `eslint.config.*`, or `prettier.config.*` variant not in the list above.
const FORBIDDEN_PATTERN =
  /^(\.eslintrc|\.prettierrc|eslint\.config\.|prettier\.config\.|\.eslintignore$|\.prettierignore$)/;

describe('frontend ESLint/Prettier config files are absent (R7.2)', () => {
  it('does not contain any enumerated ESLint/Prettier config file', () => {
    const present = FORBIDDEN_CONFIG_FILES.filter((name) =>
      existsSync(path.join(FRONTEND_ROOT, name)),
    );

    expect(present, `unexpected ESLint/Prettier config files: ${present.join(', ')}`).toEqual([]);
  });

  it('has no directory entry matching ESLint/Prettier config patterns', () => {
    const offenders = readdirSync(FRONTEND_ROOT).filter((name) =>
      FORBIDDEN_PATTERN.test(name),
    );

    expect(offenders, `unexpected ESLint/Prettier config entries: ${offenders.join(', ')}`).toEqual(
      [],
    );
  });
});
