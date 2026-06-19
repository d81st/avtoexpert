import { useEffect, useRef, useState } from "react";
import { useFormStore } from "@/store/useFormStore";
import { useExperts } from "@/hooks/useExperts";
import { validateStep1 } from "@/utils/validators";

import Alert from "@/components/Alert";
import ExpertManagerModal from "@/components/ExpertManagerModal";
import Input from "@/components/Input";

function Step1({
  onValidationChange,
}: {
  onValidationChange: (isValid: boolean) => void;
}) {
  const { step1, setStep1 } = useFormStore();

  const [expertId, setExpertId] = useState("");
  const [reportNumber, setReportNumber] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [applicationDate, setApplicationDate] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const initializedRef = useRef(false);

  const {
    experts,
    isLoading,
    error,
    setError,
    showExpertModal,
    newExpertName,
    setNewExpertName,
    editingExpertId,
    expertError,
    setExpertError,
    openExpertModal,
    closeExpertModal,
    handleAddExpert,
    handleUpdateExpert,
    handleDeleteExpert,
    openEditExpert,
  } = useExperts({
    selectedExpertId: expertId,
    onSelectExpert: setExpertId,
  });

  useEffect(() => {
    if (!initializedRef.current && step1) {
      initializedRef.current = true;
      setExpertId(step1.expert_id);
      setReportNumber(step1.report_number);
      setReportDate(step1.report_date);
      setApplicationDate(step1.application_date);
    }
  }, [step1]);

  useEffect(() => {
    onValidationChange(validateStep1({
      expert_id: expertId,
      report_number: reportNumber,
      report_date: reportDate,
      application_date: applicationDate,
    }));
  }, [expertId, reportNumber, reportDate, applicationDate, onValidationChange]);

  useEffect(() => {
    setStep1({
      expert_id: expertId,
      report_number: reportNumber,
      report_date: reportDate,
      application_date: applicationDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expertId, reportNumber, reportDate, applicationDate]);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const getFieldError = (field: string) => {
    if (!touched[field]) return null;

    switch (field) {
      case "expertId":
        return !expertId ? "Выберите эксперта" : null;
      case "reportNumber":
        return !reportNumber ? "Введите номер заключения" : null;
      case "reportDate":
        return !reportDate ? "Выберите дату заключения" : null;
      case "applicationDate":
        return !applicationDate ? "Выберите дату подачи заявки" : null;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Шаг 1: Основная информация
        </h2>
        <p className="text-sm text-gray-600 mt-2">
          Укажите основные данные для заключения об экспертизе
        </p>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} />
      )}

      <div className="space-y-6 mt-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label
              htmlFor="expert"
              className="block text-sm font-medium text-gray-700"
            >
              Эксперт <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={openExpertModal}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Добавить эксперта
            </button>
          </div>
          <select
            id="expert"
            value={expertId}
            onChange={(event) => setExpertId(event.target.value)}
            onBlur={() => handleBlur("expertId")}
            disabled={isLoading}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              touched["expertId"] && getFieldError("expertId")
                ? "border-red-300 bg-red-50"
                : "border-gray-300"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            required
          >
            <option value="">Выберите эксперта из списка</option>
            {experts.map((expert) => (
              <option key={expert.id} value={expert.id}>
                {expert.full_name}
              </option>
            ))}
          </select>
          {touched["expertId"] && getFieldError("expertId") && (
            <p className="text-red-500 text-sm mt-1">
              {getFieldError("expertId")}
            </p>
          )}
        </div>

        <Input
          type="text"
          id="reportNumber"
          label="Номер заключения"
          value={reportNumber}
          onChange={(event) => setReportNumber(event.target.value)}
          onBlur={() => handleBlur("reportNumber")}
          error={
            touched["reportNumber"]
              ? (getFieldError("reportNumber") ?? undefined)
              : undefined
          }
          placeholder="Например: 2024-001"
          required
        />

        <Input
          type="date"
          id="reportDate"
          label="Дата заключения"
          value={reportDate}
          onChange={(event) => setReportDate(event.target.value)}
          onBlur={() => handleBlur("reportDate")}
          error={
            touched["reportDate"]
              ? (getFieldError("reportDate") ?? undefined)
              : undefined
          }
          required
        />

        <Input
          type="date"
          id="applicationDate"
          label="Дата подачи заявки"
          value={applicationDate}
          onChange={(event) => setApplicationDate(event.target.value)}
          onBlur={() => handleBlur("applicationDate")}
          error={
            touched["applicationDate"]
              ? (getFieldError("applicationDate") ?? undefined)
              : undefined
          }
          required
        />
      </div>

      {showExpertModal && (
        <ExpertManagerModal
          experts={experts}
          newExpertName={newExpertName}
          editingExpertId={editingExpertId}
          expertError={expertError}
          onNameChange={setNewExpertName}
          onErrorClose={() => setExpertError(null)}
          onAddExpert={handleAddExpert}
          onUpdateExpert={handleUpdateExpert}
          onDeleteExpert={handleDeleteExpert}
          onEditExpert={openEditExpert}
          onClose={closeExpertModal}
        />
      )}
    </div>
  );
}

export default Step1;
