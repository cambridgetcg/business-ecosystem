/**
 * Domain Name Repository - Drizzle Implementation
 */

import { eq, and, isNull, sql, lte, gte, like, inArray } from 'drizzle-orm';
import {
  DomainName,
  type DomainNameProps,
} from '../../domain/entities/domain-name.entity.js';
import { domainNames, domainDisputes } from './schema.js';
import type { Database } from './database.js';

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface FindAllOptions {
  limit?: number | undefined;
  offset?: number | undefined;
  status?: string | undefined;
  purpose?: string | undefined;
  registrantId?: string | undefined;
  tld?: string | undefined;
  linkedTrademarkId?: string | undefined;
}

export interface FindExpiringOptions {
  daysAhead?: number | undefined;
  limit?: number | undefined;
}

export interface CountFilters {
  status?: string | undefined;
  purpose?: string | undefined;
  registrantId?: string | undefined;
  tld?: string | undefined;
}

export interface DomainNameRepository {
  findById(id: string): Promise<DomainName | null>;
  findByDomainName(domainName: string): Promise<DomainName | null>;
  findByRegistrantId(registrantId: string): Promise<DomainName[]>;
  findByLinkedTrademark(trademarkId: string): Promise<DomainName[]>;
  findExpiring(options?: FindExpiringOptions): Promise<DomainName[]>;
  findByTld(tld: string): Promise<DomainName[]>;
  findAll(options?: FindAllOptions): Promise<DomainName[]>;
  save(domain: DomainName): Promise<void>;
  delete(id: string): Promise<void>;
  count(filters?: CountFilters): Promise<number>;
  searchByName(query: string, limit?: number): Promise<DomainName[]>;
}

export class DrizzleDomainNameRepository implements DomainNameRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<DomainName | null> {
    const result = await this.db
      .select()
      .from(domainNames)
      .where(and(eq(domainNames.id, id), isNull(domainNames.deletedAt)))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByDomainName(domainName: string): Promise<DomainName | null> {
    const result = await this.db
      .select()
      .from(domainNames)
      .where(and(
        eq(domainNames.domainName, domainName.toLowerCase()),
        isNull(domainNames.deletedAt)
      ))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByRegistrantId(registrantId: string): Promise<DomainName[]> {
    const results = await this.db
      .select()
      .from(domainNames)
      .where(and(
        eq(domainNames.registrantId, registrantId),
        isNull(domainNames.deletedAt)
      ))
      .orderBy(domainNames.domainName);

    return results.map(r => this.toDomain(r));
  }

  async findByLinkedTrademark(trademarkId: string): Promise<DomainName[]> {
    const results = await this.db
      .select()
      .from(domainNames)
      .where(and(
        eq(domainNames.linkedTrademarkId, trademarkId),
        isNull(domainNames.deletedAt)
      ))
      .orderBy(domainNames.domainName);

    return results.map(r => this.toDomain(r));
  }

  async findExpiring(options?: FindExpiringOptions): Promise<DomainName[]> {
    const daysAhead = options?.daysAhead ?? 90;
    const limit = options?.limit ?? 100;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const results = await this.db
      .select()
      .from(domainNames)
      .where(and(
        isNull(domainNames.deletedAt),
        inArray(domainNames.status, ['active', 'pending_transfer']),
        lte(domainNames.expirationDate, toDateString(futureDate)),
        gte(domainNames.expirationDate, toDateString(new Date()))
      ))
      .orderBy(domainNames.expirationDate)
      .limit(limit);

    return results.map(r => this.toDomain(r));
  }

  async findByTld(tld: string): Promise<DomainName[]> {
    const normalizedTld = tld.startsWith('.') ? tld : `.${tld}`;

    const results = await this.db
      .select()
      .from(domainNames)
      .where(and(
        eq(domainNames.tld, normalizedTld),
        isNull(domainNames.deletedAt)
      ))
      .orderBy(domainNames.domainName);

    return results.map(r => this.toDomain(r));
  }

  async findAll(options?: FindAllOptions): Promise<DomainName[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = [isNull(domainNames.deletedAt)];
    if (options?.status) {
      conditions.push(eq(domainNames.status, options.status as typeof domainNames.status.enumValues[number]));
    }
    if (options?.purpose) {
      conditions.push(eq(domainNames.purpose, options.purpose as typeof domainNames.purpose.enumValues[number]));
    }
    if (options?.registrantId) {
      conditions.push(eq(domainNames.registrantId, options.registrantId));
    }
    if (options?.tld) {
      const normalizedTld = options.tld.startsWith('.') ? options.tld : `.${options.tld}`;
      conditions.push(eq(domainNames.tld, normalizedTld));
    }
    if (options?.linkedTrademarkId) {
      conditions.push(eq(domainNames.linkedTrademarkId, options.linkedTrademarkId));
    }

    const results = await this.db
      .select()
      .from(domainNames)
      .where(and(...conditions))
      .orderBy(domainNames.domainName)
      .limit(limit)
      .offset(offset);

    return results.map(r => this.toDomain(r));
  }

  async save(domain: DomainName): Promise<void> {
    const data = this.toPersistence(domain);

    await this.db
      .insert(domainNames)
      .values(data)
      .onConflictDoUpdate({
        target: domainNames.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(domainNames)
      .set({ deletedAt: new Date() })
      .where(eq(domainNames.id, id));
  }

  async count(filters?: CountFilters): Promise<number> {
    const conditions = [isNull(domainNames.deletedAt)];
    if (filters?.status) {
      conditions.push(eq(domainNames.status, filters.status as typeof domainNames.status.enumValues[number]));
    }
    if (filters?.purpose) {
      conditions.push(eq(domainNames.purpose, filters.purpose as typeof domainNames.purpose.enumValues[number]));
    }
    if (filters?.registrantId) {
      conditions.push(eq(domainNames.registrantId, filters.registrantId));
    }
    if (filters?.tld) {
      const normalizedTld = filters.tld.startsWith('.') ? filters.tld : `.${filters.tld}`;
      conditions.push(eq(domainNames.tld, normalizedTld));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(domainNames)
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  }

  async searchByName(query: string, limit = 20): Promise<DomainName[]> {
    const results = await this.db
      .select()
      .from(domainNames)
      .where(and(
        like(domainNames.domainName, `%${query.toLowerCase()}%`),
        isNull(domainNames.deletedAt)
      ))
      .orderBy(domainNames.domainName)
      .limit(limit);

    return results.map(r => this.toDomain(r));
  }

  private toDomain(row: typeof domainNames.$inferSelect): DomainName {
    const props: DomainNameProps = {
      domainName: row.domainName,
      tld: row.tld,
      status: row.status,
      purpose: row.purpose,
      registrantId: row.registrantId,
      adminContactId: row.adminContactId ?? undefined,
      techContactId: row.techContactId ?? undefined,
      registrarName: row.registrarName,
      registrarIanaId: row.registrarIanaId ?? undefined,
      registrationDate: new Date(row.registrationDate),
      expirationDate: new Date(row.expirationDate),
      autoRenew: row.autoRenew,
      privacyEnabled: row.privacyEnabled,
      locked: row.locked,
      dnssecEnabled: row.dnssecEnabled,
      linkedTrademarkId: row.linkedTrademarkId ?? undefined,
      defensiveNotes: row.defensiveNotes ?? undefined,
      nameservers: row.nameservers ?? [],
    };

    return DomainName.reconstitute(row.id, props);
  }

  private toPersistence(domain: DomainName): typeof domainNames.$inferInsert {
    return {
      id: domain.id,
      domainName: domain.domainName,
      tld: domain.tld,
      status: domain.status,
      purpose: domain.purpose,
      registrantId: domain.registrantId,
      adminContactId: domain.adminContactId ?? null,
      techContactId: domain.techContactId ?? null,
      registrarName: domain.registrarName,
      registrarIanaId: domain.registrarIanaId ?? null,
      registrationDate: toDateString(domain.registrationDate),
      expirationDate: toDateString(domain.expirationDate),
      autoRenew: domain.autoRenew,
      privacyEnabled: domain.privacyEnabled,
      locked: domain.locked,
      dnssecEnabled: domain.dnssecEnabled,
      linkedTrademarkId: domain.linkedTrademarkId ?? null,
      defensiveNotes: domain.defensiveNotes ?? null,
      nameservers: domain.nameservers,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
      createdBy: domain.createdBy ?? null,
      updatedBy: domain.updatedBy ?? null,
      version: domain.version,
    };
  }
}
