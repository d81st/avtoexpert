import { Check } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { notify } from '@/shared/notifications/notify';
import { useEditDebounceTrigger } from '../hooks/useEditDebounceTrigger';
import { useFieldBlurTrigger } from '../hooks/useFieldBlurTrigger';
import type { CooldownReason } from '../hooks/useReportFinalize';
import { AUTOSAVE_ELIGIBLE_STEPS, AUTOSAVE_INTERVAL_MS } from '../lib/autosave.config';
import { smartAutosave } from '../model/smartAutosave';
import { useFormStore } from '../model/useFormStore';
import Step1 from './Step1';
import Step2 from './Step2';
import Step3 from './Step3';
import Step4 from './Step4';
import Step5 from './Step5';

/**
 * Props consumed exclusively by Step5 (the finalize/generate step). They are
 * grouped so that steps 1–4 never receive them and the Step5 subtree is the
 * only consumer — passing them through Wizard does not re-render sibling steps,
 * since exactly one Step is mounted at a time (R1.7).
 */
interface WizardStep5Props {
  onFinalize: () => Promise<void>;
  isGenerating: boolean;
  generateError: string | null;
  generateSuccess: boolean;
  cooldownReason: CooldownReason;
  cooldownSecondsLeft: number;
}

interface WizardProps {
  /**
   * Identifier of the report being edited. Required for Smart_Autosave activation
   * (AC 2.11). Passed verbatim into `smartAutosave.configure(...)` via a live ref
   * reader so the coordinator always sees the current value at dispatch time.
   */
  reportId: string | undefined;
  currentStep: number;
  totalSteps: number;
  /** Forwarded to the active Step so it can report its validity upward. */
  onValidationChange: (isValid: boolean) => void;
  /** Props required only by Step5. */
  step5Props: WizardStep5Props;
  /** Navigation footer (Previous/Next), rendered below the active Step. */
  navigation?: ReactNode;
}

function Wizard({
  reportId,
  currentStep,
  totalSteps,
  onValidationChange,
  step5Props,
  navigation,
}: WizardProps) {
  // Live readers consumed by the Smart_Autosave coordinator. The closures
  // registered through `configure(...)` read these refs at dispatch time, so
  // the coordinator always observes the latest `reportId`/`currentStep`
  // without needing to re-call `configure(...)` on every render (AC 2.11).
  const reportIdRef = useRef(reportId);
  reportIdRef.current = reportId;
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  // Smart_Autosave is active only on Wizard steps 2/3/4 (AC 2.11). Outside of
  // that set the trigger hooks must detach their listeners so a stray blur or
  // input on Step1/Step5 cannot reach the coordinator. The hooks honour
  // `enabled === false` by skipping listener installation.
  const autosaveEligible = (AUTOSAVE_ELIGIBLE_STEPS as readonly number[]).includes(currentStep);

  // Field_Blur_Trigger (AC 2.5) and Edit_Debounce_Trigger (AC 2.4) both attach
  // a single listener to the step container element. Both refs are joined to
  // the same wrapper below so a single subtree feeds both triggers — keeping
  // the two listeners independent and avoiding any cross-coupling.
  const blurContainerRef = useFieldBlurTrigger({
    scheduler: smartAutosave,
    enabled: autosaveEligible,
  });
  const editContainerRef = useEditDebounceTrigger({
    scheduler: smartAutosave,
    enabled: autosaveEligible,
  });

  // Install the Smart_Autosave coordinator config once on mount. The getters
  // close over refs and `useFormStore.getState()`, both of which return the
  // latest state at dispatch time — so no dep array is needed here.
  useEffect(() => {
    smartAutosave.configure({
      getReportId: () => reportIdRef.current,
      getCurrentStep: () => currentStepRef.current,
      // Autosave_Payload values are resolved by `getNestedValue(values, dot.path)`
      // (see `smartAutosave.ts`). The Dirty_Field_Tracker stores dot-path
      // identifiers scoped to step2/step3/step4 RHF forms, which match the
      // shapes persisted in `useFormStore`. Merging the three step snapshots
      // yields a single lookup root that resolves any dirty field id without
      // namespace collisions (the existing `toApiAutosave` mapper relies on the
      // same disjoint-keys assumption).
      getValues: () => {
        const { step2, step3, step4 } = useFormStore.getState();
        return {
          ...(step2 ?? {}),
          ...(step3 ?? {}),
          ...(step4 ?? {}),
        };
      },
      onConflict: () => {
        // AC 2.12 — 409 from `PATCH /api/reports/:id/autosave` ⇒ warning toast;
        // the coordinator's catch branch calls `dirtyFieldTracker.rollback()`,
        // which clears only the in-flight snapshot and keeps the dirty set
        // intact, so the next trigger will re-send the same fields.
        notify.warning('Версия заключения устарела', {
          description: 'Кто-то изменил заключение параллельно. Перезагрузите страницу.',
        });
      },
      onError: () => {
        // AC 2.9 — network / timeout / non-409 4xx-5xx ⇒ error toast; dirty
        // state is preserved by the coordinator's rollback (same path as 409).
        notify.error('Не удалось сохранить черновик', {
          description: 'Изменения сохранены локально и будут отправлены при следующей попытке.',
        });
      },
    });
  }, []);

  // 60-second backstop (Requirement 3 of `frontend-ux-enhancements`, preserved
  // here as AC 2.6/2.10): a recurring tick that routes through the same
  // coordinator as the blur and edit triggers, so all three sources funnel
  // through `smartAutosave.schedule(...)`. The coordinator's in-flight
  // singleton + coalesce window (AC 2.7) guarantee that overlapping ticks
  // cannot launch a parallel request. The interval is installed only while
  // the user is on an autosave-eligible step (AC 2.11), and is cleared on
  // step change or unmount.
  useEffect(() => {
    if (!autosaveEligible) {
      return;
    }
    const intervalId = setInterval(() => {
      smartAutosave.schedule('backstop');
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [autosaveEligible]);

  // Per-Step subtree rendering (R1.7): select exactly one of Step1..Step5 for
  // the current step. Only the active Step is mounted, so editing a field in
  // the current Step cannot re-render the other Step subtrees — they are not
  // part of the React tree.
  let activeStep: ReactNode = null;
  if (currentStep === 1) {
    activeStep = <Step1 onValidationChange={onValidationChange} />;
  } else if (currentStep === 2) {
    activeStep = <Step2 onValidationChange={onValidationChange} />;
  } else if (currentStep === 3) {
    activeStep = <Step3 onValidationChange={onValidationChange} />;
  } else if (currentStep === 4) {
    activeStep = <Step4 onValidationChange={onValidationChange} />;
  } else if (currentStep === 5) {
    activeStep = (
      <Step5
        onValidationChange={onValidationChange}
        onFinalize={step5Props.onFinalize}
        isGenerating={step5Props.isGenerating}
        generateError={step5Props.generateError}
        generateSuccess={step5Props.generateSuccess}
        cooldownReason={step5Props.cooldownReason}
        cooldownSecondsLeft={step5Props.cooldownSecondsLeft}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="surface-card mb-6 rounded-3xl p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="gradient-text text-xs font-semibold uppercase tracking-[0.2em]">
              Мастер заполнения
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Выполнено шагов: {currentStep} из {totalSteps}
            </p>
          </div>
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
            Шаг {currentStep}/{totalSteps}
          </Badge>
        </div>
        <div className="gradient-divider mt-2 mb-4" />

        <div className="grid grid-cols-5 gap-2 md:gap-3">
          {[...Array(totalSteps)].map((_, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isActive = stepNumber === currentStep;

            return (
              <div key={stepNumber} className="text-center">
                <div
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold transition-all ${
                    isCompleted
                      ? 'bg-emerald-100 text-emerald-700'
                      : isActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
                </div>
                <div
                  className={`mt-2 text-[11px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  Шаг {stepNumber}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/*
        Step container — bears both Field_Blur_Trigger and Edit_Debounce_Trigger
        listeners. `blur` does not bubble (capture phase is used by the hook),
        while `input` does, so a single container observes every Form_Input_Field
        in the active Step subtree. The callback ref forwards the same DOM node
        to both trigger hooks; the hooks no-op when `enabled === false`, so
        Step1 / Step5 ride along without dispatching anything.
      */}
      <div
        className="surface-card rounded-3xl p-6 md:p-8"
        ref={(node) => {
          (blurContainerRef as { current: HTMLElement | null }).current = node;
          (editContainerRef as { current: HTMLElement | null }).current = node;
        }}
      >
        <div className="mb-6">{activeStep}</div>
        {navigation}
      </div>
    </div>
  );
}

export default Wizard;
