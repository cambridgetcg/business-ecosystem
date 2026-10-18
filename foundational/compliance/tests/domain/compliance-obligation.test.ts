import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isOverdue,
  getDaysUntilDue,
  needsAttention,
  needsEscalation,
  getStatusColor,
  getPriorityColor,
  getStatusLabel,
  canTransitionTo,
  calculatePriority,
  type ComplianceObligation,
} from '../../src/domain/entities/compliance-obligation.js';

describe('Compliance Obligation Domain Logic', () => {
  const createObligation = (overrides: Partial<ComplianceObligation> = {}): ComplianceObligation => ({
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000002',
    entityId: '00000000-0000-0000-0000-000000000003',
    requirementId: '00000000-0000-0000-0000-000000000004',
    regulator: 'hmrc',
    jurisdiction: 'uk',
    category: 'corporation_tax',
    title: 'Test Obligation',
    description: null,
    formReference: null,
    status: 'pending',
    priority: 'medium',
    periodStart: null,
    periodEnd: null,
    dueDate: new Date('2024-12-31'),
    submittedDate: null,
    completedDate: null,
    assignedTo: null,
    assignedToName: null,
    assignedAt: null,
    reviewedBy: null,
    reviewedByName: null,
    reviewedDate: null,
    reviewNotes: null,
    completedBy: null,
    completedByName: null,
    completionNotes: null,
    evidenceDocuments: null,
    submissionReference: null,
    externalUrl: null,
    reminderSentAt: null,
    escalated: false,
    escalatedAt: null,
    escalatedTo: null,
    escalationReason: null,
    filingFee: null,
    penaltyAmount: null,
    totalCost: null,
    notes: null,
    metadata: null,
    tags: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...overrides,
  });

  describe('isOverdue', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return false for pending obligation with future due date', () => {
      const obligation = createObligation({ dueDate: new Date('2024-12-31') });
      expect(isOverdue(obligation)).toBe(false);
    });

    it('should return true for pending obligation with past due date', () => {
      const obligation = createObligation({ dueDate: new Date('2024-01-01') });
      expect(isOverdue(obligation)).toBe(true);
    });

    it('should return false for completed obligation even if past due date', () => {
      const obligation = createObligation({
        dueDate: new Date('2024-01-01'),
        status: 'completed',
      });
      expect(isOverdue(obligation)).toBe(false);
    });

    it('should return false for waived obligation', () => {
      const obligation = createObligation({
        dueDate: new Date('2024-01-01'),
        status: 'waived',
      });
      expect(isOverdue(obligation)).toBe(false);
    });

    it('should return false for not_applicable obligation', () => {
      const obligation = createObligation({
        dueDate: new Date('2024-01-01'),
        status: 'not_applicable',
      });
      expect(isOverdue(obligation)).toBe(false);
    });
  });

  describe('getDaysUntilDue', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return positive days for future due date', () => {
      const obligation = createObligation({ dueDate: new Date('2024-06-25') });
      expect(getDaysUntilDue(obligation)).toBe(10);
    });

    it('should return negative days for past due date', () => {
      const obligation = createObligation({ dueDate: new Date('2024-06-10') });
      expect(getDaysUntilDue(obligation)).toBe(-5);
    });

    it('should return 0 for same day', () => {
      const obligation = createObligation({ dueDate: new Date('2024-06-15') });
      expect(getDaysUntilDue(obligation)).toBe(0);
    });
  });

  describe('needsAttention', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for obligation due within 7 days', () => {
      const obligation = createObligation({ dueDate: new Date('2024-06-20') });
      expect(needsAttention(obligation)).toBe(true);
    });

    it('should return false for obligation due in more than 7 days', () => {
      const obligation = createObligation({ dueDate: new Date('2024-06-30') });
      expect(needsAttention(obligation)).toBe(false);
    });

    it('should return true for overdue obligation', () => {
      const obligation = createObligation({ dueDate: new Date('2024-06-01') });
      expect(needsAttention(obligation)).toBe(true);
    });

    it('should return false for completed obligation', () => {
      const obligation = createObligation({
        dueDate: new Date('2024-06-20'),
        status: 'completed',
      });
      expect(needsAttention(obligation)).toBe(false);
    });
  });

  describe('needsEscalation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return false for already escalated obligation', () => {
      const obligation = createObligation({ escalated: true });
      expect(needsEscalation(obligation)).toBe(false);
    });

    it('should return false for completed obligation', () => {
      const obligation = createObligation({ status: 'completed' });
      expect(needsEscalation(obligation)).toBe(false);
    });

    it('should return true for overdue obligation', () => {
      const obligation = createObligation({ dueDate: new Date('2024-06-01') });
      expect(needsEscalation(obligation)).toBe(true);
    });

    it('should return true for critical priority within 3 days', () => {
      const obligation = createObligation({
        dueDate: new Date('2024-06-17'),
        priority: 'critical',
      });
      expect(needsEscalation(obligation)).toBe(true);
    });

    it('should return true for high priority within 3 days', () => {
      const obligation = createObligation({
        dueDate: new Date('2024-06-17'),
        priority: 'high',
      });
      expect(needsEscalation(obligation)).toBe(true);
    });

    it('should return false for medium priority within 3 days', () => {
      const obligation = createObligation({
        dueDate: new Date('2024-06-17'),
        priority: 'medium',
      });
      expect(needsEscalation(obligation)).toBe(false);
    });
  });

  describe('getStatusColor', () => {
    it('should return correct color for pending', () => {
      expect(getStatusColor('pending')).toBe('#6B7280');
    });

    it('should return correct color for completed', () => {
      expect(getStatusColor('completed')).toBe('#059669');
    });

    it('should return correct color for overdue', () => {
      expect(getStatusColor('overdue')).toBe('#DC2626');
    });

    it('should return correct color for in_progress', () => {
      expect(getStatusColor('in_progress')).toBe('#3B82F6');
    });
  });

  describe('getPriorityColor', () => {
    it('should return correct color for critical', () => {
      expect(getPriorityColor('critical')).toBe('#DC2626');
    });

    it('should return correct color for high', () => {
      expect(getPriorityColor('high')).toBe('#EA580C');
    });

    it('should return correct color for medium', () => {
      expect(getPriorityColor('medium')).toBe('#CA8A04');
    });

    it('should return correct color for low', () => {
      expect(getPriorityColor('low')).toBe('#2563EB');
    });
  });

  describe('getStatusLabel', () => {
    it('should return correct label for pending', () => {
      expect(getStatusLabel('pending')).toBe('Pending');
    });

    it('should return correct label for in_progress', () => {
      expect(getStatusLabel('in_progress')).toBe('In Progress');
    });

    it('should return correct label for under_review', () => {
      expect(getStatusLabel('under_review')).toBe('Under Review');
    });
  });

  describe('canTransitionTo', () => {
    it('should allow pending to in_progress', () => {
      expect(canTransitionTo('pending', 'in_progress')).toBe(true);
    });

    it('should allow pending to waived', () => {
      expect(canTransitionTo('pending', 'waived')).toBe(true);
    });

    it('should not allow pending to completed directly', () => {
      expect(canTransitionTo('pending', 'completed')).toBe(false);
    });

    it('should allow in_progress to completed', () => {
      expect(canTransitionTo('in_progress', 'completed')).toBe(true);
    });

    it('should not allow transitions from completed', () => {
      expect(canTransitionTo('completed', 'pending')).toBe(false);
      expect(canTransitionTo('completed', 'in_progress')).toBe(false);
    });

    it('should allow overdue to completed', () => {
      expect(canTransitionTo('overdue', 'completed')).toBe(true);
    });

    it('should allow failed to in_progress (retry)', () => {
      expect(canTransitionTo('failed', 'in_progress')).toBe(true);
    });
  });

  describe('calculatePriority', () => {
    it('should return critical for overdue', () => {
      expect(calculatePriority(-5, 'corporation_tax')).toBe('critical');
    });

    it('should return critical for critical category within 7 days', () => {
      expect(calculatePriority(5, 'corporation_tax')).toBe('critical');
      expect(calculatePriority(5, 'vat')).toBe('critical');
      expect(calculatePriority(5, 'data_breach')).toBe('critical');
    });

    it('should return high for within 3 days', () => {
      expect(calculatePriority(2, 'company_filing')).toBe('high');
    });

    it('should return medium for within 14 days', () => {
      expect(calculatePriority(10, 'company_filing')).toBe('medium');
    });

    it('should return low for more than 14 days', () => {
      expect(calculatePriority(30, 'company_filing')).toBe('low');
    });
  });
});
