import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  GROUP_COLUMNS,
  TABLE_MAX_ROWS,
  TableMapperError,
  type TableMapperErrorReason,
  precheckTables,
} from '../../../src/modules/reports/tableMapper';

/**
 * Feature: platform-improvements-mvp, Property 17: Table_Mapper input-bounds and
 * resolution errors.
 *
 * For any input that violates the table contract — a repeating-row group longer
 * than {@link TABLE_MAX_ROWS} (R5.4), OR a scalar placeholder value of
 * `null` / `undefined` / `array` / `object` (R5.9) — `precheckTables(...)` MUST
 * throw a {@link TableMapperError} carrying the group/placeholder name and (for
 * cell errors) the 1-based row and column indices, AND no document buffer MUST
 * be produced (here: the precheck throws before `doc.render()` is ever reached,
 * so it returns no value).
 *
 * Validates: Requirements 5.4, 5.9
 */

/** The four canonical repeating-row groups passed to precheckTables. */
const GROUP_NAMES = Object.keys(GROUP_COLUMNS);

const groupArb = fc.constantFrom(...GROUP_NAMES);

/** A bad scalar value paired with the reason precheckTables must report. */
const badCellArb: fc.Arbitrary<{
  value: unknown;
  reason: TableMapperErrorReason;
}> = fc.oneof(
  fc.constant({ value: null, reason: 'null' as const }),
  fc.constant({ value: undefined, reason: 'undefined' as const }),
  fc
    .array(fc.string(), { maxLength: 3 })
    .map((a) => ({ value: a, reason: 'array_for_scalar' as const })),
  fc
    .dictionary(fc.string(), fc.string(), { maxKeys: 3 })
    .map((o) => ({ value: o, reason: 'object_for_scalar' as const })),
);

/** Build a row whose every column holds a valid (non-empty) scalar string. */
function validRow(columns: readonly string[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const col of columns) {
    row[col] = `val_${col}`;
  }
  return row;
}

describe('Property 17: Table_Mapper input-bounds and resolution errors', () => {
  it('throws group_too_long naming the group and actual length when length > TABLE_MAX_ROWS (R5.4)', () => {
    fc.assert(
      fc.property(
        groupArb,
        fc.integer({ min: TABLE_MAX_ROWS + 1, max: 100_000 }),
        (tableName, length) => {
          const columns = GROUP_COLUMNS[tableName];
          // A single shared valid row object — the length guard fires before any
          // per-cell iteration, so the row contents are irrelevant here.
          const group = new Array(length).fill(validRow(columns));
          const data = { [tableName]: group };

          let thrown: unknown;
          try {
            precheckTables(data, GROUP_NAMES);
          } catch (err) {
            thrown = err;
          }

          expect(thrown).toBeInstanceOf(TableMapperError);
          const error = thrown as TableMapperError;
          expect(error.reason).toBe('group_too_long');
          expect(error.placeholder.tableName).toBe(tableName);
          // Message must surface the group name and the actual array length.
          expect(error.message).toContain(tableName);
          expect(error.message).toContain(String(length));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('throws a resolution error with the placeholder id and 1-based row/col when a scalar cell is null/undefined/array/object (R5.9)', () => {
    fc.assert(
      fc.property(
        groupArb,
        fc.integer({ min: 1, max: 20 }), // number of rows
        fc.nat(), // raw row selector
        fc.nat(), // raw column selector
        badCellArb,
        (tableName, numRows, rawRow, rawCol, bad) => {
          const columns = GROUP_COLUMNS[tableName];
          const targetRow = rawRow % numRows;
          const targetCol = rawCol % columns.length;
          const targetField = columns[targetCol];

          // Every cell is a valid scalar except the single injected bad cell;
          // since iteration is row-major and throws on the first offender, the
          // injected cell is exactly the one reported.
          const group = Array.from({ length: numRows }, () => validRow(columns));
          group[targetRow][targetField] = bad.value;

          const data = { [tableName]: group };

          let thrown: unknown;
          try {
            precheckTables(data, GROUP_NAMES);
          } catch (err) {
            thrown = err;
          }

          expect(thrown).toBeInstanceOf(TableMapperError);
          const error = thrown as TableMapperError;

          // Structured diagnostics.
          expect(error.reason).toBe(bad.reason);
          expect(error.placeholder.tableName).toBe(tableName);
          expect(error.placeholder.row).toBe(targetRow + 1); // 1-based row
          expect(error.placeholder.col).toBe(targetCol + 1); // 1-based col
          expect(error.placeholder.name).toBe(
            `${tableName}.${targetRow}.${targetField}`,
          );

          // Message shape: group name, placeholder id, and 1-based indices.
          expect(error.message).toContain(tableName);
          expect(error.message).toContain(`${tableName}.${targetRow}.${targetField}`);
          expect(error.message).toContain(`r${targetRow + 1}`);
          expect(error.message).toContain(`c${targetCol + 1}`);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('does not throw for well-formed groups within bounds (complement, incl. the TABLE_MAX_ROWS boundary)', () => {
    fc.assert(
      fc.property(
        groupArb,
        // Bias toward the exact boundary (10000) plus a small in-bounds range.
        fc.oneof(
          fc.constant(0),
          fc.constant(TABLE_MAX_ROWS),
          fc.integer({ min: 1, max: 50 }),
        ),
        (tableName, length) => {
          const columns = GROUP_COLUMNS[tableName];
          const group = Array.from({ length }, () => validRow(columns));
          const data = { [tableName]: group };
          expect(() => precheckTables(data, GROUP_NAMES)).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});
