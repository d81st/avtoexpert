import { describe, expect, it } from 'vitest';
import { reportService } from './reports.service.js';

/**
 * Minimal valid report row (all required scalar placeholders satisfied) used as
 * the baseline for completeness checks. Field names match the DB column camelCase
 * keys consumed by `validateCompleteness`.
 */
function completeReport(): Record<string, unknown> {
  return {
    expertId: 'expert-1',
    reportNumber: 'R-001',
    reportDate: new Date('2026-01-01'),
    applicationDate: new Date('2026-01-01'),
    carModel: 'Lada',
    carYear: 2020,
    carColor: 'white',
    bodyType: 'sedan',
    licensePlate: 'A001AA',
    ownerName: 'Ivanov',
    techPassport: 'TP-1',
    mileage: 1000,
    odometerStatus: 'ok',
    vinCode: 'VIN123',
    productionStatus: 'serial',
    analog1Mileage: 1,
    analog1Price: 1,
    analog2Mileage: 1,
    analog2Price: 1,
    analog3Mileage: 1,
    analog3Price: 1,
    depreciationPct: 10,
    hourlyRate: 500,
  };
}

describe('reportService.validateCompleteness', () => {
  it('returns no missing fields for a fully populated report (scalars only)', () => {
    expect(reportService.validateCompleteness(completeReport())).toEqual([]);
  });

  it('reports missing required scalar placeholders', () => {
    const report = completeReport();
    report.vinCode = '';
    report.mileage = null;
    const missing = reportService.validateCompleteness(report);
    expect(missing).toContain('vin_code');
    expect(missing).toContain('mileage');
  });

  it('flags an empty required repair_works group when collections are provided', () => {
    const missing = reportService.validateCompleteness(completeReport(), {
      repairWorksList: [],
    });
    expect(missing).toEqual(['repair_works']);
  });

  it('does not flag repair_works when at least one row exists', () => {
    const missing = reportService.validateCompleteness(completeReport(), {
      repairWorksList: [{ price: 100 }],
    });
    expect(missing).toEqual([]);
  });

  it('aggregates missing scalars and the empty required group into one list', () => {
    const report = completeReport();
    report.expertId = null;
    const missing = reportService.validateCompleteness(report, {
      repairWorksList: [],
    });
    expect(missing).toContain('expert_id');
    expect(missing).toContain('repair_works');
  });

  it('omits repair_works check when collections are not provided', () => {
    expect(reportService.validateCompleteness(completeReport())).toEqual([]);
  });
});
