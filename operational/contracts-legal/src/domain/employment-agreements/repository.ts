/**
 * Employment Agreements - Repository
 */

import { PrismaClient, EmploymentAgreement, Contract, Prisma } from '@prisma/client';
import { EmploymentQuery } from './validators.js';

export type EmploymentWithContract = EmploymentAgreement & { contract?: Contract };

export class EmploymentRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<EmploymentAgreement | null> {
    return this.prisma.employmentAgreement.findUnique({
      where: { id },
    });
  }

  async findByEmployeeId(employeeId: string): Promise<EmploymentAgreement | null> {
    return this.prisma.employmentAgreement.findFirst({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
    });
  }

  async findByContractId(contractId: string): Promise<EmploymentAgreement | null> {
    return this.prisma.employmentAgreement.findUnique({
      where: { contractId },
    });
  }

  async findMany(query: EmploymentQuery): Promise<{ data: EmploymentAgreement[]; total: number }> {
    const { employmentType, department, location, search, activeOnly, fromDate, toDate, page, limit, sortBy, sortOrder } = query;
    
    const where: Prisma.EmploymentAgreementWhereInput = {
      ...(employmentType && { employmentType }),
      ...(department && { department: { contains: department, mode: 'insensitive' as const } }),
      ...(location && { location: { contains: location, mode: 'insensitive' as const } }),
      ...(search && {
        OR: [
          { employeeName: { contains: search, mode: 'insensitive' as const } },
          { jobTitle: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(activeOnly && { endDate: null }),
      ...(fromDate && { startDate: { gte: fromDate } }),
      ...(toDate && { startDate: { lte: toDate } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.employmentAgreement.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employmentAgreement.count({ where }),
    ]);

    return { data, total };
  }

  async create(data: Prisma.EmploymentAgreementCreateInput): Promise<EmploymentAgreement> {
    return this.prisma.employmentAgreement.create({ data });
  }

  async update(id: string, data: Prisma.EmploymentAgreementUpdateInput): Promise<EmploymentAgreement> {
    return this.prisma.employmentAgreement.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<EmploymentAgreement> {
    return this.prisma.employmentAgreement.delete({
      where: { id },
    });
  }

  async getByDepartment(): Promise<{ department: string; count: number; totalSalary: number }[]> {
    const result = await this.prisma.employmentAgreement.groupBy({
      by: ['department'],
      where: { endDate: null },
      _count: true,
      _sum: { baseSalary: true },
    });
    
    return result.map(r => ({
      department: r.department || 'Unassigned',
      count: r._count,
      totalSalary: r._sum.baseSalary?.toNumber() || 0,
    }));
  }

  async getEndingContracts(daysAhead: number): Promise<EmploymentAgreement[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return this.prisma.employmentAgreement.findMany({
      where: {
        endDate: { lte: futureDate, gte: new Date() },
      },
    });
  }

  async getProbationEnding(daysAhead: number): Promise<EmploymentAgreement[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return this.prisma.employmentAgreement.findMany({
      where: {
        probationEnd: { lte: futureDate, gte: new Date() },
      },
    });
  }
}

export function createEmploymentRepository(prisma: PrismaClient): EmploymentRepository {
  return new EmploymentRepository(prisma);
}
