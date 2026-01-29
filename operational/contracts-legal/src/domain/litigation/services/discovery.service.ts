/**
 * Legal Discovery Service
 * 
 * Handles legal holds, discovery requests, and privilege log management.
 * Follows EDRM (Electronic Discovery Reference Model) 8-phase process.
 */

import { 
  PrismaClient, 
  DiscoveryInfo, 
  LegalHold, 
  DiscoveryRequest, 
  PrivilegeLogEntry,
  EDRMPhase,
  HoldStatus,
  DiscoveryType,
  ResponseStatus,
  PrivilegeType,
  Prisma 
} from '@prisma/client';
import { logger } from '../../../lib/logger.js';
import { NotFoundError, ValidationError } from '../../../lib/errors.js';

// ============================================================================
// Input Types
// ============================================================================

export interface CreateDiscoveryInfoInput {
  matterId: string;
  discoveryOpened?: Date | undefined;
  discoveryDeadline?: Date | undefined;
  dateCutoffStart?: Date | undefined;
  dateCutoffEnd?: Date | undefined;
  vendorName?: string | undefined;
}

export interface UpdateDiscoveryInfoInput {
  currentPhase?: EDRMPhase | undefined;
  discoveryDeadline?: Date | undefined;
  discoveryExtensions?: number | undefined;
  dateCutoffStart?: Date | undefined;
  dateCutoffEnd?: Date | undefined;
  documentsIdentified?: number | undefined;
  documentsReviewed?: number | undefined;
  documentsProduced?: number | undefined;
  privilegedCount?: number | undefined;
  reviewCost?: number | undefined;
  eDiscoveryCost?: number | undefined;
  vendorName?: string | undefined;
}

export interface CreateLegalHoldInput {
  matterId: string;
  holdName: string;
  description: string;
  dataTypes: string[];
  custodians: string[];
  issuedBy: string;
}

export interface LegalHoldQuery {
  matterId?: string | undefined;
  status?: HoldStatus | undefined;
  custodian?: string | undefined;
  page: number;
  limit: number;
}

export interface CreateDiscoveryRequestInput {
  matterId: string;
  type: DiscoveryType;
  requestNumber: string;
  issuedBy: string;
  direction: 'SENT' | 'RECEIVED';
  receivedAt?: Date | undefined;
  sentAt?: Date | undefined;
  dueDate: Date;
  description: string;
  requestItems?: Record<string, unknown> | undefined;
}

export interface DiscoveryRequestQuery {
  matterId?: string | undefined;
  type?: DiscoveryType | undefined;
  responseStatus?: ResponseStatus | undefined;
  overdue?: boolean | undefined;
  page: number;
  limit: number;
}

export interface CreatePrivilegeLogInput {
  matterId: string;
  documentId?: string | undefined;
  batesNumber?: string | undefined;
  documentDate?: Date | undefined;
  documentType?: string | undefined;
  author?: string | undefined;
  recipients?: string[] | undefined;
  privilegeType: PrivilegeType;
  description: string;
  reviewedBy: string;
}

export class DiscoveryService {
  private log = logger.child({ service: 'discovery' });

  constructor(private prisma: PrismaClient) {}

  // ============================================================================
  // Discovery Info Methods
  // ============================================================================

  async createDiscoveryInfo(input: CreateDiscoveryInfoInput): Promise<DiscoveryInfo> {
    const matter = await this.prisma.legalMatter.findUnique({
      where: { id: input.matterId },
    });

    if (!matter) {
      throw new NotFoundError('LegalMatter', input.matterId);
    }

    const createData: Prisma.DiscoveryInfoCreateInput = {
      matter: { connect: { id: input.matterId } },
      discoveryOpened: input.discoveryOpened || new Date(),
    };

    if (input.discoveryDeadline) createData.discoveryDeadline = input.discoveryDeadline;
    if (input.dateCutoffStart) createData.dateCutoffStart = input.dateCutoffStart;
    if (input.dateCutoffEnd) createData.dateCutoffEnd = input.dateCutoffEnd;
    if (input.vendorName) createData.vendorName = input.vendorName;

    const discoveryInfo = await this.prisma.discoveryInfo.create({ data: createData });

    this.log.info({ matterId: input.matterId }, 'Discovery info created');
    return discoveryInfo;
  }

  async getDiscoveryInfo(matterId: string): Promise<DiscoveryInfo> {
    const info = await this.prisma.discoveryInfo.findUnique({ where: { matterId } });
    if (!info) throw new NotFoundError('DiscoveryInfo', matterId);
    return info;
  }

  async updateDiscoveryInfo(matterId: string, input: UpdateDiscoveryInfoInput): Promise<DiscoveryInfo> {
    const updateData: Prisma.DiscoveryInfoUpdateInput = {};
    
    if (input.currentPhase !== undefined) updateData.currentPhase = input.currentPhase;
    if (input.discoveryDeadline !== undefined) updateData.discoveryDeadline = input.discoveryDeadline;
    if (input.discoveryExtensions !== undefined) updateData.discoveryExtensions = input.discoveryExtensions;
    if (input.dateCutoffStart !== undefined) updateData.dateCutoffStart = input.dateCutoffStart;
    if (input.dateCutoffEnd !== undefined) updateData.dateCutoffEnd = input.dateCutoffEnd;
    if (input.documentsIdentified !== undefined) updateData.documentsIdentified = input.documentsIdentified;
    if (input.documentsReviewed !== undefined) updateData.documentsReviewed = input.documentsReviewed;
    if (input.documentsProduced !== undefined) updateData.documentsProduced = input.documentsProduced;
    if (input.privilegedCount !== undefined) updateData.privilegedCount = input.privilegedCount;
    if (input.reviewCost !== undefined) updateData.reviewCost = input.reviewCost;
    if (input.eDiscoveryCost !== undefined) updateData.eDiscoveryCost = input.eDiscoveryCost;
    if (input.vendorName !== undefined) updateData.vendorName = input.vendorName;

    const info = await this.prisma.discoveryInfo.update({
      where: { matterId },
      data: updateData,
    });

    this.log.info({ matterId, phase: input.currentPhase }, 'Discovery info updated');
    return info;
  }

  async advanceEDRMPhase(matterId: string): Promise<DiscoveryInfo> {
    const info = await this.getDiscoveryInfo(matterId);
    
    const phases: EDRMPhase[] = [
      'IDENTIFICATION', 'PRESERVATION', 'COLLECTION', 'PROCESSING',
      'REVIEW', 'ANALYSIS', 'PRODUCTION', 'PRESENTATION'
    ];
    
    const currentIndex = phases.indexOf(info.currentPhase);
    if (currentIndex === -1 || currentIndex >= phases.length - 1) {
      throw new ValidationError('Discovery is already in final phase (PRESENTATION)');
    }

    const nextPhaseValue = phases[currentIndex + 1];
    if (!nextPhaseValue) {
      throw new ValidationError('Cannot determine next phase');
    }
    const nextPhase: EDRMPhase = nextPhaseValue;
    
    const result = await this.prisma.discoveryInfo.update({
      where: { matterId },
      data: { currentPhase: nextPhase },
    });

    this.log.info({ matterId, phase: nextPhase }, 'EDRM phase advanced');
    return result;
  }

  // ============================================================================
  // Legal Hold Methods
  // ============================================================================

  async createLegalHold(input: CreateLegalHoldInput): Promise<LegalHold> {
    const hold = await this.prisma.legalHold.create({
      data: {
        matter: { connect: { id: input.matterId } },
        holdName: input.holdName,
        description: input.description,
        dataTypes: input.dataTypes,
        custodians: input.custodians,
        issuedAt: new Date(),
        issuedBy: input.issuedBy,
        status: 'ACTIVE',
      },
    });

    this.log.info({
      holdId: hold.id,
      matterId: input.matterId,
      custodianCount: input.custodians.length,
    }, 'Legal hold issued');

    return hold;
  }

  async getLegalHold(id: string): Promise<LegalHold> {
    const hold = await this.prisma.legalHold.findUnique({
      where: { id },
      include: { matter: { select: { id: true, matterNumber: true, title: true } } },
    });

    if (!hold) throw new NotFoundError('LegalHold', id);
    return hold;
  }

  async listLegalHolds(query: LegalHoldQuery) {
    const where: Prisma.LegalHoldWhereInput = {};
    if (query.matterId) where.matterId = query.matterId;
    if (query.status) where.status = query.status;
    if (query.custodian) where.custodians = { has: query.custodian };

    const [data, total] = await Promise.all([
      this.prisma.legalHold.findMany({
        where,
        include: { matter: { select: { id: true, matterNumber: true, title: true } } },
        orderBy: { issuedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.legalHold.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async acknowledgeLegalHold(holdId: string, custodianId: string): Promise<LegalHold> {
    const hold = await this.getLegalHold(holdId);
    
    if (!hold.custodians.includes(custodianId)) {
      throw new ValidationError(`Custodian ${custodianId} is not on this legal hold`);
    }

    const acknowledgedBy = (hold.acknowledgedBy as Record<string, unknown>) || {};
    acknowledgedBy[custodianId] = {
      acknowledgedAt: new Date().toISOString(),
      method: 'system',
    };

    return this.prisma.legalHold.update({
      where: { id: holdId },
      data: { acknowledgedBy: acknowledgedBy as Prisma.InputJsonValue },
    });
  }

  async liftLegalHold(holdId: string, liftedBy: string, reason: string): Promise<LegalHold> {
    const hold = await this.getLegalHold(holdId);
    
    if (hold.status !== 'ACTIVE') {
      throw new ValidationError('Only active holds can be lifted');
    }

    const updated = await this.prisma.legalHold.update({
      where: { id: holdId },
      data: {
        status: 'LIFTED',
        liftedAt: new Date(),
        liftedBy,
        liftReason: reason,
      },
    });

    this.log.info({ holdId, liftedBy }, 'Legal hold lifted');
    return updated;
  }

  // ============================================================================
  // Discovery Request Methods
  // ============================================================================

  async createDiscoveryRequest(input: CreateDiscoveryRequestInput): Promise<DiscoveryRequest> {
    const createData: Prisma.DiscoveryRequestCreateInput = {
      matter: { connect: { id: input.matterId } },
      type: input.type,
      requestNumber: input.requestNumber,
      issuedBy: input.issuedBy,
      direction: input.direction,
      dueDate: input.dueDate,
      description: input.description,
    };

    if (input.receivedAt) createData.receivedAt = input.receivedAt;
    if (input.sentAt) createData.sentAt = input.sentAt;
    if (input.requestItems) createData.requestItems = input.requestItems as Prisma.InputJsonValue;

    const request = await this.prisma.discoveryRequest.create({ data: createData });

    this.log.info({
      requestId: request.id,
      matterId: input.matterId,
      type: input.type,
      dueDate: input.dueDate,
    }, 'Discovery request created');

    return request;
  }

  async getDiscoveryRequest(id: string): Promise<DiscoveryRequest> {
    const request = await this.prisma.discoveryRequest.findUnique({
      where: { id },
      include: { matter: { select: { id: true, matterNumber: true, title: true } } },
    });

    if (!request) throw new NotFoundError('DiscoveryRequest', id);
    return request;
  }

  async listDiscoveryRequests(query: DiscoveryRequestQuery) {
    const now = new Date();
    const where: Prisma.DiscoveryRequestWhereInput = {};
    
    if (query.matterId) where.matterId = query.matterId;
    if (query.type) where.type = query.type;
    if (query.responseStatus) where.responseStatus = query.responseStatus;
    if (query.overdue) {
      where.dueDate = { lt: now };
      where.responseStatus = { in: ['PENDING', 'IN_PROGRESS'] };
    }

    const [data, total] = await Promise.all([
      this.prisma.discoveryRequest.findMany({
        where,
        include: { matter: { select: { id: true, matterNumber: true, title: true } } },
        orderBy: { dueDate: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.discoveryRequest.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async updateRequestStatus(
    id: string,
    status: ResponseStatus,
    documentsProduced?: number,
    objections?: string[]
  ): Promise<DiscoveryRequest> {
    const updateData: Prisma.DiscoveryRequestUpdateInput = {
      responseStatus: status,
    };

    if (status === 'RESPONDED') updateData.respondedAt = new Date();
    if (documentsProduced !== undefined) updateData.documentsProduced = documentsProduced;
    if (objections) updateData.objections = objections;

    const request = await this.prisma.discoveryRequest.update({
      where: { id },
      data: updateData,
    });

    this.log.info({ requestId: id, status }, 'Discovery request status updated');
    return request;
  }

  async requestExtension(id: string, extendedDueDate: Date, reason: string): Promise<DiscoveryRequest> {
    return this.prisma.discoveryRequest.update({
      where: { id },
      data: {
        extensionRequested: true,
        extendedDueDate,
        extensionReason: reason,
        responseStatus: 'EXTENDED',
      },
    });
  }

  // ============================================================================
  // Privilege Log Methods
  // ============================================================================

  async createPrivilegeLogEntry(input: CreatePrivilegeLogInput): Promise<PrivilegeLogEntry> {
    const createData: Prisma.PrivilegeLogEntryCreateInput = {
      matter: { connect: { id: input.matterId } },
      privilegeType: input.privilegeType,
      description: input.description,
      reviewedBy: input.reviewedBy,
      reviewedAt: new Date(),
      recipients: input.recipients || [],
    };

    if (input.documentId) createData.documentId = input.documentId;
    if (input.batesNumber) createData.batesNumber = input.batesNumber;
    if (input.documentDate) createData.documentDate = input.documentDate;
    if (input.documentType) createData.documentType = input.documentType;
    if (input.author) createData.author = input.author;

    const entry = await this.prisma.privilegeLogEntry.create({ data: createData });

    this.log.info({
      entryId: entry.id,
      matterId: input.matterId,
      privilegeType: input.privilegeType,
    }, 'Privilege log entry created');

    return entry;
  }

  async listPrivilegeLog(matterId: string, privilegeType?: PrivilegeType) {
    const where: Prisma.PrivilegeLogEntryWhereInput = { matterId };
    if (privilegeType) where.privilegeType = privilegeType;

    return this.prisma.privilegeLogEntry.findMany({
      where,
      orderBy: { reviewedAt: 'desc' },
    });
  }

  async getPrivilegeLogStats(matterId: string) {
    const entries = await this.prisma.privilegeLogEntry.groupBy({
      by: ['privilegeType'],
      where: { matterId },
      _count: true,
    });

    const challenged = await this.prisma.privilegeLogEntry.count({
      where: { matterId, challenged: true },
    });

    return {
      matterId,
      totalEntries: entries.reduce((sum, e) => sum + e._count, 0),
      byType: Object.fromEntries(entries.map(e => [e.privilegeType, e._count])),
      challenged,
    };
  }
}

export function createDiscoveryService(prisma: PrismaClient): DiscoveryService {
  return new DiscoveryService(prisma);
}
