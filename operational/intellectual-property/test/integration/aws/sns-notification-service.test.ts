/**
 * SNS Notification Service Integration Tests
 *
 * Tests for the SNSNotificationService that handles IP-related notifications.
 * Uses AWS SDK mocks configured in test/setup.ts to verify correct SNS interactions.
 *
 * @module test/integration/aws
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { SNSClient, PublishCommand, PublishBatchCommand } from '@aws-sdk/client-sns';
import {
  SNSNotificationService,
  type Notification,
  type NotificationPriority,
} from '../../../src/infrastructure/aws/sns-notification-service.js';

describe('SNSNotificationService', () => {
  let service: SNSNotificationService;
  let mockSend: Mock;

  // Test topic ARNs
  const testTopics = {
    deadlineAlertsTopic: 'arn:aws:sns:us-east-1:123456789012:test-deadline-alerts',
    criticalAlertsTopic: 'arn:aws:sns:us-east-1:123456789012:test-critical-alerts',
    ipEventsTopic: 'arn:aws:sns:us-east-1:123456789012:test-ip-events',
    tradeSecretAlertsTopic: 'arn:aws:sns:us-east-1:123456789012:test-trade-secret-alerts',
    crossServiceTopic: 'arn:aws:sns:us-east-1:123456789012:test-cross-service',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock send function with default response
    mockSend = vi.fn().mockResolvedValue({ MessageId: 'test-message-id-12345' });

    // Override the SNSClient mock implementation for this test
    (SNSClient as unknown as Mock).mockImplementation(() => ({
      send: mockSend,
    }));

    service = new SNSNotificationService(testTopics);
  });

  // ===========================================================================
  // BASIC NOTIFICATION PUBLISHING TESTS
  // ===========================================================================

  describe('sendDeadlineAlert', () => {
    it('should publish to the deadline alerts topic', async () => {
      const notification: Notification = {
        subject: 'Patent Maintenance Due',
        message: 'Patent US12345678 maintenance fee due in 30 days',
        priority: 'high',
        assetType: 'patent',
        assetId: 'patent-123',
      };

      const messageId = await service.sendDeadlineAlert(notification);

      expect(messageId).toBe('test-message-id-12345');
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(PublishCommand);
      expect(command.input.TopicArn).toBe(testTopics.deadlineAlertsTopic);
      expect(command.input.Subject).toBe('Patent Maintenance Due');
      expect(command.input.Message).toBe('Patent US12345678 maintenance fee due in 30 days');
    });

    it('should include all message attributes', async () => {
      const dueDate = new Date('2024-06-15');
      const notification: Notification = {
        subject: 'Test Subject',
        message: 'Test Message',
        priority: 'medium',
        assetType: 'trademark',
        assetId: 'tm-456',
        deadlineId: 'deadline-789',
        dueDate,
        attributes: {
          customAttr1: 'value1',
          customAttr2: 'value2',
        },
      };

      await service.sendDeadlineAlert(notification);

      const command = mockSend.mock.calls[0][0];
      const attrs = command.input.MessageAttributes;

      expect(attrs.priority).toEqual({ DataType: 'String', StringValue: 'medium' });
      expect(attrs.assetType).toEqual({ DataType: 'String', StringValue: 'trademark' });
      expect(attrs.assetId).toEqual({ DataType: 'String', StringValue: 'tm-456' });
      expect(attrs.deadlineId).toEqual({ DataType: 'String', StringValue: 'deadline-789' });
      expect(attrs.dueDate).toEqual({ DataType: 'String', StringValue: dueDate.toISOString() });
      expect(attrs.customAttr1).toEqual({ DataType: 'String', StringValue: 'value1' });
      expect(attrs.customAttr2).toEqual({ DataType: 'String', StringValue: 'value2' });
    });
  });

  describe('sendCriticalAlert', () => {
    it('should publish to the critical alerts topic', async () => {
      const notification: Notification = {
        subject: 'URGENT: Opposition Filed',
        message: 'Trademark opposition requires immediate attention',
        priority: 'high', // Should be overridden to 'critical'
        assetType: 'trademark',
        assetId: 'tm-123',
      };

      await service.sendCriticalAlert(notification);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.TopicArn).toBe(testTopics.criticalAlertsTopic);
    });

    it('should always set priority to critical', async () => {
      const notification: Notification = {
        subject: 'Test Critical',
        message: 'Test Message',
        priority: 'low', // Should be overridden
      };

      await service.sendCriticalAlert(notification);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.MessageAttributes.priority.StringValue).toBe('critical');
    });
  });

  describe('sendTradeSecretAlert', () => {
    it('should publish to the trade secret alerts topic', async () => {
      const notification: Notification = {
        subject: 'Trade Secret Accessed',
        message: 'Secret Formula X was accessed',
        priority: 'high',
        assetType: 'trade_secret',
        assetId: 'ts-001',
      };

      await service.sendTradeSecretAlert(notification);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.TopicArn).toBe(testTopics.tradeSecretAlertsTopic);
    });
  });

  describe('sendIPEvent', () => {
    it('should publish to the IP events topic', async () => {
      const notification: Notification = {
        subject: 'Patent Granted',
        message: 'Patent application approved',
        priority: 'medium',
        assetType: 'patent',
        assetId: 'patent-456',
      };

      await service.sendIPEvent(notification);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.TopicArn).toBe(testTopics.ipEventsTopic);
    });
  });

  describe('sendCrossServiceEvent', () => {
    it('should publish to the cross-service topic', async () => {
      const notification: Notification = {
        subject: 'License Compliance Update',
        message: 'License agreement requires compliance review',
        priority: 'medium',
        assetType: 'license',
        assetId: 'lic-789',
      };

      await service.sendCrossServiceEvent(notification);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.TopicArn).toBe(testTopics.crossServiceTopic);
    });
  });

  // ===========================================================================
  // SUBJECT TRUNCATION TESTS
  // ===========================================================================

  describe('subject truncation', () => {
    it('should truncate subjects longer than 100 characters', async () => {
      const longSubject = 'A'.repeat(150);
      const notification: Notification = {
        subject: longSubject,
        message: 'Test message',
        priority: 'low',
      };

      await service.sendDeadlineAlert(notification);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Subject).toBe('A'.repeat(100));
      expect(command.input.Subject.length).toBe(100);
    });

    it('should not truncate subjects at or under 100 characters', async () => {
      const exactSubject = 'B'.repeat(100);
      const notification: Notification = {
        subject: exactSubject,
        message: 'Test message',
        priority: 'low',
      };

      await service.sendDeadlineAlert(notification);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Subject).toBe(exactSubject);
      expect(command.input.Subject.length).toBe(100);
    });

    it('should handle short subjects without modification', async () => {
      const shortSubject = 'Short Subject';
      const notification: Notification = {
        subject: shortSubject,
        message: 'Test message',
        priority: 'low',
      };

      await service.sendDeadlineAlert(notification);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Subject).toBe(shortSubject);
    });
  });

  // ===========================================================================
  // MESSAGE ATTRIBUTE CONSTRUCTION TESTS
  // ===========================================================================

  describe('message attribute construction', () => {
    it('should only include priority for minimal notification', async () => {
      const notification: Notification = {
        subject: 'Minimal',
        message: 'Minimal message',
        priority: 'low',
      };

      await service.sendDeadlineAlert(notification);

      const command = mockSend.mock.calls[0][0];
      const attrs = command.input.MessageAttributes;

      expect(attrs.priority).toBeDefined();
      expect(attrs.assetType).toBeUndefined();
      expect(attrs.assetId).toBeUndefined();
      expect(attrs.deadlineId).toBeUndefined();
      expect(attrs.dueDate).toBeUndefined();
    });

    it('should handle optional fields correctly', async () => {
      const notification: Notification = {
        subject: 'Partial Fields',
        message: 'Test',
        priority: 'medium',
        assetType: 'patent',
        // assetId, deadlineId, dueDate intentionally omitted
      };

      await service.sendDeadlineAlert(notification);

      const command = mockSend.mock.calls[0][0];
      const attrs = command.input.MessageAttributes;

      expect(attrs.priority).toBeDefined();
      expect(attrs.assetType).toBeDefined();
      expect(attrs.assetId).toBeUndefined();
    });

    it('should merge custom attributes with standard attributes', async () => {
      const notification: Notification = {
        subject: 'Custom Attrs',
        message: 'Test',
        priority: 'high',
        assetType: 'domain',
        attributes: {
          registrar: 'GoDaddy',
          linkedTrademark: 'TM-001',
        },
      };

      await service.sendDeadlineAlert(notification);

      const command = mockSend.mock.calls[0][0];
      const attrs = command.input.MessageAttributes;

      // Standard attributes
      expect(attrs.priority.StringValue).toBe('high');
      expect(attrs.assetType.StringValue).toBe('domain');

      // Custom attributes
      expect(attrs.registrar).toEqual({ DataType: 'String', StringValue: 'GoDaddy' });
      expect(attrs.linkedTrademark).toEqual({ DataType: 'String', StringValue: 'TM-001' });
    });
  });

  // ===========================================================================
  // PATENT MAINTENANCE ALERT TESTS
  // ===========================================================================

  describe('sendPatentMaintenanceAlert', () => {
    const baseParams = {
      patentId: 'patent-maint-001',
      patentNumber: 'US12,345,678',
      title: 'Widget Manufacturing Method',
      feeWindow: '3.5 Year',
      dueDate: new Date('2024-06-15'),
      amount: 1600,
      currency: 'USD',
      jurisdiction: 'US',
    };

    describe('priority calculation based on daysUntilDue', () => {
      it('should set critical priority for <= 7 days', async () => {
        await service.sendPatentMaintenanceAlert({
          ...baseParams,
          daysUntilDue: 7,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('critical');
      });

      it('should set critical priority for 1 day', async () => {
        await service.sendPatentMaintenanceAlert({
          ...baseParams,
          daysUntilDue: 1,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('critical');
      });

      it('should set high priority for 8-30 days', async () => {
        await service.sendPatentMaintenanceAlert({
          ...baseParams,
          daysUntilDue: 30,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('high');
      });

      it('should set high priority for 8 days (boundary)', async () => {
        await service.sendPatentMaintenanceAlert({
          ...baseParams,
          daysUntilDue: 8,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('high');
      });

      it('should set medium priority for 31-90 days', async () => {
        await service.sendPatentMaintenanceAlert({
          ...baseParams,
          daysUntilDue: 90,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('medium');
      });

      it('should set medium priority for 31 days (boundary)', async () => {
        await service.sendPatentMaintenanceAlert({
          ...baseParams,
          daysUntilDue: 31,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('medium');
      });

      it('should set low priority for > 90 days', async () => {
        await service.sendPatentMaintenanceAlert({
          ...baseParams,
          daysUntilDue: 91,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('low');
      });

      it('should set low priority for 180 days', async () => {
        await service.sendPatentMaintenanceAlert({
          ...baseParams,
          daysUntilDue: 180,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('low');
      });
    });

    it('should format subject with patent number', async () => {
      await service.sendPatentMaintenanceAlert({
        ...baseParams,
        daysUntilDue: 30,
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Subject).toBe('Patent Maintenance Fee Due: US12,345,678');
    });

    it('should format message with all details', async () => {
      await service.sendPatentMaintenanceAlert({
        ...baseParams,
        daysUntilDue: 30,
      });

      const command = mockSend.mock.calls[0][0];
      const message = command.input.Message;

      expect(message).toContain('Patent Maintenance Fee Due');
      expect(message).toContain('US12,345,678');
      expect(message).toContain('Widget Manufacturing Method');
      expect(message).toContain('3.5 Year');
      expect(message).toContain('1600 USD');
      expect(message).toContain('US');
      expect(message).toContain('30');
    });

    it('should include custom attributes for patent maintenance', async () => {
      await service.sendPatentMaintenanceAlert({
        ...baseParams,
        daysUntilDue: 30,
      });

      const command = mockSend.mock.calls[0][0];
      const attrs = command.input.MessageAttributes;

      expect(attrs.patentNumber.StringValue).toBe('US12,345,678');
      expect(attrs.feeWindow.StringValue).toBe('3.5 Year');
      expect(attrs.jurisdiction.StringValue).toBe('US');
      expect(attrs.amount.StringValue).toBe('1600');
      expect(attrs.currency.StringValue).toBe('USD');
      expect(attrs.daysUntilDue.StringValue).toBe('30');
    });

    it('should set assetType to patent', async () => {
      await service.sendPatentMaintenanceAlert({
        ...baseParams,
        daysUntilDue: 30,
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.MessageAttributes.assetType.StringValue).toBe('patent');
    });
  });

  // ===========================================================================
  // TRADEMARK RENEWAL ALERT TESTS
  // ===========================================================================

  describe('sendTrademarkRenewalAlert', () => {
    const baseParams = {
      trademarkId: 'tm-renew-001',
      registrationNumber: '5,123,456',
      mark: 'ACME BRAND',
      dueDate: new Date('2024-09-15'),
      jurisdiction: 'US',
    };

    describe('priority calculation based on daysUntilDue', () => {
      it('should set critical priority for <= 30 days', async () => {
        await service.sendTrademarkRenewalAlert({
          ...baseParams,
          daysUntilDue: 30,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('critical');
      });

      it('should set critical priority for 1 day', async () => {
        await service.sendTrademarkRenewalAlert({
          ...baseParams,
          daysUntilDue: 1,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('critical');
      });

      it('should set high priority for 31-90 days', async () => {
        await service.sendTrademarkRenewalAlert({
          ...baseParams,
          daysUntilDue: 90,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('high');
      });

      it('should set high priority for 31 days (boundary)', async () => {
        await service.sendTrademarkRenewalAlert({
          ...baseParams,
          daysUntilDue: 31,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('high');
      });

      it('should set medium priority for 91-180 days', async () => {
        await service.sendTrademarkRenewalAlert({
          ...baseParams,
          daysUntilDue: 180,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('medium');
      });

      it('should set medium priority for 91 days (boundary)', async () => {
        await service.sendTrademarkRenewalAlert({
          ...baseParams,
          daysUntilDue: 91,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('medium');
      });

      it('should set low priority for > 180 days', async () => {
        await service.sendTrademarkRenewalAlert({
          ...baseParams,
          daysUntilDue: 181,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('low');
      });

      it('should set low priority for 365 days', async () => {
        await service.sendTrademarkRenewalAlert({
          ...baseParams,
          daysUntilDue: 365,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('low');
      });
    });

    it('should format subject with mark name', async () => {
      await service.sendTrademarkRenewalAlert({
        ...baseParams,
        daysUntilDue: 60,
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Subject).toBe('Trademark Renewal Due: ACME BRAND');
    });

    it('should format message with all details', async () => {
      await service.sendTrademarkRenewalAlert({
        ...baseParams,
        daysUntilDue: 60,
      });

      const command = mockSend.mock.calls[0][0];
      const message = command.input.Message;

      expect(message).toContain('Trademark Renewal Due');
      expect(message).toContain('5,123,456');
      expect(message).toContain('ACME BRAND');
      expect(message).toContain('US');
      expect(message).toContain('60');
    });

    it('should set assetType to trademark', async () => {
      await service.sendTrademarkRenewalAlert({
        ...baseParams,
        daysUntilDue: 60,
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.MessageAttributes.assetType.StringValue).toBe('trademark');
    });
  });

  // ===========================================================================
  // DOMAIN EXPIRATION ALERT TESTS
  // ===========================================================================

  describe('sendDomainExpirationAlert', () => {
    const baseParams = {
      domainId: 'domain-001',
      domainName: 'example.com',
      expirationDate: new Date('2024-12-31'),
      registrar: 'Namecheap',
    };

    describe('priority calculation based on daysUntilExpiration', () => {
      it('should set critical priority for <= 7 days', async () => {
        await service.sendDomainExpirationAlert({
          ...baseParams,
          daysUntilExpiration: 7,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('critical');
      });

      it('should set critical priority for 1 day', async () => {
        await service.sendDomainExpirationAlert({
          ...baseParams,
          daysUntilExpiration: 1,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('critical');
      });

      it('should set high priority for 8-30 days', async () => {
        await service.sendDomainExpirationAlert({
          ...baseParams,
          daysUntilExpiration: 30,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('high');
      });

      it('should set high priority for 8 days (boundary)', async () => {
        await service.sendDomainExpirationAlert({
          ...baseParams,
          daysUntilExpiration: 8,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('high');
      });

      it('should set medium priority for 31-60 days', async () => {
        await service.sendDomainExpirationAlert({
          ...baseParams,
          daysUntilExpiration: 60,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('medium');
      });

      it('should set medium priority for 31 days (boundary)', async () => {
        await service.sendDomainExpirationAlert({
          ...baseParams,
          daysUntilExpiration: 31,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('medium');
      });

      it('should set low priority for > 60 days', async () => {
        await service.sendDomainExpirationAlert({
          ...baseParams,
          daysUntilExpiration: 61,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('low');
      });

      it('should set low priority for 365 days', async () => {
        await service.sendDomainExpirationAlert({
          ...baseParams,
          daysUntilExpiration: 365,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('low');
      });
    });

    it('should format subject with domain name', async () => {
      await service.sendDomainExpirationAlert({
        ...baseParams,
        daysUntilExpiration: 30,
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Subject).toBe('Domain Expiring: example.com');
    });

    it('should format message with all details', async () => {
      await service.sendDomainExpirationAlert({
        ...baseParams,
        daysUntilExpiration: 30,
      });

      const command = mockSend.mock.calls[0][0];
      const message = command.input.Message;

      expect(message).toContain('Domain Expiration Alert');
      expect(message).toContain('example.com');
      expect(message).toContain('Namecheap');
      expect(message).toContain('30');
    });

    it('should include linked trademark when provided', async () => {
      await service.sendDomainExpirationAlert({
        ...baseParams,
        linkedTrademark: 'EXAMPLE BRAND',
        daysUntilExpiration: 30,
      });

      const command = mockSend.mock.calls[0][0];
      const message = command.input.Message;
      const attrs = command.input.MessageAttributes;

      expect(message).toContain('Linked Trademark: EXAMPLE BRAND');
      expect(attrs.linkedTrademark.StringValue).toBe('EXAMPLE BRAND');
    });

    it('should not include linkedTrademark attribute when not provided', async () => {
      await service.sendDomainExpirationAlert({
        ...baseParams,
        daysUntilExpiration: 30,
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.MessageAttributes.linkedTrademark).toBeUndefined();
    });

    it('should set assetType to domain', async () => {
      await service.sendDomainExpirationAlert({
        ...baseParams,
        daysUntilExpiration: 30,
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.MessageAttributes.assetType.StringValue).toBe('domain');
    });
  });

  // ===========================================================================
  // TRADE SECRET ACCESS ALERT TESTS
  // ===========================================================================

  describe('sendTradeSecretAccessedAlert', () => {
    const baseParams = {
      tradeSecretId: 'ts-001',
      tradeSecretName: 'Secret Formula X',
      accessedBy: 'user-123',
      accessedAt: new Date('2024-03-15T14:30:00Z'),
      purpose: 'R&D Review',
    };

    describe('priority calculation based on access level', () => {
      it('should set critical priority for export access', async () => {
        await service.sendTradeSecretAccessedAlert({
          ...baseParams,
          accessLevel: 'export',
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('critical');
      });

      it('should set high priority for modify access', async () => {
        await service.sendTradeSecretAccessedAlert({
          ...baseParams,
          accessLevel: 'modify',
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('high');
      });

      it('should set medium priority for view access', async () => {
        await service.sendTradeSecretAccessedAlert({
          ...baseParams,
          accessLevel: 'view',
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('medium');
      });
    });

    it('should format subject with trade secret name', async () => {
      await service.sendTradeSecretAccessedAlert({
        ...baseParams,
        accessLevel: 'view',
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Subject).toBe('Trade Secret Access: Secret Formula X');
    });

    it('should format message with all details', async () => {
      await service.sendTradeSecretAccessedAlert({
        ...baseParams,
        accessLevel: 'view',
      });

      const command = mockSend.mock.calls[0][0];
      const message = command.input.Message;

      expect(message).toContain('Trade Secret Access Notification');
      expect(message).toContain('Secret Formula X');
      expect(message).toContain('user-123');
      expect(message).toContain('view');
      expect(message).toContain('R&D Review');
    });

    it('should include IP address when provided', async () => {
      await service.sendTradeSecretAccessedAlert({
        ...baseParams,
        accessLevel: 'view',
        ipAddress: '192.168.1.100',
      });

      const command = mockSend.mock.calls[0][0];
      const message = command.input.Message;
      const attrs = command.input.MessageAttributes;

      expect(message).toContain('IP Address: 192.168.1.100');
      expect(attrs.ipAddress.StringValue).toBe('192.168.1.100');
    });

    it('should not include ipAddress attribute when not provided', async () => {
      await service.sendTradeSecretAccessedAlert({
        ...baseParams,
        accessLevel: 'view',
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.MessageAttributes.ipAddress).toBeUndefined();
    });

    it('should publish to trade secret alerts topic', async () => {
      await service.sendTradeSecretAccessedAlert({
        ...baseParams,
        accessLevel: 'view',
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.TopicArn).toBe(testTopics.tradeSecretAlertsTopic);
    });

    it('should set assetType to trade_secret', async () => {
      await service.sendTradeSecretAccessedAlert({
        ...baseParams,
        accessLevel: 'view',
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.MessageAttributes.assetType.StringValue).toBe('trade_secret');
    });
  });

  // ===========================================================================
  // TRADEMARK OPPOSITION ALERT TESTS
  // ===========================================================================

  describe('sendTrademarkOppositionAlert', () => {
    const baseParams = {
      trademarkId: 'tm-opp-001',
      registrationNumber: '5,456,789',
      mark: 'MEGA BRAND',
      opposer: 'Competitor Corp',
      filedDate: new Date('2024-04-01'),
      responseDeadline: new Date('2024-05-01'),
      jurisdiction: 'US',
    };

    it('should always set critical priority', async () => {
      await service.sendTrademarkOppositionAlert(baseParams);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.MessageAttributes.priority.StringValue).toBe('critical');
    });

    it('should publish to critical alerts topic', async () => {
      await service.sendTrademarkOppositionAlert(baseParams);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.TopicArn).toBe(testTopics.criticalAlertsTopic);
    });

    it('should format subject with URGENT prefix and mark name', async () => {
      await service.sendTrademarkOppositionAlert(baseParams);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Subject).toBe('URGENT: Trademark Opposition Filed - MEGA BRAND');
    });

    it('should format message with all details', async () => {
      await service.sendTrademarkOppositionAlert(baseParams);

      const command = mockSend.mock.calls[0][0];
      const message = command.input.Message;

      expect(message).toContain('URGENT: Trademark Opposition Filed');
      expect(message).toContain('5,456,789');
      expect(message).toContain('MEGA BRAND');
      expect(message).toContain('Competitor Corp');
      expect(message).toContain('US');
      expect(message).toContain('Immediate action required');
    });

    it('should include all relevant attributes', async () => {
      await service.sendTrademarkOppositionAlert(baseParams);

      const command = mockSend.mock.calls[0][0];
      const attrs = command.input.MessageAttributes;

      expect(attrs.registrationNumber.StringValue).toBe('5,456,789');
      expect(attrs.mark.StringValue).toBe('MEGA BRAND');
      expect(attrs.opposer.StringValue).toBe('Competitor Corp');
      expect(attrs.jurisdiction.StringValue).toBe('US');
      expect(attrs.assetType.StringValue).toBe('trademark');
    });
  });

  // ===========================================================================
  // DOMAIN DISPUTE ALERT TESTS
  // ===========================================================================

  describe('sendDomainDisputeAlert', () => {
    const baseParams = {
      domainId: 'domain-dispute-001',
      domainName: 'example-brand.com',
      complainant: 'Example Corp',
      provider: 'WIPO',
      filedDate: new Date('2024-05-01'),
      responseDeadline: new Date('2024-05-21'),
    };

    it('should always set critical priority', async () => {
      await service.sendDomainDisputeAlert(baseParams);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.MessageAttributes.priority.StringValue).toBe('critical');
    });

    it('should publish to critical alerts topic', async () => {
      await service.sendDomainDisputeAlert(baseParams);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.TopicArn).toBe(testTopics.criticalAlertsTopic);
    });

    it('should format subject with URGENT prefix and UDRP indication', async () => {
      await service.sendDomainDisputeAlert(baseParams);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Subject).toBe('URGENT: UDRP Dispute Filed - example-brand.com');
    });

    it('should format message with all details', async () => {
      await service.sendDomainDisputeAlert(baseParams);

      const command = mockSend.mock.calls[0][0];
      const message = command.input.Message;

      expect(message).toContain('URGENT: UDRP Domain Dispute Filed');
      expect(message).toContain('example-brand.com');
      expect(message).toContain('Example Corp');
      expect(message).toContain('WIPO');
      expect(message).toContain('Response typically required within 20 days');
    });

    it('should include all relevant attributes', async () => {
      await service.sendDomainDisputeAlert(baseParams);

      const command = mockSend.mock.calls[0][0];
      const attrs = command.input.MessageAttributes;

      expect(attrs.domainName.StringValue).toBe('example-brand.com');
      expect(attrs.complainant.StringValue).toBe('Example Corp');
      expect(attrs.provider.StringValue).toBe('WIPO');
      expect(attrs.assetType.StringValue).toBe('domain');
    });
  });

  // ===========================================================================
  // LICENSE ROYALTY ALERT TESTS
  // ===========================================================================

  describe('sendLicenseRoyaltyAlert', () => {
    const baseParams = {
      licenseId: 'lic-royalty-001',
      licenseeName: 'Licensee Corp',
      assetDescription: 'Patent Portfolio A',
      dueDate: new Date('2024-06-30'),
      amount: 50000,
      currency: 'USD',
    };

    describe('priority calculation based on daysUntilDue', () => {
      it('should set high priority for <= 7 days', async () => {
        await service.sendLicenseRoyaltyAlert({
          ...baseParams,
          daysUntilDue: 7,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('high');
      });

      it('should set high priority for 1 day', async () => {
        await service.sendLicenseRoyaltyAlert({
          ...baseParams,
          daysUntilDue: 1,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('high');
      });

      it('should set medium priority for 8-30 days', async () => {
        await service.sendLicenseRoyaltyAlert({
          ...baseParams,
          daysUntilDue: 30,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('medium');
      });

      it('should set medium priority for 8 days (boundary)', async () => {
        await service.sendLicenseRoyaltyAlert({
          ...baseParams,
          daysUntilDue: 8,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('medium');
      });

      it('should set low priority for > 30 days', async () => {
        await service.sendLicenseRoyaltyAlert({
          ...baseParams,
          daysUntilDue: 31,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('low');
      });

      it('should set low priority for 90 days', async () => {
        await service.sendLicenseRoyaltyAlert({
          ...baseParams,
          daysUntilDue: 90,
        });

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe('low');
      });
    });

    it('should format subject with licensee name', async () => {
      await service.sendLicenseRoyaltyAlert({
        ...baseParams,
        daysUntilDue: 30,
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Subject).toBe('License Royalty Due: Licensee Corp');
    });

    it('should format message with all details', async () => {
      await service.sendLicenseRoyaltyAlert({
        ...baseParams,
        daysUntilDue: 30,
      });

      const command = mockSend.mock.calls[0][0];
      const message = command.input.Message;

      expect(message).toContain('License Royalty Payment Due');
      expect(message).toContain('Licensee Corp');
      expect(message).toContain('Patent Portfolio A');
      expect(message).toContain('50000 USD');
      expect(message).toContain('30');
    });

    it('should set assetType to license', async () => {
      await service.sendLicenseRoyaltyAlert({
        ...baseParams,
        daysUntilDue: 30,
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.MessageAttributes.assetType.StringValue).toBe('license');
    });

    it('should publish to deadline alerts topic', async () => {
      await service.sendLicenseRoyaltyAlert({
        ...baseParams,
        daysUntilDue: 30,
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.TopicArn).toBe(testTopics.deadlineAlertsTopic);
    });
  });

  // ===========================================================================
  // BATCH PUBLISHING TESTS
  // ===========================================================================

  describe('sendBatch', () => {
    const createNotification = (index: number): Notification => ({
      subject: `Test Subject ${index}`,
      message: `Test Message ${index}`,
      priority: 'medium' as NotificationPriority,
      assetType: 'patent',
      assetId: `asset-${index}`,
    });

    it('should batch notifications into chunks of 10', async () => {
      mockSend.mockResolvedValue({
        Successful: Array.from({ length: 10 }, (_, i) => ({ Id: `msg-${i}`, MessageId: `mid-${i}` })),
        Failed: [],
      });

      const notifications = Array.from({ length: 25 }, (_, i) => createNotification(i));

      await service.sendBatch(testTopics.deadlineAlertsTopic, notifications);

      // Should have 3 batches: 10, 10, 5
      expect(mockSend).toHaveBeenCalledTimes(3);

      const firstCall = mockSend.mock.calls[0][0];
      expect(firstCall).toBeInstanceOf(PublishBatchCommand);
      expect(firstCall.input.PublishBatchRequestEntries).toHaveLength(10);

      const secondCall = mockSend.mock.calls[1][0];
      expect(secondCall.input.PublishBatchRequestEntries).toHaveLength(10);

      const thirdCall = mockSend.mock.calls[2][0];
      expect(thirdCall.input.PublishBatchRequestEntries).toHaveLength(5);
    });

    it('should return correct success count', async () => {
      mockSend.mockResolvedValue({
        Successful: Array.from({ length: 5 }, (_, i) => ({ Id: `msg-${i}`, MessageId: `mid-${i}` })),
        Failed: [],
      });

      const notifications = Array.from({ length: 5 }, (_, i) => createNotification(i));

      const result = await service.sendBatch(testTopics.deadlineAlertsTopic, notifications);

      expect(result.successCount).toBe(5);
      expect(result.failedCount).toBe(0);
      expect(result.failedNotifications).toHaveLength(0);
    });

    it('should handle partial batch failures', async () => {
      mockSend.mockResolvedValue({
        Successful: [
          { Id: 'msg-0', MessageId: 'mid-0' },
          { Id: 'msg-2', MessageId: 'mid-2' },
          { Id: 'msg-4', MessageId: 'mid-4' },
        ],
        Failed: [
          { Id: 'msg-1', Code: 'ValidationError', Message: 'Invalid message' },
          { Id: 'msg-3', Code: 'InternalFailure', Message: 'Internal error' },
        ],
      });

      const notifications = Array.from({ length: 5 }, (_, i) => createNotification(i));

      const result = await service.sendBatch(testTopics.deadlineAlertsTopic, notifications);

      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(2);
      expect(result.failedNotifications).toHaveLength(2);

      expect(result.failedNotifications[0]).toEqual({
        notification: notifications[1],
        errorCode: 'ValidationError',
        errorMessage: 'Invalid message',
      });

      expect(result.failedNotifications[1]).toEqual({
        notification: notifications[3],
        errorCode: 'InternalFailure',
        errorMessage: 'Internal error',
      });
    });

    it('should handle complete batch failure (exception)', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));

      const notifications = Array.from({ length: 3 }, (_, i) => createNotification(i));

      const result = await service.sendBatch(testTopics.deadlineAlertsTopic, notifications);

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(3);
      expect(result.failedNotifications).toHaveLength(3);

      result.failedNotifications.forEach((failure, index) => {
        expect(failure.notification).toEqual(notifications[index]);
        expect(failure.errorCode).toBe('BATCH_FAILED');
        expect(failure.errorMessage).toBe('Network error');
      });
    });

    it('should handle mixed success and complete failure across batches', async () => {
      // First batch succeeds
      mockSend
        .mockResolvedValueOnce({
          Successful: Array.from({ length: 10 }, (_, i) => ({ Id: `msg-${i}`, MessageId: `mid-${i}` })),
          Failed: [],
        })
        // Second batch fails completely
        .mockRejectedValueOnce(new Error('Service unavailable'));

      const notifications = Array.from({ length: 15 }, (_, i) => createNotification(i));

      const result = await service.sendBatch(testTopics.deadlineAlertsTopic, notifications);

      expect(result.successCount).toBe(10);
      expect(result.failedCount).toBe(5);
      expect(result.failedNotifications).toHaveLength(5);
    });

    it('should truncate subjects in batch entries', async () => {
      mockSend.mockResolvedValue({
        Successful: [{ Id: 'msg-0', MessageId: 'mid-0' }],
        Failed: [],
      });

      const longSubjectNotification: Notification = {
        subject: 'X'.repeat(150),
        message: 'Test message',
        priority: 'low',
      };

      await service.sendBatch(testTopics.deadlineAlertsTopic, [longSubjectNotification]);

      const command = mockSend.mock.calls[0][0];
      const entry = command.input.PublishBatchRequestEntries[0];

      expect(entry.Subject).toBe('X'.repeat(100));
      expect(entry.Subject.length).toBe(100);
    });

    it('should build message attributes for each entry', async () => {
      mockSend.mockResolvedValue({
        Successful: [{ Id: 'msg-0', MessageId: 'mid-0' }],
        Failed: [],
      });

      const notification: Notification = {
        subject: 'Test',
        message: 'Test message',
        priority: 'high',
        assetType: 'trademark',
        assetId: 'tm-batch-001',
        attributes: {
          customKey: 'customValue',
        },
      };

      await service.sendBatch(testTopics.deadlineAlertsTopic, [notification]);

      const command = mockSend.mock.calls[0][0];
      const entry = command.input.PublishBatchRequestEntries[0];

      expect(entry.MessageAttributes.priority).toEqual({ DataType: 'String', StringValue: 'high' });
      expect(entry.MessageAttributes.assetType).toEqual({ DataType: 'String', StringValue: 'trademark' });
      expect(entry.MessageAttributes.assetId).toEqual({ DataType: 'String', StringValue: 'tm-batch-001' });
      expect(entry.MessageAttributes.customKey).toEqual({ DataType: 'String', StringValue: 'customValue' });
    });

    it('should assign unique IDs to batch entries', async () => {
      mockSend.mockResolvedValue({
        Successful: Array.from({ length: 5 }, (_, i) => ({ Id: `msg-${i}`, MessageId: `mid-${i}` })),
        Failed: [],
      });

      const notifications = Array.from({ length: 5 }, (_, i) => createNotification(i));

      await service.sendBatch(testTopics.deadlineAlertsTopic, notifications);

      const command = mockSend.mock.calls[0][0];
      const entries = command.input.PublishBatchRequestEntries;

      expect(entries[0].Id).toBe('msg-0');
      expect(entries[1].Id).toBe('msg-1');
      expect(entries[2].Id).toBe('msg-2');
      expect(entries[3].Id).toBe('msg-3');
      expect(entries[4].Id).toBe('msg-4');
    });

    it('should handle empty notification array', async () => {
      const result = await service.sendBatch(testTopics.deadlineAlertsTopic, []);

      expect(mockSend).not.toHaveBeenCalled();
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.failedNotifications).toHaveLength(0);
    });

    it('should handle exactly 10 notifications (single batch)', async () => {
      mockSend.mockResolvedValue({
        Successful: Array.from({ length: 10 }, (_, i) => ({ Id: `msg-${i}`, MessageId: `mid-${i}` })),
        Failed: [],
      });

      const notifications = Array.from({ length: 10 }, (_, i) => createNotification(i));

      const result = await service.sendBatch(testTopics.deadlineAlertsTopic, notifications);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result.successCount).toBe(10);
    });

    it('should handle 11 notifications (two batches)', async () => {
      mockSend
        .mockResolvedValueOnce({
          Successful: Array.from({ length: 10 }, (_, i) => ({ Id: `msg-${i}`, MessageId: `mid-${i}` })),
          Failed: [],
        })
        .mockResolvedValueOnce({
          Successful: [{ Id: 'msg-0', MessageId: 'mid-10' }],
          Failed: [],
        });

      const notifications = Array.from({ length: 11 }, (_, i) => createNotification(i));

      const result = await service.sendBatch(testTopics.deadlineAlertsTopic, notifications);

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(result.successCount).toBe(11);
    });

    it('should handle failure with missing error code/message', async () => {
      mockSend.mockResolvedValue({
        Successful: [],
        Failed: [
          { Id: 'msg-0' }, // Missing Code and Message
        ],
      });

      const notifications = [createNotification(0)];

      const result = await service.sendBatch(testTopics.deadlineAlertsTopic, notifications);

      expect(result.failedCount).toBe(1);
      expect(result.failedNotifications[0].errorCode).toBe('UNKNOWN');
      expect(result.failedNotifications[0].errorMessage).toBe('Unknown error');
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    it('should propagate errors from SNS publish', async () => {
      mockSend.mockRejectedValue(new Error('SNS publish failed'));

      const notification: Notification = {
        subject: 'Test',
        message: 'Test message',
        priority: 'low',
      };

      await expect(service.sendDeadlineAlert(notification)).rejects.toThrow('SNS publish failed');
    });

    it('should return empty message ID when response has no MessageId', async () => {
      mockSend.mockResolvedValue({});

      const notification: Notification = {
        subject: 'Test',
        message: 'Test message',
        priority: 'low',
      };

      const messageId = await service.sendDeadlineAlert(notification);

      expect(messageId).toBe('');
    });

    it('should handle non-Error exceptions in batch processing', async () => {
      mockSend.mockRejectedValue('String error');

      const notifications = [createNotification(0)];

      const result = await service.sendBatch(testTopics.deadlineAlertsTopic, notifications);

      expect(result.failedCount).toBe(1);
      expect(result.failedNotifications[0].errorMessage).toBe('Unknown error');
    });

    function createNotification(index: number): Notification {
      return {
        subject: `Test Subject ${index}`,
        message: `Test Message ${index}`,
        priority: 'medium',
      };
    }
  });

  // ===========================================================================
  // TOPIC CONFIGURATION TESTS
  // ===========================================================================

  describe('topic configuration', () => {
    it('should use custom topic ARNs when provided', async () => {
      const customService = new SNSNotificationService({
        deadlineAlertsTopic: 'arn:aws:sns:eu-west-1:999999999999:custom-deadline',
        criticalAlertsTopic: 'arn:aws:sns:eu-west-1:999999999999:custom-critical',
        ipEventsTopic: 'arn:aws:sns:eu-west-1:999999999999:custom-events',
        tradeSecretAlertsTopic: 'arn:aws:sns:eu-west-1:999999999999:custom-trade-secret',
        crossServiceTopic: 'arn:aws:sns:eu-west-1:999999999999:custom-cross-service',
      });

      const notification: Notification = {
        subject: 'Test',
        message: 'Test message',
        priority: 'low',
      };

      await customService.sendDeadlineAlert(notification);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.TopicArn).toBe('arn:aws:sns:eu-west-1:999999999999:custom-deadline');
    });

    it('should use default topic ARNs from config when not provided', async () => {
      // Service created without options uses defaults from awsConfig
      const defaultService = new SNSNotificationService();

      const notification: Notification = {
        subject: 'Test',
        message: 'Test message',
        priority: 'low',
      };

      await defaultService.sendDeadlineAlert(notification);

      const command = mockSend.mock.calls[0][0];
      // Default ARN pattern from awsConfig
      expect(command.input.TopicArn).toContain('intellectual-property');
      expect(command.input.TopicArn).toContain('deadline-alerts');
    });
  });

  // ===========================================================================
  // PRIORITY LEVEL COMPREHENSIVE TESTS
  // ===========================================================================

  describe('priority levels', () => {
    const priorities: NotificationPriority[] = ['low', 'medium', 'high', 'critical'];

    priorities.forEach(priority => {
      it(`should correctly set ${priority} priority`, async () => {
        const notification: Notification = {
          subject: 'Test',
          message: 'Test message',
          priority,
        };

        await service.sendDeadlineAlert(notification);

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.priority.StringValue).toBe(priority);
      });
    });
  });

  // ===========================================================================
  // ASSET TYPE COMPREHENSIVE TESTS
  // ===========================================================================

  describe('asset types', () => {
    const assetTypes: Array<'patent' | 'trademark' | 'domain' | 'license' | 'trade_secret'> = [
      'patent',
      'trademark',
      'domain',
      'license',
      'trade_secret',
    ];

    assetTypes.forEach(assetType => {
      it(`should correctly set ${assetType} asset type`, async () => {
        const notification: Notification = {
          subject: 'Test',
          message: 'Test message',
          priority: 'low',
          assetType,
          assetId: `${assetType}-123`,
        };

        await service.sendDeadlineAlert(notification);

        const command = mockSend.mock.calls[0][0];
        expect(command.input.MessageAttributes.assetType.StringValue).toBe(assetType);
      });
    });
  });
});
