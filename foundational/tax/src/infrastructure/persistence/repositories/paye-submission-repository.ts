/**
 * PAYE Submission Repository
 *
 * Data access for PAYE RTI submissions (FPS and EPS).
 */

import { eq, and, isNull, count, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { payeSubmissions } from '../schema.js';
import type * as schema from '../schema.js';
import {
  type FPSSubmission,
  type EPSSubmission,
  type PAYESubmission,
  type PAYESubmissionStatus,
  type CreateFPSInput,
  type CreateEPSInput,
  getFPSDeadline,
  getEPSDeadline,
} from '../../../domain/paye/index.js';
import Decimal from 'decimal.js';

type DbType = NodePgDatabase<typeof schema>;

export interface PAYESubmissionFilters {
  tenantId?: string;
  entityId?: string;
  registrationId?: string;
  submissionType?: 'fps' | 'eps';
  status?: PAYESubmissionStatus;
  taxYear?: string;
  taxMonth?: number;
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

export class PAYESubmissionRepository {
  constructor(private readonly db: DbType) {}

  async findById(id: string): Promise<PAYESubmission | null> {
    const result = await this.db
      .select()
      .from(payeSubmissions)
      .where(and(eq(payeSubmissions.id, id), isNull(payeSubmissions.deletedAt)))
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async findMany(
    filters?: PAYESubmissionFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<PAYESubmission>> {
    const conditions = [isNull(payeSubmissions.deletedAt)];

    if (filters?.tenantId) {
      conditions.push(eq(payeSubmissions.tenantId, filters.tenantId));
    }
    if (filters?.entityId) {
      conditions.push(eq(payeSubmissions.entityId, filters.entityId));
    }
    if (filters?.registrationId) {
      conditions.push(eq(payeSubmissions.registrationId, filters.registrationId));
    }
    if (filters?.submissionType) {
      conditions.push(eq(payeSubmissions.submissionType, filters.submissionType));
    }
    if (filters?.status) {
      conditions.push(eq(payeSubmissions.status, filters.status));
    }
    if (filters?.taxYear) {
      conditions.push(eq(payeSubmissions.taxYear, filters.taxYear));
    }
    if (filters?.taxMonth) {
      conditions.push(eq(payeSubmissions.taxMonth, filters.taxMonth));
    }

    const whereClause = and(...conditions);
    const limit = pagination?.limit ?? 20;
    const offset = pagination?.offset ?? 0;

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(payeSubmissions)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(payeSubmissions.taxMonth)),
      this.db
        .select({ count: count() })
        .from(payeSubmissions)
        .where(whereClause),
    ]);

    return {
      data: data.map(row => this.toDomain(row)),
      total: totalResult[0]?.count ?? 0,
      limit,
      offset,
    };
  }

  async createFPS(input: CreateFPSInput, createdBy?: string): Promise<FPSSubmission> {
    const id = randomUUID();
    const now = new Date();

    // Calculate totals from employee payments
    let totalPay = new Decimal(0);
    let totalTax = new Decimal(0);
    let totalEmployeeNI = new Decimal(0);
    let totalEmployerNI = new Decimal(0);
    let totalStudentLoan = new Decimal(0);
    let totalPostgraduateLoan = new Decimal(0);

    for (const payment of input.employeePayments) {
      totalPay = totalPay.plus(payment.grossPay);
      totalTax = totalTax.plus(payment.taxDeducted);
      totalEmployeeNI = totalEmployeeNI.plus(payment.employeeNI);
      totalEmployerNI = totalEmployerNI.plus(payment.employerNI);
      if (payment.studentLoan) {
        totalStudentLoan = totalStudentLoan.plus(payment.studentLoan);
      }
      if (payment.postgraduateLoan) {
        totalPostgraduateLoan = totalPostgraduateLoan.plus(payment.postgraduateLoan);
      }
    }

    const values = {
      id,
      tenantId: input.tenantId,
      entityId: input.entityId,
      registrationId: input.registrationId,
      submissionType: 'fps' as const,
      taxYear: input.taxYear,
      taxMonth: input.taxMonth,
      paymentDate: input.paymentDate.toISOString().split('T')[0],
      payFrequency: input.payFrequency,
      employeeCount: input.employeePayments.length,
      totalPayInPeriod: totalPay.toFixed(2),
      totalTaxDeducted: totalTax.toFixed(2),
      totalEmployeeNI: totalEmployeeNI.toFixed(2),
      totalEmployerNI: totalEmployerNI.toFixed(2),
      totalStudentLoan: totalStudentLoan.toFixed(2),
      totalPostgraduateLoan: totalPostgraduateLoan.toFixed(2),
      status: 'draft' as const,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ?? null,
      version: 1,
    };

    const [result] = await this.db
      .insert(payeSubmissions)
      .values(values as any)
      .returning();

    if (!result) {
      throw new Error('Failed to create FPS submission');
    }

    return this.toDomain(result) as FPSSubmission;
  }

  async createEPS(input: CreateEPSInput, createdBy?: string): Promise<EPSSubmission> {
    const id = randomUUID();
    const now = new Date();

    const values = {
      id,
      tenantId: input.tenantId,
      entityId: input.entityId,
      registrationId: input.registrationId,
      submissionType: 'eps' as const,
      taxYear: input.taxYear,
      taxMonth: input.taxMonth,
      noPaymentForPeriod: input.noPaymentForPeriod,
      smpRecovered: input.smpRecovered ?? null,
      sppRecovered: input.sppRecovered ?? null,
      sapRecovered: input.sapRecovered ?? null,
      shppRecovered: input.shppRecovered ?? null,
      nicCompensation: input.nicCompensation ?? null,
      cisDeductionsSuffered: input.cisDeductionsSuffered ?? null,
      employmentAllowanceClaim: input.employmentAllowanceClaim,
      finalSubmissionForYear: input.finalSubmissionForYear,
      status: 'draft' as const,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ?? null,
      version: 1,
    };

    const [result] = await this.db
      .insert(payeSubmissions)
      .values(values as any)
      .returning();

    if (!result) {
      throw new Error('Failed to create EPS submission');
    }

    return this.toDomain(result) as EPSSubmission;
  }

  async markAsValidated(id: string, updatedBy?: string): Promise<PAYESubmission> {
    const updates = {
      status: 'validated' as const,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(payeSubmissions)
      .set(updates as any)
      .where(and(eq(payeSubmissions.id, id), isNull(payeSubmissions.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('PAYE submission not found: ' + id);
    }

    return this.toDomain(result);
  }

  async markAsSubmitted(
    id: string,
    hmrcCorrelationId: string,
    updatedBy?: string
  ): Promise<PAYESubmission> {
    const updates = {
      status: 'submitted' as const,
      submittedAt: new Date(),
      hmrcCorrelationId,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(payeSubmissions)
      .set(updates as any)
      .where(and(eq(payeSubmissions.id, id), isNull(payeSubmissions.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('PAYE submission not found: ' + id);
    }

    return this.toDomain(result);
  }

  async markAsAcknowledged(
    id: string,
    hmrcReceiptTimestamp: Date,
    updatedBy?: string
  ): Promise<PAYESubmission> {
    const updates = {
      status: 'acknowledged' as const,
      hmrcReceiptTimestamp,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(payeSubmissions)
      .set(updates as any)
      .where(and(eq(payeSubmissions.id, id), isNull(payeSubmissions.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('PAYE submission not found: ' + id);
    }

    return this.toDomain(result);
  }

  async markAsError(
    id: string,
    errors: Array<{ code: string; message: string }>,
    updatedBy?: string
  ): Promise<PAYESubmission> {
    const updates = {
      status: 'error' as const,
      hmrcErrors: errors,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(payeSubmissions)
      .set(updates as any)
      .where(and(eq(payeSubmissions.id, id), isNull(payeSubmissions.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('PAYE submission not found: ' + id);
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
      .update(payeSubmissions)
      .set(updates as any)
      .where(and(eq(payeSubmissions.id, id), isNull(payeSubmissions.deletedAt)));
  }

  private toDomain(row: typeof payeSubmissions.$inferSelect): PAYESubmission {
    const base = {
      id: row.id,
      tenantId: row.tenantId,
      entityId: row.entityId,
      registrationId: row.registrationId,
      taxYear: row.taxYear,
      taxMonth: row.taxMonth,
      status: row.status,
      submittedAt: row.submittedAt,
      hmrcCorrelationId: row.hmrcCorrelationId,
      hmrcReceiptTimestamp: row.hmrcReceiptTimestamp,
      hmrcErrors: row.hmrcErrors as Array<{ code: string; message: string }> | null,
      notes: row.notes,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy ?? undefined,
      updatedBy: row.updatedBy ?? undefined,
      version: row.version,
      deletedAt: row.deletedAt,
    };

    if (row.submissionType === 'fps') {
      return {
        ...base,
        submissionType: 'fps',
        paymentDate: row.paymentDate ? new Date(row.paymentDate) : new Date(),
        payFrequency: row.payFrequency ?? 'monthly',
        employeeCount: row.employeeCount ?? 0,
        totalPayInPeriod: row.totalPayInPeriod ?? '0',
        totalTaxDeducted: row.totalTaxDeducted ?? '0',
        totalStudentLoan: row.totalStudentLoan ?? '0',
        totalPostgraduateLoan: row.totalPostgraduateLoan ?? '0',
        totalEmployeeNI: row.totalEmployeeNI ?? '0',
        totalEmployerNI: row.totalEmployerNI ?? '0',
        totalSMP: row.totalSMP,
        totalSPP: row.totalSPP,
        totalSAP: row.totalSAP,
        totalShPP: row.totalShPP,
        totalSSP: row.totalSSP,
      } as FPSSubmission;
    } else {
      return {
        ...base,
        submissionType: 'eps',
        smpRecovered: row.smpRecovered,
        sppRecovered: row.sppRecovered,
        sapRecovered: row.sapRecovered,
        shppRecovered: row.shppRecovered,
        nicCompensation: row.nicCompensation,
        cisDeductionsSuffered: row.cisDeductionsSuffered,
        noPaymentForPeriod: row.noPaymentForPeriod ?? false,
        periodOfInactivity: row.periodOfInactivity as { from: Date; to: Date } | null,
        employmentAllowanceClaim: row.employmentAllowanceClaim ?? false,
        apprenticeshipLevyClaim: row.apprenticeshipLevyClaim,
        finalSubmissionForYear: row.finalSubmissionForYear ?? false,
        dateSchemesClosed: row.dateSchemesClosed ? new Date(row.dateSchemesClosed) : null,
        schemeCeasedDate: row.schemeCeasedDate ? new Date(row.schemeCeasedDate) : null,
      } as EPSSubmission;
    }
  }
}
