/**
 * Employee Tax Record Repository
 *
 * Data access for employee tax records (PAYE/NI data).
 */

import { eq, and, isNull, count, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { employeeTaxRecords } from '../schema.js';
import type * as schema from '../schema.js';
import {
  type EmployeeTaxRecord,
  type CreateEmployeeTaxRecordInput,
  type UpdateEmployeeTaxRecordInput,
  type EmploymentStatus,
} from '../../../domain/paye/index.js';

type DbType = NodePgDatabase<typeof schema>;

export interface EmployeeTaxRecordFilters {
  tenantId?: string;
  entityId?: string;
  employeeId?: string;
  taxYear?: string;
  employmentStatus?: EmploymentStatus;
  niCategory?: string;
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

export class EmployeeTaxRecordRepository {
  constructor(private readonly db: DbType) {}

  async findById(id: string): Promise<EmployeeTaxRecord | null> {
    const result = await this.db
      .select()
      .from(employeeTaxRecords)
      .where(and(eq(employeeTaxRecords.id, id), isNull(employeeTaxRecords.deletedAt)))
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async findByEmployeeId(employeeId: string, taxYear: string): Promise<EmployeeTaxRecord | null> {
    const result = await this.db
      .select()
      .from(employeeTaxRecords)
      .where(and(
        eq(employeeTaxRecords.employeeId, employeeId),
        eq(employeeTaxRecords.taxYear, taxYear),
        isNull(employeeTaxRecords.deletedAt)
      ))
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async findMany(
    filters?: EmployeeTaxRecordFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<EmployeeTaxRecord>> {
    const conditions = [isNull(employeeTaxRecords.deletedAt)];

    if (filters?.tenantId) {
      conditions.push(eq(employeeTaxRecords.tenantId, filters.tenantId));
    }
    if (filters?.entityId) {
      conditions.push(eq(employeeTaxRecords.entityId, filters.entityId));
    }
    if (filters?.employeeId) {
      conditions.push(eq(employeeTaxRecords.employeeId, filters.employeeId));
    }
    if (filters?.taxYear) {
      conditions.push(eq(employeeTaxRecords.taxYear, filters.taxYear));
    }
    if (filters?.employmentStatus) {
      conditions.push(eq(employeeTaxRecords.employmentStatus, filters.employmentStatus));
    }
    if (filters?.niCategory) {
      conditions.push(eq(employeeTaxRecords.niCategory, filters.niCategory as any));
    }

    const whereClause = and(...conditions);
    const limit = pagination?.limit ?? 20;
    const offset = pagination?.offset ?? 0;

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(employeeTaxRecords)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(employeeTaxRecords.createdAt)),
      this.db
        .select({ count: count() })
        .from(employeeTaxRecords)
        .where(whereClause),
    ]);

    return {
      data: data.map(row => this.toDomain(row)),
      total: totalResult[0]?.count ?? 0,
      limit,
      offset,
    };
  }

  async create(input: CreateEmployeeTaxRecordInput, createdBy?: string): Promise<EmployeeTaxRecord> {
    const id = randomUUID();
    const now = new Date();

    // Determine current tax year
    const today = new Date();
    const taxYearStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    const taxYear = `${taxYearStart}-${(taxYearStart + 1).toString().slice(-2)}`;

    const values = {
      id,
      tenantId: input.tenantId,
      entityId: input.entityId,
      employeeId: input.employeeId,
      nationalInsuranceNumber: input.nationalInsuranceNumber ?? null,
      taxCode: input.taxCode ?? '1257L',
      niCategory: input.niCategory ?? 'A',
      isDirector: input.isDirector ?? false,
      directorNIMethod: input.directorNIMethod ?? null,
      studentLoanPlan: input.studentLoanPlan ?? null,
      hasPostgraduateLoan: input.hasPostgraduateLoan ?? false,
      employmentStatus: 'active' as const,
      payFrequency: input.payFrequency ?? 'monthly',
      payrollId: input.payrollId ?? null,
      taxYear,
      grossPayYTD: '0',
      taxablePayYTD: '0',
      taxPaidYTD: '0',
      niablePayYTD: '0',
      employeeNIYTD: '0',
      employerNIYTD: '0',
      studentLoanYTD: '0',
      postgraduateLoanYTD: '0',
      benefitsInKindYTD: '0',
      benefitsTaxYTD: '0',
      smpYTD: '0',
      sppYTD: '0',
      sapYTD: '0',
      shppYTD: '0',
      sspYTD: '0',
      currentPeriodNumber: 1,
      periodsWorkedThisYear: 0,
      startDate: input.startDate.toISOString().split('T')[0],
      starterDeclaration: input.starterDeclaration ?? null,
      p45Details: input.p45Details ?? null,
      p60Issued: false,
      p45Issued: false,
      week1Month1Basis: false,
      irregularPaymentPattern: false,
      offPayrollWorker: false,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ?? null,
      version: 1,
    };

    const [result] = await this.db
      .insert(employeeTaxRecords)
      .values(values as any)
      .returning();

    if (!result) {
      throw new Error('Failed to create employee tax record');
    }

    return this.toDomain(result);
  }

  async update(
    id: string,
    input: UpdateEmployeeTaxRecordInput,
    updatedBy?: string
  ): Promise<EmployeeTaxRecord> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    if (input.taxCode !== undefined) updates.taxCode = input.taxCode;
    if (input.niCategory !== undefined) updates.niCategory = input.niCategory;
    if (input.studentLoanPlan !== undefined) updates.studentLoanPlan = input.studentLoanPlan;
    if (input.hasPostgraduateLoan !== undefined) updates.hasPostgraduateLoan = input.hasPostgraduateLoan;
    if (input.payFrequency !== undefined) updates.payFrequency = input.payFrequency;
    if (input.week1Month1Basis !== undefined) updates.week1Month1Basis = input.week1Month1Basis;
    if (input.irregularPaymentPattern !== undefined) updates.irregularPaymentPattern = input.irregularPaymentPattern;
    if (input.offPayrollWorker !== undefined) updates.offPayrollWorker = input.offPayrollWorker;
    if (input.leaveDate !== undefined) {
      updates.leaveDate = input.leaveDate.toISOString().split('T')[0];
      updates.employmentStatus = 'terminated';
    }
    if (input.metadata !== undefined) updates.metadata = input.metadata;

    const [result] = await this.db
      .update(employeeTaxRecords)
      .set(updates as any)
      .where(and(eq(employeeTaxRecords.id, id), isNull(employeeTaxRecords.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('Employee tax record not found: ' + id);
    }

    return this.toDomain(result);
  }

  async updateYTDFigures(
    id: string,
    ytdFigures: {
      grossPayYTD: string;
      taxablePayYTD: string;
      taxPaidYTD: string;
      niablePayYTD: string;
      employeeNIYTD: string;
      employerNIYTD: string;
      studentLoanYTD: string;
      postgraduateLoanYTD: string;
      currentPeriodNumber: number;
      periodsWorkedThisYear: number;
    },
    updatedBy?: string
  ): Promise<EmployeeTaxRecord> {
    const updates = {
      ...ytdFigures,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(employeeTaxRecords)
      .set(updates as any)
      .where(and(eq(employeeTaxRecords.id, id), isNull(employeeTaxRecords.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('Employee tax record not found: ' + id);
    }

    return this.toDomain(result);
  }

  async changeTaxCode(
    id: string,
    newTaxCode: string,
    updatedBy?: string
  ): Promise<{ record: EmployeeTaxRecord; previousTaxCode: string }> {
    // Get current record to capture previous tax code
    const current = await this.findById(id);
    if (!current) {
      throw new Error('Employee tax record not found: ' + id);
    }

    const previousTaxCode = current.taxCode;

    const updates = {
      taxCode: newTaxCode,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(employeeTaxRecords)
      .set(updates as any)
      .where(and(eq(employeeTaxRecords.id, id), isNull(employeeTaxRecords.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('Employee tax record not found: ' + id);
    }

    return {
      record: this.toDomain(result),
      previousTaxCode,
    };
  }

  async issueP45(id: string, updatedBy?: string): Promise<EmployeeTaxRecord> {
    const updates = {
      p45Issued: true,
      p45IssuedAt: new Date(),
      employmentStatus: 'terminated' as const,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(employeeTaxRecords)
      .set(updates as any)
      .where(and(eq(employeeTaxRecords.id, id), isNull(employeeTaxRecords.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('Employee tax record not found: ' + id);
    }

    return this.toDomain(result);
  }

  async issueP60(id: string, updatedBy?: string): Promise<EmployeeTaxRecord> {
    const updates = {
      p60Issued: true,
      p60IssuedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(employeeTaxRecords)
      .set(updates as any)
      .where(and(eq(employeeTaxRecords.id, id), isNull(employeeTaxRecords.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('Employee tax record not found: ' + id);
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
      .update(employeeTaxRecords)
      .set(updates as any)
      .where(and(eq(employeeTaxRecords.id, id), isNull(employeeTaxRecords.deletedAt)));
  }

  private toDomain(row: typeof employeeTaxRecords.$inferSelect): EmployeeTaxRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      entityId: row.entityId,
      employeeId: row.employeeId,
      nationalInsuranceNumber: row.nationalInsuranceNumber,
      taxCode: row.taxCode,
      niCategory: row.niCategory,
      isDirector: row.isDirector,
      directorNIMethod: row.directorNIMethod,
      directorAppointmentDate: row.directorAppointmentDate ? new Date(row.directorAppointmentDate) : null,
      studentLoanPlan: row.studentLoanPlan,
      hasPostgraduateLoan: row.hasPostgraduateLoan,
      employmentStatus: row.employmentStatus,
      payFrequency: row.payFrequency,
      payrollId: row.payrollId,
      taxYear: row.taxYear,
      grossPayYTD: row.grossPayYTD,
      taxablePayYTD: row.taxablePayYTD,
      taxPaidYTD: row.taxPaidYTD,
      niablePayYTD: row.niablePayYTD,
      employeeNIYTD: row.employeeNIYTD,
      employerNIYTD: row.employerNIYTD,
      studentLoanYTD: row.studentLoanYTD,
      postgraduateLoanYTD: row.postgraduateLoanYTD,
      benefitsInKindYTD: row.benefitsInKindYTD,
      benefitsTaxYTD: row.benefitsTaxYTD,
      smpYTD: row.smpYTD,
      sppYTD: row.sppYTD,
      sapYTD: row.sapYTD,
      shppYTD: row.shppYTD,
      sspYTD: row.sspYTD,
      currentPeriodNumber: row.currentPeriodNumber,
      periodsWorkedThisYear: row.periodsWorkedThisYear,
      startDate: new Date(row.startDate),
      leaveDate: row.leaveDate ? new Date(row.leaveDate) : null,
      starterDeclaration: row.starterDeclaration,
      p45Details: row.p45Details as EmployeeTaxRecord['p45Details'],
      p60Issued: row.p60Issued,
      p60IssuedAt: row.p60IssuedAt,
      p45Issued: row.p45Issued,
      p45IssuedAt: row.p45IssuedAt,
      week1Month1Basis: row.week1Month1Basis,
      irregularPaymentPattern: row.irregularPaymentPattern,
      offPayrollWorker: row.offPayrollWorker,
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
