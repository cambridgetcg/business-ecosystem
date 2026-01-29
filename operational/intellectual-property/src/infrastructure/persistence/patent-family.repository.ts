/**
 * Patent Family Repository - Drizzle Implementation
 */

import { eq, and, isNull, sql } from 'drizzle-orm';
import {
  PatentFamily,
  type PatentFamilyProps,
  type PatentFamilyMember,
} from '../../domain/entities/patent-family.entity.js';
import { patentFamilies, patentFamilyMembers } from './schema.js';
import type { Database } from './database.js';

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface FindAllOptions {
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface CountFilters {
  technologyArea?: string | undefined;
}

export interface PatentFamilyRepository {
  findById(id: string): Promise<PatentFamily | null>;
  findByPatentId(patentId: string): Promise<PatentFamily | null>;
  findByPriorityPatentId(priorityPatentId: string): Promise<PatentFamily | null>;
  findAll(options?: FindAllOptions): Promise<PatentFamily[]>;
  save(family: PatentFamily): Promise<void>;
  delete(id: string): Promise<void>;
  count(filters?: CountFilters): Promise<number>;
}

export class DrizzlePatentFamilyRepository implements PatentFamilyRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<PatentFamily | null> {
    const familyResult = await this.db
      .select()
      .from(patentFamilies)
      .where(and(eq(patentFamilies.id, id), isNull(patentFamilies.deletedAt)))
      .limit(1);

    const familyRow = familyResult[0];
    if (!familyRow) return null;

    const members = await this.loadMembers(id);
    return this.toDomain(familyRow, members);
  }

  async findByPatentId(patentId: string): Promise<PatentFamily | null> {
    // Find the family that contains this patent as a member
    const memberResult = await this.db
      .select()
      .from(patentFamilyMembers)
      .where(and(
        eq(patentFamilyMembers.patentId, patentId),
        isNull(patentFamilyMembers.deletedAt)
      ))
      .limit(1);

    const memberRow = memberResult[0];
    if (!memberRow) return null;

    return this.findById(memberRow.familyId);
  }

  async findByPriorityPatentId(priorityPatentId: string): Promise<PatentFamily | null> {
    const familyResult = await this.db
      .select()
      .from(patentFamilies)
      .where(and(
        eq(patentFamilies.priorityPatentId, priorityPatentId),
        isNull(patentFamilies.deletedAt)
      ))
      .limit(1);

    const familyRow = familyResult[0];
    if (!familyRow) return null;

    const members = await this.loadMembers(familyRow.id);
    return this.toDomain(familyRow, members);
  }

  async findAll(options?: FindAllOptions): Promise<PatentFamily[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const familyResults = await this.db
      .select()
      .from(patentFamilies)
      .where(isNull(patentFamilies.deletedAt))
      .limit(limit)
      .offset(offset);

    const families: PatentFamily[] = [];
    for (const familyRow of familyResults) {
      const members = await this.loadMembers(familyRow.id);
      families.push(this.toDomain(familyRow, members));
    }

    return families;
  }

  async save(family: PatentFamily): Promise<void> {
    const familyData = this.familyToPersistence(family);

    // Upsert family
    await this.db
      .insert(patentFamilies)
      .values(familyData)
      .onConflictDoUpdate({
        target: patentFamilies.id,
        set: {
          ...familyData,
          updatedAt: new Date(),
        },
      });

    // Get existing members
    const existingMembers = await this.db
      .select()
      .from(patentFamilyMembers)
      .where(and(
        eq(patentFamilyMembers.familyId, family.id),
        isNull(patentFamilyMembers.deletedAt)
      ));

    const existingMemberIds = new Set(existingMembers.map(m => m.id));
    const currentMemberIds = new Set(family.members.map(m => m.id));

    // Soft delete removed members
    for (const existing of existingMembers) {
      if (!currentMemberIds.has(existing.id)) {
        await this.db
          .update(patentFamilyMembers)
          .set({ deletedAt: new Date() })
          .where(eq(patentFamilyMembers.id, existing.id));
      }
    }

    // Upsert current members
    for (const member of family.members) {
      const memberData = this.memberToPersistence(family.id, member);
      await this.db
        .insert(patentFamilyMembers)
        .values(memberData)
        .onConflictDoUpdate({
          target: patentFamilyMembers.id,
          set: {
            ...memberData,
            updatedAt: new Date(),
          },
        });
    }
  }

  async delete(id: string): Promise<void> {
    const now = new Date();

    // Soft delete members
    await this.db
      .update(patentFamilyMembers)
      .set({ deletedAt: now })
      .where(eq(patentFamilyMembers.familyId, id));

    // Soft delete family
    await this.db
      .update(patentFamilies)
      .set({ deletedAt: now })
      .where(eq(patentFamilies.id, id));
  }

  async count(filters?: CountFilters): Promise<number> {
    const conditions = [isNull(patentFamilies.deletedAt)];
    if (filters?.technologyArea) {
      conditions.push(eq(patentFamilies.technologyArea, filters.technologyArea));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(patentFamilies)
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  }

  private async loadMembers(familyId: string): Promise<PatentFamilyMember[]> {
    const memberResults = await this.db
      .select()
      .from(patentFamilyMembers)
      .where(and(
        eq(patentFamilyMembers.familyId, familyId),
        isNull(patentFamilyMembers.deletedAt)
      ));

    return memberResults.map(row => this.memberToDomain(row));
  }

  private toDomain(
    row: typeof patentFamilies.$inferSelect,
    members: PatentFamilyMember[]
  ): PatentFamily {
    const props: PatentFamilyProps = {
      familyName: row.familyName,
      priorityPatentId: row.priorityPatentId,
      priorityDate: new Date(row.priorityDate),
      members,
      ...(row.description && { description: row.description }),
      ...(row.technologyArea && { technologyArea: row.technologyArea }),
    };

    return PatentFamily.reconstitute(row.id, props);
  }

  private memberToDomain(row: typeof patentFamilyMembers.$inferSelect): PatentFamilyMember {
    return {
      id: row.id,
      patentId: row.patentId,
      continuationType: row.continuationType,
      isTrueDivisional: row.isTrueDivisional,
      ...(row.parentPatentId && { parentPatentId: row.parentPatentId }),
      ...(row.restrictionDate && { restrictionDate: new Date(row.restrictionDate) }),
      ...(row.notes && { notes: row.notes }),
    };
  }

  private familyToPersistence(family: PatentFamily): typeof patentFamilies.$inferInsert {
    return {
      id: family.id,
      familyName: family.familyName,
      priorityPatentId: family.priorityPatentId,
      priorityDate: toDateString(family.priorityDate),
      description: family.description ?? null,
      technologyArea: family.technologyArea ?? null,
      createdAt: family.createdAt,
      updatedAt: family.updatedAt,
      createdBy: family.createdBy ?? null,
      updatedBy: family.updatedBy ?? null,
      version: family.version,
    };
  }

  private memberToPersistence(
    familyId: string,
    member: PatentFamilyMember
  ): typeof patentFamilyMembers.$inferInsert {
    return {
      id: member.id,
      familyId,
      patentId: member.patentId,
      parentPatentId: member.parentPatentId ?? null,
      continuationType: member.continuationType,
      isTrueDivisional: member.isTrueDivisional,
      restrictionDate: member.restrictionDate ? toDateString(member.restrictionDate) : null,
      notes: member.notes ?? null,
    };
  }
}
