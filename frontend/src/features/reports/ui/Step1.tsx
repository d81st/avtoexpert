import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormStore } from "../model/useFormStore";
import { useExperts } from "../hooks/useExperts";
import { useValidationSync } from "../hooks/useValidationSync";
import { step1Schema, type Step1FormData } from "@/schemas/step1.schema";
import { notify } from "@/shared/notifications/notify";
import ExpertManagerModal from "./ExpertManagerModal";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

const EMPTY_STEP1: Step1FormData = {
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

  const form = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    mode: "onChange",
    defaultValues: step1Data ?? EMPTY_STEP1,
  });

  const { setValue, control, formState: { isValid } } = form;

  const watchedValues = useWatch({ control }) as Step1FormData;

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

  // AC 5.4 — transient error (загрузка списка экспертов) отображается toast'ом
  // через Notification_System, а не inline AppAlert. После показа сразу
  // очищаем локальное состояние, чтобы повторное появление того же значения
  // снова срабатывало (effect зависит от изменения `error`).
  useEffect(() => {
    if (!error) return;
    notify.error(error);
    setError(null);
  }, [error, setError]);

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

      <Form {...form}>
        <div className="space-y-6 mt-6">
          <FormField
            control={control}
            name="expert_id"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center">
                  <FormLabel>
                    Эксперт <span className="text-red-500">*</span>
                  </FormLabel>
                  <button
                    type="button"
                    onClick={openExpertModal}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Добавить эксперта
                  </button>
                </div>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите эксперта из списка" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {experts.map((expert) => (
                      <SelectItem key={expert.id} value={expert.id}>
                        {expert.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="report_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Номер заключения <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Например: 2024-001"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="report_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Дата заключения <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="application_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Дата подачи заявки <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Form>

      <ExpertManagerModal
        open={showExpertModal}
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
    </div>
  );
}

export default Step1;
