/**
 * Contract Lifecycle Service - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContractLifecycleService } from '../../../../src/domain/contract-lifecycle/service.js';
import type { LifecycleRepository } from '../../../../src/domain/contract-lifecycle/repository.js';
import { NotFoundError, ContractStatusError, BusinessRuleError } from '../../../../src/lib/errors.js';
import { createMockContractWithParties } from '../../../helpers/mock-factory.js';

describe('ContractLifecycleService', () => {
  let service: ContractLifecycleService;
  let mockRepository: {
    findById: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    recordActivity: ReturnType<typeof vi.fn>;
    findExpiring: ReturnType<typeof vi.fn>;
    findForRenewal: ReturnType<typeof vi.fn>;
    findExpired: ReturnType<typeof vi.fn>;
    renewContract: ReturnType<typeof vi.fn>;
    getContractHealth: ReturnType<typeof vi.fn>;
    bulkUpdateExpired: ReturnType<typeof vi.fn>;
    getActivityHistory: ReturnType<typeof vi.fn>;
    getContractsByStatus: ReturnType<typeof vi.fn>;
    getStatusCounts: ReturnType<typeof vi.fn>;
  };
  const userId = 'user-123';

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      updateStatus: vi.fn(),
      recordActivity: vi.fn(),
      findExpiring: vi.fn(),
      findForRenewal: vi.fn(),
      findExpired: vi.fn(),
      renewContract: vi.fn(),
      getContractHealth: vi.fn(),
      bulkUpdateExpired: vi.fn(),
      getActivityHistory: vi.fn(),
      getContractsByStatus: vi.fn(),
      getStatusCounts: vi.fn(),
    };
    service = new ContractLifecycleService(mockRepository as unknown as LifecycleRepository);
  });

  describe('transition', () => {
    it('should transition DRAFT to PENDING_REVIEW via SUBMIT_FOR_REVIEW', async () => {
      const contract = {
        ...createMockContractWithParties({ status: 'DRAFT' }),
        obligations: [],
        activities: [],
      };
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.updateStatus.mockResolvedValue({ ...contract, status: 'PENDING_REVIEW' });
      mockRepository.recordActivity.mockResolvedValue({});

      const result = await service.transition(
        { contractId: contract.id, action: 'SUBMIT_FOR_REVIEW' },
        userId
      );

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe('DRAFT');
      expect(result.newStatus).toBe('PENDING_REVIEW');
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        contract.id,
        'PENDING_REVIEW',
        userId,
        {}
      );
    });

    it('should reject invalid transition', async () => {
      const contract = {
        ...createMockContractWithParties({ status: 'DRAFT' }),
        obligations: [],
        activities: [],
      };
      mockRepository.findById.mockResolvedValue(contract);

      await expect(
        service.transition({ contractId: contract.id, action: 'TERMINATE' }, userId)
      ).rejects.toThrow(ContractStatusError);
    });

    it('should add terminatedDate when terminating', async () => {
      const contract = {
        ...createMockContractWithParties({ status: 'ACTIVE' }),
        obligations: [],
        activities: [],
      };
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.updateStatus.mockResolvedValue({ ...contract, status: 'TERMINATED' });
      mockRepository.recordActivity.mockResolvedValue({});

      await service.transition({ contractId: contract.id, action: 'TERMINATE' }, userId);

      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        contract.id,
        'TERMINATED',
        userId,
        expect.objectContaining({ terminatedDate: expect.any(Date) })
      );
    });
  });

  describe('renew', () => {
    it('should renew ACTIVE contract with existing renewal terms', async () => {
      const contract = {
        ...createMockContractWithParties({
          status: 'ACTIVE',
          renewalTermDays: 365,
          expiryDate: new Date(),
        }),
        obligations: [],
        activities: [],
      };
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.renewContract.mockResolvedValue({ ...contract, status: 'ACTIVE' });
      mockRepository.recordActivity.mockResolvedValue({});

      const result = await service.renew({ contractId: contract.id }, userId);

      expect(mockRepository.renewContract).toHaveBeenCalledWith(
        contract.id,
        expect.any(Date),
        userId,
        {}
      );
    });

    it('should renew with custom expiry date', async () => {
      const contract = {
        ...createMockContractWithParties({ status: 'ACTIVE' }),
        obligations: [],
        activities: [],
      };
      const newExpiryDate = new Date('2026-12-31');
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.renewContract.mockResolvedValue(contract);
      mockRepository.recordActivity.mockResolvedValue({});

      await service.renew({ contractId: contract.id, newExpiryDate }, userId);

      expect(mockRepository.renewContract).toHaveBeenCalledWith(
        contract.id,
        newExpiryDate,
        userId,
        {}
      );
    });

    it('should reject renewal without terms or expiry date', async () => {
      const contract = {
        ...createMockContractWithParties({ status: 'ACTIVE', renewalTermDays: null }),
        obligations: [],
        activities: [],
      };
      mockRepository.findById.mockResolvedValue(contract);

      await expect(service.renew({ contractId: contract.id }, userId)).rejects.toThrow(
        BusinessRuleError
      );
    });

    it('should reject renewal from invalid status', async () => {
      const contract = {
        ...createMockContractWithParties({ status: 'DRAFT' }),
        obligations: [],
        activities: [],
      };
      mockRepository.findById.mockResolvedValue(contract);

      await expect(service.renew({ contractId: contract.id }, userId)).rejects.toThrow(
        ContractStatusError
      );
    });
  });

  describe('bulkRenew', () => {
    it('should renew multiple contracts', async () => {
      const contracts = [
        {
          ...createMockContractWithParties({ status: 'ACTIVE', renewalTermDays: 365 }),
          obligations: [],
          activities: [],
        },
        {
          ...createMockContractWithParties({ status: 'ACTIVE', renewalTermDays: 365 }),
          obligations: [],
          activities: [],
        },
      ];

      mockRepository.findById
        .mockResolvedValueOnce(contracts[0])
        .mockResolvedValueOnce(contracts[1]);
      mockRepository.renewContract.mockResolvedValue(contracts[0]);
      mockRepository.recordActivity.mockResolvedValue({});

      const result = await service.bulkRenew(
        { contractIds: [contracts[0].id, contracts[1].id] },
        userId
      );

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle failures with skipInvalid', async () => {
      const validContract = {
        ...createMockContractWithParties({ status: 'ACTIVE', renewalTermDays: 365 }),
        obligations: [],
        activities: [],
      };
      const invalidContract = {
        ...createMockContractWithParties({ status: 'DRAFT' }),
        obligations: [],
        activities: [],
      };

      mockRepository.findById
        .mockResolvedValueOnce(validContract)
        .mockResolvedValueOnce(invalidContract);
      mockRepository.renewContract.mockResolvedValue(validContract);
      mockRepository.recordActivity.mockResolvedValue({});

      const result = await service.bulkRenew(
        {
          contractIds: [validContract.id, invalidContract.id],
          skipInvalid: true,
        },
        userId
      );

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
    });
  });

  describe('getContractHealth', () => {
    it('should return health status', async () => {
      const health = {
        contractId: 'test-id',
        status: 'ACTIVE',
        daysUntilExpiry: 30,
        hasOverdueObligations: false,
        overdueObligationCount: 0,
        renewalEligible: true,
        autoRenewalEnabled: false,
        renewalNoticeDays: 30,
        renewalWindowOpen: true,
        healthScore: 'ATTENTION' as const,
      };
      mockRepository.getContractHealth.mockResolvedValue(health);

      const result = await service.getContractHealth('test-id');

      expect(result).toEqual(health);
    });

    it('should throw NotFoundError for non-existent contract', async () => {
      mockRepository.getContractHealth.mockResolvedValue(null);

      await expect(service.getContractHealth('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getAllowedActions', () => {
    it('should return allowed actions for DRAFT', async () => {
      const contract = {
        ...createMockContractWithParties({ status: 'DRAFT' }),
        obligations: [],
        activities: [],
      };
      mockRepository.findById.mockResolvedValue(contract);

      const actions = await service.getAllowedActions(contract.id);

      expect(actions).toContain('SUBMIT_FOR_REVIEW');
      expect(actions).toContain('ARCHIVE');
      expect(actions).not.toContain('TERMINATE');
    });

    it('should return allowed actions for ACTIVE', async () => {
      const contract = {
        ...createMockContractWithParties({ status: 'ACTIVE' }),
        obligations: [],
        activities: [],
      };
      mockRepository.findById.mockResolvedValue(contract);

      const actions = await service.getAllowedActions(contract.id);

      expect(actions).toContain('SUSPEND');
      expect(actions).toContain('TERMINATE');
      expect(actions).toContain('RENEW');
    });
  });

  describe('processExpiredContracts', () => {
    it('should mark expired contracts', async () => {
      mockRepository.bulkUpdateExpired.mockResolvedValue(5);

      const count = await service.processExpiredContracts(userId);

      expect(count).toBe(5);
      expect(mockRepository.bulkUpdateExpired).toHaveBeenCalledWith(userId);
    });
  });

  describe('getStatusSummary', () => {
    it('should return status counts', async () => {
      const counts = {
        DRAFT: 10,
        ACTIVE: 50,
        EXPIRED: 5,
      };
      mockRepository.getStatusCounts.mockResolvedValue(counts);

      const result = await service.getStatusSummary();

      expect(result).toEqual(counts);
    });
  });
});
