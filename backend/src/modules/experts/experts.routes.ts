import { Router } from 'express';
import type { z } from 'zod';
import {
  type AuthRequest,
  authMiddleware,
} from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import {
  createExpertSchema,
  expertParamsSchema,
  updateExpertSchema,
} from './experts.schemas.js';
import { expertService } from './experts.service.js';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const result = await expertService.listExperts(req.creator!.id);
  res.json(result);
});

router.post(
  '/',
  authMiddleware,
  validate({ body: createExpertSchema }),
  async (req: AuthRequest, res) => {
    const data = req.body as z.infer<typeof createExpertSchema>;
    const result = await expertService.createExpert(req.creator!.id, data.full_name);
    res.status(201).json(result);
  },
);

router.patch(
  '/:id',
  authMiddleware,
  validate({ params: expertParamsSchema, body: updateExpertSchema }),
  async (req: AuthRequest, res) => {
    const data = req.body as z.infer<typeof updateExpertSchema>;
    const result = await expertService.updateExpert(
      req.creator!.id,
      req.params.id as string,
      data.full_name,
    );
    res.json(result);
  },
);

router.delete(
  '/:id',
  authMiddleware,
  validate({ params: expertParamsSchema }),
  async (req: AuthRequest, res) => {
    await expertService.deleteExpert(req.creator!.id, req.params.id as string);
    res.json({ message: 'Expert deleted' });
  },
);

export default router;
