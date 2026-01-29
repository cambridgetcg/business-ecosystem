/**
 * Patent Repository - Drizzle Implementation
 */

import { eq, and, isNull, sql, ilike } from 'drizzle-orm';
import { Patent, type PatentProps, type PatentClaim } from '../../domain/entities/patent.entity.js';
import { patents } from './schema.js';
import type { Database } from './database.js';

export interface FindAllOptions {
  limit?: number | undefined;
  offset?: number | undefined;
  status?: string | undefined;
}

export interface CountFilters {
  status?: string | undefined;
}

export interface PatentRepository {
  findById(id: string): Promise<Patent | null>;
  findByApplicationNumber(appNumber: string): Promise<Patent | null>;
  findByPatentNumber(patentNumber: string): Promise<Patent | null>;
  findAll(options?: FindAllOptions): Promise<Patent[]>;
  search(query: string): Promise<Patent[]>;
  save(patent: Patent): Promise<void>;
  delete(id: string): Promise<void>;
  count(filters?: CountFilters): Promise<number>;
}

export class DrizzlePatentRepository implements PatentRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Patent | null> {
    const result = await this.db
      .select()
      .from(patents)
      .where(and(eq(patents.id, id), isNull(patents.deletedAt)))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByApplicationNumber(appNumber: string): Promise<Patent | null> {
    const result = await this.db
      .select()
      .from(patents)
      .where(and(eq(patents.applicationNumber, appNumber), isNull(patents.deletedAt)))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByPatentNumber(patentNumber: string): Promise<Patent | null> {
    const result = await this.db
      .select()
      .from(patents)
      .where(and(eq(patents.patentNumber, patentNumber), isNull(patents.deletedAt)))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findAll(options?: FindAllOptions): Promise<Patent[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = [isNull(patents.deletedAt)];
    if (options?.status) {
      conditions.push(eq(patents.status, options.status as typeof patents.status.enumValues[number]));
    }

    const results = await this.db
      .select()
      .from(patents)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    return results.map(r => this.toDomain(r));
  }

  async search(query: string): Promise<Patent[]> {
    const results = await this.db
      .select()
      .from(patents)
      .where(and(
        isNull(patents.deletedAt),
        ilike(patents.title, `%${query}%`)
      ))
      .limit(50);

    return results.map(r => this.toDomain(r));
  }

  async save(patent: Patent): Promise<void> {
    const data = this.toPersistence(patent);

    await this.db
      .insert(patents)
      .values(data)
      .onConflictDoUpdate({
        target: patents.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(patents)
      .set({ deletedAt: new Date() })
      .where(eq(patents.id, id));
  }

  async count(filters?: CountFilters): Promise<number> {
    const conditions = [isNull(patents.deletedAt)];
    if (filters?.status) {
      conditions.push(eq(patents.status, filters.status as typeof patents.status.enumValues[number]));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(patents)
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  }

  private toDomain(row: typeof patents.$inferSelect): Patent {
    const props: PatentProps = {
      applicationNumber: row.applicationNumber ?? undefined,
      patentNumber: row.patentNumber ?? undefined,
      title: row.title,
      abstract: row.abstract ?? undefined,
      type: row.type,
      status: row.status,
      filingDate: row.filingDate ? new Date(row.filingDate) : undefined,
      priorityDate: row.priorityDate ? new Date(row.priorityDate) : undefined,
      publicationDate: row.publicationDate ? new Date(row.publicationDate) : undefined,
      grantDate: row.grantDate ? new Date(row.grantDate) : undefined,
      expirationDate: row.expirationDate ? new Date(row.expirationDate) : undefined,
      inventors: row.inventors as string[],
      assigneeId: row.assigneeId ?? undefined,
      jurisdictions: row.jurisdictions as string[],
      claims: row.claims as PatentClaim[],
    };

    return Patent.reconstitute(row.id, props);
  }

  private toPersistence(patent: Patent): typeof patents.$inferInsert {
    return {
      id: patent.id,
      applicationNumber: patent.applicationNumber ?? null,
      patentNumber: patent.patentNumber ?? null,
      title: patent.title,
      abstract: patent.abstract ?? null,
      type: patent.type,
      status: patent.status,
      filingDate: patent.filingDate?.toISOString().split('T')[0] ?? null,
      priorityDate: patent.priorityDate?.toISOString().split('T')[0] ?? null,
      publicationDate: patent.publicationDate?.toISOString().split('T')[0] ?? null,
      grantDate: patent.grantDate?.toISOString().split('T')[0] ?? null,
      expirationDate: patent.expirationDate?.toISOString().split('T')[0] ?? null,
      inventors: patent.inventors,
      assigneeId: patent.assigneeId ?? null,
      jurisdictions: patent.jurisdictions,
      claims: patent.claims,
      createdAt: patent.createdAt,
      updatedAt: patent.updatedAt,
      createdBy: patent.createdBy ?? null,
      updatedBy: patent.updatedBy ?? null,
      version: patent.version,
    };
  }
}
