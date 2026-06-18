import type {
  Report,
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
  RepairWork,
  PaintWork,
  SparePart,
  Material,
  ReportPhoto,
} from '../types';

function field<T>(obj: Record<string, unknown>, snake: string, camel: string): T | undefined {
  return (obj[snake] ?? obj[camel]) as T | undefined;
}

function toDateString(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.split('T')[0];
  return new Date(value as string).toISOString().split('T')[0];
}

export function mapReportToStep1(report: Record<string, unknown>): Step1Data {
  return {
    expert_id: field<string>(report, 'expert_id', 'expertId') || '',
    report_number: field<string>(report, 'report_number', 'reportNumber') || '',
    report_date: toDateString(field(report, 'report_date', 'reportDate')),
    application_date: toDateString(field(report, 'application_date', 'applicationDate')),
  };
}

export function mapReportToStep2(report: Record<string, unknown>): Step2Data | null {
  const carModel = field<string>(report, 'car_model', 'carModel');
  if (!carModel) return null;

  return {
    car_model: carModel,
    car_year: field<number>(report, 'car_year', 'carYear') || new Date().getFullYear(),
    car_color: field<string>(report, 'car_color', 'carColor') || '',
    body_type: field<string>(report, 'body_type', 'bodyType') || '',
    license_plate: field<string>(report, 'license_plate', 'licensePlate') || '',
    owner_name: field<string>(report, 'owner_name', 'ownerName') || '',
    tech_passport: field<string>(report, 'tech_passport', 'techPassport') || '',
    tech_passport_place: field<string>(report, 'tech_passport_place', 'techPassportPlace'),
    mileage: field<number>(report, 'mileage', 'mileage') || 0,
    odometer_status: (field<string>(report, 'odometer_status', 'odometerStatus') as Step2Data['odometer_status']) || 'Исправен',
    mileage_by_method: field<number>(report, 'mileage_by_method', 'mileageByMethod'),
    vin_code: field<string>(report, 'vin_code', 'vinCode') || '',
    engine_number: field<string>(report, 'engine_number', 'engineNumber'),
    transmission_type: field<string>(report, 'transmission_type', 'transmissionType') || '',
    camera_model: field<string>(report, 'camera_model', 'cameraModel'),
    passport_match: field<boolean>(report, 'passport_match', 'passportMatch') ?? true,
  };
}

export function mapReportToStep3(report: Record<string, unknown>): Step3Data | null {
  const analog1Price = field<number>(report, 'analog1_price', 'analog1Price');
  if (!analog1Price) return null;

  return {
    production_status: (field<string>(report, 'production_status', 'productionStatus') as Step3Data['production_status']) || 'В производстве',
    analog1_mileage: field<number>(report, 'analog1_mileage', 'analog1Mileage') || 0,
    analog1_price: analog1Price,
    analog2_mileage: field<number>(report, 'analog2_mileage', 'analog2Mileage') || 0,
    analog2_price: field<number>(report, 'analog2_price', 'analog2Price') || 0,
    analog3_mileage: field<number>(report, 'analog3_mileage', 'analog3Mileage') || 0,
    analog3_price: field<number>(report, 'analog3_price', 'analog3Price') || 0,
    factory_price: field<number>(report, 'factory_price', 'factoryPrice'),
    depreciation_pct: field<number>(report, 'depreciation_pct', 'depreciationPct') || 90,
  };
}

function mapRepairWork(raw: Record<string, unknown>): RepairWork {
  return {
    part_name: field<string>(raw, 'part_name', 'partName') || '',
    type: (field<string>(raw, 'type', 'partType') as RepairWork['type']) || "Bo'luvchi",
    complexity: (field<string>(raw, 'complexity', 'complexity') || 'BT-1') as RepairWork['complexity'],
    price: field<number>(raw, 'price', 'price') || 0,
  };
}

function mapPaintWork(raw: Record<string, unknown>): PaintWork {
  return {
    part_name: field<string>(raw, 'part_name', 'partName') || '',
    paint_price: field<number>(raw, 'paint_price', 'paintPrice') || 0,
    polish_price: field<number>(raw, 'polish_price', 'polishPrice') || 0,
  };
}

function mapSparePart(raw: Record<string, unknown>): SparePart {
  return {
    name: field<string>(raw, 'name', 'name') || '',
    qty: field<number>(raw, 'qty', 'qty') || 1,
    price: field<number>(raw, 'price', 'price') || 0,
  };
}

function mapMaterial(raw: Record<string, unknown>): Material {
  return {
    name: field<string>(raw, 'name', 'name') || '',
    qty: field<number>(raw, 'qty', 'qty') || 1,
    price: field<number>(raw, 'price', 'price') || 0,
  };
}

export function mapReportToStep4(report: Record<string, unknown>): Step4Data | null {
  const hourlyRate = field<number>(report, 'hourly_rate', 'hourlyRate');
  if (!hourlyRate) return null;

  const repairWorks = (report.repair_works as Record<string, unknown>[] | undefined)?.map(mapRepairWork) || [];
  const paintWorks = (report.paint_works as Record<string, unknown>[] | undefined)?.map(mapPaintWork) || [];
  const spareParts = (report.spare_parts as Record<string, unknown>[] | undefined)?.map(mapSparePart) || [];
  const materials = (report.materials as Record<string, unknown>[] | undefined)?.map(mapMaterial) || [];

  return {
    hourly_rate: hourlyRate,
    repair_works: repairWorks,
    paint_works: paintWorks,
    spare_parts: spareParts,
    materials: materials,
  };
}

export function mapPhotosToStep5(photos: ReportPhoto[]): Step5Data {
  return { photos };
}

export function hydrateFormFromReport(report: Record<string, unknown>): {
  step1: Step1Data;
  step2: Step2Data | null;
  step3: Step3Data | null;
  step4: Step4Data | null;
  step5: Step5Data;
  currentStep: number;
} {
  return {
    step1: mapReportToStep1(report),
    step2: mapReportToStep2(report),
    step3: mapReportToStep3(report),
    step4: mapReportToStep4(report),
    step5: { photos: [] },
    currentStep: field<number>(report, 'current_step', 'currentStep') || 1,
  };
}

export function toApiStep2(data: Step2Data): Record<string, unknown> {
  return {
    carModel: data.car_model,
    carYear: data.car_year,
    carColor: data.car_color,
    bodyType: data.body_type,
    licensePlate: data.license_plate,
    ownerName: data.owner_name,
    techPassport: data.tech_passport,
    techPassportPlace: data.tech_passport_place,
    mileage: data.mileage,
    odometerStatus: data.odometer_status,
    mileageByMethod: data.mileage_by_method,
    vinCode: data.vin_code,
    engineNumber: data.engine_number,
    transmissionType: data.transmission_type,
    cameraModel: data.camera_model,
    passportMatch: data.passport_match,
  };
}

export function toApiStep3(data: Step3Data): Record<string, unknown> {
  return {
    productionStatus: data.production_status,
    analog1Mileage: data.analog1_mileage,
    analog1Price: data.analog1_price,
    analog2Mileage: data.analog2_mileage,
    analog2Price: data.analog2_price,
    analog3Mileage: data.analog3_mileage,
    analog3Price: data.analog3_price,
    factoryPrice: data.factory_price,
    depreciationPct: data.depreciation_pct,
  };
}

export function toApiStep4(data: Step4Data): Record<string, unknown> {
  return {
    hourly_rate: data.hourly_rate,
    repair_works: data.repair_works.map((work) => ({
      part_name: work.part_name,
      type: work.type,
      complexity: work.complexity,
      price: work.price,
    })),
    paint_works: data.paint_works.map((work) => ({
      part_name: work.part_name,
      paint_price: work.paint_price,
      polish_price: work.polish_price,
    })),
    spare_parts: data.spare_parts,
    materials: data.materials,
  };
}

export function toApiAutosave(params: {
  step2?: Step2Data | null;
  step3?: Step3Data | null;
  step4?: Step4Data | null;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (params.step2) {
    Object.assign(payload, toApiStep2(params.step2));
  }
  if (params.step3) {
    Object.assign(payload, toApiStep3(params.step3));
  }
  if (params.step4) {
    Object.assign(payload, toApiStep4(params.step4));
  }

  return payload;
}

export function normalizeReport(report: Record<string, unknown>): Report {
  return {
    id: field<string>(report, 'id', 'id') || '',
    status: (field<string>(report, 'status', 'status') as Report['status']) || 'draft',
    current_step: field<number>(report, 'current_step', 'currentStep') || 1,
    expert_id: field<string>(report, 'expert_id', 'expertId') || '',
    report_number: field<string>(report, 'report_number', 'reportNumber') || '',
    report_date: toDateString(field(report, 'report_date', 'reportDate')),
    application_date: toDateString(field(report, 'application_date', 'applicationDate')),
    created_at: toDateString(field(report, 'created_at', 'createdAt')),
    updated_at: toDateString(field(report, 'updated_at', 'updatedAt')),
  };
}
