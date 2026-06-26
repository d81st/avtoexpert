import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  badRequest,
  conflict,
  unsupportedMediaType,
} from '../../common/errors/httpError.js';
import { logger } from '../../shared/logger/logger.js';
import { storageService } from '../../shared/services/storage.service.js';
import { expertService } from '../experts/experts.service.js';
import {
  buildPhotoScope,
  DocGenerator,
  type ReportData,
} from './docGenerator.js';
import {
  imagePipeline,
  type NormalizableMime,
  type NormalizedFormat,
  type NormalizedImage,
} from './imagePipeline.js';
import { PhotoDecodeError } from './photoCompressor.js';
import type { PhotoSlotScope } from './photoSlots.js';
import { PHOTO_MAX_PER_REPORT } from './photoValidator.js';
import { reportRepository } from './reports.repository.js';
import type { PhotoPatch, Step4Input } from './reports.schemas.js';

/**
 * Return type of `streamDownload` (introduced in task 2.1). Declared here in
 * task 1.1 alongside the rest of the module's service-layer types so that
 * downstream callers can already reference it while the implementation lands
 * in a later step.
 */
export type StreamDownloadResult = { buffer: Buffer; filename: string };

/**
 * Output extension and `Content-Type` for each Normalized_Image format produced
 * by Image_Pipeline (§3.8 / R8.7). `image/jpeg` and `image/webp` inputs are
 * re-encoded to JPEG (quality 85); `image/png` inputs are re-encoded to PNG
 * (compressionLevel 9). The persisted file extension and DB `mime_type` always
 * reflect the actual output bytes, so the file on disk and the served
 * `Content-Type` stay consistent regardless of the original upload format.
 */
const NORMALIZED_OUTPUT_EXT: Record<NormalizedFormat, string> = {
  jpeg: '.jpg',
  png: '.png',
};
const NORMALIZED_OUTPUT_MIME: Record<NormalizedFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
};

interface NormalizedUpload {
  filePath: string;
  byteSize: number;
  mimeType: string;
}

/**
 * Reads a multer-persisted upload, runs it through Image_Pipeline (EXIF-rotate
 * → strip-EXIF → resize → encode → size guard, §3.8) and writes the normalized
 * bytes back to disk. The on-disk extension and the DB `mime_type` are derived
 * from the actual normalized format so they cannot drift from the file bytes:
 * `image/jpeg`/`image/webp` inputs land as `.jpg` (`image/jpeg`); `image/png`
 * inputs land as `.png` (`image/png`).
 *
 * On a decode failure (corrupt file, bytes not matching the declared MIME type,
 * or a normalized image exceeding `MAX_NORMALIZED_BYTES`, R4.12 / R8.8) the
 * temporary upload is unlinked and an HTTP 415 is raised, so no orphaned temp
 * file survives and no DB row is created for the failed photo.
 */
async function normalizeUploadedPhoto(
  file: Express.Multer.File,
): Promise<NormalizedUpload> {
  const inputBuffer = await readFile(file.path);

  let result: NormalizedImage;
  try {
    // `file.mimetype` is already constrained to the photo whitelist by
    // `validatePhoto` in `upload.ts` (R4.2, R6.8), so this cast lands strictly
    // in the `NormalizableMime` union.
    result = await imagePipeline.normalize(
      inputBuffer,
      file.mimetype as NormalizableMime,
    );
  } catch (error) {
    // Cleanup on pipeline failure (R4.12 / R8.8): drop the temp file and
    // surface a 415 so the caller leaves neither an orphaned file nor a DB row.
    await storageService.deleteFileAsync(file.path);
    if (error instanceof PhotoDecodeError) {
      throw unsupportedMediaType('photo_corrupt', { reason: 'corrupt' });
    }
    throw error;
  }

  const outExt = NORMALIZED_OUTPUT_EXT[result.format];
  const outMime = NORMALIZED_OUTPUT_MIME[result.format];

  const currentExt = path.extname(file.filename);
  const outFilename =
    currentExt.toLowerCase() === outExt
      ? file.filename
      : `${path.basename(file.filename, currentExt)}${outExt}`;
  const outPath = path.join(storageService.getPhotosDir(), outFilename);

  await storageService.writeFileAsync(outPath, result.buffer);
  if (outPath !== file.path) {
    // Remove the original-extension temp file left by multer.
    await storageService.deleteFileAsync(file.path);
  }

  return {
    filePath: outFilename,
    byteSize: result.bytes,
    mimeType: outMime,
  };
}

/**
 * Pure, side-effect-free mapper from `Report_DB_State` (report row + Step4
 * collections), the resolved expert owner, the precomputed `totals`, and the
 * already-built `photoScope` to the `ReportData` shape consumed by
 * `DocGenerator.generateDocument`.
 *
 * Extracted in task 1.1 (R2.2) so the same `Render_Input` can be built from
 * both `finalizeAndGenerate` (today) and the upcoming `streamDownload`
 * (task 2.1) without duplicating the field-by-field mapping. The body
 * intentionally preserves the exact expressions previously inlined in
 * `finalizeAndGenerate` — including the `as Date` casts on `reportDate` /
 * `applicationDate`, the `|| ''` / `|| 0` fall-throughs on nullable scalars,
 * and the `Math.round(totals.grandTotal)` rounding on `grandTotal` — so this
 * step is a pure refactor with no observable behaviour change.
 */
function buildReportData(
  report: Awaited<ReturnType<typeof reportRepository.getOwnedReport>>,
  collections: Awaited<
    ReturnType<typeof reportRepository.getStep4Collections>
  >,
  expert: { fullName: string },
  totals: { marketPrice: number; grandTotal: number },
  photoScope: PhotoSlotScope,
): ReportData {
  return {
    expertName: expert.fullName,
    reportNumber: report.reportNumber || '',
    reportDate: new Date(report.reportDate as Date).toLocaleDateString('ru-RU'),
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
    marketPrice: totals.marketPrice,
    hourlyRate: report.hourlyRate || 0,
    repairWorks: collections.repairWorksList,
    paintWorks: collections.paintWorksList,
    spareParts: collections.sparePartsList,
    materials: collections.materialsList,
    grandTotal: Math.round(totals.grandTotal),
    // Slot-based photo render scope for Docx_Template_V3 (R5.1, R5.2,
    // R9.5; design §3.2/§3.3). Built by `buildPhotoScope(reportId)` at the
    // call site — `buildReportData` itself stays pure and free of any I/O.
    photoSlots: photoScope,
  };
}

export const reportService = {
  // ── Thin wrappers (routes → service → repository) ──

  async createReport(
    creatorId: string,
    data: {
      expert_id: string;
      report_number: string;
      report_date: Date;
      application_date: Date;
    },
  ) {
    const expert = await expertService.verifyOwnership(
      creatorId,
      data.expert_id,
    );
    if (!expert) {
      throw badRequest('Expert does not belong to current creator');
    }

    const newReport = await reportRepository.createReport(creatorId, data);
    return {
      id: newReport.id,
      status: newReport.status,
      current_step: newReport.currentStep,
      message: 'Draft created',
    };
  },

  async getFullReport(creatorId: string, reportId: string) {
    const report = await reportRepository.getOwnedReport(reportId, creatorId);
    const collections = await reportRepository.getStep4Collections(reportId);

    return {
      ...report,
      repair_works: collections.repairWorksList,
      paint_works: collections.paintWorksList,
      spare_parts: collections.sparePartsList,
      materials: collections.materialsList,
    };
  },

  async saveStep2(
    id: string,
    creatorId: string,
    data: Record<string, unknown>,
  ) {
    return reportRepository.saveStep2(id, creatorId, data);
  },

  async saveStep3(
    id: string,
    creatorId: string,
    data: Record<string, unknown>,
  ) {
    return reportRepository.saveStep3(id, creatorId, data);
  },

  async saveStep4(id: string, creatorId: string, data: Step4Input) {
    return reportRepository.saveStep4(id, creatorId, data);
  },

  async saveStep5(id: string, creatorId: string) {
    return reportRepository.saveStep5(id, creatorId);
  },

  async autosave(
    id: string,
    creatorId: string,
    payload: Record<string, unknown>,
  ): Promise<{ version: number }> {
    return reportRepository.autosave(id, creatorId, payload);
  },

  async listReports(
    creatorId: string,
    query: { page: number; limit: number; search?: string; status?: string },
  ) {
    return reportRepository.listReports(creatorId, query);
  },

  /**
   * Orchestrated report delete (design §1.3, R5.1–R5.5).
   *
   * Previously a thin wrapper around `reportRepository.deleteReport`, which
   * relied on `ON DELETE CASCADE` to drop the `photos` rows but left every
   * underlying photo file orphaned in `<PHOTOS_DIR>` (R5.3). The orchestrated
   * version loads the photo rows BEFORE the cascade fires, unlinks each
   * `<PHOTOS_DIR>/<file_path>`, and only then deletes the `reports` row.
   *
   * Pipeline:
   *   1. `getOwnedReport` — 404 if the report is missing or owned by another
   *      creator. Runs first so an unauthorized DELETE never touches the
   *      filesystem.
   *   2. `listPhotosByReportId` — snapshot of every `photos` row for this
   *      report, taken BEFORE the cascade delete removes them. Ordering is
   *      irrelevant; we need only `id` and `filePath` for unlink + logging.
   *   3. Best-effort per-file unlink loop. `storageService.deleteFileAsync`
   *      already swallows `ENOENT` as a no-op (R5.5), so files that are
   *      already missing complete silently and `deleteReport` still succeeds.
   *      Any other error (e.g. `EACCES`, `EBUSY`) is logged via
   *      `logger.error('photo_delete_failed', { reportId, photoId, file_path,
   *      reason })` and the loop continues with the next photo, so a single
   *      filesystem failure does not block removal of the remaining files or
   *      the final DB delete (R5.4).
   *   4. `reportRepository.deleteReport` — the cascade in the DB drops the
   *      `photos` / `repair_works` / `paint_works` / `spare_parts` /
   *      `materials` rows. The DB is the source of truth, so the report is
   *      deleted even when one or more photo files could not be unlinked.
   *
   * Order is strict: load photos → unlink files → delete `reports` row. If
   * the row were deleted first, the cascade would erase `photos.file_path`
   * and the unlink loop would have nothing to act on (R5.1).
   */
  async deleteReport(id: string, creatorId: string) {
    // 1. Ownership check + existence — 404 from the repository if missing or
    // owned by another creator. Performed BEFORE any filesystem work.
    await reportRepository.getOwnedReport(id, creatorId);

    // 2. Snapshot every photo row for this report BEFORE the cascade fires
    // and erases them. `listPhotosByReportId` returns full rows; we only
    // need `id` and `filePath` here (R5.1).
    const photosRows = await reportRepository.listPhotosByReportId(id);

    // 3. Best-effort unlink of each photo file. ENOENT is already a no-op in
    // `deleteFileAsync` (R5.5); anything else is logged and we keep going so
    // one broken file does not block the rest or the final DB delete (R5.4).
    for (const photo of photosRows) {
      if (!photo.filePath) continue;
      const absPath = path.join(
        storageService.getPhotosDir(),
        photo.filePath,
      );
      try {
        await storageService.deleteFileAsync(absPath);
      } catch (err) {
        const reason =
          (err as NodeJS.ErrnoException).code ??
          (err instanceof Error ? err.message : 'unknown');
        logger.error('photo_delete_failed', {
          reportId: id,
          photoId: photo.id,
          file_path: photo.filePath,
          reason,
        });
        // continue with remaining files (R5.4)
      }
    }

    // 4. Delete the report row — the DB cascade removes the dependent
    // `photos` / Step4 rows. Returns the deleted report shape, preserving
    // the contract callers rely on.
    return reportRepository.deleteReport(id, creatorId);
  },

  /**
   * Validate that all required Docx placeholders are satisfiable before
   * finalization (R3.8). Aggregates two classes of unmet placeholder into a
   * single missing-list so the caller can surface one error BEFORE
   * `docGenerator.generateDocument` runs and BEFORE any DB write:
   *   - required scalar placeholders with no value in the report row, and
   *   - required repeating-group placeholders that resolve to zero rows
   *     (currently `repair_works`, which must contain at least one row).
   *
   * When `collections` is provided the required-group emptiness is folded into
   * the returned list (e.g. `repair_works`); the parameter is optional so the
   * scalar-only behaviour is preserved for callers that do not have the Step4
   * collections loaded.
   */
  validateCompleteness(
    report: Record<string, unknown>,
    collections?: { repairWorksList: unknown[] },
  ): string[] {
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

    // Required repeating-group placeholders (R3.8): at least one repair_works
    // row must exist. Folded into the same aggregated list so a missing group
    // surfaces alongside any missing scalars in one error.
    if (collections && collections.repairWorksList.length === 0) {
      missingFields.push('repair_works');
    }

    return missingFields;
  },

  /**
   * Calculate all financial totals for a report.
   */
  calculateTotals(
    report: Record<string, unknown>,
    collections: {
      repairWorksList: { price: number | string | null }[];
      paintWorksList: {
        paintPrice: number | string | null;
        polishPrice: number | string | null;
      }[];
      sparePartsList: { price: number | string | null; qty: number | null }[];
      materialsList: { price: number | string | null; qty: number | null }[];
    },
  ) {
    const depreciationPct = Number(report.depreciationPct) || 0;

    const averagePrice =
      (Number(report.analog1Price) +
        Number(report.analog2Price) +
        Number(report.analog3Price)) /
      3;
    const marketPrice = averagePrice * (1 - depreciationPct / 100);

    const repairTotal = collections.repairWorksList.reduce(
      (sum, work) => sum + Number(work.price),
      0,
    );
    const paintTotal = collections.paintWorksList.reduce(
      (sum, work) => sum + Number(work.paintPrice) + Number(work.polishPrice),
      0,
    );
    const sparePartsTotal = collections.sparePartsList.reduce(
      (sum, part) => sum + Number(part.price) * (part.qty || 0),
      0,
    );
    const materialsTotal = collections.materialsList.reduce(
      (sum, material) => sum + Number(material.price) * (material.qty || 0),
      0,
    );

    const sparePartsWithWear = sparePartsTotal * (1 - depreciationPct / 100);
    const grandTotal =
      repairTotal + paintTotal + sparePartsWithWear + materialsTotal;

    return {
      averagePrice,
      marketPrice: Math.round(marketPrice),
      repairTotal,
      paintTotal,
      sparePartsTotal,
      materialsTotal,
      sparePartsWithWear,
      grandTotal,
    };
  },

  getGeneratedReportFilename(reportId: string, reportNumber: string | null) {
    const safeNumber = (reportNumber || 'report').replace(/[^\w.-]+/g, '_');
    return `report_${safeNumber}_${reportId}.docx`;
  },

  /**
   * Ephemeral finalize workflow (design §1.1, R1.1–R1.7).
   *
   * After this feature `finalizeAndGenerate` performs only the business-level
   * state transition and never writes a DOCX to `<UPLOAD_DIR>`. The persisted
   * `Report_DB_State` is the single source of truth; the document is
   * regenerated on every `GET /:id/download` from that state (see
   * `streamDownload`). Pipeline:
   *
   *   1. Fetch report + Step4 collections.
   *   2. Validate completeness (scalars + required groups). The aggregated
   *      error is surfaced BEFORE any DB mutation so a rejected finalize
   *      leaves the report's row untouched (R1.2).
   *   3. Verify expert ownership — defensive `badRequest` if the report's
   *      `expert_id` no longer maps to this creator.
   *   4. Calculate totals via `calculateTotals` (same numeric pipeline as
   *      before, so the persisted `grand_total` is unchanged).
   *   5. Single UPDATE moving `status → 'completed'` and writing
   *      `grand_total` (R1.3).
   *   6. Return JSON `{ status, download_url, filename, grand_total }` with
   *      `filename` derived from `getGeneratedReportFilename(reportId,
   *      reportNumber)` (R1.4). The frontend uses `download_url` to invoke
   *      the download endpoint, which renders the document in memory.
   *
   * This method MUST NOT call `DocGenerator.generateDocument` (R1.5) and MUST
   * NOT call `storageService.writeFileAsync` / `writeFile` with any path
   * matching `<UPLOAD_DIR>/report_*.docx` (R1.6). The post-condition is that
   * `<UPLOAD_DIR>` contains no `report_*.docx` file added by this call (R1.7).
   */
  async finalizeAndGenerate(creatorId: string, reportId: string) {
    const report = await reportRepository.getOwnedReport(reportId, creatorId);

    // 1. Fetch collections first so the completeness check can aggregate both
    // missing scalars and empty required groups into a single error. Both this
    // read and the validation below run BEFORE `updateReportStatus`, so a
    // validation failure leaves the report's DB state untouched (R1.2).
    const collections = await reportRepository.getStep4Collections(reportId);

    // 2. Validate — aggregate missing scalar placeholders AND required
    // repeating-group placeholders (e.g. at least one repair_works row) and
    // surface them together before any state transition.
    const missingFields = reportService.validateCompleteness(
      report,
      collections,
    );
    if (missingFields.length > 0) {
      throw badRequest('Required fields are missing', {
        missing_fields: missingFields,
      });
    }

    // 3. Verify expert ownership.
    const expert = await reportRepository.getExpertByCreator(
      report.expertId!,
      creatorId,
    );
    if (!expert) {
      throw badRequest('Expert does not belong to current creator');
    }

    // 4. Calculate totals.
    const totals = reportService.calculateTotals(report, collections);

    // 5. Update status — single DB mutation, intentionally after all
    // validation so the row is never touched when finalization is rejected
    // (R1.2). After this point no DOCX is rendered and no file is written:
    // the download endpoint is responsible for producing the document on
    // demand from this row (R1.5, R1.6, R1.7).
    await reportRepository.updateReportStatus(
      reportId,
      creatorId,
      'completed',
      totals.grandTotal,
    );

    // 6. Build the JSON response. `filename` is derived from the same helper
    // the download path uses, so the value returned here and the
    // `Content-Disposition` filename served by `streamDownload` stay aligned
    // (R1.4, design §1.1).
    const filename = reportService.getGeneratedReportFilename(
      reportId,
      report.reportNumber,
    );

    return {
      status: 'completed',
      download_url: `/api/reports/${reportId}/download`,
      filename,
      grand_total: Math.round(totals.grandTotal),
    };
  },

  /**
   * Ephemeral DOCX download (design §1.2, R2.1–R2.2, R2.8–R2.9, R9.1–R9.2).
   *
   * Regenerates the DOCX in memory on every call from the current
   * `Report_DB_State` and returns the raw `Buffer` together with the canonical
   * filename. The method is read-only: it never writes the document (or any
   * other file) to `<UPLOAD_DIR>`, never mutates a row, and never deletes a
   * file — so repeated calls for the same `reportId` with unchanged DB and
   * `<PHOTOS_DIR>` state leave the server bit-identical (R9.1, R9.2, R9.3).
   *
   * Pipeline:
   *   1. `getOwnedReport` — ownership/existence check. Throws `notFound` from
   *      the repository when the report is missing or owned by another
   *      creator (R2.9).
   *   2. Status gate — throws HTTP 409 `report_not_completed` with
   *      `{ report_id, current_status }` when `status !== 'completed'`
   *      (R2.8). 409 is semantically correct: the resource exists but the
   *      requested operation conflicts with its current state.
   *   3. `getStep4Collections` — same Step4 read used by the legacy
   *      `finalizeAndGenerate` path, so the rendered document mirrors the
   *      persisted `grand_total` exactly.
   *   4. `getExpertByCreator` — defensive 409 with `reason: 'expert_missing'`
   *      when the report row points at an expert that no longer belongs to
   *      this creator. A `completed` report MUST have a valid expert; a
   *      broken pointer is a corrupt state, not a 400-class client error.
   *   5. `calculateTotals` → `buildReportData` — identical `Render_Input` to
   *      the historic finalize path (Property 4: Render_Input equivalence).
   *   6. `new DocGenerator().generateDocument(data)` → `Buffer`. The
   *      generator is treated as a black box (R3).
   *   7. Return `{ buffer, filename }` — the route layer is responsible for
   *      headers and `res.send`.
   */
  async streamDownload(
    creatorId: string,
    reportId: string,
  ): Promise<StreamDownloadResult> {
    // 1. Ownership/existence (R2.9). Repository surfaces `notFound` (404) when
    // the report is missing or owned by another creator.
    const report = await reportRepository.getOwnedReport(reportId, creatorId);

    // 2. Status gate (R2.8). 409 Conflict with structured details so clients
    // can render a precise error without screen-scraping the message.
    if (report.status !== 'completed') {
      throw conflict('report_not_completed', {
        report_id: reportId,
        current_status: report.status,
      });
    }

    // 3. Load Step4 collections — same shape as `finalizeAndGenerate` uses,
    // keeping the rendered document consistent with the persisted totals.
    const collections = await reportRepository.getStep4Collections(reportId);

    // 4. Expert ownership — defensive 409. The report owns this expert via
    // `report.expertId`; an unexpected null here means the expert was
    // detached after finalization (e.g., DB hand-edit), which is corrupt
    // state, not a missing-required-fields case.
    const expert = await reportRepository.getExpertByCreator(
      report.expertId!,
      creatorId,
    );
    if (!expert) {
      throw conflict('report_not_completed', {
        report_id: reportId,
        reason: 'expert_missing',
      });
    }

    // 5. Recompute totals + build `Render_Input`. `buildReportData` is the
    // shared pure mapper extracted in task 1.1, so this branch and
    // `finalizeAndGenerate` produce the same `ReportData` from the same
    // `Report_DB_State` (Property 4).
    const totals = reportService.calculateTotals(report, collections);
    const reportData = buildReportData(
      report,
      collections,
      expert,
      totals,
      // Slot-based photo render scope (R5.1, R5.2, R9.5): missing/unreadable
      // files render their slot empty without aborting the whole download.
      await buildPhotoScope(reportId),
    );

    // 6. Generate the document in memory. No disk write happens here or
    // anywhere downstream in this method (R1.6 / R9.2).
    const docGenerator = new DocGenerator();
    const buffer = await docGenerator.generateDocument(reportData);

    // 7. Derive the canonical filename using the same helper that
    // `finalizeAndGenerate` uses, so the value returned by finalize and the
    // value served on download stay aligned.
    const filename = reportService.getGeneratedReportFilename(
      reportId,
      report.reportNumber,
    );

    return { buffer, filename };
  },

  // ── Photo operations ──

  async uploadPhotos(
    creatorId: string,
    reportId: string,
    files: Express.Multer.File[],
  ) {
    await reportRepository.getOwnedReport(reportId, creatorId);

    const existingPhotos =
      await reportRepository.listPhotosByReportId(reportId);

    // Pre-count rows for the 20-photo limit (R4.11). When the batch would push
    // the report past PHOTO_MAX_PER_REPORT, reject with HTTP 400 and clean up
    // every just-uploaded temp file so a rejected request leaves no orphans.
    if (existingPhotos.length + files.length > PHOTO_MAX_PER_REPORT) {
      await Promise.all(
        files.map((file) => storageService.deleteFileAsync(file.path)),
      );
      throw badRequest('photo_limit_reached', {
        max_photos: PHOTO_MAX_PER_REPORT,
        current_count: existingPhotos.length,
        uploaded_count: files.length,
      });
    }

    // Normalize and persist each photo. If any file fails, roll the whole batch
    // back: delete the DB rows already inserted, their persisted files, and any
    // remaining temp uploads — so no orphaned files or rows survive (R4.12).
    //
    // `position` for each new row is derived from the same pre-count `k =
    // existingPhotos.length` used by the 20-photo limit check above (R8.9): the
    // i-th new photo (0-indexed) lands at position `k + i + 1`, which is the
    // next free integer in `[1, k + i + 1]` once positions `1..k+i` are
    // occupied. The `(report_id, position)` unique constraint guards against
    // any allocation race.
    const savedPhotos = [];
    const inserted: { id: string; filePath: string }[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const normalized = await normalizeUploadedPhoto(file);
        const photo = await reportRepository.insertPhoto(reportId, {
          filePath: normalized.filePath,
          originalName: file.originalname,
          byteSize: normalized.byteSize,
          mimeType: normalized.mimeType,
          position: existingPhotos.length + i + 1,
        });
        inserted.push({ id: photo.id, filePath: normalized.filePath });
        savedPhotos.push({
          id: photo.id,
          file_path: photo.filePath,
          original_name: file.originalname,
          sequence_number: photo.sequenceNumber,
        });
      }
    } catch (error) {
      await Promise.all([
        ...inserted.map(async (row) => {
          await reportRepository.deletePhoto(row.id, reportId);
          await storageService.deleteFileAsync(
            path.join(storageService.getPhotosDir(), row.filePath),
          );
        }),
        ...files.map((file) => storageService.deleteFileAsync(file.path)),
      ]);
      throw error;
    }

    return {
      message: 'Photos uploaded',
      photos: savedPhotos,
      total_count: existingPhotos.length + files.length,
    };
  },

  async deletePhoto(creatorId: string, reportId: string, photoId: string) {
    await reportRepository.getOwnedReport(reportId, creatorId);

    // Transactional delete (R4.10): the metadata row is removed inside a DB
    // transaction, then the file is unlinked after commit so the DB stays the
    // source of truth even if the filesystem call fails. The operation is
    // idempotent — a missing row or missing file completes successfully without
    // leaving orphaned files or records.
    const deleted = await reportRepository.deletePhotoTransactional(
      photoId,
      reportId,
    );

    if (deleted?.filePath) {
      const filePath = path.join(
        storageService.getPhotosDir(),
        deleted.filePath,
      );
      await storageService.deleteFileAsync(filePath);
    }
  },

  /**
   * Patch a Photo_Asset's `caption` and/or display `position` (R8.1, R8.2,
   * R8.3, R8.4; design §3.8).
   *
   * Ownership is enforced in two layers, both surfacing as the same 404 so
   * the existence of resources owned by other creators is never disclosed:
   *
   *   1. `reportRepository.getOwnedReport(reportId, creatorId)` confirms the
   *      report exists AND belongs to the authenticated creator.
   *   2. `reportRepository.patchPhotoTransactional(reportId, photoId, patch)`
   *      verifies the photo exists AND that its `report_id` matches the URL
   *      (`photoId` belonging to a different report → 404).
   *
   * On a `position` update the repository runs the band-shift reorder inside
   * a single `db.transaction`, relying on the `(report_id, position)` unique
   * constraint being `DEFERRABLE INITIALLY DEFERRED` so the transient
   * duplicate position is permitted between the shift and the final set, and
   * uniqueness is validated once at COMMIT. Any failure rolls the whole
   * transaction back, leaving every photo's pre-state intact (R8.4).
   *
   * Returns `{ id, caption, position, sequence_number }` (snake_case at the
   * service boundary, matching the rest of the reports surface).
   */
  async patchPhoto(
    photoId: string,
    reportId: string,
    creatorId: string,
    patch: PhotoPatch,
  ): Promise<{
    id: string;
    caption: string | null;
    position: number;
    sequence_number: number;
  }> {
    // 1. Report ownership — 404 if the report doesn't exist OR is owned by
    // another creator. The photo-level ownership check (photo.report_id ===
    // reportId) is inside the transactional helper below so it runs against
    // the same snapshot used by the reorder math.
    await reportRepository.getOwnedReport(reportId, creatorId);

    // 2. Apply caption and/or position changes atomically. The helper throws
    // 404 when the photo row is missing or belongs to a different report,
    // and 400 (`position_out_of_range`) when `patch.position` is outside the
    // runtime bound `[1, k]` derived from the photo count for this report.
    const updated = await reportRepository.patchPhotoTransactional(
      reportId,
      photoId,
      patch,
    );

    return {
      id: updated.id,
      caption: updated.caption,
      position: updated.position,
      sequence_number: updated.sequenceNumber,
    };
  },

  async listPhotos(creatorId: string, reportId: string) {
    await reportRepository.getOwnedReport(reportId, creatorId);

    // Listing contract (R8.10, task 19.8): the production GET response is
    // ordered by user-controlled `position` ASC, not by immutable upload-order
    // `sequence_number`. The repository exposes both helpers — see
    // `listPhotosByReportId` (sequence_number ASC, retained as the forensic
    // upload-order view, R4.6) vs `listPhotosByReportIdOrderedByPosition`
    // (position ASC, R8.10). Each item carries `caption` + `position` so the
    // client can render reorderable thumbnails with captions, alongside the
    // pre-existing fields established by R4.
    const photosList =
      await reportRepository.listPhotosByReportIdOrderedByPosition(reportId);

    return {
      photos: photosList.map((photo) => ({
        id: photo.id,
        file_path: photo.filePath,
        url: `/api/reports/${reportId}/photos/${photo.id}/file`,
        created_at: photo.createdAt,
        sequence_number: photo.sequenceNumber,
        caption: photo.caption,
        position: photo.position,
      })),
      count: photosList.length,
    };
  },

  async getPhotoFile(creatorId: string, reportId: string, photoId: string) {
    await reportRepository.getOwnedReport(reportId, creatorId);

    const photo = await reportRepository.getPhoto(photoId, reportId);
    if (!photo?.filePath) {
      throw badRequest('Photo not found');
    }

    const filePath = path.join(storageService.getPhotosDir(), photo.filePath);
    if (!storageService.fileExists(filePath)) {
      throw badRequest('File not found');
    }

    return filePath;
  },
};
