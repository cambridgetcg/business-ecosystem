/**
 * Trade Secret Repository - Drizzle Implementation
 */

import { eq, and, isNull, sql, ilike, or } from 'drizzle-orm';
import {
  TradeSecret,
  type TradeSecretProps,
  type AccessListEntry,
} from '../../domain/entities/trade-secret.entity.js';
import { tradeSecrets } from './schema.js';
import type { Database } from './database.js';

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface FindAllOptions {
  limit?: number | undefined;
  offset?: number | undefined;
  status?: string | undefined;
  category?: string | undefined;
  sensitivityLevel?: string | undefined;
}

export interface CountFilters {
  status?: string | undefined;
  category?: string | undefined;
  ownerId?: string | undefined;
}

export interface TradeSecretRepository {
  findById(id: string): Promise<TradeSecret | null>;
  findByOwner(ownerId: string): Promise<TradeSecret[]>;
  findByCustodian(custodianId: string): Promise<TradeSecret[]>;
  findByUserAccess(userId: string): Promise<TradeSecret[]>;
  findAll(options?: FindAllOptions): Promise<TradeSecret[]>;
  search(query: string, limit?: number): Promise<TradeSecret[]>;
  save(tradeSecret: TradeSecret): Promise<void>;
  delete(id: string): Promise<void>;
  count(filters?: CountFilters): Promise<number>;
}

export class DrizzleTradeSecretRepository implements TradeSecretRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<TradeSecret | null> {
    const result = await this.db
      .select()
      .from(tradeSecrets)
      .where(and(eq(tradeSecrets.id, id), isNull(tradeSecrets.deletedAt)))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByOwner(ownerId: string): Promise<TradeSecret[]> {
    const results = await this.db
      .select()
      .from(tradeSecrets)
      .where(and(eq(tradeSecrets.ownerId, ownerId), isNull(tradeSecrets.deletedAt)));

    return results.map(r => this.toDomain(r));
  }

  async findByCustodian(custodianId: string): Promise<TradeSecret[]> {
    const results = await this.db
      .select()
      .from(tradeSecrets)
      .where(and(eq(tradeSecrets.custodianId, custodianId), isNull(tradeSecrets.deletedAt)));

    return results.map(r => this.toDomain(r));
  }

  async findByUserAccess(userId: string): Promise<TradeSecret[]> {
    // Find trade secrets where userId appears in the accessList JSONB array
    const results = await this.db
      .select()
      .from(tradeSecrets)
      .where(and(
        isNull(tradeSecrets.deletedAt),
        sql`${tradeSecrets.accessList} @> ${JSON.stringify([{ userId }])}::jsonb`
      ));

    return results.map(r => this.toDomain(r));
  }

  async findAll(options?: FindAllOptions): Promise<TradeSecret[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = [isNull(tradeSecrets.deletedAt)];
    if (options?.status) {
      conditions.push(eq(tradeSecrets.status, options.status as typeof tradeSecrets.status.enumValues[number]));
    }
    if (options?.category) {
      conditions.push(eq(tradeSecrets.category, options.category as typeof tradeSecrets.category.enumValues[number]));
    }
    if (options?.sensitivityLevel) {
      conditions.push(eq(tradeSecrets.sensitivityLevel, options.sensitivityLevel as typeof tradeSecrets.sensitivityLevel.enumValues[number]));
    }

    const results = await this.db
      .select()
      .from(tradeSecrets)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    return results.map(r => this.toDomain(r));
  }

  async search(query: string, limit = 50): Promise<TradeSecret[]> {
    const results = await this.db
      .select()
      .from(tradeSecrets)
      .where(and(
        isNull(tradeSecrets.deletedAt),
        or(
          ilike(tradeSecrets.title, `%${query}%`),
          ilike(tradeSecrets.description, `%${query}%`)
        )
      ))
      .limit(limit);

    return results.map(r => this.toDomain(r));
  }

  async save(tradeSecret: TradeSecret): Promise<void> {
    const data = this.toPersistence(tradeSecret);

    await this.db
      .insert(tradeSecrets)
      .values(data)
      .onConflictDoUpdate({
        target: tradeSecrets.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(tradeSecrets)
      .set({ deletedAt: new Date() })
      .where(eq(tradeSecrets.id, id));
  }

  async count(filters?: CountFilters): Promise<number> {
    const conditions = [isNull(tradeSecrets.deletedAt)];
    if (filters?.status) {
      conditions.push(eq(tradeSecrets.status, filters.status as typeof tradeSecrets.status.enumValues[number]));
    }
    if (filters?.category) {
      conditions.push(eq(tradeSecrets.category, filters.category as typeof tradeSecrets.category.enumValues[number]));
    }
    if (filters?.ownerId) {
      conditions.push(eq(tradeSecrets.ownerId, filters.ownerId));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(tradeSecrets)
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  }

  private toDomain(row: typeof tradeSecrets.$inferSelect): TradeSecret {
    const props: TradeSecretProps = {
      title: row.title,
      description: row.description,
      category: row.category,
      sensitivityLevel: row.sensitivityLevel,
      status: row.status,
      ownerId: row.ownerId,
      identifiedDate: new Date(row.identifiedDate),
      economicValueDescription: row.economicValueDescription,
      accessList: (row.accessList as AccessListEntry[]) ?? [],
      ...(row.custodianId && { custodianId: row.custodianId }),
      ...(row.lastReviewDate && { lastReviewDate: new Date(row.lastReviewDate) }),
      ...(row.estimatedValue && { estimatedValue: row.estimatedValue }),
    };

    return TradeSecret.reconstitute(row.id, props);
  }

  private toPersistence(tradeSecret: TradeSecret): typeof tradeSecrets.$inferInsert {
    return {
      id: tradeSecret.id,
      title: tradeSecret.title,
      description: tradeSecret.description,
      category: tradeSecret.category,
      sensitivityLevel: tradeSecret.sensitivityLevel,
      status: tradeSecret.status,
      ownerId: tradeSecret.ownerId,
      custodianId: tradeSecret.custodianId ?? null,
      identifiedDate: toDateString(tradeSecret.identifiedDate),
      lastReviewDate: tradeSecret.lastReviewDate ? toDateString(tradeSecret.lastReviewDate) : null,
      economicValueDescription: tradeSecret.economicValueDescription,
      estimatedValue: tradeSecret.estimatedValue ?? null,
      accessList: tradeSecret.accessList,
      createdAt: tradeSecret.createdAt,
      updatedAt: tradeSecret.updatedAt,
      createdBy: tradeSecret.createdBy ?? null,
      updatedBy: tradeSecret.updatedBy ?? null,
      version: tradeSecret.version,
    };
  }
}
