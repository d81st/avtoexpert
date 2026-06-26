import { readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { imageSize } from 'image-size';
import PizZip from 'pizzip';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/logger.js';
import {
  computeSlotImageSizePx,
  emptyPhotoSlotScope,
  PHOTO_SLOT_COUNT,
  type PhotoSlotScope,
  parseSlotIndexFromTag,
} from './photoSlots.js';
import { reportRepository } from './reports.repository.js';
import { precheckTables } from './tableMapper.js';

// --- Photo_Insertion image sizing ---
//
// Slot-based photo rendering helpers (`createPhotoImageModule`,
// `buildPhotoScope`) are introduced in tasks 6.2 / 6.3 and import their
// constants from `./photoSlots.js`. The legacy global 14 cm width bound
// (`MAX_IMAGE_WIDTH_EMU`, `MAX_IMAGE_WIDTH_PX`, `computeImageSizePx`) and the
// legacy array-shaped `PhotoScopeEntry`/`buildPhotoScope` are intentionally
// removed here (task 6.1, R5.2) so that no downstream code accidentally
// reaches for the old API while the new implementation is being plugged in.

/**
 * Builds the `docxtemplater-image-module-free` instance backing the six
 * `{%photo_N}` slot placeholders in `Docx_Template_V3`. The module is path-
 * based: `getImage` reads the absolute filesystem path stored in
 * `scope.photo_N`, and `getSize` dispatches per-slot dimensions through
 * `parseSlotIndexFromTag` + `computeSlotImageSizePx` (so each `{%photo_N}`
 * gets `SLOT_SIZE_INVENTORY[N - 1]`-sized output rather than the legacy
 * global 14 cm width bound).
 *
 * Empty slots (`scope.photo_N === ''`) are handled in two layers (R5.4):
 *   1. The image module's own `render()` short-circuits on a falsy
 *      `tagValue` before ever calling `getImage`, emitting the tag's plain
 *      text-run XML in place. The `{%photo_N}` placeholder therefore
 *      vanishes from the output without a `<w:drawing>`.
 *   2. As a defensive fallback (in case the module's contract changes),
 *      `getImage` itself returns `null` for falsy `tagValue`. Combined with
 *      the relaxed return type in `types/docxtemplater-image-module-free.d.ts`,
 *      this keeps `createPhotoImageModule` total without an extra throw path.
 *
 * `getSize` parses the slot index out of `tagName` (the docxtemplater tag
 * is always `photo_N`); a malformed tag falls back to slot 1 so the module
 * never throws mid-render (R7.6 is already enforced inside
 * `computeSlotImageSizePx` for degenerate `imageSize` results).
 */
export function createPhotoImageModule(): ImageModule {
  return new ImageModule({
    centered: false,
    fileType: 'docx',
    getImage(tagValue: string, _tagName: string): Buffer | null {
      // Empty slot: the image module already skips `getImage` when the
      // scope value is falsy, but returning `null` keeps the callback
      // total for any defensive future caller (R5.4).
      if (!tagValue) return null;
      return readFileSync(tagValue);
    },
    getSize(
      img: Buffer | Uint8Array,
      _tagValue: string,
      tagName: string,
    ): [number, number] {
      const { width, height } = imageSize(img);
      const slotIndex = parseSlotIndexFromTag(tagName) ?? 1;
      return computeSlotImageSizePx(width ?? 0, height ?? 0, slotIndex);
    },
  });
}

// --- DB input types (Drizzle ORM format) ---

interface DbRepairWork {
  partName?: string | null;
  partType?: string | null;
  complexity?: string | null;
  price?: number | null;
  [key: string]: unknown;
}

interface DbPaintWork {
  partName?: string | null;
  paintPrice?: number | null;
  polishPrice?: number | null;
  [key: string]: unknown;
}

interface DbSparePart {
  name?: string | null;
  qty?: number | null;
  price?: number | null;
  [key: string]: unknown;
}

interface DbMaterial {
  name?: string | null;
  qty?: number | null;
  price?: number | null;
  [key: string]: unknown;
}

// --- Template output types ---

interface TemplateRepairWork {
  part_name: string;
  part_type: string;
  complexity: string;
  price: number;
}

interface TemplatePaintWork {
  part_name: string;
  paint_price: number;
  polish_price: number;
}

interface TemplateSparePart {
  name: string;
  qty: number;
  price: number;
}

interface TemplateMaterial {
  name: string;
  qty: number;
  price: number;
}

// --- Collection mapping functions ---

export function mapRepairWorks(items: DbRepairWork[]): TemplateRepairWork[] {
  return items.map((item) => ({
    part_name: item.partName ?? '',
    part_type: item.partType ?? '',
    complexity: item.complexity ?? '',
    price: item.price ?? 0,
  }));
}

export function mapPaintWorks(items: DbPaintWork[]): TemplatePaintWork[] {
  return items.map((item) => ({
    part_name: item.partName ?? '',
    paint_price: item.paintPrice ?? 0,
    polish_price: item.polishPrice ?? 0,
  }));
}

export function mapSpareParts(items: DbSparePart[]): TemplateSparePart[] {
  return items.map((item) => ({
    name: item.name ?? '',
    qty: item.qty ?? 0,
    price: item.price ?? 0,
  }));
}

export function mapMaterials(items: DbMaterial[]): TemplateMaterial[] {
  return items.map((item) => ({
    name: item.name ?? '',
    qty: item.qty ?? 0,
    price: item.price ?? 0,
  }));
}

// --- Photo_Insertion loop scope ---
//
// The legacy array-shaped `PhotoScopeEntry`/`buildPhotoScope` were removed in
// task 6.1 (R5.2). The slot-based replacement (`PhotoSlotScope` + a new
// `buildPhotoScope` returning `Promise<PhotoSlotScope>`) is wired in below
// (task 6.3) alongside the rewritten `createPhotoImageModule` (task 6.2).

/**
 * Builds the slot-based render scope for the six `{%photo_N}` and
 * `{caption_N}` placeholders of `Docx_Template_V3` from the `photos` rows
 * of `reportId`. The returned `PhotoSlotScope` always carries exactly the
 * 12 known keys (`photo_1..photo_6`, `caption_1..caption_6`); empty slots
 * are represented by `''` rather than `undefined` (P1, P3 / R5.1c, R6.2,
 * R9.4, R9.5).
 *
 * Semantics per row (covering R5.1, R6.1–R6.7, R8.1–R8.5, R9.2–R9.4):
 *
 *   * Rows are loaded via
 *     `reportRepository.listPhotosByReportIdOrderedByPosition` — `position
 *     ASC` is the only ordering signal (R6.1).
 *   * Non-integer / out-of-range `position` (∉ {1..PHOTO_SLOT_COUNT}) is
 *     silently ignored (R6.6, P5, P6).
 *   * The first row at a given `position` wins; subsequent duplicates are
 *     recorded and surfaced as a single
 *     `logger.warn('duplicate_photo_position')` per colliding position
 *     (R6.7, P15) after the main loop.
 *   * `caption_N` is assigned BEFORE the file check, so a missing or
 *     unreadable file does not erase the user's caption (R8.4, P8).
 *   * Missing `filePath` ⇒ `logger.error('photo_missing_at_render',
 *     { reason: 'no_file_path' })`; `photo_N` stays `''` (R8.3).
 *   * `fs.access(absPath, R_OK)` failure ⇒ same `photo_missing_at_render`
 *     event with `reason: err.code ?? 'unknown'`; `photo_N` stays `''`
 *     (R8.1, R8.2, P9). One bad file never blocks the other five slots
 *     (R8.5, P9).
 *   * `absPath` is `path.resolve(env.PHOTOS_DIR, path.basename(row.filePath))`
 *     — `basename` strips any directory segments smuggled into the
 *     stored path, so the resolved path cannot escape `PHOTOS_DIR`
 *     (R6.3).
 */
export async function buildPhotoScope(
  reportId: string,
): Promise<PhotoSlotScope> {
  const rows =
    await reportRepository.listPhotosByReportIdOrderedByPosition(reportId);

  const scope = emptyPhotoSlotScope();
  const seenPositions = new Set<number>();
  const duplicateGroups = new Map<number, string[]>(); // position -> photoIds

  for (const row of rows) {
    const pos = row.position;

    // R6.6 + P6: out-of-range / non-integer ignored silently.
    if (!Number.isInteger(pos) || pos < 1 || pos > PHOTO_SLOT_COUNT) {
      continue;
    }

    // R6.7 + P15: duplicate position. Repository orders by position ASC,
    // therefore the first row wins; subsequent duplicates are recorded
    // for a single aggregated warn.
    if (seenPositions.has(pos)) {
      const existing = duplicateGroups.get(pos) ?? [];
      duplicateGroups.set(pos, [...existing, row.id]);
      continue;
    }
    seenPositions.add(pos);

    // R6.4 + R8.4: caption is preserved INDEPENDENT of file availability.
    scope[`caption_${pos}` as keyof PhotoSlotScope] = row.caption ?? '';

    // R8.3: missing file_path.
    if (!row.filePath) {
      logger.error('photo_missing_at_render', {
        photoId: row.id,
        file_path: row.filePath,
        reason: 'no_file_path',
      });
      continue; // photo_N stays ''
    }

    const absPath = path.resolve(env.PHOTOS_DIR, path.basename(row.filePath));

    try {
      await fs.access(absPath, fs.constants.R_OK);
    } catch (err) {
      const reason =
        (err as NodeJS.ErrnoException | undefined)?.code ?? 'unknown';
      logger.error('photo_missing_at_render', {
        photoId: row.id,
        file_path: row.filePath,
        reason,
      });
      continue; // photo_N stays ''
    }

    scope[`photo_${pos}` as keyof PhotoSlotScope] = absPath;
  }

  // Emit one warn per duplicate-position collision (R6.7).
  for (const [position, dupIds] of duplicateGroups) {
    const winnerId = rows.find((r) => r.position === position)?.id;
    logger.warn('duplicate_photo_position', {
      reportId,
      position,
      photoIds: winnerId ? [winnerId, ...dupIds] : dupIds,
    });
  }

  return scope;
}

// --- Report data interface ---

export interface ReportData {
  expertName: string;
  reportNumber: string;
  reportDate: string;
  applicationDate: string;
  carModel: string;
  carYear: number;
  carColor: string;
  bodyType: string;
  licensePlate: string;
  ownerName: string;
  techPassport: string;
  techPassportPlace: string;
  mileage: number;
  odometerStatus: string;
  vinCode: string;
  engineNumber: string;
  transmissionType: string;
  productionStatus: string;
  analog1Mileage: number;
  analog1Price: number;
  analog2Mileage: number;
  analog2Price: number;
  analog3Mileage: number;
  analog3Price: number;
  factoryPrice: number;
  depreciationPct: number;
  marketPrice: number;
  hourlyRate: number;
  repairWorks: DbRepairWork[];
  paintWorks: DbPaintWork[];
  spareParts: DbSparePart[];
  materials: DbMaterial[];
  grandTotal: number;
  /**
   * Slot-based render scope for the six `{%photo_N}` and `{caption_N}`
   * placeholders of `Docx_Template_V3`. Replaces the legacy
   * `photos?: PhotoScopeEntry[]` (array-shaped, removed in task 6.1 per
   * R5.2). When omitted, `generateDocument` substitutes
   * `emptyPhotoSlotScope()` so the six slots render empty without leaving
   * literal `{%photo_N}` / `{caption_N}` markers in the output (R9.5).
   * Populated by `reports.service.ts` from
   * `buildPhotoScope(reportId)` (task 7.1).
   */
  photoSlots?: PhotoSlotScope;
}

// Cache template in memory after first read
let templateCache: Buffer | null = null;

async function getTemplate(): Promise<Buffer> {
  if (!templateCache) {
    const templatePath = path.join(env.TEMPLATE_DIR, 'original_example.docx');
    templateCache = await fs.readFile(templatePath);

    // Validate ZIP signature (PK\x03\x04)
    if (
      templateCache.length < 4 ||
      templateCache[0] !== 0x50 ||
      templateCache[1] !== 0x4b ||
      templateCache[2] !== 0x03 ||
      templateCache[3] !== 0x04
    ) {
      templateCache = null;
      throw new Error(`Template file is not a valid DOCX/ZIP: ${templatePath}`);
    }
  }
  return templateCache;
}

/** Clear cached template (call after template upload) */
export function invalidateTemplateCache(): void {
  templateCache = null;
}

export class DocGenerator {
  async generateDocument(data: ReportData): Promise<Buffer> {
    try {
      const content = await getTemplate();
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        // Slot-based photo image module (task 6.2). Backs the six
        // `{%photo_N}` placeholders in `Docx_Template_V3`: per-slot sizing
        // via `SLOT_SIZE_INVENTORY` and null-tolerant `getImage` for empty
        // slots. See `createPhotoImageModule` above.
        modules: [createPhotoImageModule()],
        // Non-required scalar placeholders that resolve to null/undefined
        // render as an empty string instead of leaving literal `{markers}`
        // (R5.6). Required scalars inside repeating-row groups are guarded
        // ahead of render() by precheckTables, which throws TableMapperError
        // for null/undefined/array/object cells (R5.9).
        nullGetter(part: { module?: string }): string {
          // Loop/section parts (`{#group}`) carry `part.module` and are
          // validated by precheckTables before render. Any remaining
          // unresolved scalar placeholder is non-required and renders as an
          // empty string rather than leaving a literal `{marker}` (R5.6).
          void part;
          return '';
        },
      });

      const photoSlots = data.photoSlots ?? emptyPhotoSlotScope();
      const renderData = {
        expert_name: data.expertName,
        report_number: data.reportNumber,
        report_date: data.reportDate,
        application_date: data.applicationDate,
        car_model: data.carModel,
        car_year: data.carYear,
        car_color: data.carColor,
        body_type: data.bodyType,
        license_plate: data.licensePlate,
        owner_name: data.ownerName,
        tech_passport: data.techPassport,
        tech_passport_place: data.techPassportPlace,
        mileage: data.mileage,
        odometer_status: data.odometerStatus,
        vin_code: data.vinCode,
        engine_number: data.engineNumber,
        transmission_type: data.transmissionType,
        production_status: data.productionStatus,
        analog1_mileage: data.analog1Mileage,
        analog1_price: data.analog1Price,
        analog2_mileage: data.analog2Mileage,
        analog2_price: data.analog2Price,
        analog3_mileage: data.analog3Mileage,
        analog3_price: data.analog3Price,
        factory_price: data.factoryPrice,
        depreciation_pct: data.depreciationPct,
        market_price: data.marketPrice,
        hourly_rate: data.hourlyRate,
        repair_works: mapRepairWorks(data.repairWorks),
        paint_works: mapPaintWorks(data.paintWorks),
        spare_parts: mapSpareParts(data.spareParts),
        materials: mapMaterials(data.materials),
        grand_total: data.grandTotal,
        // Slot-based photo scope (task 6.4, R5.1/R5.2/R5.3/R5.4/R5.5,
        // R9.5): spreads the 12 fixed keys `photo_1..photo_6` and
        // `caption_1..caption_6` into the render context. The
        // `createPhotoImageModule` callback resolves each `{%photo_N}`
        // against `renderData.photo_N` (absolute file path on disk or
        // `''` for an empty slot); each `{caption_N}` is a scalar string
        // that may equal `''`. The legacy `photos: data.photos ?? []`
        // array-shaped key is intentionally absent — `renderData` MUST
        // NOT carry a `photos` key going forward (R5.2).
        ...photoSlots,
      };

      // Pre-validate repeating-row groups immediately before render (R5.4, R5.9):
      // aborts with a TableMapperError without modifying the output document.
      precheckTables(renderData, [
        'repair_works',
        'paint_works',
        'spare_parts',
        'materials',
      ]);

      doc.render(renderData);

      return doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      }) as Buffer;
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Document generation error', { error, originalMessage });
      throw new Error(`Document generation error: ${originalMessage}`, {
        cause: error,
      });
    }
  }
}
