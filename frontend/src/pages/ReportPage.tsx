import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFormStore } from "../store/useFormStore";
import { useReportStore } from "../store/useReportStore";
import { reportService } from "../services/reportService";
import { debounce } from "../utils/debounce";
import { normalizeReport } from "../utils/reportMapper";
import Wizard from "../components/Wizard";
import WizardNavigation from "../components/WizardNavigation";
import Loader from "../components/Loader";
import Alert from "../components/Alert";
import Step1 from "../components/Step1";
import Step2 from "../components/Step2";
import Step3 from "../components/Step3";
import Step4 from "../components/Step4";
import Step5 from "../components/Step5";

const TOTAL_STEPS = 5;

function ReportPage() {
  const { id } = useParams<{ id: string }>();
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

  const {
    currentReport,
    setCurrentReport,
    isLoading,
    setLoading,
    setError,
    error,
  } = useReportStore();

  // флаг: отчёт только что создан через createReport — не перезагружать из API
  const justCreatedRef = useRef(false);

  const [isValid, setIsValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      if (justCreatedRef.current) {
        // отчёт только что создан: данные уже есть в store, fetchReport не нужен
        justCreatedRef.current = false;
        return;
      }
      fetchReport(id);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const autosaveReport = useCallback(
    debounce(async (reportId: string) => {
      if (!reportId || currentStep === 1) return;

      setIsSaving(true);
      try {
        await reportService.autosave(reportId, { step2, step3, step4 });
      } catch (err) {
        console.error("Autosave error:", err);
      } finally {
        setIsSaving(false);
      }
    }, 30000),
    [currentStep, step2, step3, step4],
  );

  useEffect(() => {
    if (currentReport?.id && currentStep > 1) {
      autosaveReport(currentReport.id);
    }
  }, [
    step2,
    step3,
    step4,
    step5,
    currentReport?.id,
    currentStep,
    autosaveReport,
  ]);

  const fetchReport = async (reportId: string) => {
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
  };

  const handleNext = async () => {
    if (!isValid) return;
    setSaveError(null);

    if (currentStep === 1 && step1) {
      try {
        const report = await reportService.createReport(step1);
        // Ставим флаг ДО navigate, чтобы useEffect([id]) не запустил fetchReport
        justCreatedRef.current = true;
        setCurrentReport(report);
        hydrateFromReport({ ...report, expertId: step1.expert_id });
        setCurrentStep(2);
        navigate(`/report/${report.id}`);
      } catch (err) {
        setSaveError((err as Error).message || "Ошибка создания черновика");
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

      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1);
      }
    } catch (err) {
      setSaveError((err as Error).message || "Ошибка сохранения шага");
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinalize = async () => {
    if (!currentReport?.id || isGenerating) return;

    setIsGenerating(true);
    setGenerateError(null);
    setGenerateSuccess(false);

    try {
      if (step5) {
        await reportService.updateStep5(currentReport.id, step5);
      }

      const result = await reportService.finalizeAndGenerate(currentReport.id);
      const filename =
        result.filename || `zaklyuchenie_${currentReport.report_number}.docx`;
      await reportService.downloadDocument(result.download_url, filename);

      setGenerateSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setGenerateError((err as Error).message || "Ошибка генерации документа");
    } finally {
      setIsGenerating(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1 onValidationChange={setIsValid} />;
      case 2:
        return <Step2 onValidationChange={setIsValid} />;
      case 3:
        return <Step3 onValidationChange={setIsValid} />;
      case 4:
        return <Step4 onValidationChange={setIsValid} />;
      case 5:
        return (
          <Step5
            onValidationChange={setIsValid}
            onFinalize={handleFinalize}
            isGenerating={isGenerating}
            generateError={generateError}
            generateSuccess={generateSuccess}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return <Loader message="Загрузка заключения..." />;
  }

  return (
    <div className="app-shell py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="surface-card mb-6 flex flex-col justify-between gap-4 rounded-3xl p-5 md:flex-row md:items-center md:p-6">
          <div>
            <h1 className="brand-title text-3xl font-bold text-slate-900">
              {currentReport?.report_number
                ? `Заключение №${currentReport.report_number}`
                : "Новое заключение"}
            </h1>
            <p className="page-subtitle mt-1 text-sm">
              Шаг {currentStep} из {TOTAL_STEPS}
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ← Назад к списку
          </button>
        </div>

        {(saveError || error) && (
          <div className="mb-4">
            <Alert
              type="error"
              message={saveError || error || ""}
              onClose={() => {
                setSaveError(null);
                setError(null);
              }}
            />
          </div>
        )}

        <Wizard currentStep={currentStep} totalSteps={TOTAL_STEPS}>
          <div className="mb-6">{renderStep()}</div>

          {currentStep < TOTAL_STEPS && (
            <WizardNavigation
              onNext={handleNext}
              onPrevious={handlePrevious}
              canGoNext={isValid}
              canGoPrevious={currentStep > 1}
              isLastStep={false}
            />
          )}
        </Wizard>

        {isSaving && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <span className="animate-spin">⟳</span>
            Авто-сохранение...
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportPage;
