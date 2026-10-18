/**
 * Trademark Entity Unit Tests
 *
 * Tests for the Trademark domain entity.
 *
 * @module test/unit/domain
 */

import { describe, it, expect } from 'vitest';
import { Trademark } from '../../../src/domain/entities/trademark.entity.js';

describe('Trademark Entity', () => {
  const createTestTrademark = () => Trademark.create({
    mark: 'ACME WIDGETS',
    description: 'A trademark for software products and services',
    type: 'word',
    ownerId: 'entity-123',
    niceClasses: [
      { classNumber: 9, description: 'Computer software', goodsServices: ['downloadable software', 'mobile apps'] },
      { classNumber: 42, description: 'Scientific services', goodsServices: ['software as a service', 'cloud computing'] },
    ],
    jurisdictions: ['US', 'EU'],
  });

  describe('create', () => {
    it('should create a trademark with draft status', () => {
      const trademark = createTestTrademark();

      expect(trademark.status).toBe('draft');
      expect(trademark.mark).toBe('ACME WIDGETS');
      expect(trademark.type).toBe('word');
    });

    it('should generate a unique ID', () => {
      const trademark1 = createTestTrademark();
      const trademark2 = createTestTrademark();

      expect(trademark1.id).toBeDefined();
      expect(trademark2.id).toBeDefined();
      expect(trademark1.id).not.toBe(trademark2.id);
    });

    it('should have correct initial nice classes', () => {
      const trademark = createTestTrademark();

      expect(trademark.niceClasses).toHaveLength(2);
      expect(trademark.niceClasses[0].classNumber).toBe(9);
      expect(trademark.niceClasses[1].classNumber).toBe(42);
    });

    it('should have correct initial jurisdictions', () => {
      const trademark = createTestTrademark();

      expect(trademark.jurisdictions).toHaveLength(2);
      expect(trademark.jurisdictions).toContain('US');
      expect(trademark.jurisdictions).toContain('EU');
    });

    it('should have undefined application and registration numbers initially', () => {
      const trademark = createTestTrademark();

      expect(trademark.applicationNumber).toBeUndefined();
      expect(trademark.registrationNumber).toBeUndefined();
      expect(trademark.filingDate).toBeUndefined();
      expect(trademark.registrationDate).toBeUndefined();
    });
  });

  describe('file', () => {
    it('should transition from draft to pending', () => {
      const trademark = createTestTrademark();

      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');

      expect(trademark.status).toBe('pending');
      expect(trademark.applicationNumber).toBe('97/123456');
      expect(trademark.filingDate?.toISOString().split('T')[0]).toBe('2024-01-15');
    });

    it('should throw if not in draft status', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');

      expect(() => trademark.file('97/123457', new Date('2024-01-16'), 'user-1'))
        .toThrow('Can only file trademarks in draft status');
    });

    it('should throw if trying to file from registered status', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');
      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');

      expect(() => trademark.file('97/123457', new Date('2024-01-16'), 'user-1'))
        .toThrow('Can only file trademarks in draft status');
    });
  });

  describe('register', () => {
    it('should transition from pending to registered', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');

      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');

      expect(trademark.status).toBe('registered');
      expect(trademark.registrationNumber).toBe('1234567');
      expect(trademark.registrationDate?.toISOString().split('T')[0]).toBe('2024-06-15');
      expect(trademark.expirationDate?.toISOString().split('T')[0]).toBe('2034-06-15');
    });

    it('should transition from published to registered', () => {
      const trademark = Trademark.reconstitute('trademark-123', {
        applicationNumber: '97/123456',
        registrationNumber: undefined,
        mark: 'ACME WIDGETS',
        description: 'Test description',
        type: 'word',
        status: 'published',
        filingDate: new Date('2024-01-15'),
        registrationDate: undefined,
        expirationDate: undefined,
        renewalDate: undefined,
        ownerId: 'entity-123',
        niceClasses: [],
        jurisdictions: ['US'],
        logoUrl: undefined,
      });

      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');

      expect(trademark.status).toBe('registered');
      expect(trademark.registrationNumber).toBe('1234567');
    });

    it('should emit TrademarkRegisteredEvent domain event', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');
      trademark.pullDomainEvents(); // Clear previous events

      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');

      const events = trademark.domainEvents;
      const registeredEvent = events.find(e => e.type === 'ip.trademark.registered');

      expect(registeredEvent).toBeDefined();
      expect(registeredEvent?.payload).toMatchObject({
        registrationNumber: '1234567',
        mark: 'ACME WIDGETS',
      });
    });

    it('should include nice classes in the domain event', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');
      trademark.pullDomainEvents(); // Clear previous events

      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');

      const events = trademark.domainEvents;
      const registeredEvent = events.find(e => e.type === 'ip.trademark.registered');

      expect(registeredEvent?.payload.niceClasses).toEqual([9, 42]);
    });

    it('should throw if not in pending or published status', () => {
      const trademark = createTestTrademark();

      expect(() => trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1'))
        .toThrow('Can only register trademarks in pending or published status');
    });

    it('should throw if in opposed status', () => {
      const trademark = Trademark.reconstitute('trademark-123', {
        applicationNumber: '97/123456',
        registrationNumber: undefined,
        mark: 'ACME WIDGETS',
        description: 'Test description',
        type: 'word',
        status: 'opposed',
        filingDate: new Date('2024-01-15'),
        registrationDate: undefined,
        expirationDate: undefined,
        renewalDate: undefined,
        ownerId: 'entity-123',
        niceClasses: [],
        jurisdictions: ['US'],
        logoUrl: undefined,
      });

      expect(() => trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1'))
        .toThrow('Can only register trademarks in pending or published status');
    });
  });

  describe('renew', () => {
    it('should extend the expiration date', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');
      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');

      trademark.renew(new Date('2044-06-15'), 'user-1');

      expect(trademark.expirationDate?.toISOString().split('T')[0]).toBe('2044-06-15');
      expect(trademark.renewalDate).toBeDefined();
    });

    it('should set the renewal date to current date', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');
      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');

      const beforeRenewal = new Date();
      trademark.renew(new Date('2044-06-15'), 'user-1');
      const afterRenewal = new Date();

      expect(trademark.renewalDate).toBeDefined();
      expect(trademark.renewalDate!.getTime()).toBeGreaterThanOrEqual(beforeRenewal.getTime());
      expect(trademark.renewalDate!.getTime()).toBeLessThanOrEqual(afterRenewal.getTime());
    });

    it('should emit TrademarkRenewedEvent domain event', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');
      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');
      trademark.pullDomainEvents(); // Clear previous events

      trademark.renew(new Date('2044-06-15'), 'user-1');

      const events = trademark.domainEvents;
      const renewedEvent = events.find(e => e.type === 'ip.trademark.renewed');

      expect(renewedEvent).toBeDefined();
      expect(renewedEvent?.payload).toMatchObject({
        registrationNumber: '1234567',
        newExpiration: new Date('2044-06-15'),
      });
    });

    it('should include previous expiration in the domain event', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');
      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');
      trademark.pullDomainEvents(); // Clear previous events

      trademark.renew(new Date('2044-06-15'), 'user-1');

      const events = trademark.domainEvents;
      const renewedEvent = events.find(e => e.type === 'ip.trademark.renewed');

      expect(renewedEvent?.payload.previousExpiration.toISOString().split('T')[0]).toBe('2034-06-15');
    });

    it('should throw if not in registered status', () => {
      const trademark = createTestTrademark();

      expect(() => trademark.renew(new Date('2044-06-15'), 'user-1'))
        .toThrow('Can only renew registered trademarks');
    });

    it('should throw if in pending status', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');

      expect(() => trademark.renew(new Date('2044-06-15'), 'user-1'))
        .toThrow('Can only renew registered trademarks');
    });

    it('should throw if in cancelled status', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');
      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');
      trademark.cancel('user-1');

      expect(() => trademark.renew(new Date('2044-06-15'), 'user-1'))
        .toThrow('Can only renew registered trademarks');
    });
  });

  describe('addNiceClass', () => {
    it('should add a new nice class', () => {
      const trademark = createTestTrademark();
      const initialCount = trademark.niceClasses.length;

      trademark.addNiceClass({
        classNumber: 35,
        description: 'Advertising services',
        goodsServices: ['business management', 'office functions'],
      }, 'user-1');

      expect(trademark.niceClasses).toHaveLength(initialCount + 1);
      expect(trademark.niceClasses[2].classNumber).toBe(35);
    });

    it('should include goods and services in added class', () => {
      const trademark = createTestTrademark();

      trademark.addNiceClass({
        classNumber: 35,
        description: 'Advertising services',
        goodsServices: ['business management', 'office functions'],
      }, 'user-1');

      const addedClass = trademark.niceClasses.find(c => c.classNumber === 35);
      expect(addedClass?.goodsServices).toContain('business management');
      expect(addedClass?.goodsServices).toContain('office functions');
    });

    it('should throw if not in draft status', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');

      expect(() => trademark.addNiceClass({
        classNumber: 35,
        description: 'Advertising services',
        goodsServices: ['business management'],
      }, 'user-1')).toThrow('Can only modify classes in draft status');
    });

    it('should throw if already registered', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');
      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');

      expect(() => trademark.addNiceClass({
        classNumber: 35,
        description: 'Advertising services',
        goodsServices: ['business management'],
      }, 'user-1')).toThrow('Can only modify classes in draft status');
    });
  });

  describe('oppose', () => {
    it('should transition from published to opposed', () => {
      const trademark = Trademark.reconstitute('trademark-123', {
        applicationNumber: '97/123456',
        registrationNumber: undefined,
        mark: 'ACME WIDGETS',
        description: 'Test description',
        type: 'word',
        status: 'published',
        filingDate: new Date('2024-01-15'),
        registrationDate: undefined,
        expirationDate: undefined,
        renewalDate: undefined,
        ownerId: 'entity-123',
        niceClasses: [],
        jurisdictions: ['US'],
        logoUrl: undefined,
      });

      trademark.oppose('user-1');

      expect(trademark.status).toBe('opposed');
    });

    it('should throw if not in published status', () => {
      const trademark = createTestTrademark();

      expect(() => trademark.oppose('user-1'))
        .toThrow('Can only oppose published trademarks');
    });

    it('should throw if in draft status', () => {
      const trademark = createTestTrademark();

      expect(() => trademark.oppose('user-1'))
        .toThrow('Can only oppose published trademarks');
    });

    it('should throw if in pending status', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');

      expect(() => trademark.oppose('user-1'))
        .toThrow('Can only oppose published trademarks');
    });

    it('should throw if already registered', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');
      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');

      expect(() => trademark.oppose('user-1'))
        .toThrow('Can only oppose published trademarks');
    });
  });

  describe('cancel', () => {
    it('should set status to cancelled from draft', () => {
      const trademark = createTestTrademark();

      trademark.cancel('user-1');

      expect(trademark.status).toBe('cancelled');
    });

    it('should set status to cancelled from pending', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');

      trademark.cancel('user-1');

      expect(trademark.status).toBe('cancelled');
    });

    it('should set status to cancelled from registered', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');
      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');

      trademark.cancel('user-1');

      expect(trademark.status).toBe('cancelled');
    });

    it('should preserve other properties when cancelled', () => {
      const trademark = createTestTrademark();
      trademark.file('97/123456', new Date('2024-01-15'), 'user-1');
      trademark.register('1234567', new Date('2024-06-15'), new Date('2034-06-15'), 'user-1');

      trademark.cancel('user-1');

      expect(trademark.mark).toBe('ACME WIDGETS');
      expect(trademark.registrationNumber).toBe('1234567');
      expect(trademark.ownerId).toBe('entity-123');
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a trademark from persistence', () => {
      const trademark = Trademark.reconstitute('trademark-123', {
        applicationNumber: '97/123456',
        registrationNumber: '1234567',
        mark: 'RECONSTITUTED MARK',
        description: 'A reconstituted trademark',
        type: 'design',
        status: 'registered',
        filingDate: new Date('2024-01-15'),
        registrationDate: new Date('2024-06-15'),
        expirationDate: new Date('2034-06-15'),
        renewalDate: undefined,
        ownerId: 'entity-456',
        niceClasses: [{ classNumber: 25, description: 'Clothing', goodsServices: ['shirts', 'pants'] }],
        jurisdictions: ['US', 'CA'],
        logoUrl: 'https://example.com/logo.png',
      });

      expect(trademark.id).toBe('trademark-123');
      expect(trademark.mark).toBe('RECONSTITUTED MARK');
      expect(trademark.status).toBe('registered');
      expect(trademark.type).toBe('design');
      expect(trademark.niceClasses).toHaveLength(1);
      expect(trademark.logoUrl).toBe('https://example.com/logo.png');
    });
  });

  describe('different trademark types', () => {
    it('should create a design trademark', () => {
      const trademark = Trademark.create({
        mark: 'LOGO DESIGN',
        type: 'design',
        ownerId: 'entity-123',
        logoUrl: 'https://example.com/logo.png',
      });

      expect(trademark.type).toBe('design');
      expect(trademark.logoUrl).toBe('https://example.com/logo.png');
    });

    it('should create a combined trademark', () => {
      const trademark = Trademark.create({
        mark: 'COMBINED MARK',
        type: 'combined',
        ownerId: 'entity-123',
        description: 'A mark combining word and design elements',
        logoUrl: 'https://example.com/combined.png',
      });

      expect(trademark.type).toBe('combined');
    });

    it('should create a sound trademark', () => {
      const trademark = Trademark.create({
        mark: 'SONIC SIGNATURE',
        type: 'sound',
        ownerId: 'entity-123',
        description: 'A distinctive audio mark',
      });

      expect(trademark.type).toBe('sound');
    });
  });
});
