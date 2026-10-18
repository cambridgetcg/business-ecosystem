/**
 * Policy Domain Model Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isPolicyActive,
  canEditPolicy,
  canBindPolicy,
  canCancelPolicy,
  canRenewPolicy,
  isExpiringSoon,
  getDaysUntilExpiry,
  isWithinPolicyPeriod,
  getCoverage,
  getTotalInsuredValue,
  getPolicyStatusLabel,
  calculateIPT,
  meetsEmployersLiabilityMinimum,
  type Policy,
} from '../../../src/domain/policy/models/policy.js';

// Helper to create a test policy
function createTestPolicy(overrides: Partial<Policy> = {}): Policy {
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  return {
    id: 'test-policy-id',
    tenantId: 'test-tenant-id',
    entityId: 'test-entity-id',
    policyNumber: 'POL-2024-001',
    externalPolicyNumber: null,
    policyType: 'professional_indemnity',
    status: 'active',
    policyName: 'Test Policy',
    description: null,
    inceptionDate: oneYearAgo,
    expiryDate: oneYearFromNow,
    retroactiveDate: null,
    brokerId: null,
    brokerReference: null,
    insurers: [{
      id: 'insurer-1',
      name: 'Test Insurer',
      insurerType: 'primary',
      sharePercentage: 100,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      underwriterName: null,
      underwriterEmail: null,
      externalReference: null,
      metadata: null,
    }],
    coverages: [{
      name: 'Professional Indemnity',
      description: null,
      limitType: 'any_one_event',
      limit: { amount: 1000000, currency: 'GBP' },
      deductible: { amount: 5000, currency: 'GBP' },
      coinsurancePercentage: null,
      sublimits: null,
      exclusions: null,
      conditions: null,
    }],
    totalLimit: { amount: 1000000, currency: 'GBP' },
    totalDeductible: { amount: 5000, currency: 'GBP' },
    premium: null,
    riskAssessment: null,
    renewalOfPolicyId: null,
    renewedByPolicyId: null,
    autoRenewal: false,
    renewalReminderDays: 60,
    documents: null,
    territorialLimits: ['GB'],
    jurisdictionOfCourts: 'England and Wales',
    endorsements: null,
    metadata: null,
    tags: null,
    createdAt: oneYearAgo,
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    version: 1,
    deletedAt: null,
    ...overrides,
  };
}

describe('Policy Domain Model', () => {
  describe('isPolicyActive', () => {
    it('returns true for active policy within period', () => {
      const policy = createTestPolicy({ status: 'active' });
      expect(isPolicyActive(policy)).toBe(true);
    });

    it('returns false for draft policy', () => {
      const policy = createTestPolicy({ status: 'draft' });
      expect(isPolicyActive(policy)).toBe(false);
    });

    it('returns false for expired policy', () => {
      const policy = createTestPolicy({ status: 'expired' });
      expect(isPolicyActive(policy)).toBe(false);
    });

    it('returns false for cancelled policy', () => {
      const policy = createTestPolicy({ status: 'cancelled' });
      expect(isPolicyActive(policy)).toBe(false);
    });

    it('returns false for deleted policy', () => {
      const policy = createTestPolicy({
        status: 'active',
        deletedAt: new Date(),
      });
      expect(isPolicyActive(policy)).toBe(false);
    });

    it('returns false when expiry date has passed', () => {
      const policy = createTestPolicy({
        status: 'active',
        expiryDate: new Date(Date.now() - 1000),
      });
      expect(isPolicyActive(policy)).toBe(false);
    });

    it('returns false when inception date is in future', () => {
      const policy = createTestPolicy({
        status: 'active',
        inceptionDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      expect(isPolicyActive(policy)).toBe(false);
    });
  });

  describe('canEditPolicy', () => {
    it('returns true for draft policy', () => {
      const policy = createTestPolicy({ status: 'draft' });
      expect(canEditPolicy(policy)).toBe(true);
    });

    it('returns true for quoted policy', () => {
      const policy = createTestPolicy({ status: 'quoted' });
      expect(canEditPolicy(policy)).toBe(true);
    });

    it('returns false for active policy', () => {
      const policy = createTestPolicy({ status: 'active' });
      expect(canEditPolicy(policy)).toBe(false);
    });

    it('returns false for bound policy', () => {
      const policy = createTestPolicy({ status: 'bound' });
      expect(canEditPolicy(policy)).toBe(false);
    });
  });

  describe('canBindPolicy', () => {
    it('returns true for quoted policy', () => {
      const policy = createTestPolicy({ status: 'quoted' });
      expect(canBindPolicy(policy)).toBe(true);
    });

    it('returns false for draft policy', () => {
      const policy = createTestPolicy({ status: 'draft' });
      expect(canBindPolicy(policy)).toBe(false);
    });
  });

  describe('canCancelPolicy', () => {
    it('returns true for active policy', () => {
      const policy = createTestPolicy({ status: 'active' });
      expect(canCancelPolicy(policy)).toBe(true);
    });

    it('returns true for bound policy', () => {
      const policy = createTestPolicy({ status: 'bound' });
      expect(canCancelPolicy(policy)).toBe(true);
    });

    it('returns false for draft policy', () => {
      const policy = createTestPolicy({ status: 'draft' });
      expect(canCancelPolicy(policy)).toBe(false);
    });

    it('returns false for cancelled policy', () => {
      const policy = createTestPolicy({ status: 'cancelled' });
      expect(canCancelPolicy(policy)).toBe(false);
    });
  });

  describe('canRenewPolicy', () => {
    it('returns true for active policy not yet renewed', () => {
      const policy = createTestPolicy({ status: 'active' });
      expect(canRenewPolicy(policy)).toBe(true);
    });

    it('returns true for expired policy not yet renewed', () => {
      const policy = createTestPolicy({ status: 'expired' });
      expect(canRenewPolicy(policy)).toBe(true);
    });

    it('returns true for pending_renewal policy', () => {
      const policy = createTestPolicy({ status: 'pending_renewal' });
      expect(canRenewPolicy(policy)).toBe(true);
    });

    it('returns false for already renewed policy', () => {
      const policy = createTestPolicy({
        status: 'active',
        renewedByPolicyId: 'new-policy-id',
      });
      expect(canRenewPolicy(policy)).toBe(false);
    });

    it('returns false for draft policy', () => {
      const policy = createTestPolicy({ status: 'draft' });
      expect(canRenewPolicy(policy)).toBe(false);
    });
  });

  describe('isExpiringSoon', () => {
    it('returns true when expiry is within threshold', () => {
      const policy = createTestPolicy({
        status: 'active',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      expect(isExpiringSoon(policy, 60)).toBe(true);
    });

    it('returns false when expiry is beyond threshold', () => {
      const policy = createTestPolicy({
        status: 'active',
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
      expect(isExpiringSoon(policy, 60)).toBe(false);
    });

    it('returns false for inactive policy', () => {
      const policy = createTestPolicy({
        status: 'expired',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      expect(isExpiringSoon(policy, 60)).toBe(false);
    });

    it('returns false when already expired', () => {
      const policy = createTestPolicy({
        status: 'active',
        expiryDate: new Date(Date.now() - 1000),
      });
      expect(isExpiringSoon(policy, 60)).toBe(false);
    });
  });

  describe('getDaysUntilExpiry', () => {
    it('returns positive number for future expiry', () => {
      const policy = createTestPolicy({
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      const days = getDaysUntilExpiry(policy);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(31);
    });

    it('returns negative number for past expiry', () => {
      const policy = createTestPolicy({
        expiryDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });
      const days = getDaysUntilExpiry(policy);
      expect(days).toBeLessThanOrEqual(-29);
      expect(days).toBeGreaterThanOrEqual(-31);
    });
  });

  describe('isWithinPolicyPeriod', () => {
    it('returns true for claim within policy period', () => {
      const policy = createTestPolicy();
      const claimDate = new Date();
      expect(isWithinPolicyPeriod(policy, claimDate)).toBe(true);
    });

    it('returns false for claim before inception', () => {
      const policy = createTestPolicy({
        inceptionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });
      const claimDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      expect(isWithinPolicyPeriod(policy, claimDate)).toBe(false);
    });

    it('returns false for claim after expiry', () => {
      const policy = createTestPolicy({
        expiryDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });
      const claimDate = new Date();
      expect(isWithinPolicyPeriod(policy, claimDate)).toBe(false);
    });

    it('uses discovery date if provided', () => {
      const policy = createTestPolicy();
      const incidentDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      const discoveryDate = new Date();
      expect(isWithinPolicyPeriod(policy, incidentDate, discoveryDate)).toBe(true);
    });
  });

  describe('getCoverage', () => {
    it('returns coverage by name', () => {
      const policy = createTestPolicy();
      const coverage = getCoverage(policy, 'Professional Indemnity');
      expect(coverage).not.toBeNull();
      expect(coverage?.limit.amount).toBe(1000000);
    });

    it('returns null for non-existent coverage', () => {
      const policy = createTestPolicy();
      const coverage = getCoverage(policy, 'Cyber');
      expect(coverage).toBeNull();
    });
  });

  describe('getTotalInsuredValue', () => {
    it('calculates sum of all coverage limits', () => {
      const policy = createTestPolicy({
        coverages: [
          {
            name: 'PI',
            description: null,
            limitType: 'any_one_event',
            limit: { amount: 1000000, currency: 'GBP' },
            deductible: null,
            coinsurancePercentage: null,
            sublimits: null,
            exclusions: null,
            conditions: null,
          },
          {
            name: 'Cyber',
            description: null,
            limitType: 'aggregate',
            limit: { amount: 500000, currency: 'GBP' },
            deductible: null,
            coinsurancePercentage: null,
            sublimits: null,
            exclusions: null,
            conditions: null,
          },
        ],
      });
      expect(getTotalInsuredValue(policy)).toBe(1500000);
    });
  });

  describe('getPolicyStatusLabel', () => {
    it('returns correct labels for all statuses', () => {
      expect(getPolicyStatusLabel('draft')).toBe('Draft');
      expect(getPolicyStatusLabel('quoted')).toBe('Quoted');
      expect(getPolicyStatusLabel('bound')).toBe('Bound');
      expect(getPolicyStatusLabel('active')).toBe('Active');
      expect(getPolicyStatusLabel('expired')).toBe('Expired');
      expect(getPolicyStatusLabel('cancelled')).toBe('Cancelled');
      expect(getPolicyStatusLabel('lapsed')).toBe('Lapsed');
      expect(getPolicyStatusLabel('renewed')).toBe('Renewed');
      expect(getPolicyStatusLabel('pending_renewal')).toBe('Pending Renewal');
    });
  });

  describe('calculateIPT', () => {
    it('calculates standard IPT at 12%', () => {
      expect(calculateIPT(1000, false)).toBe(120);
    });

    it('calculates higher rate IPT at 20%', () => {
      expect(calculateIPT(1000, true)).toBe(200);
    });

    it('rounds to 2 decimal places', () => {
      expect(calculateIPT(333, false)).toBe(39.96);
    });
  });

  describe('meetsEmployersLiabilityMinimum', () => {
    it('returns true for non-employers liability policies', () => {
      const policy = createTestPolicy({ policyType: 'professional_indemnity' });
      expect(meetsEmployersLiabilityMinimum(policy)).toBe(true);
    });

    it('returns true when limit meets minimum', () => {
      const policy = createTestPolicy({
        policyType: 'employers_liability',
        coverages: [{
          name: 'Employers Liability',
          description: null,
          limitType: 'any_one_event',
          limit: { amount: 5000000, currency: 'GBP' },
          deductible: null,
          coinsurancePercentage: null,
          sublimits: null,
          exclusions: null,
          conditions: null,
        }],
      });
      expect(meetsEmployersLiabilityMinimum(policy)).toBe(true);
    });

    it('returns true when limit exceeds minimum', () => {
      const policy = createTestPolicy({
        policyType: 'employers_liability',
        coverages: [{
          name: 'Employers Liability',
          description: null,
          limitType: 'any_one_event',
          limit: { amount: 10000000, currency: 'GBP' },
          deductible: null,
          coinsurancePercentage: null,
          sublimits: null,
          exclusions: null,
          conditions: null,
        }],
      });
      expect(meetsEmployersLiabilityMinimum(policy)).toBe(true);
    });

    it('returns false when limit is below minimum', () => {
      const policy = createTestPolicy({
        policyType: 'employers_liability',
        coverages: [{
          name: 'Employers Liability',
          description: null,
          limitType: 'any_one_event',
          limit: { amount: 2000000, currency: 'GBP' },
          deductible: null,
          coinsurancePercentage: null,
          sublimits: null,
          exclusions: null,
          conditions: null,
        }],
      });
      expect(meetsEmployersLiabilityMinimum(policy)).toBe(false);
    });

    it('returns false for non-GBP currency', () => {
      const policy = createTestPolicy({
        policyType: 'employers_liability',
        coverages: [{
          name: 'Employers Liability',
          description: null,
          limitType: 'any_one_event',
          limit: { amount: 5000000, currency: 'USD' },
          deductible: null,
          coinsurancePercentage: null,
          sublimits: null,
          exclusions: null,
          conditions: null,
        }],
      });
      expect(meetsEmployersLiabilityMinimum(policy)).toBe(false);
    });

    it('returns false when no coverage found', () => {
      const policy = createTestPolicy({
        policyType: 'employers_liability',
        coverages: [{
          name: 'Employers Liability',
          description: null,
          limitType: 'aggregate',
          limit: { amount: 5000000, currency: 'GBP' },
          deductible: null,
          coinsurancePercentage: null,
          sublimits: null,
          exclusions: null,
          conditions: null,
        }],
      });
      expect(meetsEmployersLiabilityMinimum(policy)).toBe(false);
    });
  });
});
