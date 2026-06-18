import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import type { z } from 'zod';
import {
  type AuthRequest,
  adminMiddleware,
  authMiddleware,
} from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { uuidParamsSchema } from '../../common/schemas/common.js';
import { db } from '../../db/index.js';
import { creators, reports } from '../../db/schema.js';
import { reportsQuerySchema } from '../reports/reports.schemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, '../../../templates');

const router = Router();

// Все эндпоинты требуют admin роль
router.use(authMiddleware, adminMiddleware);

// GET /api/admin/reports — все заключения (для админа)
router.get(
  '/reports',
  validate({ query: reportsQuerySchema }),
  async (req: AuthRequest, res) => {
    const query = req.query as unknown as z.infer<typeof reportsQuerySchema>;
    const { page, limit, search, status } = query;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (status) {
      conditions.push(eq(reports.status, status));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        sql`(${reports.reportNumber} ILIKE ${searchPattern} OR ${reports.licensePlate} ILIKE ${searchPattern} OR ${reports.ownerName} ILIKE ${searchPattern})`,
      );
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reports)
      .where(
        conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined,
      );

    const allReports = await db
      .select({
        id: reports.id,
        reportNumber: reports.reportNumber,
        reportDate: reports.reportDate,
        applicationDate: reports.applicationDate,
        status: reports.status,
        currentStep: reports.currentStep,
        grandTotal: reports.grandTotal,
        licensePlate: reports.licensePlate,
        ownerName: reports.ownerName,
        creatorId: reports.creatorId,
        updatedAt: reports.updatedAt,
      })
      .from(reports)
      .where(
        conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined,
      )
      .orderBy(desc(reports.updatedAt))
      .limit(limit)
      .offset(offset);

    res.json({
      data: allReports,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    });
  },
);

// GET /api/admin/reports/:id — детали заключения
router.get(
  '/reports/:id',
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;

    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const [creator] = await db
      .select({ id: creators.id, fullName: creators.fullName })
      .from(creators)
      .where(eq(creators.id, report.creatorId))
      .limit(1);

    res.json({ ...report, creator });
  },
);

// GET /api/admin/creators — список всех создателей
router.get('/creators', async (_req, res) => {
  const allCreators = await db
    .select({
      id: creators.id,
      fullName: creators.fullName,
      role: creators.role,
      createdAt: creators.createdAt,
    })
    .from(creators);

  res.json(allCreators);
});

// GET /api/admin/template — получить инфо о шаблоне
router.get('/template', (_req, res) => {
  const templatePath = path.join(templatesDir, 'expertise.docx');

  if (!fs.existsSync(templatePath)) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const stats = fs.statSync(templatePath);

  res.json({
    exists: true,
    name: 'expertise.docx',
    size: stats.size,
    lastModified: stats.mtime,
  });
});

// POST /api/admin/template — загрузить новый шаблон
router.post('/template', async (req, res) => {
  if (!req.body || !req.body.template) {
    res.status(400).json({ error: 'Template data required' });
    return;
  }

  const templatePath = path.join(templatesDir, 'expertise.docx');
  const templateBuffer = Buffer.from(req.body.template, 'base64');

  fs.writeFileSync(templatePath, templateBuffer);

  res.json({ message: 'Template updated successfully' });
});

export default router;
