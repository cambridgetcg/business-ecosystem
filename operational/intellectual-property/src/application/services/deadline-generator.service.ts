/**
 * Deadline Generator Service
 *
 * Creates deadlines from domain events based on configured rules.
 * Bridges domain events to the deadline tracking system.
 *
 * @module application/services
 */

import { randomUUID } from 'crypto';
import {
  DeadlineCalculator,
  deadlineCalculator,
  type CalculatedDeadline,
} from '../../domain/services/deadline-calculator.service.js';
import {
  getRulesForEvent,
  ruleAppliesToJurisdiction,
  type DeadlineRule,
} from '../../config/deadline-rules.config.js';
import {
  DeadlineStore,
  deadlineStore,
  type Deadline,
} from '../../infrastructure/aws/dynamodb-deadline-store.js';
import {
  EventBridgePublisher,
  eventBridgePublisher,
} from '../../infrastructure/aws/eventbridge-publisher.js';

/**
 * Event payload for deadline generation.
 */
export interface DeadlineGenerationEvent {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
  metadata?: {
    correlationId?: string;
    userId?: string;
  };
}

/**
 * Result of deadline generation.
 */
export interface DeadlineGenerationResult {
  eventType: string;
  aggregateId: string;
  deadlinesCreated: number;
  deadlineIds: string[];
  errors: string[];
}

/**
 * Deadline Generator Service
 *
 * Listens to domain events and creates appropriate deadlines.
 */
export class DeadlineGeneratorService {
  constructor(
    private readonly calculator: DeadlineCalculator = deadlineCalculator,
    private readonly store: DeadlineStore = deadlineStore,
    private readonly publisher: EventBridgePublisher = eventBridgePublisher
  ) {}

  /**
   * Process a domain event and generate applicable deadlines.
   */
  async processEvent(event: DeadlineGenerationEvent): Promise<DeadlineGenerationResult> {
    const result: DeadlineGenerationResult = {
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      deadlinesCreated: 0,
      deadlineIds: [],
      errors: [],
    };

    // Get rules that apply to this event
    const rules = getRulesForEvent(event.eventType);

    if (rules.length === 0) {
      return result;
    }

    // Extract jurisdiction from payload if present
    const jurisdiction = (event.payload.jurisdiction as string) ?? 'US';

    for (const rule of rules) {
      // Check if rule applies to this jurisdiction
      if (!ruleAppliesToJurisdiction(rule, jurisdiction)) {
        continue;
      }

      try {
        const deadlines = await this.generateDeadlinesForRule(rule, event, jurisdiction);

        for (const deadline of deadlines) {
          const deadlineId = randomUUID();
          const deadlineRecord: Deadline = {
            assetId: event.aggregateId,
            deadlineId,
            assetType: this.mapAggregateToAssetType(event.aggregateType),
            deadlineType: deadline.deadlineType,
            dueDate: deadline.dueDate.toISOString(),
            status: 'pending',
            priority: deadline.priority,
            title: deadline.title,
            description: deadline.description,
            amount: deadline.amount,
            currency: deadline.currency,
            jurisdiction: deadline.jurisdiction ?? jurisdiction,
            remindersSent: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: {
              generatedFromEvent: event.eventType,
              correlationId: event.metadata?.correlationId,
            },
          };

          await this.store.createDeadline(deadlineRecord);

          // Publish deadline created event
          await this.publisher.publish({
            type: 'Deadline.Created',
            aggregateType: 'Deadline',
            aggregateId: deadlineId,
            timestamp: new Date(),
            payload: {
              assetId: event.aggregateId,
              assetType: deadlineRecord.assetType,
              deadlineType: deadline.deadlineType,
              dueDate: deadline.dueDate.toISOString(),
              priority: deadline.priority,
            },
            metadata: event.metadata,
          });

          result.deadlinesCreated++;
          result.deadlineIds.push(deadlineId);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Rule ${rule.deadlineType}: ${message}`);
      }
    }

    return result;
  }

  /**
   * Generate deadlines based on a specific rule.
   */
  private async generateDeadlinesForRule(
    rule: DeadlineRule,
    event: DeadlineGenerationEvent,
    jurisdiction: string
  ): Promise<CalculatedDeadline[]> {
    switch (event.eventType) {
      case 'Patent.Granted':
        return this.handlePatentGranted(event, jurisdiction);

      case 'Trademark.Registered':
        return this.handleTrademarkRegistered(event, jurisdiction);

      case 'Trademark.OppositionFiled':
        return this.handleOppositionFiled(event, jurisdiction);

      case 'DomainName.Registered':
      case 'DomainName.Renewed':
        return this.handleDomainRegistered(event);

      case 'DomainDispute.Filed':
        return this.handleDomainDisputeFiled(event);

      case 'License.Executed':
        return this.handleLicenseExecuted(event);

      case 'License.RoyaltyScheduled':
        return this.handleRoyaltyScheduled(event);

      default:
        return [];
    }
  }

  /**
   * Handle Patent.Granted event - create maintenance fee deadlines.
   */
  private handlePatentGranted(
    event: DeadlineGenerationEvent,
    jurisdiction: string
  ): CalculatedDeadline[] {
    const grantDate = new Date(event.payload.grantDate as string);
    const entitySize = (event.payload.entitySize as 'micro' | 'small' | 'large') ?? 'large';

    return this.calculator.calculatePatentMaintenanceDeadlines(
      grantDate,
      jurisdiction,
      entitySize
    );
  }

  /**
   * Handle Trademark.Registered event - create maintenance/renewal deadlines.
   */
  private handleTrademarkRegistered(
    event: DeadlineGenerationEvent,
    jurisdiction: string
  ): CalculatedDeadline[] {
    const registrationDate = new Date(event.payload.registrationDate as string);

    return this.calculator.calculateTrademarkMaintenanceDeadlines(
      registrationDate,
      jurisdiction
    );
  }

  /**
   * Handle Trademark.OppositionFiled event - create response deadline.
   */
  private handleOppositionFiled(
    event: DeadlineGenerationEvent,
    jurisdiction: string
  ): CalculatedDeadline[] {
    const filingDate = new Date(event.payload.filingDate as string);

    return [this.calculator.calculateOppositionResponseDeadline(filingDate, jurisdiction)];
  }

  /**
   * Handle DomainName.Registered/Renewed event - create expiration deadline.
   */
  private handleDomainRegistered(event: DeadlineGenerationEvent): CalculatedDeadline[] {
    const expirationDate = new Date(event.payload.expirationDate as string);
    const domainName = event.payload.domainName as string;
    const registrar = (event.payload.registrar as string) ?? 'Unknown';

    return [this.calculator.calculateDomainExpirationDeadline(
      expirationDate,
      domainName,
      registrar
    )];
  }

  /**
   * Handle DomainDispute.Filed event - create UDRP response deadline.
   */
  private handleDomainDisputeFiled(event: DeadlineGenerationEvent): CalculatedDeadline[] {
    const filingDate = new Date(event.payload.filingDate as string);

    return [this.calculator.calculateUDRPResponseDeadline(filingDate)];
  }

  /**
   * Handle License.Executed event - create royalty schedule.
   */
  private handleLicenseExecuted(event: DeadlineGenerationEvent): CalculatedDeadline[] {
    const royaltySchedule = event.payload.royaltySchedule as Array<{
      dueDate: string;
      amount: number;
      currency: string;
    }> | undefined;

    if (!royaltySchedule || royaltySchedule.length === 0) {
      return [];
    }

    const licenseeName = (event.payload.licenseeName as string) ?? 'Unknown';

    return royaltySchedule.map(payment =>
      this.calculator.calculateLicenseRoyaltyDeadline(
        new Date(payment.dueDate),
        licenseeName,
        payment.amount,
        payment.currency
      )
    );
  }

  /**
   * Handle License.RoyaltyScheduled event - create single royalty deadline.
   */
  private handleRoyaltyScheduled(event: DeadlineGenerationEvent): CalculatedDeadline[] {
    const dueDate = new Date(event.payload.dueDate as string);
    const licenseeName = (event.payload.licenseeName as string) ?? 'Unknown';
    const amount = (event.payload.amount as number) ?? 0;
    const currency = (event.payload.currency as string) ?? 'USD';

    return [this.calculator.calculateLicenseRoyaltyDeadline(
      dueDate,
      licenseeName,
      amount,
      currency
    )];
  }

  /**
   * Map aggregate type to asset type.
   */
  private mapAggregateToAssetType(
    aggregateType: string
  ): 'patent' | 'trademark' | 'domain' | 'license' | 'trade_secret' {
    const mapping: Record<string, 'patent' | 'trademark' | 'domain' | 'license' | 'trade_secret'> = {
      Patent: 'patent',
      Trademark: 'trademark',
      DomainName: 'domain',
      License: 'license',
      TradeSecret: 'trade_secret',
    };

    return mapping[aggregateType] ?? 'patent';
  }

  /**
   * Regenerate deadlines for an asset (e.g., after data correction).
   */
  async regenerateDeadlinesForAsset(
    assetType: string,
    assetId: string,
    eventPayload: Record<string, unknown>
  ): Promise<DeadlineGenerationResult> {
    // Create a synthetic event
    const event: DeadlineGenerationEvent = {
      eventType: this.getRegistrationEventForAssetType(assetType),
      aggregateType: assetType,
      aggregateId: assetId,
      occurredAt: new Date(),
      payload: eventPayload,
    };

    return this.processEvent(event);
  }

  /**
   * Get the registration event type for an asset type.
   */
  private getRegistrationEventForAssetType(assetType: string): string {
    const mapping: Record<string, string> = {
      Patent: 'Patent.Granted',
      Trademark: 'Trademark.Registered',
      DomainName: 'DomainName.Registered',
      License: 'License.Executed',
    };

    return mapping[assetType] ?? 'Unknown';
  }
}

// Singleton instance
export const deadlineGeneratorService = new DeadlineGeneratorService();
