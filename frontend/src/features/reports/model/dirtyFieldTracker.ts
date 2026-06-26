import { useEffect } from 'react';
import type { FieldValues } from 'react-hook-form';
import { create } from 'zustand';

/**
 * Dirty_Field_Tracker (Requirement 2).
 *
 * Single source of truth for the set of Form_Input_Field identifiers modified
 * by the user since the last successful `reportService.autosave` 2xx response
 * (AC 2.1). The set is derived from react-hook-form's `formState.dirtyFields`
 * via {@link useDirtyFieldSync}, plus explicit {@link markDirty} calls for
 * fields stored outside RHF (e.g. Step4 collection arrays).
 *
 * The tracker exposes the primitives consumed by Smart_Autosave:
 * - {@link beginInFlight} captures the dirty set that is about to be sent.
 * - {@link markSaved} clears only the sent ids that were not re-edited during
 *   the request (AC 2.8).
 * - {@link rollback} leaves the dirty set untouched on error/conflict
 *   (AC 2.9, AC 2.12).
 */
export type FieldId = string; // e.g. "carModel", "analog1Price", "repair_works.2.price"

interface DirtyFieldTrackerState {
  /** Identifiers of fields modified by the user since the last successful autosave 2xx. */
  dirtyFields: Set<FieldId>;
  /** Snapshot of dirty fields included in the currently in-flight payload, or `null` when idle. */
  inFlight: Set<FieldId> | null;
}

interface DirtyFieldTrackerActions {
  /** Add a single field id to the dirty set. */
  markDirty(id: FieldId): void;
  /** Add many field ids to the dirty set in one update (used by RHF derivation). */
  markDirtyMany(ids: Iterable<FieldId>): void;
  /**
   * Capture the current dirty set as the in-flight payload snapshot and return
   * it. Called by Smart_Autosave immediately before dispatching a request.
   */
  beginInFlight(): ReadonlySet<FieldId>;
  /**
   * Called after a request resolves with 2xx. Clears from the dirty set only
   * the ids that were sent AND were not re-modified during the request
   * (`postSendChanges`), then clears the in-flight snapshot (AC 2.8).
   */
  markSaved(sent: ReadonlySet<FieldId>, postSendChanges: ReadonlySet<FieldId>): void;
  /**
   * Called on 4xx (non-409) / 5xx / network / timeout / 409. Leaves the dirty
   * set unchanged and only clears the in-flight snapshot (AC 2.9, AC 2.12).
   */
  rollback(): void;
  /** Returns the current dirty set as a read-only view. */
  snapshot(): ReadonlySet<FieldId>;
}

export type DirtyFieldTrackerStore = DirtyFieldTrackerState & DirtyFieldTrackerActions;

export const useDirtyFieldTracker = create<DirtyFieldTrackerStore>((set, get) => ({
  dirtyFields: new Set<FieldId>(),
  inFlight: null,

  markDirty: (id) =>
    set((s) => {
      if (s.dirtyFields.has(id)) {
        return s;
      }
      const next = new Set(s.dirtyFields);
      next.add(id);
      return { dirtyFields: next };
    }),

  markDirtyMany: (ids) =>
    set((s) => {
      const next = new Set(s.dirtyFields);
      let changed = false;
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? { dirtyFields: next } : s;
    }),

  beginInFlight: () => {
    const snap = new Set(get().dirtyFields);
    set({ inFlight: snap });
    return snap;
  },

  markSaved: (sent, postSendChanges) =>
    set((s) => {
      // Oracle (Property 8, 2xx branch):
      //   next = pre-state \ (sent \ postSendChanges)
      // i.e. keep an id when it was NOT part of the sent payload, OR when it was
      // re-edited by the user while the request was in flight.
      const next = new Set<FieldId>();
      for (const id of s.dirtyFields) {
        if (!sent.has(id) || postSendChanges.has(id)) {
          next.add(id);
        }
      }
      return { dirtyFields: next, inFlight: null };
    }),

  rollback: () => set({ inFlight: null }),

  snapshot: () => get().dirtyFields,
}));

/**
 * Flattens react-hook-form's nested `formState.dirtyFields` object into a flat
 * list of dot-path {@link FieldId}s, where only the leaf fields marked `true`
 * are emitted (e.g. `repair_works.2.price`).
 */
export function flattenDirtyFields(dirty: unknown, prefix = ''): FieldId[] {
  if (dirty === true) {
    return prefix ? [prefix] : [];
  }
  if (Array.isArray(dirty)) {
    const out: FieldId[] = [];
    dirty.forEach((item, index) => {
      const path = prefix ? `${prefix}.${index}` : String(index);
      out.push(...flattenDirtyFields(item, path));
    });
    return out;
  }
  if (dirty !== null && typeof dirty === 'object') {
    const out: FieldId[] = [];
    for (const [key, value] of Object.entries(dirty as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      out.push(...flattenDirtyFields(value, path));
    }
    return out;
  }
  return [];
}

/**
 * React hook that derives the Dirty_Field_Tracker from react-hook-form's
 * `formState.dirtyFields` (AC 2.1). Pass `formState.dirtyFields` directly; the
 * hook re-syncs whenever RHF reports a change.
 */
export function useDirtyFieldSync(dirtyFields: FieldValues): void {
  const markDirtyMany = useDirtyFieldTracker((s) => s.markDirtyMany);
  useEffect(() => {
    markDirtyMany(flattenDirtyFields(dirtyFields));
  }, [dirtyFields, markDirtyMany]);
}

/**
 * Non-React accessor for Smart_Autosave and the trigger hooks, which need to
 * read and mutate the tracker outside of the React render cycle
 * (e.g. `dirtyFieldTracker.snapshot()`).
 */
export const dirtyFieldTracker = {
  markDirty: (id: FieldId) => useDirtyFieldTracker.getState().markDirty(id),
  markDirtyMany: (ids: Iterable<FieldId>) => useDirtyFieldTracker.getState().markDirtyMany(ids),
  beginInFlight: () => useDirtyFieldTracker.getState().beginInFlight(),
  markSaved: (sent: ReadonlySet<FieldId>, postSendChanges: ReadonlySet<FieldId>) =>
    useDirtyFieldTracker.getState().markSaved(sent, postSendChanges),
  rollback: () => useDirtyFieldTracker.getState().rollback(),
  snapshot: (): ReadonlySet<FieldId> => useDirtyFieldTracker.getState().snapshot(),
} as const;
