import * as fs from 'node:fs';
import * as path from 'node:path';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/logger.js';

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
  repairWorks: unknown[];
  paintWorks: unknown[];
  spareParts: unknown[];
  materials: unknown[];
  grandTotal: number;
}

export class DocGenerator {
  private templatePath: string;

  constructor() {
    this.templatePath = path.join(
      env.TEMPLATE_DIR,
      'expertise.docx',
    );
  }

  async generateDocument(data: ReportData): Promise<Buffer> {
    try {
      const content = fs.readFileSync(this.templatePath, 'binary');
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
        repair_works: data.repairWorks,
        paint_works: data.paintWorks,
        spare_parts: data.spareParts,
        materials: data.materials,
        grand_total: data.grandTotal,
      });

      return doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      }) as Buffer;
    } catch (error) {
      logger.error('Document generation error', error);
      throw new Error('Document generation error');
    }
  }
}
