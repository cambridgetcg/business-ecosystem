/**
 * Vendor Contracts - Repository
 */

import { PrismaClient, Contract, ContractParty, Prisma } from '#prisma';
import { VendorContractQuery } from './validators.js';

export type VendorContractWithParties = Contract & { parties: ContractParty[] };

export class VendorContractRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<VendorContractWithParties | null> {
    return this.prisma.contract.findUnique({
      where: { id, type: 'VENDOR' },
      include: { parties: true },
    });
  }

  async findByContractNumber(contractNumber: string): Promise<VendorContractWithParties | null> {
    return this.prisma.contract.findUnique({
      where: { contractNumber },
      include: { parties: true },
    });
  }

  async findMany(query: VendorContractQuery): Promise<{ data: VendorContractWithParties[]; total: number }> {
    const { status, search, partyId, minValue, maxValue, fromDate, toDate, page, limit, sortBy, sortOrder } = query;
    
    const where: Prisma.ContractWhereInput = {
      type: 'VENDOR',
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { contractNumber: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(partyId && { parties: { some: { partyId } } }),
      ...(minValue && { value: { gte: minValue } }),
      ...(maxValue && { value: { lte: maxValue } }),
      ...(fromDate && { effectiveDate: { gte: fromDate } }),
      ...(toDate && { expiryDate: { lte: toDate } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        include: { parties: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contract.count({ where }),
    ]);

    return { data, total };
  }

  async create(data: Prisma.ContractCreateInput): Promise<VendorContractWithParties> {
    return this.prisma.contract.create({
      data,
      include: { parties: true },
    });
  }

  async update(id: string, data: Prisma.ContractUpdateInput): Promise<VendorContractWithParties> {
    return this.prisma.contract.update({
      where: { id },
      data,
      include: { parties: true },
    });
  }

  async softDelete(id: string): Promise<Contract> {
    return this.prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async signParty(contractId: string, partyId: string, signedBy: string, signatureRef?: string): Promise<ContractParty> {
    const party = await this.prisma.contractParty.findFirst({
      where: { contractId, partyId },
    });
    if (!party) throw new Error('Party not found');
    
    return this.prisma.contractParty.update({
      where: { id: party.id },
      data: {
        signedAt: new Date(),
        signedBy,
        ...(signatureRef && { signatureRef }),
      },
    });
  }

  async findExpiring(daysAhead: number): Promise<VendorContractWithParties[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return this.prisma.contract.findMany({
      where: {
        type: 'VENDOR',
        status: 'ACTIVE',
        deletedAt: null,
        expiryDate: { lte: futureDate, gte: new Date() },
      },
      include: { parties: true },
    });
  }

  async getVendorSpend(partyId: string): Promise<{ total: number; count: number }> {
    const result = await this.prisma.contract.aggregate({
      where: {
        type: 'VENDOR',
        status: 'ACTIVE',
        deletedAt: null,
        parties: { some: { partyId } },
      },
      _sum: { value: true },
      _count: true,
    });
    
    return {
      total: result._sum.value?.toNumber() || 0,
      count: result._count,
    };
  }
}

export function createVendorContractRepository(prisma: PrismaClient): VendorContractRepository {
  return new VendorContractRepository(prisma);
}
