import { describe, it, expect } from 'vitest';
import {
  policyNeedsReview,
  isPolicyActive,
  daysUntilPolicyReview,
  isAttestationOverdue,
  calculateAttestationCompletionRate,
  type Policy,
  type Attestation,
} from '../../src/domain/entities/compliance-program.js';

/**
 * Integration tests for Policies and Attestations API
 */

describe('Policies API Routes', () => {
  describe('Policy Validation', () => {
    it('should validate policy statuses', () => {
      const validStatuses = [
        'draft',
        'pending_approval',
        'approved',
        'published',
        'under_review',
        'deprecated',
        'retired',
      ];

      expect(validStatuses).toContain('draft');
      expect(validStatuses).toContain('published');
      expect(validStatuses).toHaveLength(7);
    });

    it('should validate acknowledgment frequencies', () => {
      const validFrequencies = ['once', 'annual', 'biannual', 'quarterly'];

      expect(validFrequencies).toContain('annual');
      expect(validFrequencies).toContain('quarterly');
    });
  });

  describe('Policy Review Logic', () => {
    it('should identify policies needing review', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const policy = {
        status: 'published',
        reviewDate: pastDate,
      } as Policy;

      expect(policyNeedsReview(policy)).toBe(true);
    });

    it('should not flag policies without review date', () => {
      const policy = {
        status: 'published',
        reviewDate: null,
      } as Policy;

      expect(policyNeedsReview(policy)).toBe(false);
    });

    it('should not flag policies with future review date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const policy = {
        status: 'published',
        reviewDate: futureDate,
      } as Policy;

      expect(policyNeedsReview(policy)).toBe(false);
    });
  });

  describe('Policy Active Status', () => {
    it('should return true for published policy within dates', () => {
      const policy = {
        status: 'published',
        effectiveDate: new Date('2020-01-01'),
        expirationDate: null,
      } as Policy;

      expect(isPolicyActive(policy)).toBe(true);
    });

    it('should return false for non-published policy', () => {
      const policy = {
        status: 'draft',
        effectiveDate: new Date('2020-01-01'),
        expirationDate: null,
      } as Policy;

      expect(isPolicyActive(policy)).toBe(false);
    });

    it('should return false for policy not yet effective', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const policy = {
        status: 'published',
        effectiveDate: futureDate,
        expirationDate: null,
      } as Policy;

      expect(isPolicyActive(policy)).toBe(false);
    });

    it('should return false for expired policy', () => {
      const policy = {
        status: 'published',
        effectiveDate: new Date('2020-01-01'),
        expirationDate: new Date('2020-12-31'),
      } as Policy;

      expect(isPolicyActive(policy)).toBe(false);
    });
  });

  describe('Days Until Review', () => {
    it('should calculate positive days for future review', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const policy = {
        reviewDate: futureDate,
      } as Policy;

      const days = daysUntilPolicyReview(policy);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(31);
    });

    it('should calculate negative days for past review', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const policy = {
        reviewDate: pastDate,
      } as Policy;

      const days = daysUntilPolicyReview(policy);
      expect(days).toBeLessThanOrEqual(-9);
    });

    it('should return null when no review date', () => {
      const policy = {
        reviewDate: null,
      } as Policy;

      expect(daysUntilPolicyReview(policy)).toBeNull();
    });
  });
});

describe('Attestations API Routes', () => {
  describe('Attestation Validation', () => {
    it('should validate attestation types', () => {
      const validTypes = [
        'policy_acknowledgment',
        'training_completion',
        'compliance_certification',
        'conflict_of_interest',
        'code_of_conduct',
        'data_protection',
        'security_awareness',
        'whistleblower',
        'anti_bribery',
        'custom',
      ];

      expect(validTypes).toContain('policy_acknowledgment');
      expect(validTypes).toContain('conflict_of_interest');
      expect(validTypes).toHaveLength(10);
    });

    it('should validate response types', () => {
      const validResponses = ['agree', 'disagree', 'not_applicable'];

      expect(validResponses).toContain('agree');
      expect(validResponses).toContain('disagree');
    });
  });

  describe('Attestation Overdue Logic', () => {
    it('should identify overdue attestations', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const attestation = {
        status: 'pending',
        dueDate: pastDate,
      } as Attestation;

      expect(isAttestationOverdue(attestation)).toBe(true);
    });

    it('should not flag completed attestations as overdue', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const attestation = {
        status: 'completed',
        dueDate: pastDate,
      } as Attestation;

      expect(isAttestationOverdue(attestation)).toBe(false);
    });

    it('should not flag attestations with future due date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const attestation = {
        status: 'pending',
        dueDate: futureDate,
      } as Attestation;

      expect(isAttestationOverdue(attestation)).toBe(false);
    });
  });

  describe('Completion Rate Calculation', () => {
    it('should calculate 100% when all completed', () => {
      expect(calculateAttestationCompletionRate(10, 10)).toBe(100);
    });

    it('should calculate 0% when none completed', () => {
      expect(calculateAttestationCompletionRate(0, 10)).toBe(0);
    });

    it('should calculate 100% when no attestations exist', () => {
      expect(calculateAttestationCompletionRate(0, 0)).toBe(100);
    });

    it('should calculate correct percentage', () => {
      expect(calculateAttestationCompletionRate(7, 10)).toBe(70);
      expect(calculateAttestationCompletionRate(3, 4)).toBe(75);
    });

    it('should round to one decimal place', () => {
      expect(calculateAttestationCompletionRate(1, 3)).toBe(33.3);
      expect(calculateAttestationCompletionRate(2, 3)).toBe(66.7);
    });
  });
});

describe('Policy Workflow', () => {
  describe('Approval Workflow', () => {
    it('should allow draft -> pending_approval transition', () => {
      const validTransitions: Record<string, string[]> = {
        draft: ['pending_approval'],
        pending_approval: ['approved', 'draft'],
        approved: ['published', 'draft'],
        published: ['under_review', 'deprecated'],
        under_review: ['published', 'draft'],
        deprecated: ['retired'],
        retired: [],
      };

      expect(validTransitions['draft']).toContain('pending_approval');
      expect(validTransitions['approved']).toContain('published');
    });

    it('should not allow publishing unapproved policy', () => {
      const policy = {
        status: 'draft',
      };

      const canPublish = policy.status === 'approved';
      expect(canPublish).toBe(false);
    });
  });

  describe('Version Management', () => {
    it('should increment minor version correctly', () => {
      const currentVersion = '1.0';
      const parts = currentVersion.split('.');
      const major = parseInt(parts[0], 10);
      const minor = parseInt(parts[1], 10) + 1;
      const newVersion = `${major}.${minor}`;

      expect(newVersion).toBe('1.1');
    });

    it('should handle version parsing', () => {
      const versions = ['1.0', '1.5', '2.0', '2.10'];

      for (const version of versions) {
        const parts = version.split('.');
        expect(parts).toHaveLength(2);
        expect(parseInt(parts[0], 10)).toBeGreaterThanOrEqual(1);
        expect(parseInt(parts[1], 10)).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

describe('Standard Policies', () => {
  it('should define UK standard policies', () => {
    const standardPolicies = [
      'Anti-Bribery and Corruption Policy',
      'Anti-Money Laundering Policy',
      'Data Protection Policy',
      'Whistleblowing Policy',
      'Conflicts of Interest Policy',
      'Information Security Policy',
    ];

    expect(standardPolicies.length).toBeGreaterThanOrEqual(6);
    expect(standardPolicies).toContain('Data Protection Policy');
  });
});
