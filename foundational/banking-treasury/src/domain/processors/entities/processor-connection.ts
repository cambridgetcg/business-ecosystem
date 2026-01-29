/**
 * Processor Connection Entity
 *
 * Represents a connection to a payment processor (Stripe, Adyen, etc.)
 * Distinct from BankConnection - processors collect; banks hold.
 *
 * @module processors/entities
 */

import type { DomainEvent } from '../../events/domain-event.js';
import type {
  PaymentProcessorType,
  ProcessorConnectionStatus,
  ProcessorPaymentMethod,
  SettlementSchedule,
  ProcessorPricing,
} from '../types.js';

/**
 * Processor connection entity properties.
 */
export interface ProcessorConnectionProps {
  readonly id: string;
  readonly businessUnitId: string;
  readonly processorType: PaymentProcessorType;
  readonly processorAccountId: string;
  readonly mode: 'live' | 'test';
  readonly settlementAccountId: string;
  readonly settlementSchedule: SettlementSchedule;
  readonly enabledPaymentMethods: ProcessorPaymentMethod[];
  readonly enabledRegions: string[];
  readonly supportedCurrencies: string[];
  readonly pricing: ProcessorPricing;
  readonly status: ProcessorConnectionStatus;
  readonly webhookEndpoint?: string | undefined;
  readonly webhookSecret?: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Processor Connection Entity
 *
 * Tracks the connection to a payment processor and its configuration.
 */
export class ProcessorConnection {
  private readonly _id: string;
  private readonly _businessUnitId: string;
  private readonly _processorType: PaymentProcessorType;
  private readonly _processorAccountId: string;
  private readonly _mode: 'live' | 'test';
  private _settlementAccountId: string;
  private _settlementSchedule: SettlementSchedule;
  private _enabledPaymentMethods: ProcessorPaymentMethod[];
  private _enabledRegions: string[];
  private _supportedCurrencies: string[];
  private _pricing: ProcessorPricing;
  private _status: ProcessorConnectionStatus;
  private _webhookEndpoint?: string | undefined;
  private _webhookSecret?: string | undefined;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private readonly _domainEvents: DomainEvent[] = [];

  constructor(props: ProcessorConnectionProps) {
    this._id = props.id;
    this._businessUnitId = props.businessUnitId;
    this._processorType = props.processorType;
    this._processorAccountId = props.processorAccountId;
    this._mode = props.mode;
    this._settlementAccountId = props.settlementAccountId;
    this._settlementSchedule = props.settlementSchedule;
    this._enabledPaymentMethods = [...props.enabledPaymentMethods];
    this._enabledRegions = [...props.enabledRegions];
    this._supportedCurrencies = [...props.supportedCurrencies];
    this._pricing = props.pricing;
    this._status = props.status;
    this._webhookEndpoint = props.webhookEndpoint;
    this._webhookSecret = props.webhookSecret;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Update the settlement account for this processor.
   */
  updateSettlementAccount(accountId: string): void {
    const previousAccountId = this._settlementAccountId;
    this._settlementAccountId = accountId;
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'processor.settlement_account_changed',
      aggregateId: this._id,
      aggregateType: 'ProcessorConnection',
      payload: { previousAccountId, newAccountId: accountId },
      occurredAt: new Date(),
    });
  }

  /**
   * Update the settlement schedule.
   */
  updateSettlementSchedule(schedule: SettlementSchedule): void {
    this._settlementSchedule = schedule;
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'processor.settlement_schedule_changed',
      aggregateId: this._id,
      aggregateType: 'ProcessorConnection',
      payload: { scheduleType: schedule.scheduleType },
      occurredAt: new Date(),
    });
  }

  /**
   * Enable a payment method.
   */
  enablePaymentMethod(method: ProcessorPaymentMethod): void {
    const existing = this._enabledPaymentMethods.find(m => m.name === method.name);
    if (existing) {
      // Update existing
      this._enabledPaymentMethods = this._enabledPaymentMethods.map(m =>
        m.name === method.name ? { ...method, enabled: true } : m
      );
    } else {
      this._enabledPaymentMethods.push({ ...method, enabled: true });
    }

    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'processor.payment_method_enabled',
      aggregateId: this._id,
      aggregateType: 'ProcessorConnection',
      payload: { methodName: method.name },
      occurredAt: new Date(),
    });
  }

  /**
   * Disable a payment method.
   */
  disablePaymentMethod(methodName: string): void {
    this._enabledPaymentMethods = this._enabledPaymentMethods.map(m =>
      m.name === methodName ? { ...m, enabled: false } : m
    );

    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'processor.payment_method_disabled',
      aggregateId: this._id,
      aggregateType: 'ProcessorConnection',
      payload: { methodName },
      occurredAt: new Date(),
    });
  }

  /**
   * Add a region to enabled regions.
   */
  enableRegion(countryCode: string): void {
    if (!this._enabledRegions.includes(countryCode)) {
      this._enabledRegions.push(countryCode);
      this._updatedAt = new Date();
    }
  }

  /**
   * Remove a region from enabled regions.
   */
  disableRegion(countryCode: string): void {
    this._enabledRegions = this._enabledRegions.filter(r => r !== countryCode);
    this._updatedAt = new Date();
  }

  /**
   * Update pricing configuration.
   */
  updatePricing(pricing: ProcessorPricing): void {
    this._pricing = pricing;
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'processor.pricing_updated',
      aggregateId: this._id,
      aggregateType: 'ProcessorConnection',
      payload: { cardRate: pricing.cardRate },
      occurredAt: new Date(),
    });
  }

  /**
   * Configure webhook endpoint.
   */
  configureWebhook(endpoint: string, secret: string): void {
    this._webhookEndpoint = endpoint;
    this._webhookSecret = secret;
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'processor.webhook_configured',
      aggregateId: this._id,
      aggregateType: 'ProcessorConnection',
      payload: { endpoint },
      occurredAt: new Date(),
    });
  }

  /**
   * Activate the processor connection.
   */
  activate(): void {
    if (this._status === 'active') return;

    this._status = 'active';
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'processor.activated',
      aggregateId: this._id,
      aggregateType: 'ProcessorConnection',
      payload: {},
      occurredAt: new Date(),
    });
  }

  /**
   * Suspend the processor connection.
   */
  suspend(reason: string): void {
    if (this._status === 'suspended') return;

    this._status = 'suspended';
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'processor.suspended',
      aggregateId: this._id,
      aggregateType: 'ProcessorConnection',
      payload: { reason },
      occurredAt: new Date(),
    });
  }

  /**
   * Disconnect the processor connection.
   */
  disconnect(): void {
    this._status = 'disconnected';
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'processor.disconnected',
      aggregateId: this._id,
      aggregateType: 'ProcessorConnection',
      payload: {},
      occurredAt: new Date(),
    });
  }

  /**
   * Check if a payment method is enabled.
   */
  isPaymentMethodEnabled(methodName: string): boolean {
    const method = this._enabledPaymentMethods.find(m => m.name === methodName);
    return method?.enabled ?? false;
  }

  /**
   * Check if a region is enabled.
   */
  isRegionEnabled(countryCode: string): boolean {
    return this._enabledRegions.includes(countryCode);
  }

  /**
   * Get enabled payment methods.
   */
  getEnabledPaymentMethods(): ProcessorPaymentMethod[] {
    return this._enabledPaymentMethods.filter(m => m.enabled);
  }

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }

  // Getters
  get id(): string { return this._id; }
  get businessUnitId(): string { return this._businessUnitId; }
  get processorType(): PaymentProcessorType { return this._processorType; }
  get processorAccountId(): string { return this._processorAccountId; }
  get mode(): 'live' | 'test' { return this._mode; }
  get settlementAccountId(): string { return this._settlementAccountId; }
  get settlementSchedule(): SettlementSchedule { return this._settlementSchedule; }
  get enabledPaymentMethods(): readonly ProcessorPaymentMethod[] { return this._enabledPaymentMethods; }
  get enabledRegions(): readonly string[] { return this._enabledRegions; }
  get supportedCurrencies(): readonly string[] { return this._supportedCurrencies; }
  get pricing(): ProcessorPricing { return this._pricing; }
  get status(): ProcessorConnectionStatus { return this._status; }
  get webhookEndpoint(): string | undefined { return this._webhookEndpoint; }
  get webhookSecret(): string | undefined { return this._webhookSecret; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  toProps(): ProcessorConnectionProps {
    return {
      id: this._id,
      businessUnitId: this._businessUnitId,
      processorType: this._processorType,
      processorAccountId: this._processorAccountId,
      mode: this._mode,
      settlementAccountId: this._settlementAccountId,
      settlementSchedule: this._settlementSchedule,
      enabledPaymentMethods: [...this._enabledPaymentMethods],
      enabledRegions: [...this._enabledRegions],
      supportedCurrencies: [...this._supportedCurrencies],
      pricing: this._pricing,
      status: this._status,
      webhookEndpoint: this._webhookEndpoint,
      webhookSecret: this._webhookSecret,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
