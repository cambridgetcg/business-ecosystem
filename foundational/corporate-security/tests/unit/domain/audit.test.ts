/**
 * Audit Domain Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getEventCategory,
  getEventSeverity,
  calculateChecksum,
  formatAuditLogForExport,
  AUDIT_RETENTION_PERIODS,
  type AuditLog,
} from '../../../src/domain/audit/models/audit-log.js';
import {
  generateIncidentNumber,
  requiresEscalation,
  isIncidentOpen,
  getSLADeadline,
  isSLABreached,
  getTimeToContainment,
  requiresGDPRNotification,
  getGDPRNotificationDeadline,
  type SecurityIncident,
} from '../../../src/domain/audit/models/security-incident.js';

describe('Audit Log', () => {
  describe('getEventCategory', () => {
    it('should categorize authentication events', () => {
      expect(getEventCategory('login_success')).toBe('authentication');
      expect(getEventCategory('login_failure')).toBe('authentication');
      expect(getEventCategory('logout')).toBe('authentication');
      expect(getEventCategory('mfa_success')).toBe('authentication');
      expect(getEventCategory('password_change')).toBe('authentication');
    });

    it('should categorize authorization events', () => {
      expect(getEventCategory('access_granted')).toBe('authorization');
      expect(getEventCategory('access_denied')).toBe('authorization');
      expect(getEventCategory('privilege_escalation')).toBe('authorization');
    });

    it('should categorize security events', () => {
      expect(getEventCategory('brute_force_detected')).toBe('security');
      expect(getEventCategory('data_breach')).toBe('security');
      expect(getEventCategory('unauthorized_access')).toBe('security');
    });

    it('should categorize administrative events', () => {
      expect(getEventCategory('role_assigned')).toBe('administrative');
      expect(getEventCategory('user_created')).toBe('administrative');
      expect(getEventCategory('policy_modified')).toBe('administrative');
    });
  });

  describe('getEventSeverity', () => {
    it('should return critical for critical events', () => {
      expect(getEventSeverity('data_breach', 'success')).toBe('critical');
      expect(getEventSeverity('unauthorized_access', 'success')).toBe('critical');
    });

    it('should return error for high severity events', () => {
      expect(getEventSeverity('brute_force_detected', 'success')).toBe('error');
      expect(getEventSeverity('anomaly_detected', 'success')).toBe('error');
    });

    it('should return warning for failure outcomes', () => {
      expect(getEventSeverity('login_failure', 'failure')).toBe('warning');
      expect(getEventSeverity('access_denied', 'failure')).toBe('warning');
    });

    it('should return info for normal events', () => {
      expect(getEventSeverity('login_success', 'success')).toBe('info');
      expect(getEventSeverity('role_assigned', 'success')).toBe('info');
    });
  });

  describe('calculateChecksum', () => {
    it('should generate consistent checksum', () => {
      const log = {
        tenantId: '123',
        eventType: 'login_success' as const,
        actorId: '456',
        action: 'login',
        outcome: 'success',
        timestamp: new Date('2024-01-01T00:00:00Z'),
      };

      const checksum1 = calculateChecksum(log);
      const checksum2 = calculateChecksum(log);

      expect(checksum1).toBe(checksum2);
    });

    it('should generate different checksum for different data', () => {
      const log1 = {
        tenantId: '123',
        eventType: 'login_success' as const,
        action: 'login',
        outcome: 'success',
        timestamp: new Date('2024-01-01T00:00:00Z'),
      };

      const log2 = {
        tenantId: '456',
        eventType: 'login_success' as const,
        action: 'login',
        outcome: 'success',
        timestamp: new Date('2024-01-01T00:00:00Z'),
      };

      expect(calculateChecksum(log1)).not.toBe(calculateChecksum(log2));
    });
  });

  describe('formatAuditLogForExport', () => {
    it('should format log for export', () => {
      const log: AuditLog = {
        id: '123',
        tenantId: '456',
        eventType: 'login_success',
        eventCategory: 'authentication',
        severity: 'info',
        actorId: '789',
        actorType: 'user',
        actorEmail: 'user@example.com',
        actorName: null,
        actorRoles: null,
        targetType: null,
        targetId: null,
        targetName: null,
        action: 'login',
        outcome: 'success',
        reason: null,
        requestId: null,
        sessionId: null,
        ipAddress: '192.168.1.1',
        userAgent: null,
        geoLocation: null,
        resourceType: null,
        resourceId: null,
        resourcePath: null,
        previousValue: null,
        newValue: null,
        metadata: null,
        tags: null,
        timestamp: new Date('2024-01-01T00:00:00Z'),
        checksum: null,
        previousLogId: null,
      };

      const formatted = formatAuditLogForExport(log);

      expect(formatted.id).toBe('123');
      expect(formatted.timestamp).toBe('2024-01-01T00:00:00.000Z');
      expect(formatted.eventType).toBe('login_success');
      expect(formatted.actor).toBe('user@example.com');
      expect(formatted.ipAddress).toBe('192.168.1.1');
    });
  });

  describe('AUDIT_RETENTION_PERIODS', () => {
    it('should have correct retention periods', () => {
      expect(AUDIT_RETENTION_PERIODS.info).toBe(90);
      expect(AUDIT_RETENTION_PERIODS.warning).toBe(365);
      expect(AUDIT_RETENTION_PERIODS.error).toBe(730);
      expect(AUDIT_RETENTION_PERIODS.critical).toBe(2555);
    });
  });
});

describe('Security Incident', () => {
  const baseIncident: SecurityIncident = {
    id: '123',
    tenantId: '456',
    incidentNumber: 'INC-202401-ABCD',
    title: 'Test Incident',
    description: 'Test description',
    severity: 'medium',
    status: 'open',
    category: 'unauthorized_access',
    detectedAt: new Date(),
    detectedBy: 'automated',
    detectionSource: null,
    triggeringEvents: null,
    relatedAuditLogIds: null,
    affectedResources: null,
    affectedUserCount: null,
    dataCompromised: false,
    dataCompromisedDescription: null,
    financialImpact: null,
    reputationalImpact: null,
    assignedTo: null,
    assignedToName: null,
    responseTeam: null,
    containmentActions: null,
    eradicationActions: null,
    recoveryActions: null,
    timeline: null,
    containedAt: null,
    resolvedAt: null,
    closedAt: null,
    rootCause: null,
    rootCauseCategory: null,
    lessonsLearned: null,
    preventativeMeasures: null,
    requiresRegulatorNotification: false,
    regulatorNotifiedAt: null,
    regulatorReference: null,
    requiresCustomerNotification: false,
    customersNotifiedAt: null,
    externalTicketId: null,
    externalTicketUrl: null,
    metadata: null,
    tags: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    version: 1,
  };

  describe('generateIncidentNumber', () => {
    it('should generate incident number with correct format', () => {
      const number = generateIncidentNumber('tenant-123');
      expect(number).toMatch(/^INC-\d{6}-[A-Z0-9]{4}$/);
    });
  });

  describe('requiresEscalation', () => {
    it('should require escalation for critical severity', () => {
      const critical = { ...baseIncident, severity: 'critical' as const };
      expect(requiresEscalation(critical)).toBe(true);
    });

    it('should require escalation when data compromised', () => {
      const compromised = { ...baseIncident, dataCompromised: true };
      expect(requiresEscalation(compromised)).toBe(true);
    });

    it('should require escalation for large user impact', () => {
      const largeImpact = { ...baseIncident, affectedUserCount: 150 };
      expect(requiresEscalation(largeImpact)).toBe(true);
    });

    it('should not require escalation for medium incident', () => {
      expect(requiresEscalation(baseIncident)).toBe(false);
    });
  });

  describe('isIncidentOpen', () => {
    it('should return true for open status', () => {
      expect(isIncidentOpen(baseIncident)).toBe(true);
    });

    it('should return true for investigating status', () => {
      const investigating = { ...baseIncident, status: 'investigating' as const };
      expect(isIncidentOpen(investigating)).toBe(true);
    });

    it('should return false for closed status', () => {
      const closed = { ...baseIncident, status: 'closed' as const };
      expect(isIncidentOpen(closed)).toBe(false);
    });

    it('should return false for false_positive status', () => {
      const falsePositive = { ...baseIncident, status: 'false_positive' as const };
      expect(isIncidentOpen(falsePositive)).toBe(false);
    });
  });

  describe('getSLADeadline', () => {
    it('should return 1 hour for critical', () => {
      const detected = new Date('2024-01-01T10:00:00Z');
      const deadline = getSLADeadline('critical', detected);
      expect(deadline.toISOString()).toBe('2024-01-01T11:00:00.000Z');
    });

    it('should return 4 hours for high', () => {
      const detected = new Date('2024-01-01T10:00:00Z');
      const deadline = getSLADeadline('high', detected);
      expect(deadline.toISOString()).toBe('2024-01-01T14:00:00.000Z');
    });

    it('should return 24 hours for medium', () => {
      const detected = new Date('2024-01-01T10:00:00Z');
      const deadline = getSLADeadline('medium', detected);
      expect(deadline.toISOString()).toBe('2024-01-02T10:00:00.000Z');
    });
  });

  describe('isSLABreached', () => {
    it('should return false for closed incident', () => {
      const closed = { ...baseIncident, status: 'closed' as const };
      expect(isSLABreached(closed)).toBe(false);
    });

    it('should return false for recent incident', () => {
      const recent = { ...baseIncident, detectedAt: new Date() };
      expect(isSLABreached(recent)).toBe(false);
    });

    it('should return true for old open incident', () => {
      const old = {
        ...baseIncident,
        detectedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
      };
      expect(isSLABreached(old)).toBe(true);
    });
  });

  describe('getTimeToContainment', () => {
    it('should return null when not contained', () => {
      expect(getTimeToContainment(baseIncident)).toBeNull();
    });

    it('should return hours when contained', () => {
      const detected = new Date('2024-01-01T10:00:00Z');
      const contained = new Date('2024-01-01T12:30:00Z');
      const incident = { ...baseIncident, detectedAt: detected, containedAt: contained };
      expect(getTimeToContainment(incident)).toBe(2.5);
    });
  });

  describe('requiresGDPRNotification', () => {
    it('should return false when no data compromised', () => {
      expect(requiresGDPRNotification(baseIncident)).toBe(false);
    });

    it('should return true when data compromised', () => {
      const compromised = { ...baseIncident, dataCompromised: true };
      expect(requiresGDPRNotification(compromised)).toBe(true);
    });
  });

  describe('getGDPRNotificationDeadline', () => {
    it('should return null when no GDPR notification required', () => {
      expect(getGDPRNotificationDeadline(baseIncident)).toBeNull();
    });

    it('should return 72 hours when GDPR notification required', () => {
      const detected = new Date('2024-01-01T10:00:00Z');
      const compromised = { ...baseIncident, dataCompromised: true, detectedAt: detected };
      const deadline = getGDPRNotificationDeadline(compromised);
      expect(deadline?.toISOString()).toBe('2024-01-04T10:00:00.000Z');
    });
  });
});
