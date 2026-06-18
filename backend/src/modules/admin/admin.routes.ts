import { Router } from 'express';
import type { z } from 'zod';
import {
  type AuthRequest,
  adminMiddleware,
  authMiddleware,
} from '../../common/middleware/auth.js';
import { badRequest } from '../../common/errors/httpError.js';
import { validate } from '../../common/middleware/validate.js';
import { uuidParamsSchema } from '../../common/schemas/common.js';
import { reportsQuerySchema } from '../reports/reports.schemas.js';
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

router.post('/template', async (req, res) => {
  if (!req.body?.template) {
    throw badRequest('Template data required');
  }
  const result = await adminService.uploadTemplate(req.body.template);
  res.json(result);
});

export default router;
