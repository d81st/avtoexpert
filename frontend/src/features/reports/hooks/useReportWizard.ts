import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import { useFormStore } from "../model/useFormStore";
import {
  useReportDetailQuery,
  reportQueryKeys,
} from "../model/reportQueries";
import {
  useUpdateStep2Mutation,
  useUpdateStep3Mutation,
  useUpdateStep4Mutation,
  useUpdateStep5Mutation,
} from "../model/reportQueries";
import { reportService } from "../api/reportApi";
import type {
  Report,
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
} from "../types";

interface UseReportWizardParams {
  id?: string;
}

export interface UseReportWizardReturn {
  currentStep: number;
  reportQuery: UseQueryResult<Record<string, unknown>, Error>;
  createMutation: UseMutationResult<Report, Error, Step1Data, unknown>;
  saveStep2Mutation: UseMutationResult<void, Error, Step2Data, unknown>;
  saveStep3Mutation: UseMutationResult<void, Error, Step3Data, unknown>;
  saveStep4Mutation: UseMutationResult<void, Error, Step4Data, unknown>;
  saveStep5Mutation: UseMutationResult<void, Error, Step5Data, unknown>;
  handleNext: () => void;
  handlePrevious: () => void;
}

export function useReportWizard({ id }: UseReportWizardParams): UseReportWizardReturn {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentStep, setCurrentStep, hydrateFromReport } = useFormStore();

  // Load report data via useQuery (instead of useEffect + fetchReport)
  const reportQuery = useReportDetailQuery(id);

  // Hydrate form when data arrives
  useEffect(() => {
    if (reportQuery.data) {
      hydrateFromReport(reportQuery.data);
      const step = (reportQuery.data as { current_step?: number }).current_step ?? 1;
      setCurrentStep(Math.max(step, 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportQuery.data]);

  // Create report mutation with navigation onSuccess
  const createMutation = useMutation({
    mutationFn: (data: Step1Data) => reportService.createReport(data),
    onSuccess: (report) => {
      void queryClient.invalidateQueries({ queryKey: reportQueryKeys.lists() });
      setCurrentStep(2);
      navigate(`/report/${report.id}`);
    },
  });

  // Separate mutations for each step
  const saveStep2Mutation = useUpdateStep2Mutation(id ?? "");
  const saveStep3Mutation = useUpdateStep3Mutation(id ?? "");
  const saveStep4Mutation = useUpdateStep4Mutation(id ?? "");
  const saveStep5Mutation = useUpdateStep5Mutation(id ?? "");

  // Navigation without API calls
  const handleNext = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  return {
    currentStep,
    reportQuery,
    createMutation,
    saveStep2Mutation,
    saveStep3Mutation,
    saveStep4Mutation,
    saveStep5Mutation,
    handleNext,
    handlePrevious,
  };
}
