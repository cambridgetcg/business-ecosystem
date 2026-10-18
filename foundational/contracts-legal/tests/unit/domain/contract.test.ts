/**
 * Contract Domain Model Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ContractSchema,
  CreateContractInputSchema,
  UpdateContractInputSchema,
  canEditContract,
  canSendForSignatures,
  isFullyExecuted,
  canActivateContract,
  canTerminateContract,
  canRenewContract,
  isExpiringSoon,
  getContractStatusLabel,
  getDaysUntilExpiration,
  type Contract,
  type ContractParty,
} from '../../../src/domain/contract/models/contract.js';

describe('Contract Domain Model', () => {
  // ==========================================================================
  // Test Fixtures
  // ==========================================================================

  const createTestContract = (overrides: Partial<Contract> = {}): Contract => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    tenantId: '123e4567-e89b-12d3-a456-426614174001',
    contractNumber: 'CTR-ABC12345',
    title: 'Service Agreement',
    description: 'Test contract description',
    contractType: 'service_agreement',
    status: 'draft',
    ownerEntityId: '123e4567-e89b-12d3-a456-426614174002',
    templateId: null,
    templateVersion: null,
    effectiveDate: new Date('2024-01-01'),
    expirationDate: new Date('2025-01-01'),
    executedDate: null,
    terminatedDate: null,
    totalValue: { amount: 100000, currency: 'USD' },
    paymentTerms: 'Net 30',
    renewalTerms: { type: 'auto', periodMonths: 12, noticeDays: 30 },
    renewalCount: 0,
    documentStorageKey: null,
    documentVersion: 1,
    externalContractId: null,
    metadata: null,
    tags: ['important'],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    version: 1,
    deletedAt: null,
    ...overrides,
  });

  const createTestParty = (overrides: Partial<ContractParty> = {}): ContractParty => ({
    id: '123e4567-e89b-12d3-a456-426614174010',
    contractId: '123e4567-e89b-12d3-a456-426614174000',
    partyType: 'entity',
    partyRole: 'owner',
    entityId: '123e4567-e89b-12d3-a456-426614174002',
    personId: null,
    externalName: null,
    externalEmail: null,
    signatureRequired: true,
    signedAt: null,
    signedBy: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  // ==========================================================================
  // Schema Validation Tests
  // ==========================================================================

  describe('ContractSchema', () => {
    it('should validate a complete contract', () => {
      const contract = createTestContract();
      const result = ContractSchema.safeParse(contract);
      expect(result.success).toBe(true);
    });

    it('should require valid UUIDs', () => {
      const contract = createTestContract({ id: 'invalid' });
      const result = ContractSchema.safeParse(contract);
      expect(result.success).toBe(false);
    });

    it('should accept all valid contract types', () => {
      const types = [
        'service_agreement', 'employment', 'nda', 'msa', 'sow',
        'lease', 'vendor', 'partnership', 'licensing', 'subscription',
        'loan', 'consulting', 'other'
      ];
      for (const contractType of types) {
        const contract = createTestContract({ contractType: contractType as Contract['contractType'] });
        const result = ContractSchema.safeParse(contract);
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid statuses', () => {
      const statuses = [
        'draft', 'pending_review', 'pending_signatures', 'active',
        'expired', 'terminated', 'renewed', 'suspended'
      ];
      for (const status of statuses) {
        const contract = createTestContract({ status: status as Contract['status'] });
        const result = ContractSchema.safeParse(contract);
        expect(result.success).toBe(true);
      }
    });

    it('should accept null for optional fields', () => {
      const contract = createTestContract({
        description: null,
        templateId: null,
        effectiveDate: null,
        expirationDate: null,
        totalValue: null,
        paymentTerms: null,
        renewalTerms: null,
        metadata: null,
        tags: null,
      });
      const result = ContractSchema.safeParse(contract);
      expect(result.success).toBe(true);
    });
  });

  describe('CreateContractInputSchema', () => {
    it('should validate valid creation input', () => {
      const input = {
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'New Contract',
        contractType: 'nda',
        ownerEntityId: '123e4567-e89b-12d3-a456-426614174002',
      };
      const result = CreateContractInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require title to be non-empty', () => {
      const input = {
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        title: '',
        contractType: 'nda',
        ownerEntityId: '123e4567-e89b-12d3-a456-426614174002',
      };
      const result = CreateContractInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateContractInputSchema', () => {
    it('should allow partial updates', () => {
      const input = { title: 'Updated Title' };
      const result = UpdateContractInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty update', () => {
      const result = UpdateContractInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // Domain Logic Tests
  // ==========================================================================

  describe('canEditContract', () => {
    it('should return true for draft contracts', () => {
      const contract = createTestContract({ status: 'draft' });
      expect(canEditContract(contract)).toBe(true);
    });

    it('should return true for pending_review contracts', () => {
      const contract = createTestContract({ status: 'pending_review' });
      expect(canEditContract(contract)).toBe(true);
    });

    it('should return false for active contracts', () => {
      const contract = createTestContract({ status: 'active' });
      expect(canEditContract(contract)).toBe(false);
    });

    it('should return false for pending_signatures contracts', () => {
      const contract = createTestContract({ status: 'pending_signatures' });
      expect(canEditContract(contract)).toBe(false);
    });
  });

  describe('canSendForSignatures', () => {
    it('should return true for draft contracts', () => {
      const contract = createTestContract({ status: 'draft' });
      expect(canSendForSignatures(contract)).toBe(true);
    });

    it('should return true for pending_review contracts', () => {
      const contract = createTestContract({ status: 'pending_review' });
      expect(canSendForSignatures(contract)).toBe(true);
    });

    it('should return false for active contracts', () => {
      const contract = createTestContract({ status: 'active' });
      expect(canSendForSignatures(contract)).toBe(false);
    });
  });

  describe('isFullyExecuted', () => {
    it('should return true when all required signatures are collected', () => {
      const contract = createTestContract();
      const parties = [
        createTestParty({ signatureRequired: true, signedAt: new Date() }),
        createTestParty({ id: '123e4567-e89b-12d3-a456-426614174011', signatureRequired: true, signedAt: new Date() }),
      ];
      expect(isFullyExecuted(contract, parties)).toBe(true);
    });

    it('should return false when signatures are missing', () => {
      const contract = createTestContract();
      const parties = [
        createTestParty({ signatureRequired: true, signedAt: new Date() }),
        createTestParty({ id: '123e4567-e89b-12d3-a456-426614174011', signatureRequired: true, signedAt: null }),
      ];
      expect(isFullyExecuted(contract, parties)).toBe(false);
    });

    it('should return false when no parties exist', () => {
      const contract = createTestContract();
      expect(isFullyExecuted(contract, [])).toBe(false);
    });

    it('should ignore parties that dont require signatures', () => {
      const contract = createTestContract();
      const parties = [
        createTestParty({ signatureRequired: true, signedAt: new Date() }),
        createTestParty({ id: '123e4567-e89b-12d3-a456-426614174011', signatureRequired: false, signedAt: null }),
      ];
      expect(isFullyExecuted(contract, parties)).toBe(true);
    });
  });

  describe('canActivateContract', () => {
    it('should return true when pending_signatures and fully executed', () => {
      const contract = createTestContract({ status: 'pending_signatures' });
      const parties = [createTestParty({ signatureRequired: true, signedAt: new Date() })];
      expect(canActivateContract(contract, parties)).toBe(true);
    });

    it('should return false when not pending_signatures', () => {
      const contract = createTestContract({ status: 'draft' });
      const parties = [createTestParty({ signatureRequired: true, signedAt: new Date() })];
      expect(canActivateContract(contract, parties)).toBe(false);
    });

    it('should return false when not fully executed', () => {
      const contract = createTestContract({ status: 'pending_signatures' });
      const parties = [createTestParty({ signatureRequired: true, signedAt: null })];
      expect(canActivateContract(contract, parties)).toBe(false);
    });
  });

  describe('canTerminateContract', () => {
    it('should return true for active contracts', () => {
      const contract = createTestContract({ status: 'active' });
      expect(canTerminateContract(contract)).toBe(true);
    });

    it('should return true for suspended contracts', () => {
      const contract = createTestContract({ status: 'suspended' });
      expect(canTerminateContract(contract)).toBe(true);
    });

    it('should return false for draft contracts', () => {
      const contract = createTestContract({ status: 'draft' });
      expect(canTerminateContract(contract)).toBe(false);
    });

    it('should return false for already terminated contracts', () => {
      const contract = createTestContract({ status: 'terminated' });
      expect(canTerminateContract(contract)).toBe(false);
    });
  });

  describe('canRenewContract', () => {
    it('should return true for active contracts with auto renewal', () => {
      const contract = createTestContract({
        status: 'active',
        renewalTerms: { type: 'auto', periodMonths: 12 },
        renewalCount: 0,
      });
      expect(canRenewContract(contract)).toBe(true);
    });

    it('should return true for expired contracts with manual renewal', () => {
      const contract = createTestContract({
        status: 'expired',
        renewalTerms: { type: 'manual', periodMonths: 12 },
        renewalCount: 0,
      });
      expect(canRenewContract(contract)).toBe(true);
    });

    it('should return false for contracts with no renewal', () => {
      const contract = createTestContract({
        status: 'active',
        renewalTerms: { type: 'none' },
      });
      expect(canRenewContract(contract)).toBe(false);
    });

    it('should return false when max renewals reached', () => {
      const contract = createTestContract({
        status: 'active',
        renewalTerms: { type: 'auto', periodMonths: 12, maxRenewals: 2 },
        renewalCount: 2,
      });
      expect(canRenewContract(contract)).toBe(false);
    });

    it('should return false for draft contracts', () => {
      const contract = createTestContract({
        status: 'draft',
        renewalTerms: { type: 'auto', periodMonths: 12 },
      });
      expect(canRenewContract(contract)).toBe(false);
    });
  });

  describe('isExpiringSoon', () => {
    it('should return true when expiring within threshold', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      const contract = createTestContract({
        status: 'active',
        expirationDate: futureDate,
      });
      expect(isExpiringSoon(contract, 30)).toBe(true);
    });

    it('should return false when not expiring within threshold', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      const contract = createTestContract({
        status: 'active',
        expirationDate: futureDate,
      });
      expect(isExpiringSoon(contract, 30)).toBe(false);
    });

    it('should return false for inactive contracts', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      const contract = createTestContract({
        status: 'draft',
        expirationDate: futureDate,
      });
      expect(isExpiringSoon(contract, 30)).toBe(false);
    });

    it('should return false when no expiration date', () => {
      const contract = createTestContract({
        status: 'active',
        expirationDate: null,
      });
      expect(isExpiringSoon(contract, 30)).toBe(false);
    });
  });

  describe('getContractStatusLabel', () => {
    it('should return correct labels', () => {
      expect(getContractStatusLabel('draft')).toBe('Draft');
      expect(getContractStatusLabel('pending_review')).toBe('Pending Review');
      expect(getContractStatusLabel('pending_signatures')).toBe('Pending Signatures');
      expect(getContractStatusLabel('active')).toBe('Active');
      expect(getContractStatusLabel('expired')).toBe('Expired');
      expect(getContractStatusLabel('terminated')).toBe('Terminated');
      expect(getContractStatusLabel('renewed')).toBe('Renewed');
      expect(getContractStatusLabel('suspended')).toBe('Suspended');
    });
  });

  describe('getDaysUntilExpiration', () => {
    it('should return positive days for future expiration', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const contract = createTestContract({ expirationDate: futureDate });
      const days = getDaysUntilExpiration(contract);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(30);
    });

    it('should return negative days for past expiration', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const contract = createTestContract({ expirationDate: pastDate });
      const days = getDaysUntilExpiration(contract);
      expect(days).toBeLessThan(0);
    });

    it('should return null when no expiration date', () => {
      const contract = createTestContract({ expirationDate: null });
      expect(getDaysUntilExpiration(contract)).toBeNull();
    });
  });
});
