import { DEPRECIATION_OPTIONS } from '@/constants/reference';
import type { Step1Data, Step2Data, Step3Data, Step4Data, Step5Data } from '@/features/reports/types';

export const validateStep1 = (data: Step1Data | null | undefined): boolean => {
  if (!data) return false;

  return Boolean(
    data.expert_id &&
      data.report_number &&
      data.report_date &&
      data.application_date,
  );
};

export const validateStep2 = (data: Step2Data | null | undefined): boolean => {
  if (!data) return false;

  return Boolean(
    data.car_model &&
      data.car_year &&
      data.car_color &&
      data.body_type &&
      data.license_plate &&
      data.owner_name &&
      data.tech_passport &&
      data.mileage > 0 &&
      data.vin_code &&
      data.vin_code.length === 17 &&
      data.odometer_status &&
      data.transmission_type,
  );
};

export const validateStep3 = (data: Step3Data | null | undefined): boolean => {
  if (!data) return false;

  return Boolean(
    data.production_status &&
      data.analog1_mileage > 0 &&
      data.analog1_price > 0 &&
      data.analog2_mileage > 0 &&
      data.analog2_price > 0 &&
      data.analog3_mileage > 0 &&
      data.analog3_price > 0 &&
      DEPRECIATION_OPTIONS.includes(
        data.depreciation_pct as (typeof DEPRECIATION_OPTIONS)[number],
      ),
  );
};

export const validateStep4 = (data: Step4Data | null | undefined): boolean => {
  if (!data) return false;

  const hasValidWork = data.repair_works.some(
    (work) => work.part_name.trim().length > 0,
  );

  return data.hourly_rate > 0 && hasValidWork;
};

export const validateStep5 = (_data: Step5Data | null | undefined): boolean => {
  void _data;
  return true;
};
