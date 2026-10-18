/**
 * SES Email Service for Intellectual Property
 *
 * Sends email notifications for IP-related deadlines and alerts:
 * - Patent maintenance fee reminders
 * - Trademark renewal reminders
 * - Domain expiration reminders
 * - Trade secret review reminders
 * - License royalty due reminders
 * - Critical alerts (oppositions, disputes)
 *
 * @module infrastructure/aws
 */

import {
  SESClient,
  SendEmailCommand,
  SendBulkTemplatedEmailCommand,
  type SendEmailCommandInput,
} from '@aws-sdk/client-ses';
import { awsConfig } from './config.js';
import {
  generateMaintenanceFeeEmail,
  generateTrademarkRenewalEmail,
  generateDomainExpirationEmail,
  generateCriticalAlertEmail,
  generateRoyaltyDueEmail,
  type MaintenanceFeeTemplateData,
  type TrademarkRenewalTemplateData,
  type DomainExpirationTemplateData,
  type CriticalAlertTemplateData,
  type RoyaltyDueTemplateData,
  type EmailContent,
} from './email-templates/index.js';

const client = new SESClient({ region: awsConfig.region });

/**
 * Email send result.
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Batch email send result.
 */
export interface BatchEmailResult {
  successCount: number;
  failedCount: number;
  results: Array<{
    recipient: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

/**
 * Email recipient configuration.
 */
export interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Trade secret review reminder data.
 */
export interface TradeSecretReviewTemplateData {
  tradeSecretId: string;
  name: string;
  classification: 'confidential' | 'highly_confidential' | 'top_secret';
  lastReviewDate: Date;
  nextReviewDate: Date;
  daysUntilReview: number;
  accessCount: number;
  lastAccessDate?: Date;
  custodian: string;
  ownerName: string;
  actionUrl: string;
}

/**
 * SES Email Service
 *
 * Handles email delivery for IP deadline notifications.
 */
export class SESEmailService {
  private readonly fromAddress: string;
  private readonly replyToAddresses: string[];
  private readonly configurationSetName?: string;
  private readonly enabled: boolean;

  constructor(options?: {
    fromAddress?: string;
    replyToAddresses?: string[];
    configurationSetName?: string;
    enabled?: boolean;
  }) {
    this.fromAddress = options?.fromAddress ??
      process.env.SES_FROM_ADDRESS ??
      'ip-notifications@example.com';
    this.replyToAddresses = options?.replyToAddresses ??
      (process.env.SES_REPLY_TO_ADDRESSES?.split(',') ?? []);
    this.configurationSetName = options?.configurationSetName ??
      process.env.SES_CONFIGURATION_SET;
    this.enabled = options?.enabled ??
      process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
  }

  /**
   * Send a single email.
   */
  async sendEmail(
    to: EmailRecipient | EmailRecipient[],
    content: EmailContent,
    options?: {
      cc?: EmailRecipient[];
      bcc?: EmailRecipient[];
      tags?: Record<string, string>;
    }
  ): Promise<EmailSendResult> {
    if (!this.enabled) {
      console.log('[SES] Email disabled - would send:', {
        to,
        subject: content.subject,
      });
      return {
        success: true,
        messageId: 'disabled-mode',
      };
    }

    const toAddresses = Array.isArray(to)
      ? to.map(r => this.formatAddress(r))
      : [this.formatAddress(to)];

    const input: SendEmailCommandInput = {
      Source: this.fromAddress,
      Destination: {
        ToAddresses: toAddresses,
        CcAddresses: options?.cc?.map(r => this.formatAddress(r)),
        BccAddresses: options?.bcc?.map(r => this.formatAddress(r)),
      },
      Message: {
        Subject: {
          Data: content.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: content.html,
            Charset: 'UTF-8',
          },
          Text: {
            Data: content.text,
            Charset: 'UTF-8',
          },
        },
      },
      ReplyToAddresses: this.replyToAddresses.length > 0
        ? this.replyToAddresses
        : undefined,
      ConfigurationSetName: this.configurationSetName,
      Tags: options?.tags
        ? Object.entries(options.tags).map(([Name, Value]) => ({ Name, Value }))
        : undefined,
    };

    try {
      const command = new SendEmailCommand(input);
      const response = await client.send(command);

      return {
        success: true,
        messageId: response.MessageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SES] Failed to send email:', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send batch emails (individual emails to multiple recipients).
   */
  async sendBatchEmails(
    recipients: EmailRecipient[],
    content: EmailContent,
    options?: {
      tags?: Record<string, string>;
    }
  ): Promise<BatchEmailResult> {
    const result: BatchEmailResult = {
      successCount: 0,
      failedCount: 0,
      results: [],
    };

    // Send individual emails to each recipient
    // SES bulk sending is for templated emails; for custom content, we send individually
    for (const recipient of recipients) {
      const sendResult = await this.sendEmail(recipient, content, options);

      result.results.push({
        recipient: recipient.email,
        success: sendResult.success,
        messageId: sendResult.messageId,
        error: sendResult.error,
      });

      if (sendResult.success) {
        result.successCount++;
      } else {
        result.failedCount++;
      }
    }

    return result;
  }

  /**
   * Send patent maintenance fee reminder.
   */
  async sendMaintenanceFeeReminder(
    to: EmailRecipient | EmailRecipient[],
    data: MaintenanceFeeTemplateData
  ): Promise<EmailSendResult> {
    const content = generateMaintenanceFeeEmail(data);
    return this.sendEmail(to, content, {
      tags: {
        emailType: 'maintenance_fee_reminder',
        assetType: 'patent',
        assetId: data.patentId,
        daysUntilDue: data.daysUntilDue.toString(),
      },
    });
  }

  /**
   * Send trademark renewal reminder.
   */
  async sendTrademarkRenewalReminder(
    to: EmailRecipient | EmailRecipient[],
    data: TrademarkRenewalTemplateData
  ): Promise<EmailSendResult> {
    const content = generateTrademarkRenewalEmail(data);
    return this.sendEmail(to, content, {
      tags: {
        emailType: 'trademark_renewal_reminder',
        assetType: 'trademark',
        assetId: data.trademarkId,
        daysUntilDue: data.daysUntilDue.toString(),
      },
    });
  }

  /**
   * Send domain expiration reminder.
   */
  async sendDomainExpirationReminder(
    to: EmailRecipient | EmailRecipient[],
    data: DomainExpirationTemplateData
  ): Promise<EmailSendResult> {
    const content = generateDomainExpirationEmail(data);
    return this.sendEmail(to, content, {
      tags: {
        emailType: 'domain_expiration_reminder',
        assetType: 'domain',
        assetId: data.domainId,
        daysUntilExpiration: data.daysUntilExpiration.toString(),
      },
    });
  }

  /**
   * Send trade secret review reminder.
   */
  async sendTradeSecretReviewReminder(
    to: EmailRecipient | EmailRecipient[],
    data: TradeSecretReviewTemplateData
  ): Promise<EmailSendResult> {
    const content = this.generateTradeSecretReviewEmail(data);
    return this.sendEmail(to, content, {
      tags: {
        emailType: 'trade_secret_review_reminder',
        assetType: 'trade_secret',
        assetId: data.tradeSecretId,
        daysUntilReview: data.daysUntilReview.toString(),
      },
    });
  }

  /**
   * Send license royalty due reminder.
   */
  async sendRoyaltyDueReminder(
    to: EmailRecipient | EmailRecipient[],
    data: RoyaltyDueTemplateData
  ): Promise<EmailSendResult> {
    const content = generateRoyaltyDueEmail(data);
    return this.sendEmail(to, content, {
      tags: {
        emailType: 'royalty_due_reminder',
        assetType: 'license',
        assetId: data.licenseId,
        daysUntilDue: data.daysUntilDue.toString(),
      },
    });
  }

  /**
   * Send critical alert (opposition, dispute, etc.).
   */
  async sendCriticalAlert(
    to: EmailRecipient | EmailRecipient[],
    data: CriticalAlertTemplateData,
    options?: {
      cc?: EmailRecipient[];
    }
  ): Promise<EmailSendResult> {
    const content = generateCriticalAlertEmail(data);
    return this.sendEmail(to, content, {
      cc: options?.cc,
      tags: {
        emailType: 'critical_alert',
        alertType: data.alertType,
        assetId: data.assetId,
      },
    });
  }

  /**
   * Generate trade secret review email content.
   */
  private generateTradeSecretReviewEmail(data: TradeSecretReviewTemplateData): EmailContent {
    const classificationColors: Record<string, string> = {
      confidential: '#ffc107',
      highly_confidential: '#fd7e14',
      top_secret: '#dc3545',
    };

    const classificationLabels: Record<string, string> = {
      confidential: 'Confidential',
      highly_confidential: 'Highly Confidential',
      top_secret: 'Top Secret',
    };

    const badgeColor = classificationColors[data.classification];
    const classificationLabel = classificationLabels[data.classification];
    const formattedReviewDate = data.nextReviewDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = data.daysUntilReview <= 7
      ? `URGENT: Trade Secret Review Due in ${data.daysUntilReview} Days - ${data.name}`
      : `Reminder: Trade Secret Review Approaching - ${data.name}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trade Secret Review Reminder</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
      color: #ffffff;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .classification-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 15px;
      background-color: ${badgeColor};
      color: #ffffff;
    }
    .content { padding: 30px; }
    .secret-display {
      background: #f8f9fa;
      border-left: 4px solid #7c3aed;
      padding: 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .secret-display h2 {
      margin: 0;
      font-size: 24px;
      color: #1a365d;
    }
    .deadline-box {
      background: #f8f9fa;
      border-left: 4px solid ${badgeColor};
      padding: 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .details-table th,
    .details-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e9ecef;
    }
    .details-table th {
      color: #6c757d;
      font-weight: 500;
      width: 40%;
    }
    .action-button {
      display: inline-block;
      background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
      color: #ffffff;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
      font-size: 12px;
      color: #6c757d;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Trade Secret Review Reminder</h1>
      <span class="classification-badge">${classificationLabel}</span>
    </div>
    <div class="content">
      <p>Dear ${data.ownerName},</p>
      <p>This is a reminder that a trade secret is due for periodic review. Regular reviews ensure continued protection and proper classification.</p>

      <div class="secret-display">
        <h2>${data.name}</h2>
        <p>Custodian: ${data.custodian}</p>
      </div>

      <div class="deadline-box">
        <h3>Review Deadline</h3>
        <div style="font-size: 24px; font-weight: 700; color: ${badgeColor}; margin: 10px 0;">${formattedReviewDate}</div>
        <p><strong>${data.daysUntilReview} days remaining</strong></p>
      </div>

      <table class="details-table">
        <tr>
          <th>Classification</th>
          <td>${classificationLabel}</td>
        </tr>
        <tr>
          <th>Last Review</th>
          <td>${data.lastReviewDate.toLocaleDateString()}</td>
        </tr>
        <tr>
          <th>Total Access Count</th>
          <td>${data.accessCount}</td>
        </tr>
        ${data.lastAccessDate ? `
        <tr>
          <th>Last Accessed</th>
          <td>${data.lastAccessDate.toLocaleDateString()}</td>
        </tr>
        ` : ''}
      </table>

      <div style="text-align: center;">
        <a href="${data.actionUrl}" class="action-button">Complete Review</a>
      </div>

      <p><strong>Review checklist:</strong></p>
      <ul>
        <li>Verify continued business value</li>
        <li>Confirm access controls are appropriate</li>
        <li>Update classification if needed</li>
        <li>Review and update protective measures</li>
      </ul>
    </div>
    <div class="footer">
      <p>This is an automated notification from the Intellectual Property Management System.</p>
      <p>Trade Secret ID: ${data.tradeSecretId}</p>
    </div>
  </div>
</body>
</html>
`.trim();

    const text = `
TRADE SECRET REVIEW REMINDER
============================

Classification: ${classificationLabel}

Dear ${data.ownerName},

This is a reminder that a trade secret is due for periodic review.

TRADE SECRET: ${data.name}
Custodian: ${data.custodian}

REVIEW DEADLINE: ${formattedReviewDate}
Days Remaining: ${data.daysUntilReview}

DETAILS
-------
Classification: ${classificationLabel}
Last Review: ${data.lastReviewDate.toLocaleDateString()}
Total Access Count: ${data.accessCount}
${data.lastAccessDate ? `Last Accessed: ${data.lastAccessDate.toLocaleDateString()}` : ''}

REVIEW CHECKLIST
----------------
- Verify continued business value
- Confirm access controls are appropriate
- Update classification if needed
- Review and update protective measures

Complete your review at: ${data.actionUrl}

---
Trade Secret ID: ${data.tradeSecretId}
`.trim();

    return { subject, html, text };
  }

  /**
   * Format email address with optional name.
   */
  private formatAddress(recipient: EmailRecipient): string {
    if (recipient.name) {
      return `${recipient.name} <${recipient.email}>`;
    }
    return recipient.email;
  }
}

// Singleton instance
export const sesEmailService = new SESEmailService();
