/**
 * Breach Management Domain Tests
 * Tests for GDPR Art. 33-34 breach notification logic
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNotificationDeadline,
  isNotificationOverdue,
  getHoursRemaining,
  wasNotificationLate,
  requiresAuthorityNotification,
  requiresSubjectNotification,
  canContain,
  canResolve,
  isTerminal,
  generateBreachNumber,
  type DataBreach,
} from '../../src/domain/breach-management/models/data-breach.js';

describe('Breach Management Domain Logic', () => {
  describe('calculateNotificationDeadline', () => {
    it('should return date 72 hours from discovery', () => {
      const discoveredAt = new Date('2025-01-01T12:00:00Z');
      const deadline = calculateNotificationDeadline(discoveredAt);

      const expected = new Date('2025-01-04T12:00:00Z');
      expect(deadline.toISOString()).toBe(expected.toISOString());
    });

    it('should handle month boundary', () => {
      const discoveredAt = new Date('2025-01-30T12:00:00Z');
      const deadline = calculateNotificationDeadline(discoveredAt);

      const expected = new Date('2025-02-02T12:00:00Z');
      expect(deadline.toISOString()).toBe(expected.toISOString());
    });
  });

  describe('isNotificationOverdue', () => {
    const baseBreach: Omit<DataBreach, 'authorityNotificationRequired' | 'authorityNotifiedAt' | 'notificationDeadline'> = {
      id: '1',
      entityId: 'entity-1',
      breachNumber: 'BRH-001',
      title: 'Test Breach',
      description: 'Test breach description',
      severity: 'HIGH',
      category: 'CONFIDENTIALITY',
      discoveredAt: new Date(),
      affectedCategories: ['personal'],
      crossBorder: false,
      riskToSubjects: 'HIGH',
      status: 'IDENTIFIED',
      subjectNotificationRequired: false,
      remediationStatus: 'NOT_STARTED',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return false when notification is not required', () => {
      const breach: DataBreach = {
        ...baseBreach,
        authorityNotificationRequired: false,
        notificationDeadline: new Date(Date.now() - 1000 * 60 * 60), // past
      };

      expect(isNotificationOverdue(breach)).toBe(false);
    });

    it('should return false when already notified', () => {
      const pastDeadline = new Date();
      pastDeadline.setHours(pastDeadline.getHours() - 24);

      const breach: DataBreach = {
        ...baseBreach,
        authorityNotificationRequired: true,
        authorityNotifiedAt: new Date(),
        notificationDeadline: pastDeadline,
      };

      expect(isNotificationOverdue(breach)).toBe(false);
    });

    it('should return false when no deadline set', () => {
      const breach: DataBreach = {
        ...baseBreach,
        authorityNotificationRequired: true,
      };

      expect(isNotificationOverdue(breach)).toBe(false);
    });

    it('should return true when past deadline and not notified', () => {
      const pastDeadline = new Date();
      pastDeadline.setHours(pastDeadline.getHours() - 24);

      const breach: DataBreach = {
        ...baseBreach,
        authorityNotificationRequired: true,
        notificationDeadline: pastDeadline,
      };

      expect(isNotificationOverdue(breach)).toBe(true);
    });

    it('should return false when before deadline', () => {
      const futureDeadline = new Date();
      futureDeadline.setHours(futureDeadline.getHours() + 24);

      const breach: DataBreach = {
        ...baseBreach,
        authorityNotificationRequired: true,
        notificationDeadline: futureDeadline,
      };

      expect(isNotificationOverdue(breach)).toBe(false);
    });
  });

  describe('getHoursRemaining', () => {
    const baseBreach: Omit<DataBreach, 'notificationDeadline' | 'authorityNotifiedAt'> = {
      id: '1',
      entityId: 'entity-1',
      breachNumber: 'BRH-001',
      title: 'Test Breach',
      description: 'Test breach description',
      severity: 'HIGH',
      category: 'CONFIDENTIALITY',
      discoveredAt: new Date(),
      affectedCategories: ['personal'],
      crossBorder: false,
      riskToSubjects: 'HIGH',
      status: 'IDENTIFIED',
      authorityNotificationRequired: true,
      subjectNotificationRequired: false,
      remediationStatus: 'NOT_STARTED',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return null when no deadline set', () => {
      const breach: DataBreach = {
        ...baseBreach,
      };

      expect(getHoursRemaining(breach)).toBeNull();
    });

    it('should return null when already notified', () => {
      const breach: DataBreach = {
        ...baseBreach,
        notificationDeadline: new Date(),
        authorityNotifiedAt: new Date(),
      };

      expect(getHoursRemaining(breach)).toBeNull();
    });

    it('should return positive hours when before deadline', () => {
      const futureDeadline = new Date();
      futureDeadline.setHours(futureDeadline.getHours() + 48);

      const breach: DataBreach = {
        ...baseBreach,
        notificationDeadline: futureDeadline,
      };

      const hours = getHoursRemaining(breach);
      expect(hours).toBeGreaterThan(46);
      expect(hours).toBeLessThanOrEqual(48);
    });

    it('should return negative hours when past deadline', () => {
      const pastDeadline = new Date();
      pastDeadline.setHours(pastDeadline.getHours() - 24);

      const breach: DataBreach = {
        ...baseBreach,
        notificationDeadline: pastDeadline,
      };

      const hours = getHoursRemaining(breach);
      expect(hours).toBeLessThan(0);
    });
  });

  describe('wasNotificationLate', () => {
    const baseBreach: Omit<DataBreach, 'authorityNotifiedAt' | 'notificationDeadline'> = {
      id: '1',
      entityId: 'entity-1',
      breachNumber: 'BRH-001',
      title: 'Test Breach',
      description: 'Test breach description',
      severity: 'HIGH',
      category: 'CONFIDENTIALITY',
      discoveredAt: new Date(),
      affectedCategories: ['personal'],
      crossBorder: false,
      riskToSubjects: 'HIGH',
      status: 'RESOLVED',
      authorityNotificationRequired: true,
      subjectNotificationRequired: false,
      remediationStatus: 'COMPLETED',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return false when not notified', () => {
      const breach: DataBreach = {
        ...baseBreach,
        notificationDeadline: new Date(),
      };

      expect(wasNotificationLate(breach)).toBe(false);
    });

    it('should return false when no deadline set', () => {
      const breach: DataBreach = {
        ...baseBreach,
        authorityNotifiedAt: new Date(),
      };

      expect(wasNotificationLate(breach)).toBe(false);
    });

    it('should return true when notified after deadline', () => {
      const deadline = new Date('2025-01-01T12:00:00Z');
      const notifiedAt = new Date('2025-01-02T12:00:00Z');

      const breach: DataBreach = {
        ...baseBreach,
        notificationDeadline: deadline,
        authorityNotifiedAt: notifiedAt,
      };

      expect(wasNotificationLate(breach)).toBe(true);
    });

    it('should return false when notified before deadline', () => {
      const deadline = new Date('2025-01-02T12:00:00Z');
      const notifiedAt = new Date('2025-01-01T12:00:00Z');

      const breach: DataBreach = {
        ...baseBreach,
        notificationDeadline: deadline,
        authorityNotifiedAt: notifiedAt,
      };

      expect(wasNotificationLate(breach)).toBe(false);
    });
  });

  describe('requiresAuthorityNotification', () => {
    it('should return false for LOW risk with minimal affected count', () => {
      expect(requiresAuthorityNotification('LOW', 5)).toBe(false);
    });

    it('should return false for LOW risk with no affected count', () => {
      expect(requiresAuthorityNotification('LOW')).toBe(false);
    });

    it('should return true for LOW risk with significant affected count', () => {
      expect(requiresAuthorityNotification('LOW', 100)).toBe(true);
    });

    it('should return true for MEDIUM risk', () => {
      expect(requiresAuthorityNotification('MEDIUM', 1)).toBe(true);
    });

    it('should return true for HIGH risk', () => {
      expect(requiresAuthorityNotification('HIGH', 1)).toBe(true);
    });

    it('should return true for CRITICAL risk', () => {
      expect(requiresAuthorityNotification('CRITICAL', 1)).toBe(true);
    });
  });

  describe('requiresSubjectNotification', () => {
    it('should return false for LOW risk', () => {
      expect(requiresSubjectNotification('LOW')).toBe(false);
    });

    it('should return false for MEDIUM risk', () => {
      expect(requiresSubjectNotification('MEDIUM')).toBe(false);
    });

    it('should return true for HIGH risk', () => {
      expect(requiresSubjectNotification('HIGH')).toBe(true);
    });

    it('should return true for CRITICAL risk', () => {
      expect(requiresSubjectNotification('CRITICAL')).toBe(true);
    });
  });

  describe('Workflow State Guards', () => {
    const baseBreach: Omit<DataBreach, 'status'> = {
      id: '1',
      entityId: 'entity-1',
      breachNumber: 'BRH-001',
      title: 'Test Breach',
      description: 'Test breach description',
      severity: 'HIGH',
      category: 'CONFIDENTIALITY',
      discoveredAt: new Date(),
      affectedCategories: ['personal'],
      crossBorder: false,
      riskToSubjects: 'HIGH',
      authorityNotificationRequired: true,
      subjectNotificationRequired: true,
      remediationStatus: 'NOT_STARTED',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    describe('canContain', () => {
      it('should return true for IDENTIFIED status', () => {
        expect(canContain({ ...baseBreach, status: 'IDENTIFIED' })).toBe(true);
      });

      it('should return true for ASSESSING status', () => {
        expect(canContain({ ...baseBreach, status: 'ASSESSING' })).toBe(true);
      });

      it('should return true for NOTIFYING status', () => {
        expect(canContain({ ...baseBreach, status: 'NOTIFYING' })).toBe(true);
      });

      it('should return false for RESOLVED status', () => {
        expect(canContain({ ...baseBreach, status: 'RESOLVED' })).toBe(false);
      });

      it('should return false for CLOSED status', () => {
        expect(canContain({ ...baseBreach, status: 'CLOSED' })).toBe(false);
      });
    });

    describe('canResolve', () => {
      it('should return true for IDENTIFIED status', () => {
        expect(canResolve({ ...baseBreach, status: 'IDENTIFIED' })).toBe(true);
      });

      it('should return true for CONTAINED status', () => {
        expect(canResolve({ ...baseBreach, status: 'CONTAINED' })).toBe(true);
      });

      it('should return true for REMEDIATING status', () => {
        expect(canResolve({ ...baseBreach, status: 'REMEDIATING' })).toBe(true);
      });

      it('should return false for RESOLVED status', () => {
        expect(canResolve({ ...baseBreach, status: 'RESOLVED' })).toBe(false);
      });

      it('should return false for CLOSED status', () => {
        expect(canResolve({ ...baseBreach, status: 'CLOSED' })).toBe(false);
      });
    });

    describe('isTerminal', () => {
      it('should return true for RESOLVED status', () => {
        expect(isTerminal({ ...baseBreach, status: 'RESOLVED' })).toBe(true);
      });

      it('should return true for CLOSED status', () => {
        expect(isTerminal({ ...baseBreach, status: 'CLOSED' })).toBe(true);
      });

      it('should return false for IDENTIFIED status', () => {
        expect(isTerminal({ ...baseBreach, status: 'IDENTIFIED' })).toBe(false);
      });

      it('should return false for REMEDIATING status', () => {
        expect(isTerminal({ ...baseBreach, status: 'REMEDIATING' })).toBe(false);
      });
    });
  });

  describe('generateBreachNumber', () => {
    it('should generate unique breach numbers', () => {
      const numbers = new Set<string>();
      for (let i = 0; i < 100; i++) {
        numbers.add(generateBreachNumber());
      }
      expect(numbers.size).toBe(100);
    });

    it('should start with BRH- prefix', () => {
      const number = generateBreachNumber();
      expect(number.startsWith('BRH-')).toBe(true);
    });
  });
});
