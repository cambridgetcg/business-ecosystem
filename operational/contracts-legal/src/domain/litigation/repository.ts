/**
 * Litigation / Legal Matters - Repository
 */

import { PrismaClient, LegalMatter, MatterActivity, Prisma, MatterStatus } from '@prisma/client';
import { MatterQuery } from './validators.js';

export type MatterWithActivities = LegalMatter & { activities: MatterActivity[] };

export class LitigationRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<MatterWithActivities | null> {
    return this.prisma.legalMatter.findUnique({
      where: { id },
      include: { activities: { orderBy: { performedAt: 'desc' }, take: 10 } },
    });
  }

  async findByMatterNumber(matterNumber: string): Promise<LegalMatter | null> {
    return this.prisma.legalMatter.findUnique({
      where: { matterNumber },
    });
  }

  async findMany(query: MatterQuery): Promise<{ data: MatterWithActivities[]; total: number }> {
    const { type, status, priority, search, internalLead, openOnly, fromDate, toDate, page, limit, sortBy, sortOrder } = query;
    
    const openStatuses: MatterStatus[] = ['OPEN', 'UNDER_REVIEW', 'IN_DISCOVERY', 'IN_NEGOTIATION', 'IN_TRIAL'];
    
    const where: Prisma.LegalMatterWhereInput = {
      ...(type && { type }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(internalLead && { internalLead: { contains: internalLead, mode: 'insensitive' as const } }),
      ...(openOnly && { status: { in: openStatuses } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { matterNumber: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(fromDate && { createdAt: { gte: fromDate } }),
      ...(toDate && { createdAt: { lte: toDate } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.legalMatter.findMany({
        where,
        include: { activities: { orderBy: { performedAt: 'desc' }, take: 5 } },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.legalMatter.count({ where }),
    ]);

    return { data, total };
  }

  async create(data: Prisma.LegalMatterCreateInput): Promise<MatterWithActivities> {
    return this.prisma.legalMatter.create({
      data,
      include: { activities: true },
    });
  }

  async update(id: string, data: Prisma.LegalMatterUpdateInput): Promise<MatterWithActivities> {
    return this.prisma.legalMatter.update({
      where: { id },
      data,
      include: { activities: { orderBy: { performedAt: 'desc' }, take: 10 } },
    });
  }

  async delete(id: string): Promise<LegalMatter> {
    await this.prisma.matterActivity.deleteMany({ where: { matterId: id } });
    return this.prisma.legalMatter.delete({ where: { id } });
  }

  async addActivity(matterId: string, data: Prisma.MatterActivityCreateWithoutMatterInput): Promise<MatterActivity> {
    return this.prisma.matterActivity.create({
      data: {
        ...data,
        matter: { connect: { id: matterId } },
      },
    });
  }

  async getActivities(matterId: string, limit: number = 50): Promise<MatterActivity[]> {
    return this.prisma.matterActivity.findMany({
      where: { matterId },
      orderBy: { performedAt: 'desc' },
      take: limit,
    });
  }

  async getStatsByType(): Promise<{ type: string; count: number; openCount: number }[]> {
    const openStatuses: MatterStatus[] = ['OPEN', 'UNDER_REVIEW', 'IN_DISCOVERY', 'IN_NEGOTIATION', 'IN_TRIAL'];
    
    const all = await this.prisma.legalMatter.groupBy({
      by: ['type'],
      _count: { _all: true },
    });

    const open = await this.prisma.legalMatter.groupBy({
      by: ['type'],
      where: { status: { in: openStatuses } },
      _count: { _all: true },
    });

    const openMap = new Map(open.map(o => [o.type, o._count._all]));

    return all.map(a => ({
      type: a.type,
      count: a._count._all,
      openCount: openMap.get(a.type) || 0,
    }));
  }

  async getUpcomingHearings(daysAhead: number): Promise<LegalMatter[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return this.prisma.legalMatter.findMany({
      where: {
        hearingDate: { lte: futureDate, gte: new Date() },
        status: { notIn: ['SETTLED', 'WON', 'LOST', 'DISMISSED', 'CLOSED'] },
      },
      orderBy: { hearingDate: 'asc' },
    });
  }

  async getTotalExposure(): Promise<{ estimated: number; actual: number; settled: number }> {
    const result = await this.prisma.legalMatter.aggregate({
      _sum: {
        estimatedCost: true,
        actualCost: true,
        settlement: true,
      },
    });

    return {
      estimated: result._sum.estimatedCost?.toNumber() || 0,
      actual: result._sum.actualCost?.toNumber() || 0,
      settled: result._sum.settlement?.toNumber() || 0,
    };
  }
}

export function createLitigationRepository(prisma: PrismaClient): LitigationRepository {
  return new LitigationRepository(prisma);
}
