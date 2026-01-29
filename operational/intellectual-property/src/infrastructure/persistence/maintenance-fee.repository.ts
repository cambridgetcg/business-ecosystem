/**
 * Maintenance Fee Repository - Drizzle Implementation
 */

import { eq, and, isNull, sql, lte, gte, inArray } from 'drizzle-orm';
import {
  MaintenanceFee,
  type MaintenanceFeeProps,
} from '../../domain/entities/maintenance-fee.entity.js';
import { patentMaintenanceFees } from './schema.js';
import type { Database } from './database.js';

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface FindAllOptions {
  limit?: number | undefined;
  offset?: number | undefined;
  status?: string | undefined;
  patentId?: string | undefined;
}

export interface FindUpcomingOptions {
  daysAhead?: number | undefined;
  limit?: number | undefined;
}

export interface CountFilters {
  status?: string | undefined;
  patentId?: string | undefined;
}

export interface MaintenanceFeeRepository {
  findById(id: string): Promise<MaintenanceFee | null>;
  findByPatentId(patentId: string): Promise<MaintenanceFee[]>;
  findByPatentIdAndFeeNumber(patentId: string, feeNumber: 1 | 2 | 3): Promise<MaintenanceFee | null>;
  findUpcoming(options?: FindUpcomingOptions): Promise<MaintenanceFee[]>;
  findOverdue(): Promise<MaintenanceFee[]>;
  findAll(options?: FindAllOptions): Promise<MaintenanceFee[]>;
  save(fee: MaintenanceFee): Promise<void>;
  saveMany(fees: MaintenanceFee[]): Promise<void>;
  delete(id: string): Promise<void>;
  count(filters?: CountFilters): Promise<number>;
}

export class DrizzleMaintenanceFeeRepository implements MaintenanceFeeRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<MaintenanceFee | null> {
    const result = await this.db
      .select()
      .from(patentMaintenanceFees)
      .where(and(eq(patentMaintenanceFees.id, id), isNull(patentMaintenanceFees.deletedAt)))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByPatentId(patentId: string): Promise<MaintenanceFee[]> {
    const results = await this.db
      .select()
      .from(patentMaintenanceFees)
      .where(and(
        eq(patentMaintenanceFees.patentId, patentId),
        isNull(patentMaintenanceFees.deletedAt)
      ))
      .orderBy(patentMaintenanceFees.feeNumber);

    return results.map(r => this.toDomain(r));
  }

  async findByPatentIdAndFeeNumber(patentId: string, feeNumber: 1 | 2 | 3): Promise<MaintenanceFee | null> {
    const result = await this.db
      .select()
      .from(patentMaintenanceFees)
      .where(and(
        eq(patentMaintenanceFees.patentId, patentId),
        eq(patentMaintenanceFees.feeNumber, feeNumber),
        isNull(patentMaintenanceFees.deletedAt)
      ))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findUpcoming(options?: FindUpcomingOptions): Promise<MaintenanceFee[]> {
    const daysAhead = options?.daysAhead ?? 90;
    const limit = options?.limit ?? 100;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const results = await this.db
      .select()
      .from(patentMaintenanceFees)
      .where(and(
        isNull(patentMaintenanceFees.deletedAt),
        inArray(patentMaintenanceFees.status, ['upcoming', 'payable']),
        lte(patentMaintenanceFees.dueDate, toDateString(futureDate))
      ))
      .orderBy(patentMaintenanceFees.dueDate)
      .limit(limit);

    return results.map(r => this.toDomain(r));
  }

  async findOverdue(): Promise<MaintenanceFee[]> {
    const today = toDateString(new Date());

    const results = await this.db
      .select()
      .from(patentMaintenanceFees)
      .where(and(
        isNull(patentMaintenanceFees.deletedAt),
        inArray(patentMaintenanceFees.status, ['payable', 'grace_period']),
        lte(patentMaintenanceFees.dueDate, today)
      ))
      .orderBy(patentMaintenanceFees.dueDate);

    return results.map(r => this.toDomain(r));
  }

  async findAll(options?: FindAllOptions): Promise<MaintenanceFee[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = [isNull(patentMaintenanceFees.deletedAt)];
    if (options?.status) {
      conditions.push(eq(patentMaintenanceFees.status, options.status as typeof patentMaintenanceFees.status.enumValues[number]));
    }
    if (options?.patentId) {
      conditions.push(eq(patentMaintenanceFees.patentId, options.patentId));
    }

    const results = await this.db
      .select()
      .from(patentMaintenanceFees)
      .where(and(...conditions))
      .orderBy(patentMaintenanceFees.dueDate)
      .limit(limit)
      .offset(offset);

    return results.map(r => this.toDomain(r));
  }

  async save(fee: MaintenanceFee): Promise<void> {
    const data = this.toPersistence(fee);

    await this.db
      .insert(patentMaintenanceFees)
      .values(data)
      .onConflictDoUpdate({
        target: patentMaintenanceFees.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });
  }

  async saveMany(fees: MaintenanceFee[]): Promise<void> {
    for (const fee of fees) {
      await this.save(fee);
    }
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(patentMaintenanceFees)
      .set({ deletedAt: new Date() })
      .where(eq(patentMaintenanceFees.id, id));
  }

  async count(filters?: CountFilters): Promise<number> {
    const conditions = [isNull(patentMaintenanceFees.deletedAt)];
    if (filters?.status) {
      conditions.push(eq(patentMaintenanceFees.status, filters.status as typeof patentMaintenanceFees.status.enumValues[number]));
    }
    if (filters?.patentId) {
      conditions.push(eq(patentMaintenanceFees.patentId, filters.patentId));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(patentMaintenanceFees)
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  }

  private toDomain(row: typeof patentMaintenanceFees.$inferSelect): MaintenanceFee {
    const props: MaintenanceFeeProps = {
      patentId: row.patentId,
      feeNumber: row.feeNumber as 1 | 2 | 3,
      jurisdiction: row.jurisdiction,
      dueDate: new Date(row.dueDate),
      windowOpensDate: new Date(row.windowOpensDate),
      gracePeriodEndsDate: new Date(row.gracePeriodEndsDate),
      status: row.status,
      surchargeApplied: row.surchargeApplied,
      ...(row.paidDate && { paidDate: new Date(row.paidDate) }),
      ...(row.paidAmount && { paidAmount: row.paidAmount }),
      ...(row.entitySizeAtPayment && { entitySizeAtPayment: row.entitySizeAtPayment }),
      ...(row.receiptNumber && { receiptNumber: row.receiptNumber }),
      ...(row.notes && { notes: row.notes }),
    };

    return MaintenanceFee.reconstitute(row.id, props);
  }

  private toPersistence(fee: MaintenanceFee): typeof patentMaintenanceFees.$inferInsert {
    return {
      id: fee.id,
      patentId: fee.patentId,
      feeNumber: fee.feeNumber,
      jurisdiction: fee.jurisdiction,
      dueDate: toDateString(fee.dueDate),
      windowOpensDate: toDateString(fee.windowOpensDate),
      gracePeriodEndsDate: toDateString(fee.gracePeriodEndsDate),
      status: fee.status,
      paidDate: fee.paidDate ? toDateString(fee.paidDate) : null,
      paidAmount: fee.paidAmount ?? null,
      surchargeApplied: fee.surchargeApplied,
      entitySizeAtPayment: fee.entitySizeAtPayment ?? null,
      receiptNumber: fee.receiptNumber ?? null,
      notes: fee.notes ?? null,
      createdAt: fee.createdAt,
      updatedAt: fee.updatedAt,
      createdBy: fee.createdBy ?? null,
      updatedBy: fee.updatedBy ?? null,
      version: fee.version,
    };
  }
}
