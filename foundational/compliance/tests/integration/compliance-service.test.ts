/**
 * Compliance Service Integration Tests
 *
 * Tests for end-to-end obligation lifecycle, status transitions,
 * and cross-entity operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockComplianceService,
  createMockRequirement,
  createMockObligation,
  createMockFinding,
  clearMocks,
} from './setup.js';
import {
  isOverdue,
  getDaysUntilDue,
  needsAttention,
  needsEscalation,
  canTransitionTo,
} from '../../src/domain/entities/compliance-obligation.js';

describe('ComplianceService Integration', () => {
  let service: MockComplianceService;

  beforeEach(() => {
    service = new MockComplianceService();
    clearMocks();
  });

  afterEach(() => {
    clearMocks();
  });

  describe('Obligation Lifecycle', () => {
    beforeEach(async () => {
      // Set up a requirement
      const requirement = createMockRequirement({
        id: 'req-1',
        regulator: 'companies_house',
        category: 'corporate_filing',
      });
      service['requirements'].set(requirement.id, requirement);
    });

    it('should create obligation from requirement', async () => {
      const obligation = await service.createObligation({
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        requirementId: 'req-1',
        title: 'Annual Accounts Filing 2024',
        dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });

      expect(obligation.id).toBeDefined();
      expect(obligation.tenantId).toBe('tenant-123');
      expect(obligation.entityId).toBe('entity-123');
      expect(obligation.status).toBe('pending');
      expect(obligation.regulator).toBe('companies_house');
      expect(obligation.category).toBe('corporate_filing');
    });

    it('should transition obligation through lifecycle', async () => {
      // Create obligation
      const obligation = await service.createObligation({
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        requirementId: 'req-1',
        title: 'Annual Accounts Filing',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Move to in_progress
      await service.updateObligation(obligation.id, { status: 'in_progress' });
      let updated = await service.getObligation(obligation.id);
      expect(updated?.status).toBe('in_progress');

      // Move to under_review
      await service.updateObligation(obligation.id, { status: 'under_review' });
      updated = await service.getObligation(obligation.id);
      expect(updated?.status).toBe('under_review');

      // Move to submitted
      await service.updateObligation(obligation.id, {
        status: 'submitted',
        submissionReference: 'CH-123456',
      });
      updated = await service.getObligation(obligation.id);
      expect(updated?.status).toBe('submitted');

      // Move to completed
      await service.updateObligation(obligation.id, { status: 'completed' });
      updated = await service.getObligation(obligation.id);
      expect(updated?.status).toBe('completed');
    });

    it('should track overdue obligations', async () => {
      // Create an overdue obligation
      const overdueObl = createMockObligation({
        id: 'obl-overdue',
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        requirementId: 'req-1',
        status: 'pending',
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      });
      service['obligations'].set(overdueObl.id, overdueObl);

      // Create a current obligation
      const currentObl = createMockObligation({
        id: 'obl-current',
        tenantId: 'tenant-123',
        entityId: 'entity-456',
        requirementId: 'req-1',
        status: 'pending',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      service['obligations'].set(currentObl.id, currentObl);

      const overdueObligations = await service.getOverdueObligations('tenant-123');

      expect(overdueObligations.length).toBe(1);
      expect(overdueObligations[0].id).toBe('obl-overdue');
    });

    it('should get upcoming deadlines', async () => {
      // Create obligations with various due dates
      const urgent = createMockObligation({
        id: 'obl-urgent',
        tenantId: 'tenant-123',
        status: 'pending',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
      service['obligations'].set(urgent.id, urgent);

      const normal = createMockObligation({
        id: 'obl-normal',
        tenantId: 'tenant-123',
        status: 'pending',
        dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
      });
      service['obligations'].set(normal.id, normal);

      const farAway = createMockObligation({
        id: 'obl-far',
        tenantId: 'tenant-123',
        status: 'pending',
        dueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days
      });
      service['obligations'].set(farAway.id, farAway);

      const deadlines = await service.getUpcomingDeadlines('tenant-123', 90);

      expect(deadlines.length).toBe(2);
      expect(deadlines.map(d => d.id)).toContain('obl-urgent');
      expect(deadlines.map(d => d.id)).toContain('obl-normal');
    });

    it('should throw when creating obligation without valid requirement', async () => {
      await expect(
        service.createObligation({
          tenantId: 'tenant-123',
          entityId: 'entity-123',
          requirementId: 'non-existent',
          title: 'Test Obligation',
          dueDate: new Date(),
        })
      ).rejects.toThrow('Requirement not found');
    });
  });

  describe('Findings Management', () => {
    it('should create and track audit findings', async () => {
      const finding = await service.createFinding({
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        title: 'Missing Documentation',
        description: 'Required compliance documentation not found',
        findingType: 'compliance_gap',
        severity: 'high',
        auditType: 'internal_review',
        auditDate: new Date(),
        regulator: 'companies_house',
        remediationDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      expect(finding.id).toBeDefined();
      expect(finding.status).toBe('open');
      expect(finding.severity).toBe('high');
    });

    it('should update finding with remediation plan', async () => {
      const finding = await service.createFinding({
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        title: 'Control Weakness',
        findingType: 'control_weakness',
        severity: 'medium',
        auditType: 'internal_review',
        auditDate: new Date(),
        remediationDueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      });

      const updated = await service.updateFinding(finding.id, {
        remediationPlan: 'Implement automated controls',
        remediationOwner: 'compliance@company.com',
      });

      expect(updated?.remediationPlan).toBe('Implement automated controls');
      expect(updated?.remediationOwner).toBe('compliance@company.com');
    });

    it('should close finding with notes', async () => {
      const finding = await service.createFinding({
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        title: 'Test Finding',
        findingType: 'compliance_gap',
        severity: 'low',
        auditType: 'internal_review',
        auditDate: new Date(),
        remediationDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const closed = await service.closeFinding(
        finding.id,
        'Remediation completed successfully',
        'auditor@company.com'
      );

      expect(closed?.status).toBe('closed');
      expect(closed?.closedAt).toBeDefined();
      expect(closed?.closedBy).toBe('auditor@company.com');
      expect(closed?.closureNotes).toBe('Remediation completed successfully');
    });
  });

  describe('Dashboard Metrics', () => {
    beforeEach(async () => {
      // Set up various obligations and findings
      const requirement = createMockRequirement({ id: 'req-1' });
      service['requirements'].set(requirement.id, requirement);

      // Completed obligation
      const completed = createMockObligation({
        id: 'obl-completed',
        tenantId: 'tenant-123',
        status: 'completed',
        dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });
      service['obligations'].set(completed.id, completed);

      // Pending obligation due soon
      const pending = createMockObligation({
        id: 'obl-pending',
        tenantId: 'tenant-123',
        status: 'pending',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      });
      service['obligations'].set(pending.id, pending);

      // Overdue obligation
      const overdue = createMockObligation({
        id: 'obl-overdue',
        tenantId: 'tenant-123',
        status: 'pending',
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      });
      service['obligations'].set(overdue.id, overdue);

      // Open finding
      const finding = createMockFinding({
        id: 'find-1',
        tenantId: 'tenant-123',
        status: 'open',
      });
      service['findings'].set(finding.id, finding);
    });

    it('should calculate dashboard metrics correctly', async () => {
      const metrics = await service.getDashboardMetrics('tenant-123');

      expect(metrics.totalObligations).toBe(3);
      expect(metrics.overdueObligations).toBe(1);
      expect(metrics.upcomingDeadlines).toBe(1); // Pending within 30 days
      expect(metrics.openFindings).toBe(1);
      expect(metrics.complianceRate).toBeCloseTo(33.33, 0); // 1 of 3 completed
    });

    it('should return 100% compliance rate when no obligations', async () => {
      service['obligations'].clear();

      const metrics = await service.getDashboardMetrics('tenant-123');

      expect(metrics.totalObligations).toBe(0);
      expect(metrics.complianceRate).toBe(100);
    });
  });

  describe('Compliance Reports', () => {
    beforeEach(async () => {
      const requirement = createMockRequirement({ id: 'req-1' });
      service['requirements'].set(requirement.id, requirement);

      // Create obligations in the reporting period
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-12-31');

      const obl1 = createMockObligation({
        id: 'obl-q1',
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        status: 'completed',
        dueDate: new Date('2024-03-31'),
      });
      service['obligations'].set(obl1.id, obl1);

      const obl2 = createMockObligation({
        id: 'obl-q2',
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        status: 'completed',
        dueDate: new Date('2024-06-30'),
      });
      service['obligations'].set(obl2.id, obl2);

      const obl3 = createMockObligation({
        id: 'obl-q3',
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        status: 'pending',
        dueDate: new Date('2024-09-30'),
      });
      service['obligations'].set(obl3.id, obl3);
    });

    it('should generate compliance report for period', async () => {
      const report = await service.generateComplianceReport(
        'tenant-123',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'entity-123'
      );

      expect(report.id).toBeDefined();
      expect(report.complianceRate).toBeCloseTo(66.67, 0); // 2 of 3 completed
    });

    it('should filter report by entity', async () => {
      // Add obligation for different entity
      const otherEntityObl = createMockObligation({
        id: 'obl-other',
        tenantId: 'tenant-123',
        entityId: 'other-entity',
        status: 'completed',
        dueDate: new Date('2024-06-15'),
      });
      service['obligations'].set(otherEntityObl.id, otherEntityObl);

      const report = await service.generateComplianceReport(
        'tenant-123',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'entity-123' // Filter to specific entity
      );

      // Should only count entity-123 obligations
      expect(report.complianceRate).toBeCloseTo(66.67, 0);
    });
  });

  describe('Multi-Entity Operations', () => {
    beforeEach(async () => {
      const requirement = createMockRequirement({ id: 'req-1' });
      service['requirements'].set(requirement.id, requirement);

      // Entity A obligations
      const oblA1 = createMockObligation({
        id: 'obl-a1',
        tenantId: 'tenant-123',
        entityId: 'entity-A',
        status: 'completed',
      });
      service['obligations'].set(oblA1.id, oblA1);

      const oblA2 = createMockObligation({
        id: 'obl-a2',
        tenantId: 'tenant-123',
        entityId: 'entity-A',
        status: 'pending',
        category: 'tax',
      });
      service['obligations'].set(oblA2.id, oblA2);

      // Entity B obligations
      const oblB1 = createMockObligation({
        id: 'obl-b1',
        tenantId: 'tenant-123',
        entityId: 'entity-B',
        status: 'in_progress',
      });
      service['obligations'].set(oblB1.id, oblB1);
    });

    it('should get obligations for specific entity', async () => {
      const entityAObligations = await service.getObligationsByEntity(
        'tenant-123',
        'entity-A'
      );

      expect(entityAObligations.length).toBe(2);
      expect(entityAObligations.every(o => o.entityId === 'entity-A')).toBe(true);
    });

    it('should filter obligations by status', async () => {
      const pendingObligations = await service.getObligationsByEntity(
        'tenant-123',
        'entity-A',
        { status: 'pending' }
      );

      expect(pendingObligations.length).toBe(1);
      expect(pendingObligations[0].status).toBe('pending');
    });

    it('should filter obligations by category', async () => {
      const taxObligations = await service.getObligationsByEntity(
        'tenant-123',
        'entity-A',
        { category: 'tax' }
      );

      expect(taxObligations.length).toBe(1);
      expect(taxObligations[0].category).toBe('tax');
    });
  });
});

describe('Domain Logic Functions', () => {
  describe('isOverdue', () => {
    it('should return true for past due dates with pending status', () => {
      const obligation = createMockObligation({
        status: 'pending',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      });

      expect(isOverdue(obligation)).toBe(true);
    });

    it('should return false for completed obligations', () => {
      const obligation = createMockObligation({
        status: 'completed',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      });

      expect(isOverdue(obligation)).toBe(false);
    });

    it('should return false for future due dates', () => {
      const obligation = createMockObligation({
        status: 'pending',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      });

      expect(isOverdue(obligation)).toBe(false);
    });
  });

  describe('getDaysUntilDue', () => {
    it('should calculate positive days for future dates', () => {
      const obligation = createMockObligation({
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      });

      const days = getDaysUntilDue(obligation);
      expect(days).toBeCloseTo(14, 0);
    });

    it('should calculate negative days for past dates', () => {
      const obligation = createMockObligation({
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      });

      const days = getDaysUntilDue(obligation);
      expect(days).toBeCloseTo(-7, 0);
    });
  });

  describe('needsAttention', () => {
    it('should return true for critical priority', () => {
      const obligation = createMockObligation({
        priority: 'critical',
        status: 'pending',
      });

      expect(needsAttention(obligation)).toBe(true);
    });

    it('should return true for overdue obligations', () => {
      const obligation = createMockObligation({
        priority: 'low',
        status: 'pending',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      expect(needsAttention(obligation)).toBe(true);
    });

    it('should return true for obligations due within 7 days', () => {
      const obligation = createMockObligation({
        priority: 'low',
        status: 'pending',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
      });

      expect(needsAttention(obligation)).toBe(true);
    });

    it('should return false for completed obligations', () => {
      const obligation = createMockObligation({
        priority: 'critical',
        status: 'completed',
      });

      expect(needsAttention(obligation)).toBe(false);
    });
  });

  describe('needsEscalation', () => {
    it('should return true for critical overdue obligations', () => {
      const obligation = createMockObligation({
        priority: 'critical',
        status: 'pending',
        escalatedAt: null,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      expect(needsEscalation(obligation)).toBe(true);
    });

    it('should return false if already escalated', () => {
      const obligation = createMockObligation({
        priority: 'critical',
        status: 'pending',
        escalatedAt: new Date(),
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      expect(needsEscalation(obligation)).toBe(false);
    });

    it('should return true for high priority with <= 3 days remaining', () => {
      const obligation = createMockObligation({
        priority: 'high',
        status: 'pending',
        escalatedAt: null,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
      });

      expect(needsEscalation(obligation)).toBe(true);
    });
  });

  describe('canTransitionTo', () => {
    it('should allow pending to in_progress', () => {
      const obligation = createMockObligation({ status: 'pending' });
      expect(canTransitionTo(obligation, 'in_progress')).toBe(true);
    });

    it('should allow in_progress to under_review', () => {
      const obligation = createMockObligation({ status: 'in_progress' });
      expect(canTransitionTo(obligation, 'under_review')).toBe(true);
    });

    it('should allow under_review to submitted', () => {
      const obligation = createMockObligation({ status: 'under_review' });
      expect(canTransitionTo(obligation, 'submitted')).toBe(true);
    });

    it('should allow submitted to completed', () => {
      const obligation = createMockObligation({ status: 'submitted' });
      expect(canTransitionTo(obligation, 'completed')).toBe(true);
    });

    it('should allow pending to waived', () => {
      const obligation = createMockObligation({ status: 'pending' });
      expect(canTransitionTo(obligation, 'waived')).toBe(true);
    });

    it('should allow failed to in_progress (retry)', () => {
      const obligation = createMockObligation({ status: 'failed' });
      expect(canTransitionTo(obligation, 'in_progress')).toBe(true);
    });

    it('should not allow completed to pending', () => {
      const obligation = createMockObligation({ status: 'completed' });
      expect(canTransitionTo(obligation, 'pending')).toBe(false);
    });
  });
});
