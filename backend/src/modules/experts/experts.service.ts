import { and, eq } from 'drizzle-orm';
import { forbidden, notFound } from '../../common/errors/httpError.js';
import { db } from '../../db/index.js';
import { experts } from '../../db/schema.js';

export const expertService = {
  async listExperts(creatorId: string) {
    const creatorExperts = await db
      .select()
      .from(experts)
      .where(eq(experts.creatorId, creatorId));

    return creatorExperts.map((expert) => ({
      id: expert.id,
      full_name: expert.fullName,
      created_at: expert.createdAt,
    }));
  },

  async createExpert(creatorId: string, fullName: string) {
    const [newExpert] = await db
      .insert(experts)
      .values({
        creatorId,
        fullName,
      })
      .returning();

    return {
      id: newExpert.id,
      full_name: newExpert.fullName,
      created_at: newExpert.createdAt,
    };
  },

  async getOwnedExpert(creatorId: string, expertId: string) {
    const [existing] = await db
      .select()
      .from(experts)
      .where(eq(experts.id, expertId))
      .limit(1);

    if (!existing) {
      throw notFound('Expert not found');
    }

    if (existing.creatorId !== creatorId) {
      throw forbidden('You do not have permission to modify this expert');
    }

    return existing;
  },

  async updateExpert(creatorId: string, expertId: string, fullName: string) {
    await expertService.getOwnedExpert(creatorId, expertId);

    const [updated] = await db
      .update(experts)
      .set({ fullName })
      .where(eq(experts.id, expertId))
      .returning();

    return {
      id: updated.id,
      full_name: updated.fullName,
      created_at: updated.createdAt,
    };
  },

  async deleteExpert(creatorId: string, expertId: string) {
    await expertService.getOwnedExpert(creatorId, expertId);
    await db.delete(experts).where(eq(experts.id, expertId));
  },

  async verifyOwnership(creatorId: string, expertId: string) {
    const [expert] = await db
      .select()
      .from(experts)
      .where(and(eq(experts.id, expertId), eq(experts.creatorId, creatorId)))
      .limit(1);

    return expert ?? null;
  },
};
