/**
 * Notification Configuration
 *
 * Configuration types and defaults for webhook notifications.
 * Supports routing notifications to Slack and Teams channels.
 *
 * @module infrastructure/notifications
 */

import type { NotificationPriority } from '../aws/sns-notification-service.js';

/**
 * IP asset types for routing.
 */
export type IPAssetType =
  | 'patent'
  | 'trademark'
  | 'copyright'
  | 'trade_secret'
  | 'domain'
  | 'license'
  | 'enforcement'
  | 'valuation'
  | 'fto'
  | 'due_diligence';

/**
 * IP event categories for routing.
 */
export type IPEventCategory =
  | 'deadline_approaching'
  | 'deadline_missed'
  | 'critical_alert'
  | 'trade_secret_access'
  | 'enforcement_update'
  | 'valuation_completed'
  | 'fto_completed'
  | 'due_diligence_completed'
  | 'opposition_filed'
  | 'dispute_filed'
  | 'status_change'
  | 'escalation';

/**
 * Slack channel configuration.
 */
export interface SlackChannelConfig {
  /** Unique identifier for this channel config */
  id: string;
  /** Human-readable name */
  name: string;
  /** Incoming webhook URL */
  webhookUrl: string;
  /** Default channel to post to (can be overridden by webhook) */
  defaultChannel?: string;
  /** Whether this channel is active */
  enabled: boolean;
}

/**
 * Teams channel configuration.
 */
export interface TeamsChannelConfig {
  /** Unique identifier for this channel config */
  id: string;
  /** Human-readable name */
  name: string;
  /** Incoming webhook URL */
  webhookUrl: string;
  /** Whether this channel is active */
  enabled: boolean;
}

/**
 * Routing rule for notifications.
 */
export interface NotificationRoutingRule {
  /** Unique identifier for this rule */
  id: string;
  /** Human-readable name */
  name: string;
  /** Event categories this rule matches */
  eventCategories: IPEventCategory[];
  /** Asset types this rule matches (empty = all) */
  assetTypes: IPAssetType[];
  /** Minimum priority level to match */
  minPriority: NotificationPriority;
  /** Slack channel IDs to route to */
  slackChannels: string[];
  /** Teams channel IDs to route to */
  teamsChannels: string[];
  /** Whether this rule is active */
  enabled: boolean;
  /** Priority of this rule (higher = evaluated first) */
  rulePriority: number;
}

/**
 * Full notification configuration.
 */
export interface NotificationConfig {
  /** Slack channel configurations */
  slackChannels: SlackChannelConfig[];
  /** Teams channel configurations */
  teamsChannels: TeamsChannelConfig[];
  /** Routing rules */
  routingRules: NotificationRoutingRule[];
  /** Global enable/disable */
  enabled: boolean;
  /** Retry configuration */
  retry: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
  };
}

/**
 * Priority color mapping for notifications.
 */
export const priorityColors: Record<NotificationPriority, string> = {
  low: '#36a64f',      // Green
  medium: '#f2c744',   // Yellow
  high: '#ff9800',     // Orange
  critical: '#dc3545', // Red
};

/**
 * Priority emoji mapping for Slack.
 */
export const priorityEmoji: Record<NotificationPriority, string> = {
  low: ':white_check_mark:',
  medium: ':warning:',
  high: ':exclamation:',
  critical: ':rotating_light:',
};

/**
 * Asset type icons for Teams Adaptive Cards.
 */
export const assetTypeIcons: Record<IPAssetType, string> = {
  patent: 'DocumentSearch',
  trademark: 'Tag',
  copyright: 'Document',
  trade_secret: 'Lock',
  domain: 'Globe',
  license: 'Certificate',
  enforcement: 'Gavel',
  valuation: 'Calculator',
  fto: 'Search',
  due_diligence: 'TaskList',
};

/**
 * Event category display names.
 */
export const eventCategoryNames: Record<IPEventCategory, string> = {
  deadline_approaching: 'Deadline Approaching',
  deadline_missed: 'Deadline Missed',
  critical_alert: 'Critical Alert',
  trade_secret_access: 'Trade Secret Access',
  enforcement_update: 'Enforcement Update',
  valuation_completed: 'Valuation Completed',
  fto_completed: 'FTO Analysis Completed',
  due_diligence_completed: 'Due Diligence Completed',
  opposition_filed: 'Opposition Filed',
  dispute_filed: 'Dispute Filed',
  status_change: 'Status Change',
  escalation: 'Escalation',
};

/**
 * Load notification configuration from environment.
 */
export function loadNotificationConfig(): NotificationConfig {
  const slackChannels: SlackChannelConfig[] = [];
  const teamsChannels: TeamsChannelConfig[] = [];

  // Parse Slack channels from environment
  // Format: SLACK_CHANNEL_<ID>_URL, SLACK_CHANNEL_<ID>_NAME
  const slackUrls = process.env.SLACK_WEBHOOK_URLS?.split(',') ?? [];
  const slackNames = process.env.SLACK_WEBHOOK_NAMES?.split(',') ?? [];

  slackUrls.forEach((url, index) => {
    if (url.trim()) {
      slackChannels.push({
        id: `slack-${index}`,
        name: slackNames[index]?.trim() ?? `Slack Channel ${index + 1}`,
        webhookUrl: url.trim(),
        enabled: true,
      });
    }
  });

  // Parse Teams channels from environment
  const teamsUrls = process.env.TEAMS_WEBHOOK_URLS?.split(',') ?? [];
  const teamsNames = process.env.TEAMS_WEBHOOK_NAMES?.split(',') ?? [];

  teamsUrls.forEach((url, index) => {
    if (url.trim()) {
      teamsChannels.push({
        id: `teams-${index}`,
        name: teamsNames[index]?.trim() ?? `Teams Channel ${index + 1}`,
        webhookUrl: url.trim(),
        enabled: true,
      });
    }
  });

  // Default routing rules
  const routingRules: NotificationRoutingRule[] = [
    // Critical alerts go to all channels
    {
      id: 'critical-all',
      name: 'Critical Alerts - All Channels',
      eventCategories: ['critical_alert', 'deadline_missed', 'opposition_filed', 'dispute_filed'],
      assetTypes: [],
      minPriority: 'critical',
      slackChannels: slackChannels.map(c => c.id),
      teamsChannels: teamsChannels.map(c => c.id),
      enabled: true,
      rulePriority: 100,
    },
    // High priority deadlines
    {
      id: 'high-deadlines',
      name: 'High Priority Deadlines',
      eventCategories: ['deadline_approaching', 'escalation'],
      assetTypes: [],
      minPriority: 'high',
      slackChannels: slackChannels.slice(0, 1).map(c => c.id),
      teamsChannels: teamsChannels.slice(0, 1).map(c => c.id),
      enabled: true,
      rulePriority: 50,
    },
    // Trade secret access alerts
    {
      id: 'trade-secret-access',
      name: 'Trade Secret Access Alerts',
      eventCategories: ['trade_secret_access'],
      assetTypes: ['trade_secret'],
      minPriority: 'medium',
      slackChannels: slackChannels.map(c => c.id),
      teamsChannels: teamsChannels.map(c => c.id),
      enabled: true,
      rulePriority: 90,
    },
    // Enforcement updates
    {
      id: 'enforcement-updates',
      name: 'Enforcement Matter Updates',
      eventCategories: ['enforcement_update'],
      assetTypes: ['enforcement'],
      minPriority: 'medium',
      slackChannels: slackChannels.slice(0, 1).map(c => c.id),
      teamsChannels: teamsChannels.slice(0, 1).map(c => c.id),
      enabled: true,
      rulePriority: 70,
    },
    // Strategy completions (valuation, FTO, DD)
    {
      id: 'strategy-completions',
      name: 'Strategy Analysis Completions',
      eventCategories: ['valuation_completed', 'fto_completed', 'due_diligence_completed'],
      assetTypes: ['valuation', 'fto', 'due_diligence'],
      minPriority: 'low',
      slackChannels: slackChannels.slice(0, 1).map(c => c.id),
      teamsChannels: teamsChannels.slice(0, 1).map(c => c.id),
      enabled: true,
      rulePriority: 30,
    },
  ];

  return {
    slackChannels,
    teamsChannels,
    routingRules,
    enabled: process.env.NOTIFICATIONS_ENABLED !== 'false',
    retry: {
      maxAttempts: parseInt(process.env.NOTIFICATION_RETRY_ATTEMPTS ?? '3', 10),
      initialDelayMs: parseInt(process.env.NOTIFICATION_RETRY_INITIAL_DELAY ?? '1000', 10),
      maxDelayMs: parseInt(process.env.NOTIFICATION_RETRY_MAX_DELAY ?? '30000', 10),
    },
  };
}

/**
 * Default notification configuration singleton.
 */
export const notificationConfig = loadNotificationConfig();
