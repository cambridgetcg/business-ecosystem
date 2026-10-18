/**
 * Prisma Implementation of DPIA Repository
 *
 * Note: The Prisma schema has fewer fields than the domain model.
 * We store review/approval metadata in JSON fields where needed.
 */

import type { PrismaClient, PrivacyImpactAssessment as PrismaDPIA } from '@prisma/client';
import type { DPIARepository } from '../../domain/privacy-impact/repositories/dpia.repository.js';
import type {
  PrivacyImpactAssessment,
  DPIAQueryFilter,
  CreateDPIAInput,
  UpdateDPIAInput,
  IdentifiedRisk,
  Mitigation,
  ResidualRisk,
  DPIAStatus,
} from '../../domain/privacy-impact/models/privacy-impact-assessment.js';

// Extended metadata stored in residualRisks JSON field
interface DPIAMetadata {
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  approvalNotes?: string;
}

export class PrismaDPIARepository implements DPIARepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<PrivacyImpactAssessment | null> {
    const record = await this.prisma.privacyImpactAssessment.findUnique({
      where: { id },
    });
    return record ? this.mapToModel(record) : null;
  }

  async findMany(
    filter: DPIAQueryFilter
  ): Promise<{ data: PrivacyImpactAssessment[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filter.entityId) where.entityId = filter.entityId;
    if (filter.status) where.status = filter.status;
    if (filter.processingActivityId) where.processingActivityId = filter.processingActivityId;

    const [data, total] = await Promise.all([
      this.prisma.privacyImpactAssessment.findMany({
        where,
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.privacyImpactAssessment.count({ where }),
    ]);

    return { data: data.map((r) => this.mapToModel(r)), total };
  }

  async create(
    input: CreateDPIAInput & { assessmentNumber: string }
  ): Promise<PrivacyImpactAssessment> {
    const data: Parameters<typeof this.prisma.privacyImpactAssessment.create>[0]['data'] = {
      assessmentNumber: input.assessmentNumber,
      entityId: input.entityId,
      title: input.title,
      description: input.description,
      necessity: input.necessity,
      proportionality: input.proportionality,
      createdBy: input.createdBy,
      status: 'DRAFT',
      dpoConsulted: false,
      authorityConsulted: false,
      risks: [],
      mitigations: [],
    };

    if (input.processingActivityId !== undefined) {
      data.processingActivityId = input.processingActivityId;
    }

    const record = await this.prisma.privacyImpactAssessment.create({ data });
    return this.mapToModel(record);
  }

  async update(id: string, input: UpdateDPIAInput): Promise<PrivacyImpactAssessment> {
    const data: Parameters<typeof this.prisma.privacyImpactAssessment.update>[0]['data'] = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.necessity !== undefined) data.necessity = input.necessity;
    if (input.proportionality !== undefined) data.proportionality = input.proportionality;

    const record = await this.prisma.privacyImpactAssessment.update({
      where: { id },
      data,
    });

    return this.mapToModel(record);
  }

  async updateStatus(id: string, status: DPIAStatus): Promise<PrivacyImpactAssessment> {
    const record = await this.prisma.privacyImpactAssessment.update({
      where: { id },
      data: { status },
    });

    return this.mapToModel(record);
  }

  async addRisk(id: string, risk: IdentifiedRisk): Promise<PrivacyImpactAssessment> {
    const existing = await this.prisma.privacyImpactAssessment.findUnique({
      where: { id },
    });

    if (!existing) throw new Error('DPIA not found');

    const risks = (existing.risks as unknown as IdentifiedRisk[]) || [];
    risks.push(risk);

    const record = await this.prisma.privacyImpactAssessment.update({
      where: { id },
      data: { risks: risks as unknown as object[], status: 'IN_PROGRESS' },
    });

    return this.mapToModel(record);
  }

  async addMitigation(id: string, mitigation: Mitigation): Promise<PrivacyImpactAssessment> {
    const existing = await this.prisma.privacyImpactAssessment.findUnique({
      where: { id },
    });

    if (!existing) throw new Error('DPIA not found');

    const mitigations = (existing.mitigations as unknown as Mitigation[]) || [];
    mitigations.push(mitigation);

    const record = await this.prisma.privacyImpactAssessment.update({
      where: { id },
      data: { mitigations: mitigations as unknown as object[] },
    });

    return this.mapToModel(record);
  }

  async updateMitigationStatus(
    id: string,
    mitigationId: string,
    status: Mitigation['status']
  ): Promise<PrivacyImpactAssessment> {
    const existing = await this.prisma.privacyImpactAssessment.findUnique({
      where: { id },
    });

    if (!existing) throw new Error('DPIA not found');

    const mitigations = (existing.mitigations as unknown as Mitigation[]) || [];
    const updated = mitigations.map((m) => (m.id === mitigationId ? { ...m, status } : m));

    const record = await this.prisma.privacyImpactAssessment.update({
      where: { id },
      data: { mitigations: updated as unknown as object[] },
    });

    return this.mapToModel(record);
  }

  async setResidualRisks(
    id: string,
    residualRisks: ResidualRisk[]
  ): Promise<PrivacyImpactAssessment> {
    const record = await this.prisma.privacyImpactAssessment.update({
      where: { id },
      data: { residualRisks: residualRisks as unknown as object[] },
    });

    return this.mapToModel(record);
  }

  async recordDPOConsultation(id: string, opinion: string): Promise<PrivacyImpactAssessment> {
    const record = await this.prisma.privacyImpactAssessment.update({
      where: { id },
      data: {
        dpoConsulted: true,
        dpoOpinion: opinion,
      },
    });

    return this.mapToModel(record);
  }

  async recordAuthorityConsultation(
    id: string,
    response: string
  ): Promise<PrivacyImpactAssessment> {
    const record = await this.prisma.privacyImpactAssessment.update({
      where: { id },
      data: {
        authorityConsulted: true,
        authorityResponse: response,
      },
    });

    return this.mapToModel(record);
  }

  async recordReview(
    id: string,
    reviewedBy: string,
    notes: string,
    newStatus: DPIAStatus
  ): Promise<PrivacyImpactAssessment> {
    // Get existing record to preserve residual risks data
    const existing = await this.prisma.privacyImpactAssessment.findUnique({
      where: { id },
    });

    // Store review metadata alongside residual risks
    const residualRisksData = existing?.residualRisks as unknown as { _metadata?: DPIAMetadata; risks?: ResidualRisk[] } | null;
    const updatedResidualRisks = {
      _metadata: {
        ...(residualRisksData?._metadata || {}),
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        reviewNotes: notes,
      },
      risks: residualRisksData?.risks || [],
    };

    const updateData: Parameters<typeof this.prisma.privacyImpactAssessment.update>[0]['data'] = {
      status: newStatus,
      residualRisks: updatedResidualRisks as unknown as object,
    };

    if (newStatus === 'PENDING_APPROVAL') {
      updateData.completedAt = new Date();
    }

    const record = await this.prisma.privacyImpactAssessment.update({
      where: { id },
      data: updateData,
    });

    return this.mapToModel(record);
  }

  async recordApproval(
    id: string,
    approvedBy: string,
    notes: string
  ): Promise<PrivacyImpactAssessment> {
    // Get existing record to preserve residual risks data
    const existing = await this.prisma.privacyImpactAssessment.findUnique({
      where: { id },
    });

    // Store approval metadata alongside residual risks
    const residualRisksData = existing?.residualRisks as unknown as { _metadata?: DPIAMetadata; risks?: ResidualRisk[] } | null;
    const updatedResidualRisks = {
      _metadata: {
        ...(residualRisksData?._metadata || {}),
        approvalNotes: notes,
      },
      risks: residualRisksData?.risks || [],
    };

    const record = await this.prisma.privacyImpactAssessment.update({
      where: { id },
      data: {
        approvedBy,
        approvedAt: new Date(),
        status: 'APPROVED',
        residualRisks: updatedResidualRisks as unknown as object,
      },
    });

    return this.mapToModel(record);
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  private mapToModel(record: PrismaDPIA): PrivacyImpactAssessment {
    // Extract metadata from residualRisks JSON if present
    const residualRisksData = record.residualRisks as unknown as { _metadata?: DPIAMetadata; risks?: ResidualRisk[] } | ResidualRisk[] | null;

    let residualRisks: ResidualRisk[] | undefined;
    let metadata: DPIAMetadata = {};

    if (residualRisksData) {
      if (Array.isArray(residualRisksData)) {
        residualRisks = residualRisksData;
      } else if ('risks' in residualRisksData) {
        residualRisks = residualRisksData.risks;
        metadata = residualRisksData._metadata || {};
      }
    }

    const model: PrivacyImpactAssessment = {
      id: record.id,
      entityId: record.entityId,
      assessmentNumber: record.assessmentNumber,
      title: record.title,
      description: record.description,
      necessity: record.necessity,
      proportionality: record.proportionality,
      risks: (record.risks as unknown as IdentifiedRisk[]) || [],
      mitigations: (record.mitigations as unknown as Mitigation[]) || [],
      dpoConsulted: record.dpoConsulted,
      authorityConsulted: record.authorityConsulted,
      status: record.status as DPIAStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
    };

    // Add optional fields only if they have values
    if (record.processingActivityId) model.processingActivityId = record.processingActivityId;
    if (residualRisks && residualRisks.length > 0) model.residualRisks = residualRisks;
    if (record.dpoOpinion) model.dpoOpinion = record.dpoOpinion;
    if (record.authorityResponse) model.authorityResponse = record.authorityResponse;
    if (metadata.reviewedBy) model.reviewedBy = metadata.reviewedBy;
    if (metadata.reviewedAt) model.reviewedAt = new Date(metadata.reviewedAt);
    if (metadata.reviewNotes) model.reviewNotes = metadata.reviewNotes;
    if (record.approvedBy) model.approvedBy = record.approvedBy;
    if (record.approvedAt) model.approvedAt = record.approvedAt;
    if (metadata.approvalNotes) model.approvalNotes = metadata.approvalNotes;

    return model;
  }
}
