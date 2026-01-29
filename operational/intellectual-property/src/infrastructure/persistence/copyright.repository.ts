/**
 * Copyright Repository - Drizzle Implementation
 */

import { eq, and, isNull, sql, ilike } from 'drizzle-orm';
import { Copyright, type CopyrightProps, type Author } from '../../domain/entities/copyright.entity.js';
import { copyrights } from './schema.js';
import type { Database } from './database.js';

export interface FindAllOptions {
  limit?: number | undefined;
  offset?: number | undefined;
  status?: string | undefined;
  workType?: string | undefined;
}

export interface CountFilters {
  status?: string | undefined;
  workType?: string | undefined;
}

export interface CopyrightRepository {
  findById(id: string): Promise<Copyright | null>;
  findByRegistrationNumber(registrationNumber: string): Promise<Copyright | null>;
  findByClaimant(claimantId: string): Promise<Copyright[]>;
  findAll(options?: FindAllOptions): Promise<Copyright[]>;
  search(query: string): Promise<Copyright[]>;
  save(copyright: Copyright): Promise<void>;
  delete(id: string): Promise<void>;
  count(filters?: CountFilters): Promise<number>;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class DrizzleCopyrightRepository implements CopyrightRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Copyright | null> {
    const result = await this.db
      .select()
      .from(copyrights)
      .where(and(eq(copyrights.id, id), isNull(copyrights.deletedAt)))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByRegistrationNumber(registrationNumber: string): Promise<Copyright | null> {
    const result = await this.db
      .select()
      .from(copyrights)
      .where(and(eq(copyrights.registrationNumber, registrationNumber), isNull(copyrights.deletedAt)))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByClaimant(claimantId: string): Promise<Copyright[]> {
    const results = await this.db
      .select()
      .from(copyrights)
      .where(and(eq(copyrights.claimantId, claimantId), isNull(copyrights.deletedAt)));

    return results.map(r => this.toDomain(r));
  }

  async findAll(options?: FindAllOptions): Promise<Copyright[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = [isNull(copyrights.deletedAt)];
    if (options?.status) {
      conditions.push(eq(copyrights.status, options.status as typeof copyrights.status.enumValues[number]));
    }
    if (options?.workType) {
      conditions.push(eq(copyrights.workType, options.workType as typeof copyrights.workType.enumValues[number]));
    }

    const results = await this.db
      .select()
      .from(copyrights)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    return results.map(r => this.toDomain(r));
  }

  async search(query: string): Promise<Copyright[]> {
    const results = await this.db
      .select()
      .from(copyrights)
      .where(and(
        isNull(copyrights.deletedAt),
        ilike(copyrights.title, `%${query}%`)
      ))
      .limit(50);

    return results.map(r => this.toDomain(r));
  }

  async save(copyright: Copyright): Promise<void> {
    const data = this.toPersistence(copyright);

    await this.db
      .insert(copyrights)
      .values(data)
      .onConflictDoUpdate({
        target: copyrights.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(copyrights)
      .set({ deletedAt: new Date() })
      .where(eq(copyrights.id, id));
  }

  async count(filters?: CountFilters): Promise<number> {
    const conditions = [isNull(copyrights.deletedAt)];
    if (filters?.status) {
      conditions.push(eq(copyrights.status, filters.status as typeof copyrights.status.enumValues[number]));
    }
    if (filters?.workType) {
      conditions.push(eq(copyrights.workType, filters.workType as typeof copyrights.workType.enumValues[number]));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(copyrights)
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  }

  private toDomain(row: typeof copyrights.$inferSelect): Copyright {
    const props: CopyrightProps = {
      title: row.title,
      alternativeTitles: (row.alternativeTitles as string[]) ?? [],
      workType: row.workType,
      status: row.status,
      creationDate: new Date(row.creationDate),
      authors: row.authors as Author[],
      claimantId: row.claimantId,
      nation: row.nation,
      isPublished: row.isPublished,
      ...(row.registrationNumber && { registrationNumber: row.registrationNumber }),
      ...(row.publicationDate && { publicationDate: new Date(row.publicationDate) }),
      ...(row.registrationDate && { registrationDate: new Date(row.registrationDate) }),
      ...(row.description && { description: row.description }),
    };

    return Copyright.reconstitute(row.id, props);
  }

  private toPersistence(copyright: Copyright): typeof copyrights.$inferInsert {
    return {
      id: copyright.id,
      registrationNumber: copyright.registrationNumber ?? null,
      title: copyright.title,
      alternativeTitles: copyright.alternativeTitles,
      workType: copyright.workType,
      status: copyright.status,
      creationDate: toDateString(copyright.creationDate),
      publicationDate: copyright.publicationDate ? toDateString(copyright.publicationDate) : null,
      registrationDate: copyright.registrationDate ? toDateString(copyright.registrationDate) : null,
      authors: copyright.authors,
      claimantId: copyright.claimantId,
      description: copyright.description ?? null,
      nation: copyright.nation,
      isPublished: copyright.isPublished,
      createdAt: copyright.createdAt,
      updatedAt: copyright.updatedAt,
      createdBy: copyright.createdBy ?? null,
      updatedBy: copyright.updatedBy ?? null,
      version: copyright.version,
    };
  }
}
