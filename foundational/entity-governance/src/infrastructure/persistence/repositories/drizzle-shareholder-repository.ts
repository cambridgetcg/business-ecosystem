/**
 * Drizzle Implementation of Shareholder Repository
 */

import { eq, and, isNull, count } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { shareholders } from '../schema.js';
import type * as schema from '../schema.js';
import type {
  ShareholderRepository,
  ShareholderFilters,
} from '../../../domain/shareholder/repositories/shareholder-repository.js';
import type {
  Shareholder,
  CreateShareholderInput,
  UpdateShareholderInput,
} from '../../../domain/shareholder/models/shareholder.js';
import type { Address } from '../../../domain/value-objects/index.js';

type DbType = NodePgDatabase<typeof schema>;

export class DrizzleShareholderRepository implements ShareholderRepository {
  constructor(private readonly db: DbType) {}

  async findById(id: string): Promise<Shareholder | null> {
    const result = await this.db
      .select()
      .from(shareholders)
      .where(and(eq(shareholders.id, id), isNull(shareholders.deletedAt)))
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async findByEntityId(entityId: string): Promise<Shareholder[]> {
    const results = await this.db
      .select()
      .from(shareholders)
      .where(
        and(
          eq(shareholders.entityId, entityId),
          isNull(shareholders.deletedAt)
        )
      )
      .orderBy(shareholders.createdAt);

    return results.map(row => this.toDomain(row));
  }

  async findMany(filters?: ShareholderFilters): Promise<Shareholder[]> {
    const conditions = [isNull(shareholders.deletedAt)];

    if (filters?.entityId) {
      conditions.push(eq(shareholders.entityId, filters.entityId));
    }
    if (filters?.shareholderType) {
      conditions.push(eq(shareholders.shareholderType, filters.shareholderType));
    }

    const results = await this.db
      .select()
      .from(shareholders)
      .where(and(...conditions))
      .orderBy(shareholders.createdAt);

    return results.map(row => this.toDomain(row));
  }

  async create(input: CreateShareholderInput, createdBy?: string): Promise<Shareholder> {
    const id = randomUUID();
    const now = new Date();

    const values = {
      id,
      entityId: input.entityId,
      shareholderType: input.shareholderType,
      name: input.name,
      taxId: input.taxId ?? null,
      contactEmail: input.contactEmail ?? null,
      address: input.address ?? null,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ?? null,
      version: 1,
    };

    const result = await this.db.insert(shareholders).values(values).returning();

    return this.toDomain(result[0]!);
  }

  async update(id: string, input: UpdateShareholderInput, updatedBy?: string): Promise<Shareholder> {
    const now = new Date();

    const values: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: updatedBy ?? null,
    };

    if (input.name !== undefined) values.name = input.name;
    if (input.taxId !== undefined) values.taxId = input.taxId;
    if (input.contactEmail !== undefined) values.contactEmail = input.contactEmail;
    if (input.address !== undefined) values.address = input.address;
    if (input.metadata !== undefined) values.metadata = input.metadata;

    const result = await this.db
      .update(shareholders)
      .set(values)
      .where(and(eq(shareholders.id, id), isNull(shareholders.deletedAt)))
      .returning();

    if (!result[0]) {
      throw new Error('Shareholder not found: ' + id);
    }

    return this.toDomain(result[0]);
  }

  async delete(id: string, deletedBy?: string): Promise<void> {
    const result = await this.db
      .update(shareholders)
      .set({
        deletedAt: new Date(),
        updatedBy: deletedBy ?? null,
      })
      .where(and(eq(shareholders.id, id), isNull(shareholders.deletedAt)))
      .returning({ id: shareholders.id });

    if (!result[0]) {
      throw new Error('Shareholder not found: ' + id);
    }
  }

  async countByEntityId(entityId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(shareholders)
      .where(
        and(
          eq(shareholders.entityId, entityId),
          isNull(shareholders.deletedAt)
        )
      );

    return result[0]?.count ?? 0;
  }

  private toDomain(row: typeof shareholders.$inferSelect): Shareholder {
    return {
      id: row.id,
      entityId: row.entityId,
      shareholderType: row.shareholderType as Shareholder['shareholderType'],
      name: row.name,
      taxId: row.taxId,
      contactEmail: row.contactEmail,
      address: row.address as Address | null,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      version: row.version,
    };
  }
}
