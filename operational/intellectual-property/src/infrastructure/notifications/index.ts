/**
 * Notifications Infrastructure Module
 *
 * Provides webhook-based notifications for Slack and Microsoft Teams.
 * Supports routing notifications based on event type, priority, and configuration.
 *
 * @module infrastructure/notifications
 */

// Configuration
export {
  notificationConfig,
  loadNotificationConfig,
  priorityColors,
  priorityEmoji,
  assetTypeIcons,
  eventCategoryNames,
  type NotificationConfig,
  type SlackChannelConfig,
  type TeamsChannelConfig,
  type NotificationRoutingRule,
  type IPAssetType,
  type IPEventCategory,
} from './notification-config.js';

// Slack Webhook Service
export {
  SlackWebhookService,
  slackWebhookService,
  type SlackBlockType,
  type SlackTextObject,
  type SlackBlockElement,
  type SlackContextElement,
  type SlackBlock,
  type SlackAttachment,
  type SlackMessagePayload,
  type IPNotificationData as SlackNotificationData,
  type WebhookSendResult as SlackWebhookSendResult,
} from './slack-webhook.service.js';

// Teams Webhook Service
export {
  TeamsWebhookService,
  teamsWebhookService,
  type AdaptiveCardElementType,
  type AdaptiveCardActionType,
  type TextWeight,
  type TextSize,
  type TextColor,
  type AdaptiveCardElement,
  type TextBlockElement,
  type Fact,
  type FactSetElement,
  type ColumnElement,
  type ColumnSetElement,
  type ContainerElement,
  type AdaptiveCardAction,
  type ActionSetElement,
  type AdaptiveCard,
  type TeamsMessageCard,
  type TeamsWebhookPayload,
  type IPNotificationData as TeamsNotificationData,
  type WebhookSendResult as TeamsWebhookSendResult,
} from './teams-webhook.service.js';

// Notification Router
export {
  NotificationRouter,
  notificationRouter,
  type NotificationData,
  type ChannelSendResult,
  type RoutingResult,
  type RetryOptions,
} from './notification-router.js';
