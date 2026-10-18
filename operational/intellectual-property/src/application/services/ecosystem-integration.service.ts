/**
 * Ecosystem Integration Service
 *
 * Publishes cross-domain events to other services in the ecosystem:
 * - Contracts-Legal
 * - Accounting
 * - Compliance
 * - Entity-Governance
 *
 * @module application/services
 */

import { eventBridgePublisher, type DomainEvent } from '../../infrastructure/aws/eventbridge-publisher.js';
import type {
  EcosystemEvent,
  LicenseAgreementRequested,
  IPAssignmentRequested,
  NDARequested,
  SettlementAgreementRequested,
  IPValuationCompleted,
  RoyaltyRevenueRecognized,
  IPExpenseIncurred,
  IPAssetCapitalized,
  IPAssetImpaired,
  IPDeadlineCreated,
  IPDeadlineApproaching,
  IPDeadlineMissed,
  RegulatoryFilingRequired,
  IPOwnershipChanged,
} from '../../domain/events/ecosystem-integration.events.js';

/**
 * Target services for event routing.
 */
export type TargetService =
  | 'contracts-legal'
  | 'accounting'
  | 'compliance'
  | 'entity-governance';

/**
 * Event routing configuration.
 */
const EVENT_ROUTING: Record<string, TargetService[]> = {
  // Contracts-Legal events
  'IP.LicenseAgreementRequested': ['contracts-legal'],
  'IP.AssignmentRequested': ['contracts-legal', 'entity-governance'],
  'IP.NDARequested': ['contracts-legal'],
  'IP.SettlementAgreementRequested': ['contracts-legal'],

  // Accounting events
  'IP.ValuationCompleted': ['accounting'],
  'IP.RoyaltyRevenueRecognized': ['accounting'],
  'IP.ExpenseIncurred': ['accounting'],
  'IP.AssetCapitalized': ['accounting'],
  'IP.AssetImpaired': ['accounting'],

  // Compliance events
  'IP.DeadlineCreated': ['compliance'],
  'IP.DeadlineApproaching': ['compliance'],
  'IP.DeadlineMissed': ['compliance'],
  'IP.RegulatoryFilingRequired': ['compliance'],

  // Entity-Governance events
  'IP.OwnershipChanged': ['entity-governance', 'accounting'],
};

/**
 * Ecosystem Integration Service
 *
 * Manages cross-domain event publishing.
 */
export class EcosystemIntegrationService {
  /**
   * Publish an event to the ecosystem.
   */
  async publish(event: EcosystemEvent): Promise<void> {
    const domainEvent: DomainEvent = {
      type: event.eventType,
      aggregateType: 'IPService',
      aggregateId: event.eventId,
      timestamp: event.timestamp,
      payload: (event as unknown as { payload: Record<string, unknown> }).payload,
      metadata: event.metadata,
    };

    await eventBridgePublisher.publish(domainEvent);
  }

  // =========================================================================
  // Contracts-Legal Integration
  // =========================================================================

  /**
   * Request a license agreement from Contracts-Legal.
   */
  async requestLicenseAgreement(
    params: LicenseAgreementRequested['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.LicenseAgreementRequested',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as LicenseAgreementRequested);

    return eventId;
  }

  /**
   * Request an IP assignment contract.
   */
  async requestAssignment(
    params: IPAssignmentRequested['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.AssignmentRequested',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as IPAssignmentRequested);

    return eventId;
  }

  /**
   * Request an NDA for trade secret disclosure.
   */
  async requestNDA(
    params: NDARequested['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.NDARequested',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as NDARequested);

    return eventId;
  }

  /**
   * Request a settlement agreement.
   */
  async requestSettlementAgreement(
    params: SettlementAgreementRequested['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.SettlementAgreementRequested',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as SettlementAgreementRequested);

    return eventId;
  }

  // =========================================================================
  // Accounting Integration
  // =========================================================================

  /**
   * Notify Accounting of completed valuation.
   */
  async notifyValuationCompleted(
    params: IPValuationCompleted['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.ValuationCompleted',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as IPValuationCompleted);

    return eventId;
  }

  /**
   * Notify Accounting of royalty revenue.
   */
  async notifyRoyaltyRevenue(
    params: RoyaltyRevenueRecognized['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.RoyaltyRevenueRecognized',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as RoyaltyRevenueRecognized);

    return eventId;
  }

  /**
   * Notify Accounting of IP expense.
   */
  async notifyExpense(
    params: IPExpenseIncurred['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.ExpenseIncurred',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as IPExpenseIncurred);

    return eventId;
  }

  /**
   * Notify Accounting of asset capitalization.
   */
  async notifyAssetCapitalized(
    params: IPAssetCapitalized['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.AssetCapitalized',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as IPAssetCapitalized);

    return eventId;
  }

  /**
   * Notify Accounting of asset impairment.
   */
  async notifyAssetImpaired(
    params: IPAssetImpaired['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.AssetImpaired',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as IPAssetImpaired);

    return eventId;
  }

  // =========================================================================
  // Compliance Integration
  // =========================================================================

  /**
   * Notify Compliance of new deadline.
   */
  async notifyDeadlineCreated(
    params: IPDeadlineCreated['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.DeadlineCreated',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as IPDeadlineCreated);

    return eventId;
  }

  /**
   * Notify Compliance of approaching deadline.
   */
  async notifyDeadlineApproaching(
    params: IPDeadlineApproaching['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.DeadlineApproaching',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as IPDeadlineApproaching);

    return eventId;
  }

  /**
   * Notify Compliance of missed deadline.
   */
  async notifyDeadlineMissed(
    params: IPDeadlineMissed['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.DeadlineMissed',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as IPDeadlineMissed);

    return eventId;
  }

  /**
   * Notify Compliance of required regulatory filing.
   */
  async notifyRegulatoryFiling(
    params: RegulatoryFilingRequired['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.RegulatoryFilingRequired',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as RegulatoryFilingRequired);

    return eventId;
  }

  // =========================================================================
  // Entity-Governance Integration
  // =========================================================================

  /**
   * Notify Entity-Governance of ownership change.
   */
  async notifyOwnershipChanged(
    params: IPOwnershipChanged['payload']
  ): Promise<string> {
    const eventId = crypto.randomUUID();

    await this.publish({
      eventId,
      eventType: 'IP.OwnershipChanged',
      source: 'intellectual-property',
      timestamp: new Date(),
      payload: params,
    } as IPOwnershipChanged);

    return eventId;
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Get target services for an event type.
   */
  getTargetServices(eventType: string): TargetService[] {
    return EVENT_ROUTING[eventType] ?? [];
  }

  /**
   * Check if event is routed to a specific service.
   */
  isRoutedTo(eventType: string, service: TargetService): boolean {
    return this.getTargetServices(eventType).includes(service);
  }
}

// Singleton instance
export const ecosystemIntegrationService = new EcosystemIntegrationService();
