# Implementation Plan: remove-audit-subsystem

## Overview

Retire the security-audit subsystem from the backend while preserving the auth lockout gate on `POST /login` bit-for-bit. Each former `auditService.write(...)` call site is replaced in place by a single structured `winston` log line through the existing logger, tagged with `category: 'security'` and the same `event_type` strings. The `audit_events` table is dropped via a new idempotent Drizzle migration. The two parallel lockout property-based tests are rewritten around the gate-only contract.

Implementation language: **TypeScript** (the existing backend stack — `drizzle-orm`, `express`, `winston`, `vitest`, `fast-check`).

The task ordering removes all `auditService` / `auditEvents` references from call sites first, then deletes the audit module and its schema declaration, then generates and finalizes the migration. This sequence keeps the build green at every stage.

## Tasks

- [x] 1. Replace audit writes inside the lockout service
  - [x] 1.1 Rewrite `lockoutService.recordFailure` to emit `logger.warn('auth_lockout', ...)` and drop the audit dedup helper
    - File: `backend/src/modules/auth/lockout.service.ts`
    - Drop `auditService` and `auditEvents` imports; add `logger` import from `../../shared/logger/logger.js`
    - Remove the `lockoutEventKeyCondition` / `lockoutEventExists` private helpers
    - In `recordFailure(key, now)`: insert into `auth_failures` first, then count via the existing `countFailures(key, now)` predicate `(client_ip = key.clientIp OR email = key.email) AND created_at > now − LOCKOUT_WINDOW_MS`; if the count is `≥ LOCKOUT_THRESHOLD`, emit exactly one `logger.warn('auth_lockout', { category: 'security', eventType: 'auth_lockout', emailOrUserId: key.email ?? null, clientIp: key.clientIp, failures, windowMs: LOCKOUT_WINDOW_MS })`
    - Emit unconditionally on every threshold-crossing failure (no per-window dedup)
    - Preserve `isLocked` and `recordSuccess` semantics from the requirements (strict `>` lower bound; `recordSuccess` deletes by the same predicate as `isLocked`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.2, 5.3, 5.10_

- [x] 2. Replace audit writes inside the login route
  - [x] 2.1 Update `POST /login` to emit `auth_failure` / `auth_success` log lines around the existing lockout calls
    - File: `backend/src/modules/auth/auth.routes.ts`
    - Drop the `auditService` import; add `logger` import from `../../shared/logger/logger.js`
    - On the 401 branch: emit exactly one `logger.warn('auth_failure', { category: 'security', eventType: 'auth_failure', emailOrUserId: login, clientIp, userAgent })` **before** invoking `lockoutService.recordFailure(lockoutKey)`; `userAgent` falls back to `null` when the header is absent
    - On the success branch: emit exactly one `logger.info('auth_success', { category: 'security', eventType: 'auth_success', actorUserId: creator.id, emailOrUserId: login, clientIp, userAgent })` **after** invoking `lockoutService.recordSuccess(lockoutKey)`
    - Preserve the existing lockout-check-before-`authService.login` ordering and the 429 response with the constant `Retry-After: LOCKOUT_RETRY_AFTER_SECONDS` (no recordFailure / recordSuccess side effects on the locked branch)
    - _Requirements: 1.6, 1.7, 1.8, 5.1, 5.4, 5.10_

- [x] 3. Replace audit writes inside the admin service
  - [x] 3.1 Substitute the four `auditService.write` calls in `admin.service.ts` with `logger.info` calls
    - File: `backend/src/modules/admin/admin.service.ts`
    - Drop the `auditService` import; add `logger` import from `../../shared/logger/logger.js`
    - `uploadTemplate`: after the file write completes, emit `logger.info('template_publish', { category: 'security', eventType: 'template_publish', actorUserId, targetResourceId: TEMPLATE_FILE_NAME, beforeValue, afterValue })`
    - `updateCreatorRole`: after the role update has persisted, emit `logger.info('role_change', { category: 'security', eventType: 'role_change', actorUserId, targetResourceId: creatorId, beforeValue: { role: existing.role }, afterValue: { role: updated.role } })`
    - `changeReportOwner`: after the owner update has persisted, emit `logger.info('report_owner_change', { category: 'security', eventType: 'report_owner_change', actorUserId, targetResourceId: reportId, beforeValue: { creator_id: existing.creatorId }, afterValue: { creator_id: updated.creatorId } })`
    - `deleteReport`: after the deletion has persisted, emit `logger.info('report_deletion', { category: 'security', eventType: 'report_deletion', actorUserId, targetResourceId: reportId, beforeValue: { id, creator_id, report_number, status }, afterValue: null })`
    - Each log line emits **only on success** — if the underlying operation throws or rejects, no log line is emitted
    - _Requirements: 5.5, 5.6, 5.7, 5.8, 5.9_

- [x] 4. Remove the daily retention cron and its environment variable
  - [x] 4.1 Remove `AUDIT_RETENTION_CRON_ENABLED` from the env schema
    - File: `backend/src/config/env.ts`
    - Delete the `AUDIT_RETENTION_CRON_ENABLED` Zod field and its leading comment block from `envSchema`
    - _Requirements: 3.1, 3.5_
  - [x] 4.2 Strip the cron block and `AUDIT_RETENTION_*` constants from `server.ts`
    - File: `backend/src/server.ts`
    - Remove imports of `auditService` and `runAuditRetentionCleanup`; remove the `AUDIT_RETENTION_DAYS` and `AUDIT_RETENTION_INTERVAL_MS` constants
    - Remove the entire `if (env.AUDIT_RETENTION_CRON_ENABLED) { … } else { … }` block, including the immediate kick-off `runAuditRetentionCleanup(...)` call, the `setInterval`, the `timer.unref()`, and the `audit_retention_cron_started` / `audit_retention_cron_disabled` / `audit_retention_cleanup_failed` log calls
    - Final `server.ts` only imports `buildApp`, `env`, `logger` and binds the HTTP listener with the existing `"Server running on port …"` and `"Environment: …"` log lines
    - _Requirements: 3.1, 3.3, 3.4_
  - [x] 4.3 Delete the `AUDIT_RETENTION_CRON_ENABLED` line and its 2-line `#`-prefixed comment from `backend/.env.example`
    - _Requirements: 3.2_

- [x] 5. Checkpoint - server boots cleanly with no `AUDIT_RETENTION_` references
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Rewrite the lockout PBTs and trim the migration0001 smoke test
  - [x] 6.1 Rewrite `backend/src/modules/auth/lockout.property.test.ts`
    - **Property 1: Gate threshold** — `isLocked(key, now) ⇔ windowCount(key, now) ≥ LOCKOUT_THRESHOLD` over `auth_failures` only
    - **Property 2: Counter reset on success** — immediately after `recordSuccess(key)`, the next `isLocked(key, now)` returns `false` until at least `LOCKOUT_THRESHOLD` further failures accumulate
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 6.1, 6.2**
    - Drop the `audit_events` column descriptor from the hoisted in-memory store; remove any `vi.mock` targeting a path ending in `modules/audit/audit.service.js` or `modules/audit/audit.repository.js`
    - Refactor the reference model to a `LockoutModel` that tracks only failure timestamps (no `events` array, no per-window dedup expectation)
    - Rewrite the fast-check command sequence over `{ kind: 'fail' | 'success' | 'check', deltaMs: ℕ }`; ensure the `Lockout_Key` generator produces at least one sequence in which two keys differ only by `client_ip` and at least one in which two keys differ only by `email`
    - Assertions: (a) `isLocked ⇔ windowCount ≥ LOCKOUT_THRESHOLD`; (b) `isLocked === false` immediately after `recordSuccess`; (c) failures at `t ≤ now − LOCKOUT_WINDOW_MS` do not contribute to the threshold
    - Keep the concrete unit cases — locks-on-5th-not-4th, recordSuccess resets, outside-window-doesn't-count, re-lock-after-window — with all audit-row assertions stripped
    - _Requirements: 6.1, 6.2, 6.7_
  - [x] 6.2 Rewrite `backend/tests/unit/auth/lockout.property.test.ts` in the same shape
    - **Property 1: Gate threshold**
    - **Property 2: Counter reset on success**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 6.1, 6.3**
    - Drop the `audits: AuditRow[]` store, the `auditEvents` column-marker block, and the `vi.mock('../../../src/modules/audit/audit.service.js', …)` block
    - Drop the oracle's `audits: number[]` array and every assertion comparing `r.auditCount()` / `r.auditTimes()` against the model
    - `FailCommand.run`: keep `expect(await r.isLocked()).toBe(count >= THRESHOLD)`; remove the "consecutive events ≥ one window apart" loop
    - `SuccessCommand.run`: keep `expect(await r.isLocked()).toBe(false)`; remove the audit-count assertion
    - `CheckCommand.run`: keep `expect(await r.isLocked()).toBe(windowCount(m) >= THRESHOLD)`; remove the audit-count assertion
    - Ensure the `Lockout_Key` generator still produces the `client_ip`-only and `email`-only differing-key variations
    - Update the file-level docstring to reference only the gate contract (no "exactly one row per window" sentence)
    - _Requirements: 6.1, 6.3, 6.7_
  - [ ]* 6.3 Add a `vi.spyOn(logger, 'warn')` canary for the `auth_lockout` log substitution
    - File: either `backend/src/modules/auth/lockout.property.test.ts` or `backend/tests/unit/auth/lockout.property.test.ts`
    - **Property 7: Logger contract** (subset — `auth_lockout` call site)
    - **Validates: Requirements 5.2, 5.3**
    - Assert that crossing the threshold causes at least one `logger.warn` call whose first argument is `'auth_lockout'` and whose second argument has shape `{ category: 'security', eventType: 'auth_lockout', emailOrUserId, clientIp, failures, windowMs }`; assert that failures strictly below the threshold cause zero `auth_lockout` calls
    - _Requirements: 5.2, 5.3_
  - [x] 6.4 Trim the audit assertions from `backend/src/db/__tests__/migration0001.smoke.test.ts`
    - Drop `auditEvents` from the `schema` import
    - Delete the test case asserting "audit_events table is defined with its columns"
    - Delete the test case asserting "creates the audit_events table"
    - Inside "creates all required indexes", remove the two `expect(migrationSql).toMatch(/CREATE INDEX "audit_events_(type_time|time)"/i)` lines
    - _Requirements: 6.6_

- [x] 7. Delete the audit module and remove its schema declaration
  - [x] 7.1 Remove the `auditEvents` `pgTable` block from `backend/src/db/schema.ts`
    - Delete the entire `export const auditEvents = pgTable('audit_events', ...)` declaration and its two index callbacks (`audit_events_type_time`, `audit_events_time`)
    - Drop `jsonb` from the `drizzle-orm/pg-core` import (no other table uses it after this change)
    - Retain all other Drizzle imports still used by `auth_failures` and the surviving tables
    - _Requirements: 2.1_
  - [x] 7.2 Delete the entire `backend/src/modules/audit/` directory
    - Removes `audit.service.ts`, `audit.repository.ts`, `audit.service.property.test.ts`, `audit.retention.property.test.ts`
    - _Requirements: 2.4, 6.4_
  - [x] 7.3 Delete `backend/tests/unit/audit/` directory and any `*.property.test.ts` it contains
    - Removes the duplicate `auditService.property.test.ts` and any sibling audit PBTs
    - _Requirements: 6.5_

- [x] 8. Add migration 0003 to drop `audit_events`
  - [x] 8.1 Generate, hand-author, and align migration 0003
    - Run `npm run db:generate` from the `backend` workspace; drizzle-kit will append a new entry to `backend/drizzle/meta/_journal.json`, write `backend/drizzle/meta/0003_snapshot.json` reflecting the post-drop schema state, and emit a `0003_*.sql` skeleton
    - Rename the emitted SQL file to `backend/drizzle/0003_remove_audit_events.sql` if drizzle-kit chose a different suffix
    - Overwrite the SQL body with exactly these three statements, separated by `--> statement-breakpoint` markers and matching the style of `0001_platform_improvements_mvp.sql`:
      ```
      DROP INDEX IF EXISTS "audit_events_type_time";--> statement-breakpoint
      DROP INDEX IF EXISTS "audit_events_time";--> statement-breakpoint
      DROP TABLE IF EXISTS "audit_events" CASCADE;
      ```
    - Confirm the file contains no `BEGIN` / `COMMIT` / `ROLLBACK` / `SAVEPOINT` statements (Drizzle wraps each migration in an implicit transaction); both `DROP INDEX` statements must be emitted explicitly even though `DROP TABLE … CASCADE` would remove dependent indexes (idempotency on environments where indexes lingered)
    - Update the newly appended `_journal.json` entry: set `tag` to `"0003_remove_audit_events"` and `idx` to `3`; leave `when`, `breakpoints: true`, and `version` (which must equal the immediately preceding entry's `version`) intact
    - Do **not** hand-edit `backend/drizzle/meta/0003_snapshot.json` — confirm only that it contains no `tables.audit_events` key path
    - _Requirements: 4.1, 4.5, 2.6_

- [x] 9. Final checkpoint - build, tests, and repository scrub
  - Run `npm run build` from `backend/` and confirm `tsc` exits 0
  - Run `npm test` from `backend/` and confirm every suite passes, with both rewritten lockout PBTs reporting zero failures and zero fast-check counterexamples
  - Grep verification (case-insensitive) — each command must return zero matches except where noted:
    - `rg -i "audit_events|auditEvents|auditService|auditRepository" backend/src` → 0 matches
    - `rg -i "audit_events|auditEvents|auditService|auditRepository" backend/tests` → 0 matches
    - `rg "AUDIT_RETENTION" backend/src backend/.env.example` → 0 matches
    - `rg "audit_events|auditEvents|auditService|auditRepository" backend/drizzle/ -g '!0000_*.sql' -g '!0001_*.sql' -g '!meta/_journal.json' -g '!meta/0000_snapshot.json' -g '!meta/0001_snapshot.json'` → only matches inside `0003_remove_audit_events.sql`
  - Confirm `backend/drizzle/0000_*.sql`, `backend/drizzle/0001_*.sql`, `backend/drizzle/meta/_journal.json` (entries 0..2), `backend/drizzle/meta/0000_snapshot.json`, and `backend/drizzle/meta/0001_snapshot.json` are byte-identical to their pre-feature state
  - Confirm `backend/src/modules/audit/` no longer exists as a directory
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 3.1, 3.2, 4.1, 4.5, 6.4, 6.5, 6.7_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP. The two main PBT rewrites (6.1, 6.2) and the smoke-test trim (6.4) are **not** optional — they are mandated by Requirement 6.
- Properties 1 and 2 from the design's "Correctness Properties" section are validated by the rewritten lockout PBTs (6.1, 6.2).
- Property 6 (migration idempotency) is validated structurally by the `IF EXISTS` guards in task 8.1; no PBT is needed since the assertion is over fixed SQL text.
- Properties 4 and 5 (no `audit_events` / `AUDIT_RETENTION` references outside the migration) are validated by the grep checks in task 9.
- Property 7 (logger contract) is enforced by the call-site shape in tasks 1.1, 2.1, 3.1; the optional canary (6.3) provides a regression-catch at PBT time for the `auth_lockout` branch.
- The audit-module deletion (7.2) must run after all `auditService` import sites (1.1, 2.1, 3.1, 4.2) are clean, so the build never falls into an intermediate broken state.
- Migration generation (8.1) must run after the schema edit (7.1) so `drizzle-kit generate` detects the table removal.
- The redaction step that lived inside `auditService.write` (recursive scrub of `password` / `passwordHash` / `secret` keys) is intentionally not carried over — none of the four admin call sites pass user-supplied secrets in `beforeValue` / `afterValue`, and the login routes never logged the password field.
- After this work, operators who alerted on `event_type = auth_lockout` in `audit_events` switch to alerting on `auth_lockout` log occurrences in winston-rotated files under `backend/logs/`. The de-dup invariant (one row per window) is intentionally relaxed for log lines; the gate decision itself (HTTP 429) remains the single source of truth via `auth_failures`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.1", "4.2", "4.3", "6.4", "7.1"] },
    { "id": 1, "tasks": ["6.1", "6.2", "7.2", "7.3", "8.1"] },
    { "id": 2, "tasks": ["6.3"] }
  ]
}
```
