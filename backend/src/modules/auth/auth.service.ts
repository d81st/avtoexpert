import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { notFound, unauthorized } from '../../common/errors/httpError.js';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { creators } from '../../db/schema.js';

// Pre-hashed dummy to prevent timing attacks on non-existent users
const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWX012';

export const authService = {
  async login(login: string, password: string) {
    const [creator] = await db
      .select()
      .from(creators)
      .where(eq(creators.login, login))
      .limit(1);

    // Always run bcrypt.compare to prevent timing-based user enumeration
    const hashToCompare = creator?.passwordHash ?? DUMMY_HASH;
    const isValidPassword = await bcrypt.compare(password, hashToCompare);

    if (!creator || !isValidPassword) {
      throw unauthorized('Invalid login or password');
    }

    const token = jwt.sign(
      {
        id: creator.id,
        fullName: creator.fullName,
        role: creator.role,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
    );

    return {
      token,
      creator: {
        id: creator.id,
        full_name: creator.fullName,
        role: creator.role,
      },
    };
  },

  async getCurrentUser(creatorId: string) {
    const [creator] = await db
      .select({
        id: creators.id,
        fullName: creators.fullName,
        role: creators.role,
      })
      .from(creators)
      .where(eq(creators.id, creatorId))
      .limit(1);

    if (!creator) {
      throw notFound('User not found');
    }

    return {
      id: creator.id,
      full_name: creator.fullName,
      role: creator.role,
    };
  },
};
