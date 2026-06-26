import { Router } from 'express';
import type { z } from 'zod';
import { unauthorized } from '../../common/errors/httpError.js';
import {
  type AuthRequest,
  adminMiddleware,
  authMiddleware,
} from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { uuidParamsSchema } from '../../common/schemas/common.js';
import { reportsQuerySchema } from '../reports/reports.schemas.js';
import {
  creatorRoleUpdateSchema,
  reportOwnerUpdateSchema,
  templateUploadSchema,
} from './admin.schemas.js';
import { adminService } from './admin.service.js';

const router = Router();

router.use(authMiddleware, adminMiddleware);

/**
 * Resolve the authenticated admin id for audit logging. The `adminMiddleware`
 * already enforces that `req.creator` is set with role `admin`, so missing
 * here would be a programming error rather than a user-input case.
 */
function getActorId(req: AuthRequest): string {
  const id = req.creator?.id;
  if (!id) {
    throw unauthorized('Missing authenticated actor');
  }
  return id;
}

router.get(
  '/reports',
  validate({ query: reportsQuerySchema }),
  async (req: AuthRequest, res) => {
    const query = req.query as unknown as z.infer<typeof reportsQuerySchema>;
    const result = await adminService.listAllReports(query);
    res.json(result);
  },
);

router.get(
  '/reports/:id',
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    const result = await adminService.getReportDetails(req.params.id as string);
    res.json(result);
  },
);

router.patch(
  '/reports/:id/owner',
  validate({ params: uuidParamsSchema, body: reportOwnerUpdateSchema }),
  async (req: AuthRequest, res) => {
    const { creatorId } = req.body as z.infer<typeof reportOwnerUpdateSchema>;
    const result = await adminService.changeReportOwner(
      getActorId(req),
      req.params.id as string,
      creatorId,
    );
    res.json(result);
  },
);

router.delete(
  '/reports/:id',
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    const result = await adminService.deleteReport(
      getActorId(req),
      req.params.id as string,
    );
    res.json(result);
  },
);

router.get('/creators', async (_req, res) => {
  const result = await adminService.listCreators();
  res.json(result);
});

router.patch(
  '/creators/:id/role',
  validate({ params: uuidParamsSchema, body: creatorRoleUpdateSchema }),
  async (req: AuthRequest, res) => {
    const { role } = req.body as z.infer<typeof creatorRoleUpdateSchema>;
    const result = await adminService.updateCreatorRole(
      getActorId(req),
      req.params.id as string,
      role,
    );
    res.json(result);
  },
);

router.get('/template', async (_req, res) => {
  const result = await adminService.getTemplateInfo();
  res.json(result);
});

router.post(
  '/template',
  validate({ body: templateUploadSchema }),
  async (req: AuthRequest, res) => {
    const { template } = req.body as z.infer<typeof templateUploadSchema>;
    const result = await adminService.uploadTemplate(getActorId(req), template);
    res.json(result);
  },
);

export default router;
