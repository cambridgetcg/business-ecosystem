import { describe, it, expect } from 'vitest';
import {
  generateCalendarEvents,
  calculateComplianceRate,
  determineRiskLevel,
  getNextOccurrence,
} from '../../src/domain/entities/compliance-calendar.js';

describe('Compliance Calendar Domain Logic', () => {
  describe('generateCalendarEvents', () => {
    it('should generate deadline event for obligation', () => {
      const obligation = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        entityId: '00000000-0000-0000-0000-000000000003',
        title: 'VAT Return Q1',
        regulator: 'hmrc',
        category: 'vat',
        dueDate: new Date('2024-05-07'),
      };

      const events = generateCalendarEvents(obligation);

      expect(events.length).toBeGreaterThan(0);

      const deadlineEvent = events.find(e => e.eventType === 'deadline');
      expect(deadlineEvent).toBeDefined();
      expect(deadlineEvent?.title).toContain('DEADLINE');
      expect(deadlineEvent?.title).toContain('VAT Return Q1');
      expect(deadlineEvent?.obligationId).toBe(obligation.id);
    });

    it('should generate reminder events', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      const obligation = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        entityId: '00000000-0000-0000-0000-000000000003',
        title: 'Annual Accounts',
        regulator: 'companies_house',
        category: 'company_filing',
        dueDate: futureDate,
      };

      const events = generateCalendarEvents(obligation, [30, 14, 7, 1]);

      const reminderEvents = events.filter(e => e.eventType === 'reminder');
      expect(reminderEvents.length).toBeGreaterThan(0);
      expect(reminderEvents[0].title).toContain('REMINDER');
    });

    it('should not generate reminders for past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const obligation = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        entityId: '00000000-0000-0000-0000-000000000003',
        title: 'Past Obligation',
        regulator: 'hmrc',
        category: 'vat',
        dueDate: pastDate,
      };

      const events = generateCalendarEvents(obligation, [30, 14, 7, 1]);

      // Should only have the deadline event, no reminders
      const reminderEvents = events.filter(e => e.eventType === 'reminder');
      expect(reminderEvents.length).toBe(0);
    });

    it('should use custom reminder days', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 100);

      const obligation = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        entityId: '00000000-0000-0000-0000-000000000003',
        title: 'Custom Reminders',
        regulator: 'hmrc',
        category: 'corporation_tax',
        dueDate: futureDate,
      };

      const events = generateCalendarEvents(obligation, [60, 30]);

      const reminderEvents = events.filter(e => e.eventType === 'reminder');
      expect(reminderEvents.length).toBe(2);
    });
  });

  describe('calculateComplianceRate', () => {
    it('should return 100 when all obligations completed', () => {
      expect(calculateComplianceRate(10, 10)).toBe(100);
    });

    it('should return 0 when no obligations completed', () => {
      expect(calculateComplianceRate(0, 10)).toBe(0);
    });

    it('should return 100 when no obligations exist', () => {
      expect(calculateComplianceRate(0, 0)).toBe(100);
    });

    it('should calculate correct percentage', () => {
      expect(calculateComplianceRate(7, 10)).toBe(70);
      expect(calculateComplianceRate(3, 4)).toBe(75);
    });

    it('should round to one decimal place', () => {
      expect(calculateComplianceRate(1, 3)).toBe(33.3);
      expect(calculateComplianceRate(2, 3)).toBe(66.7);
    });
  });

  describe('determineRiskLevel', () => {
    it('should return critical when there are critical overdue items', () => {
      expect(determineRiskLevel(90, 2, 1)).toBe('critical');
    });

    it('should return high when more than 5 overdue or rate below 70', () => {
      expect(determineRiskLevel(60, 3, 0)).toBe('high');
      expect(determineRiskLevel(80, 6, 0)).toBe('high');
    });

    it('should return medium when some overdue or rate below 90', () => {
      expect(determineRiskLevel(85, 2, 0)).toBe('medium');
      expect(determineRiskLevel(75, 1, 0)).toBe('medium');
    });

    it('should return low when no overdue and rate at 90 or above', () => {
      expect(determineRiskLevel(95, 0, 0)).toBe('low');
      expect(determineRiskLevel(100, 0, 0)).toBe('low');
    });
  });

  describe('getNextOccurrence', () => {
    it('should return next month for monthly frequency', () => {
      const after = new Date('2024-06-15');
      const next = getNextOccurrence('FREQ=MONTHLY', after);

      expect(next).not.toBeNull();
      expect(next?.getMonth()).toBe(6); // July (0-indexed)
    });

    it('should return next quarter for quarterly frequency', () => {
      const after = new Date('2024-03-15');
      const next = getNextOccurrence('FREQ=QUARTERLY', after);

      expect(next).not.toBeNull();
      expect(next?.getMonth()).toBe(5); // June (0-indexed)
      expect(next?.getDate()).toBe(15);
    });

    it('should return next year for yearly frequency', () => {
      const after = new Date('2024-12-31');
      const next = getNextOccurrence('FREQ=YEARLY', after);

      expect(next).not.toBeNull();
      expect(next?.getFullYear()).toBe(2025);
    });

    it('should return null for unsupported frequency', () => {
      const after = new Date('2024-06-15');
      const next = getNextOccurrence('FREQ=WEEKLY', after);

      expect(next).toBeNull();
    });
  });
});
