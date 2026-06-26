// Temporary fixture used to validate scripts/check-sql-raw.sh detection.
// DO NOT KEEP THIS FILE.

import { sql } from 'drizzle-orm';

// SAFE — single-quoted literal.
const a = sql.raw('SELECT 1');

// SAFE — double-quoted literal.
const b = sql.raw("SELECT 2");

// SAFE — backtick literal without interpolation.
const c = sql.raw(`SELECT 3`);

// VIOLATION — backtick template with ${} interpolation.
const userInput = 'x';
const d = sql.raw(`SELECT * FROM t WHERE col = ${userInput}`);

// VIOLATION — bare identifier argument.
const someQuery = 'SELECT 4';
const e = sql.raw(someQuery);

// VIOLATION — function call argument.
function build(): string { return 'q'; }
const f = sql.raw(build());

// VIOLATION — argument continues on the next line.
const g = sql.raw(
  'SELECT 5',
);

// Two occurrences on one line: first safe, second a violation.
const h = (sql.raw('ok'), sql.raw(userInput));
