import { useState } from 'react';
import {
  useCreateExpertMutation,
  useDeleteExpertMutation,
  useExpertsQuery,
  useUpdateExpertMutation,
} from '../model/expertQueries';
import type { Expert } from '../types';

interface UseExpertsParams {
  selectedExpertId: string;
  onSelectExpert: (id: string) => void;
}

export interface UseExpertsReturn {
  experts: Expert[];
  isLoading: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  showExpertModal: boolean;
  newExpertName: string;
  setNewExpertName: (name: string) => void;
  editingExpertId: string | null;
  expertError: string | null;
  setExpertError: (error: string | null) => void;
  openExpertModal: () => void;
  closeExpertModal: () => void;
  handleAddExpert: () => Promise<void>;
  handleUpdateExpert: () => Promise<void>;
  handleDeleteExpert: (id: string) => Promise<void>;
  openEditExpert: (expert: Expert) => void;
}

export function useExperts({
  selectedExpertId,
  onSelectExpert,
}: UseExpertsParams): UseExpertsReturn {
  const expertsQuery = useExpertsQuery();
  const createExpertMutation = useCreateExpertMutation();
  const updateExpertMutation = useUpdateExpertMutation();
  const deleteExpertMutation = useDeleteExpertMutation();
  const [showExpertModal, setShowExpertModal] = useState(false);
  const [newExpertName, setNewExpertName] = useState('');
  const [editingExpertId, setEditingExpertId] = useState<string | null>(null);
  const [expertError, setExpertError] = useState<string | null>(null);

  const experts = expertsQuery.data ?? [];
  const queryError = expertsQuery.error instanceof Error ? expertsQuery.error.message : null;

  const openExpertModal = () => {
    setShowExpertModal(true);
    setEditingExpertId(null);
    setNewExpertName('');
    setExpertError(null);
  };

  const closeExpertModal = () => {
    setShowExpertModal(false);
    setEditingExpertId(null);
    setNewExpertName('');
  };

  const handleAddExpert = async () => {
    const trimmedName = newExpertName.trim();
    if (!trimmedName) {
      setExpertError('Введите имя эксперта');
      return;
    }

    setExpertError(null);
    try {
      const expert = await createExpertMutation.mutateAsync(trimmedName);
      onSelectExpert(expert.id);
      setShowExpertModal(false);
      setNewExpertName('');
    } catch (err) {
      setExpertError(err instanceof Error ? err.message : 'Ошибка создания эксперта');
    }
  };

  const handleUpdateExpert = async () => {
    const trimmedName = newExpertName.trim();
    if (!editingExpertId || !trimmedName) {
      setExpertError('Введите имя эксперта');
      return;
    }

    setExpertError(null);
    try {
      await updateExpertMutation.mutateAsync({
        id: editingExpertId,
        fullName: trimmedName,
      });
      setEditingExpertId(null);
      setNewExpertName('');
    } catch (err) {
      setExpertError(err instanceof Error ? err.message : 'Ошибка обновления эксперта');
    }
  };

  const handleDeleteExpert = async (id: string) => {
    if (!confirm('Удалить этого эксперта?')) return;

    try {
      await deleteExpertMutation.mutateAsync(id);
      if (selectedExpertId === id) onSelectExpert('');
    } catch (err) {
      setExpertError(err instanceof Error ? err.message : 'Ошибка удаления эксперта');
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
