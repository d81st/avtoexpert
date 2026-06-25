import { useRef } from "react";
import { useFormStore } from "../model/useFormStore";
import type {
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
} from "../types";
import type { UseReportWizardReturn } from "./useReportWizard";

interface UseWizardStepSaveParams {
  wizard: UseReportWizardReturn;
  isValid: boolean;
}

interface UseWizardStepSaveReturn {
  handleSaveAndNext: () => void;
  mutationError: string | null;
  resetErrors: () => void;
  isSaving: boolean;
}

interface LastSavedSnapshots {
  step2?: Step2Data;
  step3?: Step3Data;
  step4?: Step4Data;
  step5?: Step5Data;
}

/**
 * Локальный deep-equal сравниватель для JSON-подобных значений шагов формы.
 *
 * Поддерживает примитивы, массивы и обычные объекты — этого достаточно для
 * сравнения `step2/step3/step4/step5` (в формах нет Date/Map/Set/RegExp).
 * Не вводит новых рантайм-зависимостей (Requirements 5.9 / 7.9).
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) {
    return false;
  }
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") {
    // Покрывает NaN === NaN; остальные примитивы уже отсечены `a === b`.
    return Number.isNaN(a as number) && Number.isNaN(b as number);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}

export function useWizardStepSave({
  wizard,
  isValid,
}: UseWizardStepSaveParams): UseWizardStepSaveReturn {
  const step1 = useFormStore((s) => s.step1);
  const step2 = useFormStore((s) => s.step2);
  const step3 = useFormStore((s) => s.step3);
  const step4 = useFormStore((s) => s.step4);
  const step5 = useFormStore((s) => s.step5);

  // Снапшоты последних успешно отправленных значений шагов.
  // При первом переходе snapshot отсутствует (undefined) → deepEqual возвращает
  // `false` и мутация выполняется — текущее поведение сохраняется (Requirement 7.5).
  const lastSavedRef = useRef<LastSavedSnapshots>({});

  const {
    currentStep,
    createMutation,
    saveStep2Mutation,
    saveStep3Mutation,
    saveStep4Mutation,
    saveStep5Mutation,
    handleNext,
  } = wizard;

  const isSaving =
    createMutation.isPending ||
    saveStep2Mutation.isPending ||
    saveStep3Mutation.isPending ||
    saveStep4Mutation.isPending ||
    saveStep5Mutation.isPending;

  const mutationError =
    createMutation.error?.message ||
    saveStep2Mutation.error?.message ||
    saveStep3Mutation.error?.message ||
    saveStep4Mutation.error?.message ||
    saveStep5Mutation.error?.message ||
    null;

  const resetErrors = () => {
    createMutation.reset();
    saveStep2Mutation.reset();
    saveStep3Mutation.reset();
    saveStep4Mutation.reset();
    saveStep5Mutation.reset();
  };

  const handleSaveAndNext = () => {
    if (!isValid) return;

    if (currentStep === 1 && step1) {
      createMutation.mutate(step1);
      return;
    }

    switch (currentStep) {
      case 2:
        if (step2) {
          if (deepEqual(step2, lastSavedRef.current.step2)) {
            handleNext();
          } else {
            saveStep2Mutation.mutate(step2, {
              onSuccess: () => {
                lastSavedRef.current.step2 = step2;
                handleNext();
              },
            });
          }
        } else {
          handleNext();
        }
        break;
      case 3:
        if (step3) {
          if (deepEqual(step3, lastSavedRef.current.step3)) {
            handleNext();
          } else {
            saveStep3Mutation.mutate(step3, {
              onSuccess: () => {
                lastSavedRef.current.step3 = step3;
                handleNext();
              },
            });
          }
        } else {
          handleNext();
        }
        break;
      case 4:
        if (step4) {
          if (deepEqual(step4, lastSavedRef.current.step4)) {
            handleNext();
          } else {
            saveStep4Mutation.mutate(step4, {
              onSuccess: () => {
                lastSavedRef.current.step4 = step4;
                handleNext();
              },
            });
          }
        } else {
          handleNext();
        }
        break;
      case 5:
        if (step5) {
          if (deepEqual(step5, lastSavedRef.current.step5)) {
            // На шаге 5 навигации `handleNext` нет — просто выходим без мутации.
            return;
          }
          saveStep5Mutation.mutate(step5, {
            onSuccess: () => {
              lastSavedRef.current.step5 = step5;
            },
          });
        }
        break;
    }
  };

  return {
    handleSaveAndNext,
    mutationError,
    resetErrors,
    isSaving,
  };
}
