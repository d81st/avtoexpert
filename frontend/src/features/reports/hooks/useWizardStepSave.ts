import { useFormStore } from "../model/useFormStore";
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

export function useWizardStepSave({
  wizard,
  isValid,
}: UseWizardStepSaveParams): UseWizardStepSaveReturn {
  const step1 = useFormStore((s) => s.step1);
  const step2 = useFormStore((s) => s.step2);
  const step3 = useFormStore((s) => s.step3);
  const step4 = useFormStore((s) => s.step4);
  const step5 = useFormStore((s) => s.step5);

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
          saveStep2Mutation.mutate(step2, { onSuccess: () => handleNext() });
        } else {
          handleNext();
        }
        break;
      case 3:
        if (step3) {
          saveStep3Mutation.mutate(step3, { onSuccess: () => handleNext() });
        } else {
          handleNext();
        }
        break;
      case 4:
        if (step4) {
          saveStep4Mutation.mutate(step4, { onSuccess: () => handleNext() });
        } else {
          handleNext();
        }
        break;
      case 5:
        if (step5) {
          saveStep5Mutation.mutate(step5);
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
