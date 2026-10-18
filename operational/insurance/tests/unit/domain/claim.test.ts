/**
 * Claim Domain Model Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isClaimOpen,
  canEditClaim,
  canCloseClaim,
  canReopenClaim,
  canApproveClaim,
  canDenyClaim,
  canSettleClaim,
  calculateTotalIncurred,
  calculateNetPaid,
  getClaimAge,
  isOverdueForReview,
  getClaimStatusLabel,
  getDaysSinceIncident,
  validateClaimPeriod,
  type Claim,
} from '../../../src/domain/claims/models/claim.js';

// Helper to create a test claim
function createTestClaim(overrides: Partial<Claim> = {}): Claim {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    id: 'test-claim-id',
    tenantId: 'test-tenant-id',
    entityId: 'test-entity-id',
    policyId: 'test-policy-id',
    claimNumber: 'CLM-2024-001',
    externalClaimNumber: null,
    claimType: 'professional_negligence',
    status: 'submitted',
    priority: 'medium',
    title: 'Test Claim',
    description: 'Test claim description',
    incidentDate: thirtyDaysAgo,
    discoveryDate: thirtyDaysAgo,
    notificationDate: now,
    location: null,
    claimants: [],
    adjusterId: null,
    adjusterName: null,
    solicitorId: null,
    solicitorName: null,
    claimedAmount: { amount: 50000, currency: 'GBP' },
    reserve: {
      indemnityReserve: { amount: 40000, currency: 'GBP' },
      expenseReserve: { amount: 10000, currency: 'GBP' },
      totalReserve: { amount: 50000, currency: 'GBP' },
      reserveHistory: null,
      lastReviewDate: null,
      nextReviewDate: null,
    },
    payments: [],
    totalPaid: { amount: 0, currency: 'GBP' },
    deductibleApplied: null,
    recoveries: null,
    settlementAmount: null,
    settlementDate: null,
    settlementNotes: null,
    denialDate: null,
    denialReason: null,
    coverageName: null,
    coverageConfirmed: false,
    coverageNotes: null,
    isLitigation: false,
    litigationStatus: null,
    courtReference: null,
    trialDate: null,
    subrogationPotential: false,
    subrogationStatus: null,
    subrogationTarget: null,
    documents: null,
    activities: null,
    handlerId: null,
    handlerName: null,
    teamId: null,
    closedDate: null,
    reopenedDate: null,
    lastActivityDate: now,
    metadata: null,
    tags: null,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
    version: 1,
    deletedAt: null,
    ...overrides,
  };
}

describe('Claim Domain Model', () => {
  describe('isClaimOpen', () => {
    it('returns true for submitted claim', () => {
      const claim = createTestClaim({ status: 'submitted' });
      expect(isClaimOpen(claim)).toBe(true);
    });

    it('returns true for under_review claim', () => {
      const claim = createTestClaim({ status: 'under_review' });
      expect(isClaimOpen(claim)).toBe(true);
    });

    it('returns true for investigation claim', () => {
      const claim = createTestClaim({ status: 'investigation' });
      expect(isClaimOpen(claim)).toBe(true);
    });

    it('returns true for approved claim', () => {
      const claim = createTestClaim({ status: 'approved' });
      expect(isClaimOpen(claim)).toBe(true);
    });

    it('returns false for closed claim', () => {
      const claim = createTestClaim({ status: 'closed' });
      expect(isClaimOpen(claim)).toBe(false);
    });

    it('returns false for settled claim', () => {
      const claim = createTestClaim({ status: 'settled' });
      expect(isClaimOpen(claim)).toBe(false);
    });

    it('returns false for denied claim', () => {
      const claim = createTestClaim({ status: 'denied' });
      expect(isClaimOpen(claim)).toBe(false);
    });

    it('returns false for withdrawn claim', () => {
      const claim = createTestClaim({ status: 'withdrawn' });
      expect(isClaimOpen(claim)).toBe(false);
    });
  });

  describe('canEditClaim', () => {
    it('returns true for open claim', () => {
      const claim = createTestClaim({ status: 'submitted' });
      expect(canEditClaim(claim)).toBe(true);
    });

    it('returns false for closed claim', () => {
      const claim = createTestClaim({ status: 'closed' });
      expect(canEditClaim(claim)).toBe(false);
    });
  });

  describe('canCloseClaim', () => {
    it('returns true for submitted claim', () => {
      const claim = createTestClaim({ status: 'submitted' });
      expect(canCloseClaim(claim)).toBe(true);
    });

    it('returns true for approved claim', () => {
      const claim = createTestClaim({ status: 'approved' });
      expect(canCloseClaim(claim)).toBe(true);
    });

    it('returns false for closed claim', () => {
      const claim = createTestClaim({ status: 'closed' });
      expect(canCloseClaim(claim)).toBe(false);
    });

    it('returns false for draft claim', () => {
      const claim = createTestClaim({ status: 'draft' });
      expect(canCloseClaim(claim)).toBe(false);
    });
  });

  describe('canReopenClaim', () => {
    it('returns true for closed claim', () => {
      const claim = createTestClaim({ status: 'closed' });
      expect(canReopenClaim(claim)).toBe(true);
    });

    it('returns true for denied claim', () => {
      const claim = createTestClaim({ status: 'denied' });
      expect(canReopenClaim(claim)).toBe(true);
    });

    it('returns false for submitted claim', () => {
      const claim = createTestClaim({ status: 'submitted' });
      expect(canReopenClaim(claim)).toBe(false);
    });

    it('returns false for approved claim', () => {
      const claim = createTestClaim({ status: 'approved' });
      expect(canReopenClaim(claim)).toBe(false);
    });
  });

  describe('canApproveClaim', () => {
    it('returns true for under_review claim', () => {
      const claim = createTestClaim({ status: 'under_review' });
      expect(canApproveClaim(claim)).toBe(true);
    });

    it('returns true for investigation claim', () => {
      const claim = createTestClaim({ status: 'investigation' });
      expect(canApproveClaim(claim)).toBe(true);
    });

    it('returns false for submitted claim', () => {
      const claim = createTestClaim({ status: 'submitted' });
      expect(canApproveClaim(claim)).toBe(false);
    });

    it('returns false for already approved claim', () => {
      const claim = createTestClaim({ status: 'approved' });
      expect(canApproveClaim(claim)).toBe(false);
    });
  });

  describe('canDenyClaim', () => {
    it('returns true for under_review claim', () => {
      const claim = createTestClaim({ status: 'under_review' });
      expect(canDenyClaim(claim)).toBe(true);
    });

    it('returns true for investigation claim', () => {
      const claim = createTestClaim({ status: 'investigation' });
      expect(canDenyClaim(claim)).toBe(true);
    });

    it('returns false for submitted claim', () => {
      const claim = createTestClaim({ status: 'submitted' });
      expect(canDenyClaim(claim)).toBe(false);
    });
  });

  describe('canSettleClaim', () => {
    it('returns true for approved claim', () => {
      const claim = createTestClaim({ status: 'approved' });
      expect(canSettleClaim(claim)).toBe(true);
    });

    it('returns true for partially_approved claim', () => {
      const claim = createTestClaim({ status: 'partially_approved' });
      expect(canSettleClaim(claim)).toBe(true);
    });

    it('returns true for investigation claim', () => {
      const claim = createTestClaim({ status: 'investigation' });
      expect(canSettleClaim(claim)).toBe(true);
    });

    it('returns false for submitted claim', () => {
      const claim = createTestClaim({ status: 'submitted' });
      expect(canSettleClaim(claim)).toBe(false);
    });
  });

  describe('calculateTotalIncurred', () => {
    it('calculates reserve plus paid', () => {
      const claim = createTestClaim({
        reserve: {
          indemnityReserve: { amount: 40000, currency: 'GBP' },
          expenseReserve: { amount: 10000, currency: 'GBP' },
          totalReserve: { amount: 50000, currency: 'GBP' },
          reserveHistory: null,
          lastReviewDate: null,
          nextReviewDate: null,
        },
        totalPaid: { amount: 20000, currency: 'GBP' },
      });
      expect(calculateTotalIncurred(claim)).toBe(70000);
    });

    it('handles null reserve', () => {
      const claim = createTestClaim({
        reserve: null,
        totalPaid: { amount: 20000, currency: 'GBP' },
      });
      expect(calculateTotalIncurred(claim)).toBe(20000);
    });
  });

  describe('calculateNetPaid', () => {
    it('calculates paid minus recoveries', () => {
      const claim = createTestClaim({
        totalPaid: { amount: 50000, currency: 'GBP' },
        recoveries: { amount: 10000, currency: 'GBP' },
      });
      expect(calculateNetPaid(claim)).toBe(40000);
    });

    it('handles null recoveries', () => {
      const claim = createTestClaim({
        totalPaid: { amount: 50000, currency: 'GBP' },
        recoveries: null,
      });
      expect(calculateNetPaid(claim)).toBe(50000);
    });
  });

  describe('getClaimAge', () => {
    it('calculates days since notification for open claim', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const claim = createTestClaim({
        notificationDate: thirtyDaysAgo,
        closedDate: null,
      });
      const age = getClaimAge(claim);
      expect(age).toBeGreaterThanOrEqual(29);
      expect(age).toBeLessThanOrEqual(31);
    });

    it('calculates days until closed for closed claim', () => {
      const now = new Date();
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const claim = createTestClaim({
        notificationDate: sixtyDaysAgo,
        closedDate: thirtyDaysAgo,
      });
      const age = getClaimAge(claim);
      expect(age).toBeGreaterThanOrEqual(29);
      expect(age).toBeLessThanOrEqual(31);
    });
  });

  describe('isOverdueForReview', () => {
    it('returns true when last activity exceeds threshold', () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      const claim = createTestClaim({
        status: 'investigation',
        lastActivityDate: fortyDaysAgo,
      });
      expect(isOverdueForReview(claim, 30)).toBe(true);
    });

    it('returns false when last activity is recent', () => {
      const claim = createTestClaim({
        status: 'investigation',
        lastActivityDate: new Date(),
      });
      expect(isOverdueForReview(claim, 30)).toBe(false);
    });

    it('returns false for closed claim', () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      const claim = createTestClaim({
        status: 'closed',
        lastActivityDate: fortyDaysAgo,
      });
      expect(isOverdueForReview(claim, 30)).toBe(false);
    });
  });

  describe('getClaimStatusLabel', () => {
    it('returns correct labels for all statuses', () => {
      expect(getClaimStatusLabel('draft')).toBe('Draft');
      expect(getClaimStatusLabel('submitted')).toBe('Submitted');
      expect(getClaimStatusLabel('under_review')).toBe('Under Review');
      expect(getClaimStatusLabel('investigation')).toBe('Investigation');
      expect(getClaimStatusLabel('approved')).toBe('Approved');
      expect(getClaimStatusLabel('partially_approved')).toBe('Partially Approved');
      expect(getClaimStatusLabel('denied')).toBe('Denied');
      expect(getClaimStatusLabel('settled')).toBe('Settled');
      expect(getClaimStatusLabel('closed')).toBe('Closed');
      expect(getClaimStatusLabel('reopened')).toBe('Reopened');
      expect(getClaimStatusLabel('withdrawn')).toBe('Withdrawn');
    });
  });

  describe('getDaysSinceIncident', () => {
    it('calculates days since incident', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const claim = createTestClaim({
        incidentDate: thirtyDaysAgo,
      });
      const days = getDaysSinceIncident(claim);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(31);
    });
  });

  describe('validateClaimPeriod', () => {
    it('returns valid for claim within policy period', () => {
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const claim = createTestClaim({
        incidentDate: thirtyDaysAgo,
        discoveryDate: thirtyDaysAgo,
      });

      const result = validateClaimPeriod(claim, oneYearAgo, oneYearFromNow);
      expect(result.valid).toBe(true);
    });

    it('returns invalid for claim before inception', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const claim = createTestClaim({
        incidentDate: sixtyDaysAgo,
        discoveryDate: sixtyDaysAgo,
      });

      const result = validateClaimPeriod(claim, thirtyDaysAgo, oneYearFromNow);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Incident occurred before policy inception');
    });

    it('returns invalid for claim after expiry', () => {
      const now = new Date();
      const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const claim = createTestClaim({
        incidentDate: thirtyDaysAgo,
        discoveryDate: thirtyDaysAgo,
      });

      const result = validateClaimPeriod(claim, twoYearsAgo, oneYearAgo);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Incident discovered after policy expiry');
    });

    it('returns valid for retroactive date coverage', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      const claim = createTestClaim({
        incidentDate: sixtyDaysAgo,
        discoveryDate: sixtyDaysAgo,
      });

      const result = validateClaimPeriod(claim, thirtyDaysAgo, oneYearFromNow, ninetyDaysAgo);
      expect(result.valid).toBe(true);
    });

    it('uses discovery date over incident date', () => {
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const claim = createTestClaim({
        incidentDate: twoYearsAgo,
        discoveryDate: thirtyDaysAgo,
      });

      const result = validateClaimPeriod(claim, oneYearAgo, oneYearFromNow);
      expect(result.valid).toBe(true);
    });
  });
});
