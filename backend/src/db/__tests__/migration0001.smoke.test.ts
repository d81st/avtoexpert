import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  authFailures,
  photos,
  reports,
} from '../schema';

/**
 * Smoke test for migration completeness (task 1.3).
 *
 * Verifies that migration `0001_platform_improvements_mvp.sql` and the Drizzle
 * schema in `schema.ts` agree on the shape introduced by tasks 1.1 / 1.2:
 *   - `reports.version`
 *   - photo metadata columns (`sequence_number`, `original_name`, `byte_size`, `mime_type`)
 *   - new table `auth_failures`
 *   - the required indexes
 *
 * Requirements: 2.12, 4.6, 6.10/6.12
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  here,
  '../../../drizzle/0001_platform_improvements_mvp.sql',
);
const migrationSql = readFileSync(migrationPath, 'utf8');

/** Column DB names for a Drizzle pg table. */
function columnNames(table: Parameters<typeof getTableColumns>[0]): string[] {
  return Object.values(getTableColumns(table)).map((c) => c.name);
}

describe('migration 0001 — schema shape (schema.ts)', () => {
  it('reports has the optimistic-concurrency version column (R2.12)', () => {
    expect(columnNames(reports)).toContain('version');
  });

  it('photos has all required metadata columns (R4.6)', () => {
    const cols = columnNames(photos);
    for (const col of ['sequence_number', 'original_name', 'byte_size', 'mime_type']) {
      expect(cols).toContain(col);
    }
  });

  it('auth_failures table is defined with its columns (R6.10/R6.12)', () => {
    const cols = columnNames(authFailures);
    for (const col of ['id', 'email', 'client_ip', 'user_agent', 'created_at']) {
      expect(cols).toContain(col);
    }
  });
});

describe('migration 0001 — SQL DDL (0001_platform_improvements_mvp.sql)', () => {
  it('adds reports.version with a default and NOT NULL (R2.12)', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE "reports" ADD COLUMN "version" integer DEFAULT 0 NOT NULL/i,
    );
  });

  it('adds all four photo metadata columns (R4.6)', () => {
    expect(migrationSql).toMatch(/ALTER TABLE "photos" ADD COLUMN "sequence_number" integer/i);
    expect(migrationSql).toMatch(/ALTER TABLE "photos" ADD COLUMN "original_name" varchar\(255\)/i);
    expect(migrationSql).toMatch(/ALTER TABLE "photos" ADD COLUMN "byte_size" integer/i);
    expect(migrationSql).toMatch(/ALTER TABLE "photos" ADD COLUMN "mime_type" varchar\(64\)/i);
  });

  it('enforces NOT NULL on the backfilled photo metadata columns (R4.6)', () => {
    expect(migrationSql).toMatch(/ALTER TABLE "photos" ALTER COLUMN "sequence_number" SET NOT NULL/i);
    expect(migrationSql).toMatch(/ALTER TABLE "photos" ALTER COLUMN "byte_size" SET NOT NULL/i);
    expect(migrationSql).toMatch(/ALTER TABLE "photos" ALTER COLUMN "mime_type" SET NOT NULL/i);
  });

  it('creates the auth_failures table (R6.10/R6.12)', () => {
    expect(migrationSql).toMatch(/CREATE TABLE "auth_failures"/i);
  });

  it('creates all required indexes', () => {
    expect(migrationSql).toMatch(/CREATE UNIQUE INDEX "photos_report_seq_uniq"/i);
    expect(migrationSql).toMatch(/CREATE INDEX "auth_failures_ip_time"/i);
    expect(migrationSql).toMatch(/CREATE INDEX "auth_failures_email_time"/i);
  });
});
