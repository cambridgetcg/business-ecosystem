/**
 * Notification Service
 *
 * Handles notification delivery via email (AWS SES), with support for
 * obligation reminders, renewal alerts, and contract lifecycle notifications.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { PrismaClient, Notification, NotificationType } from '@prisma/client';
import { logger } from '../lib/logger.js';

export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface NotificationRequest {
  type: NotificationType;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  recipients: string[];
  scheduledFor?: Date;
  metadata?: Record<string, unknown>;
}

export interface SendResult {
  success: boolean;
  notificationId: string;
  messageId?: string;
  error?: string;
}

export class NotificationService {
  private log = logger.child({ component: 'notification-service' });
  private sesClient: SESClient | null = null;
  private fromAddress: string;
  private enabled: boolean;

  constructor(
    private prisma: PrismaClient,
    config?: {
      region?: string;
      fromAddress?: string;
      enabled?: boolean;
    }
  ) {
    this.enabled = config?.enabled ?? process.env.NOTIFICATIONS_ENABLED === 'true';
    this.fromAddress = config?.fromAddress ?? process.env.SES_FROM_ADDRESS ?? 'noreply@example.com';

    if (this.enabled) {
      this.sesClient = new SESClient({
        region: config?.region ?? process.env.AWS_REGION ?? 'us-east-1',
      });
    } else {
      this.log.warn('Email notifications are disabled');
    }
  }

  async createNotification(request: NotificationRequest): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        type: request.type,
        entityType: request.entityType,
        entityId: request.entityId,
        title: request.title,
        message: request.message,
        recipients: request.recipients,
        scheduledFor: request.scheduledFor,
      },
    });

    this.log.info(
      { notificationId: notification.id, type: request.type },
      'Notification created'
    );

    return notification;
  }

  async sendNotification(notificationId: string): Promise<SendResult> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return {
        success: false,
        notificationId,
        error: 'Notification not found',
      };
    }

    if (notification.sentAt) {
      return {
        success: true,
        notificationId,
        error: 'Notification already sent',
      };
    }

    if (!this.enabled || !this.sesClient) {
      this.log.info(
        { notificationId, recipients: notification.recipients },
        'Email disabled - logging notification'
      );

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { sentAt: new Date() },
      });

      return {
        success: true,
        notificationId,
        messageId: 'log-only',
      };
    }

    try {
      const template = this.getEmailTemplate(notification);

      const command = new SendEmailCommand({
        Source: this.fromAddress,
        Destination: {
          ToAddresses: notification.recipients,
        },
        Message: {
          Subject: { Data: template.subject },
          Body: {
            Html: { Data: template.htmlBody },
            Text: { Data: template.textBody },
          },
        },
      });

      const response = await this.sesClient.send(command);

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { sentAt: new Date() },
      });

      this.log.info(
        { notificationId, messageId: response.MessageId },
        'Notification sent successfully'
      );

      return {
        success: true,
        notificationId,
        messageId: response.MessageId,
      };
    } catch (error) {
      this.log.error({ error, notificationId }, 'Failed to send notification');

      return {
        success: false,
        notificationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendPendingNotifications(batchSize: number = 50): Promise<SendResult[]> {
    const now = new Date();

    const pending = await this.prisma.notification.findMany({
      where: {
        sentAt: null,
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: now } },
        ],
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    const results: SendResult[] = [];

    for (const notification of pending) {
      const result = await this.sendNotification(notification.id);
      results.push(result);
    }

    return results;
  }

  async createObligationReminder(
    contractId: string,
    contractNumber: string,
    obligationId: string,
    obligationType: string,
    description: string,
    dueDate: Date,
    daysUntilDue: number,
    recipients: string[]
  ): Promise<Notification> {
    const title = `Obligation Due: ${obligationType} - ${contractNumber}`;
    const message = `
      Reminder: An obligation is due soon.

      Contract: ${contractNumber}
      Type: ${obligationType}
      Description: ${description}
      Due Date: ${dueDate.toLocaleDateString()}
      Days Until Due: ${daysUntilDue}
    `.trim();

    return this.createNotification({
      type: 'OBLIGATION_DUE',
      entityType: 'Obligation',
      entityId: obligationId,
      title,
      message,
      recipients,
    });
  }

  async createRenewalReminder(
    contractId: string,
    contractNumber: string,
    title: string,
    expiryDate: Date,
    daysUntilExpiry: number,
    autoRenewal: boolean,
    recipients: string[]
  ): Promise<Notification> {
    const notificationTitle = autoRenewal
      ? `Auto-Renewal Upcoming: ${contractNumber}`
      : `Renewal Decision Required: ${contractNumber}`;

    const message = `
      ${autoRenewal ? 'Auto-renewal is approaching' : 'A renewal decision is needed'} for:

      Contract: ${contractNumber}
      Title: ${title}
      Expiry Date: ${expiryDate.toLocaleDateString()}
      Days Until Expiry: ${daysUntilExpiry}

      ${autoRenewal
        ? 'This contract will automatically renew unless action is taken.'
        : 'Please review and decide whether to renew this contract.'
      }
    `.trim();

    return this.createNotification({
      type: 'RENEWAL_REMINDER',
      entityType: 'Contract',
      entityId: contractId,
      title: notificationTitle,
      message,
      recipients,
    });
  }

  async createExpiryWarning(
    contractId: string,
    contractNumber: string,
    title: string,
    expiryDate: Date,
    daysUntilExpiry: number,
    recipients: string[]
  ): Promise<Notification> {
    const notificationTitle = `Contract Expiring Soon: ${contractNumber}`;
    const message = `
      Warning: A contract is expiring soon.

      Contract: ${contractNumber}
      Title: ${title}
      Expiry Date: ${expiryDate.toLocaleDateString()}
      Days Until Expiry: ${daysUntilExpiry}

      Please take appropriate action before the contract expires.
    `.trim();

    return this.createNotification({
      type: 'EXPIRY_WARNING',
      entityType: 'Contract',
      entityId: contractId,
      title: notificationTitle,
      message,
      recipients,
    });
  }

  private getEmailTemplate(notification: Notification): EmailTemplate {
    const baseTemplate = {
      subject: notification.title,
      textBody: notification.message,
    };

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a365d; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f7f7f7; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; }
    .badge-warning { background: #ffc107; color: #000; }
    .badge-info { background: #17a2b8; color: #fff; }
    .badge-danger { background: #dc3545; color: #fff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Contracts & Legal</h1>
    </div>
    <div class="content">
      <h2>${notification.title}</h2>
      <p>${notification.message.replace(/\n/g, '<br>')}</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from the Contracts & Legal system.</p>
      <p>Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return {
      ...baseTemplate,
      htmlBody,
    };
  }
}

export function createNotificationService(
  prisma: PrismaClient,
  config?: {
    region?: string;
    fromAddress?: string;
    enabled?: boolean;
  }
): NotificationService {
  return new NotificationService(prisma, config);
}
