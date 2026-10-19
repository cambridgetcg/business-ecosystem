/**
 * Prisma Implementation of DSAR Repository
 */

import type { PrismaClient } from '#prisma';
import type { DSARRepository } from '../../domain/data-subject-rights/repositories/dsar.repository.js';
import type {
  DSARRequest,
  DSARActivity,
  DSARQueryFilter,
  CreateDSARInput,
  DSARStatus,
  VerificationMethod,
  ResponseMethod,
} from '../../domain/data-subject-rights/models/dsar-request.js';

type DSARWithActivities = DSARRequest & { activities: DSARActivity[] };

export class PrismaDSARRepository implements DSARRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<DSARWithActivities | null> {
    const record = await this.prisma.dSARRequest.findUnique({
      where: { id },
      include: {
        activities: {
          orderBy: { performedAt: 'desc' },
        },
      },
    });
    return record as DSARWithActivities | null;
  }

  async findMany(filter: DSARQueryFilter): Promise<{ data: DSARRequest[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filter.entityId) where.entityId = filter.entityId;
    if (filter.status) where.status = filter.status;
    if (filter.requestType) where.requestType = filter.requestType;

    if (filter.overdue) {
      where.deadline = { lt: new Date() };
      where.status = { notIn: ['COMPLETED', 'REJECTED', 'CLOSED'] };
    }

    const [data, total] = await Promise.all([
      this.prisma.dSARRequest.findMany({
        where,
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
        orderBy: { deadline: 'asc' },
        include: {
          activities: {
            take: 5,
            orderBy: { performedAt: 'desc' },
          },
        },
      }),
      this.prisma.dSARRequest.count({ where }),
    ]);

    return { data: data as DSARRequest[], total };
  }

  async findOverdue(entityId?: string): Promise<DSARRequest[]> {
    const where: Record<string, unknown> = {
      deadline: { lt: new Date() },
      status: { notIn: ['COMPLETED', 'REJECTED', 'CLOSED'] },
    };

    if (entityId) where.entityId = entityId;

    const records = await this.prisma.dSARRequest.findMany({
      where,
      orderBy: { deadline: 'asc' },
    });

    return records as DSARRequest[];
  }

  async create(
    input: CreateDSARInput & {
      requestNumber: string;
      deadline: Date;
      receivedAt: Date;
    }
  ): Promise<DSARWithActivities> {
    const data: Parameters<typeof this.prisma.dSARRequest.create>[0]['data'] = {
      entityId: input.entityId,
      requestNumber: input.requestNumber,
      subjectEmail: input.subjectEmail,
      requestType: input.requestType,
      status: 'RECEIVED',
      priority: input.priority ?? 'MEDIUM',
      receivedAt: input.receivedAt,
      deadline: input.deadline,
      activities: {
        create: {
          type: 'RECEIVED',
          description: `DSAR received: ${input.requestType}`,
          performedBy: 'system',
        },
      },
    };

    if (input.subjectName !== undefined) data.subjectName = input.subjectName;
    if (input.subjectId !== undefined) data.subjectId = input.subjectId;
    if (input.description !== undefined) data.description = input.description;

    const record = await this.prisma.dSARRequest.create({
      data,
      include: { activities: true },
    });

    return record as DSARWithActivities;
  }

  async updateStatus(
    id: string,
    status: DSARStatus,
    activity: { type: string; description: string; performedBy: string },
    metadata?: Record<string, unknown>
  ): Promise<DSARWithActivities> {
    const record = await this.prisma.dSARRequest.update({
      where: { id },
      data: {
        status,
        activities: {
          create: {
            type: activity.type,
            description: activity.description,
            performedBy: activity.performedBy,
            metadata: metadata as object,
          },
        },
      },
      include: { activities: { orderBy: { performedAt: 'desc' } } },
    });

    return record as DSARWithActivities;
  }

  async markVerified(
    id: string,
    verificationMethod: VerificationMethod,
    verifiedBy: string
  ): Promise<DSARWithActivities> {
    const record = await this.prisma.dSARRequest.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy,
        verificationMethod,
        activities: {
          create: {
            type: 'VERIFIED',
            description: `Identity verified via ${verificationMethod}`,
            performedBy: verifiedBy,
          },
        },
      },
      include: { activities: { orderBy: { performedAt: 'desc' } } },
    });

    return record as DSARWithActivities;
  }

  async startProcessing(id: string, assignedTo: string): Promise<DSARWithActivities> {
    const record = await this.prisma.dSARRequest.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        assignedTo,
        activities: {
          create: {
            type: 'PROCESSING_STARTED',
            description: 'Processing started',
            performedBy: assignedTo,
          },
        },
      },
      include: { activities: { orderBy: { performedAt: 'desc' } } },
    });

    return record as DSARWithActivities;
  }

  async complete(
    id: string,
    responseMethod: ResponseMethod,
    completedBy: string,
    responseRef?: string
  ): Promise<DSARWithActivities> {
    const now = new Date();

    const data: Parameters<typeof this.prisma.dSARRequest.update>[0]['data'] = {
      status: 'COMPLETED',
      completedAt: now,
      responseMethod,
      responseSentAt: now,
      activities: {
        create: {
          type: 'COMPLETED',
          description: `Response provided via ${responseMethod}`,
          performedBy: completedBy,
        },
      },
    };

    if (responseRef !== undefined) data.responseRef = responseRef;

    const record = await this.prisma.dSARRequest.update({
      where: { id },
      data,
      include: { activities: { orderBy: { performedAt: 'desc' } } },
    });

    return record as DSARWithActivities;
  }

  async extend(
    id: string,
    extendedDeadline: Date,
    reason: string,
    extendedBy: string
  ): Promise<DSARWithActivities> {
    const record = await this.prisma.dSARRequest.update({
      where: { id },
      data: {
        status: 'EXTENDED',
        extendedDeadline,
        extensionReason: reason,
        activities: {
          create: {
            type: 'EXTENDED',
            description: `Deadline extended: ${reason}`,
            performedBy: extendedBy,
          },
        },
      },
      include: { activities: { orderBy: { performedAt: 'desc' } } },
    });

    return record as DSARWithActivities;
  }

  async reject(id: string, reason: string, rejectedBy: string): Promise<DSARWithActivities> {
    const record = await this.prisma.dSARRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason,
        activities: {
          create: {
            type: 'REJECTED',
            description: `Request rejected: ${reason}`,
            performedBy: rejectedBy,
          },
        },
      },
      include: { activities: { orderBy: { performedAt: 'desc' } } },
    });

    return record as DSARWithActivities;
  }
}
