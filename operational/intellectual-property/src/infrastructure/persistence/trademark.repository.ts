/**
 * Trademark Repository - Drizzle Implementation
 */

import { eq, and, isNull, sql, ilike } from 'drizzle-orm';
import { Trademark, type TrademarkProps, type NiceClassification } from '../../domain/entities/trademark.entity.js';
import { trademarks } from './schema.js';
import type { Database } from './database.js';

export interface FindAllOptions {
  limit?: number | undefined;
  offset?: number | undefined;
  status?: string | undefined;
}

export interface CountFilters {
  status?: string | undefined;
  ownerId?: string | undefined;
}

export interface TrademarkRepository {
  findById(id: string): Promise<Trademark | null>;
  findByRegistrationNumber(regNumber: string): Promise<Trademark | null>;
  findByOwnerId(ownerId: string): Promise<Trademark[]>;
  findAll(options?: FindAllOptions): Promise<Trademark[]>;
  search(query: string): Promise<Trademark[]>;
  save(trademark: Trademark): Promise<void>;
  delete(id: string): Promise<void>;
  count(filters?: CountFilters): Promise<number>;
}

export class DrizzleTrademarkRepository implements TrademarkRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Trademark | null> {
    const result = await this.db
      .select()
      .from(trademarks)
      .where(and(eq(trademarks.id, id), isNull(trademarks.deletedAt)))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByRegistrationNumber(regNumber: string): Promise<Trademark | null> {
    const result = await this.db
      .select()
      .from(trademarks)
      .where(and(eq(trademarks.registrationNumber, regNumber), isNull(trademarks.deletedAt)))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByOwnerId(ownerId: string): Promise<Trademark[]> {
    const results = await this.db
      .select()
      .from(trademarks)
      .where(and(eq(trademarks.ownerId, ownerId), isNull(trademarks.deletedAt)));

    return results.map(r => this.toDomain(r));
  }

  async findAll(options?: FindAllOptions): Promise<Trademark[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = [isNull(trademarks.deletedAt)];
    if (options?.status) {
      conditions.push(eq(trademarks.status, options.status as typeof trademarks.status.enumValues[number]));
    }

    const results = await this.db
      .select()
      .from(trademarks)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    return results.map(r => this.toDomain(r));
  }

  async search(query: string): Promise<Trademark[]> {
    const results = await this.db
      .select()
      .from(trademarks)
      .where(and(
        isNull(trademarks.deletedAt),
        ilike(trademarks.mark, `%${query}%`)
      ))
      .limit(50);

    return results.map(r => this.toDomain(r));
  }

  async save(trademark: Trademark): Promise<void> {
    const data = this.toPersistence(trademark);

    await this.db
      .insert(trademarks)
      .values(data)
      .onConflictDoUpdate({
        target: trademarks.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(trademarks)
      .set({ deletedAt: new Date() })
      .where(eq(trademarks.id, id));
  }

  async count(filters?: CountFilters): Promise<number> {
    const conditions = [isNull(trademarks.deletedAt)];
    if (filters?.status) {
      conditions.push(eq(trademarks.status, filters.status as typeof trademarks.status.enumValues[number]));
    }
    if (filters?.ownerId) {
      conditions.push(eq(trademarks.ownerId, filters.ownerId));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(trademarks)
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  }

  private toDomain(row: typeof trademarks.$inferSelect): Trademark {
    const props: TrademarkProps = {
      applicationNumber: row.applicationNumber ?? undefined,
      registrationNumber: row.registrationNumber ?? undefined,
      mark: row.mark,
      description: row.description ?? undefined,
      type: row.type,
      status: row.status,
      filingDate: row.filingDate ? new Date(row.filingDate) : undefined,
      registrationDate: row.registrationDate ? new Date(row.registrationDate) : undefined,
      expirationDate: row.expirationDate ? new Date(row.expirationDate) : undefined,
      renewalDate: row.renewalDate ? new Date(row.renewalDate) : undefined,
      ownerId: row.ownerId,
      niceClasses: row.niceClasses as NiceClassification[],
      jurisdictions: row.jurisdictions as string[],
      logoUrl: row.logoUrl ?? undefined,
    };

    return Trademark.reconstitute(row.id, props);
  }

  private toPersistence(trademark: Trademark): typeof trademarks.$inferInsert {
    return {
      id: trademark.id,
      applicationNumber: trademark.applicationNumber ?? null,
      registrationNumber: trademark.registrationNumber ?? null,
      mark: trademark.mark,
      description: trademark.description ?? null,
      type: trademark.type,
      status: trademark.status,
      filingDate: trademark.filingDate?.toISOString().split('T')[0] ?? null,
      registrationDate: trademark.registrationDate?.toISOString().split('T')[0] ?? null,
      expirationDate: trademark.expirationDate?.toISOString().split('T')[0] ?? null,
      renewalDate: trademark.renewalDate?.toISOString().split('T')[0] ?? null,
      ownerId: trademark.ownerId,
      niceClasses: trademark.niceClasses,
      jurisdictions: trademark.jurisdictions,
      logoUrl: trademark.logoUrl ?? null,
      createdAt: trademark.createdAt,
      updatedAt: trademark.updatedAt,
      createdBy: trademark.createdBy ?? null,
      updatedBy: trademark.updatedBy ?? null,
      version: trademark.version,
    };
  }
}
