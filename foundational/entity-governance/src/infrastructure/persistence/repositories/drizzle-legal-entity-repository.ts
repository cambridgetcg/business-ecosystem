/**
 * Drizzle Implementation of Legal Entity Repository
 */

import { eq, and, isNull, ilike, or, sql, count } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import {
  legalEntities,
  parentSubsidiaryRelationships,
} from '../schema.js';
import type * as schema from '../schema.js';
import type {
  LegalEntityRepository,
  LegalEntityFilters,
  PaginationOptions,
  PaginatedResult,
} from '../../../domain/entity/repositories/legal-entity-repository.js';
import type {
  LegalEntity,
  CreateLegalEntityInput,
  UpdateLegalEntityInput,
} from '../../../domain/entity/models/legal-entity.js';

type DbType = NodePgDatabase<typeof schema>;

export class DrizzleLegalEntityRepository implements LegalEntityRepository {
  constructor(private readonly db: DbType) {}

  async findById(id: string): Promise<LegalEntity | null> {
    const result = await this.db
      .select()
      .from(legalEntities)
      .where(and(eq(legalEntities.id, id), isNull(legalEntities.deletedAt)))
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async findMany(
    filters?: LegalEntityFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<LegalEntity>> {
    const conditions = [isNull(legalEntities.deletedAt)];

    if (filters?.status) {
      conditions.push(eq(legalEntities.status, filters.status as any));
    }
    if (filters?.entityType) {
      conditions.push(eq(legalEntities.entityType, filters.entityType as any));
    }
    if (filters?.jurisdictionCountry) {
      conditions.push(eq(legalEntities.jurisdictionCountry, filters.jurisdictionCountry));
    }
    if (filters?.jurisdictionState) {
      conditions.push(eq(legalEntities.jurisdictionState, filters.jurisdictionState));
    }
    if (filters?.searchTerm) {
      conditions.push(
        or(
          ilike(legalEntities.name, '%' + filters.searchTerm + '%'),
          ilike(legalEntities.legalName, '%' + filters.searchTerm + '%')
        )!
      );
    }

    const whereClause = and(...conditions);
    const limit = pagination?.limit ?? 20;
    const offset = pagination?.offset ?? 0;

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(legalEntities)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(legalEntities.createdAt),
      this.db
        .select({ count: count() })
        .from(legalEntities)
        .where(whereClause),
    ]);

    return {
      data: data.map(row => this.toDomain(row)),
      total: totalResult[0]?.count ?? 0,
      limit,
      offset,
    };
  }

  async findSubsidiaries(parentEntityId: string): Promise<LegalEntity[]> {
    const relationships = await this.db
      .select({ subsidiaryId: parentSubsidiaryRelationships.subsidiaryEntityId })
      .from(parentSubsidiaryRelationships)
      .where(
        and(
          eq(parentSubsidiaryRelationships.parentEntityId, parentEntityId),
          isNull(parentSubsidiaryRelationships.endDate),
          isNull(parentSubsidiaryRelationships.deletedAt)
        )
      );

    if (relationships.length === 0) return [];

    const subsidiaryIds = relationships.map(r => r.subsidiaryId);
    const results = await this.db
      .select()
      .from(legalEntities)
      .where(
        and(
          sql`${legalEntities.id} IN ${subsidiaryIds}`,
          isNull(legalEntities.deletedAt)
        )
      );

    return results.map(row => this.toDomain(row));
  }

  async findParent(subsidiaryEntityId: string): Promise<LegalEntity | null> {
    const relationship = await this.db
      .select({ parentId: parentSubsidiaryRelationships.parentEntityId })
      .from(parentSubsidiaryRelationships)
      .where(
        and(
          eq(parentSubsidiaryRelationships.subsidiaryEntityId, subsidiaryEntityId),
          isNull(parentSubsidiaryRelationships.endDate),
          isNull(parentSubsidiaryRelationships.deletedAt)
        )
      )
      .limit(1);

    if (!relationship[0]) return null;

    return this.findById(relationship[0].parentId);
  }

  async create(input: CreateLegalEntityInput, createdBy?: string): Promise<LegalEntity> {
    const id = randomUUID();
    const now = new Date();

    const values: Record<string, unknown> = {
      id,
      name: input.name,
      legalName: input.legalName,
      entityType: input.entityType,
      status: 'active' as const,
      jurisdictionCountry: input.jurisdictionCountry,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    if (input.jurisdictionState !== undefined) {
      values.jurisdictionState = input.jurisdictionState;
    }
    if (input.incorporationDate !== undefined) {
      values.incorporationDate = input.incorporationDate;
    }
    if (input.taxId !== undefined) {
      values.taxId = input.taxId;
    }
    if (input.registrationNumber !== undefined) {
      values.registrationNumber = input.registrationNumber;
    }
    if (input.metadata !== undefined) {
      values.metadata = input.metadata;
    }
    if (createdBy !== undefined) {
      values.createdBy = createdBy;
    }

    const [result] = await this.db
      .insert(legalEntities)
      .values(values as any)
      .returning();

    if (!result) { throw new Error('Failed to create entity'); } return this.toDomain(result);
  }

  async update(id: string, input: UpdateLegalEntityInput, updatedBy?: string): Promise<LegalEntity> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      version: sql`${legalEntities.version} + 1`,
    };

    if (input.name !== undefined) {
      updates.name = input.name;
    }
    if (input.legalName !== undefined) {
      updates.legalName = input.legalName;
    }
    if (input.status !== undefined) {
      updates.status = input.status;
    }
    if (input.taxId !== undefined) {
      updates.taxId = input.taxId;
    }
    if (input.registrationNumber !== undefined) {
      updates.registrationNumber = input.registrationNumber;
    }
    if (input.metadata !== undefined) {
      updates.metadata = input.metadata;
    }
    if (updatedBy !== undefined) {
      updates.updatedBy = updatedBy;
    }

    const [result] = await this.db
      .update(legalEntities)
      .set(updates as any)
      .where(and(eq(legalEntities.id, id), isNull(legalEntities.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('Entity not found: ' + id);
    }

    if (!result) { throw new Error('Failed to create entity'); } return this.toDomain(result);
  }

  async delete(id: string, deletedBy?: string): Promise<void> {
    const updates: Record<string, unknown> = {
      deletedAt: new Date(),
    };
    if (deletedBy !== undefined) {
      updates.updatedBy = deletedBy;
    }

    await this.db
      .update(legalEntities)
      .set(updates as any)
      .where(and(eq(legalEntities.id, id), isNull(legalEntities.deletedAt)));
  }

  async updateTaxId(entityId: string, taxId: string): Promise<void> {
    await this.db
      .update(legalEntities)
      .set({
        taxId,
        updatedAt: new Date(),
      })
      .where(eq(legalEntities.id, entityId));
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.db
      .select({ id: legalEntities.id })
      .from(legalEntities)
      .where(and(eq(legalEntities.id, id), isNull(legalEntities.deletedAt)))
      .limit(1);

    return result.length > 0;
  }

  async count(filters?: LegalEntityFilters): Promise<number> {
    const conditions = [isNull(legalEntities.deletedAt)];

    if (filters?.status) {
      conditions.push(eq(legalEntities.status, filters.status as any));
    }
    if (filters?.entityType) {
      conditions.push(eq(legalEntities.entityType, filters.entityType as any));
    }

    const [result] = await this.db
      .select({ count: count() })
      .from(legalEntities)
      .where(and(...conditions));

    return result?.count ?? 0;
  }

  private toDomain(row: typeof legalEntities.$inferSelect): LegalEntity {
    return {
      id: row.id,
      name: row.name,
      legalName: row.legalName,
      entityType: row.entityType,
      status: row.status,
      jurisdiction: {
        country: row.jurisdictionCountry,
        state: row.jurisdictionState ?? undefined,
      },
      incorporationDate: row.incorporationDate ?? undefined,
      dissolutionDate: row.dissolutionDate ?? undefined,
      taxId: row.taxId ?? undefined,
      registrationNumber: row.registrationNumber ?? undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy ?? undefined,
      updatedBy: row.updatedBy ?? undefined,
      version: row.version,
      deletedAt: row.deletedAt ?? undefined,
    };
  }
}
