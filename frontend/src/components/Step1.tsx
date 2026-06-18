import { useEffect, useRef, useState } from "react";
import { useReportStore } from "../store/useReportStore";
import { useFormStore } from "../store/useFormStore";
import { reportService } from "../services/reportService";

import Input from "./Input";
import Alert from "./Alert";
import Button from "./Button";

function Step1({
  onValidationChange,
}: {
  onValidationChange: (isValid: boolean) => void;
}) {
  const { experts, setExperts, isLoading, error, setError } = useReportStore();
  const { step1, setStep1 } = useFormStore();

  const [expertId, setExpertId] = useState("");
  const [reportNumber, setReportNumber] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [applicationDate, setApplicationDate] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // флаг: данные из store уже загружены в local state (защита от зацикливания)
  const initializedRef = useRef(false);

  // Управление экспертами
  const [showExpertModal, setShowExpertModal] = useState(false);
  const [newExpertName, setNewExpertName] = useState("");
  const [editingExpertId, setEditingExpertId] = useState<string | null>(null);
  const [expertError, setExpertError] = useState<string | null>(null);

  useEffect(() => {
    if (experts.length === 0) {
      fetchExperts();
    }
  }, []);

  // Однократная инициализация local state из store (например, при открытии черновика)
  // useRef предотвращает обратный цикл: store→local→store→local→...
  useEffect(() => {
    if (!initializedRef.current && step1) {
      initializedRef.current = true;
      setExpertId(step1.expert_id);
      setReportNumber(step1.report_number);
      setReportDate(step1.report_date);
      setApplicationDate(step1.application_date);
    }
  }, [step1]);

  // Проверка валидности
  useEffect(() => {
    const isValid = expertId && reportNumber && reportDate && applicationDate;
    onValidationChange(!!isValid);
  }, [expertId, reportNumber, reportDate, applicationDate, onValidationChange]);

  // Синхронизация local state → store (только запись, не читает из store)
  useEffect(() => {
    setStep1({
      expert_id: expertId,
      report_number: reportNumber,
      report_date: reportDate,
      application_date: applicationDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expertId, reportNumber, reportDate, applicationDate]);

  const fetchExperts = async () => {
    try {
      const data = await reportService.getExperts();
      setExperts(data);
      setError(null);
    } catch (err) {
      const errorMsg = (err as any)?.message || "Ошибка загрузки экспертов";
      setError(errorMsg);
      console.error("Error fetching experts:", err);
    }
  };

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
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

  // === Управление экспертами ===

  const handleAddExpert = async () => {
    if (!newExpertName.trim()) {
      setExpertError("Введите имя эксперта");
      return;
    }

    setExpertError(null);
    try {
      const expert = await reportService.createExpert(newExpertName.trim());
      setExperts([...experts, expert]);
      setExpertId(expert.id);
      setShowExpertModal(false);
      setNewExpertName("");
    } catch (err) {
      setExpertError((err as Error).message || "Ошибка создания эксперта");
    }
  };

  const handleUpdateExpert = async () => {
    if (!editingExpertId || !newExpertName.trim()) {
      setExpertError("Введите имя эксперта");
      return;
    }

    setExpertError(null);
    try {
      const expert = await reportService.updateExpert(
        editingExpertId,
        newExpertName.trim(),
      );
      setExperts(experts.map((e) => (e.id === editingExpertId ? expert : e)));
      setEditingExpertId(null);
      setNewExpertName("");
    } catch (err) {
      setExpertError((err as Error).message || "Ошибка обновления эксперта");
    }
  };

  const handleDeleteExpert = async (id: string) => {
    if (!confirm("Удалить этого эксперта?")) return;

    try {
      await reportService.deleteExpert(id);
      setExperts(experts.filter((e) => e.id !== id));
      if (expertId === id) setExpertId("");
    } catch (err) {
      setExpertError((err as Error).message || "Ошибка удаления эксперта");
    }
  };

  const openEditExpert = (expert: { id: string; full_name: string }) => {
    setEditingExpertId(expert.id);
    setNewExpertName(expert.full_name);
    setExpertError(null);
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
              onClick={() => {
                setShowExpertModal(true);
                setEditingExpertId(null);
                setNewExpertName("");
                setExpertError(null);
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Добавить эксперта
            </button>
          </div>
          <select
            id="expert"
            value={expertId}
            onChange={(e) => {
              setExpertId(e.target.value);
            }}
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
          onChange={(e) => {
            setReportNumber(e.target.value);
          }}
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
          onChange={(e) => {
            setReportDate(e.target.value);
          }}
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
          onChange={(e) => {
            setApplicationDate(e.target.value);
          }}
          onBlur={() => handleBlur("applicationDate")}
          error={
            touched["applicationDate"]
              ? (getFieldError("applicationDate") ?? undefined)
              : undefined
          }
          required
        />
      </div>

      {/* Модальное окно управления экспертами */}
      {showExpertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingExpertId ? "Редактировать эксперта" : "Добавить эксперта"}
            </h3>

            {expertError && (
              <Alert
                type="error"
                message={expertError}
                onClose={() => setExpertError(null)}
              />
            )}

            <Input
              label="Ф.И.О. эксперта"
              value={newExpertName}
              onChange={(e) => setNewExpertName(e.target.value)}
              placeholder="Иванов И.И."
            />

            <div className="flex gap-2 mt-4">
              <Button
                variant="primary"
                onClick={editingExpertId ? handleUpdateExpert : handleAddExpert}
                fullWidth
              >
                {editingExpertId ? "Сохранить" : "Добавить"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowExpertModal(false);
                  setEditingExpertId(null);
                  setNewExpertName("");
                }}
                fullWidth
              >
                Отмена
              </Button>
            </div>

            {/* Список экспертов для редактирования */}
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
                          onClick={() => openEditExpert(expert)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpert(expert.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          🗑️
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Step1;
