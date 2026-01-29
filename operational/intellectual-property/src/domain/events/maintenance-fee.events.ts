/**
 * Maintenance Fee Domain Events
 * Pattern: trademark.events.ts
 */

import { BaseDomainEvent, type EventMetadata } from './domain-event.js';

export interface MaintenanceFeeCreatedPayload {
  patentId: string;
  feeNumber: number;
  dueDate: Date;
  gracePeriodEndsDate: Date;
}

export class MaintenanceFeeCreatedEvent extends BaseDomainEvent<MaintenanceFeeCreatedPayload> {
  constructor(aggregateId: string, payload: MaintenanceFeeCreatedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.maintenance_fee.created', aggregateId, 'MaintenanceFee', payload, metadata);
  }
}

export interface MaintenanceFeePaidPayload {
  patentId: string;
  feeNumber: number;
  paidDate: Date;
  paidAmount: number;
  entitySize: string;
  surchargeApplied: boolean;
}

export class MaintenanceFeePaidEvent extends BaseDomainEvent<MaintenanceFeePaidPayload> {
  constructor(aggregateId: string, payload: MaintenanceFeePaidPayload, metadata?: Partial<EventMetadata>) {
    super('ip.maintenance_fee.paid', aggregateId, 'MaintenanceFee', payload, metadata);
  }
}

export interface MaintenanceFeeMissedPayload {
  patentId: string;
  feeNumber: number;
  gracePeriodEndedAt: Date;
}

export class MaintenanceFeeMissedEvent extends BaseDomainEvent<MaintenanceFeeMissedPayload> {
  constructor(aggregateId: string, payload: MaintenanceFeeMissedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.maintenance_fee.missed', aggregateId, 'MaintenanceFee', payload, metadata);
  }
}

export interface MaintenanceFeeUpcomingPayload {
  patentId: string;
  feeNumber: number;
  dueDate: Date;
  daysUntilDue: number;
}

export class MaintenanceFeeUpcomingEvent extends BaseDomainEvent<MaintenanceFeeUpcomingPayload> {
  constructor(aggregateId: string, payload: MaintenanceFeeUpcomingPayload, metadata?: Partial<EventMetadata>) {
    super('ip.maintenance_fee.upcoming', aggregateId, 'MaintenanceFee', payload, metadata);
  }
}
