export interface AdminReport {
  id: string;
  reportNumber: string | null;
  reportDate: string | null;
  status: string;
  currentStep: number;
  grandTotal: number | null;
  licensePlate: string | null;
  ownerName: string | null;
  creatorId: string;
  updatedAt: string | null;
  creator?: { id: string; fullName: string };
}

export interface AdminCreator {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

export type AdminTab = 'reports' | 'creators' | 'template';

export interface AdminPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminReportsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'draft' | 'completed';
}
