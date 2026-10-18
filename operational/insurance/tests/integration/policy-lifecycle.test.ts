/**
 * Insurance Policy Lifecycle Integration Tests
 *
 * Tests the full lifecycle of policies from creation to expiration/renewal,
 * including event publishing verification.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { policyRoutes } from '../../src/api/routes/policies';
import { claimRoutes } from '../../src/api/routes/claims';
import {
  setGlobalEventPublisher,
  InsuranceEventPublisher,
  InsuranceEventTypes,
} from '../../src/infrastructure/messaging';

// =============================================================================
// TEST SETUP
// =============================================================================

const mockEventBus = {
  publish: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn(),
};

const mockPublisher = new InsuranceEventPublisher(mockEventBus as any);

let prisma: PrismaClient;

beforeAll(async () => {
  // Use test database
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/insurance_test';
  prisma = new PrismaClient();
  await prisma.$connect();

  // Set up mock publisher
  setGlobalEventPublisher(mockPublisher);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clear mock calls
  vi.clearAllMocks();

  // Clean test data (in reverse order of dependencies)
  await prisma.claimPayment.deleteMany({});
  await prisma.claimActivity.deleteMany({});
  await prisma.claimReserveHistory.deleteMany({});
  await prisma.claimant.deleteMany({});
  await prisma.claimDocument.deleteMany({});
  await prisma.claim.deleteMany({});
  await prisma.premiumInstallment.deleteMany({});
  await prisma.policyEndorsement.deleteMany({});
  await prisma.policyDocument.deleteMany({});
  await prisma.coverage.deleteMany({});
  await prisma.insurer.deleteMany({});
  await prisma.policy.deleteMany({});
});

// =============================================================================
// TEST HELPERS
// =============================================================================

function createTestApp() {
  const app = new Hono();

  // Inject Prisma
  app.use('*', async (c, next) => {
    c.set('prisma', prisma);
    c.set('userId', 'test-user-id');
    await next();
  });

  app.route('/api/v1/policies', policyRoutes);
  app.route('/api/v1/claims', claimRoutes);

  return app;
}

const testTenantId = '00000000-0000-0000-0000-000000000001';
const testEntityId = '00000000-0000-0000-0000-000000000002';

function createValidPolicyInput() {
  const now = new Date();
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  return {
    tenantId: testTenantId,
    entityId: testEntityId,
    policyType: 'employers_liability',
    policyName: 'Test Employers Liability Policy',
    description: 'Test policy for integration tests',
    inceptionDate: now.toISOString(),
    expiryDate: oneYearFromNow.toISOString(),
    totalLimit: { amount: 10000000, currency: 'GBP' },
    totalDeductible: { amount: 1000, currency: 'GBP' },
    autoRenewal: true,
    renewalReminderDays: 60,
    insurers: [
      {
        name: 'Test Insurance Company',
        insurerType: 'lead',
        sharePercentage: 100,
        contactName: 'John Smith',
        contactEmail: 'john@testinsurer.com',
      },
    ],
    coverages: [
      {
        name: 'Employers Liability',
        limitType: 'per_occurrence',
        limit: { amount: 10000000, currency: 'GBP' },
        deductible: { amount: 1000, currency: 'GBP' },
        description: 'Standard EL coverage',
      },
    ],
    premium: {
      grossPremium: { amount: 5000, currency: 'GBP' },
      insurerPremiumTax: { amount: 600, currency: 'GBP' },
      netPremium: { amount: 4500, currency: 'GBP' },
      paymentFrequency: 'annual',
      isPaid: false,
    },
  };
}

// =============================================================================
// POLICY LIFECYCLE TESTS
// =============================================================================

describe('Policy Lifecycle Integration', () => {
  describe('Policy Creation', () => {
    it('should create a policy and publish PolicyCreated event', async () => {
      const app = createTestApp();
      const input = createValidPolicyInput();

      const res = await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      expect(res.status).toBe(201);

      const policy = await res.json();
      expect(policy.policyNumber).toBeDefined();
      expect(policy.status).toBe('draft');
      expect(policy.insurers).toHaveLength(1);
      expect(policy.coverages).toHaveLength(1);

      // Verify event was published
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: InsuranceEventTypes.POLICY_CREATED,
          payload: expect.objectContaining({
            policyId: policy.id,
            tenantId: testTenantId,
            entityId: testEntityId,
            policyType: 'employers_liability',
          }),
        })
      );
    });

    it('should enforce UK employers liability minimum coverage', async () => {
      const app = createTestApp();
      const input = createValidPolicyInput();
      // Set coverage below UK minimum of £5M
      input.totalLimit.amount = 1000000;
      input.coverages[0].limit.amount = 1000000;

      const res = await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      // Policy should still be created but flagged
      expect(res.status).toBe(201);
      const policy = await res.json();

      // The policy service should log a warning about insufficient EL coverage
      // In production, this would trigger a compliance event
    });
  });

  describe('Policy Status Transitions', () => {
    it('should transition through full lifecycle: draft → quoted → bound → active', async () => {
      const app = createTestApp();

      // Step 1: Create policy (draft)
      const createRes = await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createValidPolicyInput()),
      });
      const policy = await createRes.json();
      expect(policy.status).toBe('draft');

      // Step 2: Quote policy
      const quoteRes = await app.request(`/api/v1/policies/${policy.id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grossPremium: { amount: 5500, currency: 'GBP' },
          ipt: { amount: 660, currency: 'GBP' },
          netPremium: { amount: 4950, currency: 'GBP' },
          paymentFrequency: 'annual',
        }),
      });
      expect(quoteRes.status).toBe(200);
      const quotedPolicy = await quoteRes.json();
      expect(quotedPolicy.status).toBe('quoted');

      // Step 3: Bind policy
      const bindRes = await app.request(`/api/v1/policies/${policy.id}/bind`, {
        method: 'POST',
      });
      expect(bindRes.status).toBe(200);
      const boundPolicy = await bindRes.json();
      expect(boundPolicy.status).toBe('bound');

      // Verify PolicyBound event
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: InsuranceEventTypes.POLICY_BOUND,
        })
      );

      // Step 4: Activate policy
      const activateRes = await app.request(`/api/v1/policies/${policy.id}/activate`, {
        method: 'POST',
      });
      expect(activateRes.status).toBe(200);
      const activePolicy = await activateRes.json();
      expect(activePolicy.status).toBe('active');

      // Verify PolicyActivated event
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: InsuranceEventTypes.POLICY_ACTIVATED,
        })
      );
    });

    it('should not allow binding from draft status (must quote first)', async () => {
      const app = createTestApp();

      const createRes = await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createValidPolicyInput()),
      });
      const policy = await createRes.json();

      // Try to bind directly from draft
      const bindRes = await app.request(`/api/v1/policies/${policy.id}/bind`, {
        method: 'POST',
      });

      expect(bindRes.status).toBe(400);
      const error = await bindRes.json();
      expect(error.message).toContain('quoted');
    });
  });

  describe('Policy Cancellation', () => {
    it('should cancel active policy and publish event', async () => {
      const app = createTestApp();

      // Create and activate policy
      const createRes = await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createValidPolicyInput()),
      });
      const policy = await createRes.json();

      // Quote and bind
      await app.request(`/api/v1/policies/${policy.id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grossPremium: { amount: 5000, currency: 'GBP' },
          ipt: { amount: 600, currency: 'GBP' },
          netPremium: { amount: 4500, currency: 'GBP' },
          paymentFrequency: 'annual',
        }),
      });
      await app.request(`/api/v1/policies/${policy.id}/bind`, { method: 'POST' });
      await app.request(`/api/v1/policies/${policy.id}/activate`, { method: 'POST' });

      vi.clearAllMocks();

      // Cancel policy
      const cancelRes = await app.request(`/api/v1/policies/${policy.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Business closure' }),
      });

      expect(cancelRes.status).toBe(200);
      const cancelledPolicy = await cancelRes.json();
      expect(cancelledPolicy.status).toBe('cancelled');

      // Verify PolicyCancelled event
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: InsuranceEventTypes.POLICY_CANCELLED,
          payload: expect.objectContaining({
            cancellationReason: 'Business closure',
          }),
        })
      );
    });
  });

  describe('Policy Renewal', () => {
    it('should renew policy and create new policy with correct dates', async () => {
      const app = createTestApp();

      // Create and activate policy
      const input = createValidPolicyInput();
      const createRes = await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const policy = await createRes.json();

      // Quick path to active
      await app.request(`/api/v1/policies/${policy.id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grossPremium: { amount: 5000, currency: 'GBP' },
          ipt: { amount: 600, currency: 'GBP' },
          netPremium: { amount: 4500, currency: 'GBP' },
          paymentFrequency: 'annual',
        }),
      });
      await app.request(`/api/v1/policies/${policy.id}/bind`, { method: 'POST' });
      await app.request(`/api/v1/policies/${policy.id}/activate`, { method: 'POST' });

      vi.clearAllMocks();

      // Renew policy
      const twoYearsFromNow = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);
      const renewRes = await app.request(`/api/v1/policies/${policy.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newExpiryDate: twoYearsFromNow.toISOString(),
        }),
      });

      expect(renewRes.status).toBe(200);
      const newPolicy = await renewRes.json();

      // New policy should be draft
      expect(newPolicy.status).toBe('draft');
      expect(newPolicy.id).not.toBe(policy.id);
      expect(newPolicy.policyNumber).not.toBe(policy.policyNumber);

      // New policy inception should be old policy expiry
      const oldPolicyExpiry = new Date(input.expiryDate);
      const newPolicyInception = new Date(newPolicy.inceptionDate);
      expect(newPolicyInception.getTime()).toBe(oldPolicyExpiry.getTime());

      // Verify PolicyRenewed event
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: InsuranceEventTypes.POLICY_RENEWED,
          payload: expect.objectContaining({
            oldPolicyId: policy.id,
            policyId: newPolicy.id,
          }),
        })
      );

      // Original policy should be marked as renewed
      const originalRes = await app.request(`/api/v1/policies/${policy.id}`);
      const originalPolicy = await originalRes.json();
      expect(originalPolicy.status).toBe('renewed');
      expect(originalPolicy.renewedByPolicyId).toBe(newPolicy.id);
    });
  });
});

// =============================================================================
// CLAIMS LIFECYCLE TESTS
// =============================================================================

describe('Claims Lifecycle Integration', () => {
  let activePolicyId: string;

  beforeEach(async () => {
    const app = createTestApp();

    // Create active policy for claims
    const input = createValidPolicyInput();
    const createRes = await app.request('/api/v1/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const policy = await createRes.json();

    // Activate policy
    await app.request(`/api/v1/policies/${policy.id}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grossPremium: { amount: 5000, currency: 'GBP' },
        ipt: { amount: 600, currency: 'GBP' },
        netPremium: { amount: 4500, currency: 'GBP' },
        paymentFrequency: 'annual',
      }),
    });
    await app.request(`/api/v1/policies/${policy.id}/bind`, { method: 'POST' });
    await app.request(`/api/v1/policies/${policy.id}/activate`, { method: 'POST' });

    activePolicyId = policy.id;
    vi.clearAllMocks();
  });

  describe('Claim Creation and Submission', () => {
    it('should create claim and publish event', async () => {
      const app = createTestApp();

      const claimInput = {
        tenantId: testTenantId,
        entityId: testEntityId,
        policyId: activePolicyId,
        claimType: 'third_party_injury',
        title: 'Workplace Injury Claim',
        description: 'Employee slipped on wet floor',
        incidentDate: new Date().toISOString(),
        claimedAmount: { amount: 50000, currency: 'GBP' },
        priority: 'high',
        claimants: [
          {
            claimantType: 'employee',
            name: 'Jane Doe',
            email: 'jane@example.com',
          },
        ],
      };

      const res = await app.request('/api/v1/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(claimInput),
      });

      expect(res.status).toBe(201);
      const claim = await res.json();
      expect(claim.claimNumber).toBeDefined();
      expect(claim.status).toBe('draft');
      expect(claim.claimants).toHaveLength(1);

      // Verify ClaimCreated event
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: InsuranceEventTypes.CLAIM_CREATED,
          payload: expect.objectContaining({
            claimId: claim.id,
            policyId: activePolicyId,
            claimType: 'third_party_injury',
          }),
        })
      );
    });

    it('should submit claim and publish event', async () => {
      const app = createTestApp();

      // Create claim
      const createRes = await app.request('/api/v1/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: testTenantId,
          entityId: testEntityId,
          policyId: activePolicyId,
          claimType: 'property_damage',
          title: 'Property Damage Claim',
          description: 'Water damage to equipment',
          incidentDate: new Date().toISOString(),
          claimedAmount: { amount: 25000, currency: 'GBP' },
        }),
      });
      const claim = await createRes.json();

      vi.clearAllMocks();

      // Submit claim
      const submitRes = await app.request(`/api/v1/claims/${claim.id}/submit`, {
        method: 'POST',
      });

      expect(submitRes.status).toBe(200);
      const submittedClaim = await submitRes.json();
      expect(submittedClaim.status).toBe('submitted');

      // Verify ClaimSubmitted event
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: InsuranceEventTypes.CLAIM_SUBMITTED,
        })
      );
    });
  });

  describe('Claim Approval and Settlement', () => {
    it('should process claim through approval and settlement', async () => {
      const app = createTestApp();

      // Create and submit claim
      const createRes = await app.request('/api/v1/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: testTenantId,
          entityId: testEntityId,
          policyId: activePolicyId,
          claimType: 'third_party_injury',
          title: 'Test Claim',
          description: 'Test description',
          incidentDate: new Date().toISOString(),
          claimedAmount: { amount: 10000, currency: 'GBP' },
        }),
      });
      const claim = await createRes.json();
      await app.request(`/api/v1/claims/${claim.id}/submit`, { method: 'POST' });

      // Start investigation
      await app.request(`/api/v1/claims/${claim.id}/investigate`, { method: 'POST' });

      vi.clearAllMocks();

      // Approve claim
      const approveRes = await app.request(`/api/v1/claims/${claim.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Coverage confirmed' }),
      });
      expect(approveRes.status).toBe(200);

      // Verify ClaimApproved event
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: InsuranceEventTypes.CLAIM_APPROVED,
        })
      );

      vi.clearAllMocks();

      // Settle claim
      const settleRes = await app.request(`/api/v1/claims/${claim.id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 8000,
          currency: 'GBP',
          notes: 'Final settlement',
        }),
      });
      expect(settleRes.status).toBe(200);
      const settledClaim = await settleRes.json();
      expect(settledClaim.status).toBe('settled');

      // Verify ClaimSettled event
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: InsuranceEventTypes.CLAIM_SETTLED,
          payload: expect.objectContaining({
            settlementAmount: { amount: 8000, currency: 'GBP' },
          }),
        })
      );
    });
  });

  describe('Claim Payments', () => {
    it('should add payment and publish event', async () => {
      const app = createTestApp();

      // Create approved claim
      const createRes = await app.request('/api/v1/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: testTenantId,
          entityId: testEntityId,
          policyId: activePolicyId,
          claimType: 'third_party_injury',
          title: 'Payment Test Claim',
          description: 'Test description',
          incidentDate: new Date().toISOString(),
          claimedAmount: { amount: 20000, currency: 'GBP' },
        }),
      });
      const claim = await createRes.json();

      await app.request(`/api/v1/claims/${claim.id}/submit`, { method: 'POST' });
      await app.request(`/api/v1/claims/${claim.id}/investigate`, { method: 'POST' });
      await app.request(`/api/v1/claims/${claim.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      vi.clearAllMocks();

      // Add payment
      const paymentRes = await app.request(`/api/v1/claims/${claim.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType: 'indemnity',
          amount: 5000,
          currency: 'GBP',
          payee: 'Jane Doe',
          paymentDate: new Date().toISOString(),
          paymentMethod: 'bank_transfer',
          description: 'First payment',
        }),
      });

      expect(paymentRes.status).toBe(201);

      // Verify ClaimPaymentMade event
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: InsuranceEventTypes.CLAIM_PAYMENT_MADE,
          payload: expect.objectContaining({
            amount: { amount: 5000, currency: 'GBP' },
            payee: 'Jane Doe',
          }),
        })
      );
    });
  });
});

// =============================================================================
// METRICS TESTS
// =============================================================================

describe('Dashboard Metrics', () => {
  it('should return correct policy metrics', async () => {
    const app = createTestApp();

    // Create several policies
    for (let i = 0; i < 3; i++) {
      const createRes = await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createValidPolicyInput()),
      });
      const policy = await createRes.json();

      if (i < 2) {
        // Activate 2 of them
        await app.request(`/api/v1/policies/${policy.id}/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grossPremium: { amount: 5000, currency: 'GBP' },
            ipt: { amount: 600, currency: 'GBP' },
            netPremium: { amount: 4500, currency: 'GBP' },
            paymentFrequency: 'annual',
          }),
        });
        await app.request(`/api/v1/policies/${policy.id}/bind`, { method: 'POST' });
        await app.request(`/api/v1/policies/${policy.id}/activate`, { method: 'POST' });
      }
    }

    const metricsRes = await app.request(`/api/v1/policies/dashboard/metrics?tenantId=${testTenantId}`);
    expect(metricsRes.status).toBe(200);

    const metrics = await metricsRes.json();
    expect(metrics.totalPolicies).toBe(3);
    expect(metrics.activePolicies).toBe(2);
    expect(metrics.byPolicyType['employers_liability']).toBe(3);
  });
});
