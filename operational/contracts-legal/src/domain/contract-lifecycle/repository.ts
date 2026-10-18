/**
 * Contract Lifecycle - Repository
 *
 * Data access layer for lifecycle operations
 */

import { PrismaClient, Contract, ContractActivity, Obligation, Prisma } from '@prisma/client';
import type { LifecycleStatus, ExpirationQuery, ContractHealth } from './validators.js';

export type ContractWithRelations = Contract & {
  obligations: Obligation[];
  activities: ContractActivity[];
};

export type ExpiringContract = Contract & {
  daysUntilExpiry: number;
};

export class LifecycleRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<ContractWithRelations | null> {
    return this.prisma.contract.findUnique({
      where: { id },
      include: {
        obligations: true,
        activities: {
          orderBy: { performedAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async updateStatus(
    id: string,
    status: LifecycleStatus,
    userId: string,
    additionalData?: Partial<Prisma.ContractUpdateInput>
  ): Promise<Contract> {
    return this.prisma.contract.update({
      where: { id },
      data: {
        status,
        updatedBy: userId,
        ...additionalData,
      },
    });
  }

  async recordActivity(
    contractId: string,
    type: string,
    description: string,
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<ContractActivity> {
    return this.prisma.contractActivity.create({
      data: {
        contractId,
        type: type as Prisma.ContractActivityCreateInput['type'],
        description,
        performedBy: userId,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async findExpiring(query: ExpirationQuery): Promise<ExpiringContract[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + query.daysAhead);

    const contracts = await this.prisma.contract.findMany({
      where: {
        status: query.status ?? 'ACTIVE',
        deletedAt: null,
        expiryDate: {
          lte: futureDate,
          gte: new Date(),
        },
        ...(query.includeAutoRenewal === false && { autoRenewal: false }),
      },
      orderBy: { expiryDate: 'asc' },
    });

    return contracts.map((contract) => ({
      ...contract,
      daysUntilExpiry: contract.expiryDate
        ? Math.ceil((contract.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0,
    }));
  }

  async findForRenewal(daysAhead: number = 30): Promise<Contract[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.prisma.contract.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        expiryDate: {
          lte: futureDate,
          gte: new Date(),
        },
        OR: [
          { autoRenewal: true },
          { renewalTermDays: { not: null } },
        ],
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async findExpired(): Promise<Contract[]> {
    return this.prisma.contract.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        expiryDate: { lt: new Date() },
      },
    });
  }

  async renewContract(
    id: string,
    newExpiryDate: Date,
    userId: string,
    updates?: Partial<Prisma.ContractUpdateInput>
  ): Promise<Contract> {
    return this.prisma.contract.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        expiryDate: newExpiryDate,
        updatedBy: userId,
        ...updates,
      },
    });
  }

  async getContractHealth(id: string): Promise<ContractHealth | null> {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        obligations: {
          where: {
            status: 'OVERDUE',
          },
        },
      },
    });

    if (!contract) return null;

    const now = new Date();
    const daysUntilExpiry = contract.expiryDate
      ? Math.ceil((contract.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const overdueCount = contract.obligations.length;
    const renewalNoticeDays = contract.renewalNoticeDays;
    const renewalWindowOpen =
      daysUntilExpiry !== null &&
      renewalNoticeDays !== null &&
      daysUntilExpiry <= renewalNoticeDays;

    let healthScore: 'HEALTHY' | 'ATTENTION' | 'CRITICAL' = 'HEALTHY';
    if (overdueCount > 0 || (daysUntilExpiry !== null && daysUntilExpiry < 7)) {
      healthScore = 'CRITICAL';
    } else if (renewalWindowOpen || (daysUntilExpiry !== null && daysUntilExpiry < 30)) {
      healthScore = 'ATTENTION';
    }

    return {
      contractId: contract.id,
      status: contract.status as LifecycleStatus,
      daysUntilExpiry,
      hasOverdueObligations: overdueCount > 0,
      overdueObligationCount: overdueCount,
      renewalEligible:
        (contract.status === 'ACTIVE' || contract.status === 'EXPIRED') &&
        contract.renewalTermDays !== null,
      autoRenewalEnabled: contract.autoRenewal,
      renewalNoticeDays,
      renewalWindowOpen,
      healthScore,
    };
  }

  async bulkUpdateExpired(userId: string): Promise<number> {
    const result = await this.prisma.contract.updateMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        expiryDate: { lt: new Date() },
        autoRenewal: false,
      },
      data: {
        status: 'EXPIRED',
        updatedBy: userId,
      },
    });

    return result.count;
  }

  async getActivityHistory(
    contractId: string,
    limit: number = 50
  ): Promise<ContractActivity[]> {
    return this.prisma.contractActivity.findMany({
      where: { contractId },
      orderBy: { performedAt: 'desc' },
      take: limit,
    });
  }

  async getContractsByStatus(status: LifecycleStatus): Promise<Contract[]> {
    return this.prisma.contract.findMany({
      where: {
        status,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getStatusCounts(): Promise<Record<string, number>> {
    const counts = await this.prisma.contract.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: true,
    });

    return counts.reduce(
      (acc, { status, _count }) => {
        acc[status] = _count;
        return acc;
      },
      {} as Record<string, number>
    );
  }
}

export function createLifecycleRepository(prisma: PrismaClient): LifecycleRepository {
  return new LifecycleRepository(prisma);
}
