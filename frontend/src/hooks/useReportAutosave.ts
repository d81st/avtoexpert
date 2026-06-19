import { useCallback, useEffect, useState } from "react";
import { useFormStore } from "@/store/useFormStore";
import { reportService } from "@/features/reports/api/reportApi";
import { debounce } from "@/utils/debounce";

interface UseReportAutosaveParams {
  reportId?: string;
  currentStep: number;
}

export function useReportAutosave({
  reportId,
  currentStep,
}: UseReportAutosaveParams) {
  const { step2, step3, step4 } = useFormStore();
  const [isSaving, setIsSaving] = useState(false);

  const autosaveReport = useCallback(
    debounce(async (id: string) => {
      if (!id || currentStep === 1) return;

      setIsSaving(true);
      try {
        await reportService.autosave(id, { step2, step3, step4 });
      } catch (err) {
        console.error("Autosave error:", err);
      } finally {
        setIsSaving(false);
      }
    }, 30000),
    [currentStep, step2, step3, step4],
  );

  useEffect(() => {
    if (reportId && currentStep > 1) {
      autosaveReport(reportId);
    }
  }, [
    step2,
    step3,
    step4,
    reportId,
    currentStep,
    autosaveReport,
  ]);

  return { isSaving };
}
