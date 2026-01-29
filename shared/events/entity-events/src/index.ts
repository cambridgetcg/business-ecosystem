/**
 * @ecosystem/events-entity
 * Entity-related domain events
 */

import { z } from 'zod';

// ============================================================================
// Base Event Schema
// ============================================================================

export const eventMetadataSchema = z.object({
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  source: z.string(),
  timestamp: z.coerce.date(),
});

export type EventMetadata = z.infer<typeof eventMetadataSchema>;

export const baseDomainEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  aggregateId: z.string().uuid(),
  aggregateType: z.string(),
  version: z.number().int().positive(),
  occurredAt: z.coerce.date(),
  metadata: eventMetadataSchema,
});

// ============================================================================
// Entity Events
// ============================================================================

export const entityCreatedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('entity.created'),
  aggregateType: z.literal('LegalEntity'),
  payload: z.object({
    name: z.string(),
    type: z.string(),
    jurisdictionCountry: z.string(),
    taxId: z.string().optional(),
  }),
});

export type EntityCreatedEvent = z.infer<typeof entityCreatedEventSchema>;

export const entityUpdatedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('entity.updated'),
  aggregateType: z.literal('LegalEntity'),
  payload: z.object({
    changes: z.record(z.object({
      old: z.unknown(),
      new: z.unknown(),
    })),
  }),
});

export type EntityUpdatedEvent = z.infer<typeof entityUpdatedEventSchema>;

export const entityDissolvedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('entity.dissolved'),
  aggregateType: z.literal('LegalEntity'),
  payload: z.object({
    dissolutionDate: z.coerce.date(),
    reason: z.string().optional(),
  }),
});

export type EntityDissolvedEvent = z.infer<typeof entityDissolvedEventSchema>;

// ============================================================================
// Officer Events
// ============================================================================

export const officerAppointedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('officer.appointed'),
  aggregateType: z.literal('LegalEntity'),
  payload: z.object({
    officerId: z.string().uuid(),
    role: z.string(),
    personId: z.string().uuid().optional(),
    appointedDate: z.coerce.date(),
  }),
});

export type OfficerAppointedEvent = z.infer<typeof officerAppointedEventSchema>;

export const officerResignedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('officer.resigned'),
  aggregateType: z.literal('LegalEntity'),
  payload: z.object({
    officerId: z.string().uuid(),
    role: z.string(),
    resignedDate: z.coerce.date(),
  }),
});

export type OfficerResignedEvent = z.infer<typeof officerResignedEventSchema>;

// ============================================================================
// Ownership Events
// ============================================================================

export const ownershipTransferredEventSchema = baseDomainEventSchema.extend({
  type: z.literal('ownership.transferred'),
  aggregateType: z.literal('LegalEntity'),
  payload: z.object({
    fromOwnerId: z.string().uuid(),
    toOwnerId: z.string().uuid(),
    percentage: z.number(),
    transferDate: z.coerce.date(),
  }),
});

export type OwnershipTransferredEvent = z.infer<typeof ownershipTransferredEventSchema>;

// ============================================================================
// Event Union
// ============================================================================

export const entityEventSchema = z.discriminatedUnion('type', [
  entityCreatedEventSchema,
  entityUpdatedEventSchema,
  entityDissolvedEventSchema,
  officerAppointedEventSchema,
  officerResignedEventSchema,
  ownershipTransferredEventSchema,
]);

export type EntityEvent = z.infer<typeof entityEventSchema>;

export const ENTITY_EVENT_TYPES = [
  'entity.created',
  'entity.updated',
  'entity.dissolved',
  'officer.appointed',
  'officer.resigned',
  'ownership.transferred',
] as const;
