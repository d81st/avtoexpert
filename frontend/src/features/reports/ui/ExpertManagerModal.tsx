import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Expert } from "../types";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { expertSchema, type ExpertFormData } from "@/schemas/expert.schema";

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

  // Sync external newExpertName with form value
  useEffect(() => {
    form.setValue("full_name", newExpertName);
  }, [newExpertName, form]);

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
            {editingExpertId ? "Редактировать эксперта" : "Добавить эксперта"}
          </DialogTitle>
        </DialogHeader>

        {expertError && (
          <AppAlert type="error" message={expertError} onClose={onErrorClose} />
        )}

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ф.И.О. эксперта</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Иванов И.И."
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        onNameChange(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Отмена
              </Button>
              <Button type="submit">
                {editingExpertId ? "Сохранить" : "Добавить"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {!editingExpertId && experts.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-600 mb-2">
              Список экспертов:
            </h4>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {experts.map((expert) => (
                <li
                  key={expert.id}
                  className="flex items-center justify-between text-sm"
                >
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
