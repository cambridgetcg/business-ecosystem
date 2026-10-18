/**
 * DSAR Domain Tests
 * Tests for GDPR Art. 15-22 data subject rights logic
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDeadline,
  calculateExtendedDeadline,
  isOverdue,
  getDaysRemaining,
  canExtend,
  canVerify,
  canStartProcessing,
  canComplete,
  isTerminal,
  generateRequestNumber,
  type DSARRequest,
} from '../../src/domain/data-subject-rights/models/dsar-request.js';

describe('DSAR Domain Logic', () => {
  describe('calculateDeadline', () => {
    it('should return date 30 days from receipt', () => {
      const receivedAt = new Date('2025-01-01');
      const deadline = calculateDeadline(receivedAt);

      const expectedDeadline = new Date('2025-01-31');
      expect(deadline.toDateString()).toBe(expectedDeadline.toDateString());
    });
  });

  describe('calculateExtendedDeadline', () => {
    it('should return date 90 days from receipt', () => {
      const receivedAt = new Date('2025-01-01');
      const deadline = calculateExtendedDeadline(receivedAt);

      const expectedDeadline = new Date('2025-04-01');
      expect(deadline.toDateString()).toBe(expectedDeadline.toDateString());
    });
  });

  describe('isOverdue', () => {
    const baseDsar: Omit<DSARRequest, 'deadline' | 'extendedDeadline' | 'status'> = {
      id: '1',
      entityId: 'entity-1',
      requestNumber: 'DSAR-001',
      subjectEmail: 'test@example.com',
      requestType: 'ACCESS',
      priority: 'MEDIUM',
      receivedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return false for COMPLETED DSAR', () => {
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 10);

      const dsar: DSARRequest = {
        ...baseDsar,
        status: 'COMPLETED',
        deadline: pastDeadline,
      };

      expect(isOverdue(dsar)).toBe(false);
    });

    it('should return false for REJECTED DSAR', () => {
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 10);

      const dsar: DSARRequest = {
        ...baseDsar,
        status: 'REJECTED',
        deadline: pastDeadline,
      };

      expect(isOverdue(dsar)).toBe(false);
    });

    it('should return true when past deadline and not completed', () => {
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 10);

      const dsar: DSARRequest = {
        ...baseDsar,
        status: 'PROCESSING',
        deadline: pastDeadline,
      };

      expect(isOverdue(dsar)).toBe(true);
    });

    it('should return false when before deadline', () => {
      const futureDeadline = new Date();
      futureDeadline.setDate(futureDeadline.getDate() + 10);

      const dsar: DSARRequest = {
        ...baseDsar,
        status: 'PROCESSING',
        deadline: futureDeadline,
      };

      expect(isOverdue(dsar)).toBe(false);
    });

    it('should use extended deadline if set', () => {
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 5);

      const futureExtended = new Date();
      futureExtended.setDate(futureExtended.getDate() + 10);

      const dsar: DSARRequest = {
        ...baseDsar,
        status: 'PROCESSING',
        deadline: pastDeadline,
        extendedDeadline: futureExtended,
      };

      expect(isOverdue(dsar)).toBe(false);
    });
  });

  describe('getDaysRemaining', () => {
    it('should return positive days when before deadline', () => {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 15);

      const dsar: DSARRequest = {
        id: '1',
        entityId: 'entity-1',
        requestNumber: 'DSAR-001',
        subjectEmail: 'test@example.com',
        requestType: 'ACCESS',
        status: 'PROCESSING',
        priority: 'MEDIUM',
        receivedAt: new Date(),
        deadline,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const days = getDaysRemaining(dsar);
      expect(days).toBeGreaterThan(14);
      expect(days).toBeLessThanOrEqual(16);
    });

    it('should return negative days when past deadline', () => {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() - 5);

      const dsar: DSARRequest = {
        id: '1',
        entityId: 'entity-1',
        requestNumber: 'DSAR-001',
        subjectEmail: 'test@example.com',
        requestType: 'ACCESS',
        status: 'PROCESSING',
        priority: 'MEDIUM',
        receivedAt: new Date(),
        deadline,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const days = getDaysRemaining(dsar);
      expect(days).toBeLessThan(0);
    });
  });

  describe('canExtend', () => {
    it('should return true when no extension and before deadline', () => {
      const futureDeadline = new Date();
      futureDeadline.setDate(futureDeadline.getDate() + 10);

      const dsar: DSARRequest = {
        id: '1',
        entityId: 'entity-1',
        requestNumber: 'DSAR-001',
        subjectEmail: 'test@example.com',
        requestType: 'ACCESS',
        status: 'PROCESSING',
        priority: 'MEDIUM',
        receivedAt: new Date(),
        deadline: futureDeadline,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canExtend(dsar)).toBe(true);
    });

    it('should return false when already extended', () => {
      const futureDeadline = new Date();
      futureDeadline.setDate(futureDeadline.getDate() + 10);

      const extendedDeadline = new Date();
      extendedDeadline.setDate(extendedDeadline.getDate() + 60);

      const dsar: DSARRequest = {
        id: '1',
        entityId: 'entity-1',
        requestNumber: 'DSAR-001',
        subjectEmail: 'test@example.com',
        requestType: 'ACCESS',
        status: 'PROCESSING',
        priority: 'MEDIUM',
        receivedAt: new Date(),
        deadline: futureDeadline,
        extendedDeadline,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canExtend(dsar)).toBe(false);
    });

    it('should return false when past deadline', () => {
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 10);

      const dsar: DSARRequest = {
        id: '1',
        entityId: 'entity-1',
        requestNumber: 'DSAR-001',
        subjectEmail: 'test@example.com',
        requestType: 'ACCESS',
        status: 'PROCESSING',
        priority: 'MEDIUM',
        receivedAt: new Date(),
        deadline: pastDeadline,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canExtend(dsar)).toBe(false);
    });
  });

  describe('Workflow State Guards', () => {
    const baseDsar: Omit<DSARRequest, 'status'> = {
      id: '1',
      entityId: 'entity-1',
      requestNumber: 'DSAR-001',
      subjectEmail: 'test@example.com',
      requestType: 'ACCESS',
      priority: 'MEDIUM',
      receivedAt: new Date(),
      deadline: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('canVerify', () => {
      it('should return true for RECEIVED status', () => {
        expect(canVerify({ ...baseDsar, status: 'RECEIVED' })).toBe(true);
      });

      it('should return true for PENDING_VERIFICATION status', () => {
        expect(canVerify({ ...baseDsar, status: 'PENDING_VERIFICATION' })).toBe(true);
      });

      it('should return false for VERIFIED status', () => {
        expect(canVerify({ ...baseDsar, status: 'VERIFIED' })).toBe(false);
      });

      it('should return false for COMPLETED status', () => {
        expect(canVerify({ ...baseDsar, status: 'COMPLETED' })).toBe(false);
      });
    });

    describe('canStartProcessing', () => {
      it('should return true for VERIFIED status', () => {
        expect(canStartProcessing({ ...baseDsar, status: 'VERIFIED' })).toBe(true);
      });

      it('should return false for RECEIVED status', () => {
        expect(canStartProcessing({ ...baseDsar, status: 'RECEIVED' })).toBe(false);
      });

      it('should return false for PROCESSING status', () => {
        expect(canStartProcessing({ ...baseDsar, status: 'PROCESSING' })).toBe(false);
      });
    });

    describe('canComplete', () => {
      it('should return true for PROCESSING status', () => {
        expect(canComplete({ ...baseDsar, status: 'PROCESSING' })).toBe(true);
      });

      it('should return true for PENDING_REVIEW status', () => {
        expect(canComplete({ ...baseDsar, status: 'PENDING_REVIEW' })).toBe(true);
      });

      it('should return false for RECEIVED status', () => {
        expect(canComplete({ ...baseDsar, status: 'RECEIVED' })).toBe(false);
      });

      it('should return false for COMPLETED status', () => {
        expect(canComplete({ ...baseDsar, status: 'COMPLETED' })).toBe(false);
      });
    });

    describe('isTerminal', () => {
      it('should return true for COMPLETED status', () => {
        expect(isTerminal({ ...baseDsar, status: 'COMPLETED' })).toBe(true);
      });

      it('should return true for REJECTED status', () => {
        expect(isTerminal({ ...baseDsar, status: 'REJECTED' })).toBe(true);
      });

      it('should return true for CLOSED status', () => {
        expect(isTerminal({ ...baseDsar, status: 'CLOSED' })).toBe(true);
      });

      it('should return false for PROCESSING status', () => {
        expect(isTerminal({ ...baseDsar, status: 'PROCESSING' })).toBe(false);
      });

      it('should return false for RECEIVED status', () => {
        expect(isTerminal({ ...baseDsar, status: 'RECEIVED' })).toBe(false);
      });
    });
  });

  describe('generateRequestNumber', () => {
    it('should generate unique request numbers', () => {
      const numbers = new Set<string>();
      for (let i = 0; i < 100; i++) {
        numbers.add(generateRequestNumber());
      }
      expect(numbers.size).toBe(100);
    });

    it('should start with DSAR- prefix', () => {
      const number = generateRequestNumber();
      expect(number.startsWith('DSAR-')).toBe(true);
    });
  });
});
