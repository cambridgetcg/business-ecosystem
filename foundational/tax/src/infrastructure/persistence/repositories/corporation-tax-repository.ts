/**
 * Corporation Tax Period Repository
 *
 * Data access for Corporation Tax accounting periods.
 */

import { eq, and, isNull, count, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { corporationTaxPeriods } from '../schema.js';
import type * as schema from '../schema.js';
import {
  type CorporationTaxPeriod,
  type CreateCTPeriodInput,
  type CTPeriodStatus,
  getFinancialYear,
} from '../../../domain/corporation-tax/index.js';
import { getCorporationTaxDeadlines } from '../../../domain/uk-registration/index.js';

type DbType = NodePgDatabase<typeof schema>;

export interface CTPeriodFilters {
  tenantId?: string;
  entityId?: string;
  registrationId?: string;
  status?: CTPeriodStatus;
  financialYear?: string;
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

export class CorporationTaxRepository {
  constructor(private readonly db: DbType) {}

  async findById(id: string): Promise<CorporationTaxPeriod | null> {
    const result = await this.db
      .select()
      .from(corporationTaxPeriods)
      .where(and(eq(corporationTaxPeriods.id, id), isNull(corporationTaxPeriods.deletedAt)))
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async findMany(
    filters?: CTPeriodFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<CorporationTaxPeriod>> {
    const conditions = [isNull(corporationTaxPeriods.deletedAt)];

    if (filters?.tenantId) {
      conditions.push(eq(corporationTaxPeriods.tenantId, filters.tenantId));
    }
    if (filters?.entityId) {
      conditions.push(eq(corporationTaxPeriods.entityId, filters.entityId));
    }
    if (filters?.registrationId) {
      conditions.push(eq(corporationTaxPeriods.registrationId, filters.registrationId));
    }
    if (filters?.status) {
      conditions.push(eq(corporationTaxPeriods.status, filters.status));
    }
    if (filters?.financialYear) {
      conditions.push(eq(corporationTaxPeriods.financialYear, filters.financialYear));
    }

    const whereClause = and(...conditions);
    const limit = pagination?.limit ?? 20;
    const offset = pagination?.offset ?? 0;

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(corporationTaxPeriods)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(corporationTaxPeriods.periodEnd)),
      this.db
        .select({ count: count() })
        .from(corporationTaxPeriods)
        .where(whereClause),
    ]);

    return {
      data: data.map(row => this.toDomain(row)),
      total: totalResult[0]?.count ?? 0,
      limit,
      offset,
    };
  }

  async findByEntityAndYear(entityId: string, financialYear: string): Promise<CorporationTaxPeriod | null> {
    const result = await this.db
      .select()
      .from(corporationTaxPeriods)
      .where(and(
        eq(corporationTaxPeriods.entityId, entityId),
        eq(corporationTaxPeriods.financialYear, financialYear),
        isNull(corporationTaxPeriods.deletedAt)
      ))
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async create(input: CreateCTPeriodInput, createdBy?: string): Promise<CorporationTaxPeriod> {
    const id = randomUUID();
    const now = new Date();

    // Calculate financial year and deadlines
    const financialYear = getFinancialYear(input.periodEnd);
    const { filingDeadline, paymentDeadline } = getCorporationTaxDeadlines(input.periodEnd);

    // Calculate adjusted limits for associated companies
    const divisor = 1 + input.associatedCompaniesCount;
    const adjustedLowerLimit = (50000 / divisor).toFixed(2);
    const adjustedUpperLimit = (250000 / divisor).toFixed(2);

    const values = {
      id,
      tenantId: input.tenantId,
      entityId: input.entityId,
      registrationId: input.registrationId,
      periodStart: input.periodStart.toISOString().split('T')[0],
      periodEnd: input.periodEnd.toISOString().split('T')[0],
      financialYear,
      tradingProfits: '0',
      tradingLossesBroughtForward: '0',
      tradingLossesCarriedBack: '0',
      investmentIncome: '0',
      propertyIncome: '0',
      otherIncome: '0',
      chargeableGains: '0',
      capitalLossesBroughtForward: '0',
      capitalLossesUsed: '0',
      totalProfitsBeforeDeductions: '0',
      tradingLossesRelief: '0',
      groupRelief: '0',
      managementExpenses: '0',
      qualifyingCharitableDonations: '0',
      profitsChargeableToCT: '0',
      associatedCompaniesCount: input.associatedCompaniesCount,
      adjustedLowerLimit,
      adjustedUpperLimit,
      smallProfitsRateAmount: '0',
      mainRateAmount: '0',
      marginalReliefAmount: '0',
      effectiveRate: '0',
      corporationTaxLiability: '0',
      taxDue: '0',
      taxPaid: '0',
      taxOutstanding: '0',
      status: 'draft' as const,
      filingDeadline: filingDeadline.toISOString().split('T')[0],
      paymentDeadline: paymentDeadline.toISOString().split('T')[0],
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ?? null,
      version: 1,
    };

    const [result] = await this.db
      .insert(corporationTaxPeriods)
      .values(values as any)
      .returning();

    if (!result) {
      throw new Error('Failed to create Corporation Tax period');
    }

    return this.toDomain(result);
  }

  async updateCalculation(
    id: string,
    calculation: {
      tradingProfits?: string;
      investmentIncome?: string;
      propertyIncome?: string;
      otherIncome?: string;
      chargeableGains?: string;
      tradingLossesRelief?: string;
      groupRelief?: string;
      managementExpenses?: string;
      qualifyingCharitableDonations?: string;
      totalProfitsBeforeDeductions: string;
      profitsChargeableToCT: string;
      smallProfitsRateAmount: string;
      mainRateAmount: string;
      marginalReliefAmount: string;
      effectiveRate: string;
      corporationTaxLiability: string;
      taxDue: string;
      rdTaxCredits?: string;
      foreignTaxCredit?: string;
      otherCredits?: string;
    },
    updatedBy?: string
  ): Promise<CorporationTaxPeriod> {
    const updates: Record<string, unknown> = {
      ...calculation,
      status: 'calculated' as const,
      calculatedAt: new Date(),
      taxOutstanding: calculation.taxDue, // Initially outstanding equals due
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(corporationTaxPeriods)
      .set(updates as any)
      .where(and(eq(corporationTaxPeriods.id, id), isNull(corporationTaxPeriods.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('Corporation Tax period not found: ' + id);
    }

    return this.toDomain(result);
  }

  async markAsFiled(
    id: string,
    hmrcSubmissionId: string,
    hmrcReceiptNumber: string,
    updatedBy?: string
  ): Promise<CorporationTaxPeriod> {
    const updates = {
      status: 'filed' as const,
      filedAt: new Date(),
      hmrcSubmissionId,
      hmrcReceiptNumber,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(corporationTaxPeriods)
      .set(updates as any)
      .where(and(eq(corporationTaxPeriods.id, id), isNull(corporationTaxPeriods.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('Corporation Tax period not found: ' + id);
    }

    return this.toDomain(result);
  }

  async recordPayment(
    id: string,
    paymentAmount: string,
    updatedBy?: string
  ): Promise<CorporationTaxPeriod> {
    // First get current record to update outstanding
    const current = await this.findById(id);
    if (!current) {
      throw new Error('Corporation Tax period not found: ' + id);
    }

    const newTaxPaid = (parseFloat(current.taxPaid) + parseFloat(paymentAmount)).toFixed(2);
    const newTaxOutstanding = (parseFloat(current.taxDue) - parseFloat(newTaxPaid)).toFixed(2);
    const isPaidInFull = parseFloat(newTaxOutstanding) <= 0;

    const updates: Record<string, unknown> = {
      taxPaid: newTaxPaid,
      taxOutstanding: Math.max(0, parseFloat(newTaxOutstanding)).toFixed(2),
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    if (isPaidInFull) {
      updates.status = 'paid' as const;
      updates.paidAt = new Date();
    }

    const [result] = await this.db
      .update(corporationTaxPeriods)
      .set(updates as any)
      .where(and(eq(corporationTaxPeriods.id, id), isNull(corporationTaxPeriods.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('Corporation Tax period not found: ' + id);
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
      .update(corporationTaxPeriods)
      .set(updates as any)
      .where(and(eq(corporationTaxPeriods.id, id), isNull(corporationTaxPeriods.deletedAt)));
  }

  private toDomain(row: typeof corporationTaxPeriods.$inferSelect): CorporationTaxPeriod {
    return {
      id: row.id,
      tenantId: row.tenantId,
      entityId: row.entityId,
      registrationId: row.registrationId,
      periodStart: new Date(row.periodStart),
      periodEnd: new Date(row.periodEnd),
      financialYear: row.financialYear as `FY${number}`,
      tradingProfits: row.tradingProfits,
      tradingLossesBroughtForward: row.tradingLossesBroughtForward,
      tradingLossesCarriedBack: row.tradingLossesCarriedBack,
      investmentIncome: row.investmentIncome,
      propertyIncome: row.propertyIncome,
      otherIncome: row.otherIncome,
      chargeableGains: row.chargeableGains,
      capitalLossesBroughtForward: row.capitalLossesBroughtForward,
      capitalLossesUsed: row.capitalLossesUsed,
      totalProfitsBeforeDeductions: row.totalProfitsBeforeDeductions,
      tradingLossesRelief: row.tradingLossesRelief,
      groupRelief: row.groupRelief,
      managementExpenses: row.managementExpenses,
      qualifyingCharitableDonations: row.qualifyingCharitableDonations,
      profitsChargeableToCT: row.profitsChargeableToCT,
      associatedCompaniesCount: row.associatedCompaniesCount,
      adjustedLowerLimit: row.adjustedLowerLimit,
      adjustedUpperLimit: row.adjustedUpperLimit,
      smallProfitsRateAmount: row.smallProfitsRateAmount,
      mainRateAmount: row.mainRateAmount,
      marginalReliefAmount: row.marginalReliefAmount,
      effectiveRate: row.effectiveRate,
      corporationTaxLiability: row.corporationTaxLiability,
      rdTaxCredits: row.rdTaxCredits ?? undefined,
      foreignTaxCredit: row.foreignTaxCredit ?? undefined,
      otherCredits: row.otherCredits ?? undefined,
      taxDue: row.taxDue,
      taxPaid: row.taxPaid,
      taxOutstanding: row.taxOutstanding,
      status: row.status,
      filingDeadline: new Date(row.filingDeadline),
      paymentDeadline: new Date(row.paymentDeadline),
      calculatedAt: row.calculatedAt,
      filedAt: row.filedAt,
      paidAt: row.paidAt,
      hmrcSubmissionId: row.hmrcSubmissionId,
      hmrcReceiptNumber: row.hmrcReceiptNumber,
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
