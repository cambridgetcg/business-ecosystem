/**
 * UK VAT Return Repository
 *
 * Data access for VAT returns (MTD compliant).
 */

import { eq, and, isNull, count, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { ukVatReturns } from '../schema.js';
import type * as schema from '../schema.js';
import {
  type UKVATReturn,
  type CreateVATReturnInput,
  type VATReturnStatus,
  type VATBoxes,
  calculateVATDeadline,
  generatePeriodKey,
} from '../../../domain/vat/index.js';

type DbType = NodePgDatabase<typeof schema>;

export interface VATReturnFilters {
  tenantId?: string;
  entityId?: string;
  registrationId?: string;
  status?: VATReturnStatus;
  periodKey?: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export class VATReturnRepository {
  constructor(private readonly db: DbType) {}

  async findById(id: string): Promise<UKVATReturn | null> {
    const result = await this.db
      .select()
      .from(ukVatReturns)
      .where(and(eq(ukVatReturns.id, id), isNull(ukVatReturns.deletedAt)))
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async findMany(
    filters?: VATReturnFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<UKVATReturn>> {
    const conditions = [isNull(ukVatReturns.deletedAt)];

    if (filters?.tenantId) {
      conditions.push(eq(ukVatReturns.tenantId, filters.tenantId));
    }
    if (filters?.entityId) {
      conditions.push(eq(ukVatReturns.entityId, filters.entityId));
    }
    if (filters?.registrationId) {
      conditions.push(eq(ukVatReturns.registrationId, filters.registrationId));
    }
    if (filters?.status) {
      conditions.push(eq(ukVatReturns.status, filters.status));
    }
    if (filters?.periodKey) {
      conditions.push(eq(ukVatReturns.periodKey, filters.periodKey));
    }

    const whereClause = and(...conditions);
    const limit = pagination?.limit ?? 20;
    const offset = pagination?.offset ?? 0;

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(ukVatReturns)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(ukVatReturns.periodEnd)),
      this.db
        .select({ count: count() })
        .from(ukVatReturns)
        .where(whereClause),
    ]);

    return {
      data: data.map(row => this.toDomain(row)),
      total: totalResult[0]?.count ?? 0,
      limit,
      offset,
    };
  }

  async findByPeriodKey(registrationId: string, periodKey: string): Promise<UKVATReturn | null> {
    const result = await this.db
      .select()
      .from(ukVatReturns)
      .where(and(
        eq(ukVatReturns.registrationId, registrationId),
        eq(ukVatReturns.periodKey, periodKey),
        isNull(ukVatReturns.deletedAt)
      ))
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async create(input: CreateVATReturnInput, createdBy?: string): Promise<UKVATReturn> {
    const id = randomUUID();
    const now = new Date();

    // Calculate deadline and generate period key if not provided
    const submissionDeadline = calculateVATDeadline(input.periodEnd);
    const periodKey = input.periodKey ?? generatePeriodKey(input.periodEnd);

    const values = {
      id,
      tenantId: input.tenantId,
      entityId: input.entityId,
      registrationId: input.registrationId,
      periodStart: input.periodStart.toISOString().split('T')[0],
      periodEnd: input.periodEnd.toISOString().split('T')[0],
      periodKey,
      box1: '0.00',
      box2: '0.00',
      box3: '0.00',
      box4: '0.00',
      box5: '0.00',
      box6: '0',
      box7: '0',
      box8: '0',
      box9: '0',
      flatRateScheme: input.flatRateScheme,
      flatRatePercentage: input.flatRatePercentage ?? null,
      status: 'draft' as const,
      submissionDeadline: submissionDeadline.toISOString().split('T')[0],
      declarationAccepted: false,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ?? null,
      version: 1,
    };

    const [result] = await this.db
      .insert(ukVatReturns)
      .values(values as any)
      .returning();

    if (!result) {
      throw new Error('Failed to create VAT return');
    }

    return this.toDomain(result);
  }

  async updateBoxes(
    id: string,
    boxes: VATBoxes,
    flatRateDetails?: { turnover: string; vat: string },
    updatedBy?: string
  ): Promise<UKVATReturn> {
    const updates: Record<string, unknown> = {
      box1: boxes.box1,
      box2: boxes.box2,
      box3: boxes.box3,
      box4: boxes.box4,
      box5: boxes.box5,
      box6: boxes.box6,
      box7: boxes.box7,
      box8: boxes.box8,
      box9: boxes.box9,
      status: 'calculated' as const,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    if (flatRateDetails) {
      updates.flatRateTurnover = flatRateDetails.turnover;
      updates.flatRateVAT = flatRateDetails.vat;
    }

    const [result] = await this.db
      .update(ukVatReturns)
      .set(updates as any)
      .where(and(eq(ukVatReturns.id, id), isNull(ukVatReturns.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('VAT return not found: ' + id);
    }

    return this.toDomain(result);
  }

  async acceptDeclaration(
    id: string,
    acceptedBy: string,
    updatedBy?: string
  ): Promise<UKVATReturn> {
    const updates = {
      declarationAccepted: true,
      declarationAcceptedBy: acceptedBy,
      declarationAcceptedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(ukVatReturns)
      .set(updates as any)
      .where(and(eq(ukVatReturns.id, id), isNull(ukVatReturns.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('VAT return not found: ' + id);
    }

    return this.toDomain(result);
  }

  async markAsSubmitted(
    id: string,
    mtdDetails: {
      receiptId: string;
      formBundleNumber?: string;
      paymentIndicator?: string;
    },
    updatedBy?: string
  ): Promise<UKVATReturn> {
    const updates = {
      status: 'submitted' as const,
      submittedAt: new Date(),
      mtdReceiptId: mtdDetails.receiptId,
      mtdFormBundleNumber: mtdDetails.formBundleNumber ?? null,
      mtdPaymentIndicator: mtdDetails.paymentIndicator ?? null,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(ukVatReturns)
      .set(updates as any)
      .where(and(eq(ukVatReturns.id, id), isNull(ukVatReturns.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('VAT return not found: ' + id);
    }

    return this.toDomain(result);
  }

  async markAsAcknowledged(id: string, updatedBy?: string): Promise<UKVATReturn> {
    const updates = {
      status: 'acknowledged' as const,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(ukVatReturns)
      .set(updates as any)
      .where(and(eq(ukVatReturns.id, id), isNull(ukVatReturns.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('VAT return not found: ' + id);
    }

    return this.toDomain(result);
  }

  async setMTDObligationId(id: string, obligationId: string, updatedBy?: string): Promise<UKVATReturn> {
    const updates = {
      mtdObligationId: obligationId,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(ukVatReturns)
      .set(updates as any)
      .where(and(eq(ukVatReturns.id, id), isNull(ukVatReturns.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('VAT return not found: ' + id);
    }

    return this.toDomain(result);
  }

  async delete(id: string, deletedBy?: string): Promise<void> {
    const updates: Record<string, unknown> = {
      deletedAt: new Date(),
    };
    if (deletedBy !== undefined) {
      updates.updatedBy = deletedBy;
    }

    await this.db
      .update(ukVatReturns)
      .set(updates as any)
      .where(and(eq(ukVatReturns.id, id), isNull(ukVatReturns.deletedAt)));
  }

  private toDomain(row: typeof ukVatReturns.$inferSelect): UKVATReturn {
    return {
      id: row.id,
      tenantId: row.tenantId,
      entityId: row.entityId,
      registrationId: row.registrationId,
      periodStart: new Date(row.periodStart),
      periodEnd: new Date(row.periodEnd),
      periodKey: row.periodKey,
      box1: row.box1,
      box2: row.box2,
      box3: row.box3,
      box4: row.box4,
      box5: row.box5,
      box6: row.box6,
      box7: row.box7,
      box8: row.box8,
      box9: row.box9,
      flatRateScheme: row.flatRateScheme,
      flatRateTurnover: row.flatRateTurnover,
      flatRatePercentage: row.flatRatePercentage,
      flatRateVAT: row.flatRateVAT,
      status: row.status,
      submissionDeadline: new Date(row.submissionDeadline),
      submittedAt: row.submittedAt,
      mtdObligationId: row.mtdObligationId,
      mtdReceiptId: row.mtdReceiptId,
      mtdFormBundleNumber: row.mtdFormBundleNumber,
      mtdPaymentIndicator: row.mtdPaymentIndicator,
      declarationAccepted: row.declarationAccepted,
      declarationAcceptedBy: row.declarationAcceptedBy,
      declarationAcceptedAt: row.declarationAcceptedAt,
      adjustments: row.adjustments as UKVATReturn['adjustments'],
      notes: row.notes,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy ?? undefined,
      updatedBy: row.updatedBy ?? undefined,
      version: row.version,
      deletedAt: row.deletedAt,
    };
  }
}
