import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useFormStore } from "../model/useFormStore";
import { useExperts } from "../hooks/useExperts";
import { validateStep1 } from "../lib/validators";
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

function Step1({
  onValidationChange,
}: {
  onValidationChange: (isValid: boolean) => void;
}) {
  const { step1, setStep1 } = useFormStore();
  const {
    register,
    setValue,
    control,
    formState: { touchedFields, errors },
  } = useForm<Step1Data>({
    mode: "onBlur",
    defaultValues: step1 ?? EMPTY_STEP1,
  });
  const formData = useWatch({ control }) as Step1Data;

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
    selectedExpertId: formData.expert_id,
    onSelectExpert: (id) =>
      setValue("expert_id", id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      }),
  });

  useEffect(() => {
    const nextData = { ...EMPTY_STEP1, ...formData };
    setStep1(nextData);
    onValidationChange(validateStep1(nextData));
  }, [formData, onValidationChange, setStep1]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          РЁР°Рі 1: РћСЃРЅРѕРІРЅР°СЏ РёРЅС„РѕСЂРјР°С†РёСЏ
        </h2>
        <p className="text-sm text-gray-600 mt-2">
          РЈРєР°Р¶РёС‚Рµ РѕСЃРЅРѕРІРЅС‹Рµ РґР°РЅРЅС‹Рµ РґР»СЏ Р·Р°РєР»СЋС‡РµРЅРёСЏ РѕР± СЌРєСЃРїРµСЂС‚РёР·Рµ
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
              Р­РєСЃРїРµСЂС‚ <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={openExpertModal}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Р”РѕР±Р°РІРёС‚СЊ СЌРєСЃРїРµСЂС‚Р°
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
              required: "Р’С‹Р±РµСЂРёС‚Рµ СЌРєСЃРїРµСЂС‚Р°",
            })}
          >
            <option value="">Р’С‹Р±РµСЂРёС‚Рµ СЌРєСЃРїРµСЂС‚Р° РёР· СЃРїРёСЃРєР°</option>
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
          label="РќРѕРјРµСЂ Р·Р°РєР»СЋС‡РµРЅРёСЏ"
          error={touchedFields.report_number ? errors.report_number?.message : undefined}
          placeholder="РќР°РїСЂРёРјРµСЂ: 2024-001"
          required
          {...register("report_number", {
            required: "Р’РІРµРґРёС‚Рµ РЅРѕРјРµСЂ Р·Р°РєР»СЋС‡РµРЅРёСЏ",
          })}
        />

        <Input
          type="date"
          id="reportDate"
          label="Р”Р°С‚Р° Р·Р°РєР»СЋС‡РµРЅРёСЏ"
          error={touchedFields.report_date ? errors.report_date?.message : undefined}
          required
          {...register("report_date", {
            required: "Р’С‹Р±РµСЂРёС‚Рµ РґР°С‚Сѓ Р·Р°РєСЋС‡РµРЅРёСЏ",
          })}
        />

        <Input
          type="date"
          id="applicationDate"
          label="Р”Р°С‚Р° РїРѕРґР°С‡Рё Р·Р°СЏРІРєРё"
          error={
            touchedFields.application_date
              ? errors.application_date?.message
              : undefined
          }
          required
          {...register("application_date", {
            required: "Р’С‹Р±РµСЂРёС‚Рµ РґР°С‚Сѓ РїРѕРґР°С‡Рё Р·Р°СЏРІРєРё",
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
