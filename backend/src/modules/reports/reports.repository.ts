import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import {
  badRequest,
  conflict,
  notFound,
} from '../../common/errors/httpError.js';
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
  ): Promise<{ version: number }> {
    return db.transaction(async (tx) => {
      const reportUpdates = reportRepository.getUpdatePayload(payload);
      const hasStep4Payload =
        payload.hourly_rate !== undefined ||
        payload.repair_works !== undefined ||
        payload.paint_works !== undefined ||
        payload.spare_parts !== undefined ||
        payload.materials !== undefined;

      // Optimistic concurrency control (R2.12). When the client supplies
      // `version`, the UPDATE is conditional on the row still being at that
      // version; the version is incremented atomically as part of the same
      // statement so two concurrent autosaves cannot both succeed. The
      // payload's `version` is consumed here and never reaches the column
      // allow-list, so it cannot leak into `getUpdatePayload`.
      const clientVersion =
        typeof payload.version === 'number' ? payload.version : undefined;

      const updateConditions = [
        eq(reports.id, id),
        eq(reports.creatorId, creatorId),
      ];
      if (clientVersion !== undefined) {
        updateConditions.push(eq(reports.version, clientVersion));
      }

      const [updatedReport] = await tx
        .update(reports)
        .set({
          ...reportUpdates,
          ...(payload.hourly_rate !== undefined
            ? { hourlyRate: payload.hourly_rate as number }
            : {}),
          version: sql`${reports.version} + 1`,
          updatedAt: new Date(),
        })
        .where(and(...updateConditions))
        .returning({ version: reports.version });

      if (!updatedReport) {
        // Disambiguate "stale version" from "missing report": if the client
        // supplied a `version`, look up the row scoped to the same creator.
        // A row that exists but has a different version → 409 with
        // `current_version`. Anything else (no row, wrong owner) → 404, which
        // preserves the legacy behaviour for forced autosaves and avoids
        // leaking existence of reports owned by other creators.
        if (clientVersion !== undefined) {
          const [currentRow] = await tx
            .select({ version: reports.version })
            .from(reports)
            .where(
              and(eq(reports.id, id), eq(reports.creatorId, creatorId)),
            )
            .limit(1);
          if (currentRow) {
            throw conflict('Autosave version conflict', {
              current_version: currentRow.version,
            });
          }
        }
        throw notFound('Report not found');
      }

      if (hasStep4Payload) {
        const { step4Schema } = await import('./reports.schemas.js');
        const step4Data = step4Schema.partial().parse(payload);
        await reportRepository.replaceStep4Collections(tx, id, step4Data);
      }

      return { version: updatedReport.version };
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
  // Returns photo rows for a report ordered by the immutable upload order
  // (`sequence_number`, R4.6). Retained as the upload-order forensic view
  // (used by `reportService.uploadPhotos` for the 20-photo pre-count and by
  // any caller that needs the original insertion order). The production
  // `GET /api/reports/:id/photos` listing was switched to
  // `listPhotosByReportIdOrderedByPosition` by task 19.8 (R8.10), so this
  // helper is no longer the route's listing source.
  async listPhotosByReportId(reportId: string) {
    return db
      .select()
      .from(photos)
      .where(eq(photos.reportId, reportId))
      .orderBy(asc(photos.sequenceNumber));
  },

  // Returns photo rows for a report ordered by user-controlled display order
  // (`position` ASC, R8.10 / R8.12). This is the ordering consumed by
  // `buildPhotoScope` when constructing the `{#photos}…{/photos}` render
  // scope for the production .docx output (task 19.9) AND by
  // `reportService.listPhotos` as the source for `GET /api/reports/:id/photos`
  // since task 19.8 — the production GET contract is `position` ASC plus the
  // `caption` + `position` fields per R8.10. The legacy
  // `listPhotosByReportId` (sequence_number ASC) is retained only as the
  // upload-order forensic view.
  async listPhotosByReportIdOrderedByPosition(reportId: string) {
    return db
      .select()
      .from(photos)
      .where(eq(photos.reportId, reportId))
      .orderBy(asc(photos.position));
  },

  // Persists a Photo_Asset row with its metadata (R4.6). The next
  // `sequence_number` is allocated atomically via `SELECT MAX(...) + 1` scoped
  // to the `reportId`; the `(report_id, sequence_number)` unique index guards
  // against concurrent allocation races. `position` is supplied by the service
  // layer as the next free integer in `[1, k+1]` derived from the 20-photo
  // pre-count (R8.9) — the service is the authoritative allocator because it
  // also enforces the per-report limit, and the `(report_id, position)` unique
  // constraint (DEFERRABLE INITIALLY DEFERRED) guards against allocation races.
  // User-driven reordering after upload is handled by the PATCH endpoint
  // introduced in task 19.6.
  async insertPhoto(
    reportId: string,
    data: {
      filePath: string;
      originalName: string;
      byteSize: number;
      mimeType: string;
      position: number;
    },
  ) {
    const nextSequenceNumber = sql<number>`(SELECT COALESCE(MAX(${photos.sequenceNumber}), 0) + 1 FROM ${photos} WHERE ${photos.reportId} = ${reportId})`;

    const [photo] = await db
      .insert(photos)
      .values({
        reportId,
        filePath: data.filePath,
        originalName: data.originalName,
        byteSize: data.byteSize,
        mimeType: data.mimeType,
        sequenceNumber: nextSequenceNumber,
        position: data.position,
      })
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

  // Transactional photo delete (R4.10): looks up the Photo_Asset and removes
  // its metadata row inside a single DB transaction, returning the deleted
  // row's `filePath` so the service can unlink the file *after* commit (DB is
  // the source of truth even if the filesystem call later fails). Idempotent:
  // returns `null` when no matching row exists, so a repeated delete is a no-op.
  async deletePhotoTransactional(photoId: string, reportId: string) {
    return db.transaction(async (tx) => {
      const [photo] = await tx
        .select()
        .from(photos)
        .where(and(eq(photos.id, photoId), eq(photos.reportId, reportId)))
        .limit(1);

      if (!photo) {
        return null;
      }

      await tx
        .delete(photos)
        .where(and(eq(photos.id, photoId), eq(photos.reportId, reportId)));

      return { filePath: photo.filePath };
    });
  },

  // Transactional photo patch (R8.3, R8.4 + design §3.8). Loads the photo row
  // scoped to `(id, report_id)` so a missing row or a URL/report mismatch both
  // surface as the same 404 (no resource-existence disclosure — R8.3). When
  // `patch.position` is set, validates it against `k = count(*) FROM photos
  // WHERE report_id = $1` and then performs the band-shift reorder algorithm:
  //
  //   - upward move (target > current): subtract 1 from `position` for every
  //     row in `(current, target]` other than the moved photo,
  //   - downward move (target < current): add 1 to `position` for every row
  //     in `[target, current)` other than the moved photo,
  //
  // then sets the moved photo's `position` to `target`. The shift transiently
  // produces two rows with the same `(report_id, position)` value; the
  // `photos_report_position_unique` constraint is `DEFERRABLE INITIALLY
  // DEFERRED` (migration 0002) so PostgreSQL evaluates uniqueness once at
  // COMMIT. On any failure the entire `db.transaction` rolls back and the
  // pre-state is restored byte-for-byte (R8.4).
  //
  // Returns the updated row as `{ id, caption, position, sequenceNumber }`;
  // the service layer is responsible for any snake_case conversion at the
  // wire boundary.
  async patchPhotoTransactional(
    reportId: string,
    photoId: string,
    patch: { caption?: string | null; position?: number },
  ): Promise<{
    id: string;
    caption: string | null;
    position: number;
    sequenceNumber: number;
  }> {
    return db.transaction(async (tx) => {
      // 1. Load + ownership check inside the transaction so reorder math runs
      // against a consistent snapshot. Both "row missing" and "row belongs to
      // a different report_id" surface as the same 404.
      const [photo] = await tx
        .select({
          id: photos.id,
          position: photos.position,
        })
        .from(photos)
        .where(and(eq(photos.id, photoId), eq(photos.reportId, reportId)))
        .limit(1);

      if (!photo) {
        throw notFound('Photo not found');
      }

      // 2. When a `position` update is requested, validate against the actual
      // photo count `k` for this report (the Zod schema only enforces the
      // hard upper bound of `PHOTO_MAX_PER_REPORT = 20`; the runtime bound is
      // `[1, k]` where k is the count for this `report_id`).
      if (patch.position !== undefined) {
        const [counted] = await tx
          .select({ k: count() })
          .from(photos)
          .where(eq(photos.reportId, reportId));
        const k = counted?.k ?? 0;
        if (patch.position < 1 || patch.position > k) {
          throw badRequest('position_out_of_range', { min: 1, max: k });
        }
      }

      // 3. Apply caption patch (null clears the caption per R8.1).
      if (patch.caption !== undefined) {
        await tx
          .update(photos)
          .set({ caption: patch.caption })
          .where(
            and(eq(photos.id, photoId), eq(photos.reportId, reportId)),
          );
      }

      // 4. Apply position patch with the band-shift reorder.
      if (
        patch.position !== undefined &&
        patch.position !== photo.position
      ) {
        const current = photo.position;
        const target = patch.position;

        if (target > current) {
          // Shift `(current, target]` down by 1 to free the target slot.
          await tx
            .update(photos)
            .set({ position: sql`${photos.position} - 1` })
            .where(
              and(
                eq(photos.reportId, reportId),
                ne(photos.id, photoId),
                gt(photos.position, current),
                lte(photos.position, target),
              ),
            );
        } else {
          // target < current — shift `[target, current)` up by 1.
          await tx
            .update(photos)
            .set({ position: sql`${photos.position} + 1` })
            .where(
              and(
                eq(photos.reportId, reportId),
                ne(photos.id, photoId),
                gte(photos.position, target),
                lt(photos.position, current),
              ),
            );
        }

        await tx
          .update(photos)
          .set({ position: target })
          .where(
            and(eq(photos.id, photoId), eq(photos.reportId, reportId)),
          );
      }

      // 5. Read back the updated row so the response reflects post-commit
      // state (caption + position) along with the immutable sequence_number.
      const [updated] = await tx
        .select({
          id: photos.id,
          caption: photos.caption,
          position: photos.position,
          sequenceNumber: photos.sequenceNumber,
        })
        .from(photos)
        .where(and(eq(photos.id, photoId), eq(photos.reportId, reportId)))
        .limit(1);

      // Defensive: the row was present at step 1 and we never delete it, so
      // this is unreachable. The non-null assertion keeps the type tight.
      return updated!;
    });
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
