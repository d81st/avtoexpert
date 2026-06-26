import { readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { imageSize } from 'image-size';
import PizZip from 'pizzip';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/logger.js';
import { reportRepository } from './reports.repository.js';
import { precheckTables } from './tableMapper.js';

// --- Photo_Insertion image sizing (R4.8, design §3.8) ---

/**
 * Maximum rendered image width, expressed in EMU (English Metric Units), equal
 * to the page text-area width of **14 cm** (≈ 5_300_000 EMU). The Photo_Insertion
 * image module bounds every `{%image}` to this width while preserving aspect
 * ratio (R4.8 / design §3.4, §3.8).
 */
export const MAX_IMAGE_WIDTH_EMU = 5_300_000;

/**
 * EMU per pixel at 96 DPI (914400 EMU/inch ÷ 96 px/inch). The image module's
 * `getSize` callback returns dimensions in **pixels**; the module multiplies by
 * this factor internally to emit the `<wp:extent>` EMU values. We therefore
 * express the 14 cm bound as a pixel width here.
 */
const EMU_PER_PIXEL = 9525;

/** The 14 cm width bound converted to whole pixels for `getSize`. */
export const MAX_IMAGE_WIDTH_PX = Math.floor(MAX_IMAGE_WIDTH_EMU / EMU_PER_PIXEL);

/**
 * Bounds a source image's pixel dimensions so that its width does not exceed
 * {@link MAX_IMAGE_WIDTH_PX} (the 14 cm text-area width, R4.8), preserving the
 * original aspect ratio. Images already narrower than the bound are returned
 * unchanged (no upscaling). Non-finite or non-positive inputs fall back to a
 * square at the maximum width so a malformed dimension read can never produce a
 * zero/NaN `<wp:extent>`.
 */
export function computeImageSizePx(
  srcWidth: number,
  srcHeight: number,
): [number, number] {
  if (
    !Number.isFinite(srcWidth) ||
    !Number.isFinite(srcHeight) ||
    srcWidth <= 0 ||
    srcHeight <= 0
  ) {
    return [MAX_IMAGE_WIDTH_PX, MAX_IMAGE_WIDTH_PX];
  }

  if (srcWidth <= MAX_IMAGE_WIDTH_PX) {
    return [Math.round(srcWidth), Math.round(srcHeight)];
  }

  const ratio = MAX_IMAGE_WIDTH_PX / srcWidth;
  return [MAX_IMAGE_WIDTH_PX, Math.max(1, Math.round(srcHeight * ratio))];
}

/**
 * Builds the Photo_Insertion image module that backs the `{%image}` tag inside
 * the `{#photos}…{/photos}` Photo_Insertion_Block (design §3.8, R8.11). The
 * `{#photos}` loop scope wiring (`buildPhotoScope`) lands in tasks 9.2 / 19.9;
 * this factory only configures the module so it is ready to attach.
 *
 *   - `centered: false` — `{%image}` renders left-aligned (R8.11);
 *   - `getImage` — path mode: `tagValue` is an absolute filesystem path to the
 *     Normalized_Image bytes (§3.8); read synchronously so `getSize` stays
 *     synchronous and `doc.render()` need not switch to the async API;
 *   - `getSize` — reads the decoded pixel dimensions and bounds the width to
 *     14 cm preserving aspect ratio via {@link computeImageSizePx} (R4.8).
 */
export function createPhotoImageModule(): ImageModule {
  return new ImageModule({
    centered: false,
    fileType: 'docx',
    getImage(tagValue: string): Buffer {
      // Path mode (§3.8): tagValue is an absolute path to the Normalized_Image.
      return readFileSync(tagValue);
    },
    getSize(img: Buffer | Uint8Array): [number, number] {
      const { width, height } = imageSize(img);
      return computeImageSizePx(width ?? 0, height ?? 0);
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

// --- Photo_Insertion loop scope (R4.8, R4.9 / R8.11–R8.14, design §3.8) ---

/**
 * A single entry of the `{#photos}…{/photos}` Photo_Insertion_Block render
 * scope (design §3.8, Requirement 8.12). Each entry backs exactly one loop
 * iteration in `Docx_Template_V2`:
 *
 *   - `image` — pointer to the Normalized_Image consumed by the
 *     {@link createPhotoImageModule} `{%image}` tag. In production this is an
 *     absolute filesystem path (path mode, §3.8); the image module reads the
 *     bytes synchronously via `getImage`.
 *   - `caption` — the Photo_Caption literal substituted into `{caption}`.
 *     A `null` caption MUST be passed as an empty string `''` (R8.12); the
 *     `Фото N:` prefix lives in the template literal text and is NOT included
 *     here (it must not be duplicated by the generator).
 *
 * The array is expected to be pre-sorted by Photo_Position ascending. The
 * production source of this array is `buildPhotoScope(reportId)` (task 19.9,
 * not implemented here); `generateDocument` only consumes whatever scope it is
 * handed and renders zero iterations for an empty/absent array.
 */
export interface PhotoScopeEntry {
  image: string;
  caption: string;
}

/**
 * Builds the `{#photos}…{/photos}` Photo_Insertion_Block render scope for the
 * report identified by `reportId`. Returns one {@link PhotoScopeEntry} per
 * readable Photo_Asset, ordered by Photo_Position ascending (R8.10 / R8.12).
 *
 * For each photo row:
 *   - `image` resolves to an absolute filesystem path under {@link env.PHOTOS_DIR}
 *     (path mode consumed by `createPhotoImageModule`'s `getImage`); `path.basename`
 *     is applied to `file_path` first so a row that somehow carries a directory
 *     segment cannot escape `PHOTOS_DIR`.
 *   - `caption` carries the user-supplied Photo_Caption with `null` collapsed
 *     to the empty string `''` (R8.12). The literal `Фото N:` prefix lives in
 *     the template; the generator MUST NOT duplicate it here.
 *
 * R8.14 fallback: a file that fails the `fs.access(..., R_OK)` readability
 * check is dropped from the scope (the loop iteration for that photo never
 * runs) and a structured `photo_missing_at_render` `logger.error` entry is
 * emitted with `{ photoId, file_path, reason }`. A single unreadable file
 * degrades the document by exactly one photo without aborting rendering for
 * the remaining `k-1` photos — `buildPhotoScope` MUST NOT throw on a missing
 * file.
 *
 * R8.13 corollary: when the report has no Photo_Asset rows (or every row is
 * unreadable), the function returns `[]`, which renders zero loop iterations
 * in docxtemplater and leaves no `<w:drawing>` / `<w:p>` caption paragraph in
 * `word/document.xml`.
 */
export async function buildPhotoScope(
  reportId: string,
): Promise<PhotoScopeEntry[]> {
  const rows =
    await reportRepository.listPhotosByReportIdOrderedByPosition(reportId);

  const scope: PhotoScopeEntry[] = [];
  for (const row of rows) {
    // Defensive: `photos.file_path` is schema-nullable. A row without a path
    // cannot be rendered, so log and skip it like any other unreadable photo.
    if (!row.filePath) {
      logger.error('photo_missing_at_render', {
        photoId: row.id,
        file_path: row.filePath,
        reason: 'no_file_path',
      });
      continue;
    }

    const absPath = path.resolve(env.PHOTOS_DIR, path.basename(row.filePath));

    try {
      // Pre-read once here to fail fast and emit a structured log entry for
      // missing/unreadable files (R8.14). The image module would otherwise
      // attempt `fs.readFileSync(absPath)` deep inside `doc.render()` and
      // abort the whole document.
      await fs.access(absPath, fs.constants.R_OK);
    } catch (err) {
      const reason =
        (err as NodeJS.ErrnoException | undefined)?.code ?? 'unknown';
      logger.error('photo_missing_at_render', {
        photoId: row.id,
        file_path: row.filePath,
        reason,
      });
      continue; // R8.14: skip this single photo, keep rendering the rest.
    }

    scope.push({
      image: absPath,
      caption: row.caption ?? '', // R8.12: null caption → empty string.
    });
  }

  return scope;
}

// --- Report data interface ---

interface ReportData {
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
   * Optional `{#photos}…{/photos}` Photo_Insertion_Block render scope (R4.8,
   * R4.9 / R8.11–R8.14). Each entry is a `{ image, caption }` pair feeding one
   * loop iteration; the array MUST be pre-sorted by Photo_Position ascending.
   * Defaults to an empty array, which renders zero photo iterations. The
   * production source is `buildPhotoScope(reportId)` (task 19.9), which will
   * populate this field; until then callers may omit it.
   */
  photos?: PhotoScopeEntry[];
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
        // Photo_Insertion image module backing the `{%image}` tag inside the
        // `{#photos}…{/photos}` Photo_Insertion_Block (design §3.8, R4.8/R8.11).
        // Attaching it is harmless when the template has no image tags: the
        // module only acts on `{%image}` placeholders.
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
        // `{#photos}…{/photos}` Photo_Insertion_Block scope (R4.8, R4.9 /
        // R8.11–R8.14, design §3.8). Each `{ image, caption }` entry drives one
        // loop iteration; the registered Photo_Insertion image module
        // (createPhotoImageModule) backs the `{%image}` tag inside the loop and
        // `{caption}` renders the literal caption. An empty/absent array yields
        // zero iterations. The production source of this scope is
        // buildPhotoScope(reportId) (task 19.9); the slot-based photo_1..photo_N
        // mapping and the legacy `photo_skipped_in_doc` slot-overflow audit hook
        // are intentionally NOT emitted here.
        photos: data.photos ?? [],
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
