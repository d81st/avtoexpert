export interface Expert {
  id: string;
  full_name: string;
}

export interface ExpertsQueryParams {
  search?: string;
}

export interface Report {
  id: string;
  status: 'draft' | 'completed';
  current_step: number;
  expert_id: string;
  report_number: string;
  report_date: string;
  application_date: string;
  created_at: string;
  updated_at: string;
}

export interface Step1Data {
  expert_id: string;
  report_number: string;
  report_date: string;
  application_date: string;
}

export interface Step2Data {
  car_model: string;
  car_year: number;
  car_color: string;
  body_type: string;
  license_plate: string;
  owner_name: string;
  tech_passport: string;
  tech_passport_place?: string;
  mileage: number;
  odometer_status: 'Исправен' | 'Неисправен';
  mileage_by_method?: number;
  vin_code: string;
  engine_number?: string;
  transmission_type: string;
  camera_model?: string;
  passport_match: boolean;
}

export interface Step3Data {
  production_status: 'В производстве' | 'Снят с производства';
  analog1_mileage: number;
  analog1_price: number;
  analog2_mileage: number;
  analog2_price: number;
  analog3_mileage: number;
  analog3_price: number;
  factory_price?: number;
  depreciation_pct: number;
}

export interface RepairWork {
  part_name: string;
  type: "Bo'luvchi" | "Bo'lmaydigan";
  complexity: 'BT-1' | 'BT-2' | 'BT-3';
  price: number;
}

export interface PaintWork {
  part_name: string;
  paint_price: number;
  polish_price: number;
}

export interface SparePart {
  name: string;
  qty: number;
  price: number;
}

export interface Material {
  name: string;
  qty: number;
  price: number;
}

export interface Step4Data {
  hourly_rate: number;
  repair_works: RepairWork[];
  paint_works: PaintWork[];
  spare_parts: SparePart[];
  materials: Material[];
}

export interface ReportPhoto {
  id: string;
  url: string;
  file_path?: string;
  /**
   * Immutable server-assigned upload ordinal within a report (R4.6). Present on
   * the upload (`POST`) response and surfaced by `GET /api/reports/:id/photos`
   * until task 19.8 switches the GET sort key to `position`; used as the
   * thumbnail label and as a deterministic fallback ordering before `position`
   * is populated by the server payload.
   */
  sequence_number?: number;
  /**
   * User-provided caption text (R8.1). Length is bounded by the server at
   * 200 Unicode code points after NFC normalisation; `null` (or missing)
   * indicates no caption has been set yet.
   */
  caption?: string | null;
  /**
   * 1-based display position within a report (R8.2). Allocated at upload time
   * to the next free slot in `[1, 20]` and mutated by `PATCH … { position }`
   * (R8.4). Surfaced by `GET /api/reports/:id/photos` from task 19.8 onward,
   * used as the primary ordering key when present.
   */
  position?: number;
}

export interface Step5Data {
  photos: ReportPhoto[];
}

export interface FinalizeResponse {
  status: string;
  download_url: string;
  filename?: string;
  grand_total: number;
}
