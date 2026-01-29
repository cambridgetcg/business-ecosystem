import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { Repository, PaginatedResult, PaginationParams, QueryFilter, Entity } from '../../types/database.js';
import type { Money, BankAccountType, BankAccountStatus } from '../../types/financial.js';
import { BankAccount } from '../../domain/entities/bank-account.js';
import { bankAccounts } from './schema.js';

type BankAccountRow = typeof bankAccounts.$inferSelect;
type BankAccountInsert = typeof bankAccounts.$inferInsert;

export interface BankAccountEntity extends Entity {
  entityId: string;
  accountName: string;
  accountType: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  balance: Money;
  status: string;
  isPrimary: boolean;
  version: number;
}

export class BankAccountRepository implements Repository<BankAccountEntity> {
  private db: NodePgDatabase;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  async findById(id: string): Promise<BankAccountEntity | null> {
    const results = await this.db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), isNull(bankAccounts.deletedAt)))
      .limit(1);

    const first = results[0];
    if (!first) return null;
    return this.toEntity(first);
  }

  async findAll(params: PaginationParams = { page: 1, limit: 20 }): Promise<PaginatedResult<BankAccountEntity>> {
    const offset = (params.page - 1) * params.limit;

    const [results, countResult] = await Promise.all([
      this.db.select().from(bankAccounts).where(isNull(bankAccounts.deletedAt)).limit(params.limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(bankAccounts).where(isNull(bankAccounts.deletedAt)),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / params.limit);

    return {
      data: results.map((r) => this.toEntity(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    };
  }

  async findBy(filters: QueryFilter[]): Promise<BankAccountEntity[]> {
    const results = await this.db.select().from(bankAccounts).where(isNull(bankAccounts.deletedAt));
    
    let filtered = results;
    for (const filter of filters) {
      if (filter.operator === 'eq') {
        filtered = filtered.filter((r) => (r as Record<string, unknown>)[filter.field] === filter.value);
      }
    }
    
    return filtered.map((r) => this.toEntity(r));
  }

  async findByEntityId(entityId: string): Promise<BankAccountEntity[]> {
    const results = await this.db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.entityId, entityId), isNull(bankAccounts.deletedAt)));
    
    return results.map((r) => this.toEntity(r));
  }

  async create(data: Omit<BankAccountEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<BankAccountEntity> {
    const now = new Date();
    const insertData: BankAccountInsert = {
      entityId: data.entityId,
      accountName: data.accountName,
      accountType: data.accountType,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      currency: data.currency,
      balanceAmount: String(data.balance.amount),
      balanceCurrency: data.balance.currency,
      status: data.status,
      isPrimary: data.isPrimary,
      version: data.version ?? 1,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.db.insert(bankAccounts).values(insertData).returning();
    const first = result[0];
    if (!first) throw new Error('Failed to create bank account');
    return this.toEntity(first);
  }

  async update(id: string, data: Partial<Omit<BankAccountEntity, 'id' | 'createdAt' | 'updatedAt'>>): Promise<BankAccountEntity> {
    const updateData: Partial<BankAccountInsert> = { updatedAt: new Date() };

    if (data.accountName !== undefined) updateData.accountName = data.accountName;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;
    if (data.balance !== undefined) {
      updateData.balanceAmount = String(data.balance.amount);
      updateData.balanceCurrency = data.balance.currency;
    }
    if (data.version !== undefined) updateData.version = data.version;

    const result = await this.db
      .update(bankAccounts)
      .set(updateData)
      .where(and(eq(bankAccounts.id, id), isNull(bankAccounts.deletedAt)))
      .returning();

    const first = result[0];
    if (!first) throw new Error(`BankAccount not found: ${id}`);
    return this.toEntity(first);
  }

  async delete(id: string): Promise<void> {
    await this.db.update(bankAccounts).set({ deletedAt: new Date() }).where(eq(bankAccounts.id, id));
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.db
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), isNull(bankAccounts.deletedAt)))
      .limit(1);
    return result.length > 0;
  }

  async count(_filters?: QueryFilter[]): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(bankAccounts)
      .where(isNull(bankAccounts.deletedAt));
    return Number(result[0]?.count ?? 0);
  }

  async saveAggregate(account: BankAccount): Promise<BankAccountEntity> {
    const exists = await this.exists(account.id);
    const entityData = this.fromDomain(account);
    
    if (exists) {
      return this.update(account.id, entityData);
    }
    return this.create(entityData);
  }

  private toEntity(row: BankAccountRow): BankAccountEntity {
    return {
      id: row.id,
      entityId: row.entityId,
      accountName: row.accountName,
      accountType: row.accountType,
      bankName: row.bankName,
      accountNumber: row.accountNumber,
      currency: row.currency,
      balance: { amount: Number(row.balanceAmount), currency: row.balanceCurrency },
      status: row.status,
      isPrimary: row.isPrimary,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    };
  }

  private fromDomain(account: BankAccount): Omit<BankAccountEntity, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      entityId: account.entityId,
      accountName: account.accountName,
      accountType: account.accountType,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      currency: account.currency,
      balance: account.balance,
      status: account.status,
      isPrimary: account.isPrimary,
      version: 1,
    };
  }

  toDomain(entity: BankAccountEntity): BankAccount {
    return new BankAccount({
      id: entity.id,
      entityId: entity.entityId,
      accountName: entity.accountName,
      accountType: entity.accountType as BankAccountType,
      bankName: entity.bankName,
      accountNumber: entity.accountNumber,
      currency: entity.currency,
      balance: entity.balance,
      status: entity.status as BankAccountStatus,
      isPrimary: entity.isPrimary,
      createdAt: entity.createdAt,
    });
  }
}
