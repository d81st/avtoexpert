import { create } from 'zustand';
import { hydrateFormFromReport } from '../lib/reportMapper';
import type { Step1Data, Step2Data, Step3Data, Step4Data, Step5Data } from '../types';

interface FormState {
  currentStep: number;
  step1: Step1Data | null;
  step2: Step2Data | null;
  step3: Step3Data | null;
  step4: Step4Data | null;
  step5: Step5Data | null;
  setCurrentStep: (step: number) => void;
  setStep1: (data: Step1Data) => void;
  setStep2: (data: Step2Data) => void;
  setStep3: (data: Step3Data) => void;
  setStep4: (data: Step4Data) => void;
  setStep5: (data: Step5Data) => void;
  hydrateFromReport: (report: Record<string, unknown>) => void;
  resetForm: () => void;
}

export const useFormStore = create<FormState>((set) => ({
  currentStep: 1,
  step1: null,
  step2: null,
  step3: null,
  step4: null,
  step5: null,
  setCurrentStep: (step) => set({ currentStep: step }),
  setStep1: (data) => set({ step1: data }),
  setStep2: (data) => set({ step2: data }),
  setStep3: (data) => set({ step3: data }),
  setStep4: (data) => set({ step4: data }),
  setStep5: (data) => set({ step5: data }),
  hydrateFromReport: (report) => {
    const hydrated = hydrateFormFromReport(report);
    set((state) => ({
      // Don't reset step backward — only advance forward
      currentStep: Math.max(state.currentStep, hydrated.currentStep),
      step1: hydrated.step1,
      step2: hydrated.step2,
      step3: hydrated.step3,
      step4: hydrated.step4,
      step5: hydrated.step5,
    }));
  },
  resetForm: () =>
    set({
      currentStep: 1,
      step1: null,
      step2: null,
      step3: null,
      step4: null,
      step5: null,
    }),
}));
