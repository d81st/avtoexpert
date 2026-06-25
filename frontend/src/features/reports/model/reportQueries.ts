import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
    // Помечаем запрос как `silent`, чтобы axios-интерсептор не показывал
    // глобальный error-toast: ошибки этого запроса обрабатываются локально
    // на Dashboard (transient toast при наличии кэша; persistent inline-блок
    // при пустом списке). См. design.md §3.1; Requirements 1.9, 5.4, 5.12.
    queryFn: () => reportService.getReports(params, { silent: true }),
    // Сохраняем предыдущие данные при смене queryKey (например, при изменении
    // search/page/limit), чтобы Search_Input на Dashboard не размонтировался
    // во время повторного запроса и пользователь не терял фокус/каретку
    // (см. design.md §3.1; Requirements 1.1, 1.2, 1.7).
    placeholderData: keepPreviousData,
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
  // Detail-инвалидация после шаговых мутаций намеренно убрана:
  // данные шага уже актуальны в useFormStore, повторный GET /api/reports/:id избыточен
  // (см. design.md, аудит 7.A; Requirements 7.1, 7.7, 7.9).
  return useMutation({
    mutationFn: (data: Step2Data) => reportService.updateStep2(reportId, data),
  });
}

export function useUpdateStep3Mutation(reportId: string) {
  // Detail-инвалидация после шаговых мутаций намеренно убрана (см. useUpdateStep2Mutation).
  return useMutation({
    mutationFn: (data: Step3Data) => reportService.updateStep3(reportId, data),
  });
}

export function useUpdateStep4Mutation(reportId: string) {
  // Detail-инвалидация после шаговых мутаций намеренно убрана (см. useUpdateStep2Mutation).
  return useMutation({
    mutationFn: (data: Step4Data) => reportService.updateStep4(reportId, data),
  });
}

export function useUpdateStep5Mutation(reportId: string) {
  // Detail-инвалидация после шаговых мутаций намеренно убрана (см. useUpdateStep2Mutation).
  return useMutation({
    mutationFn: (data: Step5Data) => reportService.updateStep5(reportId, data),
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
