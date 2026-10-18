/**
 * Deadline Calculator Unit Tests
 *
 * Tests for the DeadlineCalculator domain service.
 *
 * @module test/unit/domain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DeadlineCalculator,
  US_MAINTENANCE_WINDOWS,
  US_MAINTENANCE_FEES,
} from '../../../src/domain/services/deadline-calculator.service.js';

describe('DeadlineCalculator', () => {
  let calculator: DeadlineCalculator;

  beforeEach(() => {
    calculator = new DeadlineCalculator();
  });

  describe('calculatePatentMaintenanceDeadlines', () => {
    it('should create three maintenance fee deadlines for US patents', () => {
      const grantDate = new Date('2024-01-15');
      const deadlines = calculator.calculatePatentMaintenanceDeadlines(grantDate, 'US', 'large');

      expect(deadlines).toHaveLength(3);
      expect(deadlines[0].deadlineType).toBe('patent_maintenance_fee');
      expect(deadlines[0].title).toContain('3.5 Year');
      expect(deadlines[1].title).toContain('7.5 Year');
      expect(deadlines[2].title).toContain('11.5 Year');
    });

    it('should calculate correct due dates based on grant date', () => {
      const grantDate = new Date('2024-01-15');
      const deadlines = calculator.calculatePatentMaintenanceDeadlines(grantDate, 'US', 'large');

      // 3.5 years = 3 years 6 months
      const firstDue = deadlines[0].dueDate;
      expect(firstDue.getFullYear()).toBe(2027);
      expect(firstDue.getMonth()).toBe(6); // July (0-indexed)
    });

    it('should apply entity size fee multiplier', () => {
      const grantDate = new Date('2024-01-15');

      const largeDeadlines = calculator.calculatePatentMaintenanceDeadlines(grantDate, 'US', 'large');
      const smallDeadlines = calculator.calculatePatentMaintenanceDeadlines(grantDate, 'US', 'small');
      const microDeadlines = calculator.calculatePatentMaintenanceDeadlines(grantDate, 'US', 'micro');

      expect(largeDeadlines[0].amount).toBe(US_MAINTENANCE_FEES.FIRST.amount);
      expect(smallDeadlines[0].amount).toBe(US_MAINTENANCE_FEES.FIRST.amount * 0.5);
      expect(microDeadlines[0].amount).toBe(US_MAINTENANCE_FEES.FIRST.amount * 0.25);
    });

    it('should return empty array for non-US patents', () => {
      const grantDate = new Date('2024-01-15');
      const deadlines = calculator.calculatePatentMaintenanceDeadlines(grantDate, 'EP', 'large');

      expect(deadlines).toHaveLength(0);
    });

    it('should set priority to high for all maintenance fees', () => {
      const grantDate = new Date('2024-01-15');
      const deadlines = calculator.calculatePatentMaintenanceDeadlines(grantDate, 'US', 'large');

      deadlines.forEach(deadline => {
        expect(deadline.priority).toBe('high');
      });
    });
  });

  describe('calculateTrademarkMaintenanceDeadlines', () => {
    it('should create Section 8, 9, and 15 deadlines for US trademarks', () => {
      const registrationDate = new Date('2024-01-15');
      const deadlines = calculator.calculateTrademarkMaintenanceDeadlines(registrationDate, 'US');

      expect(deadlines).toHaveLength(3);

      const types = deadlines.map(d => d.deadlineType);
      expect(types).toContain('trademark_section_8');
      expect(types).toContain('trademark_section_9');
      expect(types).toContain('trademark_section_15');
    });

    it('should create single renewal deadline for non-US trademarks', () => {
      const registrationDate = new Date('2024-01-15');
      const deadlines = calculator.calculateTrademarkMaintenanceDeadlines(registrationDate, 'EU');

      expect(deadlines).toHaveLength(1);
      expect(deadlines[0].deadlineType).toBe('trademark_renewal');
    });

    it('should set Section 8 as critical priority', () => {
      const registrationDate = new Date('2024-01-15');
      const deadlines = calculator.calculateTrademarkMaintenanceDeadlines(registrationDate, 'US');

      const section8 = deadlines.find(d => d.deadlineType === 'trademark_section_8');
      expect(section8?.priority).toBe('critical');
    });

    it('should calculate Section 8 due date at 5 years', () => {
      const registrationDate = new Date('2024-01-15');
      const deadlines = calculator.calculateTrademarkMaintenanceDeadlines(registrationDate, 'US');

      const section8 = deadlines.find(d => d.deadlineType === 'trademark_section_8');
      expect(section8?.dueDate.getFullYear()).toBe(2029);
    });
  });

  describe('calculateDomainExpirationDeadline', () => {
    it('should create deadline with correct domain name', () => {
      const expirationDate = new Date('2025-06-15');
      const deadline = calculator.calculateDomainExpirationDeadline(
        expirationDate,
        'example.com',
        'GoDaddy'
      );

      expect(deadline.deadlineType).toBe('domain_expiration');
      expect(deadline.title).toContain('example.com');
      expect(deadline.description).toContain('GoDaddy');
    });

    it('should set priority to high', () => {
      const expirationDate = new Date('2025-06-15');
      const deadline = calculator.calculateDomainExpirationDeadline(
        expirationDate,
        'example.com',
        'GoDaddy'
      );

      expect(deadline.priority).toBe('high');
    });
  });

  describe('calculateUDRPResponseDeadline', () => {
    it('should create deadline 20 days from filing', () => {
      const filingDate = new Date('2024-06-01');
      const deadline = calculator.calculateUDRPResponseDeadline(filingDate);

      const expectedDue = new Date('2024-06-21');
      expect(deadline.dueDate.toDateString()).toBe(expectedDue.toDateString());
    });

    it('should set critical priority', () => {
      const filingDate = new Date('2024-06-01');
      const deadline = calculator.calculateUDRPResponseDeadline(filingDate);

      expect(deadline.priority).toBe('critical');
    });
  });

  describe('calculateOppositionResponseDeadline', () => {
    it('should create deadline 40 days from filing for US', () => {
      const filingDate = new Date('2024-06-01');
      const deadline = calculator.calculateOppositionResponseDeadline(filingDate, 'US');

      const expectedDue = new Date('2024-07-11');
      expect(deadline.dueDate.toDateString()).toBe(expectedDue.toDateString());
    });

    it('should create deadline 30 days from filing for non-US', () => {
      const filingDate = new Date('2024-06-01');
      const deadline = calculator.calculateOppositionResponseDeadline(filingDate, 'EU');

      const expectedDue = new Date('2024-07-01');
      expect(deadline.dueDate.toDateString()).toBe(expectedDue.toDateString());
    });
  });

  describe('calculateReminderDates', () => {
    it('should return dates in chronological order', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 100);

      const reminders = calculator.calculateReminderDates(dueDate);

      for (let i = 1; i < reminders.length; i++) {
        expect(reminders[i].getTime()).toBeGreaterThan(reminders[i - 1].getTime());
      }
    });

    it('should filter out past dates', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 10);

      const reminders = calculator.calculateReminderDates(dueDate);

      const now = new Date();
      reminders.forEach(date => {
        expect(date.getTime()).toBeGreaterThan(now.getTime());
      });
    });

    it('should use custom reminder days if provided', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 50);

      const reminders = calculator.calculateReminderDates(dueDate, [30, 15, 7]);

      expect(reminders.length).toBeLessThanOrEqual(3);
    });
  });

  describe('calculatePriorityFromDaysRemaining', () => {
    it('should return critical for 7 days or less', () => {
      expect(calculator.calculatePriorityFromDaysRemaining(7)).toBe('critical');
      expect(calculator.calculatePriorityFromDaysRemaining(3)).toBe('critical');
      expect(calculator.calculatePriorityFromDaysRemaining(1)).toBe('critical');
    });

    it('should return high for 8-30 days', () => {
      expect(calculator.calculatePriorityFromDaysRemaining(30)).toBe('high');
      expect(calculator.calculatePriorityFromDaysRemaining(14)).toBe('high');
      expect(calculator.calculatePriorityFromDaysRemaining(8)).toBe('high');
    });

    it('should return medium for 31-90 days', () => {
      expect(calculator.calculatePriorityFromDaysRemaining(90)).toBe('medium');
      expect(calculator.calculatePriorityFromDaysRemaining(60)).toBe('medium');
      expect(calculator.calculatePriorityFromDaysRemaining(31)).toBe('medium');
    });

    it('should return low for more than 90 days', () => {
      expect(calculator.calculatePriorityFromDaysRemaining(91)).toBe('low');
      expect(calculator.calculatePriorityFromDaysRemaining(180)).toBe('low');
    });
  });

  describe('daysUntilDeadline', () => {
    it('should return positive days for future deadlines', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const days = calculator.daysUntilDeadline(futureDate);

      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThanOrEqual(31);
    });

    it('should return negative days for past deadlines', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const days = calculator.daysUntilDeadline(pastDate);

      expect(days).toBeLessThan(0);
    });
  });

  describe('isOverdue', () => {
    it('should return true for past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      expect(calculator.isOverdue(pastDate)).toBe(true);
    });

    it('should return false for future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      expect(calculator.isOverdue(futureDate)).toBe(false);
    });
  });
});
