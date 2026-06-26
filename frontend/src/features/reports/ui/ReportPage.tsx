import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppAlert } from '@/components/ui/app-alert';
import { useReportFinalize } from '../hooks/useReportFinalize';
import { useReportWizard } from '../hooks/useReportWizard';
import { useWizardStepSave } from '../hooks/useWizardStepSave';
import { normalizeReport } from '../lib/reportMapper';
import Wizard from './Wizard';
import WizardNavigation from './WizardNavigation';

const TOTAL_STEPS = 5;

function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isValid, setIsValid] = useState(false);

  const wizard = useReportWizard({ id });
  const { currentStep, reportQuery, handlePrevious } = wizard;

  // mutationError / resetErrors не используются: ошибки шаговых мутаций
  // отображаются глобальным toast'ом через axios-interceptor (AC 5.4, 5.12).
  // Inline `<AppAlert>` для transient-ошибки убран — он дублировал toast
  // и сдвигал layout. Persistent early-return AppAlert для случая "отчёт
  // не найден" сохранён ниже (AC 5.11). См. design.md §8.5.
  const { handleSaveAndNext, isSaving } = useWizardStepSave({
    wizard,
    isValid,
  });

  const currentReport = reportQuery.data ? normalizeReport(reportQuery.data) : undefined;
  const reportId = currentReport?.id ?? id;

  const {
    isGenerating,
    generateError,
    generateSuccess,
    cooldownReason,
    cooldownSecondsLeft,
    handleFinalize,
  } = useReportFinalize({
    reportId,
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
    return (
      <AppAlert type="error" message={reportQuery.error?.message || 'Ошибка загрузки заключения'} />
    );
  }

  return (
    <div className="app-shell py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="surface-card mb-6 flex flex-col justify-between gap-4 rounded-3xl p-5 md:flex-row md:items-center md:p-6">
          <div>
            <h1 className="brand-title text-3xl font-bold text-slate-900">
              {currentReport?.report_number
                ? `Заключение №${currentReport.report_number}`
                : 'Новое заключение'}
            </h1>
            <p className="page-subtitle mt-1 text-sm">
              Шаг {currentStep} из {TOTAL_STEPS}
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ← Назад к списку
          </button>
        </div>

        {/*
          Transient ошибки шаговых мутаций и фоновых ошибок reportQuery
          раньше рендерились здесь inline `<AppAlert>`. Теперь они приходят
          глобальным toast'ом через axios-interceptor (AC 5.4, 5.12) — это
          избавляет от двойного уведомления и сдвига layout.

          Persistent inline `<AppAlert>` для случая "отчёт не найден"
          остаётся выше в early-return (AC 5.11).
        */}

        <Wizard
          reportId={reportId}
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          onValidationChange={setIsValid}
          step5Props={{
            onFinalize: handleFinalize,
            isGenerating,
            generateError,
            generateSuccess,
            cooldownReason,
            cooldownSecondsLeft,
          }}
          navigation={
            currentStep < TOTAL_STEPS ? (
              <WizardNavigation
                onNext={handleSaveAndNext}
                onPrevious={handlePrevious}
                canGoNext={isValid}
                canGoPrevious={currentStep > 1}
                isLastStep={false}
                isSaving={isSaving}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}

export default ReportPage;
