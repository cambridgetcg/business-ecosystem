/**
 * Patent Entity Unit Tests
 *
 * Tests for the Patent domain entity.
 *
 * @module test/unit/domain
 */

import { describe, it, expect } from 'vitest';
import { Patent } from '../../../src/domain/entities/patent.entity.js';

describe('Patent Entity', () => {
  const createTestPatent = () => Patent.create({
    title: 'Test Patent for Widget Manufacturing',
    abstract: 'A method for efficiently manufacturing widgets using AI optimization.',
    type: 'utility',
    inventors: [
      { name: 'John Doe', citizenship: 'US' },
      { name: 'Jane Smith', citizenship: 'US' },
    ],
    assigneeId: 'entity-123',
    jurisdictions: ['US', 'EP'],
    claims: [
      { number: 1, text: 'A method comprising...', isIndependent: true },
      { number: 2, text: 'The method of claim 1, further comprising...', isIndependent: false, dependsOn: [1] },
    ],
  });

  describe('create', () => {
    it('should create a patent with draft status', () => {
      const patent = createTestPatent();

      expect(patent.status).toBe('draft');
      expect(patent.title).toBe('Test Patent for Widget Manufacturing');
      expect(patent.type).toBe('utility');
    });

    it('should generate a unique ID', () => {
      const patent1 = createTestPatent();
      const patent2 = createTestPatent();

      expect(patent1.id).toBeDefined();
      expect(patent2.id).toBeDefined();
      expect(patent1.id).not.toBe(patent2.id);
    });

    it('should have correct initial inventors', () => {
      const patent = createTestPatent();

      expect(patent.inventors).toHaveLength(2);
      expect(patent.inventors[0].name).toBe('John Doe');
    });

    it('should have correct initial claims', () => {
      const patent = createTestPatent();

      expect(patent.claims).toHaveLength(2);
      expect(patent.claims[0].isIndependent).toBe(true);
      expect(patent.claims[1].dependsOn).toContain(1);
    });
  });

  describe('file', () => {
    it('should transition from draft to pending', () => {
      const patent = createTestPatent();

      patent.file('17/123,456', new Date('2024-01-15'), 'user-1');

      expect(patent.status).toBe('pending');
      expect(patent.applicationNumber).toBe('17/123,456');
      expect(patent.filingDate?.toISOString().split('T')[0]).toBe('2024-01-15');
    });

    it('should emit PatentFiled domain event', () => {
      const patent = createTestPatent();

      patent.file('17/123,456', new Date('2024-01-15'), 'user-1');

      const events = patent.getUncommittedEvents();
      const filedEvent = events.find(e => e.type === 'Patent.Filed');

      expect(filedEvent).toBeDefined();
      expect(filedEvent?.payload).toMatchObject({
        applicationNumber: '17/123,456',
      });
    });

    it('should throw if already filed', () => {
      const patent = createTestPatent();
      patent.file('17/123,456', new Date('2024-01-15'), 'user-1');

      expect(() => patent.file('17/123,457', new Date('2024-01-16'), 'user-1'))
        .toThrow();
    });
  });

  describe('grant', () => {
    it('should transition from pending to granted', () => {
      const patent = createTestPatent();
      patent.file('17/123,456', new Date('2024-01-15'), 'user-1');

      patent.grant('12,345,678', new Date('2024-06-15'), new Date('2044-06-15'), 'user-1');

      expect(patent.status).toBe('granted');
      expect(patent.patentNumber).toBe('12,345,678');
      expect(patent.grantDate?.toISOString().split('T')[0]).toBe('2024-06-15');
      expect(patent.expirationDate?.toISOString().split('T')[0]).toBe('2044-06-15');
    });

    it('should emit PatentGranted domain event', () => {
      const patent = createTestPatent();
      patent.file('17/123,456', new Date('2024-01-15'), 'user-1');
      patent.clearEvents();

      patent.grant('12,345,678', new Date('2024-06-15'), new Date('2044-06-15'), 'user-1');

      const events = patent.getUncommittedEvents();
      const grantedEvent = events.find(e => e.type === 'Patent.Granted');

      expect(grantedEvent).toBeDefined();
      expect(grantedEvent?.payload).toMatchObject({
        patentNumber: '12,345,678',
      });
    });

    it('should throw if not in pending status', () => {
      const patent = createTestPatent();

      expect(() => patent.grant('12,345,678', new Date('2024-06-15'), new Date('2044-06-15'), 'user-1'))
        .toThrow();
    });
  });

  describe('abandon', () => {
    it('should transition to abandoned status', () => {
      const patent = createTestPatent();
      patent.file('17/123,456', new Date('2024-01-15'), 'user-1');

      patent.abandon('Non-payment of fees', 'user-1');

      expect(patent.status).toBe('abandoned');
    });

    it('should require a reason', () => {
      const patent = createTestPatent();
      patent.file('17/123,456', new Date('2024-01-15'), 'user-1');

      patent.abandon('Non-payment of fees', 'user-1');

      const events = patent.getUncommittedEvents();
      const abandonedEvent = events.find(e => e.type === 'Patent.Abandoned');

      expect(abandonedEvent?.payload).toHaveProperty('reason', 'Non-payment of fees');
    });
  });

  describe('addClaim', () => {
    it('should add a new claim', () => {
      const patent = createTestPatent();
      const initialCount = patent.claims.length;

      patent.addClaim({
        number: 3,
        text: 'A system comprising the method of claim 1...',
        isIndependent: false,
        dependsOn: [1],
      }, 'user-1');

      expect(patent.claims).toHaveLength(initialCount + 1);
      expect(patent.claims[2].number).toBe(3);
    });

    it('should throw if patent is already granted', () => {
      const patent = createTestPatent();
      patent.file('17/123,456', new Date('2024-01-15'), 'user-1');
      patent.grant('12,345,678', new Date('2024-06-15'), new Date('2044-06-15'), 'user-1');

      expect(() => patent.addClaim({
        number: 3,
        text: 'New claim...',
        isIndependent: true,
      }, 'user-1')).toThrow();
    });
  });

  describe('assignTo', () => {
    it('should update assignee', () => {
      const patent = createTestPatent();

      patent.assignTo('new-entity-456', 'user-1');

      expect(patent.assigneeId).toBe('new-entity-456');
    });

    it('should emit PatentAssigned event', () => {
      const patent = createTestPatent();
      patent.clearEvents();

      patent.assignTo('new-entity-456', 'user-1');

      const events = patent.getUncommittedEvents();
      const assignedEvent = events.find(e => e.type === 'Patent.Assigned');

      expect(assignedEvent).toBeDefined();
      expect(assignedEvent?.payload).toMatchObject({
        previousAssigneeId: 'entity-123',
        newAssigneeId: 'new-entity-456',
      });
    });
  });

  describe('updateTitle', () => {
    it('should update the title', () => {
      const patent = createTestPatent();

      patent.updateTitle('Updated Patent Title', 'user-1');

      expect(patent.title).toBe('Updated Patent Title');
    });

    it('should increment version', () => {
      const patent = createTestPatent();
      const initialVersion = patent.version;

      patent.updateTitle('Updated Patent Title', 'user-1');

      expect(patent.version).toBe(initialVersion + 1);
    });
  });

  describe('toPersistence', () => {
    it('should return all properties for persistence', () => {
      const patent = createTestPatent();
      patent.file('17/123,456', new Date('2024-01-15'), 'user-1');

      const props = patent.toPersistence();

      expect(props.id).toBe(patent.id);
      expect(props.title).toBe(patent.title);
      expect(props.applicationNumber).toBe('17/123,456');
      expect(props.status).toBe('pending');
      expect(props.claims).toHaveLength(2);
    });
  });
});
