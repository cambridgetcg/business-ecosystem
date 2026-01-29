/**
 * License Domain Events
 */

import { BaseDomainEvent, type EventMetadata } from './domain-event.js';

export interface LicenseGrantedPayload {
  licenseNumber: string;
  ipType: string;
  ipAssetId: string;
  licenseType: string;
  licensorId: string;
  licenseeId: string;
  effectiveDate: Date;
}

export class LicenseGrantedEvent extends BaseDomainEvent<LicenseGrantedPayload> {
  constructor(aggregateId: string, payload: LicenseGrantedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.license.granted', aggregateId, 'License', payload, metadata);
  }
}

export interface LicenseTerminatedPayload {
  licenseNumber: string;
  previousStatus: string;
  terminationDate: Date;
  reason: string;
}

export class LicenseTerminatedEvent extends BaseDomainEvent<LicenseTerminatedPayload> {
  constructor(aggregateId: string, payload: LicenseTerminatedPayload, metadata?: Partial<EventMetadata>) {
    super('ip.license.terminated', aggregateId, 'License', payload, metadata);
  }
}
