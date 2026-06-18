// API Response Types
export interface LoginResponse {
  token: string;
  creator: {
    id: string;
    full_name: string;
    role: 'creator' | 'admin';
  };
}

export interface Expert {
  id: string;
  full_name: string;
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
