/**
 * Force Majeure Service
 * 
 * Manages force majeure clause extraction and event tracking.
 * Critical for contract performance during extraordinary events.
 */

import {
  PrismaClient,
  ForceMajeureClause,
  ForceMajeureEvent,
  CoveredEvent,
  PerformanceStandard,
  FMStatus,
  FMResolution,
  Prisma
} from '#prisma';
import { logger } from '../../../lib/logger.js';
import { NotFoundError, ValidationError } from '../../../lib/errors.js';

export interface CreateFMClauseInput {
  contractId: string;
  hasClause: boolean;
  clauseSection?: string | undefined;
  coveredEvents?: CoveredEvent[] | undefined;
  performanceStandard?: PerformanceStandard | undefined;
  noticeRequired?: boolean | undefined;
  noticePeriodDays?: number | undefined;
  noticeRecipient?: string | undefined;
  allowsSuspension?: boolean | undefined;
  allowsTermination?: boolean | undefined;
  terminationThresholdDays?: number | undefined;
  clauseText?: string | undefined;
  reviewedBy?: string | undefined;
}

export interface CreateFMEventInput {
  contractId: string;
  eventType: CoveredEvent;
  eventName: string;
  eventDescription: string;
  eventStartDate: Date;
  eventEndDate?: Date | undefined;
  invokedBy: string;
  noticeGiven: boolean;
  noticeDate?: Date | undefined;
  obligationsAffected: string[];
  reliefRequested: string;
}

export interface FMEventQuery {
  contractId?: string | undefined;
  eventType?: CoveredEvent | undefined;
  status?: FMStatus | undefined;
  activeOnly?: boolean | undefined;
  page: number;
  limit: number;
}

export class ForceMajeureService {
  private log = logger.child({ service: 'force-majeure' });

  constructor(private prisma: PrismaClient) {}

  // ============================================================================
  // Force Majeure Clause Management
  // ============================================================================

  async createOrUpdateClause(input: CreateFMClauseInput): Promise<ForceMajeureClause> {
    const existing = await this.prisma.forceMajeureClause.findUnique({
      where: { contractId: input.contractId },
    });

    const data: Prisma.ForceMajeureClauseCreateInput = {
      contract: { connect: { id: input.contractId } },
      hasClause: input.hasClause,
      coveredEvents: input.coveredEvents || [],
      performanceStandard: input.performanceStandard || 'PREVENTED',
      noticeRequired: input.noticeRequired ?? true,
      allowsSuspension: input.allowsSuspension ?? true,
      allowsTermination: input.allowsTermination ?? false,
    };

    if (input.clauseSection) data.clauseSection = input.clauseSection;
    if (input.noticePeriodDays) data.noticePeriodDays = input.noticePeriodDays;
    if (input.noticeRecipient) data.noticeRecipient = input.noticeRecipient;
    if (input.terminationThresholdDays) data.terminationThresholdDays = input.terminationThresholdDays;
    if (input.clauseText) data.clauseText = input.clauseText;
    if (input.reviewedBy) {
      data.reviewedBy = input.reviewedBy;
      data.reviewedAt = new Date();
    }

    if (existing) {
      const clause = await this.prisma.forceMajeureClause.update({
        where: { contractId: input.contractId },
        data,
      });
      this.log.info({ contractId: input.contractId }, 'Force majeure clause updated');
      return clause;
    }

    const clause = await this.prisma.forceMajeureClause.create({ data });
    this.log.info({ contractId: input.contractId }, 'Force majeure clause created');
    return clause;
  }

  async getClause(contractId: string): Promise<ForceMajeureClause | null> {
    return this.prisma.forceMajeureClause.findUnique({
      where: { contractId },
    });
  }

  async checkEventCovered(contractId: string, eventType: CoveredEvent): Promise<{
    covered: boolean;
    clause: ForceMajeureClause | null;
    reason: string;
  }> {
    const clause = await this.getClause(contractId);

    if (!clause) {
      return { covered: false, clause: null, reason: 'No force majeure clause found' };
    }

    if (!clause.hasClause) {
      return { covered: false, clause, reason: 'Contract has no force majeure provision' };
    }

    const covered = clause.coveredEvents.includes(eventType) || clause.coveredEvents.includes('OTHER');

    return {
      covered,
      clause,
      reason: covered
        ? `Event type ${eventType} is covered by force majeure clause`
        : `Event type ${eventType} is not in the list of covered events`,
    };
  }

  // ============================================================================
  // Force Majeure Event Management
  // ============================================================================

  async invokeForceMAjeure(input: CreateFMEventInput): Promise<ForceMajeureEvent> {
    // Check if event type is covered
    const coverage = await this.checkEventCovered(input.contractId, input.eventType);
    
    if (!coverage.covered) {
      this.log.warn({
        contractId: input.contractId,
        eventType: input.eventType,
      }, 'Force majeure invoked for uncovered event type');
    }

    // Check notice requirements
    if (coverage.clause?.noticeRequired && !input.noticeGiven) {
      this.log.warn({
        contractId: input.contractId,
      }, 'Force majeure invoked without required notice');
    }

    const createData: Prisma.ForceMajeureEventCreateInput = {
      contract: { connect: { id: input.contractId } },
      eventType: input.eventType,
      eventName: input.eventName,
      eventDescription: input.eventDescription,
      eventStartDate: input.eventStartDate,
      invokedAt: new Date(),
      invokedBy: input.invokedBy,
      noticeGiven: input.noticeGiven,
      obligationsAffected: input.obligationsAffected,
      reliefRequested: input.reliefRequested,
      status: 'INVOKED',
    };

    if (input.eventEndDate) createData.eventEndDate = input.eventEndDate;
    if (input.noticeDate) createData.noticeDate = input.noticeDate;

    const event = await this.prisma.forceMajeureEvent.create({ data: createData });

    this.log.info({
      eventId: event.id,
      contractId: input.contractId,
      eventType: input.eventType,
      eventName: input.eventName,
    }, 'Force majeure event invoked');

    return event;
  }

  async getEvent(id: string): Promise<ForceMajeureEvent> {
    const event = await this.prisma.forceMajeureEvent.findUnique({
      where: { id },
      include: {
        contract: { select: { id: true, contractNumber: true, title: true } },
      },
    });

    if (!event) throw new NotFoundError('ForceMajeureEvent', id);
    return event;
  }

  async listEvents(query: FMEventQuery) {
    const where: Prisma.ForceMajeureEventWhereInput = {};
    
    if (query.contractId) where.contractId = query.contractId;
    if (query.eventType) where.eventType = query.eventType;
    if (query.status) where.status = query.status;
    if (query.activeOnly) {
      where.status = { in: ['INVOKED', 'ACKNOWLEDGED', 'DISPUTED', 'SUSPENDED'] };
    }

    const [data, total] = await Promise.all([
      this.prisma.forceMajeureEvent.findMany({
        where,
        include: {
          contract: { select: { id: true, contractNumber: true, title: true } },
        },
        orderBy: { invokedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.forceMajeureEvent.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async respondToEvent(
    eventId: string,
    response: string,
    disputed: boolean = false,
    disputeDetails?: string
  ): Promise<ForceMajeureEvent> {
    const event = await this.getEvent(eventId);

    if (event.status !== 'INVOKED') {
      throw new ValidationError('Can only respond to invoked events');
    }

    const updateData: Prisma.ForceMajeureEventUpdateInput = {
      counterpartyResponse: response,
      responseDate: new Date(),
      disputed,
      status: disputed ? 'DISPUTED' : 'ACKNOWLEDGED',
    };

    if (disputeDetails) updateData.disputeDetails = disputeDetails;

    const updated = await this.prisma.forceMajeureEvent.update({
      where: { id: eventId },
      data: updateData,
    });

    this.log.info({ eventId, disputed }, 'Force majeure event response recorded');
    return updated;
  }

  async resolveEvent(
    eventId: string,
    resolutionType: FMResolution,
    performanceResumed?: Date
  ): Promise<ForceMajeureEvent> {
    const event = await this.getEvent(eventId);

    if (['RESOLVED', 'TERMINATED'].includes(event.status)) {
      throw new ValidationError('Event is already resolved');
    }

    const updateData: Prisma.ForceMajeureEventUpdateInput = {
      status: resolutionType === 'CONTRACT_TERMINATED' ? 'TERMINATED' : 'RESOLVED',
      resolutionType,
      resolvedAt: new Date(),
      eventEndDate: event.eventEndDate || new Date(),
    };

    if (performanceResumed) updateData.performanceResumed = performanceResumed;

    const updated = await this.prisma.forceMajeureEvent.update({
      where: { id: eventId },
      data: updateData,
    });

    this.log.info({ eventId, resolutionType }, 'Force majeure event resolved');
    return updated;
  }

  async getActiveEventsForContract(contractId: string): Promise<ForceMajeureEvent[]> {
    return this.prisma.forceMajeureEvent.findMany({
      where: {
        contractId,
        status: { in: ['INVOKED', 'ACKNOWLEDGED', 'DISPUTED', 'SUSPENDED'] },
      },
      orderBy: { invokedAt: 'desc' },
    });
  }
}

export function createForceMajeureService(prisma: PrismaClient): ForceMajeureService {
  return new ForceMajeureService(prisma);
}
