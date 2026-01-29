/**
 * Domain Name Domain Events
 * Pattern: trademark.events.ts
 */

import { BaseDomainEvent, type EventMetadata } from './domain-event.js';

export interface DomainNameRegisteredPayload {
  domainName: string;
  tld: string;
  registrantId: string;
  registrarName: string;
  expirationDate: Date;
  purpose: string;
}

export class DomainNameRegisteredEvent extends BaseDomainEvent<DomainNameRegisteredPayload> {
  constructor(aggregateId: string, payload: DomainNameRegisteredPayload, metadata?: Partial<EventMetadata>) {
    super('ip.domain_name.registered', aggregateId, 'DomainName', payload, metadata);
  }
}

export interface DomainNameRenewedPayload {
  domainName: string;
  previousExpiration: Date;
  newExpiration: Date;
}

export class DomainNameRenewedEvent extends BaseDomainEvent<DomainNameRenewedPayload> {
  constructor(aggregateId: string, payload: DomainNameRenewedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.domain_name.renewed', aggregateId, 'DomainName', payload, metadata);
  }
}

export interface DomainNameTransferInitiatedPayload {
  domainName: string;
  fromRegistrar: string;
  toRegistrar: string;
}

export class DomainNameTransferInitiatedEvent extends BaseDomainEvent<DomainNameTransferInitiatedPayload> {
  constructor(aggregateId: string, payload: DomainNameTransferInitiatedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.domain_name.transfer_initiated', aggregateId, 'DomainName', payload, metadata);
  }
}

export interface DomainNameLinkedToTrademarkPayload {
  domainName: string;
  trademarkId: string;
}

export class DomainNameLinkedToTrademarkEvent extends BaseDomainEvent<DomainNameLinkedToTrademarkPayload> {
  constructor(aggregateId: string, payload: DomainNameLinkedToTrademarkPayload, metadata?: Partial<EventMetadata>) {
    super('ip.domain_name.linked_to_trademark', aggregateId, 'DomainName', payload, metadata);
  }
}

export interface DomainNameExpiredPayload {
  domainName: string;
  expirationDate: Date;
}

export class DomainNameExpiredEvent extends BaseDomainEvent<DomainNameExpiredPayload> {
  constructor(aggregateId: string, payload: DomainNameExpiredPayload, metadata?: Partial<EventMetadata>) {
    super('ip.domain_name.expired', aggregateId, 'DomainName', payload, metadata);
  }
}

// Domain Dispute Events

export interface DomainDisputeFiledPayload {
  domainNameId: string;
  domainName: string;
  mechanism: string;
  complainantName: string;
  caseNumber?: string | undefined;
}

export class DomainDisputeFiledEvent extends BaseDomainEvent<DomainDisputeFiledPayload> {
  constructor(aggregateId: string, payload: DomainDisputeFiledPayload, metadata?: Partial<EventMetadata>) {
    super('ip.domain_dispute.filed', aggregateId, 'DomainDispute', payload, metadata);
  }
}

export interface DomainDisputeDecidedPayload {
  domainNameId: string;
  domainName: string;
  outcome: string;
  decisionDate: Date;
}

export class DomainDisputeDecidedEvent extends BaseDomainEvent<DomainDisputeDecidedPayload> {
  constructor(aggregateId: string, payload: DomainDisputeDecidedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.domain_dispute.decided', aggregateId, 'DomainDispute', payload, metadata);
  }
}
