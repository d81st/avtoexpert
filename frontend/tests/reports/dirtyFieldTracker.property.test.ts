import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  type FieldId,
  useDirtyFieldTracker,
} from '@/features/reports/model/dirtyFieldTracker';

/**
 * Property 4: Dirty_Field_Tracker is the union of edits since last save.
 *
 * For any sequence of operations drawn from
 * {markDirty(fieldId), markSaved(sent, postSendChanges), rollback()}, the
 * resulting tracker state MUST equal the oracle: the set of all `markDirty`
 * fields since the last successful `markSaved`, minus those cleared by the most
 * recent `markSaved` and not subsequently re-dirtied.
 *
 * **Validates: Requirements 2.1**
 */

// Small field-id pool so random sequences overlap heavily, exercising the
// add / clear / re-dirty transitions that the oracle must track.
const FIELD_POOL: FieldId[] = ['a', 'b', 'c', 'd', 'e'];
const fieldId = (): fc.Arbitrary<FieldId> => fc.constantFrom(...FIELD_POOL);
const fieldSet = (): fc.Arbitrary<Set<FieldId>> =>
  fc.uniqueArray(fieldId()).map((ids) => new Set(ids));

/** Reference (oracle) model of the dirty-field set. */
interface Model {
  dirty: Set<FieldId>;
}

const real = useDirtyFieldTracker;

function resetStore(): void {
  real.setState({ dirtyFields: new Set<FieldId>(), inFlight: null });
}

function assertEqualSets(actual: ReadonlySet<FieldId>, expected: Set<FieldId>): void {
  const a = [...actual].sort();
  const b = [...expected].sort();
  expect(a).toEqual(b);
}

class MarkDirtyCommand implements fc.Command<Model, void> {
  constructor(private readonly id: FieldId) {}
  check(): boolean {
    return true;
  }
  run(model: Model): void {
    // Oracle: a markDirty since the last save adds the field to the set.
    model.dirty.add(this.id);
    real.getState().markDirty(this.id);
    assertEqualSets(real.getState().snapshot(), model.dirty);
  }
  toString(): string {
    return `markDirty(${this.id})`;
  }
}

class MarkSavedCommand implements fc.Command<Model, void> {
  constructor(
    private readonly sent: Set<FieldId>,
    private readonly postSendChanges: Set<FieldId>,
  ) {}
  check(): boolean {
    return true;
  }
  run(model: Model): void {
    // Oracle (2xx branch): next = pre-state \ (sent \ postSendChanges).
    // Keep an id when it was NOT sent, OR it was re-dirtied during the request.
    const next = new Set<FieldId>();
    for (const id of model.dirty) {
      if (!this.sent.has(id) || this.postSendChanges.has(id)) {
        next.add(id);
      }
    }
    model.dirty = next;
    real.getState().markSaved(this.sent, this.postSendChanges);
    assertEqualSets(real.getState().snapshot(), model.dirty);
  }
  toString(): string {
    return `markSaved(sent={${[...this.sent]}}, post={${[...this.postSendChanges]}})`;
  }
}

class RollbackCommand implements fc.Command<Model, void> {
  check(): boolean {
    return true;
  }
  run(model: Model): void {
    // Oracle: rollback leaves the dirty set unchanged.
    real.getState().rollback();
    assertEqualSets(real.getState().snapshot(), model.dirty);
  }
  toString(): string {
    return 'rollback()';
  }
}

describe('Property 4: Dirty_Field_Tracker is the union of edits since last save', () => {
  beforeEach(() => {
    resetStore();
  });

  it('tracker state equals the oracle across random operation sequences', () => {
    const commands = fc.commands(
      [
        fieldId().map((id) => new MarkDirtyCommand(id)),
        fc
          .tuple(fieldSet(), fieldSet())
          .map(([sent, post]) => new MarkSavedCommand(sent, post)),
        fc.constant(new RollbackCommand()),
      ],
      { maxCommands: 40 },
    );

    fc.assert(
      fc.property(commands, (cmds) => {
        resetStore();
        const setup = (): { model: Model; real: void } => ({
          model: { dirty: new Set<FieldId>() },
          real: undefined,
        });
        fc.modelRun(setup, cmds);
      }),
      { numRuns: 200, verbose: true },
    );
  });
});
