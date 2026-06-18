import { eq } from 'drizzle-orm';
import { Router } from 'express';
import type { z } from 'zod';
import {
  badRequest,
  notFound,
  unauthorized,
} from '../../common/errors/httpError.js';
import {
  type AuthRequest,
  authMiddleware,
} from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { db } from '../../db/index.js';
import { experts } from '../../db/schema.js';
import {
  createExpertSchema,
  expertParamsSchema,
  updateExpertSchema,
} from './experts.schemas.js';

const router = Router();

// GET /api/experts — список экспертов текущего создателя
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const creatorExperts = await db
    .select()
    .from(experts)
    .where(eq(experts.creatorId, req.creator!.id));

  res.json(
    creatorExperts.map((expert) => ({
      id: expert.id,
      full_name: expert.fullName,
      created_at: expert.createdAt,
    })),
  );
});

// POST /api/experts — создать эксперта
router.post(
  '/',
  authMiddleware,
  validate({ body: createExpertSchema }),
  async (req: AuthRequest, res) => {
    const data = req.body as z.infer<typeof createExpertSchema>;

    const [newExpert] = await db
      .insert(experts)
      .values({
        creatorId: req.creator!.id,
        fullName: data.full_name,
      })
      .returning();

    res.status(201).json({
      id: newExpert.id,
      full_name: newExpert.fullName,
      created_at: newExpert.createdAt,
    });
  },
);

// PATCH /api/experts/:id — обновить эксперта
router.patch(
  '/:id',
  authMiddleware,
  validate({ params: expertParamsSchema, body: updateExpertSchema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const data = req.body as z.infer<typeof updateExpertSchema>;

    // Проверяем что эксперт принадлежит текущему создателю
    const [existing] = await db
      .select()
      .from(experts)
      .where(eq(experts.id, id))
      .limit(1);

    if (!existing) {
      throw notFound('Expert not found');
    }

    if (existing.creatorId !== req.creator!.id) {
      throw unauthorized('You do not have permission to update this expert');
    }

    const [updated] = await db
      .update(experts)
      .set({ fullName: data.full_name })
      .where(eq(experts.id, id))
      .returning();

    res.json({
      id: updated.id,
      full_name: updated.fullName,
      created_at: updated.createdAt,
    });
  },
);

// DELETE /api/experts/:id — удалить эксперта
router.delete(
  '/:id',
  authMiddleware,
  validate({ params: expertParamsSchema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;

    // Проверяем что эксперт принадлежит текущему создателю
    const [existing] = await db
      .select()
      .from(experts)
      .where(eq(experts.id, id))
      .limit(1);

    if (!existing) {
      throw notFound('Expert not found');
    }

    if (existing.creatorId !== req.creator!.id) {
      throw unauthorized('You do not have permission to delete this expert');
    }

    await db.delete(experts).where(eq(experts.id, id));

    res.json({ message: 'Expert deleted' });
  },
);

export default router;
