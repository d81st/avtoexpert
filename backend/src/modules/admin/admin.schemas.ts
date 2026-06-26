import { z } from 'zod';

export const templateUploadSchema = z.object({
  template: z.string().min(1, 'Template data required'),
});

/**
 * Body schema for `PATCH /api/admin/creators/:id/role` — restricts the target
 * role to the values supported by `creators.role`. The corresponding audit
 * event (`role_change`, R6.11) is written from the service layer.
 */
export const creatorRoleUpdateSchema = z.object({
  role: z.enum(['creator', 'admin']),
});

/**
 * Body schema for `PATCH /api/admin/reports/:id/owner` — the new owner must
 * be a valid creator UUID. The corresponding audit event
 * (`report_owner_change`, R6.11) is written from the service layer.
 */
export const reportOwnerUpdateSchema = z.object({
  creatorId: z.uuid(),
});
