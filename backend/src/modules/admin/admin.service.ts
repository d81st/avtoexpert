import path from 'node:path';
import { eq } from 'drizzle-orm';
import { notFound } from '../../common/errors/httpError.js';
import { db } from '../../db/index.js';
import { creators, reports } from '../../db/schema.js';
import { reportRepository } from '../reports/reports.repository.js';
import { storageService } from '../../shared/services/storage.service.js';

export const adminService = {
  async listAllReports(query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }) {
    return reportRepository.listReportsAdmin(query);
  },

  async getReportDetails(reportId: string) {
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!report) {
      throw notFound('Report not found');
    }

    const [creator] = await db
      .select({ id: creators.id, fullName: creators.fullName })
      .from(creators)
      .where(eq(creators.id, report.creatorId))
      .limit(1);

    return { ...report, creator };
  },

  async listCreators() {
    return db
      .select({
        id: creators.id,
        fullName: creators.fullName,
        role: creators.role,
        createdAt: creators.createdAt,
      })
      .from(creators);
  },

  async getTemplateInfo() {
    const templatePath = path.join(
      storageService.getTemplatesDir(),
      'expertise.docx',
    );

    if (!storageService.fileExists(templatePath)) {
      throw notFound('Template not found');
    }

    const stats = storageService.getFileStats(templatePath);

    return {
      exists: true,
      name: 'expertise.docx',
      size: stats.size,
      lastModified: stats.mtime,
    };
  },

  async uploadTemplate(base64Data: string) {
    const templatePath = path.join(
      storageService.getTemplatesDir(),
      'expertise.docx',
    );

    const templateBuffer = Buffer.from(base64Data, 'base64');
    storageService.writeFile(templatePath, templateBuffer);

    return { message: 'Template updated successfully' };
  },
};
