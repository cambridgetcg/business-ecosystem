/**
 * License Repository - Drizzle Implementation
 */

import { eq, and, isNull, sql, or } from 'drizzle-orm';
import { License, type LicenseProps, type RoyaltyTerms, type TerritoryRestriction } from '../../domain/entities/license.entity.js';
import { licenses } from './schema.js';
import type { Database } from './database.js';

export interface FindAllOptions {
  limit?: number | undefined;
  offset?: number | undefined;
  status?: string | undefined;
  licenseType?: string | undefined;
  ipType?: string | undefined;
}

export interface CountFilters {
  status?: string | undefined;
  licenseType?: string | undefined;
  ipType?: string | undefined;
}

export interface LicenseRepository {
  findById(id: string): Promise<License | null>;
  findByLicenseNumber(licenseNumber: string): Promise<License | null>;
  findByLicensor(licensorId: string): Promise<License[]>;
  findByLicensee(licenseeId: string): Promise<License[]>;
  findByParty(partyId: string): Promise<License[]>;
  findByAsset(ipType: string, ipAssetId: string): Promise<License[]>;
  findAll(options?: FindAllOptions): Promise<License[]>;
  save(license: License): Promise<void>;
  delete(id: string): Promise<void>;
  count(filters?: CountFilters): Promise<number>;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class DrizzleLicenseRepository implements LicenseRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<License | null> {
    const result = await this.db
      .select()
      .from(licenses)
      .where(and(eq(licenses.id, id), isNull(licenses.deletedAt)))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByLicenseNumber(licenseNumber: string): Promise<License | null> {
    const result = await this.db
      .select()
      .from(licenses)
      .where(and(eq(licenses.licenseNumber, licenseNumber), isNull(licenses.deletedAt)))
      .limit(1);

    const row = result[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByLicensor(licensorId: string): Promise<License[]> {
    const results = await this.db
      .select()
      .from(licenses)
      .where(and(eq(licenses.licensorId, licensorId), isNull(licenses.deletedAt)));

    return results.map(r => this.toDomain(r));
  }

  async findByLicensee(licenseeId: string): Promise<License[]> {
    const results = await this.db
      .select()
      .from(licenses)
      .where(and(eq(licenses.licenseeId, licenseeId), isNull(licenses.deletedAt)));

    return results.map(r => this.toDomain(r));
  }

  async findByParty(partyId: string): Promise<License[]> {
    const results = await this.db
      .select()
      .from(licenses)
      .where(and(
        or(eq(licenses.licensorId, partyId), eq(licenses.licenseeId, partyId)),
        isNull(licenses.deletedAt)
      ));

    return results.map(r => this.toDomain(r));
  }

  async findByAsset(ipType: string, ipAssetId: string): Promise<License[]> {
    const results = await this.db
      .select()
      .from(licenses)
      .where(and(
        eq(licenses.ipType, ipType as typeof licenses.ipType.enumValues[number]),
        eq(licenses.ipAssetId, ipAssetId),
        isNull(licenses.deletedAt)
      ));

    return results.map(r => this.toDomain(r));
  }

  async findAll(options?: FindAllOptions): Promise<License[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = [isNull(licenses.deletedAt)];
    if (options?.status) {
      conditions.push(eq(licenses.status, options.status as typeof licenses.status.enumValues[number]));
    }
    if (options?.licenseType) {
      conditions.push(eq(licenses.licenseType, options.licenseType as typeof licenses.licenseType.enumValues[number]));
    }
    if (options?.ipType) {
      conditions.push(eq(licenses.ipType, options.ipType as typeof licenses.ipType.enumValues[number]));
    }

    const results = await this.db
      .select()
      .from(licenses)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    return results.map(r => this.toDomain(r));
  }

  async save(license: License): Promise<void> {
    const data = this.toPersistence(license);

    await this.db
      .insert(licenses)
      .values(data)
      .onConflictDoUpdate({
        target: licenses.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(licenses)
      .set({ deletedAt: new Date() })
      .where(eq(licenses.id, id));
  }

  async count(filters?: CountFilters): Promise<number> {
    const conditions = [isNull(licenses.deletedAt)];
    if (filters?.status) {
      conditions.push(eq(licenses.status, filters.status as typeof licenses.status.enumValues[number]));
    }
    if (filters?.licenseType) {
      conditions.push(eq(licenses.licenseType, filters.licenseType as typeof licenses.licenseType.enumValues[number]));
    }
    if (filters?.ipType) {
      conditions.push(eq(licenses.ipType, filters.ipType as typeof licenses.ipType.enumValues[number]));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(licenses)
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  }

  private toDomain(row: typeof licenses.$inferSelect): License {
    const props: LicenseProps = {
      licenseNumber: row.licenseNumber,
      ipType: row.ipType,
      ipAssetId: row.ipAssetId,
      licenseType: row.licenseType,
      status: row.status,
      licensorId: row.licensorId,
      licenseeId: row.licenseeId,
      effectiveDate: new Date(row.effectiveDate),
      expirationDate: row.expirationDate ? new Date(row.expirationDate) : undefined,
      terminationDate: row.terminationDate ? new Date(row.terminationDate) : undefined,
      territory: row.territory as TerritoryRestriction,
      royaltyTerms: row.royaltyTerms as RoyaltyTerms,
      fieldOfUse: row.fieldOfUse ?? undefined,
      canSublicense: row.canSublicense,
      sublicenseOf: row.sublicenseOf ?? undefined,
    };

    return License.reconstitute(row.id, props);
  }

  private toPersistence(license: License): typeof licenses.$inferInsert {
    return {
      id: license.id,
      licenseNumber: license.licenseNumber,
      ipType: license.ipType,
      ipAssetId: license.ipAssetId,
      licenseType: license.licenseType,
      status: license.status,
      licensorId: license.licensorId,
      licenseeId: license.licenseeId,
      effectiveDate: toDateString(license.effectiveDate),
      expirationDate: license.expirationDate ? toDateString(license.expirationDate) : null,
      terminationDate: license.terminationDate ? toDateString(license.terminationDate) : null,
      territory: license.territory,
      royaltyTerms: license.royaltyTerms,
      fieldOfUse: license.fieldOfUse ?? null,
      canSublicense: license.canSublicense,
      sublicenseOf: license.sublicenseOf ?? null,
      createdAt: license.createdAt,
      updatedAt: license.updatedAt,
      createdBy: license.createdBy ?? null,
      updatedBy: license.updatedBy ?? null,
      version: license.version,
    };
  }
}
