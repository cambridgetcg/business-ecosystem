/**
 * Legal Operations - Service Layer
 */

import { Prisma, ModificationType } from '@prisma/client';
import { LegalOpsRepository } from './repository.js';
import {
  CreateNotificationInput, NotificationQuery, AuditLogQuery, DashboardQuery,
  CreateModificationInput, UpdateModificationInput, ExecuteModificationInput, ModificationQuery
} from './validators.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export class LegalOpsService {
  private log = logger.child({ domain: 'legal-operations' });

  constructor(private repository: LegalOpsRepository) {}

  // Notifications
  async createNotification(input: CreateNotificationInput) {
    const notification = await this.repository.createNotification({
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      message: input.message,
      recipients: input.recipients,
      ...(input.scheduledFor !== undefined && { scheduledFor: input.scheduledFor }),
    });

    this.log.info({ notificationId: notification.id }, 'Notification created');
    return notification;
  }

  async listNotifications(query: NotificationQuery) {
    const { data, total } = await this.repository.findNotifications(query);
    return { data, total, page: query.page, limit: query.limit };
  }

  async markNotificationSent(id: string) {
    const notification = await this.repository.findNotificationById(id);
    if (!notification) {
      throw new NotFoundError('Notification', id);
    }

    return this.repository.markNotificationSent(id);
  }

  async getPendingNotifications() {
    return this.repository.getPendingNotifications();
  }

  async processPendingNotifications() {
    const pending = await this.getPendingNotifications();
    
    // In a real implementation, this would send emails/push notifications
    for (const notification of pending) {
      this.log.info({
        notificationId: notification.id,
        recipients: notification.recipients,
      }, 'Would send notification: ' + notification.title);
      
      await this.markNotificationSent(notification.id);
    }

    return { processed: pending.length };
  }

  // Audit Logs
  async listAuditLogs(query: AuditLogQuery) {
    const { data, total } = await this.repository.findAuditLogs(query);
    return { data, total, page: query.page, limit: query.limit };
  }

  async logAction(
    entityType: string,
    entityId: string,
    action: string,
    userId: string,
    changes?: Record<string, unknown>,
    metadata?: { userEmail?: string; ipAddress?: string; userAgent?: string }
  ) {
    return this.repository.createAuditLog({
      entityType,
      entityId,
      action,
      userId,
      changes: changes as Prisma.InputJsonValue,
      ...(metadata?.userEmail && { userEmail: metadata.userEmail }),
      ...(metadata?.ipAddress && { ipAddress: metadata.ipAddress }),
      ...(metadata?.userAgent && { userAgent: metadata.userAgent }),
    });
  }

  // Dashboard
  async getDashboard(query: DashboardQuery) {
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    const daysBack = daysMap[query.period];

    const [contracts, matters] = await Promise.all([
      this.repository.getContractStats(daysBack),
      this.repository.getMatterStats(daysBack),
    ]);

    return {
      period: query.period,
      contracts,
      matters,
    };
  }

  // Contract Modifications (Amendment/Addendum)
  async createModification(input: CreateModificationInput, userId: string) {
    // Get the next modification number for this contract and type
    const modificationNumber = await this.repository.getNextModificationNumber(
      input.contractId,
      input.type
    );

    const modification = await this.repository.createModification({
      contract: { connect: { id: input.contractId } },
      type: input.type as ModificationType,
      modificationNumber,
      title: input.title,
      effectiveDate: input.effectiveDate,
      sectionsAffected: input.sectionsAffected,
      summary: input.summary,
      ...(input.documentId !== undefined && { documentId: input.documentId }),
      ...(input.supersedesId && {
        supersedes: { connect: { id: input.supersedesId } },
      }),
      createdBy: userId,
    });

    // If this supersedes another modification, mark the old one as superseded
    if (input.supersedesId) {
      await this.repository.supersedeModification(input.supersedesId, modification.id);
    }

    this.log.info({
      modificationId: modification.id,
      contractId: input.contractId,
      type: input.type,
      number: modificationNumber,
    }, 'Contract modification created');

    return modification;
  }

  async getModification(id: string) {
    const modification = await this.repository.findModificationById(id);
    if (!modification) {
      throw new NotFoundError('ContractModification', id);
    }
    return modification;
  }

  async listModifications(query: ModificationQuery) {
    const { data, total } = await this.repository.findModifications(query);
    return { data, total, page: query.page, limit: query.limit };
  }

  async updateModification(id: string, input: UpdateModificationInput) {
    const existing = await this.repository.findModificationById(id);
    if (!existing) {
      throw new NotFoundError('ContractModification', id);
    }

    if (existing.status === 'EXECUTED') {
      throw new ValidationError('Cannot modify an executed modification');
    }

    if (existing.status === 'SUPERSEDED') {
      throw new ValidationError('Cannot modify a superseded modification');
    }

    // Filter out undefined values for Prisma strict mode
    const updateData = Object.fromEntries(
      Object.entries(input).filter(([_, v]) => v !== undefined)
    );
    const modification = await this.repository.updateModification(id, updateData);
    this.log.info({ modificationId: id }, 'Contract modification updated');
    return modification;
  }

  async executeModification(id: string, input: ExecuteModificationInput) {
    const existing = await this.repository.findModificationById(id);
    if (!existing) {
      throw new NotFoundError('ContractModification', id);
    }

    if (existing.status === 'EXECUTED') {
      throw new ValidationError('Modification is already executed');
    }

    if (existing.status === 'SUPERSEDED') {
      throw new ValidationError('Cannot execute a superseded modification');
    }

    if (existing.status === 'REJECTED') {
      throw new ValidationError('Cannot execute a rejected modification');
    }

    const executedAt = input.executedAt || new Date();
    const modification = await this.repository.executeModification(id, executedAt);

    this.log.info({
      modificationId: id,
      contractId: existing.contractId,
      type: existing.type,
      executedAt,
    }, 'Contract modification executed');

    return modification;
  }

  async getModificationHistory(contractId: string) {
    const modifications = await this.repository.findModificationsByContract(contractId);
    
    // Group by type
    const byType = modifications.reduce((acc, mod) => {
      const type = mod.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(mod);
      return acc;
    }, {} as Record<string, typeof modifications>);

    return {
      contractId,
      totalModifications: modifications.length,
      amendments: byType['AMENDMENT'] || [],
      addenda: byType['ADDENDUM'] || [],
      supplements: byType['SUPPLEMENT'] || [],
      sideLetters: byType['SIDE_LETTER'] || [],
      waivers: byType['WAIVER'] || [],
      consents: byType['CONSENT'] || [],
      novations: byType['NOVATION'] || [],
    };
  }
}

export function createLegalOpsService(repository: LegalOpsRepository): LegalOpsService {
  return new LegalOpsService(repository);
}
