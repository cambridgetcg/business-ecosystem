/**
 * Revenue Recognition Service (ASC 606)
 * 
 * Manages performance obligations and milestone tracking for ASC 606 compliance.
 * Revenue recognized when (or as) performance obligations are satisfied.
 */

import {
  PrismaClient,
  PerformanceObligation,
  Milestone,
  TimingType,
  MeasurementMethod,
  POStatus,
  MilestoneStatus,
  RevRecMethod,
  Prisma
} from '@prisma/client';
import { logger } from '../../../lib/logger.js';
import { NotFoundError, ValidationError } from '../../../lib/errors.js';

export interface CreatePerformanceObligationInput {
  contractId: string;
  name: string;
  description: string;
  satisfactionTiming: TimingType;
  standalonePrice?: number | undefined;
  allocatedPrice: number;
  currency?: string | undefined;
  measurementMethod?: MeasurementMethod | undefined;
}

export interface CreateMilestoneInput {
  performanceObligationId: string;
  name: string;
  description: string;
  percentOfObligation: number;
  targetDate?: Date | undefined;
}

export interface PerformanceObligationQuery {
  contractId?: string | undefined;
  status?: POStatus | undefined;
  satisfactionTiming?: TimingType | undefined;
  page: number;
  limit: number;
}

export class RevenueRecognitionService {
  private log = logger.child({ service: 'revenue-recognition' });

  constructor(private prisma: PrismaClient) {}

  // ============================================================================
  // Performance Obligation Management
  // ============================================================================

  async createPerformanceObligation(input: CreatePerformanceObligationInput): Promise<PerformanceObligation> {
    const createData: Prisma.PerformanceObligationCreateInput = {
      contract: { connect: { id: input.contractId } },
      name: input.name,
      description: input.description,
      satisfactionTiming: input.satisfactionTiming,
      allocatedPrice: input.allocatedPrice,
      currency: input.currency || 'USD',
      status: 'NOT_STARTED',
    };

    if (input.standalonePrice) createData.standalonePrice = input.standalonePrice;
    if (input.measurementMethod) createData.measurementMethod = input.measurementMethod;

    const po = await this.prisma.performanceObligation.create({ data: createData });

    this.log.info({
      poId: po.id,
      contractId: input.contractId,
      name: input.name,
      timing: input.satisfactionTiming,
    }, 'Performance obligation created');

    return po;
  }

  async getPerformanceObligation(id: string): Promise<PerformanceObligation & { milestones: Milestone[] }> {
    const po = await this.prisma.performanceObligation.findUnique({
      where: { id },
      include: {
        contract: { select: { id: true, contractNumber: true, title: true } },
        milestones: { orderBy: { percentOfObligation: 'asc' } },
      },
    });

    if (!po) throw new NotFoundError('PerformanceObligation', id);
    return po;
  }

  async listPerformanceObligations(query: PerformanceObligationQuery) {
    const where: Prisma.PerformanceObligationWhereInput = {};
    
    if (query.contractId) where.contractId = query.contractId;
    if (query.status) where.status = query.status;
    if (query.satisfactionTiming) where.satisfactionTiming = query.satisfactionTiming;

    const [data, total] = await Promise.all([
      this.prisma.performanceObligation.findMany({
        where,
        include: {
          contract: { select: { id: true, contractNumber: true, title: true } },
          milestones: { select: { id: true, name: true, status: true, percentOfObligation: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.performanceObligation.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async startPerformanceObligation(id: string): Promise<PerformanceObligation> {
    const po = await this.getPerformanceObligation(id);

    if (po.status !== 'NOT_STARTED') {
      throw new ValidationError('Performance obligation has already started');
    }

    const updated = await this.prisma.performanceObligation.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });

    this.log.info({ poId: id }, 'Performance obligation started');
    return updated;
  }

  async updateProgress(id: string, percentComplete: number): Promise<PerformanceObligation> {
    const po = await this.getPerformanceObligation(id);

    if (po.satisfactionTiming !== 'OVER_TIME') {
      throw new ValidationError('Progress tracking only applies to OVER_TIME obligations');
    }

    if (percentComplete < 0 || percentComplete > 100) {
      throw new ValidationError('Percent complete must be between 0 and 100');
    }

    // Calculate revenue to recognize based on progress
    const allocatedPrice = Number(po.allocatedPrice);
    const previousRecognized = Number(po.revenueRecognized || 0);
    const currentRecognition = (allocatedPrice * percentComplete / 100) - previousRecognized;

    const updated = await this.prisma.performanceObligation.update({
      where: { id },
      data: {
        percentComplete,
        revenueRecognized: allocatedPrice * percentComplete / 100,
        status: percentComplete >= 100 ? 'SATISFIED' : 'IN_PROGRESS',
        ...(percentComplete >= 100 && { satisfiedAt: new Date() }),
      },
    });

    this.log.info({
      poId: id,
      percentComplete,
      incrementalRevenue: currentRecognition,
    }, 'Performance obligation progress updated');

    return updated;
  }

  async satisfyObligation(id: string): Promise<PerformanceObligation> {
    const po = await this.getPerformanceObligation(id);

    if (po.status === 'SATISFIED') {
      throw new ValidationError('Performance obligation is already satisfied');
    }

    if (po.status === 'CANCELLED') {
      throw new ValidationError('Cannot satisfy a cancelled obligation');
    }

    const updated = await this.prisma.performanceObligation.update({
      where: { id },
      data: {
        status: 'SATISFIED',
        satisfiedAt: new Date(),
        percentComplete: 100,
        revenueRecognized: po.allocatedPrice,
      },
    });

    this.log.info({
      poId: id,
      revenueRecognized: po.allocatedPrice,
    }, 'Performance obligation satisfied');

    return updated;
  }

  // ============================================================================
  // Milestone Management
  // ============================================================================

  async createMilestone(input: CreateMilestoneInput): Promise<Milestone> {
    const po = await this.getPerformanceObligation(input.performanceObligationId);

    // Validate total percentage doesn't exceed 100%
    const existingTotal = po.milestones.reduce(
      (sum, m) => sum + Number(m.percentOfObligation),
      0
    );

    if (existingTotal + input.percentOfObligation > 100) {
      throw new ValidationError(
        `Adding ${input.percentOfObligation}% would exceed 100% (current: ${existingTotal}%)`
      );
    }

    const createData: Prisma.MilestoneCreateInput = {
      performanceObligation: { connect: { id: input.performanceObligationId } },
      name: input.name,
      description: input.description,
      percentOfObligation: input.percentOfObligation,
      status: 'PENDING',
    };

    if (input.targetDate) createData.targetDate = input.targetDate;

    const milestone = await this.prisma.milestone.create({ data: createData });

    this.log.info({
      milestoneId: milestone.id,
      poId: input.performanceObligationId,
      name: input.name,
      percent: input.percentOfObligation,
    }, 'Milestone created');

    return milestone;
  }

  async getMilestone(id: string): Promise<Milestone> {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id },
      include: {
        performanceObligation: {
          include: {
            contract: { select: { id: true, contractNumber: true, title: true } },
          },
        },
      },
    });

    if (!milestone) throw new NotFoundError('Milestone', id);
    return milestone;
  }

  async completeMilestone(id: string, completedBy: string, evidenceDocumentId?: string): Promise<Milestone> {
    const milestone = await this.getMilestone(id);

    if (milestone.status === 'COMPLETED' || milestone.status === 'APPROVED') {
      throw new ValidationError('Milestone is already completed');
    }

    const updateData: Prisma.MilestoneUpdateInput = {
      status: 'COMPLETED',
      completedAt: new Date(),
      completedBy,
    };

    if (evidenceDocumentId) updateData.evidenceDocumentId = evidenceDocumentId;

    const updated = await this.prisma.milestone.update({
      where: { id },
      data: updateData,
    });

    this.log.info({ milestoneId: id, completedBy }, 'Milestone completed');
    return updated;
  }

  async approveMilestoneForRevenue(id: string, approvedBy: string): Promise<Milestone> {
    const milestone = await this.getMilestone(id);

    if (milestone.status !== 'COMPLETED') {
      throw new ValidationError('Milestone must be completed before revenue approval');
    }

    if (milestone.approvedForRevenue) {
      throw new ValidationError('Milestone is already approved for revenue');
    }

    const updated = await this.prisma.milestone.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedForRevenue: true,
        approvedBy,
        approvedAt: new Date(),
      },
    });

    // Update the parent performance obligation progress
    await this.recalculateObligationProgress(milestone.performanceObligationId);

    this.log.info({
      milestoneId: id,
      approvedBy,
      percentOfObligation: milestone.percentOfObligation,
    }, 'Milestone approved for revenue recognition');

    return updated;
  }

  private async recalculateObligationProgress(poId: string): Promise<void> {
    const po = await this.getPerformanceObligation(poId);

    const approvedMilestones = po.milestones.filter(m => m.approvedForRevenue);
    const totalApprovedPercent = approvedMilestones.reduce(
      (sum, m) => sum + Number(m.percentOfObligation),
      0
    );

    const allocatedPrice = Number(po.allocatedPrice);
    const revenueToRecognize = allocatedPrice * totalApprovedPercent / 100;

    await this.prisma.performanceObligation.update({
      where: { id: poId },
      data: {
        percentComplete: totalApprovedPercent,
        revenueRecognized: revenueToRecognize,
        status: totalApprovedPercent >= 100 ? 'SATISFIED' : 'IN_PROGRESS',
        ...(totalApprovedPercent >= 100 && { satisfiedAt: new Date() }),
      },
    });
  }

  // ============================================================================
  // Contract Revenue Summary
  // ============================================================================

  async getContractRevenueSummary(contractId: string) {
    const obligations = await this.prisma.performanceObligation.findMany({
      where: { contractId },
      include: {
        milestones: true,
      },
    });

    const summary = obligations.reduce(
      (acc, po) => {
        acc.totalAllocatedPrice += Number(po.allocatedPrice);
        acc.totalRecognized += Number(po.revenueRecognized || 0);
        acc.obligations.push({
          id: po.id,
          name: po.name,
          timing: po.satisfactionTiming,
          allocatedPrice: Number(po.allocatedPrice),
          recognized: Number(po.revenueRecognized || 0),
          percentComplete: Number(po.percentComplete || 0),
          status: po.status,
          milestoneCount: po.milestones.length,
          approvedMilestones: po.milestones.filter(m => m.approvedForRevenue).length,
        });
        return acc;
      },
      {
        contractId,
        totalAllocatedPrice: 0,
        totalRecognized: 0,
        totalDeferred: 0,
        obligations: [] as Array<{
          id: string;
          name: string;
          timing: TimingType;
          allocatedPrice: number;
          recognized: number;
          percentComplete: number;
          status: POStatus;
          milestoneCount: number;
          approvedMilestones: number;
        }>,
      }
    );

    summary.totalDeferred = summary.totalAllocatedPrice - summary.totalRecognized;

    return summary;
  }

  async setContractRevRecMethod(contractId: string, method: RevRecMethod, notes?: string) {
    const updateData: Prisma.ContractUpdateInput = {
      revenueRecognitionMethod: method,
    };
    if (notes) updateData.revenueRecognitionNotes = notes;

    await this.prisma.contract.update({
      where: { id: contractId },
      data: updateData,
    });

    this.log.info({ contractId, method }, 'Contract revenue recognition method set');
  }
}

export function createRevenueRecognitionService(prisma: PrismaClient): RevenueRecognitionService {
  return new RevenueRecognitionService(prisma);
}
