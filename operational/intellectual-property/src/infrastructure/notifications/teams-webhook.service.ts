/**
 * Microsoft Teams Webhook Service
 *
 * Sends notifications to Teams channels via incoming webhooks.
 * Uses Adaptive Cards for rich formatting.
 *
 * @module infrastructure/notifications
 */

import type { NotificationPriority } from '../aws/sns-notification-service.js';
import {
  priorityColors,
  eventCategoryNames,
  assetTypeIcons,
  type IPAssetType,
  type IPEventCategory,
} from './notification-config.js';

/**
 * Adaptive Card element types.
 */
export type AdaptiveCardElementType =
  | 'TextBlock'
  | 'Image'
  | 'ColumnSet'
  | 'Column'
  | 'FactSet'
  | 'Container'
  | 'ActionSet';

/**
 * Adaptive Card action types.
 */
export type AdaptiveCardActionType = 'Action.OpenUrl' | 'Action.Submit';

/**
 * Adaptive Card text weight.
 */
export type TextWeight = 'Default' | 'Lighter' | 'Bolder';

/**
 * Adaptive Card text size.
 */
export type TextSize = 'Default' | 'Small' | 'Medium' | 'Large' | 'ExtraLarge';

/**
 * Adaptive Card text color.
 */
export type TextColor = 'Default' | 'Dark' | 'Light' | 'Accent' | 'Good' | 'Warning' | 'Attention';

/**
 * Adaptive Card element base.
 */
export interface AdaptiveCardElement {
  type: AdaptiveCardElementType;
  id?: string;
  spacing?: 'None' | 'Small' | 'Default' | 'Medium' | 'Large' | 'ExtraLarge' | 'Padding';
  separator?: boolean;
  isVisible?: boolean;
}

/**
 * TextBlock element.
 */
export interface TextBlockElement extends AdaptiveCardElement {
  type: 'TextBlock';
  text: string;
  weight?: TextWeight;
  size?: TextSize;
  color?: TextColor;
  wrap?: boolean;
  maxLines?: number;
  isSubtle?: boolean;
}

/**
 * Fact in a FactSet.
 */
export interface Fact {
  title: string;
  value: string;
}

/**
 * FactSet element.
 */
export interface FactSetElement extends AdaptiveCardElement {
  type: 'FactSet';
  facts: Fact[];
}

/**
 * Column element.
 */
export interface ColumnElement extends AdaptiveCardElement {
  type: 'Column';
  width: 'auto' | 'stretch' | string;
  items: AdaptiveCardElement[];
  verticalContentAlignment?: 'Top' | 'Center' | 'Bottom';
}

/**
 * ColumnSet element.
 */
export interface ColumnSetElement extends AdaptiveCardElement {
  type: 'ColumnSet';
  columns: ColumnElement[];
}

/**
 * Container element.
 */
export interface ContainerElement extends AdaptiveCardElement {
  type: 'Container';
  items: AdaptiveCardElement[];
  style?: 'default' | 'emphasis' | 'good' | 'attention' | 'warning' | 'accent';
  bleed?: boolean;
}

/**
 * Action element.
 */
export interface AdaptiveCardAction {
  type: AdaptiveCardActionType;
  title: string;
  url?: string;
  data?: Record<string, unknown>;
  style?: 'default' | 'positive' | 'destructive';
}

/**
 * ActionSet element.
 */
export interface ActionSetElement extends AdaptiveCardElement {
  type: 'ActionSet';
  actions: AdaptiveCardAction[];
}

/**
 * Adaptive Card structure.
 */
export interface AdaptiveCard {
  type: 'AdaptiveCard';
  $schema: string;
  version: string;
  body: AdaptiveCardElement[];
  actions?: AdaptiveCardAction[];
  msteams?: {
    width?: 'Full';
  };
}

/**
 * Teams message card (legacy connector format).
 */
export interface TeamsMessageCard {
  '@type': 'MessageCard';
  '@context': string;
  themeColor: string;
  summary: string;
  sections: Array<{
    activityTitle?: string;
    activitySubtitle?: string;
    activityImage?: string;
    facts?: Array<{ name: string; value: string }>;
    text?: string;
    markdown?: boolean;
  }>;
  potentialAction?: Array<{
    '@type': string;
    name: string;
    targets?: Array<{ os: string; uri: string }>;
  }>;
}

/**
 * Teams webhook payload (supports both card types).
 */
export interface TeamsWebhookPayload {
  type?: 'message';
  attachments?: Array<{
    contentType: string;
    contentUrl?: string | null;
    content: AdaptiveCard;
  }>;
  // Legacy MessageCard fields for older connectors
  '@type'?: string;
  '@context'?: string;
  themeColor?: string;
  summary?: string;
  sections?: TeamsMessageCard['sections'];
  potentialAction?: TeamsMessageCard['potentialAction'];
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
  assetIdentifier?: string;
  dueDate?: Date;
  daysRemaining?: number;
  jurisdiction?: string;
  amount?: number;
  currency?: string;
  actionUrl?: string;
  metadata?: Record<string, string>;
}

/**
 * Webhook send result.
 */
export interface WebhookSendResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Teams Webhook Service
 *
 * Provides methods to send formatted notifications to Teams channels.
 */
export class TeamsWebhookService {
  private readonly cardSchema = 'http://adaptivecards.io/schemas/adaptive-card.json';
  private readonly cardVersion = '1.4';

  /**
   * Send a message to a Teams webhook.
   */
  async send(
    webhookUrl: string,
    payload: TeamsWebhookPayload
  ): Promise<WebhookSendResult> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          statusCode: response.status,
          error: `Teams webhook failed: ${response.status} - ${errorText}`,
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
   * Send an IP notification with Adaptive Card formatting.
   */
  async sendIPNotification(
    webhookUrl: string,
    data: IPNotificationData
  ): Promise<WebhookSendResult> {
    const payload = this.formatIPNotification(data);
    return this.send(webhookUrl, payload);
  }

  /**
   * Format an IP notification into an Adaptive Card.
   */
  formatIPNotification(data: IPNotificationData): TeamsWebhookPayload {
    const color = priorityColors[data.priority];
    const categoryName = eventCategoryNames[data.eventCategory];

    const body: AdaptiveCardElement[] = [];

    // Header container with accent color
    const headerContainer: ContainerElement = {
      type: 'Container',
      style: this.getPriorityStyle(data.priority),
      bleed: true,
      items: [
        {
          type: 'TextBlock',
          text: data.title,
          weight: 'Bolder',
          size: 'Large',
          wrap: true,
          color: data.priority === 'critical' ? 'Attention' : 'Default',
        } as TextBlockElement,
        {
          type: 'TextBlock',
          text: `${categoryName} | Priority: ${data.priority.toUpperCase()}`,
          size: 'Small',
          isSubtle: true,
          wrap: true,
        } as TextBlockElement,
      ],
    };
    body.push(headerContainer);

    // Main message
    body.push({
      type: 'TextBlock',
      text: data.message,
      wrap: true,
      spacing: 'Medium',
    } as TextBlockElement);

    // Facts section
    const facts: Fact[] = [];

    if (data.assetType) {
      facts.push({
        title: 'Asset Type',
        value: data.assetType.replace('_', ' ').toUpperCase(),
      });
    }

    if (data.assetIdentifier) {
      facts.push({
        title: 'Identifier',
        value: data.assetIdentifier,
      });
    }

    if (data.dueDate) {
      facts.push({
        title: 'Due Date',
        value: data.dueDate.toISOString().split('T')[0] ?? '',
      });
    }

    if (data.daysRemaining !== undefined) {
      facts.push({
        title: 'Timeline',
        value: data.daysRemaining < 0
          ? `${Math.abs(data.daysRemaining)} days overdue`
          : `${data.daysRemaining} days remaining`,
      });
    }

    if (data.jurisdiction) {
      facts.push({
        title: 'Jurisdiction',
        value: data.jurisdiction,
      });
    }

    if (data.amount !== undefined && data.currency) {
      facts.push({
        title: 'Amount',
        value: `${data.currency} ${data.amount.toLocaleString()}`,
      });
    }

    // Add metadata facts
    if (data.metadata) {
      Object.entries(data.metadata).forEach(([key, value]) => {
        facts.push({ title: key, value });
      });
    }

    if (facts.length > 0) {
      body.push({
        type: 'FactSet',
        facts,
        separator: true,
        spacing: 'Medium',
      } as FactSetElement);
    }

    // Footer
    body.push({
      type: 'TextBlock',
      text: `Sent from IP Management System | ${new Date().toISOString()}`,
      size: 'Small',
      isSubtle: true,
      spacing: 'Medium',
      separator: true,
    } as TextBlockElement);

    // Build actions
    const actions: AdaptiveCardAction[] = [];
    if (data.actionUrl) {
      actions.push({
        type: 'Action.OpenUrl',
        title: 'View Details',
        url: data.actionUrl,
        style: 'positive',
      });
    }

    const card: AdaptiveCard = {
      type: 'AdaptiveCard',
      $schema: this.cardSchema,
      version: this.cardVersion,
      body,
      actions: actions.length > 0 ? actions : undefined,
      msteams: {
        width: 'Full',
      },
    };

    return {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: card,
        },
      ],
    };
  }

  /**
   * Get container style based on priority.
   */
  private getPriorityStyle(priority: NotificationPriority): ContainerElement['style'] {
    switch (priority) {
      case 'critical':
        return 'attention';
      case 'high':
        return 'warning';
      case 'medium':
        return 'accent';
      default:
        return 'default';
    }
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
  }): TeamsWebhookPayload {
    const priority: NotificationPriority =
      params.daysRemaining <= 3 ? 'critical' :
      params.daysRemaining <= 7 ? 'high' :
      params.daysRemaining <= 30 ? 'medium' : 'low';

    return this.formatIPNotification({
      eventCategory: 'deadline_approaching',
      priority,
      title: `Deadline Approaching: ${params.title}`,
      message: `Action required for **${params.assetType.replace('_', ' ')}** ${params.assetIdentifier}. Deadline is in **${params.daysRemaining} days**.`,
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
  }): TeamsWebhookPayload {
    return this.formatIPNotification({
      eventCategory: 'deadline_missed',
      priority: 'critical',
      title: `OVERDUE: ${params.title}`,
      message: `**Deadline has been missed!** ${params.assetType.replace('_', ' ')} ${params.assetIdentifier} is now **${params.daysOverdue} days overdue**.\n\nImmediate action may be required to assess consequences and remediation options.`,
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
  }): TeamsWebhookPayload {
    const eventCategory: IPEventCategory =
      params.alertType === 'opposition' ? 'opposition_filed' :
      params.alertType === 'dispute' ? 'dispute_filed' : 'critical_alert';

    let message = `**URGENT ATTENTION REQUIRED**\n\n`;
    message += params.details ?? `A ${params.alertType} has been filed against ${params.assetIdentifier}.`;

    if (params.opponent) {
      message += `\n\n**Filed by:** ${params.opponent}`;
    }

    if (params.responseDeadline) {
      message += `\n\n**Response Deadline:** ${params.responseDeadline.toISOString().split('T')[0]}`;
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
  }): TeamsWebhookPayload {
    const priority: NotificationPriority =
      params.accessLevel === 'export' ? 'critical' :
      params.accessLevel === 'modify' ? 'high' : 'medium';

    return this.formatIPNotification({
      eventCategory: 'trade_secret_access',
      priority,
      title: `Trade Secret Accessed: ${params.tradeSecretName}`,
      message: `**${params.accessedBy}** accessed trade secret with **${params.accessLevel}** permissions.\n\n**Purpose:** ${params.purpose}`,
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
  }): TeamsWebhookPayload {
    const priority = params.priority ??
      (params.updateType === 'litigation_filed' || params.updateType === 'escalated' ? 'critical' :
       params.updateType === 'opened' ? 'high' : 'medium');

    let message = `**Enforcement Matter Update**\n\n`;

    if (params.oldStatus && params.newStatus) {
      message += `Status changed from **${params.oldStatus}** to **${params.newStatus}**`;
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
  }): TeamsWebhookPayload {
    return this.formatIPNotification({
      eventCategory: 'valuation_completed',
      priority: 'medium',
      title: `IP Valuation Completed: ${params.title}`,
      message: `IP Valuation has been completed.\n\n**Total Value:** ${params.currency} ${params.selectedValue.toLocaleString()}\n**Assets Valued:** ${params.assetCount}`,
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
  }): TeamsWebhookPayload {
    const priority: NotificationPriority =
      params.overallRisk === 'critical' || params.overallRisk === 'high' ? 'high' : 'medium';

    return this.formatIPNotification({
      eventCategory: 'fto_completed',
      priority,
      title: `FTO Analysis Completed: ${params.productName}`,
      message: `Freedom-to-Operate analysis has been completed.\n\n**Overall Risk:** ${params.overallRisk.toUpperCase()}\n**Total Findings:** ${params.findingsCount}\n**Potential Issues:** ${params.potentialIssuesCount}`,
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
  }): TeamsWebhookPayload {
    const priority: NotificationPriority =
      params.dealBreakerCount > 0 ? 'critical' : 'medium';

    const dealBreakerText = params.dealBreakerCount > 0
      ? `\n\n**${params.dealBreakerCount} DEAL BREAKER(S) IDENTIFIED**`
      : '';

    let valueText = '';
    if (params.assessedValue !== undefined && params.currency) {
      valueText = `\n**Assessed Portfolio Value:** ${params.currency} ${params.assessedValue.toLocaleString()}`;
    }

    return this.formatIPNotification({
      eventCategory: 'due_diligence_completed',
      priority,
      title: `Due Diligence Completed: ${params.targetEntityName}`,
      message: `IP Due Diligence Report has been completed.\n\n**Target:** ${params.targetEntityName}\n**Type:** ${params.ddType}\n**Overall Risk:** ${params.overallRiskRating}\n**Findings:** ${params.findingsCount}${valueText}${dealBreakerText}`,
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

  /**
   * Create a legacy MessageCard for older webhook connectors.
   */
  formatLegacyMessageCard(data: IPNotificationData): TeamsMessageCard {
    const color = priorityColors[data.priority].replace('#', '');
    const categoryName = eventCategoryNames[data.eventCategory];

    const facts: Array<{ name: string; value: string }> = [];

    if (data.assetType) {
      facts.push({ name: 'Asset Type', value: data.assetType.replace('_', ' ').toUpperCase() });
    }
    if (data.assetIdentifier) {
      facts.push({ name: 'Identifier', value: data.assetIdentifier });
    }
    if (data.dueDate) {
      facts.push({ name: 'Due Date', value: data.dueDate.toISOString().split('T')[0] ?? '' });
    }
    if (data.daysRemaining !== undefined) {
      facts.push({
        name: 'Timeline',
        value: data.daysRemaining < 0
          ? `${Math.abs(data.daysRemaining)} days overdue`
          : `${data.daysRemaining} days remaining`,
      });
    }
    if (data.jurisdiction) {
      facts.push({ name: 'Jurisdiction', value: data.jurisdiction });
    }
    if (data.amount !== undefined && data.currency) {
      facts.push({ name: 'Amount', value: `${data.currency} ${data.amount.toLocaleString()}` });
    }
    if (data.metadata) {
      Object.entries(data.metadata).forEach(([key, value]) => {
        facts.push({ name: key, value });
      });
    }

    const card: TeamsMessageCard = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor: color,
      summary: `${categoryName}: ${data.title}`,
      sections: [
        {
          activityTitle: data.title,
          activitySubtitle: `${categoryName} | Priority: ${data.priority.toUpperCase()}`,
          facts,
          text: data.message,
          markdown: true,
        },
      ],
    };

    if (data.actionUrl) {
      card.potentialAction = [
        {
          '@type': 'OpenUri',
          name: 'View Details',
          targets: [{ os: 'default', uri: data.actionUrl }],
        },
      ];
    }

    return card;
  }
}

/**
 * Default Teams webhook service singleton.
 */
export const teamsWebhookService = new TeamsWebhookService();
