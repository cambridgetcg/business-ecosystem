/**
 * Trade Secret Entity Unit Tests
 *
 * Tests for the TradeSecret domain entity.
 *
 * @module test/unit/domain
 */

import { describe, it, expect } from 'vitest';
import { TradeSecret } from '../../../src/domain/entities/trade-secret.entity.js';

describe('TradeSecret Entity', () => {
  const createTestTradeSecret = () => TradeSecret.create({
    title: 'Proprietary Algorithm for Data Processing',
    description: 'A novel algorithm that optimizes data processing with 40% efficiency gains.',
    category: 'technical',
    sensitivityLevel: 'highly_confidential',
    ownerId: 'entity-123',
    custodianId: 'custodian-456',
    identifiedDate: new Date('2024-01-15'),
    economicValueDescription: 'Provides significant competitive advantage in data processing market.',
    estimatedValue: 500000,
  });

  describe('create', () => {
    it('should create a trade secret with active status', () => {
      const tradeSecret = createTestTradeSecret();

      expect(tradeSecret.status).toBe('active');
      expect(tradeSecret.title).toBe('Proprietary Algorithm for Data Processing');
      expect(tradeSecret.category).toBe('technical');
      expect(tradeSecret.sensitivityLevel).toBe('highly_confidential');
    });

    it('should generate a unique ID', () => {
      const tradeSecret1 = createTestTradeSecret();
      const tradeSecret2 = createTestTradeSecret();

      expect(tradeSecret1.id).toBeDefined();
      expect(tradeSecret2.id).toBeDefined();
      expect(tradeSecret1.id).not.toBe(tradeSecret2.id);
    });

    it('should have correct initial owner and custodian', () => {
      const tradeSecret = createTestTradeSecret();

      expect(tradeSecret.ownerId).toBe('entity-123');
      expect(tradeSecret.custodianId).toBe('custodian-456');
    });

    it('should have empty access list initially', () => {
      const tradeSecret = createTestTradeSecret();

      expect(tradeSecret.accessList).toHaveLength(0);
    });

    it('should have correct economic value information', () => {
      const tradeSecret = createTestTradeSecret();

      expect(tradeSecret.economicValueDescription).toBe('Provides significant competitive advantage in data processing market.');
      expect(tradeSecret.estimatedValue).toBe(500000);
    });

    it('should emit TradeSecretCreatedEvent', () => {
      const tradeSecret = createTestTradeSecret();

      const events = tradeSecret.domainEvents;
      const createdEvent = events.find(e => e.type === 'ip.trade_secret.created');

      expect(createdEvent).toBeDefined();
      expect(createdEvent?.payload).toMatchObject({
        title: 'Proprietary Algorithm for Data Processing',
        category: 'technical',
        sensitivityLevel: 'highly_confidential',
        ownerId: 'entity-123',
      });
    });

    it('should create without optional fields', () => {
      const tradeSecret = TradeSecret.create({
        title: 'Simple Trade Secret',
        description: 'A basic trade secret without optional fields.',
        category: 'business',
        sensitivityLevel: 'confidential',
        ownerId: 'entity-789',
        identifiedDate: new Date('2024-02-01'),
        economicValueDescription: 'Moderate business value.',
      });

      expect(tradeSecret.status).toBe('active');
      expect(tradeSecret.custodianId).toBeUndefined();
      expect(tradeSecret.estimatedValue).toBeUndefined();
    });
  });

  describe('grantAccess', () => {
    it('should add user to access list', () => {
      const tradeSecret = createTestTradeSecret();

      tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001');

      expect(tradeSecret.accessList).toHaveLength(1);
      expect(tradeSecret.accessList[0].userId).toBe('user-001');
      expect(tradeSecret.accessList[0].accessLevel).toBe('read');
      expect(tradeSecret.accessList[0].grantedBy).toBe('admin-001');
    });

    it('should update existing access level for same user', () => {
      const tradeSecret = createTestTradeSecret();

      tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001');
      tradeSecret.grantAccess('user-001', 'write', 'admin-002', 'actor-002');

      expect(tradeSecret.accessList).toHaveLength(1);
      expect(tradeSecret.accessList[0].accessLevel).toBe('write');
      expect(tradeSecret.accessList[0].grantedBy).toBe('admin-002');
    });

    it('should allow multiple users in access list', () => {
      const tradeSecret = createTestTradeSecret();

      tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001');
      tradeSecret.grantAccess('user-002', 'write', 'admin-001', 'actor-001');
      tradeSecret.grantAccess('user-003', 'admin', 'admin-001', 'actor-001');

      expect(tradeSecret.accessList).toHaveLength(3);
    });

    it('should emit TradeSecretAccessGrantedEvent', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.pullDomainEvents(); // Clear events from creation

      tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001');

      const events = tradeSecret.domainEvents;
      const accessEvent = events.find(e => e.type === 'ip.trade_secret.access_granted');

      expect(accessEvent).toBeDefined();
      expect(accessEvent?.payload).toMatchObject({
        userId: 'user-001',
        accessLevel: 'read',
        grantedBy: 'admin-001',
      });
    });

    it('should throw if trade secret is not active', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.markAsDisclosed('Public disclosure required', 'actor-001');

      expect(() => tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001'))
        .toThrow('Cannot grant access to inactive trade secrets');
    });

    it('should throw if trade secret is abandoned', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.abandon('actor-001');

      expect(() => tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001'))
        .toThrow('Cannot grant access to inactive trade secrets');
    });

    it('should throw if trade secret is converted to patent', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.convertToPatent('actor-001');

      expect(() => tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001'))
        .toThrow('Cannot grant access to inactive trade secrets');
    });
  });

  describe('revokeAccess', () => {
    it('should remove user from access list', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001');
      tradeSecret.grantAccess('user-002', 'write', 'admin-001', 'actor-001');

      tradeSecret.revokeAccess('user-001', 'actor-002');

      expect(tradeSecret.accessList).toHaveLength(1);
      expect(tradeSecret.accessList[0].userId).toBe('user-002');
    });

    it('should be no-op if user not in access list', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001');

      tradeSecret.revokeAccess('user-nonexistent', 'actor-002');

      expect(tradeSecret.accessList).toHaveLength(1);
      expect(tradeSecret.accessList[0].userId).toBe('user-001');
    });

    it('should handle revoking from empty access list', () => {
      const tradeSecret = createTestTradeSecret();

      // Should not throw
      tradeSecret.revokeAccess('user-nonexistent', 'actor-001');

      expect(tradeSecret.accessList).toHaveLength(0);
    });
  });

  describe('markAsDisclosed (disclose)', () => {
    it('should transition from active to disclosed status', () => {
      const tradeSecret = createTestTradeSecret();

      tradeSecret.markAsDisclosed('Required by regulatory authority', 'actor-001');

      expect(tradeSecret.status).toBe('disclosed');
    });

    it('should emit TradeSecretDisclosedEvent', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.pullDomainEvents(); // Clear events from creation

      tradeSecret.markAsDisclosed('Public disclosure for patent application', 'actor-001');

      const events = tradeSecret.domainEvents;
      const disclosedEvent = events.find(e => e.type === 'ip.trade_secret.disclosed');

      expect(disclosedEvent).toBeDefined();
      expect(disclosedEvent?.payload).toMatchObject({
        title: 'Proprietary Algorithm for Data Processing',
        reason: 'Public disclosure for patent application',
      });
      expect(disclosedEvent?.payload).toHaveProperty('disclosedAt');
    });

    it('should throw if not in active status', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.abandon('actor-001');

      expect(() => tradeSecret.markAsDisclosed('Some reason', 'actor-002'))
        .toThrow('Can only disclose active trade secrets');
    });

    it('should throw if already disclosed', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.markAsDisclosed('First disclosure', 'actor-001');

      expect(() => tradeSecret.markAsDisclosed('Second disclosure', 'actor-002'))
        .toThrow('Can only disclose active trade secrets');
    });
  });

  describe('abandon', () => {
    it('should transition from active to abandoned status', () => {
      const tradeSecret = createTestTradeSecret();

      tradeSecret.abandon('actor-001');

      expect(tradeSecret.status).toBe('abandoned');
    });

    it('should throw if not in active status', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.markAsDisclosed('Disclosed', 'actor-001');

      expect(() => tradeSecret.abandon('actor-002'))
        .toThrow('Can only abandon active trade secrets');
    });

    it('should throw if already abandoned', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.abandon('actor-001');

      expect(() => tradeSecret.abandon('actor-002'))
        .toThrow('Can only abandon active trade secrets');
    });
  });

  describe('convertToPatent', () => {
    it('should transition from active to converted_to_patent status', () => {
      const tradeSecret = createTestTradeSecret();

      tradeSecret.convertToPatent('actor-001');

      expect(tradeSecret.status).toBe('converted_to_patent');
    });

    it('should throw if not in active status', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.abandon('actor-001');

      expect(() => tradeSecret.convertToPatent('actor-002'))
        .toThrow('Can only convert active trade secrets to patent');
    });

    it('should throw if already converted to patent', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.convertToPatent('actor-001');

      expect(() => tradeSecret.convertToPatent('actor-002'))
        .toThrow('Can only convert active trade secrets to patent');
    });

    it('should throw if disclosed', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.markAsDisclosed('Disclosed', 'actor-001');

      expect(() => tradeSecret.convertToPatent('actor-002'))
        .toThrow('Can only convert active trade secrets to patent');
    });
  });

  describe('hasAccess', () => {
    it('should return true for user with access', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001');

      expect(tradeSecret.hasAccess('user-001')).toBe(true);
    });

    it('should return false for user without access', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001');

      expect(tradeSecret.hasAccess('user-002')).toBe(false);
    });

    it('should return false after access is revoked', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001');
      tradeSecret.revokeAccess('user-001', 'actor-002');

      expect(tradeSecret.hasAccess('user-001')).toBe(false);
    });
  });

  describe('getAccessLevel', () => {
    it('should return access level for user with access', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.grantAccess('user-001', 'write', 'admin-001', 'actor-001');

      expect(tradeSecret.getAccessLevel('user-001')).toBe('write');
    });

    it('should return undefined for user without access', () => {
      const tradeSecret = createTestTradeSecret();

      expect(tradeSecret.getAccessLevel('user-001')).toBeUndefined();
    });

    it('should return updated access level after change', () => {
      const tradeSecret = createTestTradeSecret();
      tradeSecret.grantAccess('user-001', 'read', 'admin-001', 'actor-001');
      tradeSecret.grantAccess('user-001', 'admin', 'admin-002', 'actor-002');

      expect(tradeSecret.getAccessLevel('user-001')).toBe('admin');
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute trade secret from persistence', () => {
      const tradeSecret = TradeSecret.reconstitute('existing-id-123', {
        title: 'Reconstituted Trade Secret',
        description: 'A trade secret loaded from persistence.',
        category: 'financial',
        sensitivityLevel: 'restricted',
        status: 'active',
        ownerId: 'entity-456',
        identifiedDate: new Date('2023-06-01'),
        economicValueDescription: 'High value financial data.',
        accessList: [
          {
            userId: 'user-existing',
            accessLevel: 'read',
            grantedAt: '2023-06-15T10:00:00Z',
            grantedBy: 'admin-existing',
          },
        ],
      });

      expect(tradeSecret.id).toBe('existing-id-123');
      expect(tradeSecret.title).toBe('Reconstituted Trade Secret');
      expect(tradeSecret.status).toBe('active');
      expect(tradeSecret.accessList).toHaveLength(1);
    });

    it('should not emit domain events when reconstituting', () => {
      const tradeSecret = TradeSecret.reconstitute('existing-id-123', {
        title: 'Reconstituted Trade Secret',
        description: 'A trade secret loaded from persistence.',
        category: 'financial',
        sensitivityLevel: 'restricted',
        status: 'active',
        ownerId: 'entity-456',
        identifiedDate: new Date('2023-06-01'),
        economicValueDescription: 'High value financial data.',
        accessList: [],
      });

      const events = tradeSecret.domainEvents;
      expect(events).toHaveLength(0);
    });
  });

  describe('updateReviewDate', () => {
    it('should update the last review date', () => {
      const tradeSecret = createTestTradeSecret();
      const reviewDate = new Date('2024-03-15');

      tradeSecret.updateReviewDate(reviewDate, 'actor-001');

      expect(tradeSecret.lastReviewDate?.toISOString().split('T')[0]).toBe('2024-03-15');
    });
  });

  describe('updateEstimatedValue', () => {
    it('should update the estimated value', () => {
      const tradeSecret = createTestTradeSecret();

      tradeSecret.updateEstimatedValue(750000, 'actor-001');

      expect(tradeSecret.estimatedValue).toBe(750000);
    });
  });

  describe('assignCustodian', () => {
    it('should assign a new custodian', () => {
      const tradeSecret = createTestTradeSecret();

      tradeSecret.assignCustodian('new-custodian-789', 'actor-001');

      expect(tradeSecret.custodianId).toBe('new-custodian-789');
    });
  });

  describe('updateSensitivityLevel', () => {
    it('should update the sensitivity level', () => {
      const tradeSecret = createTestTradeSecret();

      tradeSecret.updateSensitivityLevel('restricted', 'actor-001');

      expect(tradeSecret.sensitivityLevel).toBe('restricted');
    });
  });
});
