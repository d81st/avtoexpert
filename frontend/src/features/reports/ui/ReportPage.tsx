import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReportWizard } from "../hooks/useReportWizard";
import { useReportAutosave } from "../hooks/useReportAutosave";
import { useReportFinalize } from "../hooks/useReportFinalize";
import { useWizardStepSave } from "../hooks/useWizardStepSave";
import { normalizeReport } from "../lib/reportMapper";
import Wizard from "./Wizard";
import WizardNavigation from "./WizardNavigation";
import { Loader2 } from "lucide-react";
import { AppAlert } from "@/components/ui/app-alert";
import Step1 from "./Step1";
import Step2 from "./Step2";
import Step3 from "./Step3";
import Step4 from "./Step4";
import Step5 from "./Step5";

const TOTAL_STEPS = 5;

function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isValid, setIsValid] = useState(false);

  const wizard = useReportWizard({ id });
  const { currentStep, reportQuery, handlePrevious } = wizard;

  const { handleSaveAndNext, mutationError, resetErrors, isSaving } = useWizardStepSave({
    wizard,
    isValid,
  });

  const currentReport = reportQuery.data ? normalizeReport(reportQuery.data) : undefined;

  const { isSaving: isAutosaving } = useReportAutosave({
    reportId: currentReport?.id ?? id,
    currentStep,
  });

  const {
    isGenerating,
    generateError,
    generateSuccess,
    handleFinalize,
  } = useReportFinalize({
    reportId: currentReport?.id ?? id,
  });

  if (reportQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-600">Загрузка заключения...</p>
      </div>
    );
  }

  if (reportQuery.isError && !reportQuery.data) {
    return <AppAlert type="error" message={reportQuery.error?.message || "Ошибка загрузки заключения"} />;
  }

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

        {(mutationError || reportQuery.error) && (
          <div className="mb-4">
            <AppAlert
              type="error"
              message={mutationError || reportQuery.error?.message || ""}
              onClose={resetErrors}
            />
          </div>
        )}

        <Wizard currentStep={currentStep} totalSteps={TOTAL_STEPS}>
          <div className="mb-6">{renderStep()}</div>

          {currentStep < TOTAL_STEPS && (
            <WizardNavigation
              onNext={handleSaveAndNext}
              onPrevious={handlePrevious}
              canGoNext={isValid}
              canGoPrevious={currentStep > 1}
              isLastStep={false}
              isSaving={isSaving}
            />
          )}
        </Wizard>

        {isAutosaving && (
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
