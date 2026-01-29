/**
 * @ecosystem/events-operational
 * Cross-operational domain events for coordinating activities across operational domains
 */

import { z } from 'zod';

// ============================================================================
// Base Event Schema (consistent with other event packages)
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
// Operational Domain Type
// ============================================================================

export const operationalDomainSchema = z.enum([
  'contracts-legal',
  'insurance',
  'intellectual-property',
  'data-privacy',
]);

export type OperationalDomain = z.infer<typeof operationalDomainSchema>;

// ============================================================================
// Entity Onboarding Events
// ============================================================================

export const entityOnboardedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('operational.entity_onboarded'),
  aggregateType: z.literal('OperationalOrchestration'),
  payload: z.object({
    entityId: z.string().uuid(),
    entityName: z.string(),
    completedSteps: z.array(z.string()),
    skippedSteps: z.array(z.string()),
    failedSteps: z.array(z.string()),
    domains: z.array(operationalDomainSchema),
  }),
});

export type EntityOnboardedEvent = z.infer<typeof entityOnboardedEventSchema>;

// ============================================================================
// Compliance Status Events
// ============================================================================

export const complianceStatusSchema = z.enum([
  'compliant',
  'non-compliant',
  'pending',
  'not-applicable',
]);

export type ComplianceStatus = z.infer<typeof complianceStatusSchema>;

export const complianceStatusChangedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('operational.compliance_status_changed'),
  aggregateType: z.literal('OperationalCompliance'),
  payload: z.object({
    entityId: z.string().uuid(),
    domain: operationalDomainSchema,
    regulation: z.string(),
    previousStatus: complianceStatusSchema,
    newStatus: complianceStatusSchema,
    findings: z.array(z.object({
      id: z.string().uuid(),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      description: z.string(),
    })),
  }),
});

export type ComplianceStatusChangedEvent = z.infer<typeof complianceStatusChangedEventSchema>;

// ============================================================================
// Document Lifecycle Events
// ============================================================================

export const documentStatusSchema = z.enum([
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'active',
  'expired',
  'terminated',
]);

export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const documentLifecycleEventSchema = baseDomainEventSchema.extend({
  type: z.literal('operational.document_lifecycle'),
  aggregateType: z.literal('OperationalDocument'),
  payload: z.object({
    documentId: z.string().uuid(),
    entityId: z.string().uuid(),
    domain: operationalDomainSchema,
    documentType: z.string(),
    title: z.string(),
    previousStatus: documentStatusSchema.optional(),
    newStatus: documentStatusSchema,
    effectiveDate: z.coerce.date().optional(),
    expirationDate: z.coerce.date().optional(),
  }),
});

export type DocumentLifecycleEvent = z.infer<typeof documentLifecycleEventSchema>;

// ============================================================================
// Document Action Required Events
// ============================================================================

export const documentRequiresActionEventSchema = baseDomainEventSchema.extend({
  type: z.literal('operational.document_requires_action'),
  aggregateType: z.literal('OperationalDocument'),
  payload: z.object({
    documentId: z.string().uuid(),
    entityId: z.string().uuid(),
    domain: operationalDomainSchema,
    documentType: z.string(),
    title: z.string(),
    actionRequired: z.enum(['review', 'sign', 'approve', 'renew']),
    dueDate: z.coerce.date().optional(),
    assignedTo: z.array(z.string().uuid()).optional(),
  }),
});

export type DocumentRequiresActionEvent = z.infer<typeof documentRequiresActionEventSchema>;

// ============================================================================
// Expiration Events
// ============================================================================

export const expirationWindowSchema = z.enum(['critical', 'warning', 'notice']);

export type ExpirationWindow = z.infer<typeof expirationWindowSchema>;

export const itemExpiringEventSchema = baseDomainEventSchema.extend({
  type: z.literal('operational.item_expiring'),
  aggregateType: z.literal('OperationalExpiration'),
  payload: z.object({
    itemId: z.string().uuid(),
    entityId: z.string().uuid(),
    domain: operationalDomainSchema,
    itemType: z.string(),
    description: z.string(),
    expirationDate: z.coerce.date(),
    daysUntilExpiration: z.number().int(),
    window: expirationWindowSchema,
    autoRenew: z.boolean(),
  }),
});

export type ItemExpiringEvent = z.infer<typeof itemExpiringEventSchema>;

// ============================================================================
// Daily Summary Event
// ============================================================================

export const dailySummaryEventSchema = baseDomainEventSchema.extend({
  type: z.literal('operational.daily_summary'),
  aggregateType: z.literal('OperationalSummary'),
  payload: z.object({
    entityId: z.string().uuid(),
    date: z.coerce.date(),
    summary: z.object({
      contracts: z.object({
        active: z.number().int(),
        pending: z.number().int(),
        expiringSoon: z.number().int(),
      }),
      insurance: z.object({
        active: z.number().int(),
        pending: z.number().int(),
        expiringSoon: z.number().int(),
      }),
      intellectualProperty: z.object({
        active: z.number().int(),
        pending: z.number().int(),
        expiringSoon: z.number().int(),
      }),
      dataPrivacy: z.object({
        compliant: z.boolean(),
        pendingAssessments: z.number().int(),
        openFindings: z.number().int(),
      }),
    }),
    complianceStatus: complianceStatusSchema,
    pendingActions: z.number().int(),
  }),
});

export type DailySummaryEvent = z.infer<typeof dailySummaryEventSchema>;

// ============================================================================
// Event Union
// ============================================================================

export const operationalEventSchema = z.discriminatedUnion('type', [
  entityOnboardedEventSchema,
  complianceStatusChangedEventSchema,
  documentLifecycleEventSchema,
  documentRequiresActionEventSchema,
  itemExpiringEventSchema,
  dailySummaryEventSchema,
]);

export type OperationalEvent = z.infer<typeof operationalEventSchema>;

export const OPERATIONAL_EVENT_TYPES = [
  'operational.entity_onboarded',
  'operational.compliance_status_changed',
  'operational.document_lifecycle',
  'operational.document_requires_action',
  'operational.item_expiring',
  'operational.daily_summary',
] as const;

export type OperationalEventType = typeof OPERATIONAL_EVENT_TYPES[number];
