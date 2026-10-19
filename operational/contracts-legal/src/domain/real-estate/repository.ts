/**
 * Real Estate - Repository
 */

import { PrismaClient, Property, Prisma } from '#prisma';
import { PropertyQuery } from './validators.js';

export class PropertyRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Property | null> {
    return this.prisma.property.findUnique({ where: { id } });
  }

  async findMany(query: PropertyQuery): Promise<{ data: Property[]; total: number }> {
    const { type, owned, city, state, minSquareFeet, maxSquareFeet, minValue, maxValue, search, page, limit, sortBy, sortOrder } = query;
    
    const where: Prisma.PropertyWhereInput = {
      ...(type && { type }),
      ...(owned !== undefined && { owned }),
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
      ...(state && { state: { contains: state, mode: 'insensitive' as const } }),
      ...(minSquareFeet && { squareFeet: { gte: minSquareFeet } }),
      ...(maxSquareFeet && { squareFeet: { lte: maxSquareFeet } }),
      ...(minValue && { currentValue: { gte: minValue } }),
      ...(maxValue && { currentValue: { lte: maxValue } }),
      ...(search && {
        OR: [
          { addressLine1: { contains: search, mode: 'insensitive' as const } },
          { city: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.property.count({ where }),
    ]);

    return { data, total };
  }

  async create(data: Prisma.PropertyCreateInput): Promise<Property> {
    return this.prisma.property.create({ data });
  }

  async update(id: string, data: Prisma.PropertyUpdateInput): Promise<Property> {
    return this.prisma.property.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Property> {
    return this.prisma.property.delete({ where: { id } });
  }

  async getPortfolioValue(): Promise<{ owned: number; leased: number; total: number }> {
    const [ownedResult, leasedResult] = await Promise.all([
      this.prisma.property.aggregate({
        where: { owned: true },
        _sum: { currentValue: true },
      }),
      this.prisma.property.aggregate({
        where: { owned: false },
        _sum: { currentValue: true },
      }),
    ]);

    const owned = ownedResult._sum.currentValue?.toNumber() || 0;
    const leased = leasedResult._sum.currentValue?.toNumber() || 0;

    return { owned, leased, total: owned + leased };
  }

  async getByType(): Promise<{ type: string; count: number; totalValue: number }[]> {
    const result = await this.prisma.property.groupBy({
      by: ['type'],
      _count: true,
      _sum: { currentValue: true },
    });

    return result.map(r => ({
      type: r.type,
      count: r._count,
      totalValue: r._sum.currentValue?.toNumber() || 0,
    }));
  }
}

export function createPropertyRepository(prisma: PrismaClient): PropertyRepository {
  return new PropertyRepository(prisma);
}
