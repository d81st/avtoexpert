import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expertService } from '../api/expertApi';
import type { ExpertsQueryParams } from '../types';

export const expertQueryKeys = {
  all: ['experts'] as const,
  lists: () => [...expertQueryKeys.all, 'list'] as const,
  list: (params?: ExpertsQueryParams) => [...expertQueryKeys.lists(), params] as const,
};

export function useExpertsQuery(params?: ExpertsQueryParams) {
  return useQuery({
    queryKey: expertQueryKeys.list(params),
    queryFn: () => expertService.getExperts(params),
  });
}

export function useCreateExpertMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: expertService.createExpert,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expertQueryKeys.lists() });
    },
  });
}

export function useUpdateExpertMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, fullName }: { id: string; fullName: string }) =>
      expertService.updateExpert(id, fullName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expertQueryKeys.lists() });
    },
  });
}

export function useDeleteExpertMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: expertService.deleteExpert,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expertQueryKeys.lists() });
    },
  });
}
