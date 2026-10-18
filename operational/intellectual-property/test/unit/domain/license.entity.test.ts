/**
 * License Entity Unit Tests
 *
 * Tests for the License domain entity.
 *
 * @module test/unit/domain
 */

import { describe, it, expect } from 'vitest';
import { License } from '../../../src/domain/entities/license.entity.js';

describe('License Entity', () => {
  const createTestLicense = (overrides: Partial<Parameters<typeof License.create>[0]> = {}) =>
    License.create({
      licenseNumber: 'LIC-2024-001',
      ipType: 'patent',
      ipAssetId: 'patent-123',
      licenseType: 'exclusive',
      licensorId: 'entity-001',
      licenseeId: 'entity-002',
      effectiveDate: new Date('2024-01-01'),
      expirationDate: new Date('2029-01-01'),
      territory: {
        worldwide: true,
      },
      royaltyTerms: {
        type: 'percentage',
        rate: 5,
        paymentFrequency: 'quarterly',
        currency: 'USD',
      },
      canSublicense: false,
      ...overrides,
    });

  describe('create', () => {
    it('should create a license with draft status', () => {
      const license = createTestLicense();

      expect(license.status).toBe('draft');
      expect(license.licenseNumber).toBe('LIC-2024-001');
      expect(license.ipType).toBe('patent');
    });

    it('should generate a unique ID', () => {
      const license1 = createTestLicense();
      const license2 = createTestLicense();

      expect(license1.id).toBeDefined();
      expect(license2.id).toBeDefined();
      expect(license1.id).not.toBe(license2.id);
    });

    it('should have correct license type', () => {
      const license = createTestLicense({ licenseType: 'non_exclusive' });

      expect(license.licenseType).toBe('non_exclusive');
    });

    it('should have correct territory restriction', () => {
      const license = createTestLicense({
        territory: {
          worldwide: false,
          includedCountries: ['US', 'CA', 'GB'],
        },
      });

      expect(license.territory.worldwide).toBe(false);
      expect(license.territory.includedCountries).toContain('US');
      expect(license.territory.includedCountries).toHaveLength(3);
    });

    it('should have correct royalty terms', () => {
      const license = createTestLicense();

      expect(license.royaltyTerms.type).toBe('percentage');
      expect(license.royaltyTerms.rate).toBe(5);
      expect(license.royaltyTerms.paymentFrequency).toBe('quarterly');
      expect(license.royaltyTerms.currency).toBe('USD');
    });

    it('should set sublicense properties correctly', () => {
      const license = createTestLicense({
        canSublicense: true,
        sublicenseOf: 'parent-license-001',
      });

      expect(license.canSublicense).toBe(true);
      expect(license.sublicenseOf).toBe('parent-license-001');
    });
  });

  describe('activate', () => {
    it('should transition from draft to active', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'), // Past date
      });

      license.activate('user-1');

      expect(license.status).toBe('active');
    });

    it('should emit LicenseGrantedEvent', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });

      license.activate('user-1');

      const events = license.domainEvents;
      const grantedEvent = events.find(e => e.type === 'ip.license.granted');

      expect(grantedEvent).toBeDefined();
      expect(grantedEvent?.payload).toMatchObject({
        licenseNumber: 'LIC-2024-001',
        ipType: 'patent',
        ipAssetId: 'patent-123',
        licenseType: 'exclusive',
        licensorId: 'entity-001',
        licenseeId: 'entity-002',
      });
    });

    it('should throw if not in draft status', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');

      expect(() => license.activate('user-1')).toThrow('Can only activate licenses in draft status');
    });

    it('should throw if effective date is in the future', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2099-01-01'), // Future date
      });

      expect(() => license.activate('user-1')).toThrow('Cannot activate license before effective date');
    });
  });

  describe('suspend', () => {
    it('should transition from active to suspended', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');

      license.suspend('Payment default', 'user-1');

      expect(license.status).toBe('suspended');
    });

    it('should throw if not in active status', () => {
      const license = createTestLicense();

      expect(() => license.suspend('Payment default', 'user-1')).toThrow(
        'Can only suspend active licenses'
      );
    });

    it('should throw if already suspended', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');
      license.suspend('Payment default', 'user-1');

      expect(() => license.suspend('Another reason', 'user-1')).toThrow(
        'Can only suspend active licenses'
      );
    });
  });

  describe('reinstate', () => {
    it('should transition from suspended to active', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');
      license.suspend('Payment default', 'user-1');

      license.reinstate('user-1');

      expect(license.status).toBe('active');
    });

    it('should throw if not in suspended status', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');

      expect(() => license.reinstate('user-1')).toThrow('Can only reinstate suspended licenses');
    });

    it('should throw if in draft status', () => {
      const license = createTestLicense();

      expect(() => license.reinstate('user-1')).toThrow('Can only reinstate suspended licenses');
    });
  });

  describe('terminate', () => {
    it('should set status to terminated', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');
      const terminationDate = new Date('2024-06-15');

      license.terminate('Breach of contract', terminationDate, 'user-1');

      expect(license.status).toBe('terminated');
      expect(license.terminationDate?.toISOString().split('T')[0]).toBe('2024-06-15');
    });

    it('should emit LicenseTerminatedEvent', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');
      license.pullDomainEvents(); // Clear previous events
      const terminationDate = new Date('2024-06-15');

      license.terminate('Breach of contract', terminationDate, 'user-1');

      const events = license.domainEvents;
      const terminatedEvent = events.find(e => e.type === 'ip.license.terminated');

      expect(terminatedEvent).toBeDefined();
      expect(terminatedEvent?.payload).toMatchObject({
        licenseNumber: 'LIC-2024-001',
        previousStatus: 'active',
        reason: 'Breach of contract',
      });
    });

    it('should allow termination from draft status', () => {
      const license = createTestLicense();
      const terminationDate = new Date('2024-06-15');

      license.terminate('Cancelled before activation', terminationDate, 'user-1');

      expect(license.status).toBe('terminated');
    });

    it('should allow termination from suspended status', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');
      license.suspend('Payment default', 'user-1');
      license.pullDomainEvents(); // Clear previous events
      const terminationDate = new Date('2024-06-15');

      license.terminate('Non-cure of suspension', terminationDate, 'user-1');

      expect(license.status).toBe('terminated');

      const events = license.domainEvents;
      const terminatedEvent = events.find(e => e.type === 'ip.license.terminated');
      expect(terminatedEvent?.payload).toMatchObject({
        previousStatus: 'suspended',
      });
    });

    it('should throw if already terminated', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');
      license.terminate('First termination', new Date('2024-06-15'), 'user-1');

      expect(() =>
        license.terminate('Second termination', new Date('2024-06-16'), 'user-1')
      ).toThrow('License is already terminated or expired');
    });

    it('should throw if already expired', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
        expirationDate: new Date('2020-06-01'), // Past date
      });
      license.activate('user-1');
      license.expire('user-1');

      expect(() => license.terminate('After expiry', new Date('2024-06-16'), 'user-1')).toThrow(
        'License is already terminated or expired'
      );
    });
  });

  describe('expire', () => {
    it('should set status to expired when expiration date has passed', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
        expirationDate: new Date('2020-06-01'), // Past date
      });
      license.activate('user-1');

      license.expire('user-1');

      expect(license.status).toBe('expired');
    });

    it('should throw if expiration date is in the future', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
        expirationDate: new Date('2099-01-01'), // Future date
      });
      license.activate('user-1');

      expect(() => license.expire('user-1')).toThrow('License has not expired yet');
    });

    it('should throw if no expiration date is set', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
        expirationDate: undefined,
      });
      license.activate('user-1');

      expect(() => license.expire('user-1')).toThrow('License has not expired yet');
    });
  });

  describe('updateRoyaltyTerms', () => {
    it('should update royalty terms in draft status', () => {
      const license = createTestLicense();
      const newTerms = {
        type: 'hybrid' as const,
        rate: 3,
        fixedAmount: 10000,
        minimumAnnual: 50000,
        paymentFrequency: 'annually' as const,
        currency: 'EUR',
      };

      license.updateRoyaltyTerms(newTerms, 'user-1');

      expect(license.royaltyTerms.type).toBe('hybrid');
      expect(license.royaltyTerms.rate).toBe(3);
      expect(license.royaltyTerms.fixedAmount).toBe(10000);
      expect(license.royaltyTerms.minimumAnnual).toBe(50000);
      expect(license.royaltyTerms.paymentFrequency).toBe('annually');
      expect(license.royaltyTerms.currency).toBe('EUR');
    });

    it('should throw if not in draft status', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');
      const newTerms = {
        type: 'fixed' as const,
        fixedAmount: 50000,
        paymentFrequency: 'monthly' as const,
        currency: 'USD',
      };

      expect(() => license.updateRoyaltyTerms(newTerms, 'user-1')).toThrow(
        'Can only modify royalty terms in draft status'
      );
    });

    it('should throw if license is suspended', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');
      license.suspend('Payment issue', 'user-1');
      const newTerms = {
        type: 'fixed' as const,
        fixedAmount: 50000,
        paymentFrequency: 'monthly' as const,
        currency: 'USD',
      };

      expect(() => license.updateRoyaltyTerms(newTerms, 'user-1')).toThrow(
        'Can only modify royalty terms in draft status'
      );
    });
  });

  describe('isActive', () => {
    it('should return true when license is active', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');

      expect(license.isActive()).toBe(true);
    });

    it('should return false when license is in draft', () => {
      const license = createTestLicense();

      expect(license.isActive()).toBe(false);
    });

    it('should return false when license is suspended', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');
      license.suspend('Payment default', 'user-1');

      expect(license.isActive()).toBe(false);
    });

    it('should return false when license is terminated', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');
      license.terminate('Breach', new Date(), 'user-1');

      expect(license.isActive()).toBe(false);
    });

    it('should return false when license is expired', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
        expirationDate: new Date('2020-06-01'),
      });
      license.activate('user-1');
      license.expire('user-1');

      expect(license.isActive()).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('should return true when expiration date has passed', () => {
      const license = createTestLicense({
        expirationDate: new Date('2020-01-01'), // Past date
      });

      expect(license.isExpired()).toBe(true);
    });

    it('should return false when expiration date is in the future', () => {
      const license = createTestLicense({
        expirationDate: new Date('2099-01-01'), // Future date
      });

      expect(license.isExpired()).toBe(false);
    });

    it('should return false when no expiration date is set', () => {
      const license = createTestLicense({
        expirationDate: undefined,
      });

      expect(license.isExpired()).toBe(false);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a license with existing id and properties', () => {
      const existingId = 'existing-license-id';
      const props = {
        licenseNumber: 'LIC-2023-999',
        ipType: 'trademark' as const,
        ipAssetId: 'trademark-456',
        licenseType: 'non_exclusive' as const,
        status: 'active' as const,
        licensorId: 'entity-A',
        licenseeId: 'entity-B',
        effectiveDate: new Date('2023-01-01'),
        expirationDate: new Date('2028-01-01'),
        territory: {
          worldwide: false,
          includedCountries: ['US', 'CA'],
        },
        royaltyTerms: {
          type: 'fixed' as const,
          fixedAmount: 100000,
          paymentFrequency: 'annually' as const,
          currency: 'CAD',
        },
        canSublicense: true,
        fieldOfUse: 'Consumer electronics',
      };

      const license = License.reconstitute(existingId, props);

      expect(license.id).toBe(existingId);
      expect(license.status).toBe('active');
      expect(license.licenseNumber).toBe('LIC-2023-999');
      expect(license.ipType).toBe('trademark');
      expect(license.fieldOfUse).toBe('Consumer electronics');
    });
  });

  describe('domain events', () => {
    it('should track uncommitted events', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });

      license.activate('user-1');

      const events = license.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('ip.license.granted');
    });

    it('should clear events after pull', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');

      const pulledEvents = license.pullDomainEvents();

      expect(pulledEvents).toHaveLength(1);
      expect(license.domainEvents).toHaveLength(0);
    });

    it('should accumulate multiple events', () => {
      const license = createTestLicense({
        effectiveDate: new Date('2020-01-01'),
      });
      license.activate('user-1');
      license.terminate('Breach', new Date(), 'user-1');

      const events = license.domainEvents;
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('ip.license.granted');
      expect(events[1].type).toBe('ip.license.terminated');
    });
  });
});
