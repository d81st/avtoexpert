import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReportWizard } from "@/features/reports/hooks/useReportWizard";
import { useReportAutosave } from "@/features/reports/hooks/useReportAutosave";
import { useReportFinalize } from "@/features/reports/hooks/useReportFinalize";
import { useReportStore } from "@/features/reports/model/useReportStore";
import Wizard from "@/features/reports/ui/Wizard";
import WizardNavigation from "@/features/reports/ui/WizardNavigation";
import Loader from "@/shared/ui/Loader";
import Alert from "@/shared/ui/Alert";
import Step1 from "@/features/reports/ui/Step1";
import Step2 from "@/features/reports/ui/Step2";
import Step3 from "@/features/reports/ui/Step3";
import Step4 from "@/features/reports/ui/Step4";
import Step5 from "@/features/reports/ui/Step5";

const TOTAL_STEPS = 5;

function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoading, error, setError } = useReportStore();
  const [isValid, setIsValid] = useState(false);

  const {
    currentStep,
    currentReport,
    handleNext,
    handlePrevious,
    saveError,
    setSaveError,
  } = useReportWizard({ id });

  const { isSaving } = useReportAutosave({
    reportId: currentReport?.id,
    currentStep,
  });

  const {
    isGenerating,
    generateError,
    generateSuccess,
    handleFinalize,
  } = useReportFinalize({
    reportId: currentReport?.id,
  });

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
              onNext={() => handleNext(isValid)}
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
