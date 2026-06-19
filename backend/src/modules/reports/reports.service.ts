import path from 'node:path';
import { badRequest } from '../../common/errors/httpError.js';
import { storageService } from '../../shared/services/storage.service.js';
import { expertService } from '../experts/experts.service.js';
import { DocGenerator } from './docGenerator.js';
import { reportRepository } from './reports.repository.js';
import type { Step4Input } from './reports.schemas.js';

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
    const expert = await expertService.verifyOwnership(creatorId, data.expert_id);
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

  async saveStep2(id: string, creatorId: string, data: Record<string, unknown>) {
    return reportRepository.saveStep2(id, creatorId, data);
  },

  async saveStep3(id: string, creatorId: string, data: Record<string, unknown>) {
    return reportRepository.saveStep3(id, creatorId, data);
  },

  async saveStep4(id: string, creatorId: string, data: Step4Input) {
    return reportRepository.saveStep4(id, creatorId, data);
  },

  async saveStep5(id: string, creatorId: string) {
    return reportRepository.saveStep5(id, creatorId);
  },

  async autosave(id: string, creatorId: string, payload: Record<string, unknown>) {
    return reportRepository.autosave(id, creatorId, payload);
  },

  async listReports(
    creatorId: string,
    query: { page: number; limit: number; search?: string; status?: string },
  ) {
    return reportRepository.listReports(creatorId, query);
  },

  async deleteReport(id: string, creatorId: string) {
    return reportRepository.deleteReport(id, creatorId);
  },

  /**
   * Validate that all required fields are filled before finalization.
   */
  validateCompleteness(report: Record<string, unknown>): string[] {
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

    return missingFields;
  },

  /**
   * Calculate all financial totals for a report.
   */
  calculateTotals(
    report: Record<string, unknown>,
    collections: {
      repairWorksList: { price: number | string | null }[];
      paintWorksList: { paintPrice: number | string | null; polishPrice: number | string | null }[];
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
   * Full finalize-and-generate workflow:
   * 1. Validate completeness
   * 2. Fetch collections
   * 3. Verify expert ownership
   * 4. Calculate totals
   * 5. Update report status
   * 6. Generate document
   * 7. Save file to disk
   */
  async finalizeAndGenerate(creatorId: string, reportId: string) {
    const report = await reportRepository.getOwnedReport(reportId, creatorId);

    // 1. Validate
    const missingFields = reportService.validateCompleteness(report);
    if (missingFields.length > 0) {
      throw badRequest('Required fields are missing', {
        missing_fields: missingFields,
      });
    }

    // 2. Fetch collections
    const collections = await reportRepository.getStep4Collections(reportId);
    if (collections.repairWorksList.length === 0) {
      throw badRequest('At least one repair work is required');
    }

    // 3. Verify expert ownership
    const expert = await reportRepository.getExpertByCreator(
      report.expertId!,
      creatorId,
    );
    if (!expert) {
      throw badRequest('Expert does not belong to current creator');
    }

    // 4. Calculate totals
    const totals = reportService.calculateTotals(report, collections);

    // 5. Update status
    await reportRepository.updateReportStatus(
      reportId,
      creatorId,
      'completed',
      totals.grandTotal,
    );

    // 6. Generate document
    const docGenerator = new DocGenerator();
    const documentBuffer = await docGenerator.generateDocument({
      expertName: expert.fullName,
      reportNumber: report.reportNumber || '',
      reportDate: new Date(report.reportDate as Date).toLocaleDateString('ru-RU'),
      applicationDate: new Date(report.applicationDate as Date).toLocaleDateString('ru-RU'),
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
    });

    // 7. Save file
    storageService.ensureDirectory(storageService.getUploadsDir());
    const filename = reportService.getGeneratedReportFilename(
      reportId,
      report.reportNumber,
    );
    const filePath = path.join(storageService.getUploadsDir(), filename);
    storageService.writeFile(filePath, documentBuffer);

    return {
      status: 'completed',
      download_url: `/api/reports/${reportId}/download`,
      filename,
      grand_total: Math.round(totals.grandTotal),
    };
  },

  /**
   * Get generated document file path for download.
   */
  async getDownloadPath(creatorId: string, reportId: string) {
    const report = await reportRepository.getOwnedReport(reportId, creatorId);

    if (report.status !== 'completed') {
      throw badRequest('Document has not been generated yet');
    }

    const filename = reportService.getGeneratedReportFilename(
      reportId,
      report.reportNumber,
    );
    const filePath = path.join(storageService.getUploadsDir(), filename);

    if (!storageService.fileExists(filePath)) {
      throw badRequest('File not found on disk');
    }

    return { filePath, filename };
  },

  // ── Photo operations ──

  async uploadPhotos(
    creatorId: string,
    reportId: string,
    files: Express.Multer.File[],
  ) {
    await reportRepository.getOwnedReport(reportId, creatorId);

    const existingPhotos = await reportRepository.listPhotos(reportId);

    if (existingPhotos.length + files.length > 10) {
      throw badRequest('Photo limit exceeded', {
        current_count: existingPhotos.length,
        uploaded_count: files.length,
      });
    }

    const savedPhotos = [];
    for (const file of files) {
      const photo = await reportRepository.insertPhoto(reportId, file.filename);
      savedPhotos.push({
        id: photo.id,
        file_path: photo.filePath,
        original_name: file.originalname,
      });
    }

    return {
      message: 'Photos uploaded',
      photos: savedPhotos,
      total_count: existingPhotos.length + files.length,
    };
  },

  async deletePhoto(creatorId: string, reportId: string, photoId: string) {
    await reportRepository.getOwnedReport(reportId, creatorId);

    const photo = await reportRepository.getPhoto(photoId, reportId);
    if (!photo) {
      throw badRequest('Photo not found');
    }

    if (photo.filePath) {
      const filePath = path.join(storageService.getPhotosDir(), photo.filePath);
      storageService.deleteFile(filePath);
    }

    await reportRepository.deletePhoto(photoId, reportId);
  },

  async listPhotos(creatorId: string, reportId: string) {
    await reportRepository.getOwnedReport(reportId, creatorId);

    const photosList = await reportRepository.listPhotos(reportId);

    return {
      photos: photosList.map((photo) => ({
        id: photo.id,
        file_path: photo.filePath,
        url: `/api/reports/${reportId}/photos/${photo.id}/file`,
        created_at: photo.createdAt,
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
