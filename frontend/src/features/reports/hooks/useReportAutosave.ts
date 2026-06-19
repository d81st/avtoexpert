import { useEffect, useState } from "react";
import { useFormStore } from "../model/useFormStore";
import { reportService } from "../api/reportApi";

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

  useEffect(() => {
    if (!reportId || currentStep === 1) return;

    const timeoutId = setTimeout(async () => {
      setIsSaving(true);
      try {
        await reportService.autosave(reportId, { step2, step3, step4 });
      } catch (err) {
        console.error("Autosave error:", err);
      } finally {
        setIsSaving(false);
      }
    }, 30_000);

    return () => clearTimeout(timeoutId);
  }, [currentStep, reportId, step2, step3, step4]);

  return { isSaving };
}
