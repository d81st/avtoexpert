import { useState } from "react";
import type { Expert } from "../types";
import {
  useCreateExpertMutation,
  useDeleteExpertMutation,
  useExpertsQuery,
  useUpdateExpertMutation,
} from "../model/expertQueries";

interface UseExpertsParams {
  selectedExpertId: string;
  onSelectExpert: (id: string) => void;
}

export function useExperts({
  selectedExpertId,
  onSelectExpert,
}: UseExpertsParams) {
  const expertsQuery = useExpertsQuery();
  const createExpertMutation = useCreateExpertMutation();
  const updateExpertMutation = useUpdateExpertMutation();
  const deleteExpertMutation = useDeleteExpertMutation();
  const [showExpertModal, setShowExpertModal] = useState(false);
  const [newExpertName, setNewExpertName] = useState("");
  const [editingExpertId, setEditingExpertId] = useState<string | null>(null);
  const [expertError, setExpertError] = useState<string | null>(null);

  const experts = expertsQuery.data ?? [];
  const queryError =
    expertsQuery.error instanceof Error ? expertsQuery.error.message : null;

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
      setExpertError("Р’РІРµРґРёС‚Рµ РёРјСЏ СЌРєСЃРїРµСЂС‚Р°");
      return;
    }

    setExpertError(null);
    try {
      const expert = await createExpertMutation.mutateAsync(trimmedName);
      onSelectExpert(expert.id);
      setShowExpertModal(false);
      setNewExpertName("");
    } catch (err) {
      setExpertError(
        err instanceof Error
          ? err.message
          : "РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ СЌРєСЃРїРµСЂС‚Р°",
      );
    }
  };

  const handleUpdateExpert = async () => {
    const trimmedName = newExpertName.trim();
    if (!editingExpertId || !trimmedName) {
      setExpertError("Р’РІРµРґРёС‚Рµ РёРјСЏ СЌРєСЃРїРµСЂС‚Р°");
      return;
    }

    setExpertError(null);
    try {
      await updateExpertMutation.mutateAsync({
        id: editingExpertId,
        fullName: trimmedName,
      });
      setEditingExpertId(null);
      setNewExpertName("");
    } catch (err) {
      setExpertError(
        err instanceof Error
          ? err.message
          : "РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ СЌРєСЃРїРµСЂС‚Р°",
      );
    }
  };

  const handleDeleteExpert = async (id: string) => {
    if (!confirm("РЈРґР°Р»РёС‚СЊ СЌС‚РѕРіРѕ СЌРєСЃРїРµСЂС‚Р°?")) return;

    try {
      await deleteExpertMutation.mutateAsync(id);
      if (selectedExpertId === id) onSelectExpert("");
    } catch (err) {
      setExpertError(
        err instanceof Error
          ? err.message
          : "РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ СЌРєСЃРїРµСЂС‚Р°",
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
    isLoading: expertsQuery.isLoading,
    error: queryError,
    setError: (message: string | null) => {
      void message;
    },
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
