/**
 * Contract Templates - Repository
 */

import { PrismaClient, ContractTemplate, TemplateClause, Prisma } from '@prisma/client';
import { TemplateQuery } from './validators.js';

export type TemplateWithClauses = ContractTemplate & { clauses: TemplateClause[] };

export class TemplateRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<TemplateWithClauses | null> {
    return this.prisma.contractTemplate.findUnique({
      where: { id },
      include: { clauses: { orderBy: { order: 'asc' } } },
    });
  }

  async findByName(name: string): Promise<ContractTemplate | null> {
    return this.prisma.contractTemplate.findFirst({
      where: { name },
    });
  }

  async findMany(query: TemplateQuery): Promise<{ data: TemplateWithClauses[]; total: number }> {
    const { type, search, activeOnly, page, limit, sortBy, sortOrder } = query;
    
    const where: Prisma.ContractTemplateWhereInput = {
      ...(type && { type }),
      ...(activeOnly && { isActive: true }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.contractTemplate.findMany({
        where,
        include: { clauses: { orderBy: { order: 'asc' } } },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contractTemplate.count({ where }),
    ]);

    return { data, total };
  }

  async create(data: Prisma.ContractTemplateCreateInput): Promise<TemplateWithClauses> {
    return this.prisma.contractTemplate.create({
      data,
      include: { clauses: { orderBy: { order: 'asc' } } },
    });
  }

  async update(id: string, data: Prisma.ContractTemplateUpdateInput): Promise<TemplateWithClauses> {
    return this.prisma.contractTemplate.update({
      where: { id },
      data,
      include: { clauses: { orderBy: { order: 'asc' } } },
    });
  }

  async delete(id: string): Promise<ContractTemplate> {
    // First delete clauses
    await this.prisma.templateClause.deleteMany({
      where: { templateId: id },
    });
    
    return this.prisma.contractTemplate.delete({
      where: { id },
    });
  }

  async addClause(templateId: string, clause: Prisma.TemplateClauseCreateWithoutTemplateInput): Promise<TemplateClause> {
    return this.prisma.templateClause.create({
      data: {
        ...clause,
        template: { connect: { id: templateId } },
      },
    });
  }

  async updateClause(id: string, data: Prisma.TemplateClauseUpdateInput): Promise<TemplateClause> {
    return this.prisma.templateClause.update({
      where: { id },
      data,
    });
  }

  async deleteClause(id: string): Promise<TemplateClause> {
    return this.prisma.templateClause.delete({
      where: { id },
    });
  }

  async getUsageCount(templateId: string): Promise<number> {
    return this.prisma.contract.count({
      where: { templateId },
    });
  }
}

export function createTemplateRepository(prisma: PrismaClient): TemplateRepository {
  return new TemplateRepository(prisma);
}
