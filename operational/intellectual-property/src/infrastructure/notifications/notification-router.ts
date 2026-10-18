/**
 * Notification Router
 *
 * Routes notifications to configured channels based on event type,
 * priority level, and team/department configuration.
 *
 * @module infrastructure/notifications
 */

import type { NotificationPriority } from '../aws/sns-notification-service.js';
import {
  notificationConfig,
  type NotificationConfig,
  type NotificationRoutingRule,
  type SlackChannelConfig,
  type TeamsChannelConfig,
  type IPAssetType,
  type IPEventCategory,
} from './notification-config.js';
import {
  SlackWebhookService,
  slackWebhookService,
  type IPNotificationData as SlackNotificationData,
  type WebhookSendResult,
} from './slack-webhook.service.js';
import {
  TeamsWebhookService,
  teamsWebhookService,
  type IPNotificationData as TeamsNotificationData,
} from './teams-webhook.service.js';

/**
 * Unified notification data.
 */
export interface NotificationData {
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
  threadId?: string;
  metadata?: Record<string, string>;
}

/**
 * Routing result for a single channel.
 */
export interface ChannelSendResult {
  channelId: string;
  channelName: string;
  channelType: 'slack' | 'teams';
  success: boolean;
  statusCode?: number;
  error?: string;
  retriesUsed?: number;
}

/**
 * Overall routing result.
 */
export interface RoutingResult {
  notificationId: string;
  timestamp: Date;
  matchedRules: string[];
  totalChannels: number;
  successCount: number;
  failureCount: number;
  results: ChannelSendResult[];
}

/**
 * Retry options.
 */
export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

/**
 * Notification Router
 *
 * Routes notifications to appropriate channels based on configuration.
 */
export class NotificationRouter {
  private readonly config: NotificationConfig;
  private readonly slackService: SlackWebhookService;
  private readonly teamsService: TeamsWebhookService;

  constructor(options?: {
    config?: NotificationConfig;
    slackService?: SlackWebhookService;
    teamsService?: TeamsWebhookService;
  }) {
    this.config = options?.config ?? notificationConfig;
    this.slackService = options?.slackService ?? slackWebhookService;
    this.teamsService = options?.teamsService ?? teamsWebhookService;
  }

  /**
   * Route a notification to all matching channels.
   */
  async route(data: NotificationData): Promise<RoutingResult> {
    const notificationId = this.generateNotificationId();
    const timestamp = new Date();

    // Check if notifications are enabled
    if (!this.config.enabled) {
      return {
        notificationId,
        timestamp,
        matchedRules: [],
        totalChannels: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
      };
    }

    // Find matching routing rules
    const matchedRules = this.findMatchingRules(data);

    if (matchedRules.length === 0) {
      return {
        notificationId,
        timestamp,
        matchedRules: [],
        totalChannels: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
      };
    }

    // Collect unique channels to send to
    const slackChannelIds = new Set<string>();
    const teamsChannelIds = new Set<string>();

    for (const rule of matchedRules) {
      rule.slackChannels.forEach(id => slackChannelIds.add(id));
      rule.teamsChannels.forEach(id => teamsChannelIds.add(id));
    }

    // Send to all channels
    const results: ChannelSendResult[] = [];

    // Send to Slack channels
    const slackPromises = Array.from(slackChannelIds).map(async channelId => {
      const channel = this.config.slackChannels.find(c => c.id === channelId);
      if (!channel || !channel.enabled) {
        return null;
      }
      return this.sendToSlack(channel, data);
    });

    // Send to Teams channels
    const teamsPromises = Array.from(teamsChannelIds).map(async channelId => {
      const channel = this.config.teamsChannels.find(c => c.id === channelId);
      if (!channel || !channel.enabled) {
        return null;
      }
      return this.sendToTeams(channel, data);
    });

    // Wait for all sends
    const allResults = await Promise.all([...slackPromises, ...teamsPromises]);

    // Filter out null results and collect
    for (const result of allResults) {
      if (result) {
        results.push(result);
      }
    }

    // Calculate statistics
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return {
      notificationId,
      timestamp,
      matchedRules: matchedRules.map(r => r.id),
      totalChannels: results.length,
      successCount,
      failureCount,
      results,
    };
  }

  /**
   * Find routing rules that match the notification.
   */
  private findMatchingRules(data: NotificationData): NotificationRoutingRule[] {
    const priorityRank: Record<NotificationPriority, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };

    return this.config.routingRules
      .filter(rule => {
        // Check if rule is enabled
        if (!rule.enabled) {
          return false;
        }

        // Check event category match
        if (!rule.eventCategories.includes(data.eventCategory)) {
          return false;
        }

        // Check asset type match (empty = all)
        if (rule.assetTypes.length > 0 && data.assetType) {
          if (!rule.assetTypes.includes(data.assetType)) {
            return false;
          }
        }

        // Check priority level
        if (priorityRank[data.priority] < priorityRank[rule.minPriority]) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.rulePriority - a.rulePriority);
  }

  /**
   * Send notification to a Slack channel with retry logic.
   */
  private async sendToSlack(
    channel: SlackChannelConfig,
    data: NotificationData
  ): Promise<ChannelSendResult> {
    const slackData: SlackNotificationData = {
      ...data,
      threadId: data.threadId,
    };

    let result: WebhookSendResult | null = null;
    let retriesUsed = 0;

    for (let attempt = 0; attempt < this.config.retry.maxAttempts; attempt++) {
      result = await this.slackService.sendIPNotification(
        channel.webhookUrl,
        slackData
      );

      if (result.success) {
        break;
      }

      retriesUsed = attempt + 1;

      // Don't retry on certain errors
      if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) {
        // Client error, don't retry
        break;
      }

      // Wait before retry with exponential backoff
      if (attempt < this.config.retry.maxAttempts - 1) {
        const delay = Math.min(
          this.config.retry.initialDelayMs * Math.pow(2, attempt),
          this.config.retry.maxDelayMs
        );
        await this.sleep(delay);
      }
    }

    return {
      channelId: channel.id,
      channelName: channel.name,
      channelType: 'slack',
      success: result?.success ?? false,
      statusCode: result?.statusCode,
      error: result?.error,
      retriesUsed: retriesUsed > 0 ? retriesUsed : undefined,
    };
  }

  /**
   * Send notification to a Teams channel with retry logic.
   */
  private async sendToTeams(
    channel: TeamsChannelConfig,
    data: NotificationData
  ): Promise<ChannelSendResult> {
    const teamsData: TeamsNotificationData = {
      ...data,
    };

    let result: WebhookSendResult | null = null;
    let retriesUsed = 0;

    for (let attempt = 0; attempt < this.config.retry.maxAttempts; attempt++) {
      result = await this.teamsService.sendIPNotification(
        channel.webhookUrl,
        teamsData
      );

      if (result.success) {
        break;
      }

      retriesUsed = attempt + 1;

      // Don't retry on certain errors
      if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) {
        break;
      }

      // Wait before retry
      if (attempt < this.config.retry.maxAttempts - 1) {
        const delay = Math.min(
          this.config.retry.initialDelayMs * Math.pow(2, attempt),
          this.config.retry.maxDelayMs
        );
        await this.sleep(delay);
      }
    }

    return {
      channelId: channel.id,
      channelName: channel.name,
      channelType: 'teams',
      success: result?.success ?? false,
      statusCode: result?.statusCode,
      error: result?.error,
      retriesUsed: retriesUsed > 0 ? retriesUsed : undefined,
    };
  }

  /**
   * Send a deadline approaching notification.
   */
  async routeDeadlineApproaching(params: {
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
  }): Promise<RoutingResult> {
    const priority: NotificationPriority =
      params.daysRemaining <= 3 ? 'critical' :
      params.daysRemaining <= 7 ? 'high' :
      params.daysRemaining <= 30 ? 'medium' : 'low';

    return this.route({
      eventCategory: 'deadline_approaching',
      priority,
      title: `Deadline Approaching: ${params.title}`,
      message: `Action required for ${params.assetType.replace('_', ' ')} ${params.assetIdentifier}. Deadline is in ${params.daysRemaining} days.`,
      ...params,
    });
  }

  /**
   * Send a deadline missed notification.
   */
  async routeDeadlineMissed(params: {
    assetType: IPAssetType;
    assetId: string;
    assetIdentifier: string;
    title: string;
    dueDate: Date;
    daysOverdue: number;
    jurisdiction?: string;
    actionUrl?: string;
  }): Promise<RoutingResult> {
    return this.route({
      eventCategory: 'deadline_missed',
      priority: 'critical',
      title: `OVERDUE: ${params.title}`,
      message: `Deadline has been missed! ${params.assetType.replace('_', ' ')} ${params.assetIdentifier} is now ${params.daysOverdue} days overdue. Immediate action may be required.`,
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
   * Send a critical alert (opposition, dispute).
   */
  async routeCriticalAlert(params: {
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
  }): Promise<RoutingResult> {
    const eventCategory: IPEventCategory =
      params.alertType === 'opposition' ? 'opposition_filed' :
      params.alertType === 'dispute' ? 'dispute_filed' : 'critical_alert';

    let message = params.details ?? `A ${params.alertType} has been filed against ${params.assetIdentifier}.`;
    if (params.opponent) {
      message += ` Filed by: ${params.opponent}.`;
    }
    if (params.responseDeadline) {
      message += ` Response deadline: ${params.responseDeadline.toISOString().split('T')[0]}.`;
    }
    message += ' Contact legal counsel immediately.';

    return this.route({
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
   * Send a trade secret access notification.
   */
  async routeTradeSecretAccess(params: {
    tradeSecretId: string;
    tradeSecretName: string;
    accessedBy: string;
    accessedAt: Date;
    accessLevel: 'view' | 'export' | 'modify';
    purpose: string;
    ipAddress?: string;
    actionUrl?: string;
  }): Promise<RoutingResult> {
    const priority: NotificationPriority =
      params.accessLevel === 'export' ? 'critical' :
      params.accessLevel === 'modify' ? 'high' : 'medium';

    return this.route({
      eventCategory: 'trade_secret_access',
      priority,
      title: `Trade Secret Accessed: ${params.tradeSecretName}`,
      message: `${params.accessedBy} accessed trade secret with ${params.accessLevel} permissions. Purpose: ${params.purpose}`,
      assetType: 'trade_secret',
      assetId: params.tradeSecretId,
      assetIdentifier: params.tradeSecretName,
      actionUrl: params.actionUrl,
      metadata: {
        'Access Level': params.accessLevel.toUpperCase(),
        'Accessed At': params.accessedAt.toISOString(),
        'Accessed By': params.accessedBy,
        ...(params.ipAddress && { 'IP Address': params.ipAddress }),
      },
    });
  }

  /**
   * Send an enforcement matter update notification.
   */
  async routeEnforcementUpdate(params: {
    matterId: string;
    matterTitle: string;
    updateType: 'opened' | 'status_changed' | 'litigation_filed' | 'settled' | 'resolved' | 'escalated';
    oldStatus?: string;
    newStatus?: string;
    details?: string;
    priority?: NotificationPriority;
    actionUrl?: string;
  }): Promise<RoutingResult> {
    const priority = params.priority ??
      (params.updateType === 'litigation_filed' || params.updateType === 'escalated' ? 'critical' :
       params.updateType === 'opened' ? 'high' : 'medium');

    let message = `Enforcement matter update: `;
    if (params.oldStatus && params.newStatus) {
      message += `Status changed from ${params.oldStatus} to ${params.newStatus}`;
    } else {
      message += params.details ?? `Matter ${params.updateType.replace('_', ' ')}`;
    }

    return this.route({
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
   * Send a valuation completed notification.
   */
  async routeValuationCompleted(params: {
    valuationId: string;
    valuationNumber?: string;
    title: string;
    selectedValue: number;
    currency: string;
    purpose: string;
    assetCount: number;
    actionUrl?: string;
  }): Promise<RoutingResult> {
    return this.route({
      eventCategory: 'valuation_completed',
      priority: 'medium',
      title: `IP Valuation Completed: ${params.title}`,
      message: `IP Valuation has been completed. Total Value: ${params.currency} ${params.selectedValue.toLocaleString()}. Assets Valued: ${params.assetCount}`,
      assetType: 'valuation',
      assetId: params.valuationId,
      assetIdentifier: params.valuationNumber ?? params.valuationId,
      amount: params.selectedValue,
      currency: params.currency,
      actionUrl: params.actionUrl,
      metadata: {
        Purpose: params.purpose,
      },
    });
  }

  /**
   * Send an FTO analysis completed notification.
   */
  async routeFTOCompleted(params: {
    analysisId: string;
    analysisNumber?: string;
    productName: string;
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    findingsCount: number;
    potentialIssuesCount: number;
    actionUrl?: string;
  }): Promise<RoutingResult> {
    const priority: NotificationPriority =
      params.overallRisk === 'critical' || params.overallRisk === 'high' ? 'high' : 'medium';

    return this.route({
      eventCategory: 'fto_completed',
      priority,
      title: `FTO Analysis Completed: ${params.productName}`,
      message: `Freedom-to-Operate analysis completed. Overall Risk: ${params.overallRisk.toUpperCase()}. Findings: ${params.findingsCount}. Potential Issues: ${params.potentialIssuesCount}`,
      assetType: 'fto',
      assetId: params.analysisId,
      assetIdentifier: params.analysisNumber ?? params.productName,
      actionUrl: params.actionUrl,
      metadata: {
        'Risk Level': params.overallRisk.toUpperCase(),
        'Findings': params.findingsCount.toString(),
        'Potential Issues': params.potentialIssuesCount.toString(),
      },
    });
  }

  /**
   * Send a due diligence completed notification.
   */
  async routeDueDiligenceCompleted(params: {
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
  }): Promise<RoutingResult> {
    const priority: NotificationPriority =
      params.dealBreakerCount > 0 ? 'critical' : 'medium';

    const dealBreakerText = params.dealBreakerCount > 0
      ? ` DEAL BREAKERS IDENTIFIED: ${params.dealBreakerCount}.`
      : '';

    return this.route({
      eventCategory: 'due_diligence_completed',
      priority,
      title: `Due Diligence Completed: ${params.targetEntityName}`,
      message: `IP Due Diligence Report completed. Target: ${params.targetEntityName}. Type: ${params.ddType}. Overall Risk: ${params.overallRiskRating}. Findings: ${params.findingsCount}.${dealBreakerText}`,
      assetType: 'due_diligence',
      assetId: params.reportId,
      assetIdentifier: params.reportNumber ?? params.targetEntityName,
      amount: params.assessedValue,
      currency: params.currency,
      actionUrl: params.actionUrl,
      metadata: {
        'DD Type': params.ddType,
        'Risk Rating': params.overallRiskRating,
        'Findings': params.findingsCount.toString(),
        ...(params.dealBreakerCount > 0 && { 'Deal Breakers': params.dealBreakerCount.toString() }),
      },
    });
  }

  /**
   * Add a routing rule dynamically.
   */
  addRoutingRule(rule: NotificationRoutingRule): void {
    this.config.routingRules.push(rule);
    // Re-sort by priority
    this.config.routingRules.sort((a, b) => b.rulePriority - a.rulePriority);
  }

  /**
   * Remove a routing rule by ID.
   */
  removeRoutingRule(ruleId: string): boolean {
    const index = this.config.routingRules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.config.routingRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Add a Slack channel configuration.
   */
  addSlackChannel(channel: SlackChannelConfig): void {
    this.config.slackChannels.push(channel);
  }

  /**
   * Add a Teams channel configuration.
   */
  addTeamsChannel(channel: TeamsChannelConfig): void {
    this.config.teamsChannels.push(channel);
  }

  /**
   * Enable or disable a channel.
   */
  setChannelEnabled(channelId: string, enabled: boolean): boolean {
    const slackChannel = this.config.slackChannels.find(c => c.id === channelId);
    if (slackChannel) {
      slackChannel.enabled = enabled;
      return true;
    }

    const teamsChannel = this.config.teamsChannels.find(c => c.id === channelId);
    if (teamsChannel) {
      teamsChannel.enabled = enabled;
      return true;
    }

    return false;
  }

  /**
   * Get current configuration (read-only).
   */
  getConfig(): Readonly<NotificationConfig> {
    return this.config;
  }

  /**
   * Generate a unique notification ID.
   */
  private generateNotificationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `notif-${timestamp}-${random}`;
  }

  /**
   * Sleep helper for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Default notification router singleton.
 */
export const notificationRouter = new NotificationRouter();
