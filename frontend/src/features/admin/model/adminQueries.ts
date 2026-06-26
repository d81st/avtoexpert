import { useQuery } from '@tanstack/react-query';
import { adminService } from '../api/adminApi';
import type { AdminCreator, AdminReport, AdminReportsQueryParams } from '../types';

export const adminQueryKeys = {
  all: ['admin'] as const,
  reports: (params: AdminReportsQueryParams) => [...adminQueryKeys.all, 'reports', params] as const,
  creators: () => [...adminQueryKeys.all, 'creators'] as const,
  template: () => [...adminQueryKeys.all, 'template'] as const,
};

export function useAdminReportsQuery(params: AdminReportsQueryParams) {
  return useQuery({
    queryKey: adminQueryKeys.reports(params),
    queryFn: async () => {
      const response = await adminService.getAllReports(params);
      return {
        data: response.data as unknown as AdminReport[],
        pagination: response.pagination,
      };
    },
  });
}

export function useAdminCreatorsQuery() {
  return useQuery({
    queryKey: adminQueryKeys.creators(),
    queryFn: () => adminService.getAllCreators() as Promise<AdminCreator[]>,
  });
}

export function useAdminTemplateQuery() {
  return useQuery({
    queryKey: adminQueryKeys.template(),
    queryFn: adminService.getTemplateInfo,
  });
}
