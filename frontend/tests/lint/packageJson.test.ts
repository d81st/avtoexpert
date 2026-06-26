import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Smoke test for the frontend Biome migration package.json invariants.
 *
 * Covers acceptance criteria:
 *  - R7.1: `frontend/package.json` MUST NOT list any ESLint/Prettier packages
 *          in `dependencies` or `devDependencies` (eslint, prettier,
 *          @typescript-eslint, globals, and eslint-/prettier- prefixed plugins).
 *  - R7.4: `@biomejs/biome` MUST be present in `devDependencies` with a spec
 *          string that pins exactly one major version (no `*`, `latest`, or
 *          ranges spanning more than one major).
 *  - R7.5: `scripts.lint` MUST run `biome check .` and `scripts.format` MUST
 *          run `biome format --write .`.
 *
 * **Validates: Requirements 7.1, 7.4, 7.5**
 */

const PKG_PATH = path.resolve(process.cwd(), 'package.json');

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

const pkg: PackageJson = JSON.parse(readFileSync(PKG_PATH, 'utf8'));

// Matches any package name that belongs to the ESLint/Prettier toolchain that
// the migration removes: bare `eslint`/`prettier`, the `@typescript-eslint`
// scope, the `globals` helper, and any `eslint-*` / `prettier-*` plugin/config.
const FORBIDDEN_PACKAGE = /^(eslint|prettier|@typescript-eslint|globals)(\b|[-/])|^(eslint-|prettier-)/;

/**
 * Returns the set of major versions a npm spec string can resolve to, or
 * `null` when the spec is unbounded / spans more than a single major (which
 * the design forbids for the Biome pin).
 *
 * Handles the common single-major forms: exact (`2.5.0`), caret (`^2.5.0`),
 * tilde (`~2.5.0`), and `x`-ranges (`2.x`, `2.5.x`). Everything else
 * (`*`, `latest`, `>=`, `<`, hyphen ranges, `||` unions) is treated as
 * not-single-major.
 */
function pinnedMajor(spec: string): number | null {
  const trimmed = spec.trim();
  if (trimmed === '' || trimmed === '*' || trimmed === 'latest') {
    return null;
  }
  // Reject unions and open-ended/hyphen range operators outright.
  if (/\|\||\s-\s|[<>]/.test(trimmed)) {
    return null;
  }
  const match = trimmed.match(/^[\^~]?(\d+)(?:\.(?:\d+|x|X|\*))?(?:\.(?:\d+|x|X|\*))?/);
  if (!match) {
    return null;
  }
  // A pure `x`/`*` major (e.g. `x`, `x.y`) has no concrete major to pin.
  return Number.parseInt(match[1], 10);
}

describe('frontend package.json Biome migration invariants', () => {
  it('lists no ESLint/Prettier packages in dependencies or devDependencies (R7.1)', () => {
    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    const offenders = Object.keys(allDeps).filter((name) =>
      FORBIDDEN_PACKAGE.test(name),
    );

    expect(offenders).toEqual([]);
  });

  it('pins @biomejs/biome to a single major version in devDependencies (R7.4)', () => {
    const spec = pkg.devDependencies?.['@biomejs/biome'];
    expect(spec, '@biomejs/biome must be a devDependency').toBeDefined();

    const major = pinnedMajor(spec as string);
    expect(
      major,
      `@biomejs/biome version "${spec}" must pin exactly one major version`,
    ).not.toBeNull();
    expect(Number.isInteger(major)).toBe(true);
  });

  it('defines lint and format scripts that invoke Biome (R7.5)', () => {
    expect(pkg.scripts?.lint).toBe('biome check .');
    expect(pkg.scripts?.format).toBe('biome format --write .');
  });
});
