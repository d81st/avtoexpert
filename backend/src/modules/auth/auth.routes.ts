import { Router } from 'express';
import type { z } from 'zod';
import {
  type AuthRequest,
  authMiddleware,
} from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { loginSchema } from './auth.schemas.js';
import { authService } from './auth.service.js';

const router = Router();

router.post('/login', validate({ body: loginSchema }), async (req, res) => {
  const { login, password } = req.body as z.infer<typeof loginSchema>;
  const result = await authService.login(login, password);
  res.json(result);
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const user = await authService.getCurrentUser(req.creator!.id);
  res.json(user);
});

export default router;
