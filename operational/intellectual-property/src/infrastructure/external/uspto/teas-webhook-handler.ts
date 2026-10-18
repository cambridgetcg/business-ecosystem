/**
 * USPTO Webhook Handler
 *
 * Handles push notifications from USPTO (if available).
 * USPTO doesn't currently offer real-time webhooks, but this handler
 * provides the infrastructure for when/if they do, or for integration
 * with third-party notification services.
 *
 * @module infrastructure/external/uspto
 */

import { createHmac } from 'crypto';
import { randomUUID } from 'crypto';
import type {
  USPTOWebhookEvent,
  USPTOApplicationStatus,
  StatusChangeDetection,
} from './teas-types.js';
import type { DomainEvent } from '../../../domain/events/domain-event.js';
import type { IPEventPublisher } from '../../messaging/event-publisher.js';
import { InMemoryEventPublisher } from '../../messaging/event-publisher.js';

/**
 * Webhook handler configuration.
 */
export interface USPTOWebhookHandlerConfig {
  /** Webhook signing secret for signature verification */
  signingSecret: string;
  /** Allowed webhook source IPs (empty = allow all) */
  allowedSourceIps: string[];
  /** Maximum age of webhook event (ms) */
  maxEventAgeMs: number;
  /** Enable handler */
  enabled: boolean;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: Partial<USPTOWebhookHandlerConfig> = {
  allowedSourceIps: [],
  maxEventAgeMs: 300000, // 5 minutes
  enabled: true,
};

/**
 * Webhook processing result.
 */
export interface WebhookProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Event type processed */
  eventType: string | undefined;
  /** Serial number affected */
  serialNumber: string | undefined;
  /** Error message (if failed) */
  error: string | undefined;
  /** Events published */
  eventsPublished: number;
}

/**
 * USPTO Webhook Handler
 *
 * Processes incoming webhook events from USPTO or third-party services
 * that monitor USPTO data changes.
 */
export class USPTOWebhookHandler {
  private readonly config: USPTOWebhookHandlerConfig;
  private processedEventIds: Set<string> = new Set();
  private readonly processedEventCleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    private readonly eventPublisher: IPEventPublisher = new InMemoryEventPublisher(),
    config: Partial<USPTOWebhookHandlerConfig> = {}
  ) {
    this.config = {
      signingSecret: config.signingSecret ?? '',
      ...DEFAULT_CONFIG,
      ...config,
    } as USPTOWebhookHandlerConfig;

    // Clean up old processed event IDs every hour
    this.processedEventCleanupInterval = setInterval(
      () => this.cleanupProcessedEventIds(),
      3600000
    );
  }

  /**
   * Stop the handler and clean up resources.
   */
  shutdown(): void {
    clearInterval(this.processedEventCleanupInterval);
  }

  /**
   * Handle an incoming webhook event.
   */
  async handleWebhook(
    payload: unknown,
    signature: string,
    sourceIp?: string | undefined
  ): Promise<WebhookProcessingResult> {
    // Validate handler is enabled
    if (!this.config.enabled) {
      return {
        success: false,
        eventType: undefined,
        serialNumber: undefined,
        error: 'Webhook handler is disabled',
        eventsPublished: 0,
      };
    }

    // Validate source IP if configured
    if (
      this.config.allowedSourceIps.length > 0 &&
      sourceIp &&
      !this.config.allowedSourceIps.includes(sourceIp)
    ) {
      console.warn(`[USPTOWebhookHandler] Rejected webhook from unauthorized IP: ${sourceIp}`);
      return {
        success: false,
        eventType: undefined,
        serialNumber: undefined,
        error: 'Unauthorized source IP',
        eventsPublished: 0,
      };
    }

    // Parse and validate event
    let event: USPTOWebhookEvent;
    try {
      event = this.parseWebhookEvent(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        eventType: undefined,
        serialNumber: undefined,
        error: `Invalid webhook payload: ${message}`,
        eventsPublished: 0,
      };
    }

    // Verify signature
    if (!this.verifySignature(payload, signature)) {
      console.warn('[USPTOWebhookHandler] Rejected webhook with invalid signature');
      return {
        success: false,
        eventType: event.eventType,
        serialNumber: event.serialNumber,
        error: 'Invalid signature',
        eventsPublished: 0,
      };
    }

    // Check event age
    const eventAge = Date.now() - event.timestamp.getTime();
    if (eventAge > this.config.maxEventAgeMs) {
      console.warn(`[USPTOWebhookHandler] Rejected stale webhook event (age: ${eventAge}ms)`);
      return {
        success: false,
        eventType: event.eventType,
        serialNumber: event.serialNumber,
        error: 'Event is too old',
        eventsPublished: 0,
      };
    }

    // Check for duplicate processing (idempotency)
    const eventKey = `${event.eventType}-${event.serialNumber}-${event.timestamp.getTime()}`;
    if (this.processedEventIds.has(eventKey)) {
      console.log('[USPTOWebhookHandler] Skipping duplicate webhook event');
      return {
        success: true,
        eventType: event.eventType,
        serialNumber: event.serialNumber,
        error: undefined,
        eventsPublished: 0,
      };
    }
    this.processedEventIds.add(eventKey);

    // Process the event
    try {
      const eventsPublished = await this.processEvent(event);
      return {
        success: true,
        eventType: event.eventType,
        serialNumber: event.serialNumber,
        error: undefined,
        eventsPublished,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[USPTOWebhookHandler] Error processing webhook: ${message}`);
      return {
        success: false,
        eventType: event.eventType,
        serialNumber: event.serialNumber,
        error: `Processing failed: ${message}`,
        eventsPublished: 0,
      };
    }
  }

  /**
   * Parse and validate webhook event payload.
   */
  private parseWebhookEvent(payload: unknown): USPTOWebhookEvent {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload must be an object');
    }

    const data = payload as Record<string, unknown>;

    // Validate required fields
    if (!data.eventType || typeof data.eventType !== 'string') {
      throw new Error('Missing or invalid eventType');
    }
    if (!data.serialNumber || typeof data.serialNumber !== 'string') {
      throw new Error('Missing or invalid serialNumber');
    }
    if (!data.timestamp) {
      throw new Error('Missing timestamp');
    }
    if (!data.signature || typeof data.signature !== 'string') {
      throw new Error('Missing or invalid signature');
    }

    const eventType = data.eventType as USPTOWebhookEvent['eventType'];
    const validEventTypes = ['STATUS_CHANGE', 'OFFICE_ACTION', 'PUBLICATION', 'REGISTRATION', 'CANCELLATION'];
    if (!validEventTypes.includes(eventType)) {
      throw new Error(`Invalid eventType: ${eventType}`);
    }

    return {
      eventType,
      serialNumber: data.serialNumber as string,
      registrationNumber: data.registrationNumber as string | undefined,
      timestamp: new Date(data.timestamp as string | number),
      payload: (data.payload as Record<string, unknown>) ?? {},
      signature: data.signature as string,
    };
  }

  /**
   * Verify webhook signature.
   */
  private verifySignature(payload: unknown, signature: string): boolean {
    if (!this.config.signingSecret) {
      console.warn('[USPTOWebhookHandler] No signing secret configured, skipping signature verification');
      return true;
    }

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedSignature = createHmac('sha256', this.config.signingSecret)
      .update(payloadString)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Process a validated webhook event.
   */
  private async processEvent(event: USPTOWebhookEvent): Promise<number> {
    console.log(
      `[USPTOWebhookHandler] Processing ${event.eventType} event for ${event.serialNumber}`
    );

    switch (event.eventType) {
      case 'STATUS_CHANGE':
        return this.handleStatusChange(event);
      case 'OFFICE_ACTION':
        return this.handleOfficeAction(event);
      case 'PUBLICATION':
        return this.handlePublication(event);
      case 'REGISTRATION':
        return this.handleRegistration(event);
      case 'CANCELLATION':
        return this.handleCancellation(event);
      default:
        console.warn(`[USPTOWebhookHandler] Unknown event type: ${event.eventType}`);
        return 0;
    }
  }

  /**
   * Handle STATUS_CHANGE event.
   */
  private async handleStatusChange(event: USPTOWebhookEvent): Promise<number> {
    const previousStatus = event.payload.previousStatus as USPTOApplicationStatus | undefined;
    const newStatus = event.payload.newStatus as USPTOApplicationStatus | undefined;

    if (!newStatus) {
      console.warn('[USPTOWebhookHandler] STATUS_CHANGE missing newStatus');
      return 0;
    }

    await this.publishDomainEvent({
      type: 'USPTO.StatusChanged',
      aggregateType: 'Trademark',
      aggregateId: event.serialNumber, // Will need mapping to internal ID
      payload: {
        serialNumber: event.serialNumber,
        registrationNumber: event.registrationNumber,
        previousStatus,
        newStatus,
        changedAt: event.timestamp,
      },
    });

    return 1;
  }

  /**
   * Handle OFFICE_ACTION event.
   */
  private async handleOfficeAction(event: USPTOWebhookEvent): Promise<number> {
    let eventsPublished = 0;

    await this.publishDomainEvent({
      type: 'USPTO.OfficeActionReceived',
      aggregateType: 'Trademark',
      aggregateId: event.serialNumber,
      payload: {
        serialNumber: event.serialNumber,
        actionType: event.payload.actionType,
        mailedDate: event.timestamp,
        responseDeadline: event.payload.responseDeadline,
        responseRequired: event.payload.responseRequired ?? true,
        isFinal: event.payload.isFinal ?? false,
        description: event.payload.description,
      },
    });
    eventsPublished++;

    // Create deadline if response is required
    if (event.payload.responseRequired && event.payload.responseDeadline) {
      await this.publishDomainEvent({
        type: 'Deadline.CreateRequested',
        aggregateType: 'Deadline',
        aggregateId: randomUUID(),
        payload: {
          assetId: event.serialNumber,
          assetType: 'trademark',
          deadlineType: 'office_action_response',
          dueDate: event.payload.responseDeadline,
          description: `Response required for office action`,
          priority: event.payload.isFinal ? 'critical' : 'high',
          source: 'USPTO_WEBHOOK',
        },
      });
      eventsPublished++;
    }

    return eventsPublished;
  }

  /**
   * Handle PUBLICATION event.
   */
  private async handlePublication(event: USPTOWebhookEvent): Promise<number> {
    let eventsPublished = 0;

    await this.publishDomainEvent({
      type: 'USPTO.ApplicationPublished',
      aggregateType: 'Trademark',
      aggregateId: event.serialNumber,
      payload: {
        serialNumber: event.serialNumber,
        publicationDate: event.timestamp,
        gazetteIssue: event.payload.gazetteIssue,
        oppositionPeriodEnd: event.payload.oppositionPeriodEnd,
      },
    });
    eventsPublished++;

    // Create opposition window deadline
    const oppositionDeadline = event.payload.oppositionPeriodEnd
      ? new Date(event.payload.oppositionPeriodEnd as string)
      : new Date(event.timestamp.getTime() + 30 * 24 * 60 * 60 * 1000);

    await this.publishDomainEvent({
      type: 'Deadline.CreateRequested',
      aggregateType: 'Deadline',
      aggregateId: randomUUID(),
      payload: {
        assetId: event.serialNumber,
        assetType: 'trademark',
        deadlineType: 'opposition_window',
        dueDate: oppositionDeadline.toISOString(),
        description: 'Opposition filing window closes',
        priority: 'medium',
        source: 'USPTO_WEBHOOK',
      },
    });
    eventsPublished++;

    return eventsPublished;
  }

  /**
   * Handle REGISTRATION event.
   */
  private async handleRegistration(event: USPTOWebhookEvent): Promise<number> {
    let eventsPublished = 0;

    await this.publishDomainEvent({
      type: 'USPTO.TrademarkRegistered',
      aggregateType: 'Trademark',
      aggregateId: event.serialNumber,
      payload: {
        serialNumber: event.serialNumber,
        registrationNumber: event.registrationNumber,
        registrationDate: event.timestamp,
        expirationDate: event.payload.expirationDate,
      },
    });
    eventsPublished++;

    // Create Section 8 deadline (5-6 years after registration)
    const registrationDate = event.timestamp;
    const section8Due = new Date(registrationDate);
    section8Due.setFullYear(section8Due.getFullYear() + 5);

    await this.publishDomainEvent({
      type: 'Deadline.CreateRequested',
      aggregateType: 'Deadline',
      aggregateId: randomUUID(),
      payload: {
        assetId: event.serialNumber,
        assetType: 'trademark',
        deadlineType: 'section_8_affidavit',
        dueDate: section8Due.toISOString(),
        description: 'Section 8 Declaration of Continued Use due',
        priority: 'high',
        source: 'USPTO_WEBHOOK',
      },
    });
    eventsPublished++;

    return eventsPublished;
  }

  /**
   * Handle CANCELLATION event.
   */
  private async handleCancellation(event: USPTOWebhookEvent): Promise<number> {
    await this.publishDomainEvent({
      type: 'USPTO.TrademarkCancelled',
      aggregateType: 'Trademark',
      aggregateId: event.serialNumber,
      payload: {
        serialNumber: event.serialNumber,
        registrationNumber: event.registrationNumber,
        cancellationDate: event.timestamp,
        reason: event.payload.reason,
      },
    });

    return 1;
  }

  /**
   * Publish a domain event.
   */
  private async publishDomainEvent(event: {
    type: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const domainEvent: DomainEvent = {
      id: randomUUID(),
      type: event.type,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      payload: event.payload,
      metadata: {
        correlationId: randomUUID(),
        causationId: undefined,
        userId: 'USPTO_WEBHOOK',
        tenantId: undefined,
        source: 'intellectual-property',
        timestamp: new Date(),
      },
      occurredAt: new Date(),
      version: 1,
    };

    await this.eventPublisher.publish(domainEvent);
  }

  /**
   * Clean up old processed event IDs.
   */
  private cleanupProcessedEventIds(): void {
    // Keep set from growing unbounded by clearing periodically
    // In production, use a TTL cache like Redis
    if (this.processedEventIds.size > 10000) {
      this.processedEventIds.clear();
      console.log('[USPTOWebhookHandler] Cleared processed event ID cache');
    }
  }

  /**
   * Create a test webhook event for integration testing.
   */
  static createTestEvent(
    eventType: USPTOWebhookEvent['eventType'],
    serialNumber: string,
    payload: Record<string, unknown> = {},
    signingSecret?: string | undefined
  ): { event: USPTOWebhookEvent; rawPayload: string; signature: string } {
    const timestamp = new Date();

    const eventPayload = {
      eventType,
      serialNumber,
      timestamp: timestamp.toISOString(),
      payload,
      signature: '', // Will be set below
    };

    const rawPayload = JSON.stringify(eventPayload);
    const signature = signingSecret
      ? createHmac('sha256', signingSecret).update(rawPayload).digest('hex')
      : 'test-signature';

    eventPayload.signature = signature;

    return {
      event: {
        eventType,
        serialNumber,
        registrationNumber: undefined,
        timestamp,
        payload,
        signature,
      },
      rawPayload: JSON.stringify(eventPayload),
      signature,
    };
  }
}

// Factory function
export function createUSPTOWebhookHandler(
  eventPublisher?: IPEventPublisher | undefined,
  config?: Partial<USPTOWebhookHandlerConfig> | undefined
): USPTOWebhookHandler {
  return new USPTOWebhookHandler(eventPublisher, config);
}
