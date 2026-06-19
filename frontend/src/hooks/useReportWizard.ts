import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFormStore } from "@/store/useFormStore";
import { useReportStore } from "@/store/useReportStore";
import { reportService } from "@/features/reports/api/reportApi";
import { normalizeReport } from "@/utils/reportMapper";

interface UseReportWizardParams {
  id?: string;
}

export function useReportWizard({ id }: UseReportWizardParams) {
  const navigate = useNavigate();

  const {
    currentStep,
    setCurrentStep,
    step1,
    step2,
    step3,
    step4,
    step5,
    resetForm,
    hydrateFromReport,
  } = useFormStore();

  const { currentReport, setCurrentReport, setLoading, setError } =
    useReportStore();

  const justCreatedRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (reportId: string) => {
      setLoading(true);
      try {
        const raw = await reportService.getReport(reportId);
        const report = normalizeReport(raw);
        setCurrentReport(report);
        hydrateFromReport(raw);
        setCurrentStep(Math.max(report.current_step, 1));
      } catch {
        setError("Ошибка загрузки заключения");
        navigate("/");
      } finally {
        setLoading(false);
      }
    },
    [navigate, setLoading, setError, setCurrentReport, hydrateFromReport, setCurrentStep],
  );

  useEffect(() => {
    if (id) {
      if (justCreatedRef.current) {
        justCreatedRef.current = false;
        return;
      }
      fetchReport(id);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleNext = useCallback(
    async (isValid: boolean) => {
      if (!isValid) return;
      setSaveError(null);

      if (currentStep === 1 && step1) {
        try {
          const report = await reportService.createReport(step1);
          justCreatedRef.current = true;
          setCurrentReport(report);
          hydrateFromReport({ ...report, expertId: step1.expert_id });
          setCurrentStep(2);
          navigate(`/report/${report.id}`);
        } catch (err) {
          setSaveError(
            (err as Error).message || "Ошибка создания черновика",
          );
        }
        return;
      }

      if (!currentReport?.id) return;

      try {
        switch (currentStep) {
          case 2:
            if (step2) await reportService.updateStep2(currentReport.id, step2);
            break;
          case 3:
            if (step3) await reportService.updateStep3(currentReport.id, step3);
            break;
          case 4:
            if (step4) await reportService.updateStep4(currentReport.id, step4);
            break;
          case 5:
            if (step5) await reportService.updateStep5(currentReport.id, step5);
            break;
        }

        if (currentStep < 5) {
          setCurrentStep(currentStep + 1);
        }
      } catch (err) {
        setSaveError((err as Error).message || "Ошибка сохранения шага");
      }
    },
    [
      currentStep,
      step1,
      step2,
      step3,
      step4,
      step5,
      currentReport,
      navigate,
      setCurrentReport,
      setCurrentStep,
      hydrateFromReport,
    ],
  );

  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, setCurrentStep]);

  return {
    currentStep,
    currentReport,
    fetchReport,
    handleNext,
    handlePrevious,
    saveError,
    setSaveError,
  };
}
