/**
 * Customer Contracts - Repository
 */

import { PrismaClient, Contract, ContractParty, Prisma } from '@prisma/client';
import { ContractQuery } from './validators.js';

export type ContractWithParties = Contract & { parties: ContractParty[] };

export class ContractRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<ContractWithParties | null> {
    return this.prisma.contract.findUnique({
      where: { id },
      include: { parties: true },
    });
  }

  async findByContractNumber(contractNumber: string): Promise<ContractWithParties | null> {
    return this.prisma.contract.findUnique({
      where: { contractNumber },
      include: { parties: true },
    });
  }

  async findMany(query: ContractQuery): Promise<{ data: ContractWithParties[]; total: number }> {
    const { status, search, partyId, fromDate, toDate, page, limit, sortBy, sortOrder } = query;
    
    const where: Prisma.ContractWhereInput = {
      type: 'CUSTOMER',
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { contractNumber: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(partyId && { parties: { some: { partyId } } }),
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

  async create(data: Prisma.ContractCreateInput): Promise<ContractWithParties> {
    return this.prisma.contract.create({
      data,
      include: { parties: true },
    });
  }

  async update(id: string, data: Prisma.ContractUpdateInput): Promise<ContractWithParties> {
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

  async addParty(contractId: string, data: Prisma.ContractPartyCreateWithoutContractInput): Promise<ContractParty> {
    return this.prisma.contractParty.create({
      data: { ...data, contract: { connect: { id: contractId } } },
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

  async findExpiring(daysAhead: number): Promise<ContractWithParties[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return this.prisma.contract.findMany({
      where: {
        type: 'CUSTOMER',
        status: 'ACTIVE',
        deletedAt: null,
        expiryDate: { lte: futureDate, gte: new Date() },
      },
      include: { parties: true },
    });
  }
}

export function createContractRepository(prisma: PrismaClient): ContractRepository {
  return new ContractRepository(prisma);
}
