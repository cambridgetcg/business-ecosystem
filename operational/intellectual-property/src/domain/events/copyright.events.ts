/**
 * Copyright Domain Events
 */

import { BaseDomainEvent, type EventMetadata } from './domain-event.js';

export interface CopyrightRegisteredPayload {
  registrationNumber: string;
  title: string;
  workType: string;
  registrationDate: Date;
  authors: string[];
}

export class CopyrightRegisteredEvent extends BaseDomainEvent<CopyrightRegisteredPayload> {
  constructor(aggregateId: string, payload: CopyrightRegisteredPayload, metadata?: Partial<EventMetadata>) {
    super('ip.copyright.registered', aggregateId, 'Copyright', payload, metadata);
  }
}
