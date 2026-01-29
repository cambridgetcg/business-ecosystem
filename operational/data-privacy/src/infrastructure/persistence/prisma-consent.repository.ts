/**
 * Prisma Implementation of Consent Repository
 */

import type { PrismaClient } from '@prisma/client';
import type { ConsentRepository } from '../../domain/consent-management/repositories/consent.repository.js';
import type {
  ConsentRecord,
  ConsentQueryFilter,
  GrantConsentInput,
  ConsentStatus,
  CaptureMethod,
} from '../../domain/consent-management/models/consent-record.js';

export class PrismaConsentRepository implements ConsentRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<ConsentRecord | null> {
    const record = await this.prisma.consentRecord.findUnique({
      where: { id },
    });
    return record as ConsentRecord | null;
  }

  async findMany(filter: ConsentQueryFilter): Promise<{ data: ConsentRecord[]; total: number }> {
    const where = {
      ...(filter.entityId && { entityId: filter.entityId }),
      ...(filter.subjectId && { subjectId: filter.subjectId }),
      ...(filter.purpose && { purpose: filter.purpose }),
      ...(filter.status && { status: filter.status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.consentRecord.findMany({
        where,
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
        orderBy: { grantedAt: 'desc' },
      }),
      this.prisma.consentRecord.count({ where }),
    ]);

    return { data: data as ConsentRecord[], total };
  }

  async findBySubject(subjectId: string): Promise<ConsentRecord[]> {
    const records = await this.prisma.consentRecord.findMany({
      where: { subjectId },
      orderBy: { grantedAt: 'desc' },
    });
    return records as ConsentRecord[];
  }

  async findByEntity(entityId: string): Promise<ConsentRecord[]> {
    const records = await this.prisma.consentRecord.findMany({
      where: { entityId },
      orderBy: { grantedAt: 'desc' },
    });
    return records as ConsentRecord[];
  }

  async findActiveConsent(subjectId: string, purpose: string): Promise<ConsentRecord | null> {
    const record = await this.prisma.consentRecord.findFirst({
      where: {
        subjectId,
        purpose,
        status: 'ACTIVE',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
    return record as ConsentRecord | null;
  }

  async create(input: GrantConsentInput): Promise<ConsentRecord> {
    // Build data object, only including defined values
    const data: Parameters<typeof this.prisma.consentRecord.create>[0]['data'] = {
      entityId: input.entityId,
      subjectId: input.subjectId,
      purpose: input.purpose,
      lawfulBasis: input.lawfulBasis,
      status: 'ACTIVE',
      grantedAt: input.grantedAt,
      subjectType: input.subjectType ?? 'CUSTOMER',
      captureMethod: input.captureMethod ?? 'FORM',
    };

    // Only add optional fields if they have values
    if (input.subjectEmail !== undefined) data.subjectEmail = input.subjectEmail;
    if (input.purposeGroup !== undefined) data.purposeGroup = input.purposeGroup;
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt;
    if (input.proofRef !== undefined) data.proofRef = input.proofRef;
    if (input.sourceSystem !== undefined) data.sourceSystem = input.sourceSystem;
    if (input.version !== undefined) data.version = input.version;
    if (input.createdBy !== undefined) data.createdBy = input.createdBy;

    const record = await this.prisma.consentRecord.create({ data });
    return record as ConsentRecord;
  }

  async updateStatus(
    id: string,
    status: ConsentStatus,
    metadata?: {
      withdrawnAt?: Date | undefined;
      withdrawalReason?: string | undefined;
      withdrawalMethod?: CaptureMethod | undefined;
    }
  ): Promise<ConsentRecord> {
    const data: Parameters<typeof this.prisma.consentRecord.update>[0]['data'] = { status };

    if (metadata?.withdrawnAt !== undefined) data.withdrawnAt = metadata.withdrawnAt;
    if (metadata?.withdrawalReason !== undefined) data.withdrawalReason = metadata.withdrawalReason;
    if (metadata?.withdrawalMethod !== undefined) data.withdrawalMethod = metadata.withdrawalMethod;

    const record = await this.prisma.consentRecord.update({ where: { id }, data });
    return record as ConsentRecord;
  }

  async count(filter: Omit<ConsentQueryFilter, 'limit' | 'offset'>): Promise<number> {
    return this.prisma.consentRecord.count({
      where: {
        ...(filter.entityId && { entityId: filter.entityId }),
        ...(filter.subjectId && { subjectId: filter.subjectId }),
        ...(filter.purpose && { purpose: filter.purpose }),
        ...(filter.status && { status: filter.status }),
      },
    });
  }
}
