import { useCallback, useEffect, useState } from "react";
import { expertService } from "@/features/reports/api/expertApi";
import { useReportStore } from "@/features/reports/model/useReportStore";
import type { Expert } from "@/features/reports/types";

interface UseExpertsParams {
  selectedExpertId: string;
  onSelectExpert: (id: string) => void;
}

export function useExperts({
  selectedExpertId,
  onSelectExpert,
}: UseExpertsParams) {
  const { experts, setExperts, isLoading, error, setError } = useReportStore();
  const [showExpertModal, setShowExpertModal] = useState(false);
  const [newExpertName, setNewExpertName] = useState("");
  const [editingExpertId, setEditingExpertId] = useState<string | null>(null);
  const [expertError, setExpertError] = useState<string | null>(null);

  const fetchExperts = useCallback(async () => {
    try {
      const data = await expertService.getExperts();
      setExperts(data);
      setError(null);
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Ошибка загрузки экспертов";
      setError(errorMsg);
      console.error("Error fetching experts:", err);
    }
  }, [setExperts, setError]);

  useEffect(() => {
    if (experts.length === 0) {
      void fetchExperts();
    }
  }, [experts.length, fetchExperts]);

  const openExpertModal = () => {
    setShowExpertModal(true);
    setEditingExpertId(null);
    setNewExpertName("");
    setExpertError(null);
  };

  const closeExpertModal = () => {
    setShowExpertModal(false);
    setEditingExpertId(null);
    setNewExpertName("");
  };

  const handleAddExpert = async () => {
    const trimmedName = newExpertName.trim();
    if (!trimmedName) {
      setExpertError("Введите имя эксперта");
      return;
    }

    setExpertError(null);
    try {
      const expert = await expertService.createExpert(trimmedName);
      setExperts([...experts, expert]);
      onSelectExpert(expert.id);
      setShowExpertModal(false);
      setNewExpertName("");
    } catch (err) {
      setExpertError(
        err instanceof Error
          ? err.message
          : "Ошибка создания эксперта",
      );
    }
  };

  const handleUpdateExpert = async () => {
    const trimmedName = newExpertName.trim();
    if (!editingExpertId || !trimmedName) {
      setExpertError("Введите имя эксперта");
      return;
    }

    setExpertError(null);
    try {
      const expert = await expertService.updateExpert(editingExpertId, trimmedName);
      setExperts(experts.map((item) => (item.id === editingExpertId ? expert : item)));
      setEditingExpertId(null);
      setNewExpertName("");
    } catch (err) {
      setExpertError(
        err instanceof Error
          ? err.message
          : "Ошибка обновления эксперта",
      );
    }
  };

  const handleDeleteExpert = async (id: string) => {
    if (!confirm("Удалить этого эксперта?")) return;

    try {
      await expertService.deleteExpert(id);
      setExperts(experts.filter((expert) => expert.id !== id));
      if (selectedExpertId === id) onSelectExpert("");
    } catch (err) {
      setExpertError(
        err instanceof Error
          ? err.message
          : "Ошибка удаления эксперта",
      );
    }
  };

  const openEditExpert = (expert: Expert) => {
    setEditingExpertId(expert.id);
    setNewExpertName(expert.full_name);
    setExpertError(null);
  };

  return {
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
  };
}
