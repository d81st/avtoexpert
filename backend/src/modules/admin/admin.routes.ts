import { Router } from 'express';
import type { z } from 'zod';
import {
  type AuthRequest,
  adminMiddleware,
  authMiddleware,
} from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { uuidParamsSchema } from '../../common/schemas/common.js';
import { reportsQuerySchema } from '../reports/reports.schemas.js';
import { templateUploadSchema } from './admin.schemas.js';
import { adminService } from './admin.service.js';

const router = Router();

router.use(authMiddleware, adminMiddleware);

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

router.get('/creators', async (_req, res) => {
  const result = await adminService.listCreators();
  res.json(result);
});

router.get('/template', async (_req, res) => {
  const result = await adminService.getTemplateInfo();
  res.json(result);
});

router.post(
  '/template',
  validate({ body: templateUploadSchema }),
  async (req: AuthRequest, res) => {
    const { template } = req.body as z.infer<typeof templateUploadSchema>;
    const result = await adminService.uploadTemplate(template);
    res.json(result);
  },
);

export default router;
