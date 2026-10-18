/**
 * Enforcement Repository
 *
 * Persistence layer for enforcement matters.
 *
 * @module infrastructure/persistence
 */

import { eq, and, isNull, desc, inArray, like, gte, lte } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  enforcementMatters,
  enforcementActions,
  enforcementParties,
} from './schema.js';
import {
  EnforcementMatter,
  type EnforcementMatterProps,
  type EnforcementAction,
  type EnforcementParty,
  type EnforcementStatus,
  type EnforcementPriority,
  type EnforcementType,
  type IPAssetType,
} from '../../domain/entities/enforcement-matter.entity.js';

/**
 * Search filters for enforcement matters.
 */
export interface EnforcementSearchFilters {
  status?: EnforcementStatus | EnforcementStatus[];
  priority?: EnforcementPriority | EnforcementPriority[];
  type?: EnforcementType | EnforcementType[];
  ipAssetType?: IPAssetType;
  ipAssetId?: string;
  jurisdiction?: string;
  assignedTo?: string;
  searchTerm?: string;
  detectedAfter?: Date;
  detectedBefore?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Enforcement Repository
 */
export class EnforcementRepository {
  constructor(private readonly db: PostgresJsDatabase) {}

  /**
   * Find by ID.
   */
  async findById(id: string): Promise<EnforcementMatter | null> {
    const [matter] = await this.db
      .select()
      .from(enforcementMatters)
      .where(and(eq(enforcementMatters.id, id), isNull(enforcementMatters.deletedAt)));

    if (!matter) {
      return null;
    }

    // Load actions and parties
    const actions = await this.loadActions(id);
    const parties = await this.loadParties(id);

    return this.toDomain(matter, actions, parties);
  }

  /**
   * Find by matter number.
   */
  async findByMatterNumber(matterNumber: string): Promise<EnforcementMatter | null> {
    const [matter] = await this.db
      .select()
      .from(enforcementMatters)
      .where(
        and(
          eq(enforcementMatters.matterNumber, matterNumber),
          isNull(enforcementMatters.deletedAt)
        )
      );

    if (!matter) {
      return null;
    }

    const actions = await this.loadActions(matter.id);
    const parties = await this.loadParties(matter.id);

    return this.toDomain(matter, actions, parties);
  }

  /**
   * Find by IP asset.
   */
  async findByIPAsset(ipAssetType: IPAssetType, ipAssetId: string): Promise<EnforcementMatter[]> {
    const matters = await this.db
      .select()
      .from(enforcementMatters)
      .where(
        and(
          eq(enforcementMatters.ipAssetType, ipAssetType),
          eq(enforcementMatters.ipAssetId, ipAssetId),
          isNull(enforcementMatters.deletedAt)
        )
      )
      .orderBy(desc(enforcementMatters.detectedDate));

    return this.loadManyWithRelations(matters);
  }

  /**
   * Find by status.
   */
  async findByStatus(
    status: EnforcementStatus | EnforcementStatus[],
    limit = 50
  ): Promise<EnforcementMatter[]> {
    const statuses = Array.isArray(status) ? status : [status];

    const matters = await this.db
      .select()
      .from(enforcementMatters)
      .where(
        and(
          inArray(enforcementMatters.status, statuses),
          isNull(enforcementMatters.deletedAt)
        )
      )
      .orderBy(desc(enforcementMatters.detectedDate))
      .limit(limit);

    return this.loadManyWithRelations(matters);
  }

  /**
   * Find by priority.
   */
  async findByPriority(priority: EnforcementPriority, limit = 50): Promise<EnforcementMatter[]> {
    const matters = await this.db
      .select()
      .from(enforcementMatters)
      .where(
        and(
          eq(enforcementMatters.priority, priority),
          isNull(enforcementMatters.deletedAt)
        )
      )
      .orderBy(desc(enforcementMatters.detectedDate))
      .limit(limit);

    return this.loadManyWithRelations(matters);
  }

  /**
   * Find open matters assigned to user.
   */
  async findAssignedTo(userId: string): Promise<EnforcementMatter[]> {
    const matters = await this.db
      .select()
      .from(enforcementMatters)
      .where(
        and(
          eq(enforcementMatters.assignedTo, userId),
          isNull(enforcementMatters.deletedAt)
        )
      )
      .orderBy(desc(enforcementMatters.detectedDate));

    return this.loadManyWithRelations(matters);
  }

  /**
   * Search with filters.
   */
  async search(filters: EnforcementSearchFilters): Promise<{
    matters: EnforcementMatter[];
    total: number;
  }> {
    const conditions = [isNull(enforcementMatters.deletedAt)];

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(inArray(enforcementMatters.status, statuses));
    }

    if (filters.priority) {
      const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
      conditions.push(inArray(enforcementMatters.priority, priorities));
    }

    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      conditions.push(inArray(enforcementMatters.type, types));
    }

    if (filters.ipAssetType) {
      conditions.push(eq(enforcementMatters.ipAssetType, filters.ipAssetType));
    }

    if (filters.ipAssetId) {
      conditions.push(eq(enforcementMatters.ipAssetId, filters.ipAssetId));
    }

    if (filters.jurisdiction) {
      conditions.push(eq(enforcementMatters.jurisdiction, filters.jurisdiction));
    }

    if (filters.assignedTo) {
      conditions.push(eq(enforcementMatters.assignedTo, filters.assignedTo));
    }

    if (filters.searchTerm) {
      conditions.push(like(enforcementMatters.title, `%${filters.searchTerm}%`));
    }

    if (filters.detectedAfter) {
      conditions.push(gte(enforcementMatters.detectedDate, filters.detectedAfter.toISOString().split('T')[0]));
    }

    if (filters.detectedBefore) {
      conditions.push(lte(enforcementMatters.detectedDate, filters.detectedBefore.toISOString().split('T')[0]));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await this.db
      .select()
      .from(enforcementMatters)
      .where(whereClause);

    const total = countResult.length;

    // Get paginated results
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const matters = await this.db
      .select()
      .from(enforcementMatters)
      .where(whereClause)
      .orderBy(desc(enforcementMatters.detectedDate))
      .limit(limit)
      .offset(offset);

    const domainMatters = await this.loadManyWithRelations(matters);

    return { matters: domainMatters, total };
  }

  /**
   * Find matters with upcoming action deadlines.
   */
  async findWithUpcomingActions(daysAhead: number): Promise<EnforcementMatter[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const actionsWithDeadlines = await this.db
      .select({ matterId: enforcementActions.matterId })
      .from(enforcementActions)
      .where(
        and(
          eq(enforcementActions.status, 'pending'),
          isNull(enforcementActions.deletedAt),
          lte(enforcementActions.dueDate, futureDate.toISOString().split('T')[0])
        )
      );

    const matterIds = [...new Set(actionsWithDeadlines.map(a => a.matterId))];

    if (matterIds.length === 0) {
      return [];
    }

    const matters = await this.db
      .select()
      .from(enforcementMatters)
      .where(
        and(
          inArray(enforcementMatters.id, matterIds),
          isNull(enforcementMatters.deletedAt)
        )
      );

    return this.loadManyWithRelations(matters);
  }

  /**
   * Save an enforcement matter.
   */
  async save(matter: EnforcementMatter): Promise<void> {
    const props = matter.toPersistence();
    const now = new Date();

    // Check if exists
    const [existing] = await this.db
      .select({ id: enforcementMatters.id })
      .from(enforcementMatters)
      .where(eq(enforcementMatters.id, props.id));

    if (existing) {
      // Update
      await this.db
        .update(enforcementMatters)
        .set({
          matterNumber: props.matterNumber,
          title: props.title,
          description: props.description,
          type: props.type,
          status: props.status,
          priority: props.priority,
          ipAssetType: props.ipAssetType,
          ipAssetId: props.ipAssetId,
          additionalAssets: props.additionalAssets,
          jurisdiction: props.jurisdiction,
          venue: props.venue,
          caseNumber: props.caseNumber,
          detectedDate: props.detectedDate.toISOString().split('T')[0],
          openedDate: props.openedDate?.toISOString().split('T')[0],
          resolvedDate: props.resolvedDate?.toISOString().split('T')[0],
          estimatedDamages: props.estimatedDamages,
          actualDamages: props.actualDamages,
          settlementAmount: props.settlementAmount,
          estimatedCosts: props.estimatedCosts,
          actualCosts: props.actualCosts,
          outcome: props.outcome,
          outcomeNotes: props.outcomeNotes,
          assignedTo: props.assignedTo,
          tags: props.tags,
          updatedAt: now,
          version: props.version,
        })
        .where(eq(enforcementMatters.id, props.id));
    } else {
      // Insert
      await this.db.insert(enforcementMatters).values({
        id: props.id,
        matterNumber: props.matterNumber,
        title: props.title,
        description: props.description,
        type: props.type,
        status: props.status,
        priority: props.priority,
        ipAssetType: props.ipAssetType,
        ipAssetId: props.ipAssetId,
        additionalAssets: props.additionalAssets,
        jurisdiction: props.jurisdiction,
        venue: props.venue,
        caseNumber: props.caseNumber,
        detectedDate: props.detectedDate.toISOString().split('T')[0],
        openedDate: props.openedDate?.toISOString().split('T')[0],
        resolvedDate: props.resolvedDate?.toISOString().split('T')[0],
        estimatedDamages: props.estimatedDamages,
        actualDamages: props.actualDamages,
        settlementAmount: props.settlementAmount,
        estimatedCosts: props.estimatedCosts,
        actualCosts: props.actualCosts,
        outcome: props.outcome,
        outcomeNotes: props.outcomeNotes,
        assignedTo: props.assignedTo,
        tags: props.tags,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
    }

    // Save actions
    await this.saveActions(props.id, props.actions);

    // Save parties
    await this.saveParties(props.id, props.parties);
  }

  /**
   * Soft delete.
   */
  async delete(id: string): Promise<void> {
    await this.db
      .update(enforcementMatters)
      .set({ deletedAt: new Date() })
      .where(eq(enforcementMatters.id, id));
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async loadActions(matterId: string): Promise<EnforcementAction[]> {
    const rows = await this.db
      .select()
      .from(enforcementActions)
      .where(
        and(
          eq(enforcementActions.matterId, matterId),
          isNull(enforcementActions.deletedAt)
        )
      )
      .orderBy(desc(enforcementActions.createdAt));

    return rows.map(row => ({
      id: row.id,
      actionType: row.actionType,
      status: row.status,
      title: row.title,
      description: row.description ?? undefined,
      scheduledDate: row.scheduledDate ? new Date(row.scheduledDate) : undefined,
      dueDate: row.dueDate ? new Date(row.dueDate) : undefined,
      completedDate: row.completedDate ? new Date(row.completedDate) : undefined,
      filingNumber: row.filingNumber ?? undefined,
      courtName: row.courtName ?? undefined,
      judgeName: row.judgeName ?? undefined,
      responseReceived: row.responseReceived,
      responseDate: row.responseDate ? new Date(row.responseDate) : undefined,
      responseSummary: row.responseSummary ?? undefined,
      cost: row.cost ?? undefined,
      documents: (row.documents as EnforcementAction['documents']) ?? [],
      notes: row.notes ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  private async loadParties(matterId: string): Promise<EnforcementParty[]> {
    const rows = await this.db
      .select()
      .from(enforcementParties)
      .where(
        and(
          eq(enforcementParties.matterId, matterId),
          isNull(enforcementParties.deletedAt)
        )
      );

    return rows.map(row => ({
      id: row.id,
      role: row.role,
      name: row.name,
      organization: row.organization ?? undefined,
      contactEmail: row.contactEmail ?? undefined,
      contactPhone: row.contactPhone ?? undefined,
      address: row.address ?? undefined,
      barNumber: row.barNumber ?? undefined,
      firmName: row.firmName ?? undefined,
      internalContactId: row.internalContactId ?? undefined,
      notes: row.notes ?? undefined,
    }));
  }

  private async saveActions(matterId: string, actions: EnforcementAction[]): Promise<void> {
    // Get existing action IDs
    const existingActions = await this.db
      .select({ id: enforcementActions.id })
      .from(enforcementActions)
      .where(eq(enforcementActions.matterId, matterId));

    const existingIds = new Set(existingActions.map(a => a.id));
    const newIds = new Set(actions.map(a => a.id));

    // Delete removed actions
    for (const existingId of existingIds) {
      if (!newIds.has(existingId)) {
        await this.db
          .update(enforcementActions)
          .set({ deletedAt: new Date() })
          .where(eq(enforcementActions.id, existingId));
      }
    }

    // Upsert actions
    for (const action of actions) {
      if (existingIds.has(action.id)) {
        await this.db
          .update(enforcementActions)
          .set({
            actionType: action.actionType,
            status: action.status,
            title: action.title,
            description: action.description,
            scheduledDate: action.scheduledDate?.toISOString().split('T')[0],
            dueDate: action.dueDate?.toISOString().split('T')[0],
            completedDate: action.completedDate?.toISOString().split('T')[0],
            filingNumber: action.filingNumber,
            courtName: action.courtName,
            judgeName: action.judgeName,
            responseReceived: action.responseReceived,
            responseDate: action.responseDate?.toISOString().split('T')[0],
            responseSummary: action.responseSummary,
            cost: action.cost,
            documents: action.documents,
            notes: action.notes,
            updatedAt: new Date(),
          })
          .where(eq(enforcementActions.id, action.id));
      } else {
        await this.db.insert(enforcementActions).values({
          id: action.id,
          matterId,
          actionType: action.actionType,
          status: action.status,
          title: action.title,
          description: action.description,
          scheduledDate: action.scheduledDate?.toISOString().split('T')[0],
          dueDate: action.dueDate?.toISOString().split('T')[0],
          completedDate: action.completedDate?.toISOString().split('T')[0],
          filingNumber: action.filingNumber,
          courtName: action.courtName,
          judgeName: action.judgeName,
          responseReceived: action.responseReceived,
          responseDate: action.responseDate?.toISOString().split('T')[0],
          responseSummary: action.responseSummary,
          cost: action.cost,
          documents: action.documents,
          notes: action.notes,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        });
      }
    }
  }

  private async saveParties(matterId: string, parties: EnforcementParty[]): Promise<void> {
    // Get existing party IDs
    const existingParties = await this.db
      .select({ id: enforcementParties.id })
      .from(enforcementParties)
      .where(eq(enforcementParties.matterId, matterId));

    const existingIds = new Set(existingParties.map(p => p.id));
    const newIds = new Set(parties.map(p => p.id));

    // Delete removed parties
    for (const existingId of existingIds) {
      if (!newIds.has(existingId)) {
        await this.db
          .update(enforcementParties)
          .set({ deletedAt: new Date() })
          .where(eq(enforcementParties.id, existingId));
      }
    }

    // Upsert parties
    for (const party of parties) {
      if (existingIds.has(party.id)) {
        await this.db
          .update(enforcementParties)
          .set({
            role: party.role,
            name: party.name,
            organization: party.organization,
            contactEmail: party.contactEmail,
            contactPhone: party.contactPhone,
            address: party.address,
            barNumber: party.barNumber,
            firmName: party.firmName,
            internalContactId: party.internalContactId,
            notes: party.notes,
            updatedAt: new Date(),
          })
          .where(eq(enforcementParties.id, party.id));
      } else {
        await this.db.insert(enforcementParties).values({
          id: party.id,
          matterId,
          role: party.role,
          name: party.name,
          organization: party.organization,
          contactEmail: party.contactEmail,
          contactPhone: party.contactPhone,
          address: party.address,
          barNumber: party.barNumber,
          firmName: party.firmName,
          internalContactId: party.internalContactId,
          notes: party.notes,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        });
      }
    }
  }

  private async loadManyWithRelations(matters: typeof enforcementMatters.$inferSelect[]): Promise<EnforcementMatter[]> {
    const result: EnforcementMatter[] = [];

    for (const matter of matters) {
      const actions = await this.loadActions(matter.id);
      const parties = await this.loadParties(matter.id);
      result.push(this.toDomain(matter, actions, parties));
    }

    return result;
  }

  private toDomain(
    row: typeof enforcementMatters.$inferSelect,
    actions: EnforcementAction[],
    parties: EnforcementParty[]
  ): EnforcementMatter {
    return EnforcementMatter.fromPersistence({
      id: row.id,
      matterNumber: row.matterNumber ?? undefined,
      title: row.title,
      description: row.description ?? undefined,
      type: row.type,
      status: row.status,
      priority: row.priority,
      ipAssetType: row.ipAssetType as IPAssetType,
      ipAssetId: row.ipAssetId,
      additionalAssets: (row.additionalAssets as EnforcementMatterProps['additionalAssets']) ?? [],
      jurisdiction: row.jurisdiction,
      venue: row.venue ?? undefined,
      caseNumber: row.caseNumber ?? undefined,
      detectedDate: new Date(row.detectedDate),
      openedDate: row.openedDate ? new Date(row.openedDate) : undefined,
      resolvedDate: row.resolvedDate ? new Date(row.resolvedDate) : undefined,
      estimatedDamages: row.estimatedDamages ?? undefined,
      actualDamages: row.actualDamages ?? undefined,
      settlementAmount: row.settlementAmount ?? undefined,
      estimatedCosts: row.estimatedCosts ?? undefined,
      actualCosts: row.actualCosts ?? undefined,
      outcome: row.outcome ?? undefined,
      outcomeNotes: row.outcomeNotes ?? undefined,
      assignedTo: row.assignedTo ?? undefined,
      tags: (row.tags as string[]) ?? [],
      actions,
      parties,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  }
}
