import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useFormStore } from "../model/useFormStore";
import { useExperts } from "../hooks/useExperts";
import { useValidationSync } from "../hooks/useValidationSync";
import type { Step1Data } from "../types";
import Alert from "@/shared/ui/Alert";
import ExpertManagerModal from "./ExpertManagerModal";
import Input from "@/shared/ui/Input";

const EMPTY_STEP1: Step1Data = {
  expert_id: "",
  report_number: "",
  report_date: "",
  application_date: "",
};

interface StepFormProps {
  onValidationChange: (isValid: boolean) => void;
}

function Step1({ onValidationChange }: StepFormProps) {
  const step1Data = useFormStore((s) => s.step1);
  const setStep1 = useFormStore((s) => s.setStep1);

  const {
    register,
    setValue,
    control,
    formState: { isValid, touchedFields, errors },
  } = useForm<Step1Data>({
    mode: "onBlur",
    defaultValues: step1Data ?? EMPTY_STEP1,
  });

  const watchedValues = useWatch({ control }) as Step1Data;

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
    selectedExpertId: watchedValues.expert_id,
    onSelectExpert: (id) =>
      setValue("expert_id", id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      }),
  });

  // Sync form data with FormStore
  useEffect(() => {
    if (watchedValues && Object.keys(watchedValues).length > 0) {
      setStep1({ ...EMPTY_STEP1, ...watchedValues });
    }
  }, [watchedValues, setStep1]);

  // Sync validation state via formState.isValid subscription
  useValidationSync(isValid, onValidationChange);

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
            disabled={isLoading}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              touchedFields.expert_id && errors.expert_id
                ? "border-red-300 bg-red-50"
                : "border-gray-300"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            {...register("expert_id", {
              required: "Выберите эксперта",
            })}
          >
            <option value="">Выберите эксперта из списка</option>
            {experts.map((expert) => (
              <option key={expert.id} value={expert.id}>
                {expert.full_name}
              </option>
            ))}
          </select>
          {touchedFields.expert_id && errors.expert_id?.message && (
            <p className="text-red-500 text-sm mt-1">
              {errors.expert_id.message}
            </p>
          )}
        </div>

        <Input
          type="text"
          id="reportNumber"
          label="Номер заключения"
          error={touchedFields.report_number ? errors.report_number?.message : undefined}
          placeholder="Например: 2024-001"
          required
          {...register("report_number", {
            required: "Введите номер заключения",
          })}
        />

        <Input
          type="date"
          id="reportDate"
          label="Дата заключения"
          error={touchedFields.report_date ? errors.report_date?.message : undefined}
          required
          {...register("report_date", {
            required: "Выберите дату заключения",
          })}
        />

        <Input
          type="date"
          id="applicationDate"
          label="Дата подачи заявки"
          error={
            touchedFields.application_date
              ? errors.application_date?.message
              : undefined
          }
          required
          {...register("application_date", {
            required: "Выберите дату подачи заявки",
          })}
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
