/**
 * Drizzle Implementation of Officer Repository
 */

import { eq, and, isNull, isNotNull, count } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { officers } from '../schema.js';
import type * as schema from '../schema.js';
import type {
  OfficerRepository,
  OfficerFilters,
} from '../../../domain/officer/repositories/officer-repository.js';
import type {
  Officer,
  CreateOfficerInput,
  UpdateOfficerInput,
} from '../../../domain/officer/models/officer.js';

type DbType = NodePgDatabase<typeof schema>;

export class DrizzleOfficerRepository implements OfficerRepository {
  constructor(private readonly db: DbType) {}

  async findById(id: string): Promise<Officer | null> {
    const result = await this.db
      .select()
      .from(officers)
      .where(and(eq(officers.id, id), isNull(officers.deletedAt)))
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async findByEntityId(entityId: string, includeTerminated = false): Promise<Officer[]> {
    const conditions = [
      eq(officers.entityId, entityId),
      isNull(officers.deletedAt),
    ];

    if (!includeTerminated) {
      conditions.push(isNull(officers.terminationDate));
    }

    const results = await this.db
      .select()
      .from(officers)
      .where(and(...conditions))
      .orderBy(officers.appointmentDate);

    return results.map(row => this.toDomain(row));
  }

  async findMany(filters?: OfficerFilters): Promise<Officer[]> {
    const conditions = [isNull(officers.deletedAt)];

    if (filters?.entityId) {
      conditions.push(eq(officers.entityId, filters.entityId));
    }
    if (filters?.title) {
      conditions.push(eq(officers.title, filters.title as any));
    }
    if (filters?.isActive !== undefined) {
      if (filters.isActive) {
        conditions.push(isNull(officers.terminationDate));
      } else {
        // Include only terminated officers
        conditions.push(isNotNull(officers.terminationDate));
      }
    }

    const results = await this.db
      .select()
      .from(officers)
      .where(and(...conditions))
      .orderBy(officers.appointmentDate);

    return results.map(row => this.toDomain(row));
  }

  async create(input: CreateOfficerInput, createdBy?: string): Promise<Officer> {
    const id = randomUUID();
    const now = new Date();

    const values = {
      id,
      entityId: input.entityId,
      personId: input.personId,
      name: input.name,
      title: input.title,
      customTitle: input.customTitle ?? null,
      email: input.email ?? null,
      appointmentDate: input.appointmentDate,
      compensationAmount: input.compensationAmount ?? null,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ?? null,
      version: 1,
    };

    const result = await this.db.insert(officers).values(values).returning();

    return this.toDomain(result[0]!);
  }

  async update(id: string, input: UpdateOfficerInput, updatedBy?: string): Promise<Officer> {
    const now = new Date();

    const values: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: updatedBy ?? null,
    };

    if (input.title !== undefined) values.title = input.title;
    if (input.customTitle !== undefined) values.customTitle = input.customTitle;
    if (input.email !== undefined) values.email = input.email;
    if (input.compensationAmount !== undefined) values.compensationAmount = input.compensationAmount;
    if (input.metadata !== undefined) values.metadata = input.metadata;

    const result = await this.db
      .update(officers)
      .set(values)
      .where(and(eq(officers.id, id), isNull(officers.deletedAt)))
      .returning();

    if (!result[0]) {
      throw new Error('Officer not found: ' + id);
    }

    return this.toDomain(result[0]);
  }

  async terminate(id: string, terminationDate: Date, updatedBy?: string): Promise<Officer> {
    const result = await this.db
      .update(officers)
      .set({
        terminationDate,
        updatedAt: new Date(),
        updatedBy: updatedBy ?? null,
      })
      .where(
        and(
          eq(officers.id, id),
          isNull(officers.deletedAt),
          isNull(officers.terminationDate)
        )
      )
      .returning();

    if (!result[0]) {
      throw new Error('Officer not found or already terminated: ' + id);
    }

    return this.toDomain(result[0]);
  }

  async delete(id: string, deletedBy?: string): Promise<void> {
    const result = await this.db
      .update(officers)
      .set({
        deletedAt: new Date(),
        updatedBy: deletedBy ?? null,
      })
      .where(and(eq(officers.id, id), isNull(officers.deletedAt)))
      .returning({ id: officers.id });

    if (!result[0]) {
      throw new Error('Officer not found: ' + id);
    }
  }

  async existsByTitle(entityId: string, title: string): Promise<boolean> {
    const result = await this.db
      .select({ id: officers.id })
      .from(officers)
      .where(
        and(
          eq(officers.entityId, entityId),
          eq(officers.title, title as any),
          isNull(officers.terminationDate),
          isNull(officers.deletedAt)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async countByEntityId(entityId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(officers)
      .where(
        and(
          eq(officers.entityId, entityId),
          isNull(officers.terminationDate),
          isNull(officers.deletedAt)
        )
      );

    return result[0]?.count ?? 0;
  }

  private toDomain(row: typeof officers.$inferSelect): Officer {
    return {
      id: row.id,
      entityId: row.entityId,
      personId: row.personId,
      name: row.name,
      title: row.title,
      customTitle: row.customTitle,
      email: row.email,
      appointmentDate: row.appointmentDate,
      terminationDate: row.terminationDate,
      compensationAmount: row.compensationAmount,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      version: row.version,
    };
  }
}
