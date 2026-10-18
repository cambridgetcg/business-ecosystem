/**
 * Maintenance Fee Entity Unit Tests
 *
 * Tests for the MaintenanceFee domain entity that tracks patent maintenance fee obligations.
 *
 * US Patent maintenance fees are due at 3.5, 7.5, and 11.5 years after grant.
 * This entity handles fee tracking, payment recording, and status management.
 *
 * @module test/unit/domain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceFee } from '../../../src/domain/entities/maintenance-fee.entity.js';

describe('MaintenanceFee Entity', () => {
  // Helper to create dates relative to a base date
  const yearsFromNow = (years: number): Date => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + years);
    return date;
  };

  const monthsFromDate = (baseDate: Date, months: number): Date => {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + months);
    return date;
  };

  // Standard test data for a 3.5 year maintenance fee
  const createTestMaintenanceFee = (overrides: Partial<{
    patentId: string;
    feeNumber: 1 | 2 | 3;
    jurisdiction: string;
    dueDate: Date;
    windowOpensDate: Date;
    gracePeriodEndsDate: Date;
  }> = {}) => {
    const dueDate = overrides.dueDate ?? yearsFromNow(3);
    const windowOpensDate = overrides.windowOpensDate ?? yearsFromNow(2);
    const gracePeriodEndsDate = overrides.gracePeriodEndsDate ?? monthsFromDate(dueDate, 6);

    return MaintenanceFee.create({
      patentId: overrides.patentId ?? 'patent-12345678',
      feeNumber: overrides.feeNumber ?? 1,
      jurisdiction: overrides.jurisdiction,
      dueDate,
      windowOpensDate,
      gracePeriodEndsDate,
    });
  };

  // Helper to create a fee that is currently payable (window open, before due date)
  const createPayableFee = () => {
    const now = new Date();
    const windowOpensDate = new Date(now);
    windowOpensDate.setMonth(windowOpensDate.getMonth() - 1); // Window opened 1 month ago
    const dueDate = new Date(now);
    dueDate.setMonth(dueDate.getMonth() + 2); // Due in 2 months
    const gracePeriodEndsDate = monthsFromDate(dueDate, 6);

    return MaintenanceFee.create({
      patentId: 'patent-12345678',
      feeNumber: 1,
      dueDate,
      windowOpensDate,
      gracePeriodEndsDate,
    });
  };

  // Helper to create a fee in grace period (past due, within grace)
  const createGracePeriodFee = () => {
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setMonth(dueDate.getMonth() - 1); // Due 1 month ago
    const windowOpensDate = new Date(dueDate);
    windowOpensDate.setMonth(windowOpensDate.getMonth() - 6); // Window opened 6 months before due
    const gracePeriodEndsDate = monthsFromDate(dueDate, 6); // Grace ends 5 months from now

    return MaintenanceFee.create({
      patentId: 'patent-12345678',
      feeNumber: 2,
      dueDate,
      windowOpensDate,
      gracePeriodEndsDate,
    });
  };

  // Helper to create a fee that has missed the grace period
  const createMissedFee = () => {
    const now = new Date();
    const gracePeriodEndsDate = new Date(now);
    gracePeriodEndsDate.setMonth(gracePeriodEndsDate.getMonth() - 1); // Grace ended 1 month ago
    const dueDate = new Date(gracePeriodEndsDate);
    dueDate.setMonth(dueDate.getMonth() - 6); // Due 7 months ago
    const windowOpensDate = new Date(dueDate);
    windowOpensDate.setMonth(windowOpensDate.getMonth() - 6);

    return MaintenanceFee.create({
      patentId: 'patent-12345678',
      feeNumber: 3,
      dueDate,
      windowOpensDate,
      gracePeriodEndsDate,
    });
  };

  describe('create', () => {
    it('should create a maintenance fee with upcoming status', () => {
      const fee = createTestMaintenanceFee();

      expect(fee.status).toBe('upcoming');
      expect(fee.patentId).toBe('patent-12345678');
      expect(fee.feeNumber).toBe(1);
    });

    it('should generate a unique ID', () => {
      const fee1 = createTestMaintenanceFee();
      const fee2 = createTestMaintenanceFee();

      expect(fee1.id).toBeDefined();
      expect(fee2.id).toBeDefined();
      expect(fee1.id).not.toBe(fee2.id);
    });

    it('should default jurisdiction to US when not provided', () => {
      const fee = createTestMaintenanceFee();

      expect(fee.jurisdiction).toBe('US');
    });

    it('should use provided jurisdiction when specified', () => {
      const fee = createTestMaintenanceFee({ jurisdiction: 'EP' });

      expect(fee.jurisdiction).toBe('EP');
    });

    it('should initialize surchargeApplied to false', () => {
      const fee = createTestMaintenanceFee();

      expect(fee.surchargeApplied).toBe(false);
    });

    it('should have correct fee dates', () => {
      const dueDate = new Date('2027-06-15');
      const windowOpensDate = new Date('2027-01-01');
      const gracePeriodEndsDate = new Date('2027-12-15');

      const fee = createTestMaintenanceFee({
        dueDate,
        windowOpensDate,
        gracePeriodEndsDate,
      });

      expect(fee.dueDate.toISOString()).toBe(dueDate.toISOString());
      expect(fee.windowOpensDate.toISOString()).toBe(windowOpensDate.toISOString());
      expect(fee.gracePeriodEndsDate.toISOString()).toBe(gracePeriodEndsDate.toISOString());
    });

    it('should emit MaintenanceFeeCreated domain event', () => {
      const fee = createTestMaintenanceFee();

      const events = fee.domainEvents;
      const createdEvent = events.find(e => e.type === 'ip.maintenance_fee.created');

      expect(createdEvent).toBeDefined();
      expect(createdEvent?.payload).toMatchObject({
        patentId: 'patent-12345678',
        feeNumber: 1,
      });
    });

    it('should accept all valid fee numbers', () => {
      const fee1 = createTestMaintenanceFee({ feeNumber: 1 });
      const fee2 = createTestMaintenanceFee({ feeNumber: 2 });
      const fee3 = createTestMaintenanceFee({ feeNumber: 3 });

      expect(fee1.feeNumber).toBe(1);
      expect(fee2.feeNumber).toBe(2);
      expect(fee3.feeNumber).toBe(3);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a maintenance fee from persistence data', () => {
      const id = 'existing-fee-id';
      const props = {
        patentId: 'patent-98765432',
        feeNumber: 2 as const,
        jurisdiction: 'US',
        dueDate: new Date('2028-06-15'),
        windowOpensDate: new Date('2028-01-01'),
        gracePeriodEndsDate: new Date('2028-12-15'),
        status: 'paid' as const,
        paidDate: new Date('2028-05-01'),
        paidAmount: 180000, // $1,800 in cents
        surchargeApplied: false,
        entitySizeAtPayment: 'small' as const,
        receiptNumber: 'USPTO-2028-123456',
        notes: 'Paid via EFS-Web',
      };

      const fee = MaintenanceFee.reconstitute(id, props);

      expect(fee.id).toBe(id);
      expect(fee.patentId).toBe('patent-98765432');
      expect(fee.feeNumber).toBe(2);
      expect(fee.status).toBe('paid');
      expect(fee.paidAmount).toBe(180000);
      expect(fee.receiptNumber).toBe('USPTO-2028-123456');
    });

    it('should not emit domain events on reconstitute', () => {
      const fee = MaintenanceFee.reconstitute('fee-id', {
        patentId: 'patent-123',
        feeNumber: 1,
        jurisdiction: 'US',
        dueDate: new Date(),
        windowOpensDate: new Date(),
        gracePeriodEndsDate: new Date(),
        status: 'upcoming',
        surchargeApplied: false,
      });

      expect(fee.domainEvents).toHaveLength(0);
    });
  });

  describe('calculateUSMaintenanceFees', () => {
    it('should calculate three maintenance fees for a US patent', () => {
      const grantDate = new Date('2024-01-15');
      const patentId = 'patent-new-123';

      const fees = MaintenanceFee.calculateUSMaintenanceFees(patentId, grantDate);

      expect(fees).toHaveLength(3);
      expect(fees[0].feeNumber).toBe(1);
      expect(fees[1].feeNumber).toBe(2);
      expect(fees[2].feeNumber).toBe(3);
    });

    it('should set correct due dates (3.5, 7.5, 11.5 years after grant)', () => {
      const grantDate = new Date('2024-01-15');
      const fees = MaintenanceFee.calculateUSMaintenanceFees('patent-123', grantDate);

      // 3.5 year fee due date
      expect(fees[0].dueDate.getFullYear()).toBe(2027);
      expect(fees[0].dueDate.getMonth()).toBe(6); // July (0-indexed)

      // 7.5 year fee due date
      expect(fees[1].dueDate.getFullYear()).toBe(2031);
      expect(fees[1].dueDate.getMonth()).toBe(6); // July

      // 11.5 year fee due date
      expect(fees[2].dueDate.getFullYear()).toBe(2035);
      expect(fees[2].dueDate.getMonth()).toBe(6); // July
    });

    it('should set window open dates (3, 7, 11 years after grant)', () => {
      const grantDate = new Date('2024-01-15');
      const fees = MaintenanceFee.calculateUSMaintenanceFees('patent-123', grantDate);

      expect(fees[0].windowOpensDate.getFullYear()).toBe(2027);
      expect(fees[0].windowOpensDate.getMonth()).toBe(0); // January

      expect(fees[1].windowOpensDate.getFullYear()).toBe(2031);
      expect(fees[1].windowOpensDate.getMonth()).toBe(0);

      expect(fees[2].windowOpensDate.getFullYear()).toBe(2035);
      expect(fees[2].windowOpensDate.getMonth()).toBe(0);
    });

    it('should set 6-month grace periods after due dates', () => {
      const grantDate = new Date('2024-01-15');
      const fees = MaintenanceFee.calculateUSMaintenanceFees('patent-123', grantDate);

      // Grace period should be 6 months after due date
      for (const fee of fees) {
        const expectedGrace = new Date(fee.dueDate);
        expectedGrace.setMonth(expectedGrace.getMonth() + 6);
        expect(fee.gracePeriodEndsDate.getMonth()).toBe(expectedGrace.getMonth());
      }
    });

    it('should set jurisdiction to US for all fees', () => {
      const fees = MaintenanceFee.calculateUSMaintenanceFees('patent-123', new Date());

      fees.forEach(fee => {
        expect(fee.jurisdiction).toBe('US');
      });
    });

    it('should use the provided patent ID for all fees', () => {
      const patentId = 'patent-unique-456';
      const fees = MaintenanceFee.calculateUSMaintenanceFees(patentId, new Date());

      fees.forEach(fee => {
        expect(fee.patentId).toBe(patentId);
      });
    });
  });

  describe('feeLabel', () => {
    it('should return "3.5 Year" for fee number 1', () => {
      const fee = createTestMaintenanceFee({ feeNumber: 1 });
      expect(fee.feeLabel).toBe('3.5 Year');
    });

    it('should return "7.5 Year" for fee number 2', () => {
      const fee = createTestMaintenanceFee({ feeNumber: 2 });
      expect(fee.feeLabel).toBe('7.5 Year');
    });

    it('should return "11.5 Year" for fee number 3', () => {
      const fee = createTestMaintenanceFee({ feeNumber: 3 });
      expect(fee.feeLabel).toBe('11.5 Year');
    });
  });

  describe('isOverdue', () => {
    it('should return false for upcoming fees', () => {
      const fee = createTestMaintenanceFee();
      expect(fee.isOverdue).toBe(false);
    });

    it('should return true when past due date and not paid', () => {
      const fee = createGracePeriodFee();
      expect(fee.isOverdue).toBe(true);
    });

    it('should return false for paid fees even if originally overdue', () => {
      const fee = createGracePeriodFee();
      fee.pay({
        paidDate: new Date(),
        paidAmount: 200000,
        entitySize: 'large',
      });

      expect(fee.isOverdue).toBe(false);
    });

    it('should return false for missed fees', () => {
      const fee = createMissedFee();
      fee.updateStatus();

      expect(fee.isOverdue).toBe(false);
    });
  });

  describe('isInGracePeriod', () => {
    it('should return false for upcoming fees', () => {
      const fee = createTestMaintenanceFee();
      expect(fee.isInGracePeriod).toBe(false);
    });

    it('should return true when past due date but within grace period', () => {
      const fee = createGracePeriodFee();
      expect(fee.isInGracePeriod).toBe(true);
    });

    it('should return false for paid fees', () => {
      const fee = createGracePeriodFee();
      fee.pay({
        paidDate: new Date(),
        paidAmount: 200000,
        entitySize: 'large',
      });

      expect(fee.isInGracePeriod).toBe(false);
    });

    it('should return false for missed fees', () => {
      const fee = createMissedFee();
      fee.updateStatus();

      expect(fee.isInGracePeriod).toBe(false);
    });
  });

  describe('daysUntilDue', () => {
    it('should return positive number for future due dates', () => {
      const fee = createTestMaintenanceFee();
      expect(fee.daysUntilDue).toBeGreaterThan(0);
    });

    it('should return negative number for past due dates', () => {
      const fee = createGracePeriodFee();
      expect(fee.daysUntilDue).toBeLessThan(0);
    });

    it('should return approximately correct days', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 30 days from now

      const fee = createTestMaintenanceFee({
        dueDate,
        windowOpensDate: new Date(),
        gracePeriodEndsDate: monthsFromDate(dueDate, 6),
      });

      // Allow for rounding differences
      expect(fee.daysUntilDue).toBeGreaterThanOrEqual(29);
      expect(fee.daysUntilDue).toBeLessThanOrEqual(31);
    });
  });

  describe('updateStatus', () => {
    it('should transition from upcoming to payable when window opens', () => {
      const fee = createPayableFee();
      fee.updateStatus();

      expect(fee.status).toBe('payable');
    });

    it('should transition to grace_period when past due but within grace', () => {
      const fee = createGracePeriodFee();
      fee.updateStatus();

      expect(fee.status).toBe('grace_period');
    });

    it('should transition to missed when grace period expires', () => {
      const fee = createMissedFee();
      fee.pullDomainEvents(); // Clear creation event
      fee.updateStatus();

      expect(fee.status).toBe('missed');
    });

    it('should emit MaintenanceFeeMissed event when transitioning to missed', () => {
      const fee = createMissedFee();
      fee.pullDomainEvents(); // Clear creation event
      fee.updateStatus();

      const events = fee.domainEvents;
      const missedEvent = events.find(e => e.type === 'ip.maintenance_fee.missed');

      expect(missedEvent).toBeDefined();
      expect(missedEvent?.payload).toMatchObject({
        patentId: 'patent-12345678',
        feeNumber: 3,
      });
    });

    it('should not change status if already paid', () => {
      const fee = createPayableFee();
      fee.pay({
        paidDate: new Date(),
        paidAmount: 200000,
        entitySize: 'large',
      });

      fee.updateStatus();

      expect(fee.status).toBe('paid');
    });

    it('should not change status if already missed', () => {
      const fee = createMissedFee();
      fee.updateStatus();
      fee.pullDomainEvents(); // Clear events

      fee.updateStatus();

      expect(fee.status).toBe('missed');
      expect(fee.domainEvents).toHaveLength(0); // No new events
    });

    it('should increment version when status changes', () => {
      const fee = createPayableFee();
      const initialVersion = fee.version;

      fee.updateStatus('user-1');

      expect(fee.version).toBe(initialVersion + 1);
    });
  });

  describe('pay', () => {
    it('should record payment and transition to paid status', () => {
      const fee = createPayableFee();
      const paidDate = new Date();

      fee.pay({
        paidDate,
        paidAmount: 200000, // $2,000 in cents (large entity)
        entitySize: 'large',
        receiptNumber: 'USPTO-2026-789012',
        notes: 'Paid via EFS-Web',
      });

      expect(fee.status).toBe('paid');
      expect(fee.paidDate?.toISOString()).toBe(paidDate.toISOString());
      expect(fee.paidAmount).toBe(200000);
      expect(fee.entitySizeAtPayment).toBe('large');
      expect(fee.receiptNumber).toBe('USPTO-2026-789012');
      expect(fee.notes).toBe('Paid via EFS-Web');
    });

    it('should set surchargeApplied to false when paid before due date', () => {
      const fee = createPayableFee();
      const paidDate = new Date(); // Current date is before due date

      fee.pay({
        paidDate,
        paidAmount: 200000,
        entitySize: 'large',
      });

      expect(fee.surchargeApplied).toBe(false);
    });

    it('should set surchargeApplied to true when paid after due date', () => {
      const fee = createGracePeriodFee();
      const paidDate = new Date(); // Current date is after due date

      fee.pay({
        paidDate,
        paidAmount: 240000, // Includes surcharge
        entitySize: 'large',
      });

      expect(fee.surchargeApplied).toBe(true);
    });

    it('should emit MaintenanceFeePaid event', () => {
      const fee = createPayableFee();
      fee.pullDomainEvents(); // Clear creation event

      const paidDate = new Date();
      fee.pay({
        paidDate,
        paidAmount: 100000, // $1,000 (small entity)
        entitySize: 'small',
      });

      const events = fee.domainEvents;
      const paidEvent = events.find(e => e.type === 'ip.maintenance_fee.paid');

      expect(paidEvent).toBeDefined();
      expect(paidEvent?.payload).toMatchObject({
        patentId: 'patent-12345678',
        feeNumber: 1,
        paidAmount: 100000,
        entitySize: 'small',
        surchargeApplied: false,
      });
    });

    it('should throw if already paid', () => {
      const fee = createPayableFee();
      fee.pay({
        paidDate: new Date(),
        paidAmount: 200000,
        entitySize: 'large',
      });

      expect(() => fee.pay({
        paidDate: new Date(),
        paidAmount: 200000,
        entitySize: 'large',
      })).toThrow('Maintenance fee has already been paid');
    });

    it('should throw if fee status is missed', () => {
      const fee = createMissedFee();
      fee.updateStatus();

      expect(() => fee.pay({
        paidDate: new Date(),
        paidAmount: 200000,
        entitySize: 'large',
      })).toThrow('Cannot pay a missed maintenance fee - patent may have lapsed');
    });

    it('should accept all entity sizes', () => {
      const fee1 = createPayableFee();
      fee1.pay({ paidDate: new Date(), paidAmount: 200000, entitySize: 'large' });
      expect(fee1.entitySizeAtPayment).toBe('large');

      const fee2 = createPayableFee();
      fee2.pay({ paidDate: new Date(), paidAmount: 100000, entitySize: 'small' });
      expect(fee2.entitySizeAtPayment).toBe('small');

      const fee3 = createPayableFee();
      fee3.pay({ paidDate: new Date(), paidAmount: 50000, entitySize: 'micro' });
      expect(fee3.entitySizeAtPayment).toBe('micro');
    });

    it('should be optional to provide receipt number and notes', () => {
      const fee = createPayableFee();

      fee.pay({
        paidDate: new Date(),
        paidAmount: 200000,
        entitySize: 'large',
      });

      expect(fee.receiptNumber).toBeUndefined();
      expect(fee.notes).toBeUndefined();
    });

    it('should increment version when paid', () => {
      const fee = createPayableFee();
      const initialVersion = fee.version;

      fee.pay({
        paidDate: new Date(),
        paidAmount: 200000,
        entitySize: 'large',
      }, 'user-1');

      expect(fee.version).toBe(initialVersion + 1);
    });
  });

  describe('addNotes', () => {
    it('should add notes when none exist', () => {
      const fee = createTestMaintenanceFee();

      fee.addNotes('Initial note about this fee', 'user-1');

      expect(fee.notes).toBe('Initial note about this fee');
    });

    it('should append notes when notes already exist', () => {
      const fee = createTestMaintenanceFee();
      fee.addNotes('First note', 'user-1');
      fee.addNotes('Second note', 'user-1');

      expect(fee.notes).toBe('First note\nSecond note');
    });

    it('should increment version when notes are added', () => {
      const fee = createTestMaintenanceFee();
      const initialVersion = fee.version;

      fee.addNotes('A note', 'user-1');

      expect(fee.version).toBe(initialVersion + 1);
    });
  });

  describe('getters', () => {
    it('should return all properties correctly', () => {
      const dueDate = new Date('2027-07-15');
      const windowOpensDate = new Date('2027-01-15');
      const gracePeriodEndsDate = new Date('2028-01-15');

      const fee = createTestMaintenanceFee({
        patentId: 'patent-getter-test',
        feeNumber: 2,
        jurisdiction: 'US',
        dueDate,
        windowOpensDate,
        gracePeriodEndsDate,
      });

      expect(fee.patentId).toBe('patent-getter-test');
      expect(fee.feeNumber).toBe(2);
      expect(fee.jurisdiction).toBe('US');
      expect(fee.dueDate).toEqual(dueDate);
      expect(fee.windowOpensDate).toEqual(windowOpensDate);
      expect(fee.gracePeriodEndsDate).toEqual(gracePeriodEndsDate);
      expect(fee.status).toBe('upcoming');
      expect(fee.surchargeApplied).toBe(false);
      expect(fee.paidDate).toBeUndefined();
      expect(fee.paidAmount).toBeUndefined();
      expect(fee.entitySizeAtPayment).toBeUndefined();
      expect(fee.receiptNumber).toBeUndefined();
      expect(fee.notes).toBeUndefined();
    });
  });

  describe('domain events', () => {
    it('should allow pulling events (clearing internal list)', () => {
      const fee = createTestMaintenanceFee();

      const events = fee.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('ip.maintenance_fee.created');
      expect(fee.domainEvents).toHaveLength(0); // Events cleared
    });

    it('should emit multiple events in sequence', () => {
      const fee = createPayableFee();
      fee.pullDomainEvents(); // Clear creation event

      fee.updateStatus(); // Should transition to payable (no event)
      fee.pay({
        paidDate: new Date(),
        paidAmount: 200000,
        entitySize: 'large',
      });

      const events = fee.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('ip.maintenance_fee.paid');
    });
  });

  describe('US fee schedule integration', () => {
    it('should handle a complete patent lifecycle fee schedule', () => {
      const grantDate = new Date('2024-01-15');
      const patentId = 'patent-lifecycle-test';

      // Calculate all maintenance fees
      const feeInputs = MaintenanceFee.calculateUSMaintenanceFees(patentId, grantDate);

      // Create fee entities
      const fees = feeInputs.map(input => MaintenanceFee.create(input));

      expect(fees).toHaveLength(3);

      // Verify fee labels
      expect(fees[0].feeLabel).toBe('3.5 Year');
      expect(fees[1].feeLabel).toBe('7.5 Year');
      expect(fees[2].feeLabel).toBe('11.5 Year');

      // All should start as upcoming
      fees.forEach(fee => {
        expect(fee.status).toBe('upcoming');
      });
    });

    it('should correctly handle micro entity fee payment', () => {
      const fee = createPayableFee();

      // US micro entity pays 25% of large entity fee
      // For 3.5 year fee: Large = $2,000, Micro = $500
      fee.pay({
        paidDate: new Date(),
        paidAmount: 50000, // $500 in cents
        entitySize: 'micro',
        receiptNumber: 'USPTO-MICRO-2026-001',
        notes: 'Micro entity status confirmed via USPTO form',
      });

      expect(fee.entitySizeAtPayment).toBe('micro');
      expect(fee.paidAmount).toBe(50000);
    });

    it('should correctly handle grace period surcharge scenario', () => {
      const fee = createGracePeriodFee();

      // Pay during grace period (surcharge applies)
      // Large entity with surcharge: $2,000 + $160 = $2,160
      fee.pay({
        paidDate: new Date(),
        paidAmount: 216000, // $2,160 in cents
        entitySize: 'large',
        notes: 'Late payment with surcharge',
      });

      expect(fee.surchargeApplied).toBe(true);
      expect(fee.paidAmount).toBe(216000);
    });
  });
});
