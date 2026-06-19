import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expertService } from "../api/expertApi";

export const expertQueryKeys = {
  all: ["experts"] as const,
};

export function useExpertsQuery() {
  return useQuery({
    queryKey: expertQueryKeys.all,
    queryFn: expertService.getExperts,
  });
}

export function useCreateExpertMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: expertService.createExpert,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expertQueryKeys.all });
    },
  });
}

export function useUpdateExpertMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, fullName }: { id: string; fullName: string }) =>
      expertService.updateExpert(id, fullName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expertQueryKeys.all });
    },
  });
}

export function useDeleteExpertMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: expertService.deleteExpert,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expertQueryKeys.all });
    },
  });
}
