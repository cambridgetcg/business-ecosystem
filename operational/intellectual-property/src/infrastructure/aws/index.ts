/**
 * AWS Infrastructure Module for Intellectual Property
 *
 * Exports all AWS service clients and configurations.
 *
 * @module infrastructure/aws
 */

// Configuration
export { awsConfig } from './config.js';

// EventBridge Publishing
export {
  EventBridgePublisher,
  eventBridgePublisher,
  type DomainEvent,
  type PublishResult,
  type PatentEventType,
  type TrademarkEventType,
  type TradeSecretEventType,
  type DomainNameEventType,
  type LicenseEventType,
  type IPEventType,
} from './eventbridge-publisher.js';

// S3 Document Storage
export {
  S3DocumentService,
  s3DocumentService,
  type DocumentMetadata,
  type UploadOptions,
  type DownloadResult,
} from './s3-document-service.js';

// DynamoDB Stores
export {
  DeadlineStore,
  IPEventStore,
  deadlineStore,
  ipEventStore,
  type Deadline,
  type IPEvent,
} from './dynamodb-deadline-store.js';

// SNS Notifications
export {
  SNSNotificationService,
  snsNotificationService,
  type Notification,
  type NotificationPriority,
  type BatchNotificationResult,
} from './sns-notification-service.js';

// SES Email Service
export {
  SESEmailService,
  sesEmailService,
  type EmailSendResult,
  type BatchEmailResult,
  type EmailRecipient,
  type TradeSecretReviewTemplateData,
} from './ses-email-service.js';

// Email Scheduler
export {
  EmailScheduler,
  emailScheduler,
  DEFAULT_REMINDER_INTERVALS,
  type ReminderInterval,
  type ScheduledReminder,
  type NotificationRecipientConfig,
  type AssetDataProvider,
  type SchedulerResult,
} from './email-scheduler.js';

// Email Templates
export {
  generateMaintenanceFeeEmail,
  generateTrademarkRenewalEmail,
  generateDomainExpirationEmail,
  generateCriticalAlertEmail,
  generateRoyaltyDueEmail,
  type MaintenanceFeeTemplateData,
  type TrademarkRenewalTemplateData,
  type DomainExpirationTemplateData,
  type CriticalAlertTemplateData,
  type CriticalAlertType,
  type RoyaltyDueTemplateData,
  type RoyaltyType,
  type EmailContent,
} from './email-templates/index.js';
