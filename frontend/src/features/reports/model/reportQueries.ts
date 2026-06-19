import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reportService, type ReportsQueryParams } from "../api/reportApi";
import { photoService } from "../api/photoApi";
import type { Step2Data, Step3Data, Step4Data, Step5Data } from "../types";

export const reportQueryKeys = {
  all: ["reports"] as const,
  lists: () => [...reportQueryKeys.all, "list"] as const,
  list: (params: ReportsQueryParams) =>
    [...reportQueryKeys.lists(), params] as const,
  detail: (id: string) => [...reportQueryKeys.all, "detail", id] as const,
  photos: (reportId: string) =>
    [...reportQueryKeys.all, "photos", reportId] as const,
};

export function useReportsQuery(params: ReportsQueryParams) {
  return useQuery({
    queryKey: reportQueryKeys.list(params),
    queryFn: () => reportService.getReports(params),
  });
}

export function useReportDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: reportQueryKeys.detail(id!),
    queryFn: () => reportService.getReport(id!),
    enabled: !!id,
  });
}

export function useCreateReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reportService.createReport,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reportQueryKeys.lists() });
    },
  });
}

export function useUpdateStep2Mutation(reportId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Step2Data) => reportService.updateStep2(reportId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: reportQueryKeys.detail(reportId),
      });
    },
  });
}

export function useUpdateStep3Mutation(reportId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Step3Data) => reportService.updateStep3(reportId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: reportQueryKeys.detail(reportId),
      });
    },
  });
}

export function useUpdateStep4Mutation(reportId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Step4Data) => reportService.updateStep4(reportId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: reportQueryKeys.detail(reportId),
      });
    },
  });
}

export function useUpdateStep5Mutation(reportId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Step5Data) => reportService.updateStep5(reportId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: reportQueryKeys.detail(reportId),
      });
    },
  });
}

export function useDeleteReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reportService.deleteReport,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reportQueryKeys.lists() });
    },
  });
}


export function usePhotosQuery(reportId: string | undefined) {
  return useQuery({
    queryKey: reportQueryKeys.photos(reportId!),
    queryFn: () => photoService.getPhotos(reportId!),
    enabled: !!reportId,
  });
}

export function useUploadPhotosMutation(reportId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (files: File[]) => photoService.uploadPhotos(reportId, files),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: reportQueryKeys.photos(reportId),
      });
    },
  });
}

export function useDeletePhotoMutation(reportId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photoId: string) =>
      photoService.deletePhoto(reportId, photoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: reportQueryKeys.photos(reportId),
      });
    },
  });
}
