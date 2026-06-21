import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { notFound } from '../../common/errors/httpError.js';
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
import type { Step4Input } from './reports.schemas.js';

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const reportRepository = {
  async getOwnedReport(reportId: string, creatorId: string) {
    const [report] = await db
      .select()
      .from(reports)
      .where(and(eq(reports.id, reportId), eq(reports.creatorId, creatorId)))
      .limit(1);

    if (!report) {
      throw notFound('Report not found');
    }

    return report;
  },

  async getReportById(reportId: string) {
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    return report ?? null;
  },

  async createReport(
    creatorId: string,
    data: {
      expert_id: string;
      report_number: string;
      report_date: Date;
      application_date: Date;
    },
  ) {
    const [newReport] = await db
      .insert(reports)
      .values({
        creatorId,
        expertId: data.expert_id,
        reportNumber: data.report_number,
        reportDate: data.report_date,
        applicationDate: data.application_date,
        status: 'draft',
        currentStep: 1,
      })
      .returning();

    return newReport;
  },

  async saveStep2(
    id: string,
    creatorId: string,
    data: Record<string, unknown>,
  ) {
    const [updatedReport] = await db
      .update(reports)
      .set({ ...data, currentStep: 2, updatedAt: new Date() })
      .where(and(eq(reports.id, id), eq(reports.creatorId, creatorId)))
      .returning();

    if (!updatedReport) {
      throw notFound('Report not found');
    }

    return updatedReport;
  },

  async saveStep3(
    id: string,
    creatorId: string,
    data: Record<string, unknown>,
  ) {
    const [updatedReport] = await db
      .update(reports)
      .set({ ...data, currentStep: 3, updatedAt: new Date() })
      .where(and(eq(reports.id, id), eq(reports.creatorId, creatorId)))
      .returning();

    if (!updatedReport) {
      throw notFound('Report not found');
    }

    return updatedReport;
  },

  async saveStep4(id: string, creatorId: string, data: Step4Input) {
    await db.transaction(async (tx) => {
      const [updatedReport] = await tx
        .update(reports)
        .set({
          hourlyRate: data.hourly_rate,
          currentStep: 4,
          updatedAt: new Date(),
        })
        .where(and(eq(reports.id, id), eq(reports.creatorId, creatorId)))
        .returning();

      if (!updatedReport) {
        throw notFound('Report not found');
      }

      await reportRepository.replaceStep4Collections(tx, id, data);
    });
  },

  async saveStep5(id: string, creatorId: string) {
    const [updatedReport] = await db
      .update(reports)
      .set({ currentStep: 5, updatedAt: new Date() })
      .where(and(eq(reports.id, id), eq(reports.creatorId, creatorId)))
      .returning();

    if (!updatedReport) {
      throw notFound('Report not found');
    }

    return updatedReport;
  },

  async autosave(
    id: string,
    creatorId: string,
    payload: Record<string, unknown>,
  ) {
    await db.transaction(async (tx) => {
      const reportUpdates = reportRepository.getUpdatePayload(payload);
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
        .where(and(eq(reports.id, id), eq(reports.creatorId, creatorId)))
        .returning();

      if (!updatedReport) {
        throw notFound('Report not found');
      }

      if (hasStep4Payload) {
        const { step4Schema } = await import('./reports.schemas.js');
        const step4Data = step4Schema.partial().parse(payload);
        await reportRepository.replaceStep4Collections(tx, id, step4Data);
      }
    });
  },

  async listReports(
    creatorId: string | undefined,
    query: { page: number; limit: number; search?: string; status?: string },
  ) {
    const { page, limit, search, status } = query;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (creatorId) {
      conditions.push(eq(reports.creatorId, creatorId));
    }
    if (status) {
      conditions.push(eq(reports.status, status));
    }
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ count }] = await db
      .select({ count: sql<string>`count(*)` })
      .from(reports)
      .where(whereClause);

    const total = Number(count);

    const result = await db
      .select()
      .from(reports)
      .where(whereClause)
      .orderBy(desc(reports.updatedAt))
      .limit(limit)
      .offset(offset);

    return {
      data: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async deleteReport(id: string, creatorId: string) {
    const [deletedReport] = await db
      .delete(reports)
      .where(and(eq(reports.id, id), eq(reports.creatorId, creatorId)))
      .returning();

    if (!deletedReport) {
      throw notFound('Report not found');
    }

    return deletedReport;
  },

  async getStep4Collections(id: string) {
    const [repairWorksList, paintWorksList, sparePartsList, materialsList] =
      await Promise.all([
        db.select().from(repairWorks).where(eq(repairWorks.reportId, id)),
        db.select().from(paintWorks).where(eq(paintWorks.reportId, id)),
        db.select().from(spareParts).where(eq(spareParts.reportId, id)),
        db.select().from(materials).where(eq(materials.reportId, id)),
      ]);

    return { repairWorksList, paintWorksList, sparePartsList, materialsList };
  },

  async updateReportStatus(
    id: string,
    creatorId: string,
    status: string,
    grandTotal: number,
  ) {
    await db
      .update(reports)
      .set({
        status,
        currentStep: 5,
        grandTotal: Math.round(grandTotal),
        updatedAt: new Date(),
      })
      .where(and(eq(reports.id, id), eq(reports.creatorId, creatorId)));
  },

  // Photos
  async listPhotos(reportId: string) {
    return db.select().from(photos).where(eq(photos.reportId, reportId));
  },

  async insertPhoto(reportId: string, filePath: string) {
    const [photo] = await db
      .insert(photos)
      .values({ reportId, filePath })
      .returning();
    return photo;
  },

  async getPhoto(photoId: string, reportId: string) {
    const [photo] = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.reportId, reportId)))
      .limit(1);
    return photo ?? null;
  },

  async deletePhoto(photoId: string, reportId: string) {
    await db
      .delete(photos)
      .where(and(eq(photos.id, photoId), eq(photos.reportId, reportId)));
  },

  // Expert ownership check
  async getExpertByCreator(expertId: string, creatorId: string) {
    const [expert] = await db
      .select()
      .from(experts)
      .where(and(eq(experts.id, expertId), eq(experts.creatorId, creatorId)))
      .limit(1);
    return expert ?? null;
  },

  // Internal helpers
  getUpdatePayload(data: Record<string, unknown>) {
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
  },

  async replaceStep4Collections(
    tx: DbTransaction,
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
  },
};
