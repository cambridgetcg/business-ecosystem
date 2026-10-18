/**
 * Email Scheduler for Intellectual Property Deadline Reminders
 *
 * Schedules and manages email notifications for IP deadlines:
 * - Configurable reminder intervals (30, 14, 7 days before)
 * - Prevents duplicate reminders
 * - Tracks notification history
 * - Integrates with deadline store and SES email service
 *
 * @module infrastructure/aws
 */

import { deadlineStore, type Deadline } from './dynamodb-deadline-store.js';
import {
  sesEmailService,
  type EmailRecipient,
  type EmailSendResult,
  type BatchEmailResult,
} from './ses-email-service.js';
import {
  type MaintenanceFeeTemplateData,
  type TrademarkRenewalTemplateData,
  type DomainExpirationTemplateData,
  type CriticalAlertTemplateData,
  type RoyaltyDueTemplateData,
} from './email-templates/index.js';

/**
 * Reminder interval configuration.
 */
export interface ReminderInterval {
  daysBeforeDeadline: number;
  enabled: boolean;
}

/**
 * Default reminder intervals.
 */
export const DEFAULT_REMINDER_INTERVALS: ReminderInterval[] = [
  { daysBeforeDeadline: 30, enabled: true },
  { daysBeforeDeadline: 14, enabled: true },
  { daysBeforeDeadline: 7, enabled: true },
  { daysBeforeDeadline: 3, enabled: true },
  { daysBeforeDeadline: 1, enabled: true },
];

/**
 * Scheduled reminder record.
 */
export interface ScheduledReminder {
  deadlineId: string;
  assetId: string;
  assetType: Deadline['assetType'];
  dueDate: Date;
  reminderDate: Date;
  daysBeforeDeadline: number;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  sentAt?: Date;
  error?: string;
}

/**
 * Notification recipient configuration.
 */
export interface NotificationRecipientConfig {
  getRecipientsForAsset: (
    assetId: string,
    assetType: Deadline['assetType']
  ) => Promise<EmailRecipient[]>;
}

/**
 * Asset data provider for generating email content.
 */
export interface AssetDataProvider {
  getPatentData: (patentId: string) => Promise<MaintenanceFeeTemplateData | null>;
  getTrademarkData: (trademarkId: string) => Promise<TrademarkRenewalTemplateData | null>;
  getDomainData: (domainId: string) => Promise<DomainExpirationTemplateData | null>;
  getLicenseData: (licenseId: string) => Promise<RoyaltyDueTemplateData | null>;
}

/**
 * Scheduler result.
 */
export interface SchedulerResult {
  processedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  errors: Array<{
    deadlineId: string;
    error: string;
  }>;
}

/**
 * Email Scheduler Service
 *
 * Manages scheduling and sending of deadline reminder emails.
 */
export class EmailScheduler {
  private readonly reminderIntervals: ReminderInterval[];
  private readonly baseUrl: string;
  private recipientConfig?: NotificationRecipientConfig;
  private assetDataProvider?: AssetDataProvider;

  constructor(options?: {
    reminderIntervals?: ReminderInterval[];
    baseUrl?: string;
    recipientConfig?: NotificationRecipientConfig;
    assetDataProvider?: AssetDataProvider;
  }) {
    this.reminderIntervals = options?.reminderIntervals ?? DEFAULT_REMINDER_INTERVALS;
    this.baseUrl = options?.baseUrl ?? process.env.IP_PORTAL_BASE_URL ?? 'https://ip.example.com';
    this.recipientConfig = options?.recipientConfig;
    this.assetDataProvider = options?.assetDataProvider;
  }

  /**
   * Set recipient configuration.
   */
  setRecipientConfig(config: NotificationRecipientConfig): void {
    this.recipientConfig = config;
  }

  /**
   * Set asset data provider.
   */
  setAssetDataProvider(provider: AssetDataProvider): void {
    this.assetDataProvider = provider;
  }

  /**
   * Process all pending deadlines and send reminders.
   */
  async processDeadlines(options?: {
    daysAhead?: number;
    limit?: number;
    dryRun?: boolean;
  }): Promise<SchedulerResult> {
    const result: SchedulerResult = {
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    const daysAhead = options?.daysAhead ?? 30;
    const limit = options?.limit ?? 100;
    const dryRun = options?.dryRun ?? false;

    try {
      // Get upcoming deadlines
      const deadlines = await deadlineStore.getUpcomingDeadlines(daysAhead, limit);

      for (const deadline of deadlines) {
        result.processedCount++;

        try {
          const shouldSend = await this.shouldSendReminder(deadline);

          if (!shouldSend) {
            result.skippedCount++;
            continue;
          }

          if (dryRun) {
            console.log('[EmailScheduler] DRY RUN - Would send reminder for:', {
              deadlineId: deadline.deadlineId,
              assetId: deadline.assetId,
              assetType: deadline.assetType,
              dueDate: deadline.dueDate,
            });
            result.sentCount++;
            continue;
          }

          const sendResult = await this.sendReminderForDeadline(deadline);

          if (sendResult.success) {
            result.sentCount++;
            // Record that reminder was sent
            await deadlineStore.recordReminderSent(deadline.assetId, deadline.deadlineId);
          } else {
            result.failedCount++;
            result.errors.push({
              deadlineId: deadline.deadlineId,
              error: sendResult.error ?? 'Unknown error',
            });
          }
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            deadlineId: deadline.deadlineId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      console.error('[EmailScheduler] Failed to process deadlines:', error);
      throw error;
    }

    return result;
  }

  /**
   * Check if we should send a reminder for this deadline.
   */
  private async shouldSendReminder(deadline: Deadline): Promise<boolean> {
    // Skip if not pending
    if (deadline.status !== 'pending') {
      return false;
    }

    const dueDate = new Date(deadline.dueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Check if we're at a reminder interval
    const activeInterval = this.reminderIntervals.find(
      interval => interval.enabled && interval.daysBeforeDeadline === daysUntilDue
    );

    if (!activeInterval) {
      // Also check if we're within a range that hasn't been covered
      // (e.g., if a reminder was missed)
      const shouldSendMissed = this.shouldSendMissedReminder(deadline, daysUntilDue);
      if (!shouldSendMissed) {
        return false;
      }
    }

    // Check if we've already sent a reminder recently (within last 24 hours)
    if (deadline.lastReminderAt) {
      const lastReminder = new Date(deadline.lastReminderAt);
      const hoursSinceLastReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastReminder < 24) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if we should send a reminder that was missed.
   */
  private shouldSendMissedReminder(deadline: Deadline, daysUntilDue: number): boolean {
    // If we're past the deadline, don't send reminders (should be handled as critical)
    if (daysUntilDue < 0) {
      return false;
    }

    // Find the last interval we should have sent
    const applicableIntervals = this.reminderIntervals
      .filter(i => i.enabled && i.daysBeforeDeadline >= daysUntilDue)
      .sort((a, b) => a.daysBeforeDeadline - b.daysBeforeDeadline);

    if (applicableIntervals.length === 0) {
      return false;
    }

    // Check if we've sent any reminders for these intervals
    const expectedReminders = applicableIntervals.length;
    const actualReminders = deadline.remindersSent;

    // If we're behind on reminders, send one
    return actualReminders < expectedReminders;
  }

  /**
   * Send reminder for a specific deadline.
   */
  private async sendReminderForDeadline(deadline: Deadline): Promise<EmailSendResult> {
    if (!this.recipientConfig) {
      return {
        success: false,
        error: 'Recipient configuration not set',
      };
    }

    const recipients = await this.recipientConfig.getRecipientsForAsset(
      deadline.assetId,
      deadline.assetType
    );

    if (recipients.length === 0) {
      return {
        success: false,
        error: 'No recipients found for asset',
      };
    }

    const dueDate = new Date(deadline.dueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    switch (deadline.assetType) {
      case 'patent':
        return this.sendPatentReminder(deadline, recipients, daysUntilDue);
      case 'trademark':
        return this.sendTrademarkReminder(deadline, recipients, daysUntilDue);
      case 'domain':
        return this.sendDomainReminder(deadline, recipients, daysUntilDue);
      case 'license':
        return this.sendLicenseReminder(deadline, recipients, daysUntilDue);
      case 'trade_secret':
        return this.sendTradeSecretReminder(deadline, recipients, daysUntilDue);
      default:
        return {
          success: false,
          error: `Unsupported asset type: ${deadline.assetType}`,
        };
    }
  }

  /**
   * Send patent maintenance fee reminder.
   */
  private async sendPatentReminder(
    deadline: Deadline,
    recipients: EmailRecipient[],
    daysUntilDue: number
  ): Promise<EmailSendResult> {
    let data: MaintenanceFeeTemplateData;

    if (this.assetDataProvider) {
      const providerData = await this.assetDataProvider.getPatentData(deadline.assetId);
      if (!providerData) {
        return { success: false, error: 'Patent data not found' };
      }
      data = providerData;
    } else {
      // Fallback to deadline metadata
      data = {
        patentId: deadline.assetId,
        patentNumber: deadline.metadata?.patentNumber as string ?? deadline.assetId,
        title: deadline.title,
        feeWindow: deadline.deadlineType,
        dueDate: new Date(deadline.dueDate),
        amount: deadline.amount ?? 0,
        currency: deadline.currency ?? 'USD',
        jurisdiction: deadline.jurisdiction ?? 'Unknown',
        daysUntilDue,
        ownerName: deadline.metadata?.ownerName as string ?? 'IP Administrator',
        actionUrl: `${this.baseUrl}/patents/${deadline.assetId}`,
      };
    }

    return sesEmailService.sendMaintenanceFeeReminder(recipients, data);
  }

  /**
   * Send trademark renewal reminder.
   */
  private async sendTrademarkReminder(
    deadline: Deadline,
    recipients: EmailRecipient[],
    daysUntilDue: number
  ): Promise<EmailSendResult> {
    let data: TrademarkRenewalTemplateData;

    if (this.assetDataProvider) {
      const providerData = await this.assetDataProvider.getTrademarkData(deadline.assetId);
      if (!providerData) {
        return { success: false, error: 'Trademark data not found' };
      }
      data = providerData;
    } else {
      data = {
        trademarkId: deadline.assetId,
        registrationNumber: deadline.metadata?.registrationNumber as string ?? deadline.assetId,
        mark: deadline.title,
        markType: deadline.metadata?.markType as TrademarkRenewalTemplateData['markType'] ?? 'word',
        classes: deadline.metadata?.classes as string[] ?? [],
        dueDate: new Date(deadline.dueDate),
        jurisdiction: deadline.jurisdiction ?? 'Unknown',
        daysUntilDue,
        ownerName: deadline.metadata?.ownerName as string ?? 'IP Administrator',
        actionUrl: `${this.baseUrl}/trademarks/${deadline.assetId}`,
      };
    }

    return sesEmailService.sendTrademarkRenewalReminder(recipients, data);
  }

  /**
   * Send domain expiration reminder.
   */
  private async sendDomainReminder(
    deadline: Deadline,
    recipients: EmailRecipient[],
    daysUntilDue: number
  ): Promise<EmailSendResult> {
    let data: DomainExpirationTemplateData;

    if (this.assetDataProvider) {
      const providerData = await this.assetDataProvider.getDomainData(deadline.assetId);
      if (!providerData) {
        return { success: false, error: 'Domain data not found' };
      }
      data = providerData;
    } else {
      data = {
        domainId: deadline.assetId,
        domainName: deadline.title,
        expirationDate: new Date(deadline.dueDate),
        daysUntilExpiration: daysUntilDue,
        registrar: deadline.metadata?.registrar as string ?? 'Unknown',
        autoRenewEnabled: deadline.metadata?.autoRenewEnabled as boolean ?? false,
        ownerName: deadline.metadata?.ownerName as string ?? 'IP Administrator',
        actionUrl: `${this.baseUrl}/domains/${deadline.assetId}`,
      };
    }

    return sesEmailService.sendDomainExpirationReminder(recipients, data);
  }

  /**
   * Send license royalty reminder.
   */
  private async sendLicenseReminder(
    deadline: Deadline,
    recipients: EmailRecipient[],
    daysUntilDue: number
  ): Promise<EmailSendResult> {
    let data: RoyaltyDueTemplateData;

    if (this.assetDataProvider) {
      const providerData = await this.assetDataProvider.getLicenseData(deadline.assetId);
      if (!providerData) {
        return { success: false, error: 'License data not found' };
      }
      data = providerData;
    } else {
      data = {
        licenseId: deadline.assetId,
        licenseeName: deadline.metadata?.licenseeName as string ?? 'Unknown Licensee',
        licensedAssets: deadline.metadata?.licensedAssets as RoyaltyDueTemplateData['licensedAssets'] ?? [],
        royaltyType: deadline.metadata?.royaltyType as RoyaltyDueTemplateData['royaltyType'] ?? 'fixed',
        dueDate: new Date(deadline.dueDate),
        daysUntilDue,
        amount: deadline.amount ?? 0,
        currency: deadline.currency ?? 'USD',
        paymentPeriod: deadline.deadlineType,
        ownerName: deadline.metadata?.ownerName as string ?? 'IP Administrator',
        actionUrl: `${this.baseUrl}/licenses/${deadline.assetId}`,
      };
    }

    return sesEmailService.sendRoyaltyDueReminder(recipients, data);
  }

  /**
   * Send trade secret review reminder.
   */
  private async sendTradeSecretReminder(
    deadline: Deadline,
    recipients: EmailRecipient[],
    daysUntilDue: number
  ): Promise<EmailSendResult> {
    return sesEmailService.sendTradeSecretReviewReminder(recipients, {
      tradeSecretId: deadline.assetId,
      name: deadline.title,
      classification: deadline.metadata?.classification as 'confidential' | 'highly_confidential' | 'top_secret' ?? 'confidential',
      lastReviewDate: new Date(deadline.metadata?.lastReviewDate as string ?? deadline.createdAt),
      nextReviewDate: new Date(deadline.dueDate),
      daysUntilReview: daysUntilDue,
      accessCount: deadline.metadata?.accessCount as number ?? 0,
      lastAccessDate: deadline.metadata?.lastAccessDate
        ? new Date(deadline.metadata.lastAccessDate as string)
        : undefined,
      custodian: deadline.metadata?.custodian as string ?? 'Unknown',
      ownerName: deadline.metadata?.ownerName as string ?? 'IP Administrator',
      actionUrl: `${this.baseUrl}/trade-secrets/${deadline.assetId}`,
    });
  }

  /**
   * Schedule reminders for a specific deadline.
   */
  calculateReminderDates(dueDate: Date): Date[] {
    return this.reminderIntervals
      .filter(interval => interval.enabled)
      .map(interval => {
        const reminderDate = new Date(dueDate);
        reminderDate.setDate(reminderDate.getDate() - interval.daysBeforeDeadline);
        return reminderDate;
      })
      .filter(date => date > new Date()) // Only future dates
      .sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Get the next reminder date for a deadline.
   */
  getNextReminderDate(dueDate: Date): Date | null {
    const reminderDates = this.calculateReminderDates(dueDate);
    return reminderDates.length > 0 ? reminderDates[0] as Date : null;
  }

  /**
   * Check if overdue deadlines exist and need critical alerts.
   */
  async processOverdueDeadlines(options?: {
    limit?: number;
    dryRun?: boolean;
  }): Promise<SchedulerResult> {
    const result: SchedulerResult = {
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    const limit = options?.limit ?? 50;
    const dryRun = options?.dryRun ?? false;

    try {
      const overdueDeadlines = await deadlineStore.getOverdueDeadlines(limit);

      for (const deadline of overdueDeadlines) {
        result.processedCount++;

        if (!this.recipientConfig) {
          result.skippedCount++;
          continue;
        }

        try {
          const recipients = await this.recipientConfig.getRecipientsForAsset(
            deadline.assetId,
            deadline.assetType
          );

          if (recipients.length === 0) {
            result.skippedCount++;
            continue;
          }

          if (dryRun) {
            console.log('[EmailScheduler] DRY RUN - Would send overdue alert for:', {
              deadlineId: deadline.deadlineId,
              assetId: deadline.assetId,
              dueDate: deadline.dueDate,
            });
            result.sentCount++;
            continue;
          }

          const dueDate = new Date(deadline.dueDate);
          const now = new Date();
          const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          const alertData: CriticalAlertTemplateData = {
            alertId: `overdue-${deadline.deadlineId}`,
            alertType: 'deadline_missed',
            assetId: deadline.assetId,
            assetName: deadline.title,
            title: `Deadline Missed: ${deadline.title}`,
            description: `This ${deadline.assetType} deadline was due on ${dueDate.toLocaleDateString()} and is now ${daysOverdue} days overdue. Immediate action is required.`,
            filedDate: dueDate,
            ownerName: deadline.metadata?.ownerName as string ?? 'IP Administrator',
            actionUrl: `${this.baseUrl}/${deadline.assetType}s/${deadline.assetId}`,
            additionalDetails: {
              'Days Overdue': daysOverdue.toString(),
              'Deadline Type': deadline.deadlineType,
              'Original Due Date': dueDate.toLocaleDateString(),
            },
          };

          const sendResult = await sesEmailService.sendCriticalAlert(recipients, alertData);

          if (sendResult.success) {
            result.sentCount++;
          } else {
            result.failedCount++;
            result.errors.push({
              deadlineId: deadline.deadlineId,
              error: sendResult.error ?? 'Unknown error',
            });
          }
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            deadlineId: deadline.deadlineId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      console.error('[EmailScheduler] Failed to process overdue deadlines:', error);
      throw error;
    }

    return result;
  }
}

// Singleton instance
export const emailScheduler = new EmailScheduler();
