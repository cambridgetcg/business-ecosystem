/**
 * Customer Contracts - Service Layer
 */

import { nanoid } from 'nanoid';
import { addDays } from 'date-fns';
import { Prisma } from '@prisma/client';
import { ContractRepository, ContractWithParties } from './repository.js';
import { CreateContractInput, UpdateContractInput, ContractQuery, SignContractInput } from './validators.js';
import { NotFoundError, ContractStatusError, BusinessRuleError, ConflictError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export class CustomerContractService {
  private log = logger.child({ domain: 'customer-contracts' });

  constructor(private repository: ContractRepository) {}

  async getContract(id: string): Promise<ContractWithParties> {
    const contract = await this.repository.findById(id);
    if (!contract) {
      throw new NotFoundError('Contract', id);
    }
    return contract;
  }

  async listContracts(query: ContractQuery): Promise<{ data: ContractWithParties[]; total: number; page: number; limit: number }> {
    const { data, total } = await this.repository.findMany(query);
    return { data, total, page: query.page, limit: query.limit };
  }

  async createContract(input: CreateContractInput, userId: string): Promise<ContractWithParties> {
    const contractNumber = this.generateContractNumber();
    
    const createData: Prisma.ContractCreateInput = {
      contractNumber,
      type: 'CUSTOMER',
      status: 'DRAFT',
      title: input.title,
      createdBy: userId,
      parties: {
        create: input.parties.map(p => ({
          partyId: p.partyId,
          role: p.role,
          isPrimary: p.isPrimary,
        })),
      },
    };

    if (input.description) createData.description = input.description;
    if (input.effectiveDate) createData.effectiveDate = input.effectiveDate;
    if (input.expiryDate) createData.expiryDate = input.expiryDate;
    if (input.value !== undefined) createData.value = input.value;
    if (input.currency) createData.currency = input.currency;
    if (input.paymentTerms) createData.paymentTerms = input.paymentTerms;
    if (input.autoRenewal !== undefined) createData.autoRenewal = input.autoRenewal;
    if (input.renewalTermDays) createData.renewalTermDays = input.renewalTermDays;
    if (input.renewalNoticeDays) createData.renewalNoticeDays = input.renewalNoticeDays;
    if (input.templateId) createData.template = { connect: { id: input.templateId } };

    const contract = await this.repository.create(createData);
    this.log.info({ contractId: contract.id, contractNumber }, 'Contract created');
    return contract;
  }

  async updateContract(id: string, input: UpdateContractInput, userId: string): Promise<ContractWithParties> {
    const existing = await this.getContract(id);
    
    if (!['DRAFT', 'PENDING_REVIEW', 'IN_NEGOTIATION'].includes(existing.status)) {
      throw new ContractStatusError(existing.status, ['DRAFT', 'PENDING_REVIEW', 'IN_NEGOTIATION'], 'update');
    }

    const updateData: Prisma.ContractUpdateInput = { updatedBy: userId };
    if (input.title) updateData.title = input.title;
    if (input.description) updateData.description = input.description;
    if (input.effectiveDate) updateData.effectiveDate = input.effectiveDate;
    if (input.expiryDate) updateData.expiryDate = input.expiryDate;
    if (input.value !== undefined) updateData.value = input.value;
    if (input.currency) updateData.currency = input.currency;
    if (input.paymentTerms) updateData.paymentTerms = input.paymentTerms;
    if (input.autoRenewal !== undefined) updateData.autoRenewal = input.autoRenewal;
    if (input.renewalTermDays) updateData.renewalTermDays = input.renewalTermDays;
    if (input.renewalNoticeDays) updateData.renewalNoticeDays = input.renewalNoticeDays;

    const contract = await this.repository.update(id, updateData);
    this.log.info({ contractId: id }, 'Contract updated');
    return contract;
  }

  async deleteContract(id: string): Promise<void> {
    const existing = await this.getContract(id);
    
    if (existing.status === 'ACTIVE') {
      throw new BusinessRuleError('Cannot delete an active contract. Terminate it first.');
    }

    await this.repository.softDelete(id);
    this.log.info({ contractId: id }, 'Contract deleted');
  }

  async submitForReview(id: string, userId: string): Promise<ContractWithParties> {
    const existing = await this.getContract(id);
    
    if (existing.status !== 'DRAFT') {
      throw new ContractStatusError(existing.status, 'DRAFT', 'submit for review');
    }

    return this.repository.update(id, { status: 'PENDING_REVIEW', updatedBy: userId });
  }

  async approveContract(id: string, userId: string): Promise<ContractWithParties> {
    const existing = await this.getContract(id);
    
    if (existing.status !== 'PENDING_APPROVAL') {
      throw new ContractStatusError(existing.status, 'PENDING_APPROVAL', 'approve');
    }

    return this.repository.update(id, { status: 'PENDING_SIGNATURE', updatedBy: userId });
  }

  async signContract(id: string, input: SignContractInput, userId: string): Promise<ContractWithParties> {
    const existing = await this.getContract(id);
    
    if (existing.status !== 'PENDING_SIGNATURE') {
      throw new ContractStatusError(existing.status, 'PENDING_SIGNATURE', 'sign');
    }

    const party = existing.parties.find(p => p.partyId === input.partyId);
    if (!party) {
      throw new NotFoundError('Contract party', input.partyId);
    }
    if (party.signedAt) {
      throw new ConflictError('This party has already signed the contract');
    }

    await this.repository.signParty(id, input.partyId, input.signedBy, input.signatureRef);

    const updated = await this.getContract(id);
    const allSigned = updated.parties.every(p => p.signedAt);

    if (allSigned) {
      return this.repository.update(id, { status: 'ACTIVE', signedDate: new Date(), updatedBy: userId });
    }

    return updated;
  }

  async terminateContract(id: string, userId: string): Promise<ContractWithParties> {
    const existing = await this.getContract(id);
    
    if (existing.status !== 'ACTIVE') {
      throw new ContractStatusError(existing.status, 'ACTIVE', 'terminate');
    }

    return this.repository.update(id, { status: 'TERMINATED', terminatedDate: new Date(), updatedBy: userId });
  }

  async renewContract(id: string, userId: string): Promise<ContractWithParties> {
    const existing = await this.getContract(id);
    
    if (!['ACTIVE', 'EXPIRED'].includes(existing.status)) {
      throw new ContractStatusError(existing.status, ['ACTIVE', 'EXPIRED'], 'renew');
    }

    if (!existing.renewalTermDays) {
      throw new BusinessRuleError('Contract does not have renewal terms defined');
    }

    const newExpiryDate = addDays(existing.expiryDate || new Date(), existing.renewalTermDays);

    return this.repository.update(id, { status: 'ACTIVE', expiryDate: newExpiryDate, updatedBy: userId });
  }

  async getExpiringContracts(daysAhead: number = 30): Promise<ContractWithParties[]> {
    return this.repository.findExpiring(daysAhead);
  }

  private generateContractNumber(): string {
    const year = new Date().getFullYear();
    const random = nanoid(8).toUpperCase();
    return 'CUS-' + year + '-' + random;
  }
}

export function createCustomerContractService(repository: ContractRepository): CustomerContractService {
  return new CustomerContractService(repository);
}
