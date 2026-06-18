import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import type { SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import type { z } from 'zod';
import { notFound, unauthorized } from '../../common/errors/httpError.js';
import {
  type AuthRequest,
  authMiddleware,
} from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { creators } from '../../db/schema.js';
import { loginSchema } from './auth.schemas.js';

const router = Router();

router.post('/login', validate({ body: loginSchema }), async (req, res) => {
  const { login, password } = req.body as z.infer<typeof loginSchema>;

  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.login, login))
    .limit(1);

  if (!creator) {
    throw unauthorized('Invalid login or password');
  }

  const isValidPassword = await bcrypt.compare(password, creator.passwordHash);

  if (!isValidPassword) {
    throw unauthorized('Invalid login or password');
  }

  const token = jwt.sign(
    {
      id: creator.id,
      fullName: creator.fullName,
      role: creator.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as SignOptions,
  );

  res.json({
    token,
    creator: {
      id: creator.id,
      full_name: creator.fullName,
      role: creator.role,
    },
  });
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, req.creator!.id))
    .limit(1);

  if (!creator) {
    throw notFound('User not found');
  }

  res.json({
    id: creator.id,
    full_name: creator.fullName,
    role: creator.role,
  });
});

export default router;
