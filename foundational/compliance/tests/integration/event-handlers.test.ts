/**
 * Event Handlers Integration Tests
 *
 * Tests for cross-service event consumption and compliance state updates.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockComplianceService,
  createMockRequirement,
  createMockObligation,
  createDomainEvent,
  clearMocks,
} from './setup.js';
import {
  handleJournalEntryPosted,
  handleFiscalPeriodClosed,
  handleTaxFilingSubmitted,
} from '../../src/infrastructure/messaging/event-handlers.js';

describe('Event Handlers Integration', () => {
  let service: MockComplianceService;

  beforeEach(() => {
    service = new MockComplianceService();
    clearMocks();
  });

  afterEach(() => {
    clearMocks();
  });

  describe('handleJournalEntryPosted', () => {
    it('should log journal entry events', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const event = createDomainEvent('accounting.journal_entry.posted', {
        entry_id: 'entry-123',
        entry_number: 'JE-001',
        total_debits: 1000,
        total_credits: 1000,
        description: 'Regular journal entry',
      });

      await handleJournalEntryPosted(event, service as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Received journal entry posted event'),
        expect.objectContaining({ entry_id: 'entry-123' })
      );

      consoleSpy.mockRestore();
    });

    it('should detect tax-related journal entries', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const event = createDomainEvent('accounting.journal_entry.posted', {
        entry_id: 'entry-124',
        entry_number: 'JE-002',
        total_debits: 5000,
        total_credits: 5000,
        description: 'VAT provision for Q4',
      });

      await handleJournalEntryPosted(event, service as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('may relate to tax compliance'),
        expect.objectContaining({ entry_id: 'entry-124' })
      );

      consoleSpy.mockRestore();
    });

    it('should detect corporation tax entries', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const event = createDomainEvent('accounting.journal_entry.posted', {
        entry_id: 'entry-125',
        entry_number: 'JE-003',
        total_debits: 25000,
        total_credits: 25000,
        description: 'Corporation Tax provision FY2024',
      });

      await handleJournalEntryPosted(event, service as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('may relate to tax compliance'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('handleFiscalPeriodClosed', () => {
    beforeEach(async () => {
      // Set up requirements and obligations
      const requirement = createMockRequirement({ id: 'req-1' });
      service['requirements'].set(requirement.id, requirement);

      // Create some obligations - one completed, one overdue
      const completedObl = createMockObligation({
        id: 'obl-completed',
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        requirementId: 'req-1',
        status: 'completed',
        dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      });
      service['obligations'].set(completedObl.id, completedObl);

      const overdueObl = createMockObligation({
        id: 'obl-overdue',
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        requirementId: 'req-1',
        status: 'pending',
        title: 'Overdue Filing',
        dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      });
      service['obligations'].set(overdueObl.id, overdueObl);

      const upcomingObl = createMockObligation({
        id: 'obl-upcoming',
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        requirementId: 'req-1',
        status: 'pending',
        dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
      });
      service['obligations'].set(upcomingObl.id, upcomingObl);
    });

    it('should generate compliance report on period close', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const event = createDomainEvent('accounting.fiscal_period.closed', {
        period_id: 'period-2024',
        period_key: '2024-FY',
        fiscal_year: 2024,
        total_entries: 1250,
        tenant_id: 'tenant-123',
        entity_id: 'entity-123',
        period_end_date: new Date().toISOString(),
      });

      await handleFiscalPeriodClosed(event, service as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Generated compliance report'),
        expect.stringContaining('period-2024') || expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    it('should create findings for overdue obligations', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const event = createDomainEvent('accounting.fiscal_period.closed', {
        period_id: 'period-2024',
        period_key: '2024-FY',
        fiscal_year: 2024,
        total_entries: 1250,
        tenant_id: 'tenant-123',
        entity_id: 'entity-123',
        period_end_date: new Date().toISOString(),
      });

      await handleFiscalPeriodClosed(event, service as any);

      // Check that findings were created for overdue obligations
      const findings = service._getFindings();
      const findingsList = Array.from(findings.values());

      expect(findingsList.length).toBeGreaterThan(0);
      expect(findingsList[0].title).toContain('Overdue Compliance');
    });

    it('should log upcoming deadlines count', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const event = createDomainEvent('accounting.fiscal_period.closed', {
        period_id: 'period-2024',
        period_key: '2024-FY',
        fiscal_year: 2024,
        total_entries: 1250,
        tenant_id: 'tenant-123',
        entity_id: 'entity-123',
        period_end_date: new Date().toISOString(),
      });

      await handleFiscalPeriodClosed(event, service as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('compliance deadlines in next 90 days')
      );

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create a service that throws on generateComplianceReport
      const failingService = {
        ...service,
        generateComplianceReport: vi.fn().mockRejectedValue(new Error('Database error')),
      };

      const event = createDomainEvent('accounting.fiscal_period.closed', {
        period_id: 'period-2024',
        period_key: '2024-FY',
        fiscal_year: 2024,
        tenant_id: 'tenant-123',
      });

      await handleFiscalPeriodClosed(event, failingService as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process fiscal period close'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('handleTaxFilingSubmitted', () => {
    beforeEach(async () => {
      const requirement = createMockRequirement({
        id: 'req-tax',
        regulator: 'hmrc',
        category: 'tax',
      });
      service['requirements'].set(requirement.id, requirement);

      // Create pending VAT obligation
      const vatObligation = createMockObligation({
        id: 'obl-vat',
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        requirementId: 'req-tax',
        title: 'VAT Return Q4 2024',
        category: 'tax',
        status: 'pending',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      service['obligations'].set(vatObligation.id, vatObligation);

      // Create pending CT600 obligation
      const ct600Obligation = createMockObligation({
        id: 'obl-ct600',
        tenantId: 'tenant-123',
        entityId: 'entity-123',
        requirementId: 'req-tax',
        title: 'CT600 Corporation Tax Return',
        category: 'tax',
        status: 'pending',
        dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
      service['obligations'].set(ct600Obligation.id, ct600Obligation);
    });

    it('should update VAT obligation to submitted status', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const event = createDomainEvent('tax.filing.submitted', {
        filing_id: 'filing-123',
        tax_type: 'VAT',
        period: '2024-Q4',
        submission_reference: 'HMRC-VAT-123456',
        entity_id: 'entity-123',
        tenant_id: 'tenant-123',
      });

      await handleTaxFilingSubmitted(event, service as any);

      const obligation = await service.getObligation('obl-vat');
      expect(obligation?.status).toBe('submitted');
      expect(obligation?.metadata).toHaveProperty('filingId', 'filing-123');
      expect(obligation?.metadata).toHaveProperty('submissionReference', 'HMRC-VAT-123456');

      consoleSpy.mockRestore();
    });

    it('should update CT600 obligation when corporation tax filed', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const event = createDomainEvent('tax.filing.submitted', {
        filing_id: 'filing-456',
        tax_type: 'Corporation Tax',
        period: '2024',
        submission_reference: 'HMRC-CT-789012',
        entity_id: 'entity-123',
        tenant_id: 'tenant-123',
      });

      await handleTaxFilingSubmitted(event, service as any);

      const obligation = await service.getObligation('obl-ct600');
      expect(obligation?.status).toBe('submitted');
      expect(obligation?.metadata).toHaveProperty('filingId', 'filing-456');

      consoleSpy.mockRestore();
    });

    it('should log when no matching obligation found', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const event = createDomainEvent('tax.filing.submitted', {
        filing_id: 'filing-789',
        tax_type: 'PAYE',
        period: '2024-12',
        submission_reference: 'HMRC-PAYE-345678',
        entity_id: 'entity-123',
        tenant_id: 'tenant-123',
      });

      await handleTaxFilingSubmitted(event, service as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No matching obligation found'),
        expect.any(String) || undefined
      );

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const failingService = {
        ...service,
        getObligationsByEntity: vi.fn().mockRejectedValue(new Error('Database error')),
      };

      const event = createDomainEvent('tax.filing.submitted', {
        filing_id: 'filing-error',
        tax_type: 'VAT',
        period: '2024-Q4',
        entity_id: 'entity-123',
        tenant_id: 'tenant-123',
      });

      await handleTaxFilingSubmitted(event, failingService as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update tax filing obligation'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('Event Handler Edge Cases', () => {
  let service: MockComplianceService;

  beforeEach(() => {
    service = new MockComplianceService();
    clearMocks();
  });

  it('should use correlation_id as tenant when tenant_id missing', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const event = createDomainEvent('accounting.fiscal_period.closed', {
      period_id: 'period-123',
      period_key: '2024-FY',
      fiscal_year: 2024,
      // No tenant_id provided
    }, {
      correlation_id: 'tenant-from-correlation',
    });

    await handleFiscalPeriodClosed(event, service as any);

    // Should complete without error using correlation_id
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should handle missing period_end_date', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const event = createDomainEvent('accounting.fiscal_period.closed', {
      period_id: 'period-123',
      period_key: '2024-FY',
      fiscal_year: 2024,
      tenant_id: 'tenant-123',
      // No period_end_date - should default to now
    });

    await handleFiscalPeriodClosed(event, service as any);

    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should handle empty description in journal entry', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const event = createDomainEvent('accounting.journal_entry.posted', {
      entry_id: 'entry-empty',
      entry_number: 'JE-EMPTY',
      // No description
    });

    await handleJournalEntryPosted(event, service as any);

    // Should complete without error
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Received journal entry posted event'),
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });
});

describe('Cross-Service Event Flows', () => {
  let service: MockComplianceService;

  beforeEach(async () => {
    service = new MockComplianceService();
    clearMocks();

    // Set up full test scenario
    const requirement = createMockRequirement({
      id: 'req-accounts',
      regulator: 'companies_house',
      category: 'corporate_filing',
    });
    service['requirements'].set(requirement.id, requirement);

    const taxRequirement = createMockRequirement({
      id: 'req-tax',
      regulator: 'hmrc',
      category: 'tax',
    });
    service['requirements'].set(taxRequirement.id, taxRequirement);
  });

  it('should handle complete fiscal close flow', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create obligations
    const obl1 = createMockObligation({
      id: 'obl-1',
      tenantId: 'tenant-123',
      entityId: 'entity-123',
      requirementId: 'req-accounts',
      status: 'completed',
      dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });
    service['obligations'].set(obl1.id, obl1);

    const obl2 = createMockObligation({
      id: 'obl-2',
      tenantId: 'tenant-123',
      entityId: 'entity-123',
      requirementId: 'req-accounts',
      status: 'pending',
      dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Overdue
      title: 'Overdue Filing',
    });
    service['obligations'].set(obl2.id, obl2);

    // Trigger fiscal period close
    const event = createDomainEvent('accounting.fiscal_period.closed', {
      period_id: 'period-2024',
      period_key: '2024-FY',
      fiscal_year: 2024,
      tenant_id: 'tenant-123',
      entity_id: 'entity-123',
      period_end_date: new Date().toISOString(),
    });

    await handleFiscalPeriodClosed(event, service as any);

    // Should have created findings for overdue obligations
    const findings = Array.from(service._getFindings().values());
    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain('Overdue Compliance');
    expect(findings[0].severity).toBe('medium');
  });

  it('should handle tax filing followed by period close', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create tax obligation
    const taxObl = createMockObligation({
      id: 'obl-tax',
      tenantId: 'tenant-123',
      entityId: 'entity-123',
      requirementId: 'req-tax',
      title: 'VAT Return',
      category: 'tax',
      status: 'pending',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    service['obligations'].set(taxObl.id, taxObl);

    // File the tax return
    const filingEvent = createDomainEvent('tax.filing.submitted', {
      filing_id: 'filing-123',
      tax_type: 'VAT',
      period: '2024-Q4',
      submission_reference: 'HMRC-123',
      entity_id: 'entity-123',
      tenant_id: 'tenant-123',
    });

    await handleTaxFilingSubmitted(filingEvent, service as any);

    // Verify obligation updated
    const updatedObl = await service.getObligation('obl-tax');
    expect(updatedObl?.status).toBe('submitted');

    // Now close the period
    const closeEvent = createDomainEvent('accounting.fiscal_period.closed', {
      period_id: 'period-2024',
      period_key: '2024-FY',
      fiscal_year: 2024,
      tenant_id: 'tenant-123',
      period_end_date: new Date().toISOString(),
    });

    await handleFiscalPeriodClosed(closeEvent, service as any);

    // No findings should be created since the obligation was submitted
    const overdueObligations = await service.getOverdueObligations('tenant-123');
    expect(overdueObligations.length).toBe(0);
  });
});
