/**
 * Legal Operations - Repository
 */

import { PrismaClient, Notification, AuditLog, ContractModification, Prisma } from '#prisma';
import { NotificationQuery, AuditLogQuery, ModificationQuery } from './validators.js';

export class LegalOpsRepository {
  constructor(private prisma: PrismaClient) {}

  // Notifications
  async findNotificationById(id: string): Promise<Notification | null> {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  async findNotifications(query: NotificationQuery): Promise<{ data: Notification[]; total: number }> {
    const { type, entityType, entityId, pending, page, limit } = query;
    
    const where: Prisma.NotificationWhereInput = {
      ...(type && { type }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(pending && { sentAt: null }),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total };
  }

  async createNotification(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  async markNotificationSent(id: string): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id },
      data: { sentAt: new Date() },
    });
  }

  async getPendingNotifications(): Promise<Notification[]> {
    const now = new Date();
    return this.prisma.notification.findMany({
      where: {
        sentAt: null,
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Audit Logs
  async findAuditLogs(query: AuditLogQuery): Promise<{ data: AuditLog[]; total: number }> {
    const { entityType, entityId, userId, action, fromDate, toDate, page, limit } = query;
    
    const where: Prisma.AuditLogWhereInput = {
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(userId && { userId }),
      ...(action && { action }),
      ...(fromDate && { timestamp: { gte: fromDate } }),
      ...(toDate && { timestamp: { lte: toDate } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total };
  }

  async createAuditLog(data: Prisma.AuditLogCreateInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data });
  }

  // Dashboard statistics
  async getContractStats(daysBack: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const [total, byStatus, byType, recentActivity] = await Promise.all([
      this.prisma.contract.count({ where: { deletedAt: null } }),
      this.prisma.contract.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
      this.prisma.contract.groupBy({
        by: ['type'],
        where: { deletedAt: null },
        _count: true,
      }),
      this.prisma.contractActivity.findMany({
        where: { performedAt: { gte: startDate } },
        orderBy: { performedAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      byType: Object.fromEntries(byType.map(t => [t.type, t._count])),
      recentActivity,
    };
  }

  async getMatterStats(daysBack: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const [total, byStatus, byPriority] = await Promise.all([
      this.prisma.legalMatter.count(),
      this.prisma.legalMatter.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.legalMatter.groupBy({
        by: ['priority'],
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      byPriority: Object.fromEntries(byPriority.map(p => [p.priority, p._count])),
    };
  }

  // Contract Modifications
  async findModificationById(id: string): Promise<ContractModification | null> {
    return this.prisma.contractModification.findUnique({
      where: { id },
      include: {
        contract: { select: { id: true, contractNumber: true, title: true } },
        supersedes: { select: { id: true, title: true, type: true } },
        supersededBy: { select: { id: true, title: true, type: true } },
      },
    });
  }

  async findModifications(query: ModificationQuery): Promise<{ data: ContractModification[]; total: number }> {
    const { contractId, type, status, fromDate, toDate, page, limit } = query;

    const where: Prisma.ContractModificationWhereInput = {
      ...(contractId && { contractId }),
      ...(type && { type }),
      ...(status && { status }),
      ...(fromDate && { effectiveDate: { gte: fromDate } }),
      ...(toDate && { effectiveDate: { lte: toDate } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.contractModification.findMany({
        where,
        include: {
          contract: { select: { id: true, contractNumber: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contractModification.count({ where }),
    ]);

    return { data, total };
  }

  async getNextModificationNumber(contractId: string, type: string): Promise<number> {
    const existing = await this.prisma.contractModification.count({
      where: { contractId, type: type as any },
    });
    return existing + 1;
  }

  async createModification(data: Prisma.ContractModificationCreateInput): Promise<ContractModification> {
    return this.prisma.contractModification.create({
      data,
      include: {
        contract: { select: { id: true, contractNumber: true, title: true } },
      },
    });
  }

  async updateModification(id: string, data: Prisma.ContractModificationUpdateInput): Promise<ContractModification> {
    return this.prisma.contractModification.update({
      where: { id },
      data,
      include: {
        contract: { select: { id: true, contractNumber: true, title: true } },
      },
    });
  }

  async executeModification(id: string, executedAt: Date): Promise<ContractModification> {
    return this.prisma.contractModification.update({
      where: { id },
      data: {
        status: 'EXECUTED',
        allPartiesSigned: true,
        executedAt,
      },
      include: {
        contract: { select: { id: true, contractNumber: true, title: true } },
      },
    });
  }

  async supersedeModification(id: string, supersededById: string): Promise<ContractModification> {
    return this.prisma.contractModification.update({
      where: { id },
      data: { status: 'SUPERSEDED' },
    });
  }

  async findModificationsByContract(contractId: string): Promise<ContractModification[]> {
    return this.prisma.contractModification.findMany({
      where: { contractId },
      orderBy: [{ type: 'asc' }, { modificationNumber: 'asc' }],
    });
  }
}

export function createLegalOpsRepository(prisma: PrismaClient): LegalOpsRepository {
  return new LegalOpsRepository(prisma);
}
