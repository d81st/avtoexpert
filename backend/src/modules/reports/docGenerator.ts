import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/logger.js';

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
}

// Cache template in memory after first read
let templateCache: Buffer | null = null;

async function getTemplate(): Promise<Buffer> {
  if (!templateCache) {
    const templatePath = path.join(env.TEMPLATE_DIR, 'expertise.docx');
    templateCache = await fs.readFile(templatePath);
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
      });

      doc.render({
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
      });

      return doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      }) as Buffer;
    } catch (error) {
      const originalMessage = error instanceof Error ? error.message : String(error);
      logger.error('Document generation error', { error, originalMessage });
      throw new Error(`Document generation error: ${originalMessage}`, { cause: error });
    }
  }
}
