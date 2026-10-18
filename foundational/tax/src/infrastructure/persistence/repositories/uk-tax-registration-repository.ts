/**
 * UK Tax Registration Repository
 *
 * Data access for UK tax registrations with HMRC.
 */

import { eq, and, isNull, count } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { ukTaxRegistrations } from '../schema.js';
import type * as schema from '../schema.js';
import type {
  UKTaxRegistration,
  CreateUKTaxRegistrationInput,
  UpdateUKTaxRegistrationInput,
  RegisterForVATInput,
  RegisterForPAYEInput,
} from '../../../domain/uk-registration/index.js';

type DbType = NodePgDatabase<typeof schema>;

export interface UKTaxRegistrationFilters {
  tenantId?: string;
  entityId?: string;
  vatRegistered?: boolean;
  payeRegistered?: boolean;
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

export class UKTaxRegistrationRepository {
  constructor(private readonly db: DbType) {}

  async findById(id: string): Promise<UKTaxRegistration | null> {
    const result = await this.db
      .select()
      .from(ukTaxRegistrations)
      .where(and(eq(ukTaxRegistrations.id, id), isNull(ukTaxRegistrations.deletedAt)))
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async findByEntityId(entityId: string): Promise<UKTaxRegistration | null> {
    const result = await this.db
      .select()
      .from(ukTaxRegistrations)
      .where(and(eq(ukTaxRegistrations.entityId, entityId), isNull(ukTaxRegistrations.deletedAt)))
      .limit(1);

    return result[0] ? this.toDomain(result[0]) : null;
  }

  async findMany(
    filters?: UKTaxRegistrationFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<UKTaxRegistration>> {
    const conditions = [isNull(ukTaxRegistrations.deletedAt)];

    if (filters?.tenantId) {
      conditions.push(eq(ukTaxRegistrations.tenantId, filters.tenantId));
    }
    if (filters?.entityId) {
      conditions.push(eq(ukTaxRegistrations.entityId, filters.entityId));
    }
    if (filters?.vatRegistered !== undefined) {
      conditions.push(eq(ukTaxRegistrations.vatRegistered, filters.vatRegistered));
    }
    if (filters?.payeRegistered !== undefined) {
      conditions.push(eq(ukTaxRegistrations.payeRegistered, filters.payeRegistered));
    }

    const whereClause = and(...conditions);
    const limit = pagination?.limit ?? 20;
    const offset = pagination?.offset ?? 0;

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(ukTaxRegistrations)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(ukTaxRegistrations.createdAt),
      this.db
        .select({ count: count() })
        .from(ukTaxRegistrations)
        .where(whereClause),
    ]);

    return {
      data: data.map(row => this.toDomain(row)),
      total: totalResult[0]?.count ?? 0,
      limit,
      offset,
    };
  }

  async create(input: CreateUKTaxRegistrationInput, createdBy?: string): Promise<UKTaxRegistration> {
    const id = randomUUID();
    const now = new Date();

    const values = {
      id,
      tenantId: input.tenantId,
      entityId: input.entityId,
      companyUTR: input.companyUTR ?? null,
      corporationTaxReference: input.corporationTaxReference ?? null,
      corporationTaxRegistered: false,
      vatRegistered: false,
      payeRegistered: false,
      accountingPeriodEnd: input.accountingPeriodEnd.toISOString().split('T')[0],
      mtdVatEnabled: false,
      mtdVatMandated: false,
      mtdItEnabled: false,
      vatThresholdExceeded: false,
      taxCorrespondenceEmail: input.taxCorrespondenceEmail ?? null,
      taxCorrespondencePhone: input.taxCorrespondencePhone ?? null,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ?? null,
      version: 1,
    };

    const [result] = await this.db
      .insert(ukTaxRegistrations)
      .values(values as any)
      .returning();

    if (!result) {
      throw new Error('Failed to create UK tax registration');
    }

    return this.toDomain(result);
  }

  async update(id: string, input: UpdateUKTaxRegistrationInput, updatedBy?: string): Promise<UKTaxRegistration> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.companyUTR !== undefined) updates.companyUTR = input.companyUTR;
    if (input.corporationTaxReference !== undefined) updates.corporationTaxReference = input.corporationTaxReference;
    if (input.accountingPeriodEnd !== undefined) updates.accountingPeriodEnd = input.accountingPeriodEnd.toISOString().split('T')[0];
    if (input.taxCorrespondenceEmail !== undefined) updates.taxCorrespondenceEmail = input.taxCorrespondenceEmail;
    if (input.taxCorrespondencePhone !== undefined) updates.taxCorrespondencePhone = input.taxCorrespondencePhone;
    if (input.annualTurnover !== undefined) updates.annualTurnover = input.annualTurnover;
    if (input.metadata !== undefined) updates.metadata = input.metadata;
    if (updatedBy !== undefined) updates.updatedBy = updatedBy;

    const [result] = await this.db
      .update(ukTaxRegistrations)
      .set(updates as any)
      .where(and(eq(ukTaxRegistrations.id, id), isNull(ukTaxRegistrations.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('UK tax registration not found: ' + id);
    }

    return this.toDomain(result);
  }

  async registerForVAT(input: RegisterForVATInput, updatedBy?: string): Promise<UKTaxRegistration> {
    const updates = {
      vatRegistered: true,
      vatNumber: input.vatNumber,
      vatRegistrationDate: input.registrationDate,
      vatScheme: input.scheme,
      flatRatePercentage: input.flatRatePercentage ?? null,
      vatQuarterEnd: input.vatQuarterEnd,
      vatStatus: 'active' as const,
      mtdVatEnabled: input.mtdEnabled,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(ukTaxRegistrations)
      .set(updates as any)
      .where(and(eq(ukTaxRegistrations.id, input.registrationId), isNull(ukTaxRegistrations.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('UK tax registration not found: ' + input.registrationId);
    }

    return this.toDomain(result);
  }

  async registerForPAYE(input: RegisterForPAYEInput, updatedBy?: string): Promise<UKTaxRegistration> {
    const updates = {
      payeRegistered: true,
      payeReference: input.payeReference,
      accountsOfficeReference: input.accountsOfficeReference,
      payeRegistrationDate: input.registrationDate,
      payeStatus: 'active' as const,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    const [result] = await this.db
      .update(ukTaxRegistrations)
      .set(updates as any)
      .where(and(eq(ukTaxRegistrations.id, input.registrationId), isNull(ukTaxRegistrations.deletedAt)))
      .returning();

    if (!result) {
      throw new Error('UK tax registration not found: ' + input.registrationId);
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
      .update(ukTaxRegistrations)
      .set(updates as any)
      .where(and(eq(ukTaxRegistrations.id, id), isNull(ukTaxRegistrations.deletedAt)));
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.db
      .select({ id: ukTaxRegistrations.id })
      .from(ukTaxRegistrations)
      .where(and(eq(ukTaxRegistrations.id, id), isNull(ukTaxRegistrations.deletedAt)))
      .limit(1);

    return result.length > 0;
  }

  private toDomain(row: typeof ukTaxRegistrations.$inferSelect): UKTaxRegistration {
    return {
      id: row.id,
      tenantId: row.tenantId,
      entityId: row.entityId,
      companyUTR: row.companyUTR,
      vatNumber: row.vatNumber,
      payeReference: row.payeReference,
      accountsOfficeReference: row.accountsOfficeReference,
      corporationTaxReference: row.corporationTaxReference,
      corporationTaxRegistered: row.corporationTaxRegistered,
      corporationTaxRegistrationDate: row.corporationTaxRegistrationDate,
      vatRegistered: row.vatRegistered,
      vatRegistrationDate: row.vatRegistrationDate,
      vatDeregistrationDate: row.vatDeregistrationDate,
      vatScheme: row.vatScheme,
      flatRatePercentage: row.flatRatePercentage,
      vatStatus: row.vatStatus,
      payeRegistered: row.payeRegistered,
      payeRegistrationDate: row.payeRegistrationDate,
      payeDeregistrationDate: row.payeDeregistrationDate,
      payeStatus: row.payeStatus,
      accountingPeriodEnd: new Date(row.accountingPeriodEnd),
      vatQuarterEnd: row.vatQuarterEnd,
      mtdVatEnabled: row.mtdVatEnabled,
      mtdVatMandated: row.mtdVatMandated,
      mtdItEnabled: row.mtdItEnabled,
      vatThresholdExceeded: row.vatThresholdExceeded,
      annualTurnover: row.annualTurnover,
      taxCorrespondenceEmail: row.taxCorrespondenceEmail,
      taxCorrespondencePhone: row.taxCorrespondencePhone,
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
