/**
 * Table_Mapper subsystem (Requirement 5).
 *
 * Thin pre-validation layer that runs immediately before `doc.render()` in
 * DocGenerator. It guards the docxtemplater repeating-row groups
 * (`repair_works`, `paint_works`, `spare_parts`, `materials`) against the two
 * failure classes that docxtemplater cannot surface with useful diagnostics:
 *
 *  - R5.4: a repeating-row group longer than {@link TABLE_MAX_ROWS}.
 *  - R5.9: a scalar cell placeholder that resolves to `null`, `undefined`,
 *          an `array` or an `object`.
 *
 * On success `precheckTables` returns nothing; on failure it throws a
 * {@link TableMapperError} carrying the offending group name, placeholder
 * identifier and 1-based row/column indices so the caller can abort generation
 * without modifying the output document or the report's DB state.
 */

/** Maximum number of rows allowed in a single repeating-row group (R5.4). */
export const TABLE_MAX_ROWS = 10_000;

/**
 * Column ordering for each known repeating-row group, matching the placeholder
 * inventory pinned in design §3.3. The position of a field in this list defines
 * its 1-based column index for error reporting (R5.9). Groups not listed here
 * fall back to the row object's own key order.
 */
export const GROUP_COLUMNS: Record<string, readonly string[]> = {
  repair_works: ['part_name', 'part_type', 'complexity', 'price'],
  paint_works: ['part_name', 'paint_price', 'polish_price'],
  spare_parts: ['name', 'qty', 'price'],
  materials: ['name', 'qty', 'price'],
};

/** Identifies a single scalar placeholder inside a table cell. */
export interface CellPlaceholder {
  /** Dotted path of the placeholder, e.g. `repair_works.0.price`. */
  name: string;
  /** Repeating-row group the placeholder belongs to, e.g. `repair_works`. */
  tableName: string;
  /** 1-based row index within the group (R5.9). */
  row: number;
  /** 1-based column index within the row (R5.9). */
  col: number;
}

/** Reason a Table_Mapper precheck failed. */
export type TableMapperErrorReason =
  | 'null'
  | 'undefined'
  | 'array_for_scalar'
  | 'object_for_scalar'
  | 'group_too_long';

/**
 * Error thrown by {@link precheckTables}. Carries structured diagnostics so the
 * caller can map it to an HTTP response (consistent with R3.8) without parsing
 * the message string.
 */
export class TableMapperError extends Error {
  constructor(
    public readonly placeholder: CellPlaceholder,
    public readonly reason: TableMapperErrorReason,
    public readonly observed: unknown,
  ) {
    super(
      reason === 'group_too_long'
        ? `Table_Mapper: group "${placeholder.tableName}" exceeds TABLE_MAX_ROWS (${TABLE_MAX_ROWS}); actual length ${String(observed)}`
        : `Table_Mapper: ${reason} at ${placeholder.tableName} [r${placeholder.row}, c${placeholder.col}] for "${placeholder.name}"`,
    );
    this.name = 'TableMapperError';
    // Restore prototype chain for instanceof checks across transpilation targets.
    Object.setPrototypeOf(this, TableMapperError.prototype);
  }
}

/** True when `value` is a scalar acceptable for a single table cell. */
function classifyScalar(value: unknown): TableMapperErrorReason | null {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array_for_scalar';
  if (typeof value === 'object') return 'object_for_scalar';
  return null;
}

/**
 * Pre-validates the repeating-row groups in `data` before `doc.render()`.
 *
 * @param data       The render scope passed to docxtemplater.
 * @param groupNames The repeating-row group keys to validate, e.g.
 *                   `['repair_works', 'paint_works', 'spare_parts', 'materials']`.
 * @throws {TableMapperError} when a group exceeds {@link TABLE_MAX_ROWS} (R5.4)
 *         or a scalar cell resolves to `null` / `undefined` / array / object (R5.9).
 */
export function precheckTables(
  data: Record<string, unknown>,
  groupNames: readonly string[],
): void {
  for (const tableName of groupNames) {
    const group = data[tableName];

    // Absent or empty groups are valid: docxtemplater removes the template
    // row entirely (R5.6). Only arrays carry rows to validate.
    if (!Array.isArray(group)) {
      continue;
    }

    if (group.length > TABLE_MAX_ROWS) {
      throw new TableMapperError(
        { name: tableName, tableName, row: group.length, col: 0 },
        'group_too_long',
        group.length,
      );
    }

    const columns = GROUP_COLUMNS[tableName];

    group.forEach((rowValue, rowIndex) => {
      const rowRecord =
        rowValue !== null &&
        typeof rowValue === 'object' &&
        !Array.isArray(rowValue)
          ? (rowValue as Record<string, unknown>)
          : {};
      const fields = columns ?? Object.keys(rowRecord);

      fields.forEach((field, colIndex) => {
        const cellValue = rowRecord[field];
        const reason = classifyScalar(cellValue);
        if (reason !== null) {
          throw new TableMapperError(
            {
              name: `${tableName}.${rowIndex}.${field}`,
              tableName,
              row: rowIndex + 1,
              col: colIndex + 1,
            },
            reason,
            cellValue,
          );
        }
      });
    });
  }
}
