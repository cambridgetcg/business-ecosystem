/**
 * SNS Notification Service for Intellectual Property
 *
 * Sends notifications for IP-related events:
 * - Deadline alerts (maintenance fees, renewals, expirations)
 * - Critical alerts (missed deadlines, oppositions, disputes)
 * - Trade secret access alerts
 * - Cross-service integration events
 *
 * @module infrastructure/aws
 */

import {
  SNSClient,
  PublishCommand,
  PublishBatchCommand,
  type MessageAttributeValue,
} from '@aws-sdk/client-sns';
import { awsConfig } from './config.js';

const client = new SNSClient({ region: awsConfig.region });

/**
 * Notification priority levels.
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Notification structure.
 */
export interface Notification {
  subject: string;
  message: string;
  priority: NotificationPriority;
  assetType?: 'patent' | 'trademark' | 'domain' | 'license' | 'trade_secret' | undefined;
  assetId?: string | undefined;
  deadlineId?: string | undefined;
  dueDate?: Date | undefined;
  attributes?: Record<string, string> | undefined;
}

/**
 * Batch notification result.
 */
export interface BatchNotificationResult {
  successCount: number;
  failedCount: number;
  failedNotifications: Array<{
    notification: Notification;
    errorCode: string;
    errorMessage: string;
  }>;
}

/**
 * SNS Notification Service
 *
 * Manages notifications for IP service alerts.
 */
export class SNSNotificationService {
  private readonly deadlineAlertsTopic: string;
  private readonly criticalAlertsTopic: string;
  private readonly ipEventsTopic: string;
  private readonly tradeSecretAlertsTopic: string;
  private readonly crossServiceTopic: string;

  constructor(options?: {
    deadlineAlertsTopic?: string | undefined;
    criticalAlertsTopic?: string | undefined;
    ipEventsTopic?: string | undefined;
    tradeSecretAlertsTopic?: string | undefined;
    crossServiceTopic?: string | undefined;
  }) {
    this.deadlineAlertsTopic = options?.deadlineAlertsTopic ?? awsConfig.sns.deadlineAlerts;
    this.criticalAlertsTopic = options?.criticalAlertsTopic ?? awsConfig.sns.criticalAlerts;
    this.ipEventsTopic = options?.ipEventsTopic ?? awsConfig.sns.ipEvents;
    this.tradeSecretAlertsTopic = options?.tradeSecretAlertsTopic ?? awsConfig.sns.tradeSecretAlerts;
    this.crossServiceTopic = options?.crossServiceTopic ?? awsConfig.sns.crossService;
  }

  /**
   * Send deadline alert notification.
   */
  async sendDeadlineAlert(notification: Notification): Promise<string> {
    return this.publish(this.deadlineAlertsTopic, notification);
  }

  /**
   * Send critical alert notification.
   */
  async sendCriticalAlert(notification: Notification): Promise<string> {
    return this.publish(this.criticalAlertsTopic, {
      ...notification,
      priority: 'critical',
    });
  }

  /**
   * Send trade secret access alert.
   */
  async sendTradeSecretAlert(notification: Notification): Promise<string> {
    return this.publish(this.tradeSecretAlertsTopic, notification);
  }

  /**
   * Send general IP event notification.
   */
  async sendIPEvent(notification: Notification): Promise<string> {
    return this.publish(this.ipEventsTopic, notification);
  }

  /**
   * Send cross-service notification (for contracts-legal, compliance, etc.).
   */
  async sendCrossServiceEvent(notification: Notification): Promise<string> {
    return this.publish(this.crossServiceTopic, notification);
  }

  /**
   * Send patent maintenance fee alert.
   */
  async sendPatentMaintenanceAlert(params: {
    patentId: string;
    patentNumber: string;
    title: string;
    feeWindow: string;
    dueDate: Date;
    amount: number;
    currency: string;
    jurisdiction: string;
    daysUntilDue: number;
  }): Promise<string> {
    const priority: NotificationPriority = params.daysUntilDue <= 7 ? 'critical' :
                                            params.daysUntilDue <= 30 ? 'high' :
                                            params.daysUntilDue <= 90 ? 'medium' : 'low';

    return this.sendDeadlineAlert({
      subject: `Patent Maintenance Fee Due: ${params.patentNumber}`,
      message: this.formatMaintenanceMessage(params),
      priority,
      assetType: 'patent',
      assetId: params.patentId,
      dueDate: params.dueDate,
      attributes: {
        patentNumber: params.patentNumber,
        feeWindow: params.feeWindow,
        jurisdiction: params.jurisdiction,
        amount: params.amount.toString(),
        currency: params.currency,
        daysUntilDue: params.daysUntilDue.toString(),
      },
    });
  }

  /**
   * Send trademark renewal alert.
   */
  async sendTrademarkRenewalAlert(params: {
    trademarkId: string;
    registrationNumber: string;
    mark: string;
    dueDate: Date;
    jurisdiction: string;
    daysUntilDue: number;
  }): Promise<string> {
    const priority: NotificationPriority = params.daysUntilDue <= 30 ? 'critical' :
                                            params.daysUntilDue <= 90 ? 'high' :
                                            params.daysUntilDue <= 180 ? 'medium' : 'low';

    return this.sendDeadlineAlert({
      subject: `Trademark Renewal Due: ${params.mark}`,
      message: this.formatTrademarkRenewalMessage(params),
      priority,
      assetType: 'trademark',
      assetId: params.trademarkId,
      dueDate: params.dueDate,
      attributes: {
        registrationNumber: params.registrationNumber,
        mark: params.mark,
        jurisdiction: params.jurisdiction,
        daysUntilDue: params.daysUntilDue.toString(),
      },
    });
  }

  /**
   * Send domain expiration alert.
   */
  async sendDomainExpirationAlert(params: {
    domainId: string;
    domainName: string;
    expirationDate: Date;
    registrar: string;
    linkedTrademark?: string | undefined;
    daysUntilExpiration: number;
  }): Promise<string> {
    const priority: NotificationPriority = params.daysUntilExpiration <= 7 ? 'critical' :
                                            params.daysUntilExpiration <= 30 ? 'high' :
                                            params.daysUntilExpiration <= 60 ? 'medium' : 'low';

    return this.sendDeadlineAlert({
      subject: `Domain Expiring: ${params.domainName}`,
      message: this.formatDomainExpirationMessage(params),
      priority,
      assetType: 'domain',
      assetId: params.domainId,
      dueDate: params.expirationDate,
      attributes: {
        domainName: params.domainName,
        registrar: params.registrar,
        daysUntilExpiration: params.daysUntilExpiration.toString(),
        ...(params.linkedTrademark && { linkedTrademark: params.linkedTrademark }),
      },
    });
  }

  /**
   * Send trade secret accessed notification.
   */
  async sendTradeSecretAccessedAlert(params: {
    tradeSecretId: string;
    tradeSecretName: string;
    accessedBy: string;
    accessedAt: Date;
    accessLevel: 'view' | 'export' | 'modify';
    purpose: string;
    ipAddress?: string | undefined;
  }): Promise<string> {
    const priority: NotificationPriority = params.accessLevel === 'export' ? 'critical' :
                                            params.accessLevel === 'modify' ? 'high' : 'medium';

    return this.sendTradeSecretAlert({
      subject: `Trade Secret Access: ${params.tradeSecretName}`,
      message: this.formatTradeSecretAccessMessage(params),
      priority,
      assetType: 'trade_secret',
      assetId: params.tradeSecretId,
      attributes: {
        accessedBy: params.accessedBy,
        accessLevel: params.accessLevel,
        purpose: params.purpose,
        ...(params.ipAddress && { ipAddress: params.ipAddress }),
      },
    });
  }

  /**
   * Send trademark opposition filed alert (critical).
   */
  async sendTrademarkOppositionAlert(params: {
    trademarkId: string;
    registrationNumber: string;
    mark: string;
    opposer: string;
    filedDate: Date;
    responseDeadline: Date;
    jurisdiction: string;
  }): Promise<string> {
    return this.sendCriticalAlert({
      subject: `URGENT: Trademark Opposition Filed - ${params.mark}`,
      message: this.formatOppositionMessage(params),
      priority: 'critical',
      assetType: 'trademark',
      assetId: params.trademarkId,
      dueDate: params.responseDeadline,
      attributes: {
        registrationNumber: params.registrationNumber,
        mark: params.mark,
        opposer: params.opposer,
        jurisdiction: params.jurisdiction,
      },
    });
  }

  /**
   * Send domain dispute (UDRP) alert (critical).
   */
  async sendDomainDisputeAlert(params: {
    domainId: string;
    domainName: string;
    complainant: string;
    provider: string;
    filedDate: Date;
    responseDeadline: Date;
  }): Promise<string> {
    return this.sendCriticalAlert({
      subject: `URGENT: UDRP Dispute Filed - ${params.domainName}`,
      message: this.formatDisputeMessage(params),
      priority: 'critical',
      assetType: 'domain',
      assetId: params.domainId,
      dueDate: params.responseDeadline,
      attributes: {
        domainName: params.domainName,
        complainant: params.complainant,
        provider: params.provider,
      },
    });
  }

  /**
   * Send license royalty due notification.
   */
  async sendLicenseRoyaltyAlert(params: {
    licenseId: string;
    licenseeName: string;
    assetDescription: string;
    dueDate: Date;
    amount: number;
    currency: string;
    daysUntilDue: number;
  }): Promise<string> {
    const priority: NotificationPriority = params.daysUntilDue <= 7 ? 'high' :
                                            params.daysUntilDue <= 30 ? 'medium' : 'low';

    return this.sendDeadlineAlert({
      subject: `License Royalty Due: ${params.licenseeName}`,
      message: this.formatRoyaltyMessage(params),
      priority,
      assetType: 'license',
      assetId: params.licenseId,
      dueDate: params.dueDate,
      attributes: {
        licenseeName: params.licenseeName,
        amount: params.amount.toString(),
        currency: params.currency,
        daysUntilDue: params.daysUntilDue.toString(),
      },
    });
  }

  /**
   * Send batch notifications.
   */
  async sendBatch(
    topicArn: string,
    notifications: Notification[]
  ): Promise<BatchNotificationResult> {
    const result: BatchNotificationResult = {
      successCount: 0,
      failedCount: 0,
      failedNotifications: [],
    };

    // SNS batch limit is 10 messages
    const batches = this.chunk(notifications, 10);

    for (const batch of batches) {
      const entries = batch.map((notification, index) => ({
        Id: `msg-${index}`,
        Subject: notification.subject.substring(0, 100),
        Message: notification.message,
        MessageAttributes: this.buildMessageAttributes(notification),
      }));

      try {
        const command = new PublishBatchCommand({
          TopicArn: topicArn,
          PublishBatchRequestEntries: entries,
        });

        const response = await client.send(command);

        result.successCount += response.Successful?.length ?? 0;

        response.Failed?.forEach(failure => {
          const index = parseInt(failure.Id?.replace('msg-', '') ?? '0', 10);
          result.failedCount++;
          result.failedNotifications.push({
            notification: batch[index] as Notification,
            errorCode: failure.Code ?? 'UNKNOWN',
            errorMessage: failure.Message ?? 'Unknown error',
          });
        });
      } catch (error) {
        batch.forEach(notification => {
          result.failedCount++;
          result.failedNotifications.push({
            notification,
            errorCode: 'BATCH_FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }
    }

    return result;
  }

  /**
   * Publish to a specific topic.
   */
  private async publish(topicArn: string, notification: Notification): Promise<string> {
    const command = new PublishCommand({
      TopicArn: topicArn,
      Subject: notification.subject.substring(0, 100), // SNS subject limit
      Message: notification.message,
      MessageAttributes: this.buildMessageAttributes(notification),
    });

    const response = await client.send(command);
    return response.MessageId ?? '';
  }

  /**
   * Build SNS message attributes.
   */
  private buildMessageAttributes(notification: Notification): Record<string, MessageAttributeValue> {
    const attributes: Record<string, MessageAttributeValue> = {
      priority: { DataType: 'String', StringValue: notification.priority },
    };

    if (notification.assetType) {
      attributes['assetType'] = { DataType: 'String', StringValue: notification.assetType };
    }

    if (notification.assetId) {
      attributes['assetId'] = { DataType: 'String', StringValue: notification.assetId };
    }

    if (notification.deadlineId) {
      attributes['deadlineId'] = { DataType: 'String', StringValue: notification.deadlineId };
    }

    if (notification.dueDate) {
      attributes['dueDate'] = { DataType: 'String', StringValue: notification.dueDate.toISOString() };
    }

    if (notification.attributes) {
      Object.entries(notification.attributes).forEach(([key, value]) => {
        attributes[key] = { DataType: 'String', StringValue: value };
      });
    }

    return attributes;
  }

  /**
   * Format maintenance fee message.
   */
  private formatMaintenanceMessage(params: {
    patentNumber: string;
    title: string;
    feeWindow: string;
    dueDate: Date;
    amount: number;
    currency: string;
    jurisdiction: string;
    daysUntilDue: number;
  }): string {
    return `
Patent Maintenance Fee Due

Patent: ${params.patentNumber}
Title: ${params.title}
Fee Window: ${params.feeWindow}
Due Date: ${params.dueDate.toISOString().split('T')[0]}
Days Until Due: ${params.daysUntilDue}
Amount: ${params.amount} ${params.currency}
Jurisdiction: ${params.jurisdiction}

Please ensure payment is made before the deadline to maintain patent protection.
`.trim();
  }

  /**
   * Format trademark renewal message.
   */
  private formatTrademarkRenewalMessage(params: {
    registrationNumber: string;
    mark: string;
    dueDate: Date;
    jurisdiction: string;
    daysUntilDue: number;
  }): string {
    return `
Trademark Renewal Due

Registration: ${params.registrationNumber}
Mark: ${params.mark}
Due Date: ${params.dueDate.toISOString().split('T')[0]}
Days Until Due: ${params.daysUntilDue}
Jurisdiction: ${params.jurisdiction}

Please file renewal documentation before the deadline to maintain registration.
`.trim();
  }

  /**
   * Format domain expiration message.
   */
  private formatDomainExpirationMessage(params: {
    domainName: string;
    expirationDate: Date;
    registrar: string;
    linkedTrademark?: string | undefined;
    daysUntilExpiration: number;
  }): string {
    let message = `
Domain Expiration Alert

Domain: ${params.domainName}
Expiration Date: ${params.expirationDate.toISOString().split('T')[0]}
Days Until Expiration: ${params.daysUntilExpiration}
Registrar: ${params.registrar}
`;

    if (params.linkedTrademark) {
      message += `Linked Trademark: ${params.linkedTrademark}\n`;
    }

    message += `
Please renew the domain before expiration to avoid loss.
`;

    return message.trim();
  }

  /**
   * Format trade secret access message.
   */
  private formatTradeSecretAccessMessage(params: {
    tradeSecretName: string;
    accessedBy: string;
    accessedAt: Date;
    accessLevel: string;
    purpose: string;
    ipAddress?: string | undefined;
  }): string {
    let message = `
Trade Secret Access Notification

Trade Secret: ${params.tradeSecretName}
Accessed By: ${params.accessedBy}
Access Time: ${params.accessedAt.toISOString()}
Access Level: ${params.accessLevel}
Purpose: ${params.purpose}
`;

    if (params.ipAddress) {
      message += `IP Address: ${params.ipAddress}\n`;
    }

    return message.trim();
  }

  /**
   * Format trademark opposition message.
   */
  private formatOppositionMessage(params: {
    registrationNumber: string;
    mark: string;
    opposer: string;
    filedDate: Date;
    responseDeadline: Date;
    jurisdiction: string;
  }): string {
    return `
URGENT: Trademark Opposition Filed

Registration: ${params.registrationNumber}
Mark: ${params.mark}
Opposer: ${params.opposer}
Filed Date: ${params.filedDate.toISOString().split('T')[0]}
Response Deadline: ${params.responseDeadline.toISOString().split('T')[0]}
Jurisdiction: ${params.jurisdiction}

Immediate action required. Please contact legal counsel.
`.trim();
  }

  /**
   * Format UDRP dispute message.
   */
  private formatDisputeMessage(params: {
    domainName: string;
    complainant: string;
    provider: string;
    filedDate: Date;
    responseDeadline: Date;
  }): string {
    return `
URGENT: UDRP Domain Dispute Filed

Domain: ${params.domainName}
Complainant: ${params.complainant}
Dispute Provider: ${params.provider}
Filed Date: ${params.filedDate.toISOString().split('T')[0]}
Response Deadline: ${params.responseDeadline.toISOString().split('T')[0]}

Response typically required within 20 days. Contact legal counsel immediately.
`.trim();
  }

  /**
   * Format royalty due message.
   */
  private formatRoyaltyMessage(params: {
    licenseeName: string;
    assetDescription: string;
    dueDate: Date;
    amount: number;
    currency: string;
    daysUntilDue: number;
  }): string {
    return `
License Royalty Payment Due

Licensee: ${params.licenseeName}
Licensed Asset: ${params.assetDescription}
Due Date: ${params.dueDate.toISOString().split('T')[0]}
Days Until Due: ${params.daysUntilDue}
Amount: ${params.amount} ${params.currency}

Please ensure royalty collection is tracked and followed up.
`.trim();
  }

  /**
   * Chunk array helper.
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Singleton instance
export const snsNotificationService = new SNSNotificationService();
