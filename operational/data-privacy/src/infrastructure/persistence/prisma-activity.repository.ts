/**
 * Prisma Implementation of Activity Repository
 * GDPR Article 30 - Records of Processing Activities
 */

import type { PrismaClient, ProcessingActivity as PrismaActivity } from '@prisma/client';
import type { ActivityRepository } from '../../domain/data-inventory/repositories/activity.repository.js';
import type {
  ProcessingActivity,
  ActivityQueryFilter,
  CreateActivityInput,
  UpdateActivityInput,
  ActivityStatus,
} from '../../domain/data-inventory/models/processing-activity.js';

export class PrismaActivityRepository implements ActivityRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<ProcessingActivity | null> {
    const record = await this.prisma.processingActivity.findUnique({
      where: { id },
    });
    return record ? this.mapToModel(record) : null;
  }

  async findMany(
    filter: ActivityQueryFilter
  ): Promise<{ data: ProcessingActivity[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filter.entityId) where.entityId = filter.entityId;
    if (filter.status) where.status = filter.status;
    if (filter.dpiaRequired !== undefined) where.dpiaRequired = filter.dpiaRequired;

    // Special filter for activities with special category data
    if (filter.hasSpecialCategories === true) {
      where.NOT = { specialCategories: { isEmpty: true } };
    } else if (filter.hasSpecialCategories === false) {
      where.specialCategories = { isEmpty: true };
    }

    const [data, total] = await Promise.all([
      this.prisma.processingActivity.findMany({
        where,
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.processingActivity.count({ where }),
    ]);

    return { data: data.map((r) => this.mapToModel(r)), total };
  }

  async findDueForReview(entityId?: string): Promise<ProcessingActivity[]> {
    const where: Record<string, unknown> = {
      status: { in: ['ACTIVE', 'UNDER_REVIEW'] },
      nextReviewDue: { lte: new Date() },
    };

    if (entityId) where.entityId = entityId;

    const records = await this.prisma.processingActivity.findMany({
      where,
      orderBy: { nextReviewDue: 'asc' },
    });

    return records.map((r) => this.mapToModel(r));
  }

  async findWithSpecialCategories(entityId?: string): Promise<ProcessingActivity[]> {
    const where: Record<string, unknown> = {
      NOT: { specialCategories: { isEmpty: true } },
    };

    if (entityId) where.entityId = entityId;

    const records = await this.prisma.processingActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapToModel(r));
  }

  async create(input: CreateActivityInput): Promise<ProcessingActivity> {
    const record = await this.prisma.processingActivity.create({
      data: {
        entityId: input.entityId,
        name: input.name,
        description: input.description,
        purposes: input.purposes,
        lawfulBasis: input.lawfulBasis,
        legitimateInterest: input.legitimateInterest,
        dataCategories: input.dataCategories,
        specialCategories: input.specialCategories ?? [],
        subjectCategories: input.subjectCategories,
        recipients: [],
        thirdCountryTransfers: [],
        technicalMeasures: [],
        organizationalMeasures: [],
        dpiaRequired: false,
        status: 'DRAFT',
        controller: input.controller,
        createdBy: input.createdBy,
      },
    });

    return this.mapToModel(record);
  }

  async update(id: string, input: UpdateActivityInput): Promise<ProcessingActivity> {
    const data: Parameters<typeof this.prisma.processingActivity.update>[0]['data'] = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.purposes !== undefined) data.purposes = input.purposes;
    if (input.lawfulBasis !== undefined) data.lawfulBasis = input.lawfulBasis;
    if (input.legitimateInterest !== undefined) data.legitimateInterest = input.legitimateInterest;
    if (input.dataCategories !== undefined) data.dataCategories = input.dataCategories;
    if (input.specialCategories !== undefined) data.specialCategories = input.specialCategories;
    if (input.subjectCategories !== undefined) data.subjectCategories = input.subjectCategories;
    if (input.recipients !== undefined) data.recipients = input.recipients;
    if (input.thirdCountryTransfers !== undefined) data.thirdCountryTransfers = input.thirdCountryTransfers;
    if (input.transferSafeguards !== undefined) data.transferSafeguards = input.transferSafeguards;
    if (input.retentionPeriod !== undefined) data.retentionPeriod = input.retentionPeriod;
    if (input.retentionCriteria !== undefined) data.retentionCriteria = input.retentionCriteria;
    if (input.technicalMeasures !== undefined) data.technicalMeasures = input.technicalMeasures;
    if (input.organizationalMeasures !== undefined) data.organizationalMeasures = input.organizationalMeasures;
    if (input.dpiaRequired !== undefined) data.dpiaRequired = input.dpiaRequired;
    if (input.dpiaReference !== undefined) data.dpiaReference = input.dpiaReference;
    if (input.processor !== undefined) data.processor = input.processor;
    if (input.dpo !== undefined) data.dpo = input.dpo;

    const record = await this.prisma.processingActivity.update({
      where: { id },
      data,
    });

    return this.mapToModel(record);
  }

  async updateStatus(id: string, status: ActivityStatus): Promise<ProcessingActivity> {
    const record = await this.prisma.processingActivity.update({
      where: { id },
      data: { status },
    });

    return this.mapToModel(record);
  }

  async recordReview(
    id: string,
    reviewedBy: string,
    nextReviewDue: Date
  ): Promise<ProcessingActivity> {
    const record = await this.prisma.processingActivity.update({
      where: { id },
      data: {
        lastReviewedAt: new Date(),
        nextReviewDue,
        // Store reviewedBy in an update - could be enhanced with audit table
      },
    });

    return this.mapToModel(record);
  }

  async linkDPIA(id: string, dpiaReference: string): Promise<ProcessingActivity> {
    const record = await this.prisma.processingActivity.update({
      where: { id },
      data: {
        dpiaRequired: true,
        dpiaReference,
      },
    });

    return this.mapToModel(record);
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  private mapToModel(record: PrismaActivity): ProcessingActivity {
    const model: ProcessingActivity = {
      id: record.id,
      entityId: record.entityId,
      name: record.name,
      description: record.description,
      purposes: record.purposes,
      lawfulBasis: record.lawfulBasis as ProcessingActivity['lawfulBasis'],
      dataCategories: record.dataCategories as ProcessingActivity['dataCategories'],
      specialCategories: record.specialCategories as ProcessingActivity['specialCategories'],
      subjectCategories: record.subjectCategories,
      recipients: record.recipients,
      thirdCountryTransfers: record.thirdCountryTransfers,
      technicalMeasures: record.technicalMeasures,
      organizationalMeasures: record.organizationalMeasures,
      dpiaRequired: record.dpiaRequired,
      status: record.status as ActivityStatus,
      controller: record.controller,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
    };

    // Add optional fields only if they have values
    if (record.legitimateInterest) model.legitimateInterest = record.legitimateInterest;
    if (record.transferSafeguards) model.transferSafeguards = record.transferSafeguards;
    if (record.retentionPeriod) model.retentionPeriod = record.retentionPeriod;
    if (record.retentionCriteria) model.retentionCriteria = record.retentionCriteria;
    if (record.dpiaReference) model.dpiaReference = record.dpiaReference;
    if (record.lastReviewedAt) model.lastReviewedAt = record.lastReviewedAt;
    if (record.nextReviewDue) model.nextReviewDue = record.nextReviewDue;
    if (record.processor) model.processor = record.processor;
    if (record.dpo) model.dpo = record.dpo;

    return model;
  }
}
