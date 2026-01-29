/**
 * Prisma Implementation of Breach Repository
 */

import type { PrismaClient } from '@prisma/client';
import type { BreachRepository } from '../../domain/breach-management/repositories/breach.repository.js';
import type {
  DataBreach,
  BreachActivity,
  BreachQueryFilter,
  CreateBreachInput,
  UpdateBreachInput,
  BreachStatus,
} from '../../domain/breach-management/models/data-breach.js';

type BreachWithActivities = DataBreach & { activities: BreachActivity[] };

export class PrismaBreachRepository implements BreachRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<BreachWithActivities | null> {
    const record = await this.prisma.dataBreach.findUnique({
      where: { id },
      include: {
        activities: {
          orderBy: { performedAt: 'desc' },
        },
      },
    });
    return record as BreachWithActivities | null;
  }

  async findMany(filter: BreachQueryFilter): Promise<{ data: DataBreach[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filter.entityId) where.entityId = filter.entityId;
    if (filter.severity) where.severity = filter.severity;
    if (filter.status) where.status = filter.status;

    if (filter.pendingNotification) {
      where.authorityNotificationRequired = true;
      where.authorityNotifiedAt = null;
      where.notificationDeadline = { gt: new Date() };
    }

    const [data, total] = await Promise.all([
      this.prisma.dataBreach.findMany({
        where,
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
        orderBy: { discoveredAt: 'desc' },
        include: {
          activities: {
            take: 5,
            orderBy: { performedAt: 'desc' },
          },
        },
      }),
      this.prisma.dataBreach.count({ where }),
    ]);

    return { data: data as DataBreach[], total };
  }

  async findPendingNotification(entityId?: string): Promise<DataBreach[]> {
    const where: Record<string, unknown> = {
      authorityNotificationRequired: true,
      authorityNotifiedAt: null,
    };

    if (entityId) where.entityId = entityId;

    const records = await this.prisma.dataBreach.findMany({
      where,
      orderBy: { notificationDeadline: 'asc' },
    });

    return records as DataBreach[];
  }

  async create(
    input: CreateBreachInput & {
      breachNumber: string;
      notificationDeadline?: Date;
    }
  ): Promise<BreachWithActivities> {
    const data: Parameters<typeof this.prisma.dataBreach.create>[0]['data'] = {
      breachNumber: input.breachNumber,
      entityId: input.entityId,
      title: input.title,
      description: input.description,
      severity: input.severity,
      category: input.category,
      discoveredAt: input.discoveredAt,
      riskToSubjects: input.riskToSubjects,
      status: 'IDENTIFIED',
      remediationStatus: 'NOT_STARTED',
      createdBy: input.createdBy,
      authorityNotificationRequired: input.authorityNotificationRequired ?? true,
      crossBorder: input.crossBorder ?? false,
      subjectNotificationRequired: false,
      affectedCategories: input.affectedCategories ?? [],
      activities: {
        create: {
          type: 'IDENTIFIED',
          description: `Breach identified: ${input.title}`,
          performedBy: input.createdBy,
        },
      },
    };

    if (input.occurredAt !== undefined) data.occurredAt = input.occurredAt;
    if (input.affectedCount !== undefined) data.affectedCount = input.affectedCount;
    if (input.likelihoodOfHarm !== undefined) data.likelihoodOfHarm = input.likelihoodOfHarm;
    if (input.notificationDeadline !== undefined) data.notificationDeadline = input.notificationDeadline;

    const record = await this.prisma.dataBreach.create({
      data,
      include: { activities: true },
    });

    return record as BreachWithActivities;
  }

  async update(
    id: string,
    input: UpdateBreachInput,
    activity: { type: string; description: string; performedBy: string; metadata?: Record<string, unknown> }
  ): Promise<BreachWithActivities> {
    const data: Parameters<typeof this.prisma.dataBreach.update>[0]['data'] = {
      activities: {
        create: {
          type: activity.type,
          description: activity.description,
          performedBy: activity.performedBy,
          metadata: activity.metadata as object,
        },
      },
    };

    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.severity !== undefined) data.severity = input.severity;
    if (input.affectedCount !== undefined) data.affectedCount = input.affectedCount;
    if (input.affectedCategories !== undefined) data.affectedCategories = input.affectedCategories;
    if (input.rootCause !== undefined) data.rootCause = input.rootCause;
    if (input.attackVector !== undefined) data.attackVector = input.attackVector;
    if (input.remediationPlan !== undefined) data.remediationPlan = input.remediationPlan;
    if (input.lessonsLearned !== undefined) data.lessonsLearned = input.lessonsLearned;

    const record = await this.prisma.dataBreach.update({
      where: { id },
      data,
      include: { activities: { orderBy: { performedAt: 'desc' } } },
    });

    return record as BreachWithActivities;
  }

  async notifyAuthority(
    id: string,
    notifiedBy: string,
    authorityReference?: string
  ): Promise<BreachWithActivities> {
    const breach = await this.prisma.dataBreach.findUnique({ where: { id } });
    const now = new Date();
    const isLate = breach?.notificationDeadline && now > breach.notificationDeadline;

    const data: Parameters<typeof this.prisma.dataBreach.update>[0]['data'] = {
      status: 'NOTIFYING',
      authorityNotifiedAt: now,
      activities: {
        create: {
          type: 'AUTHORITY_NOTIFIED',
          description: `Supervisory authority notified${isLate ? ' (LATE)' : ''}`,
          performedBy: notifiedBy,
          metadata: {
            authorityReference,
            isLate,
            notificationDeadline: breach?.notificationDeadline,
          } as object,
        },
      },
    };

    if (authorityReference !== undefined) data.authorityReference = authorityReference;

    const record = await this.prisma.dataBreach.update({
      where: { id },
      data,
      include: { activities: { orderBy: { performedAt: 'desc' } } },
    });

    return record as BreachWithActivities;
  }

  async notifySubjects(
    id: string,
    notificationMethod: string,
    notifiedBy: string
  ): Promise<BreachWithActivities> {
    const record = await this.prisma.dataBreach.update({
      where: { id },
      data: {
        subjectNotificationRequired: true,
        subjectsNotifiedAt: new Date(),
        notificationMethod,
        activities: {
          create: {
            type: 'SUBJECTS_NOTIFIED',
            description: `Affected subjects notified via ${notificationMethod}`,
            performedBy: notifiedBy,
          },
        },
      },
      include: { activities: { orderBy: { performedAt: 'desc' } } },
    });

    return record as BreachWithActivities;
  }

  async markContained(id: string, containedBy: string): Promise<BreachWithActivities> {
    const record = await this.prisma.dataBreach.update({
      where: { id },
      data: {
        status: 'CONTAINED',
        containedAt: new Date(),
        activities: {
          create: {
            type: 'CONTAINED',
            description: 'Breach contained',
            performedBy: containedBy,
          },
        },
      },
      include: { activities: { orderBy: { performedAt: 'desc' } } },
    });

    return record as BreachWithActivities;
  }

  async markResolved(id: string, resolvedBy: string): Promise<BreachWithActivities> {
    const record = await this.prisma.dataBreach.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        remediationStatus: 'COMPLETED',
        activities: {
          create: {
            type: 'RESOLVED',
            description: 'Breach fully resolved',
            performedBy: resolvedBy,
          },
        },
      },
      include: { activities: { orderBy: { performedAt: 'desc' } } },
    });

    return record as BreachWithActivities;
  }

  async updateStatus(
    id: string,
    status: BreachStatus,
    activity: { type: string; description: string; performedBy: string }
  ): Promise<BreachWithActivities> {
    const record = await this.prisma.dataBreach.update({
      where: { id },
      data: {
        status,
        activities: {
          create: {
            type: activity.type,
            description: activity.description,
            performedBy: activity.performedBy,
          },
        },
      },
      include: { activities: { orderBy: { performedAt: 'desc' } } },
    });

    return record as BreachWithActivities;
  }
}
