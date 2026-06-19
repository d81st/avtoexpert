import type { Expert } from "@/features/reports/types";
import Alert from "@/shared/ui/Alert";
import Button from "@/shared/ui/Button";
import Input from "@/shared/ui/Input";

interface ExpertManagerModalProps {
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
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">
          {editingExpertId ? "Редактировать эксперта" : "Добавить эксперта"}
        </h3>

        {expertError && (
          <Alert type="error" message={expertError} onClose={onErrorClose} />
        )}

        <Input
          label="Ф.И.О. эксперта"
          value={newExpertName}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Иванов И.И."
        />

        <div className="flex gap-2 mt-4">
          <Button
            variant="primary"
            onClick={editingExpertId ? onUpdateExpert : onAddExpert}
            fullWidth
          >
            {editingExpertId ? "Сохранить" : "Добавить"}
          </Button>
          <Button variant="secondary" onClick={onClose} fullWidth>
            Отмена
          </Button>
        </div>

        {!editingExpertId && experts.length > 0 && (
          <div className="mt-6 border-t pt-4">
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
      </div>
    </div>
  );
}

export default ExpertManagerModal;
