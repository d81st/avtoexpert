import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
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
import { uploadPhotos } from '../../common/middleware/upload.js';
import { validate } from '../../common/middleware/validate.js';
import {
  photoParamsSchema,
  uuidParamsSchema,
} from '../../common/schemas/common.js';
import { db } from '../../db/index.js';
import {
  experts,
  materials,
  paintWorks,
  photos,
  repairWorks,
  reports,
  spareParts,
} from '../../db/schema.js';
import { DocGenerator } from './docGenerator.js';
import {
  autosaveSchema,
  createReportSchema,
  reportsQuerySchema,
  type Step4Input,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
} from './reports.schemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../../uploads');
const photosDir = path.join(uploadsDir, 'photos');
const router = Router();

function getCreatorId(req: AuthRequest) {
  if (!req.creator) {
    throw unauthorized('Unauthorized');
  }

  return req.creator.id;
}

function getGeneratedReportFilename(
  reportId: string,
  reportNumber: string | null,
) {
  const safeNumber = (reportNumber || 'report').replace(/[^\w.-]+/g, '_');
  return `report_${safeNumber}_${reportId}.docx`;
}

async function getOwnedReport(reportId: string, creatorId: string) {
  const [report] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, reportId), eq(reports.creatorId, creatorId)))
    .limit(1);

  if (!report) {
    throw notFound('Report not found');
  }

  return report;
}

function getReportUpdatePayload(data: Record<string, unknown>) {
  const allowedFields = [
    'carModel',
    'carYear',
    'carColor',
    'bodyType',
    'licensePlate',
    'ownerName',
    'techPassport',
    'techPassportPlace',
    'mileage',
    'odometerStatus',
    'mileageByMethod',
    'vinCode',
    'engineNumber',
    'transmissionType',
    'cameraModel',
    'passportMatch',
    'productionStatus',
    'analog1Mileage',
    'analog1Price',
    'analog2Mileage',
    'analog2Price',
    'analog3Mileage',
    'analog3Price',
    'factoryPrice',
    'depreciationPct',
  ] as const;

  return Object.fromEntries(
    allowedFields
      .filter((field) => data[field] !== undefined)
      .map((field) => [field, data[field]]),
  );
}

async function replaceStep4Data(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  reportId: string,
  data: Step4Input,
) {
  await replaceStep4Collections(tx, reportId, data);
}

async function replaceStep4Collections(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  reportId: string,
  data: Partial<Step4Input>,
) {
  if (data.repair_works !== undefined) {
    await tx.delete(repairWorks).where(eq(repairWorks.reportId, reportId));
    if (data.repair_works.length > 0) {
      await tx.insert(repairWorks).values(
        data.repair_works.map((work) => ({
          reportId,
          partName: work.part_name,
          partType: work.type,
          complexity: work.complexity,
          price: work.price,
        })),
      );
    }
  }

  if (data.paint_works !== undefined) {
    await tx.delete(paintWorks).where(eq(paintWorks.reportId, reportId));
    if (data.paint_works.length > 0) {
      await tx.insert(paintWorks).values(
        data.paint_works.map((work) => ({
          reportId,
          partName: work.part_name,
          paintPrice: work.paint_price,
          polishPrice: work.polish_price,
        })),
      );
    }
  }

  if (data.spare_parts !== undefined) {
    await tx.delete(spareParts).where(eq(spareParts.reportId, reportId));
    if (data.spare_parts.length > 0) {
      await tx.insert(spareParts).values(
        data.spare_parts.map((part) => ({
          reportId,
          name: part.name,
          qty: part.qty,
          price: part.price,
        })),
      );
    }
  }

  if (data.materials !== undefined) {
    await tx.delete(materials).where(eq(materials.reportId, reportId));
    if (data.materials.length > 0) {
      await tx.insert(materials).values(
        data.materials.map((material) => ({
          reportId,
          name: material.name,
          qty: material.qty,
          price: material.price,
        })),
      );
    }
  }
}

router.post(
  '/',
  authMiddleware,
  validate({ body: createReportSchema }),
  async (req: AuthRequest, res) => {
    const data = req.body as z.infer<typeof createReportSchema>;

    const [expert] = await db
      .select()
      .from(experts)
      .where(
        and(
          eq(experts.id, data.expert_id),
          eq(experts.creatorId, getCreatorId(req)),
        ),
      )
      .limit(1);

    if (!expert) {
      throw badRequest('Expert does not belong to current creator');
    }

    const [newReport] = await db
      .insert(reports)
      .values({
        creatorId: getCreatorId(req),
        expertId: data.expert_id,
        reportNumber: data.report_number,
        reportDate: data.report_date,
        applicationDate: data.application_date,
        status: 'draft',
        currentStep: 1,
      })
      .returning();

    res.status(201).json({
      id: newReport.id,
      status: newReport.status,
      current_step: newReport.currentStep,
      message: 'Draft created',
    });
  },
);

router.patch(
  '/:id/step-2',
  authMiddleware,
  validate({ params: uuidParamsSchema, body: step2Schema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const data = req.body as z.infer<typeof step2Schema>;

    const [updatedReport] = await db
      .update(reports)
      .set({
        ...data,
        currentStep: 2,
        updatedAt: new Date(),
      })
      .where(and(eq(reports.id, id), eq(reports.creatorId, getCreatorId(req))))
      .returning();

    if (!updatedReport) {
      throw notFound('Report not found');
    }

    res.json({ message: 'Step 2 saved' });
  },
);

router.patch(
  '/:id/step-3',
  authMiddleware,
  validate({ params: uuidParamsSchema, body: step3Schema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const data = req.body as z.infer<typeof step3Schema>;

    const [updatedReport] = await db
      .update(reports)
      .set({
        ...data,
        currentStep: 3,
        updatedAt: new Date(),
      })
      .where(and(eq(reports.id, id), eq(reports.creatorId, getCreatorId(req))))
      .returning();

    if (!updatedReport) {
      throw notFound('Report not found');
    }

    res.json({ message: 'Step 3 saved' });
  },
);

router.patch(
  '/:id/step-4',
  authMiddleware,
  validate({ params: uuidParamsSchema, body: step4Schema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const data = req.body as Step4Input;

    await db.transaction(async (tx) => {
      const [updatedReport] = await tx
        .update(reports)
        .set({
          hourlyRate: data.hourly_rate,
          currentStep: 4,
          updatedAt: new Date(),
        })
        .where(
          and(eq(reports.id, id), eq(reports.creatorId, getCreatorId(req))),
        )
        .returning();

      if (!updatedReport) {
        throw notFound('Report not found');
      }

      await replaceStep4Data(tx, id, data);
    });

    res.json({ message: 'Step 4 saved' });
  },
);

router.patch(
  '/:id/step-5',
  authMiddleware,
  validate({ params: uuidParamsSchema, body: step5Schema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;

    const [updatedReport] = await db
      .update(reports)
      .set({
        currentStep: 5,
        updatedAt: new Date(),
      })
      .where(and(eq(reports.id, id), eq(reports.creatorId, getCreatorId(req))))
      .returning();

    if (!updatedReport) {
      throw notFound('Report not found');
    }

    res.json({ message: 'Step 5 saved' });
  },
);

router.patch(
  '/:id/autosave',
  authMiddleware,
  validate({ params: uuidParamsSchema, body: autosaveSchema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const payload = req.body as Record<string, unknown>;

    await db.transaction(async (tx) => {
      const reportUpdates = getReportUpdatePayload(payload);
      const hasStep4Payload =
        payload.hourly_rate !== undefined ||
        payload.repair_works !== undefined ||
        payload.paint_works !== undefined ||
        payload.spare_parts !== undefined ||
        payload.materials !== undefined;

      const [updatedReport] = await tx
        .update(reports)
        .set({
          ...reportUpdates,
          ...(payload.hourly_rate !== undefined
            ? { hourlyRate: payload.hourly_rate as number }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          and(eq(reports.id, id), eq(reports.creatorId, getCreatorId(req))),
        )
        .returning();

      if (!updatedReport) {
        throw notFound('Report not found');
      }

      if (hasStep4Payload) {
        const step4Data = step4Schema.partial().parse(payload);
        await replaceStep4Collections(tx, id, step4Data);
      }
    });

    res.json({ saved_at: new Date().toISOString() });
  },
);

router.get(
  '/',
  authMiddleware,
  validate({ query: reportsQuerySchema }),
  async (req: AuthRequest, res) => {
    const query = req.query as unknown as z.infer<typeof reportsQuerySchema>;
    const { page, limit, search, status } = query;
    const offset = (page - 1) * limit;
    const creatorId = getCreatorId(req);

    // Строим условия WHERE
    const conditions = [eq(reports.creatorId, creatorId)];

    if (status) {
      conditions.push(eq(reports.status, status));
    }

    // Поиск по номеру заключения или госномеру
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(reports.reportNumber, searchPattern),
          ilike(reports.licensePlate, searchPattern),
          ilike(reports.ownerName, searchPattern),
        )!,
      );
    }

    // Получаем общее количество
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reports)
      .where(and(...conditions));

    // Получаем записи с пагинацией
    const userReports = await db
      .select()
      .from(reports)
      .where(and(...conditions))
      .orderBy(desc(reports.updatedAt))
      .limit(limit)
      .offset(offset);

    res.json({
      data: userReports,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    });
  },
);

router.get(
  '/:id',
  authMiddleware,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const report = await getOwnedReport(id, getCreatorId(req));

    const [repairWorksList, paintWorksList, sparePartsList, materialsList] =
      await Promise.all([
        db.select().from(repairWorks).where(eq(repairWorks.reportId, id)),
        db.select().from(paintWorks).where(eq(paintWorks.reportId, id)),
        db.select().from(spareParts).where(eq(spareParts.reportId, id)),
        db.select().from(materials).where(eq(materials.reportId, id)),
      ]);

    res.json({
      ...report,
      repair_works: repairWorksList,
      paint_works: paintWorksList,
      spare_parts: sparePartsList,
      materials: materialsList,
    });
  },
);

router.delete(
  '/:id',
  authMiddleware,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;

    const [deletedReport] = await db
      .delete(reports)
      .where(and(eq(reports.id, id), eq(reports.creatorId, getCreatorId(req))))
      .returning();

    if (!deletedReport) {
      throw notFound('Report not found');
    }

    res.json({ message: 'Draft deleted' });
  },
);

router.post(
  '/:id/finalize-and-generate',
  authMiddleware,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const report = await getOwnedReport(id, getCreatorId(req));

    const missingFields: string[] = [];

    if (!report.expertId) missingFields.push('expert_id');
    if (!report.reportNumber) missingFields.push('report_number');
    if (!report.reportDate) missingFields.push('report_date');
    if (!report.applicationDate) missingFields.push('application_date');
    if (!report.carModel) missingFields.push('car_model');
    if (report.carYear == null) missingFields.push('car_year');
    if (!report.carColor) missingFields.push('car_color');
    if (!report.bodyType) missingFields.push('body_type');
    if (!report.licensePlate) missingFields.push('license_plate');
    if (!report.ownerName) missingFields.push('owner_name');
    if (!report.techPassport) missingFields.push('tech_passport');
    if (report.mileage == null) missingFields.push('mileage');
    if (!report.odometerStatus) missingFields.push('odometer_status');
    if (!report.vinCode) missingFields.push('vin_code');
    if (!report.productionStatus) missingFields.push('production_status');
    if (report.analog1Mileage == null || report.analog1Price == null)
      missingFields.push('analog1');
    if (report.analog2Mileage == null || report.analog2Price == null)
      missingFields.push('analog2');
    if (report.analog3Mileage == null || report.analog3Price == null)
      missingFields.push('analog3');
    if (report.depreciationPct == null) missingFields.push('depreciation_pct');
    if (report.hourlyRate == null) missingFields.push('hourly_rate');

    if (missingFields.length > 0) {
      throw badRequest('Required fields are missing', {
        missing_fields: missingFields,
      });
    }

    const [repairWorksList, paintWorksList, sparePartsList, materialsList] =
      await Promise.all([
        db.select().from(repairWorks).where(eq(repairWorks.reportId, id)),
        db.select().from(paintWorks).where(eq(paintWorks.reportId, id)),
        db.select().from(spareParts).where(eq(spareParts.reportId, id)),
        db.select().from(materials).where(eq(materials.reportId, id)),
      ]);

    if (repairWorksList.length === 0) {
      throw badRequest('At least one repair work is required');
    }

    const [expert] = await db
      .select()
      .from(experts)
      .where(
        and(
          eq(experts.id, report.expertId),
          eq(experts.creatorId, getCreatorId(req)),
        ),
      )
      .limit(1);

    if (!expert) {
      throw badRequest('Expert does not belong to current creator');
    }

    const averagePrice =
      (Number(report.analog1Price) +
        Number(report.analog2Price) +
        Number(report.analog3Price)) /
      3;
    const marketPrice =
      averagePrice * (1 - Number(report.depreciationPct) / 100);
    const repairTotal = repairWorksList.reduce(
      (sum, work) => sum + Number(work.price),
      0,
    );
    const paintTotal = paintWorksList.reduce(
      (sum, work) => sum + Number(work.paintPrice) + Number(work.polishPrice),
      0,
    );
    const sparePartsTotal = sparePartsList.reduce(
      (sum, part) => sum + Number(part.price) * (part.qty || 0),
      0,
    );
    const materialsTotal = materialsList.reduce(
      (sum, material) => sum + Number(material.price) * (material.qty || 0),
      0,
    );
    const sparePartsWithWear =
      sparePartsTotal * (1 - Number(report.depreciationPct) / 100);
    const grandTotal =
      repairTotal + paintTotal + sparePartsWithWear + materialsTotal;

    await db
      .update(reports)
      .set({
        status: 'completed',
        currentStep: 5,
        grandTotal: Math.round(grandTotal),
        updatedAt: new Date(),
      })
      .where(and(eq(reports.id, id), eq(reports.creatorId, getCreatorId(req))));

    const docGenerator = new DocGenerator();
    const documentBuffer = await docGenerator.generateDocument({
      expertName: expert.fullName,
      reportNumber: report.reportNumber || '',
      reportDate: new Date(report.reportDate as Date).toLocaleDateString(
        'ru-RU',
      ),
      applicationDate: new Date(
        report.applicationDate as Date,
      ).toLocaleDateString('ru-RU'),
      carModel: report.carModel || '',
      carYear: report.carYear || 0,
      carColor: report.carColor || '',
      bodyType: report.bodyType || '',
      licensePlate: report.licensePlate || '',
      ownerName: report.ownerName || '',
      techPassport: report.techPassport || '',
      techPassportPlace: report.techPassportPlace || '',
      mileage: report.mileage || 0,
      odometerStatus: report.odometerStatus || '',
      vinCode: report.vinCode || '',
      engineNumber: report.engineNumber || '',
      transmissionType: report.transmissionType || '',
      productionStatus: report.productionStatus || '',
      analog1Mileage: report.analog1Mileage || 0,
      analog1Price: report.analog1Price || 0,
      analog2Mileage: report.analog2Mileage || 0,
      analog2Price: report.analog2Price || 0,
      analog3Mileage: report.analog3Mileage || 0,
      analog3Price: report.analog3Price || 0,
      factoryPrice: report.factoryPrice || 0,
      depreciationPct: report.depreciationPct || 0,
      marketPrice: Math.round(marketPrice),
      hourlyRate: report.hourlyRate || 0,
      repairWorks: repairWorksList,
      paintWorks: paintWorksList,
      spareParts: sparePartsList,
      materials: materialsList,
      grandTotal: Math.round(grandTotal),
    });

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = getGeneratedReportFilename(id, report.reportNumber);
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, documentBuffer);

    res.json({
      status: 'completed',
      download_url: `/api/reports/${id}/download`,
      filename,
      grand_total: Math.round(grandTotal),
    });
  },
);

router.get(
  '/:id/download',
  authMiddleware,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const report = await getOwnedReport(id, getCreatorId(req));

    if (report.status !== 'completed') {
      throw badRequest('Document has not been generated yet');
    }

    const filename = getGeneratedReportFilename(id, report.reportNumber);
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      throw notFound('File not found');
    }

    res.download(filePath, filename);
  },
);

router.post(
  '/:id/photos',
  authMiddleware,
  validate({ params: uuidParamsSchema }),
  uploadPhotos,
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    await getOwnedReport(id, getCreatorId(req));

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const existingPhotos = await db
      .select()
      .from(photos)
      .where(eq(photos.reportId, id));

    if (existingPhotos.length + files.length > 10) {
      throw badRequest('Photo limit exceeded', {
        current_count: existingPhotos.length,
        uploaded_count: files.length,
      });
    }

    const savedPhotos = [];

    for (const file of files) {
      const [photo] = await db
        .insert(photos)
        .values({
          reportId: id,
          filePath: file.filename,
        })
        .returning();

      savedPhotos.push({
        id: photo.id,
        file_path: photo.filePath,
        original_name: file.originalname,
      });
    }

    res.json({
      message: 'Photos uploaded',
      photos: savedPhotos,
      total_count: existingPhotos.length + files.length,
    });
  },
);

router.delete(
  '/:id/photos/:photoId',
  authMiddleware,
  validate({ params: photoParamsSchema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const photoId = req.params.photoId as string;
    await getOwnedReport(id, getCreatorId(req));

    const [photo] = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.reportId, id)))
      .limit(1);

    if (!photo) {
      throw notFound('Photo not found');
    }

    if (photo.filePath) {
      const filePath = path.join(photosDir, photo.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await db
      .delete(photos)
      .where(and(eq(photos.id, photoId), eq(photos.reportId, id)));
    res.json({ message: 'Photo deleted' });
  },
);

router.get(
  '/:id/photos',
  authMiddleware,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    await getOwnedReport(id, getCreatorId(req));

    const photosList = await db
      .select()
      .from(photos)
      .where(eq(photos.reportId, id));

    res.json({
      photos: photosList.map((photo) => ({
        id: photo.id,
        file_path: photo.filePath,
        url: `/api/reports/${id}/photos/${photo.id}/file`,
        created_at: photo.createdAt,
      })),
      count: photosList.length,
    });
  },
);

router.get(
  '/:id/photos/:photoId/file',
  authMiddleware,
  validate({ params: photoParamsSchema }),
  async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const photoId = req.params.photoId as string;
    await getOwnedReport(id, getCreatorId(req));

    const [photo] = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.reportId, id)))
      .limit(1);

    if (!photo?.filePath) {
      throw notFound('Photo not found');
    }

    const filePath = path.join(photosDir, photo.filePath);

    if (!fs.existsSync(filePath)) {
      throw notFound('File not found');
    }

    res.sendFile(filePath);
  },
);

export default router;
