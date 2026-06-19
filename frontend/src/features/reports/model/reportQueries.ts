import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reportService, type ReportsQueryParams } from "../api/reportApi";

export const reportQueryKeys = {
  all: ["reports"] as const,
  lists: () => [...reportQueryKeys.all, "list"] as const,
  list: (params: ReportsQueryParams) =>
    [...reportQueryKeys.lists(), params] as const,
  detail: (id: string) => [...reportQueryKeys.all, "detail", id] as const,
};

export function useReportsQuery(params: ReportsQueryParams) {
  return useQuery({
    queryKey: reportQueryKeys.list(params),
    queryFn: () => reportService.getReports(params),
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
