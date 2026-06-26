import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type Step1FormData, step1Schema } from '@/schemas/step1.schema';
import { notify } from '@/shared/notifications/notify';
import { useExperts } from '../hooks/useExperts';
import { useValidationSync } from '../hooks/useValidationSync';
import { useFormStore } from '../model/useFormStore';
import ExpertManagerModal from './ExpertManagerModal';
import { FormStoreSync, IsolatedTextField } from './fields/isolated-fields';

const EMPTY_STEP1: Step1FormData = {
  expert_id: '',
  report_number: '',
  report_date: '',
  application_date: '',
};

interface StepFormProps {
  onValidationChange: (isValid: boolean) => void;
}

function Step1({ onValidationChange }: StepFormProps) {
  const step1Data = useFormStore((s) => s.step1);
  const setStep1 = useFormStore((s) => s.setStep1);

  const form = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    mode: 'onChange',
    defaultValues: step1Data ?? EMPTY_STEP1,
  });

  const {
    setValue,
    control,
    formState: { isValid },
  } = form;

  // Scoped subscription: only the expert select drives this read, so typing in the
  // text fields never re-renders the step (R1.3).
  const selectedExpertId = useWatch({ control, name: 'expert_id' }) ?? '';

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
    selectedExpertId,
    onSelectExpert: (id) =>
      setValue('expert_id', id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      }),
  });

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
        <h2 className="text-2xl font-bold text-gray-800">Шаг 1: Основная информация</h2>
        <p className="text-sm text-gray-600 mt-2">
          Укажите основные данные для заключения об экспертизе
        </p>
      </div>

      <Form {...form}>
        {/* Isolated, debounced Zustand sync — keeps the whole-form watch off this
            component's render path (R1.3). */}
        <FormStoreSync control={control} setter={setStep1} />

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
                <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
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

          <IsolatedTextField
            name="report_number"
            label="Номер заключения"
            required
            placeholder="Например: 2024-001"
          />

          <IsolatedTextField name="report_date" label="Дата заключения" required type="date" />

          <IsolatedTextField
            name="application_date"
            label="Дата подачи заявки"
            required
            type="date"
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
