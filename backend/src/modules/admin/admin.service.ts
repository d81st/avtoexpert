import path from 'node:path';
import { eq } from 'drizzle-orm';
import { badRequest, notFound } from '../../common/errors/httpError.js';
import { db } from '../../db/index.js';
import { creators, reports } from '../../db/schema.js';
import { logger } from '../../shared/logger/logger.js';
import { storageService } from '../../shared/services/storage.service.js';
import { invalidateTemplateCache } from '../reports/docGenerator.js';
import { reportRepository } from '../reports/reports.repository.js';

const TEMPLATE_FILE_NAME = 'original_example.docx';

/**
 * Roles supported by the `creators.role` column (see `db/schema.ts`). Mirrored
 * here so admin mutations can validate the requested target value without
 * touching the DB layer.
 */
const ALLOWED_ROLES = ['creator', 'admin'] as const;
export type CreatorRole = (typeof ALLOWED_ROLES)[number];

export const adminService = {
  async listAllReports(query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }) {
    return reportRepository.listReports(undefined, query);
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
      TEMPLATE_FILE_NAME,
    );

    if (!storageService.fileExists(templatePath)) {
      throw notFound('Template not found');
    }

    const stats = storageService.getFileStats(templatePath);

    return {
      exists: true,
      name: TEMPLATE_FILE_NAME,
      size: stats.size,
      lastModified: stats.mtime,
    };
  },

  /**
   * Publish a new docx template (R3 active template). Emits a structured
   * `template_publish` security log line capturing the file's size and
   * modification time before and after the write so the change is auditable
   * even though the on-disk template is not versioned in the database.
   */
  async uploadTemplate(actorUserId: string, base64Data: string) {
    const templatePath = path.join(
      storageService.getTemplatesDir(),
      TEMPLATE_FILE_NAME,
    );

    const beforeValue: Record<string, unknown> | null =
      storageService.fileExists(templatePath)
        ? (() => {
            const stats = storageService.getFileStats(templatePath);
            return {
              size: stats.size,
              last_modified: stats.mtime.toISOString(),
            };
          })()
        : null;

    const templateBuffer = Buffer.from(base64Data, 'base64');
    storageService.writeFile(templatePath, templateBuffer);
    invalidateTemplateCache();

    const afterStats = storageService.getFileStats(templatePath);
    const afterValue: Record<string, unknown> = {
      size: afterStats.size,
      last_modified: afterStats.mtime.toISOString(),
    };

    logger.info('template_publish', {
      category: 'security',
      eventType: 'template_publish',
      actorUserId,
      targetResourceId: TEMPLATE_FILE_NAME,
      beforeValue,
      afterValue,
    });

    return { message: 'Template updated successfully' };
  },

  /**
   * Change a creator's role. Emits a structured `role_change` security log
   * line with the previous and new role values. No log line is emitted when
   * the requested role matches the current value (no-op).
   */
  async updateCreatorRole(
    actorUserId: string,
    creatorId: string,
    newRole: CreatorRole,
  ) {
    if (!ALLOWED_ROLES.includes(newRole)) {
      throw badRequest('Invalid role');
    }

    const [existing] = await db
      .select({ id: creators.id, role: creators.role })
      .from(creators)
      .where(eq(creators.id, creatorId))
      .limit(1);

    if (!existing) {
      throw notFound('Creator not found');
    }

    if (existing.role === newRole) {
      return { id: existing.id, role: existing.role };
    }

    const [updated] = await db
      .update(creators)
      .set({ role: newRole })
      .where(eq(creators.id, creatorId))
      .returning({ id: creators.id, role: creators.role });

    logger.info('role_change', {
      category: 'security',
      eventType: 'role_change',
      actorUserId,
      targetResourceId: creatorId,
      beforeValue: { role: existing.role },
      afterValue: { role: updated.role },
    });

    return updated;
  },

  /**
   * Reassign the owner (`creator_id`) of a report. Emits a structured
   * `report_owner_change` security log line. No log line is emitted when the
   * new owner matches the current owner (no-op).
   */
  async changeReportOwner(
    actorUserId: string,
    reportId: string,
    newOwnerId: string,
  ) {
    const [existing] = await db
      .select({ id: reports.id, creatorId: reports.creatorId })
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!existing) {
      throw notFound('Report not found');
    }

    const [newOwner] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.id, newOwnerId))
      .limit(1);

    if (!newOwner) {
      throw notFound('Creator not found');
    }

    if (existing.creatorId === newOwnerId) {
      return { id: existing.id, creatorId: existing.creatorId };
    }

    const [updated] = await db
      .update(reports)
      .set({ creatorId: newOwnerId })
      .where(eq(reports.id, reportId))
      .returning({ id: reports.id, creatorId: reports.creatorId });

    logger.info('report_owner_change', {
      category: 'security',
      eventType: 'report_owner_change',
      actorUserId,
      targetResourceId: reportId,
      beforeValue: { creator_id: existing.creatorId },
      afterValue: { creator_id: updated.creatorId },
    });

    return updated;
  },

  /**
   * Delete a report as an administrator. Emits a structured
   * `report_deletion` security log line capturing the identifying fields of
   * the deleted row so the action remains traceable after the data is gone.
   * `afterValue` is `null` because the row no longer exists post-mutation.
   */
  async deleteReport(actorUserId: string, reportId: string) {
    const [existing] = await db
      .select({
        id: reports.id,
        creatorId: reports.creatorId,
        reportNumber: reports.reportNumber,
        status: reports.status,
      })
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!existing) {
      throw notFound('Report not found');
    }

    const [deleted] = await db
      .delete(reports)
      .where(eq(reports.id, reportId))
      .returning({ id: reports.id });

    if (!deleted) {
      throw notFound('Report not found');
    }

    logger.info('report_deletion', {
      category: 'security',
      eventType: 'report_deletion',
      actorUserId,
      targetResourceId: reportId,
      beforeValue: {
        id: existing.id,
        creator_id: existing.creatorId,
        report_number: existing.reportNumber,
        status: existing.status,
      },
      afterValue: null,
    });

    return { message: 'Report deleted' };
  },
};
