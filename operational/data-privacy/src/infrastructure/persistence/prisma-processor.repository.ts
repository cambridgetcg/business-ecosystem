/**
 * Prisma Implementation of Processor Repository
 * GDPR Article 28 - Data processor management
 */

import type { PrismaClient, DataProcessor as PrismaProcessor } from '@prisma/client';
import type { ProcessorRepository } from '../../domain/vendor-privacy/repositories/processor.repository.js';
import type {
  DataProcessor,
  ProcessorQueryFilter,
  CreateProcessorInput,
  UpdateProcessorInput,
  ProcessorStatus,
  ComplianceStatus,
  TransferMechanism,
  SubProcessor,
} from '../../domain/vendor-privacy/models/data-processor.js';
import { isEUCountry } from '../../domain/vendor-privacy/models/data-processor.js';

export class PrismaProcessorRepository implements ProcessorRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<DataProcessor | null> {
    const record = await this.prisma.dataProcessor.findUnique({
      where: { id },
    });
    return record ? this.mapToModel(record) : null;
  }

  async findMany(
    filter: ProcessorQueryFilter
  ): Promise<{ data: DataProcessor[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filter.entityId) where.entityId = filter.entityId;
    if (filter.status) where.status = filter.status;
    if (filter.complianceStatus) where.complianceStatus = filter.complianceStatus;
    if (filter.isEU !== undefined) where.isEU = filter.isEU;

    // Filter for expiring DPAs
    if (filter.dpaExpiringSoon) {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + 90);
      where.dpaExpiresAt = {
        lte: thresholdDate,
        gte: new Date(),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.dataProcessor.findMany({
        where,
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dataProcessor.count({ where }),
    ]);

    return { data: data.map((r) => this.mapToModel(r)), total };
  }

  async findExpiringDPAs(
    entityId: string | undefined,
    daysThreshold: number
  ): Promise<DataProcessor[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const where: Record<string, unknown> = {
      dpaExpiresAt: {
        lte: thresholdDate,
        gte: new Date(),
      },
    };

    if (entityId) where.entityId = entityId;

    const records = await this.prisma.dataProcessor.findMany({
      where,
      orderBy: { dpaExpiresAt: 'asc' },
    });

    return records.map((r) => this.mapToModel(r));
  }

  async findNonCompliant(entityId?: string): Promise<DataProcessor[]> {
    const where: Record<string, unknown> = {
      complianceStatus: 'NON_COMPLIANT',
    };

    if (entityId) where.entityId = entityId;

    const records = await this.prisma.dataProcessor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapToModel(r));
  }

  async create(input: CreateProcessorInput): Promise<DataProcessor> {
    const isEU = isEUCountry(input.country);

    const record = await this.prisma.dataProcessor.create({
      data: {
        entityId: input.entityId,
        name: input.name,
        description: input.description,
        country: input.country.toUpperCase(),
        isEU,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        dataCategories: input.dataCategories,
        purposes: input.purposes,
        status: 'PENDING',
        complianceStatus: 'UNKNOWN',
        hasSubProcessors: false,
        certifications: [],
        createdBy: input.createdBy,
      },
    });

    return this.mapToModel(record);
  }

  async update(id: string, input: UpdateProcessorInput): Promise<DataProcessor> {
    const data: Parameters<typeof this.prisma.dataProcessor.update>[0]['data'] = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.contactName !== undefined) data.contactName = input.contactName;
    if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail;
    if (input.country !== undefined) {
      data.country = input.country.toUpperCase();
      data.isEU = isEUCountry(input.country);
    }
    if (input.dataCategories !== undefined) data.dataCategories = input.dataCategories;
    if (input.purposes !== undefined) data.purposes = input.purposes;
    if (input.certifications !== undefined) data.certifications = input.certifications;

    const record = await this.prisma.dataProcessor.update({
      where: { id },
      data,
    });

    return this.mapToModel(record);
  }

  async updateStatus(id: string, status: ProcessorStatus): Promise<DataProcessor> {
    const record = await this.prisma.dataProcessor.update({
      where: { id },
      data: { status },
    });

    return this.mapToModel(record);
  }

  async recordDPA(
    id: string,
    dpaReference: string,
    signedAt: Date,
    expiresAt: Date
  ): Promise<DataProcessor> {
    const record = await this.prisma.dataProcessor.update({
      where: { id },
      data: {
        dpaReference,
        dpaSignedAt: signedAt,
        dpaExpiresAt: expiresAt,
      },
    });

    return this.mapToModel(record);
  }

  async setTransferMechanism(
    id: string,
    mechanism: TransferMechanism,
    sccReference?: string
  ): Promise<DataProcessor> {
    const data: Parameters<typeof this.prisma.dataProcessor.update>[0]['data'] = {
      transferMechanism: mechanism,
    };

    if (sccReference !== undefined) {
      data.sccReference = sccReference;
    }

    const record = await this.prisma.dataProcessor.update({
      where: { id },
      data,
    });

    return this.mapToModel(record);
  }

  async addSubProcessor(id: string, subProcessor: SubProcessor): Promise<DataProcessor> {
    const existing = await this.prisma.dataProcessor.findUnique({
      where: { id },
    });

    if (!existing) throw new Error('Processor not found');

    const subProcessors = (existing.subProcessors as unknown as SubProcessor[]) || [];
    subProcessors.push(subProcessor);

    const record = await this.prisma.dataProcessor.update({
      where: { id },
      data: {
        hasSubProcessors: true,
        subProcessors: subProcessors as unknown as object[],
      },
    });

    return this.mapToModel(record);
  }

  async removeSubProcessor(id: string, subProcessorName: string): Promise<DataProcessor> {
    const existing = await this.prisma.dataProcessor.findUnique({
      where: { id },
    });

    if (!existing) throw new Error('Processor not found');

    const subProcessors = (existing.subProcessors as unknown as SubProcessor[]) || [];
    const filtered = subProcessors.filter((sp) => sp.name !== subProcessorName);

    const record = await this.prisma.dataProcessor.update({
      where: { id },
      data: {
        hasSubProcessors: filtered.length > 0,
        subProcessors: filtered as unknown as object[],
      },
    });

    return this.mapToModel(record);
  }

  async recordAudit(
    id: string,
    auditDate: Date,
    complianceStatus: ComplianceStatus
  ): Promise<DataProcessor> {
    const record = await this.prisma.dataProcessor.update({
      where: { id },
      data: {
        lastAuditDate: auditDate,
        complianceStatus,
      },
    });

    return this.mapToModel(record);
  }

  async updateCertifications(id: string, certifications: string[]): Promise<DataProcessor> {
    const record = await this.prisma.dataProcessor.update({
      where: { id },
      data: { certifications },
    });

    return this.mapToModel(record);
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  private mapToModel(record: PrismaProcessor): DataProcessor {
    const model: DataProcessor = {
      id: record.id,
      entityId: record.entityId,
      name: record.name,
      country: record.country,
      isEU: record.isEU,
      dataCategories: record.dataCategories as DataProcessor['dataCategories'],
      purposes: record.purposes,
      hasSubProcessors: record.hasSubProcessors,
      complianceStatus: record.complianceStatus as ComplianceStatus,
      certifications: record.certifications,
      status: record.status as ProcessorStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
    };

    // Add optional fields only if they have values
    if (record.description) model.description = record.description;
    if (record.contactName) model.contactName = record.contactName;
    if (record.contactEmail) model.contactEmail = record.contactEmail;
    if (record.dpaReference) model.dpaReference = record.dpaReference;
    if (record.dpaSignedAt) model.dpaSignedAt = record.dpaSignedAt;
    if (record.dpaExpiresAt) model.dpaExpiresAt = record.dpaExpiresAt;
    if (record.transferMechanism) model.transferMechanism = record.transferMechanism as TransferMechanism;
    if (record.sccReference) model.sccReference = record.sccReference;
    if (record.lastAuditDate) model.lastAuditDate = record.lastAuditDate;
    if (record.subProcessors) {
      model.subProcessors = record.subProcessors as unknown as SubProcessor[];
    }

    return model;
  }
}
