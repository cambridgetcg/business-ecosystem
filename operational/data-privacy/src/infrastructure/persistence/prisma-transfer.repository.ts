/**
 * Prisma Implementation of Transfer Repository
 * GDPR Chapter V - Cross-border data transfers
 */

import type { PrismaClient, DataTransfer as PrismaTransfer } from '@prisma/client';
import type { TransferRepository } from '../../domain/cross-border-transfer/repositories/transfer.repository.js';
import type {
  DataTransfer,
  TransferQueryFilter,
  CreateTransferInput,
  UpdateTransferInput,
  TransferImpactAssessment,
  TransferStatus,
} from '../../domain/cross-border-transfer/models/data-transfer.js';

export class PrismaTransferRepository implements TransferRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<DataTransfer | null> {
    const record = await this.prisma.dataTransfer.findUnique({
      where: { id },
    });
    return record ? this.mapToModel(record) : null;
  }

  async findMany(
    filter: TransferQueryFilter
  ): Promise<{ data: DataTransfer[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filter.entityId) where.entityId = filter.entityId;
    if (filter.status) where.status = filter.status;
    if (filter.destinationCountry) where.destinationCountry = filter.destinationCountry;
    if (filter.transferBasis) where.transferBasis = filter.transferBasis;
    if (filter.hasImpactAssessment !== undefined) {
      where.transferImpactAssessment = filter.hasImpactAssessment
        ? { not: null }
        : null;
    }

    const [data, total] = await Promise.all([
      this.prisma.dataTransfer.findMany({
        where,
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dataTransfer.count({ where }),
    ]);

    return { data: data.map((r) => this.mapToModel(r)), total };
  }

  async findByDestination(countryCode: string, entityId?: string): Promise<DataTransfer[]> {
    const where: Record<string, unknown> = {
      destinationCountry: countryCode.toUpperCase(),
    };

    if (entityId) where.entityId = entityId;

    const records = await this.prisma.dataTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapToModel(r));
  }

  async findWithoutTIA(entityId?: string): Promise<DataTransfer[]> {
    const where: Record<string, unknown> = {
      transferImpactAssessment: null,
    };

    if (entityId) where.entityId = entityId;

    const records = await this.prisma.dataTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapToModel(r));
  }

  async create(input: CreateTransferInput): Promise<DataTransfer> {
    const record = await this.prisma.dataTransfer.create({
      data: {
        entityId: input.entityId,
        name: input.name,
        description: input.description,
        destinationCountry: input.destinationCountry.toUpperCase(),
        recipientName: input.recipientName,
        recipientType: input.recipientType,
        dataCategories: input.dataCategories,
        dataSubjects: input.dataSubjects,
        transferPurposes: input.transferPurposes,
        transferBasis: input.transferBasis,
        basisReference: input.basisReference,
        processorId: input.processorId,
        processingActivityId: input.processingActivityId,
        status: 'DRAFT',
        technicalMeasures: [],
        organizationalMeasures: [],
        contractualMeasures: [],
        createdBy: input.createdBy,
      },
    });

    return this.mapToModel(record);
  }

  async update(id: string, input: UpdateTransferInput): Promise<DataTransfer> {
    const data: Parameters<typeof this.prisma.dataTransfer.update>[0]['data'] = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.dataCategories !== undefined) data.dataCategories = input.dataCategories;
    if (input.dataSubjects !== undefined) data.dataSubjects = input.dataSubjects;
    if (input.transferPurposes !== undefined) data.transferPurposes = input.transferPurposes;
    if (input.transferBasis !== undefined) data.transferBasis = input.transferBasis;
    if (input.basisReference !== undefined) data.basisReference = input.basisReference;
    if (input.technicalMeasures !== undefined) data.technicalMeasures = input.technicalMeasures;
    if (input.organizationalMeasures !== undefined) data.organizationalMeasures = input.organizationalMeasures;
    if (input.contractualMeasures !== undefined) data.contractualMeasures = input.contractualMeasures;

    const record = await this.prisma.dataTransfer.update({
      where: { id },
      data,
    });

    return this.mapToModel(record);
  }

  async updateStatus(id: string, status: TransferStatus): Promise<DataTransfer> {
    const record = await this.prisma.dataTransfer.update({
      where: { id },
      data: { status },
    });

    return this.mapToModel(record);
  }

  async recordTIA(id: string, assessment: TransferImpactAssessment): Promise<DataTransfer> {
    const record = await this.prisma.dataTransfer.update({
      where: { id },
      data: {
        transferImpactAssessment: assessment as unknown as object,
      },
    });

    return this.mapToModel(record);
  }

  async addSupplementaryMeasures(
    id: string,
    technical: string[],
    organizational: string[],
    contractual: string[]
  ): Promise<DataTransfer> {
    const existing = await this.prisma.dataTransfer.findUnique({
      where: { id },
    });

    if (!existing) throw new Error('Transfer not found');

    const record = await this.prisma.dataTransfer.update({
      where: { id },
      data: {
        technicalMeasures: [...existing.technicalMeasures, ...technical],
        organizationalMeasures: [...existing.organizationalMeasures, ...organizational],
        contractualMeasures: [...existing.contractualMeasures, ...contractual],
      },
    });

    return this.mapToModel(record);
  }

  async recordApproval(id: string, approvedBy: string): Promise<DataTransfer> {
    const record = await this.prisma.dataTransfer.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    return this.mapToModel(record);
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  private mapToModel(record: PrismaTransfer): DataTransfer {
    const model: DataTransfer = {
      id: record.id,
      entityId: record.entityId,
      name: record.name,
      description: record.description,
      sourceCountry: record.sourceCountry,
      destinationCountry: record.destinationCountry,
      recipientName: record.recipientName,
      recipientType: record.recipientType as 'CONTROLLER' | 'PROCESSOR',
      dataCategories: record.dataCategories,
      dataSubjects: record.dataSubjects,
      transferPurposes: record.transferPurposes,
      transferBasis: record.transferBasis as DataTransfer['transferBasis'],
      technicalMeasures: record.technicalMeasures,
      organizationalMeasures: record.organizationalMeasures,
      contractualMeasures: record.contractualMeasures,
      status: record.status as TransferStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
    };

    // Add optional fields only if they have values
    if (record.basisReference) model.basisReference = record.basisReference;
    if (record.transferImpactAssessment) {
      model.transferImpactAssessment = record.transferImpactAssessment as unknown as TransferImpactAssessment;
    }
    if (record.approvedBy) model.approvedBy = record.approvedBy;
    if (record.approvedAt) model.approvedAt = record.approvedAt;
    if (record.processorId) model.processorId = record.processorId;
    if (record.processingActivityId) model.processingActivityId = record.processingActivityId;

    return model;
  }
}
