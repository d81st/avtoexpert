import { zodResolver } from '@hookform/resolvers/zod';
import { memo, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { type ExpertFormData, expertSchema } from '@/schemas/expert.schema';
import { notify } from '@/shared/notifications/notify';
import { FieldError, useIsolatedField } from '../hooks/useIsolatedField';
import type { Expert } from '../types';

interface ExpertManagerModalProps {
  open: boolean;
  experts: Expert[];
  newExpertName: string;
  editingExpertId: string | null;
  expertError: string | null;
  onNameChange: (value: string) => void;
  onErrorClose: () => void;
  onAddExpert: () => void;
  onUpdateExpert: () => void;
  onDeleteExpert: (id: string) => void;
  onEditExpert: (expert: Expert) => void;
  onClose: () => void;
}

/**
 * Per-field render isolation for the expert name input (Requirement 1.1, 1.3, 1.8).
 *
 * Uses {@link useIsolatedField} to register an UNCONTROLLED native input: no
 * external `value` prop is attached, so a parent re-render never resets the DOM
 * value or the caret (R1.1, R1.2). The component is memoized and its only prop
 * (`onNameChange`) is the stable `setState` setter from `useExperts`, so keystrokes
 * — which push the value up to the parent — do not re-render this subtree or the
 * sibling expert list (R1.3). Validation output is confined to the sibling
 * {@link FieldError}, which subscribes to a single-field `useFormState` selector.
 */
const ExpertNameField = memo(function ExpertNameField({
  onNameChange,
}: {
  onNameChange: (value: string) => void;
}) {
  const field = useIsolatedField<ExpertFormData>('full_name');

  return (
    <div className="space-y-2">
      <label htmlFor="expert-full-name" className="text-sm font-medium leading-none">
        Ф.И.О. эксперта
      </label>
      <Input
        id="expert-full-name"
        placeholder="Иванов И.И."
        {...field}
        onChange={(e) => {
          field.onChange(e);
          onNameChange(e.target.value);
        }}
      />
      <FieldError name="full_name" />
    </div>
  );
});

function ExpertManagerModal({
  open,
  experts,
  newExpertName,
  editingExpertId,
  expertError,
  onNameChange,
  onErrorClose,
  onAddExpert,
  onUpdateExpert,
  onDeleteExpert,
  onEditExpert,
  onClose,
}: ExpertManagerModalProps) {
  const form = useForm<ExpertFormData>({
    resolver: zodResolver(expertSchema),
    defaultValues: {
      full_name: newExpertName,
    },
  });

  // Seed the isolated field from the external name only on open / edit-target
  // switch — NOT on every keystroke. Reading the latest value through a ref keeps
  // the effect off the typing path, so the uncontrolled input is never reset
  // mid-edit (R1.1, R1.2). `openEditExpert`/`openExpertModal` update
  // `newExpertName` together with `editingExpertId`/`open`, so the ref holds the
  // intended seed value when this effect runs.
  const nameRef = useRef(newExpertName);
  nameRef.current = newExpertName;
  useEffect(() => {
    form.reset({ full_name: nameRef.current });
  }, [open, editingExpertId, form]);

  // AC 5.4 — transient expert error отображается toast'ом через
  // Notification_System, а не inline AppAlert. После показа сразу очищаем
  // состояние в родителе, чтобы повторное появление того же значения
  // снова срабатывало (effect зависит от изменения `expertError`).
  useEffect(() => {
    if (!expertError) return;
    notify.error(expertError);
    onErrorClose();
  }, [expertError, onErrorClose]);

  const handleSubmit = form.handleSubmit(() => {
    if (editingExpertId) {
      onUpdateExpert();
    } else {
      onAddExpert();
    }
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingExpertId ? 'Редактировать эксперта' : 'Добавить эксперта'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <ExpertNameField onNameChange={onNameChange} />

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Отмена
              </Button>
              <Button type="submit">{editingExpertId ? 'Сохранить' : 'Добавить'}</Button>
            </DialogFooter>
          </form>
        </Form>

        {!editingExpertId && experts.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Список экспертов:</h4>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {experts.map((expert) => (
                <li key={expert.id} className="flex items-center justify-between text-sm">
                  <span>{expert.full_name}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEditExpert(expert)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteExpert(expert.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ExpertManagerModal;
