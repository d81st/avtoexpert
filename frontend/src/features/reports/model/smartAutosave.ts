import { reportService } from '../api/reportApi';
import type { AutosaveScheduler, AutosaveTrigger } from '../hooks/useFieldBlurTrigger';
import { AUTOSAVE_ELIGIBLE_STEPS } from '../lib/autosave.config';
import { dirtyFieldTracker, type FieldId } from './dirtyFieldTracker';

/**
 * Smart_Autosave coordinator (Requirement 2).
 *
 * All three triggers — Field_Blur_Trigger (task 14.3), Edit_Debounce_Trigger
 * (task 14.4) and the existing 60-second backstop (task 14.9) — funnel through
 * the single {@link SmartAutosaveCoordinator.schedule} entry point. The
 * coordinator owns request dispatch, the in-flight singleton guarantee, the
 * coalescing gap, the request timeout and payload construction.
 *
 * Implemented acceptance criteria (task 14.5 scope):
 * - AC 2.2 — {@link SmartAutosaveCoordinator.buildPayload} produces exactly
 *   `reportId` (+ optional `version`) plus the subset of fields present in the
 *   Dirty_Field_Tracker; no other fields are included.
 * - AC 2.3 — an empty Dirty_Field_Tracker suppresses the request entirely.
 * - AC 2.6 — every trigger dispatches `reportService.autosaveDirty(reportId,
 *   payload, { background: true })`.
 * - AC 2.7 — at most one in-flight request per `reportId`; triggers fired while
 *   a request is in flight are coalesced into a single follow-up dispatched
 *   within {@link SmartAutosaveCoordinator.coalesceMs} (≤ 200 ms) of settlement,
 *   provided the tracker is still non-empty.
 * - AC 2.10 — the backstop uses this same coordinator (and therefore the same
 *   payload construction) via `schedule('backstop')`.
 * - AC 2.11 — the activation guard rejects `reportId ∈ {null, '', undefined}`
 *   and `currentStep ∉ {2, 3, 4}` before any request is scheduled.
 *
 * The coordinator is intentionally framework-agnostic and fully injectable so
 * it can be unit-tested without React or a live network. The Wizard wiring
 * (task 14.9) calls {@link SmartAutosaveCoordinator.configure} once per mounted
 * report and passes the {@link smartAutosave} singleton straight into the
 * trigger hooks, which only require the {@link AutosaveScheduler} contract.
 */

/** Coalesce delay between consecutive autosave requests (AC 2.7), milliseconds. */
export const AUTOSAVE_COALESCE_MS = 200;

/** Hard timeout applied to each autosave request via `AbortController`, milliseconds. */
export const AUTOSAVE_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Autosave_Payload shape (AC 2.2). Always carries `reportId`; carries `version`
 * when the host provides one (used by the backend for 409 conflict detection),
 * plus one entry per dirty {@link FieldId}.
 */
export interface AutosavePayload {
  reportId: string;
  version?: number;
  [field: string]: unknown;
}

/**
 * Request function contract. Defaults to {@link reportService.autosaveDirty};
 * injectable so tests can supply a deterministic stub.
 */
export type AutosaveSaveFn = (
  reportId: string,
  payload: AutosavePayload,
  options: { background: true; signal: AbortSignal },
) => Promise<unknown>;

/**
 * Subset of the Dirty_Field_Tracker API the coordinator depends on. Defaults to
 * the {@link dirtyFieldTracker} singleton; injectable for tests.
 */
export interface DirtyTrackerLike {
  snapshot(): ReadonlySet<FieldId>;
  beginInFlight(): ReadonlySet<FieldId>;
  markSaved(sent: ReadonlySet<FieldId>, postSendChanges: ReadonlySet<FieldId>): void;
  rollback(): void;
}

export interface SmartAutosaveConfig {
  /** Current report id. The activation guard rejects `null`/`''`/`undefined` (AC 2.11). */
  getReportId(): string | null | undefined;
  /** Current Wizard step. The activation guard rejects steps outside `[2,3,4]` (AC 2.11). */
  getCurrentStep(): number;
  /** Live form values; dirty field values are read from here (AC 2.2). */
  getValues(): Record<string, unknown>;
  /** Optional report version for 409 conflict detection; included in the payload when numeric. */
  getVersion?(): number | undefined;
  /** Request function (default: {@link reportService.autosaveDirty}). */
  save?: AutosaveSaveFn;
  /** Dirty_Field_Tracker (default: {@link dirtyFieldTracker} singleton). */
  tracker?: DirtyTrackerLike;
  /** Invoked after a 2xx response with the set of fields that were sent. */
  onSuccess?(sent: ReadonlySet<FieldId>): void;
  /** Invoked on network error / timeout / non-409 4xx-5xx (AC 2.9 wiring in 14.9). */
  onError?(error: unknown): void;
  /** Invoked on a 409 version conflict (AC 2.12 wiring in 14.9). */
  onConflict?(error: unknown): void;
  /** Coalesce delay (default {@link AUTOSAVE_COALESCE_MS}). */
  coalesceMs?: number;
  /** Request timeout (default {@link AUTOSAVE_REQUEST_TIMEOUT_MS}). */
  requestTimeoutMs?: number;
  /** Eligible Wizard steps (default {@link AUTOSAVE_ELIGIBLE_STEPS}). */
  eligibleSteps?: readonly number[];
}

/**
 * Reads a value from `source` following a react-hook-form dot-path identifier
 * (e.g. `repair_works.2.price`). Numeric segments index into arrays. Returns
 * `undefined` when any segment along the path is missing.
 */
export function getNestedValue(source: Record<string, unknown>, path: FieldId): unknown {
  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (current == null) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Narrows an unknown rejection to an HTTP 409 version conflict. */
function isConflictError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const response = (error as { response?: { status?: number } }).response;
  return response?.status === 409;
}

/**
 * The Smart_Autosave coordinator. One instance backs the {@link smartAutosave}
 * singleton consumed by the trigger hooks; tests may construct dedicated
 * instances via {@link createSmartAutosave}.
 */
export class SmartAutosaveCoordinator implements AutosaveScheduler {
  private config: SmartAutosaveConfig | null = null;

  /** `true` while a request is in flight OR during the post-settle coalesce gap. */
  private busy = false;

  /** `true` when a trigger fired while {@link busy}; coalesced into one follow-up. */
  private pending = false;

  private coalesceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config?: SmartAutosaveConfig) {
    if (config) {
      this.config = config;
    }
  }

  /**
   * Installs (or replaces) the host configuration. Called by the Wizard wiring
   * (task 14.9) when a report mounts or its id/step changes. Replacing the
   * config does not abort an in-flight request; the new config applies to the
   * next dispatch.
   */
  configure(config: SmartAutosaveConfig): void {
    this.config = config;
  }

  private get coalesceMs(): number {
    return this.config?.coalesceMs ?? AUTOSAVE_COALESCE_MS;
  }

  private get requestTimeoutMs(): number {
    return this.config?.requestTimeoutMs ?? AUTOSAVE_REQUEST_TIMEOUT_MS;
  }

  private get tracker(): DirtyTrackerLike {
    return this.config?.tracker ?? dirtyFieldTracker;
  }

  private get save(): AutosaveSaveFn {
    return (
      this.config?.save ??
      ((reportId, payload, options) => reportService.autosaveDirty(reportId, payload, options))
    );
  }

  private get eligibleSteps(): readonly number[] {
    return this.config?.eligibleSteps ?? (AUTOSAVE_ELIGIBLE_STEPS as readonly number[]);
  }

  /** Activation guard (AC 2.11): valid `reportId` and an eligible `currentStep`. */
  private canActivate(): boolean {
    const reportId = this.config?.getReportId();
    if (reportId == null || reportId === '') {
      return false;
    }
    const step = this.config?.getCurrentStep();
    return step != null && this.eligibleSteps.includes(step);
  }

  /**
   * Builds the Autosave_Payload that would be sent right now (AC 2.2):
   * `{ reportId, version?, ...dirtyFields }`. Dirty field values are resolved
   * from the live form snapshot via {@link getNestedValue}.
   */
  buildPayload(): AutosavePayload {
    const reportId = this.config?.getReportId() ?? '';
    const payload: AutosavePayload = { reportId };

    const version = this.config?.getVersion?.();
    if (typeof version === 'number') {
      payload.version = version;
    }

    const values = this.config?.getValues() ?? {};
    for (const id of this.tracker.snapshot()) {
      payload[id] = getNestedValue(values, id);
    }
    return payload;
  }

  /**
   * Entry point for all triggers. Idempotent under concurrent calls: when a
   * request is in flight (or in the coalesce gap) the call is folded into a
   * single pending follow-up rather than starting a parallel request (AC 2.7).
   */
  schedule(_trigger: AutosaveTrigger): void {
    if (!this.config) {
      return;
    }
    // AC 2.11 — activation guard.
    if (!this.canActivate()) {
      return;
    }
    // AC 2.3 — nothing dirty, nothing to send.
    if (this.tracker.snapshot().size === 0) {
      return;
    }
    // AC 2.7 — single in-flight request; coalesce concurrent triggers.
    if (this.busy) {
      this.pending = true;
      return;
    }
    this.dispatch();
  }

  private dispatch(): void {
    this.busy = true;
    this.pending = false;

    // canActivate() already guaranteed a non-empty reportId.
    const reportId = this.config?.getReportId() as string;
    const payload = this.buildPayload();
    const sent = this.tracker.beginInFlight();

    const controller = new AbortController();
    // 30 s hard timeout (AC 2.9 timeout branch handled by onError downstream).
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    this.save(reportId, payload, { background: true, signal: controller.signal })
      .then(() => {
        // 2xx — clear sent fields that were not re-dirtied during the flight.
        this.tracker.markSaved(sent, this.computePostSendChanges(sent));
        this.config?.onSuccess?.(sent);
      })
      .catch((error: unknown) => {
        // Non-2xx / network / abort — leave the tracker untouched (AC 2.9, 2.12).
        this.tracker.rollback();
        if (isConflictError(error)) {
          this.config?.onConflict?.(error);
        } else {
          this.config?.onError?.(error);
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        this.onSettled();
      });
  }

  /**
   * Fields that became dirty during the in-flight window (present now but not in
   * the sent snapshot). The Dirty_Field_Tracker keeps these regardless, so this
   * set is informational for `markSaved`; re-edits of already-sent fields cannot
   * be observed at the coordinator level and are addressed by the 14.9 wiring.
   */
  private computePostSendChanges(sent: ReadonlySet<FieldId>): ReadonlySet<FieldId> {
    const post = new Set<FieldId>();
    for (const id of this.tracker.snapshot()) {
      if (!sent.has(id)) {
        post.add(id);
      }
    }
    return post;
  }

  private onSettled(): void {
    if (this.pending) {
      // AC 2.7 — dispatch the coalesced follow-up within ≤ coalesceMs.
      this.coalesceTimer = setTimeout(() => {
        this.coalesceTimer = null;
        this.busy = false;
        this.pending = false;
        if (this.canActivate() && this.tracker.snapshot().size > 0) {
          this.dispatch();
        }
      }, this.coalesceMs);
    } else {
      this.busy = false;
    }
  }

  /** Test/teardown helper: cancels any pending coalesce timer and clears state. */
  reset(): void {
    if (this.coalesceTimer !== null) {
      clearTimeout(this.coalesceTimer);
      this.coalesceTimer = null;
    }
    this.busy = false;
    this.pending = false;
  }
}

/** Factory for isolated coordinator instances (used by tests). */
export function createSmartAutosave(config?: SmartAutosaveConfig): SmartAutosaveCoordinator {
  return new SmartAutosaveCoordinator(config);
}

/**
 * Process-wide Smart_Autosave singleton. The trigger hooks (14.3, 14.4) and the
 * Wizard wiring (14.9) share this instance; call {@link SmartAutosaveCoordinator.configure}
 * before relying on {@link SmartAutosaveCoordinator.schedule}.
 */
export const smartAutosave = new SmartAutosaveCoordinator();
