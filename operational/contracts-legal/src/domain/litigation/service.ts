/**
 * Litigation / Legal Matters - Service Layer
 */

import { nanoid } from 'nanoid';
import { Prisma } from '#prisma';
import { LitigationRepository, MatterWithActivities } from './repository.js';
import { CreateMatterInput, UpdateMatterInput, CloseMatterInput, MatterActivityInput, MatterQuery } from './validators.js';
import { NotFoundError, BusinessRuleError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export class LitigationService {
  private log = logger.child({ domain: 'litigation' });

  constructor(private repository: LitigationRepository) {}

  async getMatter(id: string): Promise<MatterWithActivities> {
    const matter = await this.repository.findById(id);
    if (!matter) {
      throw new NotFoundError('Legal Matter', id);
    }
    return matter;
  }

  async listMatters(query: MatterQuery) {
    const { data, total } = await this.repository.findMany(query);
    return { data, total, page: query.page, limit: query.limit };
  }

  async createMatter(input: CreateMatterInput, userId: string): Promise<MatterWithActivities> {
    const matterNumber = this.generateMatterNumber();

    const createData: Prisma.LegalMatterCreateInput = {
      matterNumber,
      title: input.title,
      type: input.type,
      status: 'OPEN',
      priority: input.priority,
      createdBy: userId,
      contractIds: input.contractIds || [],
    };

    if (input.description) createData.description = input.description;
    if (input.internalLead) createData.internalLead = input.internalLead;
    if (input.externalCounsel) createData.externalCounsel = input.externalCounsel;
    if (input.opposingParty) createData.opposingParty = input.opposingParty;
    if (input.court) createData.court = input.court;
    if (input.jurisdiction) createData.jurisdiction = input.jurisdiction;
    if (input.caseNumber) createData.caseNumber = input.caseNumber;
    if (input.filedDate) createData.filedDate = input.filedDate;
    if (input.hearingDate) createData.hearingDate = input.hearingDate;
    if (input.estimatedCost) createData.estimatedCost = input.estimatedCost;

    const matter = await this.repository.create(createData);
    
    // Add creation activity
    await this.repository.addActivity(matter.id, {
      type: 'CREATED',
      description: 'Legal matter created',
      performedBy: userId,
    });

    this.log.info({ matterId: matter.id, matterNumber }, 'Legal matter created');
    return matter;
  }

  async updateMatter(id: string, input: UpdateMatterInput, userId: string): Promise<MatterWithActivities> {
    const existing = await this.getMatter(id);

    if (['SETTLED', 'WON', 'LOST', 'DISMISSED', 'CLOSED'].includes(existing.status)) {
      throw new BusinessRuleError('Cannot update a closed legal matter');
    }

    const updateData: Prisma.LegalMatterUpdateInput = {};
    if (input.title) updateData.title = input.title;
    if (input.description) updateData.description = input.description;
    if (input.type) updateData.type = input.type;
    if (input.status) updateData.status = input.status;
    if (input.priority) updateData.priority = input.priority;
    if (input.contractIds) updateData.contractIds = input.contractIds;
    if (input.internalLead) updateData.internalLead = input.internalLead;
    if (input.externalCounsel) updateData.externalCounsel = input.externalCounsel;
    if (input.opposingParty) updateData.opposingParty = input.opposingParty;
    if (input.court) updateData.court = input.court;
    if (input.jurisdiction) updateData.jurisdiction = input.jurisdiction;
    if (input.caseNumber) updateData.caseNumber = input.caseNumber;
    if (input.filedDate) updateData.filedDate = input.filedDate;
    if (input.hearingDate) updateData.hearingDate = input.hearingDate;
    if (input.estimatedCost) updateData.estimatedCost = input.estimatedCost;
    if (input.actualCost) updateData.actualCost = input.actualCost;

    const matter = await this.repository.update(id, updateData);

    // Add update activity
    await this.repository.addActivity(id, {
      type: 'UPDATED',
      description: 'Legal matter updated',
      performedBy: userId,
    });

    this.log.info({ matterId: id }, 'Legal matter updated');
    return matter;
  }

  async closeMatter(id: string, input: CloseMatterInput, userId: string): Promise<MatterWithActivities> {
    const existing = await this.getMatter(id);

    if (['SETTLED', 'WON', 'LOST', 'DISMISSED', 'CLOSED'].includes(existing.status)) {
      throw new BusinessRuleError('Legal matter is already closed');
    }

    const updateData: Prisma.LegalMatterUpdateInput = {
      status: input.outcome,
      closedDate: new Date(),
    };

    if (input.settlement) updateData.settlement = input.settlement;
    if (input.actualCost) updateData.actualCost = input.actualCost;

    const matter = await this.repository.update(id, updateData);

    // Add close activity
    await this.repository.addActivity(id, {
      type: 'CLOSED',
      description: 'Legal matter closed with outcome: ' + input.outcome + (input.notes ? '. ' + input.notes : ''),
      performedBy: userId,
      metadata: { outcome: input.outcome, settlement: input.settlement },
    });

    this.log.info({ matterId: id, outcome: input.outcome }, 'Legal matter closed');
    return matter;
  }

  async addActivity(matterId: string, input: MatterActivityInput, userId: string) {
    const existing = await this.getMatter(matterId);

    const activity = await this.repository.addActivity(matterId, {
      type: input.type,
      description: input.description,
      metadata: input.metadata as Prisma.InputJsonValue,
      performedBy: userId,
    });

    this.log.info({ matterId, activityId: activity.id }, 'Activity added to legal matter');
    return activity;
  }

  async getActivities(matterId: string, limit: number = 50) {
    await this.getMatter(matterId); // Verify exists
    return this.repository.getActivities(matterId, limit);
  }

  async deleteMatter(id: string) {
    const existing = await this.getMatter(id);

    if (!['OPEN', 'UNDER_REVIEW'].includes(existing.status)) {
      throw new BusinessRuleError('Can only delete matters in OPEN or UNDER_REVIEW status');
    }

    await this.repository.delete(id);
    this.log.info({ matterId: id }, 'Legal matter deleted');
  }

  async getStatistics() {
    const [byType, exposure, upcomingHearings] = await Promise.all([
      this.repository.getStatsByType(),
      this.repository.getTotalExposure(),
      this.repository.getUpcomingHearings(30),
    ]);

    return {
      byType,
      exposure,
      upcomingHearingsCount: upcomingHearings.length,
      upcomingHearings: upcomingHearings.slice(0, 5),
    };
  }

  async getUpcomingHearings(daysAhead: number = 30) {
    return this.repository.getUpcomingHearings(daysAhead);
  }

  private generateMatterNumber(): string {
    const year = new Date().getFullYear();
    const random = nanoid(6).toUpperCase();
    return 'MAT-' + year + '-' + random;
  }
}

export function createLitigationService(repository: LitigationRepository): LitigationService {
  return new LitigationService(repository);
}
