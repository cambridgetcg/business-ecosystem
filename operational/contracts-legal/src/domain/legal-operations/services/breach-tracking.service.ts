/**
 * Breach Tracking Service
 * 
 * Manages performance issues, cure attempts, and breach allegations.
 * Handles the "murky middle ground" between full performance and material breach.
 */

import {
  PrismaClient,
  PerformanceIssue,
  CureAttempt,
  BreachAllegation,
  IssueSeverity,
  IssueStatus,
  BreachType,
  MaterialityLevel,
  BreachStatus,
  BreachResolution,
  Prisma
} from '@prisma/client';
import { logger } from '../../../lib/logger.js';
import { NotFoundError, ValidationError } from '../../../lib/errors.js';

// ============================================================================
// Input Types
// ============================================================================

export interface CreatePerformanceIssueInput {
  contractId: string;
  obligationId?: string | undefined;
  description: string;
  affectedSection?: string | undefined;
  severity: IssueSeverity;
  isTimeSensitive?: boolean | undefined;
  reportedBy: string;
  cureDeadline?: Date | undefined;
  curePeriodDays?: number | undefined;
}

export interface CreateCureAttemptInput {
  performanceIssueId: string;
  description: string;
  attemptedBy: string;
}

export interface EvaluateCureInput {
  successful: boolean;
  evaluatedBy: string;
  evaluationNotes?: string | undefined;
}

export interface CreateBreachAllegationInput {
  contractId: string;
  allegedBy: string;
  breachType: BreachType;
  description: string;
  affectedSections?: string[] | undefined;
  performanceIssueIds?: string[] | undefined;
  claimedMateriality: MaterialityLevel;
  claimedDamages?: number | undefined;
  claimedDamagesDesc?: string | undefined;
}

export interface PerformanceIssueQuery {
  contractId?: string | undefined;
  severity?: IssueSeverity | undefined;
  status?: IssueStatus | undefined;
  escalated?: boolean | undefined;
  page: number;
  limit: number;
}

export interface BreachQuery {
  contractId?: string | undefined;
  breachType?: BreachType | undefined;
  status?: BreachStatus | undefined;
  materialityLevel?: MaterialityLevel | undefined;
  page: number;
  limit: number;
}

export class BreachTrackingService {
  private log = logger.child({ service: 'breach-tracking' });

  constructor(private prisma: PrismaClient) {}

  // ============================================================================
  // Performance Issue Management
  // ============================================================================

  async createPerformanceIssue(input: CreatePerformanceIssueInput): Promise<PerformanceIssue> {
    const createData: Prisma.PerformanceIssueCreateInput = {
      contract: { connect: { id: input.contractId } },
      description: input.description,
      severity: input.severity,
      isTimeSensitive: input.isTimeSensitive ?? false,
      reportedBy: input.reportedBy,
      reportedAt: new Date(),
      status: 'OPEN',
    };

    if (input.obligationId) createData.obligationId = input.obligationId;
    if (input.affectedSection) createData.affectedSection = input.affectedSection;
    if (input.cureDeadline) createData.cureDeadline = input.cureDeadline;
    if (input.curePeriodDays) createData.curePeriodDays = input.curePeriodDays;

    const issue = await this.prisma.performanceIssue.create({ data: createData });

    this.log.info({
      issueId: issue.id,
      contractId: input.contractId,
      severity: input.severity,
    }, 'Performance issue created');

    return issue;
  }

  async getPerformanceIssue(id: string): Promise<PerformanceIssue & { cureAttempts: CureAttempt[] }> {
    const issue = await this.prisma.performanceIssue.findUnique({
      where: { id },
      include: {
        contract: { select: { id: true, contractNumber: true, title: true } },
        cureAttempts: { orderBy: { attemptedAt: 'desc' } },
      },
    });

    if (!issue) throw new NotFoundError('PerformanceIssue', id);
    return issue;
  }

  async listPerformanceIssues(query: PerformanceIssueQuery) {
    const where: Prisma.PerformanceIssueWhereInput = {};
    
    if (query.contractId) where.contractId = query.contractId;
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;
    if (query.escalated !== undefined) where.escalatedToBreach = query.escalated;

    const [data, total] = await Promise.all([
      this.prisma.performanceIssue.findMany({
        where,
        include: {
          contract: { select: { id: true, contractNumber: true, title: true } },
          cureAttempts: { take: 1, orderBy: { attemptedAt: 'desc' } },
        },
        orderBy: [{ severity: 'desc' }, { reportedAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.performanceIssue.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async updateIssueStatus(id: string, status: IssueStatus, resolution?: string): Promise<PerformanceIssue> {
    const issue = await this.getPerformanceIssue(id);

    const updateData: Prisma.PerformanceIssueUpdateInput = { status };
    
    if (status === 'CURED' || status === 'WAIVED') {
      updateData.resolvedAt = new Date();
      if (resolution) updateData.resolution = resolution;
    }

    const updated = await this.prisma.performanceIssue.update({
      where: { id },
      data: updateData,
    });

    this.log.info({ issueId: id, status }, 'Performance issue status updated');
    return updated;
  }

  // ============================================================================
  // Cure Attempt Management
  // ============================================================================

  async createCureAttempt(input: CreateCureAttemptInput): Promise<CureAttempt> {
    const issue = await this.getPerformanceIssue(input.performanceIssueId);

    if (['CURED', 'WAIVED', 'ESCALATED_TO_BREACH'].includes(issue.status)) {
      throw new ValidationError('Cannot add cure attempt to resolved or escalated issue');
    }

    // Update issue status to CURE_IN_PROGRESS
    await this.prisma.performanceIssue.update({
      where: { id: input.performanceIssueId },
      data: { status: 'CURE_IN_PROGRESS' },
    });

    const attempt = await this.prisma.cureAttempt.create({
      data: {
        performanceIssue: { connect: { id: input.performanceIssueId } },
        description: input.description,
        attemptedAt: new Date(),
        attemptedBy: input.attemptedBy,
      },
    });

    this.log.info({
      attemptId: attempt.id,
      issueId: input.performanceIssueId,
    }, 'Cure attempt created');

    return attempt;
  }

  async evaluateCureAttempt(attemptId: string, input: EvaluateCureInput): Promise<CureAttempt> {
    const attempt = await this.prisma.cureAttempt.findUnique({
      where: { id: attemptId },
      include: { performanceIssue: true },
    });

    if (!attempt) throw new NotFoundError('CureAttempt', attemptId);

    if (attempt.successful !== null) {
      throw new ValidationError('Cure attempt has already been evaluated');
    }

    const updateData: Prisma.CureAttemptUpdateInput = {
      successful: input.successful,
      evaluatedAt: new Date(),
      evaluatedBy: input.evaluatedBy,
    };

    if (input.evaluationNotes) updateData.evaluationNotes = input.evaluationNotes;

    const updated = await this.prisma.cureAttempt.update({
      where: { id: attemptId },
      data: updateData,
    });

    // If successful, update issue status to CURED
    if (input.successful) {
      await this.updateIssueStatus(
        attempt.performanceIssueId,
        'CURED',
        `Cured via attempt ${attemptId}`
      );
    }

    this.log.info({
      attemptId,
      successful: input.successful,
    }, 'Cure attempt evaluated');

    return updated;
  }

  // ============================================================================
  // Breach Allegation Management
  // ============================================================================

  async createBreachAllegation(input: CreateBreachAllegationInput): Promise<BreachAllegation> {
    const createData: Prisma.BreachAllegationCreateInput = {
      contract: { connect: { id: input.contractId } },
      allegedBy: input.allegedBy,
      allegedAt: new Date(),
      breachType: input.breachType,
      description: input.description,
      affectedSections: input.affectedSections || [],
      performanceIssueIds: input.performanceIssueIds || [],
      claimedMateriality: input.claimedMateriality,
      status: 'ALLEGED',
    };

    if (input.claimedDamages) createData.claimedDamages = input.claimedDamages;
    if (input.claimedDamagesDesc) createData.claimedDamagesDesc = input.claimedDamagesDesc;

    const allegation = await this.prisma.breachAllegation.create({ data: createData });

    // Mark related performance issues as escalated
    if (input.performanceIssueIds?.length) {
      await this.prisma.performanceIssue.updateMany({
        where: { id: { in: input.performanceIssueIds } },
        data: {
          escalatedToBreach: true,
          breachAllegationId: allegation.id,
          status: 'ESCALATED_TO_BREACH',
        },
      });
    }

    this.log.info({
      allegationId: allegation.id,
      contractId: input.contractId,
      breachType: input.breachType,
      claimedMateriality: input.claimedMateriality,
    }, 'Breach allegation created');

    return allegation;
  }

  async getBreachAllegation(id: string): Promise<BreachAllegation> {
    const allegation = await this.prisma.breachAllegation.findUnique({
      where: { id },
      include: {
        contract: { select: { id: true, contractNumber: true, title: true } },
      },
    });

    if (!allegation) throw new NotFoundError('BreachAllegation', id);
    return allegation;
  }

  async listBreachAllegations(query: BreachQuery) {
    const where: Prisma.BreachAllegationWhereInput = {};
    
    if (query.contractId) where.contractId = query.contractId;
    if (query.breachType) where.breachType = query.breachType;
    if (query.status) where.status = query.status;
    if (query.materialityLevel) where.claimedMateriality = query.materialityLevel;

    const [data, total] = await Promise.all([
      this.prisma.breachAllegation.findMany({
        where,
        include: {
          contract: { select: { id: true, contractNumber: true, title: true } },
        },
        orderBy: { allegedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.breachAllegation.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async respondToAllegation(
    id: string,
    denies: boolean,
    responseDetails: string
  ): Promise<BreachAllegation> {
    const allegation = await this.getBreachAllegation(id);

    if (allegation.respondedAt) {
      throw new ValidationError('Allegation has already been responded to');
    }

    const updated = await this.prisma.breachAllegation.update({
      where: { id },
      data: {
        respondedAt: new Date(),
        responseDenies: denies,
        responseDetails,
        status: denies ? 'DENIED' : 'ACKNOWLEDGED',
      },
    });

    this.log.info({ allegationId: id, denies }, 'Breach allegation response recorded');
    return updated;
  }

  async resolveAllegation(
    id: string,
    resolutionType: BreachResolution,
    determinedMaterial: boolean,
    resolutionDetails?: string,
    linkedToMatterId?: string
  ): Promise<BreachAllegation> {
    const allegation = await this.getBreachAllegation(id);

    if (['SETTLED', 'LITIGATED'].includes(allegation.status)) {
      throw new ValidationError('Allegation is already resolved');
    }

    let finalStatus: BreachStatus;
    if (resolutionType === 'COURT_JUDGMENT' || resolutionType === 'ARBITRATION_AWARD') {
      finalStatus = 'LITIGATED';
    } else if (resolutionType === 'CURED_BY_BREACHING_PARTY') {
      finalStatus = 'CURED';
    } else {
      finalStatus = 'SETTLED';
    }

    const updateData: Prisma.BreachAllegationUpdateInput = {
      status: finalStatus,
      determinedMaterial,
      resolvedAt: new Date(),
      resolutionType,
    };

    if (resolutionDetails) updateData.resolutionDetails = resolutionDetails;
    if (linkedToMatterId) updateData.linkedToMatterId = linkedToMatterId;

    const updated = await this.prisma.breachAllegation.update({
      where: { id },
      data: updateData,
    });

    this.log.info({
      allegationId: id,
      resolutionType,
      determinedMaterial,
    }, 'Breach allegation resolved');

    return updated;
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  async getContractPerformanceHealth(contractId: string) {
    const [openIssues, issuesBySeverity, breachAllegations] = await Promise.all([
      this.prisma.performanceIssue.count({
        where: { contractId, status: { in: ['OPEN', 'CURE_IN_PROGRESS', 'DISPUTED'] } },
      }),
      this.prisma.performanceIssue.groupBy({
        by: ['severity'],
        where: { contractId },
        _count: true,
      }),
      this.prisma.breachAllegation.findMany({
        where: { contractId, status: { notIn: ['CURED', 'SETTLED'] } },
        select: { id: true, breachType: true, claimedMateriality: true, status: true },
      }),
    ]);

    return {
      contractId,
      openIssues,
      issuesBySeverity: Object.fromEntries(issuesBySeverity.map(i => [i.severity, i._count])),
      activeBreachAllegations: breachAllegations,
      healthScore: this.calculateHealthScore(openIssues, issuesBySeverity, breachAllegations.length),
    };
  }

  private calculateHealthScore(
    openIssues: number,
    severityCounts: { severity: IssueSeverity; _count: number }[],
    activeBreaches: number
  ): 'HEALTHY' | 'AT_RISK' | 'CRITICAL' {
    const criticalCount = severityCounts.find(s => s.severity === 'CRITICAL')?._count || 0;
    const significantCount = severityCounts.find(s => s.severity === 'SIGNIFICANT')?._count || 0;

    if (activeBreaches > 0 || criticalCount > 0) return 'CRITICAL';
    if (significantCount > 2 || openIssues > 5) return 'AT_RISK';
    return 'HEALTHY';
  }
}

export function createBreachTrackingService(prisma: PrismaClient): BreachTrackingService {
  return new BreachTrackingService(prisma);
}
