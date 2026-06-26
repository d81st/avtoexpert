import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ACCESS_TOKEN_COOKIE } from '../../modules/auth/auth.service.js';
import { forbidden } from '../errors/httpError.js';

export interface AuthRequest extends Request {
  creator?: {
    id: string;
    fullName: string;
    role: string;
  };
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

  if (!token) {
    res.status(401).json({ error: 'Token is required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthRequest['creator'];
    req.creator = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const adminMiddleware = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  if (req.creator?.role !== 'admin') {
    next(forbidden('Admin access required'));
    return;
  }
  next();
};
