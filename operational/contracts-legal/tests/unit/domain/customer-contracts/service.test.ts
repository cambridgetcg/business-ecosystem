/**
 * Customer Contracts Service - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerContractService } from '../../../../src/domain/customer-contracts/service.js';
import type { ContractRepository, ContractWithParties } from '../../../../src/domain/customer-contracts/repository.js';
import { NotFoundError, ContractStatusError, BusinessRuleError, ConflictError } from '../../../../src/lib/errors.js';
import { createMockContractWithParties, createMockCreateContractInput } from '../../../helpers/mock-factory.js';

describe('CustomerContractService', () => {
  let service: CustomerContractService;
  let mockRepository: {
    findById: ReturnType<typeof vi.fn>;
    findByContractNumber: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    addParty: ReturnType<typeof vi.fn>;
    signParty: ReturnType<typeof vi.fn>;
    findExpiring: ReturnType<typeof vi.fn>;
  };
  const userId = 'user-123';

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      findByContractNumber: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      addParty: vi.fn(),
      signParty: vi.fn(),
      findExpiring: vi.fn(),
    };
    service = new CustomerContractService(mockRepository as unknown as ContractRepository);
  });

  describe('getContract', () => {
    it('should return contract when found', async () => {
      const mockContract = createMockContractWithParties();
      mockRepository.findById.mockResolvedValue(mockContract);

      const result = await service.getContract(mockContract.id);

      expect(result).toEqual(mockContract);
      expect(mockRepository.findById).toHaveBeenCalledWith(mockContract.id);
    });

    it('should throw NotFoundError when contract does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getContract('non-existent-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listContracts', () => {
    it('should return paginated contracts', async () => {
      const mockContracts = [createMockContractWithParties(), createMockContractWithParties()];
      mockRepository.findMany.mockResolvedValue({ data: mockContracts, total: 2 });

      const query = { page: 1, limit: 20, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };
      const result = await service.listContracts(query);

      expect(result.data).toEqual(mockContracts);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('createContract', () => {
    it('should create a new contract with generated contract number', async () => {
      const input = createMockCreateContractInput();
      const createdContract = createMockContractWithParties({ status: 'DRAFT' });
      mockRepository.create.mockResolvedValue(createdContract);

      const result = await service.createContract(input, userId);

      expect(result).toEqual(createdContract);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CUSTOMER',
          status: 'DRAFT',
          title: input.title,
          createdBy: userId,
        })
      );
    });

    it('should generate contract number with correct format', async () => {
      const input = createMockCreateContractInput();
      const createdContract = createMockContractWithParties();
      mockRepository.create.mockResolvedValue(createdContract);

      await service.createContract(input, userId);

      const createCall = mockRepository.create.mock.calls[0][0];
      expect(createCall.contractNumber).toMatch(/^CUS-\d{4}-[A-Z0-9]{8}$/);
    });
  });

  describe('updateContract', () => {
    it('should update contract when in DRAFT status', async () => {
      const existingContract = createMockContractWithParties({ status: 'DRAFT' });
      const updatedContract = { ...existingContract, title: 'Updated Title' };
      mockRepository.findById.mockResolvedValue(existingContract);
      mockRepository.update.mockResolvedValue(updatedContract);

      const result = await service.updateContract(existingContract.id, { title: 'Updated Title' }, userId);

      expect(result.title).toBe('Updated Title');
    });

    it('should update contract when in PENDING_REVIEW status', async () => {
      const existingContract = createMockContractWithParties({ status: 'PENDING_REVIEW' });
      mockRepository.findById.mockResolvedValue(existingContract);
      mockRepository.update.mockResolvedValue(existingContract);

      await expect(
        service.updateContract(existingContract.id, { title: 'Updated' }, userId)
      ).resolves.toBeDefined();
    });

    it('should throw ContractStatusError when contract is ACTIVE', async () => {
      const existingContract = createMockContractWithParties({ status: 'ACTIVE' });
      mockRepository.findById.mockResolvedValue(existingContract);

      await expect(
        service.updateContract(existingContract.id, { title: 'Updated' }, userId)
      ).rejects.toThrow(ContractStatusError);
    });
  });

  describe('deleteContract', () => {
    it('should soft delete contract when not ACTIVE', async () => {
      const contract = createMockContractWithParties({ status: 'DRAFT' });
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.softDelete.mockResolvedValue({ ...contract, deletedAt: new Date() });

      await service.deleteContract(contract.id);

      expect(mockRepository.softDelete).toHaveBeenCalledWith(contract.id);
    });

    it('should throw BusinessRuleError when contract is ACTIVE', async () => {
      const contract = createMockContractWithParties({ status: 'ACTIVE' });
      mockRepository.findById.mockResolvedValue(contract);

      await expect(service.deleteContract(contract.id)).rejects.toThrow(BusinessRuleError);
      expect(mockRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('submitForReview', () => {
    it('should transition from DRAFT to PENDING_REVIEW', async () => {
      const contract = createMockContractWithParties({ status: 'DRAFT' });
      const updatedContract = { ...contract, status: 'PENDING_REVIEW' as const };
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.update.mockResolvedValue(updatedContract);

      const result = await service.submitForReview(contract.id, userId);

      expect(result.status).toBe('PENDING_REVIEW');
      expect(mockRepository.update).toHaveBeenCalledWith(contract.id, {
        status: 'PENDING_REVIEW',
        updatedBy: userId,
      });
    });

    it('should throw ContractStatusError when not in DRAFT', async () => {
      const contract = createMockContractWithParties({ status: 'ACTIVE' });
      mockRepository.findById.mockResolvedValue(contract);

      await expect(service.submitForReview(contract.id, userId)).rejects.toThrow(ContractStatusError);
    });
  });

  describe('approveContract', () => {
    it('should transition from PENDING_APPROVAL to PENDING_SIGNATURE', async () => {
      const contract = createMockContractWithParties({ status: 'PENDING_APPROVAL' });
      const updatedContract = { ...contract, status: 'PENDING_SIGNATURE' as const };
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.update.mockResolvedValue(updatedContract);

      const result = await service.approveContract(contract.id, userId);

      expect(result.status).toBe('PENDING_SIGNATURE');
    });

    it('should throw ContractStatusError when not in PENDING_APPROVAL', async () => {
      const contract = createMockContractWithParties({ status: 'DRAFT' });
      mockRepository.findById.mockResolvedValue(contract);

      await expect(service.approveContract(contract.id, userId)).rejects.toThrow(ContractStatusError);
    });
  });

  describe('signContract', () => {
    it('should record signature for party', async () => {
      const partyId = 'party-1';
      const contract = createMockContractWithParties({ status: 'PENDING_SIGNATURE' });
      contract.parties[0].partyId = partyId;
      contract.parties[0].signedAt = null;

      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.signParty.mockResolvedValue({ ...contract.parties[0], signedAt: new Date() });

      // After signing one party, not all signed yet
      const partiallySignedContract = {
        ...contract,
        parties: [
          { ...contract.parties[0], signedAt: new Date() },
          { ...contract.parties[1], signedAt: null },
        ],
      };
      mockRepository.findById
        .mockResolvedValueOnce(contract)
        .mockResolvedValueOnce(partiallySignedContract);

      const result = await service.signContract(
        contract.id,
        { partyId, signedBy: 'John Doe' },
        userId
      );

      expect(mockRepository.signParty).toHaveBeenCalledWith(contract.id, partyId, 'John Doe', undefined);
    });

    it('should activate contract when all parties have signed', async () => {
      const contract = createMockContractWithParties({ status: 'PENDING_SIGNATURE' });
      const partyId = contract.parties[0].partyId;

      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.signParty.mockResolvedValue({ ...contract.parties[0], signedAt: new Date() });

      // After signing, all parties have signed
      const fullySignedContract: ContractWithParties = {
        ...contract,
        parties: contract.parties.map((p) => ({ ...p, signedAt: new Date() })),
      };
      mockRepository.findById
        .mockResolvedValueOnce(contract)
        .mockResolvedValueOnce(fullySignedContract);

      const activeContract = { ...fullySignedContract, status: 'ACTIVE' as const, signedDate: new Date() };
      mockRepository.update.mockResolvedValue(activeContract);

      const result = await service.signContract(
        contract.id,
        { partyId, signedBy: 'John Doe' },
        userId
      );

      expect(mockRepository.update).toHaveBeenCalledWith(contract.id, {
        status: 'ACTIVE',
        signedDate: expect.any(Date),
        updatedBy: userId,
      });
    });

    it('should throw NotFoundError when party not on contract', async () => {
      const contract = createMockContractWithParties({ status: 'PENDING_SIGNATURE' });
      mockRepository.findById.mockResolvedValue(contract);

      await expect(
        service.signContract(contract.id, { partyId: 'unknown-party', signedBy: 'John' }, userId)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when party already signed', async () => {
      const contract = createMockContractWithParties({ status: 'PENDING_SIGNATURE' });
      contract.parties[0].signedAt = new Date();
      const partyId = contract.parties[0].partyId;
      mockRepository.findById.mockResolvedValue(contract);

      await expect(
        service.signContract(contract.id, { partyId, signedBy: 'John' }, userId)
      ).rejects.toThrow(ConflictError);
    });

    it('should throw ContractStatusError when not in PENDING_SIGNATURE', async () => {
      const contract = createMockContractWithParties({ status: 'DRAFT' });
      mockRepository.findById.mockResolvedValue(contract);

      await expect(
        service.signContract(contract.id, { partyId: 'party-1', signedBy: 'John' }, userId)
      ).rejects.toThrow(ContractStatusError);
    });
  });

  describe('terminateContract', () => {
    it('should terminate ACTIVE contract', async () => {
      const contract = createMockContractWithParties({ status: 'ACTIVE' });
      const terminatedContract = { ...contract, status: 'TERMINATED' as const, terminatedDate: new Date() };
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.update.mockResolvedValue(terminatedContract);

      const result = await service.terminateContract(contract.id, userId);

      expect(result.status).toBe('TERMINATED');
      expect(mockRepository.update).toHaveBeenCalledWith(contract.id, {
        status: 'TERMINATED',
        terminatedDate: expect.any(Date),
        updatedBy: userId,
      });
    });

    it('should throw ContractStatusError when not ACTIVE', async () => {
      const contract = createMockContractWithParties({ status: 'DRAFT' });
      mockRepository.findById.mockResolvedValue(contract);

      await expect(service.terminateContract(contract.id, userId)).rejects.toThrow(ContractStatusError);
    });
  });

  describe('renewContract', () => {
    it('should renew ACTIVE contract with defined renewal terms', async () => {
      const contract = createMockContractWithParties({
        status: 'ACTIVE',
        renewalTermDays: 365,
        expiryDate: new Date(),
      });
      const renewedContract = { ...contract, status: 'ACTIVE' as const };
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.update.mockResolvedValue(renewedContract);

      const result = await service.renewContract(contract.id, userId);

      expect(mockRepository.update).toHaveBeenCalledWith(contract.id, {
        status: 'ACTIVE',
        expiryDate: expect.any(Date),
        updatedBy: userId,
      });
    });

    it('should renew EXPIRED contract', async () => {
      const contract = createMockContractWithParties({
        status: 'EXPIRED',
        renewalTermDays: 365,
        expiryDate: new Date(),
      });
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.update.mockResolvedValue({ ...contract, status: 'ACTIVE' as const });

      await expect(service.renewContract(contract.id, userId)).resolves.toBeDefined();
    });

    it('should throw BusinessRuleError when no renewal terms defined', async () => {
      const contract = createMockContractWithParties({
        status: 'ACTIVE',
        renewalTermDays: null,
      });
      mockRepository.findById.mockResolvedValue(contract);

      await expect(service.renewContract(contract.id, userId)).rejects.toThrow(BusinessRuleError);
    });

    it('should throw ContractStatusError when not ACTIVE or EXPIRED', async () => {
      const contract = createMockContractWithParties({ status: 'DRAFT' });
      mockRepository.findById.mockResolvedValue(contract);

      await expect(service.renewContract(contract.id, userId)).rejects.toThrow(ContractStatusError);
    });
  });

  describe('getExpiringContracts', () => {
    it('should return contracts expiring within specified days', async () => {
      const expiringContracts = [
        createMockContractWithParties({ status: 'ACTIVE' }),
        createMockContractWithParties({ status: 'ACTIVE' }),
      ];
      mockRepository.findExpiring.mockResolvedValue(expiringContracts);

      const result = await service.getExpiringContracts(30);

      expect(result).toEqual(expiringContracts);
      expect(mockRepository.findExpiring).toHaveBeenCalledWith(30);
    });

    it('should use default of 30 days when not specified', async () => {
      mockRepository.findExpiring.mockResolvedValue([]);

      await service.getExpiringContracts();

      expect(mockRepository.findExpiring).toHaveBeenCalledWith(30);
    });
  });
});
