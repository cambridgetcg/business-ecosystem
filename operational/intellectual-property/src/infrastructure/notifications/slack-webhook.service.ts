/**
 * Slack Webhook Service
 *
 * Sends notifications to Slack channels via incoming webhooks.
 * Supports rich formatting with blocks, attachments, and threading.
 *
 * @module infrastructure/notifications
 */

import type { NotificationPriority } from '../aws/sns-notification-service.js';
import {
  priorityColors,
  priorityEmoji,
  eventCategoryNames,
  type IPAssetType,
  type IPEventCategory,
} from './notification-config.js';

/**
 * Slack block types.
 */
export type SlackBlockType = 'section' | 'divider' | 'context' | 'actions' | 'header';

/**
 * Slack text object.
 */
export interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

/**
 * Slack block element.
 */
export interface SlackBlockElement {
  type: string;
  text?: SlackTextObject | string;
  url?: string;
  action_id?: string;
  value?: string;
  style?: 'primary' | 'danger';
}

/**
 * Slack context element (mrkdwn or plain_text).
 */
export interface SlackContextElement {
  type: 'mrkdwn' | 'plain_text' | 'image';
  text?: string;
  image_url?: string;
  alt_text?: string;
}

/**
 * Slack block.
 */
export interface SlackBlock {
  type: SlackBlockType;
  text?: SlackTextObject;
  block_id?: string;
  fields?: SlackTextObject[];
  elements?: SlackBlockElement[] | SlackContextElement[];
  accessory?: SlackBlockElement;
}

/**
 * Slack attachment.
 */
export interface SlackAttachment {
  color?: string;
  fallback?: string;
  pretext?: string;
  author_name?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  footer?: string;
  footer_icon?: string;
  ts?: number;
  mrkdwn_in?: string[];
}

/**
 * Slack message payload.
 */
export interface SlackMessagePayload {
  text: string;
  channel?: string;
  username?: string;
  icon_emoji?: string;
  thread_ts?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

/**
 * IP notification data for formatting.
 */
export interface IPNotificationData {
  eventCategory: IPEventCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  assetType?: IPAssetType;
  assetId?: string;
  assetIdentifier?: string; // e.g., patent number, trademark registration
  dueDate?: Date;
  daysRemaining?: number;
  jurisdiction?: string;
  amount?: number;
  currency?: string;
  actionUrl?: string;
  threadId?: string;
  metadata?: Record<string, string>;
}

/**
 * Webhook send result.
 */
export interface WebhookSendResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  threadId?: string;
}

/**
 * Slack Webhook Service
 *
 * Provides methods to send formatted notifications to Slack channels.
 */
export class SlackWebhookService {
  private readonly defaultUsername: string;
  private readonly defaultEmoji: string;

  constructor(options?: {
    defaultUsername?: string;
    defaultEmoji?: string;
  }) {
    this.defaultUsername = options?.defaultUsername ?? 'IP Notifications';
    this.defaultEmoji = options?.defaultEmoji ?? ':scales:';
  }

  /**
   * Send a message to a Slack webhook.
   */
  async send(
    webhookUrl: string,
    payload: SlackMessagePayload
  ): Promise<WebhookSendResult> {
    const fullPayload: SlackMessagePayload = {
      username: this.defaultUsername,
      icon_emoji: this.defaultEmoji,
      unfurl_links: false,
      unfurl_media: false,
      ...payload,
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fullPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          statusCode: response.status,
          error: `Slack webhook failed: ${response.status} - ${errorText}`,
        };
      }

      return {
        success: true,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send an IP notification with rich formatting.
   */
  async sendIPNotification(
    webhookUrl: string,
    data: IPNotificationData
  ): Promise<WebhookSendResult> {
    const payload = this.formatIPNotification(data);
    return this.send(webhookUrl, payload);
  }

  /**
   * Format an IP notification into Slack blocks.
   */
  formatIPNotification(data: IPNotificationData): SlackMessagePayload {
    const emoji = priorityEmoji[data.priority];
    const color = priorityColors[data.priority];
    const categoryName = eventCategoryNames[data.eventCategory];

    const blocks: SlackBlock[] = [
      // Header
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${data.title}`,
          emoji: true,
        },
      },
      // Context with category and priority
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${emoji} *${categoryName}* | Priority: *${data.priority.toUpperCase()}*`,
          },
        ] as SlackContextElement[],
      },
      // Divider
      { type: 'divider' },
      // Main message
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: data.message,
        },
      },
    ];

    // Add fields section if we have details
    const fields: SlackTextObject[] = [];

    if (data.assetType) {
      fields.push({
        type: 'mrkdwn',
        text: `*Asset Type:*\n${data.assetType.replace('_', ' ').toUpperCase()}`,
      });
    }

    if (data.assetIdentifier) {
      fields.push({
        type: 'mrkdwn',
        text: `*Identifier:*\n${data.assetIdentifier}`,
      });
    }

    if (data.dueDate) {
      const dateStr = data.dueDate.toISOString().split('T')[0];
      fields.push({
        type: 'mrkdwn',
        text: `*Due Date:*\n${dateStr}`,
      });
    }

    if (data.daysRemaining !== undefined) {
      const daysText = data.daysRemaining < 0
        ? `${Math.abs(data.daysRemaining)} days overdue`
        : `${data.daysRemaining} days remaining`;
      fields.push({
        type: 'mrkdwn',
        text: `*Timeline:*\n${daysText}`,
      });
    }

    if (data.jurisdiction) {
      fields.push({
        type: 'mrkdwn',
        text: `*Jurisdiction:*\n${data.jurisdiction}`,
      });
    }

    if (data.amount !== undefined && data.currency) {
      fields.push({
        type: 'mrkdwn',
        text: `*Amount:*\n${data.currency} ${data.amount.toLocaleString()}`,
      });
    }

    // Add any additional metadata
    if (data.metadata) {
      Object.entries(data.metadata).forEach(([key, value]) => {
        fields.push({
          type: 'mrkdwn',
          text: `*${key}:*\n${value}`,
        });
      });
    }

    if (fields.length > 0) {
      blocks.push({
        type: 'section',
        fields: fields.slice(0, 10), // Slack limit
      });
    }

    // Add action button if URL provided
    if (data.actionUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details',
              emoji: true,
            },
            url: data.actionUrl,
            action_id: 'view_details',
          },
        ],
      });
    }

    // Add footer context
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Sent from IP Management System | ${new Date().toISOString()}`,
        },
      ] as SlackContextElement[],
    });

    return {
      text: `${emoji} ${data.title}`, // Fallback text
      thread_ts: data.threadId,
      blocks,
      attachments: [
        {
          color,
          fallback: `${categoryName}: ${data.title}`,
        },
      ],
    };
  }

  /**
   * Format a deadline approaching notification.
   */
  formatDeadlineApproaching(params: {
    assetType: IPAssetType;
    assetId: string;
    assetIdentifier: string;
    title: string;
    dueDate: Date;
    daysRemaining: number;
    jurisdiction?: string;
    amount?: number;
    currency?: string;
    actionUrl?: string;
  }): SlackMessagePayload {
    const priority: NotificationPriority =
      params.daysRemaining <= 3 ? 'critical' :
      params.daysRemaining <= 7 ? 'high' :
      params.daysRemaining <= 30 ? 'medium' : 'low';

    return this.formatIPNotification({
      eventCategory: 'deadline_approaching',
      priority,
      title: `Deadline Approaching: ${params.title}`,
      message: `Action required for *${params.assetType.replace('_', ' ')}* ${params.assetIdentifier}. Deadline is in *${params.daysRemaining} days*.`,
      assetType: params.assetType,
      assetId: params.assetId,
      assetIdentifier: params.assetIdentifier,
      dueDate: params.dueDate,
      daysRemaining: params.daysRemaining,
      jurisdiction: params.jurisdiction,
      amount: params.amount,
      currency: params.currency,
      actionUrl: params.actionUrl,
    });
  }

  /**
   * Format a deadline missed notification.
   */
  formatDeadlineMissed(params: {
    assetType: IPAssetType;
    assetId: string;
    assetIdentifier: string;
    title: string;
    dueDate: Date;
    daysOverdue: number;
    jurisdiction?: string;
    actionUrl?: string;
  }): SlackMessagePayload {
    return this.formatIPNotification({
      eventCategory: 'deadline_missed',
      priority: 'critical',
      title: `OVERDUE: ${params.title}`,
      message: `:warning: *Deadline has been missed!* ${params.assetType.replace('_', ' ')} ${params.assetIdentifier} is now *${params.daysOverdue} days overdue*.\n\nImmediate action may be required to assess consequences and remediation options.`,
      assetType: params.assetType,
      assetId: params.assetId,
      assetIdentifier: params.assetIdentifier,
      dueDate: params.dueDate,
      daysRemaining: -params.daysOverdue,
      jurisdiction: params.jurisdiction,
      actionUrl: params.actionUrl,
    });
  }

  /**
   * Format a critical alert (opposition, dispute).
   */
  formatCriticalAlert(params: {
    alertType: 'opposition' | 'dispute' | 'litigation' | 'other';
    assetType: IPAssetType;
    assetId: string;
    assetIdentifier: string;
    title: string;
    opponent?: string;
    responseDeadline?: Date;
    jurisdiction?: string;
    details?: string;
    actionUrl?: string;
  }): SlackMessagePayload {
    const eventCategory: IPEventCategory =
      params.alertType === 'opposition' ? 'opposition_filed' :
      params.alertType === 'dispute' ? 'dispute_filed' : 'critical_alert';

    let message = `:rotating_light: *URGENT ATTENTION REQUIRED*\n\n`;
    message += params.details ?? `A ${params.alertType} has been filed against ${params.assetIdentifier}.`;

    if (params.opponent) {
      message += `\n\n*Filed by:* ${params.opponent}`;
    }

    if (params.responseDeadline) {
      message += `\n\n:calendar: *Response Deadline:* ${params.responseDeadline.toISOString().split('T')[0]}`;
    }

    message += `\n\nContact legal counsel immediately.`;

    return this.formatIPNotification({
      eventCategory,
      priority: 'critical',
      title: params.title,
      message,
      assetType: params.assetType,
      assetId: params.assetId,
      assetIdentifier: params.assetIdentifier,
      dueDate: params.responseDeadline,
      jurisdiction: params.jurisdiction,
      actionUrl: params.actionUrl,
      metadata: params.opponent ? { 'Filed By': params.opponent } : undefined,
    });
  }

  /**
   * Format a trade secret access notification.
   */
  formatTradeSecretAccess(params: {
    tradeSecretId: string;
    tradeSecretName: string;
    accessedBy: string;
    accessedAt: Date;
    accessLevel: 'view' | 'export' | 'modify';
    purpose: string;
    ipAddress?: string;
    actionUrl?: string;
  }): SlackMessagePayload {
    const priority: NotificationPriority =
      params.accessLevel === 'export' ? 'critical' :
      params.accessLevel === 'modify' ? 'high' : 'medium';

    const accessEmoji =
      params.accessLevel === 'export' ? ':outbox_tray:' :
      params.accessLevel === 'modify' ? ':pencil2:' : ':eye:';

    return this.formatIPNotification({
      eventCategory: 'trade_secret_access',
      priority,
      title: `Trade Secret Accessed: ${params.tradeSecretName}`,
      message: `${accessEmoji} *${params.accessedBy}* accessed trade secret with *${params.accessLevel}* permissions.\n\n*Purpose:* ${params.purpose}`,
      assetType: 'trade_secret',
      assetId: params.tradeSecretId,
      assetIdentifier: params.tradeSecretName,
      actionUrl: params.actionUrl,
      metadata: {
        'Access Level': params.accessLevel.toUpperCase(),
        'Accessed At': params.accessedAt.toISOString(),
        ...(params.ipAddress && { 'IP Address': params.ipAddress }),
      },
    });
  }

  /**
   * Format an enforcement matter update.
   */
  formatEnforcementUpdate(params: {
    matterId: string;
    matterTitle: string;
    updateType: 'opened' | 'status_changed' | 'litigation_filed' | 'settled' | 'resolved' | 'escalated';
    oldStatus?: string;
    newStatus?: string;
    details?: string;
    priority?: NotificationPriority;
    actionUrl?: string;
  }): SlackMessagePayload {
    const priority = params.priority ??
      (params.updateType === 'litigation_filed' || params.updateType === 'escalated' ? 'critical' :
       params.updateType === 'opened' ? 'high' : 'medium');

    const updateEmoji: Record<string, string> = {
      opened: ':new:',
      status_changed: ':arrows_counterclockwise:',
      litigation_filed: ':classical_building:',
      settled: ':handshake:',
      resolved: ':white_check_mark:',
      escalated: ':arrow_up:',
    };

    let message = `${updateEmoji[params.updateType]} *Enforcement Matter Update*\n\n`;

    if (params.oldStatus && params.newStatus) {
      message += `Status changed from *${params.oldStatus}* to *${params.newStatus}*`;
    } else {
      message += params.details ?? `Matter ${params.updateType.replace('_', ' ')}`;
    }

    return this.formatIPNotification({
      eventCategory: 'enforcement_update',
      priority,
      title: `Enforcement: ${params.matterTitle}`,
      message,
      assetType: 'enforcement',
      assetId: params.matterId,
      assetIdentifier: params.matterTitle,
      actionUrl: params.actionUrl,
      metadata: params.newStatus ? { 'Current Status': params.newStatus } : undefined,
    });
  }

  /**
   * Format a valuation completed notification.
   */
  formatValuationCompleted(params: {
    valuationId: string;
    valuationNumber?: string;
    title: string;
    selectedValue: number;
    currency: string;
    purpose: string;
    assetCount: number;
    actionUrl?: string;
  }): SlackMessagePayload {
    return this.formatIPNotification({
      eventCategory: 'valuation_completed',
      priority: 'medium',
      title: `IP Valuation Completed: ${params.title}`,
      message: `:chart_with_upwards_trend: IP Valuation has been completed.\n\n*Total Value:* ${params.currency} ${params.selectedValue.toLocaleString()}\n*Assets Valued:* ${params.assetCount}`,
      assetType: 'valuation',
      assetId: params.valuationId,
      assetIdentifier: params.valuationNumber ?? params.valuationId,
      actionUrl: params.actionUrl,
      metadata: {
        Purpose: params.purpose,
      },
    });
  }

  /**
   * Format an FTO analysis completed notification.
   */
  formatFTOCompleted(params: {
    analysisId: string;
    analysisNumber?: string;
    productName: string;
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    findingsCount: number;
    potentialIssuesCount: number;
    actionUrl?: string;
  }): SlackMessagePayload {
    const priority: NotificationPriority =
      params.overallRisk === 'critical' || params.overallRisk === 'high' ? 'high' : 'medium';

    const riskEmoji =
      params.overallRisk === 'critical' ? ':rotating_light:' :
      params.overallRisk === 'high' ? ':warning:' :
      params.overallRisk === 'medium' ? ':large_yellow_circle:' : ':white_check_mark:';

    return this.formatIPNotification({
      eventCategory: 'fto_completed',
      priority,
      title: `FTO Analysis Completed: ${params.productName}`,
      message: `${riskEmoji} Freedom-to-Operate analysis has been completed.\n\n*Overall Risk:* ${params.overallRisk.toUpperCase()}\n*Total Findings:* ${params.findingsCount}\n*Potential Issues:* ${params.potentialIssuesCount}`,
      assetType: 'fto',
      assetId: params.analysisId,
      assetIdentifier: params.analysisNumber ?? params.productName,
      actionUrl: params.actionUrl,
      metadata: {
        'Risk Level': params.overallRisk.toUpperCase(),
      },
    });
  }

  /**
   * Format a due diligence completed notification.
   */
  formatDueDiligenceCompleted(params: {
    reportId: string;
    reportNumber?: string;
    targetEntityName: string;
    ddType: string;
    overallRiskRating: string;
    findingsCount: number;
    dealBreakerCount: number;
    assessedValue?: number;
    currency?: string;
    actionUrl?: string;
  }): SlackMessagePayload {
    const priority: NotificationPriority =
      params.dealBreakerCount > 0 ? 'critical' : 'medium';

    const dealBreakerText = params.dealBreakerCount > 0
      ? `\n\n:rotating_light: *${params.dealBreakerCount} DEAL BREAKER(S) IDENTIFIED*`
      : '';

    let valueText = '';
    if (params.assessedValue !== undefined && params.currency) {
      valueText = `\n*Assessed Portfolio Value:* ${params.currency} ${params.assessedValue.toLocaleString()}`;
    }

    return this.formatIPNotification({
      eventCategory: 'due_diligence_completed',
      priority,
      title: `Due Diligence Completed: ${params.targetEntityName}`,
      message: `:mag: IP Due Diligence Report has been completed.\n\n*Target:* ${params.targetEntityName}\n*Type:* ${params.ddType}\n*Overall Risk:* ${params.overallRiskRating}\n*Findings:* ${params.findingsCount}${valueText}${dealBreakerText}`,
      assetType: 'due_diligence',
      assetId: params.reportId,
      assetIdentifier: params.reportNumber ?? params.targetEntityName,
      actionUrl: params.actionUrl,
      metadata: {
        'DD Type': params.ddType,
        'Risk Rating': params.overallRiskRating,
      },
    });
  }
}

/**
 * Default Slack webhook service singleton.
 */
export const slackWebhookService = new SlackWebhookService();
