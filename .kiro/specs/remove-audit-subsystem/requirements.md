# Requirements Document

## Introduction

This feature retires the security-audit subsystem from the backend (the
`audit_events` table, the `auditService` and `auditRepository` modules, the
daily retention cron, and the `AUDIT_RETENTION_CRON_ENABLED` environment
variable) while keeping the auth lockout gate on `POST /login` fully intact.
Every former `auditService.write(...)` call site is replaced in place by a
single structured `winston` log line through the existing logger, tagged with
`category: 'security'` and the same `event_type` strings operators previously
queried in `audit_events`. The `auth_failures` table that backs the brute-force
counter is preserved unchanged, and the brute-force gate continues to enforce
five failures in fifteen minutes → HTTP 429 with `Retry-After: 900`.

The requirements below derive directly from the approved design document
(`design.md`). Each requirement scopes one user-facing or operator-facing
contract: gate preservation, source-tree removal of audit identifiers,
migration safety, structured-log substitution, and the property-based test
rewrite that proves the gate still holds after the refactor.

Out of scope (non-goals carried over from the design): changes to
`auth.service.ts` (JWT, cookies, password verification), CSRF or rate-limit
middleware, admin business logic beyond replacing audit calls, expert / report
/ photo flows, any new external sink for security events (Sentry, CloudWatch,
ELK), and consolidation of the two parallel lockout PBT files.

## Glossary

- **Audit_Subsystem**: The retired bundle of code consisting of the
  `audit_events` Postgres table (with indexes `audit_events_type_time` and
  `audit_events_time`), the `auditService` module
  (`backend/src/modules/audit/audit.service.ts`), the `auditRepository` module
  (`backend/src/modules/audit/audit.repository.ts`), and the daily retention
  cron in `backend/src/server.ts`.
- **Audit_Event_Type**: One of the seven string identifiers `auth_failure`,
  `auth_lockout`, `auth_success`, `template_publish`, `role_change`,
  `report_owner_change`, `report_deletion`.
- **Auth_Failures_Table**: The Postgres table `auth_failures` together with
  its indexes `auth_failures_ip_time` and `auth_failures_email_time`. This
  table is the sole persistent backing store of the brute-force counter and
  is preserved by this feature.
- **Auth_Service**: The module at `backend/src/modules/auth/auth.service.ts`,
  exposing password verification, JWT issuance, and cookie helpers. It is not
  modified by this feature.
- **Backend_Source_Tree**: All files under `backend/src/`.
- **Backend_Test_Tree**: All files under `backend/tests/`.
- **Backend_Env_Example**: The file `backend/.env.example`.
- **Drizzle_Migrations_Tree**: All files under `backend/drizzle/`, including
  hand-authored migration SQL files and generated metadata
  (`backend/drizzle/meta/`).
- **Lockout_Key**: The pair `{ clientIp: string, email?: string }` that
  identifies a login attempt source for lockout-counter purposes. Two
  failures share a key when either `clientIp` or `email` matches.
- **Lockout_Service**: The module at
  `backend/src/modules/auth/lockout.service.ts`, exposing `isLocked`,
  `recordFailure`, and `recordSuccess`.
- **LOCKOUT_THRESHOLD**: The integer constant `5`, exported from
  `Lockout_Service`. The number of failures within `LOCKOUT_WINDOW_MS` that
  trips the lockout.
- **LOCKOUT_WINDOW_MS**: The integer constant `15 * 60 * 1000` (900_000 ms,
  15 minutes), exported from `Lockout_Service`. The sliding window over which
  failures count.
- **LOCKOUT_RETRY_AFTER_SECONDS**: The integer constant `900`, derived from
  `LOCKOUT_WINDOW_MS` in `auth.routes.ts`. The value sent in the
  `Retry-After` HTTP header on 429 responses from `POST /login`.
- **Login_Route**: The Express handler for `POST /login` in
  `backend/src/modules/auth/auth.routes.ts`.
- **Migration_0003**: The new Drizzle migration file
  `backend/drizzle/0003_remove_audit_events.sql`.
- **PBT_Lockout_In_Src**: The property-based test file
  `backend/src/modules/auth/lockout.property.test.ts`.
- **PBT_Lockout_In_Tests**: The duplicate property-based test file
  `backend/tests/unit/auth/lockout.property.test.ts`.
- **Server_Boot**: The startup code path in `backend/src/server.ts` that
  builds the Express app and binds the HTTP listener.
- **Structured_Logger**: The winston logger instance exported from
  `backend/src/shared/logger/logger.ts`. The same logger that already serves
  the rest of the backend.
- **Logging_Contract**: The seven-row table in the design document
  (`design.md`, section "Logging contract (replaces the audit table)") that
  fixes, for each `Audit_Event_Type`, the call site, the winston log level
  (`warn` or `info`), the message string, and the structured payload fields.

## Requirements

### Requirement 1: Preserve the auth lockout gate on POST /login

**User Story:** As an operator of `POST /login`, I want the brute-force lockout gate to keep rejecting attempts under exactly the same threshold and window after the audit subsystem is retired, so that account safety is not weakened by this refactor.

#### Acceptance Criteria

1. WHILE `key.email` is undefined, null, or the empty string, THE `Lockout_Service` `isLocked(key, now)` SHALL evaluate the matching-rows predicate over `Auth_Failures_Table` as `client_ip = key.clientIp AND created_at > now − LOCKOUT_WINDOW_MS`; OTHERWISE the predicate SHALL be `(client_ip = key.clientIp OR email = key.email) AND created_at > now − LOCKOUT_WINDOW_MS`, where the `created_at > now − LOCKOUT_WINDOW_MS` bound is strict (exclusive lower bound).
2. WHILE the count of `Auth_Failures_Table` rows matching the predicate defined in criterion 1 is greater than or equal to `LOCKOUT_THRESHOLD`, THE `Lockout_Service` SHALL return `true` from `isLocked(key, now)`.
3. WHILE the count of `Auth_Failures_Table` rows matching the predicate defined in criterion 1 is strictly less than `LOCKOUT_THRESHOLD`, THE `Lockout_Service` SHALL return `false` from `isLocked(key, now)`.
4. WHEN `Lockout_Service.recordFailure(key, now)` is invoked, THE `Lockout_Service` SHALL first insert a new row into `Auth_Failures_Table` with `client_ip = key.clientIp`, `email = key.email` (or `null` when `key.email` is undefined or empty), and `created_at = now`, AND only after that insert SHALL it evaluate the matching-rows count used to decide further behaviour; so a request whose failure is the `LOCKOUT_THRESHOLD`-th within `LOCKOUT_WINDOW_MS` trips the gate on the same request that recorded it.
5. WHEN `Lockout_Service.recordSuccess(key)` is invoked, THE `Lockout_Service` SHALL delete every `Auth_Failures_Table` row matching the same predicate as criterion 1, so that the next `Lockout_Service.isLocked(key, now)` invocation returns `false` until at least `LOCKOUT_THRESHOLD` further failures accumulate for that key within `LOCKOUT_WINDOW_MS`.
6. WHEN `POST /login` receives a request, THE `Login_Route` SHALL invoke `Lockout_Service.isLocked(key, now)` before invoking `Auth_Service.login`.
7. IF `Lockout_Service.isLocked(key, now)` returns `true` during a `POST /login` request, THEN THE `Login_Route` SHALL respond with HTTP status `429` and the response header `Retry-After` set to the constant `LOCKOUT_RETRY_AFTER_SECONDS` (`900`, not a dynamically computed value), AND SHALL not invoke `Auth_Service.login` for that request.
8. WHILE the `Login_Route` is serving a 429 response produced by the locked-path branch of criterion 7, THE `Login_Route` SHALL not invoke `Lockout_Service.recordFailure` or `Lockout_Service.recordSuccess` for that request, so that the 429 response has no side effects on `Auth_Failures_Table`.

### Requirement 2: Repository scrub of all audit references

**User Story:** As a maintainer, I want every trace of the audit feature removed from the backend source tree, test tree, and forward-looking migration artifacts, so that no dead code, stale references, or undefined symbols remain after removal.

#### Acceptance Criteria

1. THE system SHALL contain zero occurrences, under `Backend_Source_Tree`, of any of the identifiers `audit_events`, `auditEvents`, `auditService`, or `auditRepository` when matched as case-insensitive substrings (so variants such as `Audit_Events` and `AUDIT_EVENTS` are also forbidden), including occurrences inside code comments and string literals.
2. THE system SHALL contain zero occurrences, under `Backend_Test_Tree`, of any of the identifiers `audit_events`, `auditEvents`, `auditService`, or `auditRepository` when matched as case-insensitive substrings (so variants such as `Audit_Events` and `AUDIT_EVENTS` are also forbidden), including occurrences inside code comments and string literals.
3. WHERE the zero-occurrence rule in criteria 1 and 2 is applied, THE system SHALL exempt the historical migration artifacts `backend/drizzle/0000_*.sql`, `backend/drizzle/0001_*.sql`, `backend/drizzle/meta/_journal.json`, `backend/drizzle/meta/0000_snapshot.json`, and `backend/drizzle/meta/0001_snapshot.json` from that rule, since those are historical artifacts that must remain unchanged.
4. THE system SHALL contain no directory entry at `backend/src/modules/audit/` and no file whose path begins with `backend/src/modules/audit/`.
5. THE system SHALL keep the files `backend/drizzle/0000_*.sql`, `backend/drizzle/0001_*.sql`, `backend/drizzle/meta/_journal.json`, `backend/drizzle/meta/0000_snapshot.json`, and `backend/drizzle/meta/0001_snapshot.json` byte-identical to their pre-feature state.
6. THE system SHALL ensure that, under `Drizzle_Migrations_Tree`, `Migration_0003` is the only new file in which the identifier `audit_events` may be referenced.

### Requirement 3: Remove the AUDIT_RETENTION_CRON_ENABLED env var and retention cron

**User Story:** As an operator deploying the backend, I want the `AUDIT_RETENTION_CRON_ENABLED` environment variable and the daily retention cron removed so the server boots cleanly without scheduling work against a table that no longer exists.

#### Acceptance Criteria

1. THE `Backend_Source_Tree` SHALL contain zero occurrences of any of the identifiers `AUDIT_RETENTION_CRON_ENABLED`, `AUDIT_RETENTION_DAYS`, `AUDIT_RETENTION_INTERVAL_MS`, or any identifier whose name begins with `runAuditRetention`, including occurrences inside code comments and string literals.
2. THE `Backend_Env_Example` SHALL contain zero occurrences of any identifier matching the prefix `AUDIT_RETENTION_`, AND SHALL contain zero `#`-prefixed comment lines that reference the removed flag or the removed retention constants.
3. THE `Server_Boot` SHALL not schedule any recurring or one-shot timer that targets the `audit_events` table or invokes any function whose name begins with `runAuditRetention`.
4. WHILE no environment variable whose name begins with `AUDIT_RETENTION_` is set on the process, THE `Server_Boot` startup sequence SHALL complete cleanly: the HTTP listener SHALL bind on the configured `PORT`, no uncaught exception SHALL propagate up to or beyond the listener-bound event, AND none of the winston messages `audit_retention_cron_started`, `audit_retention_cron_disabled`, or `audit_retention_cleanup_failed` SHALL be emitted by any transport.
5. WHEN the `Server_Boot` startup sequence runs with the environment variable `AUDIT_RETENTION_CRON_ENABLED=true` present in `process.env`, THE `Server_Boot` SHALL still complete cleanly per the observables defined in criterion 4, AND the parsed `env` object SHALL not expose any property whose name begins with `AUDIT_RETENTION_`.

### Requirement 4: Drop the audit_events table via an idempotent migration

**User Story:** As a database operator running migrations across multiple environments, I want `Migration_0003` to drop the `audit_events` table and its two indexes idempotently so the migration can be re-run on environments where the table is already gone without crashing.

#### Acceptance Criteria

1. THE `Drizzle_Migrations_Tree` SHALL contain a new migration file at `backend/drizzle/0003_remove_audit_events.sql` whose body, in order and separated by the `--> statement-breakpoint` marker (matching the convention used in `backend/drizzle/0001_platform_improvements_mvp.sql`), consists of exactly: `DROP INDEX IF EXISTS "audit_events_type_time"`, `DROP INDEX IF EXISTS "audit_events_time"`, and `DROP TABLE IF EXISTS "audit_events" CASCADE`; AND SHALL not contain any `BEGIN`, `COMMIT`, `ROLLBACK`, or `SAVEPOINT` statement (Drizzle wraps each migration in an implicit transaction); the two `DROP INDEX` statements MUST be emitted explicitly even though `DROP TABLE ... CASCADE` would remove dependent indexes, so the migration remains idempotent on environments where the table was previously dropped manually but the indexes lingered.
2. WHEN `Migration_0003` is applied to a Postgres database where the `audit_events` table and both of its indexes already exist, THE Migration SHALL complete successfully, AND `SELECT to_regclass(name)` SHALL return `NULL` after the migration for each of `name` in `'audit_events'`, `'audit_events_type_time'`, and `'audit_events_time'`.
3. WHEN `Migration_0003` is applied to a Postgres database where any strict non-empty subset of `{ audit_events, audit_events_type_time, audit_events_time }` already exists and the remaining members are already absent, THE Migration SHALL complete successfully, AND `SELECT to_regclass(name)` SHALL return `NULL` after the migration for each of `name` in `'audit_events'`, `'audit_events_type_time'`, and `'audit_events_time'`.
4. WHEN `Migration_0003` is applied to a Postgres database where the `audit_events` table and both of its indexes have already been dropped, THE Migration SHALL complete successfully without raising any error, no rollback SHALL occur, AND `SELECT to_regclass('audit_events')` SHALL continue to return `NULL` after the migration.
5. WHEN `Migration_0003` is generated, THE `Drizzle_Migrations_Tree` SHALL contain a matching `0003_snapshot.json` file under `backend/drizzle/meta/` whose serialized JSON contains no key path `tables.audit_events` and no key path `tables."audit_events"`, AND an appended entry in `backend/drizzle/meta/_journal.json` whose `tag` field equals `0003_remove_audit_events`, whose `idx` field equals `3`, whose `breakpoints` field equals `true`, and whose `version` field equals the `version` field of the immediately preceding journal entry.

### Requirement 5: Replace audit writes with structured winston log lines

**User Story:** As a security operator who previously queried `audit_events` for security events, I want every former audit call site to emit a single structured winston log line carrying the same `event_type` and the same identifying fields, so I can keep grepping logs by the existing event-type vocabulary without losing visibility.

#### Acceptance Criteria

1. WHEN `POST /login` reaches the 401 (invalid credentials) branch for a request, THE `Login_Route` SHALL emit exactly one `Structured_Logger.warn` line whose message is `auth_failure` and whose structured payload contains the fields `category: 'security'`, `eventType: 'auth_failure'`, `emailOrUserId` (the submitted login string), `clientIp` (the request's client IP), and `userAgent` (the request's `User-Agent` header value, or `null` when the header is absent), and this line SHALL be emitted before `Lockout_Service.recordFailure` is invoked for the same request.
2. WHEN `Lockout_Service.recordFailure` is invoked AND the resulting failure count for the `Lockout_Key` within `LOCKOUT_WINDOW_MS` is greater than or equal to `LOCKOUT_THRESHOLD`, THE `Lockout_Service` SHALL emit, per invocation, exactly one `Structured_Logger.warn` line whose message is `auth_lockout` and whose structured payload contains the fields `category: 'security'`, `eventType: 'auth_lockout'`, `emailOrUserId` (`key.email` when defined, otherwise `null`), `clientIp` (`key.clientIp`), `failures` (the integer failure count), and `windowMs` (`LOCKOUT_WINDOW_MS`), without de-duplicating against any prior `auth_lockout` line emitted for the same `Lockout_Key` within the same `LOCKOUT_WINDOW_MS`.
3. WHEN `Lockout_Service.recordFailure` is invoked AND the resulting failure count for the `Lockout_Key` within `LOCKOUT_WINDOW_MS` is strictly less than `LOCKOUT_THRESHOLD`, THE `Lockout_Service` SHALL not emit any `Structured_Logger` line whose message is `auth_lockout`.
4. WHEN `POST /login` reaches the success branch for a request, THE `Login_Route` SHALL emit exactly one `Structured_Logger.info` line whose message is `auth_success` and whose structured payload contains the fields `category: 'security'`, `eventType: 'auth_success'`, `actorUserId` (`creator.id`), `emailOrUserId` (the submitted login string), `clientIp` (the request's client IP), and `userAgent` (the request's `User-Agent` header value, or `null` when the header is absent), and this line SHALL be emitted after `Lockout_Service.recordSuccess` is invoked for the same request.
5. WHEN `admin.service.uploadTemplate` returns successfully after the file write has completed, THE Admin service SHALL emit exactly one `Structured_Logger.info` line whose message is `template_publish` and whose structured payload contains the fields `category: 'security'`, `eventType: 'template_publish'`, `actorUserId`, `targetResourceId` (the template file name), `beforeValue`, and `afterValue` carrying the same values as the original `auditService.write` call this line replaces.
6. WHEN `admin.service.updateCreatorRole` returns successfully after the role update has been persisted, THE Admin service SHALL emit exactly one `Structured_Logger.info` line whose message is `role_change` and whose structured payload contains the fields `category: 'security'`, `eventType: 'role_change'`, `actorUserId`, `targetResourceId` (the target `creatorId`), `beforeValue: { role: <prior role> }`, and `afterValue: { role: <new role> }`.
7. WHEN `admin.service.changeReportOwner` returns successfully after the owner update has been persisted, THE Admin service SHALL emit exactly one `Structured_Logger.info` line whose message is `report_owner_change` and whose structured payload contains the fields `category: 'security'`, `eventType: 'report_owner_change'`, `actorUserId`, `targetResourceId` (the target `reportId`), `beforeValue: { creator_id: <prior creator id> }`, and `afterValue: { creator_id: <new creator id> }`.
8. WHEN `admin.service.deleteReport` returns successfully after the report deletion has been persisted, THE Admin service SHALL emit exactly one `Structured_Logger.info` line whose message is `report_deletion` and whose structured payload contains the fields `category: 'security'`, `eventType: 'report_deletion'`, `actorUserId`, `targetResourceId` (the target `reportId`), `beforeValue` carrying the deleted report's `id`, `creator_id`, `report_number`, and `status`, and `afterValue: null`.
9. IF an invocation of `admin.service.uploadTemplate`, `admin.service.updateCreatorRole`, `admin.service.changeReportOwner`, or `admin.service.deleteReport` throws or rejects before its underlying operation (file write, role update, owner update, or report deletion, respectively) has completed successfully, THEN THE Admin service SHALL not emit any `Structured_Logger` line whose message is `template_publish`, `role_change`, `report_owner_change`, or `report_deletion` for that invocation.
10. WHEN `POST /login` reaches the 401 branch for a request AND the failure count for the `Lockout_Key` within `LOCKOUT_WINDOW_MS` after `Lockout_Service.recordFailure` has run is greater than or equal to `LOCKOUT_THRESHOLD`, THE `Login_Route` SHALL cause exactly two `Structured_Logger.warn` lines to be emitted for that request: one whose message is `auth_failure` (emitted by the `Login_Route` per criterion 1) and one whose message is `auth_lockout` (emitted by the `Lockout_Service` per criterion 2).

### Requirement 6: Rewrite the lockout property-based tests around the new contract

**User Story:** As a developer running the backend test suite, I want the two parallel lockout property-based tests rewritten so they validate the gate behavior without referencing the removed `audit_events` table, so the property suite continues to provide confidence in the lockout contract after the refactor.

#### Acceptance Criteria

1. THE files `PBT_Lockout_In_Src` and `PBT_Lockout_In_Tests` SHALL contain zero occurrences of the identifiers `audit_events`, `auditEvents`, `auditService`, or `auditRepository`, and SHALL not mock any module path ending in `modules/audit/audit.service.js` or `modules/audit/audit.repository.js`.
2. WHILE `PBT_Lockout_In_Src` exercises `Lockout_Service` across generated `fast-check` command sequences mixing `recordFailure`, `recordSuccess`, and `isLocked` operations whose `Lockout_Key` generator produces at least one sequence in which two distinct keys differ only by `client_ip` and at least one sequence in which two distinct keys differ only by `email`, THE asserted central property SHALL be that `Lockout_Service.isLocked(key, now)` returns `true` if and only if the count of `recordFailure` invocations recorded for the same `key` whose stored timestamp `t` satisfies `now − LOCKOUT_WINDOW_MS < t ≤ now` is greater than or equal to `LOCKOUT_THRESHOLD`, AND that immediately after `Lockout_Service.recordSuccess(key)` the next `Lockout_Service.isLocked(key, now)` invocation for that same `key` returns `false`, AND that any `recordFailure` recorded at timestamp `t ≤ now − LOCKOUT_WINDOW_MS` does not contribute to the threshold count at `now`.
3. WHILE `PBT_Lockout_In_Tests` exercises `Lockout_Service` via its `fast-check` command sequences whose `Lockout_Key` generator produces the same `client_ip`-only and `email`-only variation required by criterion 2, THE asserted central property SHALL match the property stated in criterion 2, AND THE test file SHALL assert no expectations on audit-row counts, audit-row timestamps, or per-window audit-event uniqueness.
4. THE `Backend_Source_Tree` SHALL contain no file whose path matches `backend/src/modules/audit/*.property.test.ts` after the change is complete, and in particular SHALL contain neither `backend/src/modules/audit/audit.service.property.test.ts` nor `backend/src/modules/audit/audit.retention.property.test.ts`.
5. THE `Backend_Test_Tree` SHALL contain neither `backend/tests/unit/audit/auditService.property.test.ts` nor any other `*.property.test.ts` file under `backend/tests/unit/audit/` after the change is complete.
6. THE smoke test `backend/src/db/__tests__/migration0001.smoke.test.ts` SHALL only assert characteristics of database artifacts that remain defined after the migration sequence that removes the `audit_events` table is applied, and accordingly SHALL not import the symbol `auditEvents` from `db/schema.js`, SHALL not contain a test case asserting that the `audit_events` table is defined with its columns, SHALL not contain a test case asserting that migration 0001 creates the `audit_events` table, and SHALL not contain assertions that match the regex `/CREATE INDEX "audit_events_(type_time|time)"/`.
7. WHEN the backend test command `npm test` is executed from the `backend` workspace after criteria 1 through 6 are satisfied, THE backend test runner SHALL exit with a success status, AND every test case declared in `PBT_Lockout_In_Src` and `PBT_Lockout_In_Tests` SHALL be reported as passing with zero failures and zero `fast-check` counterexamples.
