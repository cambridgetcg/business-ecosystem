/**
 * Security Incident Domain Model
 *
 * Tracks security incidents, investigations, and resolutions.
 */

import { z } from 'zod';
import {
  IncidentSeveritySchema,
  IncidentStatusSchema,
  SecurityEventTypeSchema,
} from '../../value-objects/index.js';

// =============================================================================
// Incident Timeline Entry
// =============================================================================

export const IncidentTimelineEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.date(),
  action: z.string(),
  description: z.string(),
  performedBy: z.string().uuid().nullable(),
  performedByName: z.string().nullable(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    type: z.string(),
  })).nullable(),
  metadata: z.record(z.unknown()).nullable(),
});

export type IncidentTimelineEntry = z.infer<typeof IncidentTimelineEntrySchema>;

// =============================================================================
// Affected Resource
// =============================================================================

export const AffectedResourceSchema = z.object({
  resourceType: z.string(),
  resourceId: z.string(),
  resourceName: z.string().nullable(),
  impactLevel: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  description: z.string().nullable(),
});

export type AffectedResource = z.infer<typeof AffectedResourceSchema>;

// =============================================================================
// Security Incident Schema
// =============================================================================

export const SecurityIncidentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  incidentNumber: z.string(),

  // Classification
  title: z.string().min(1).max(255),
  description: z.string().max(5000),
  severity: IncidentSeveritySchema,
  status: IncidentStatusSchema,
  category: z.enum([
    'unauthorized_access',
    'data_breach',
    'malware',
    'phishing',
    'insider_threat',
    'denial_of_service',
    'social_engineering',
    'physical_security',
    'policy_violation',
    'other',
  ]),

  // Detection
  detectedAt: z.date(),
  detectedBy: z.enum(['automated', 'user_report', 'audit', 'third_party', 'internal_review']),
  detectionSource: z.string().nullable(),
  triggeringEvents: z.array(SecurityEventTypeSchema).nullable(),
  relatedAuditLogIds: z.array(z.string().uuid()).nullable(),

  // Impact assessment
  affectedResources: z.array(AffectedResourceSchema).nullable(),
  affectedUserCount: z.number().int().nullable(),
  dataCompromised: z.boolean().default(false),
  dataCompromisedDescription: z.string().nullable(),
  financialImpact: z.number().nullable(),
  reputationalImpact: z.enum(['none', 'low', 'medium', 'high', 'critical']).nullable(),

  // Response
  assignedTo: z.string().uuid().nullable(),
  assignedToName: z.string().nullable(),
  responseTeam: z.array(z.string().uuid()).nullable(),
  containmentActions: z.string().nullable(),
  eradicationActions: z.string().nullable(),
  recoveryActions: z.string().nullable(),

  // Timeline
  timeline: z.array(IncidentTimelineEntrySchema).nullable(),
  containedAt: z.date().nullable(),
  resolvedAt: z.date().nullable(),
  closedAt: z.date().nullable(),

  // Root cause
  rootCause: z.string().nullable(),
  rootCauseCategory: z.enum([
    'human_error',
    'system_vulnerability',
    'configuration_error',
    'malicious_actor',
    'third_party_failure',
    'process_failure',
    'unknown',
  ]).nullable(),

  // Lessons learned
  lessonsLearned: z.string().nullable(),
  preventativeMeasures: z.array(z.string()).nullable(),

  // Reporting
  requiresRegulatorNotification: z.boolean().default(false),
  regulatorNotifiedAt: z.date().nullable(),
  regulatorReference: z.string().nullable(),
  requiresCustomerNotification: z.boolean().default(false),
  customersNotifiedAt: z.date().nullable(),

  // External references
  externalTicketId: z.string().nullable(),
  externalTicketUrl: z.string().nullable(),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  tags: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int().positive(),
});

export type SecurityIncident = z.infer<typeof SecurityIncidentSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateIncidentInputSchema = z.object({
  tenantId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(5000),
  severity: IncidentSeveritySchema,
  category: z.enum([
    'unauthorized_access',
    'data_breach',
    'malware',
    'phishing',
    'insider_threat',
    'denial_of_service',
    'social_engineering',
    'physical_security',
    'policy_violation',
    'other',
  ]),
  detectedBy: z.enum(['automated', 'user_report', 'audit', 'third_party', 'internal_review']),
  detectionSource: z.string().optional(),
  triggeringEvents: z.array(SecurityEventTypeSchema).optional(),
  relatedAuditLogIds: z.array(z.string().uuid()).optional(),
  affectedResources: z.array(AffectedResourceSchema).optional(),
  assignedTo: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateIncidentInput = z.infer<typeof CreateIncidentInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Generate incident number
 */
export function generateIncidentNumber(tenantId: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INC-${year}${month}-${random}`;
}

/**
 * Check if incident requires escalation
 */
export function requiresEscalation(incident: SecurityIncident): boolean {
  if (incident.severity === 'critical') return true;
  if (incident.dataCompromised) return true;
  if (incident.affectedUserCount && incident.affectedUserCount > 100) return true;
  return false;
}

/**
 * Check if incident is open
 */
export function isIncidentOpen(incident: SecurityIncident): boolean {
  return incident.status !== 'closed' && incident.status !== 'false_positive';
}

/**
 * Get SLA deadline based on severity
 */
export function getSLADeadline(severity: z.infer<typeof IncidentSeveritySchema>, detectedAt: Date): Date {
  const deadlines: Record<z.infer<typeof IncidentSeveritySchema>, number> = {
    critical: 1,     // 1 hour
    high: 4,         // 4 hours
    medium: 24,      // 24 hours
    low: 72,         // 72 hours
    info: 168,       // 1 week
  };

  const hoursToAdd = deadlines[severity];
  return new Date(detectedAt.getTime() + hoursToAdd * 60 * 60 * 1000);
}

/**
 * Check if SLA is breached
 */
export function isSLABreached(incident: SecurityIncident): boolean {
  if (incident.status === 'closed' || incident.status === 'resolved' || incident.status === 'false_positive') {
    return false;
  }

  const deadline = getSLADeadline(incident.severity, incident.detectedAt);
  return new Date() > deadline;
}

/**
 * Calculate time to containment in hours
 */
export function getTimeToContainment(incident: SecurityIncident): number | null {
  if (!incident.containedAt) return null;
  return (incident.containedAt.getTime() - incident.detectedAt.getTime()) / (1000 * 60 * 60);
}

/**
 * Calculate time to resolution in hours
 */
export function getTimeToResolution(incident: SecurityIncident): number | null {
  if (!incident.resolvedAt) return null;
  return (incident.resolvedAt.getTime() - incident.detectedAt.getTime()) / (1000 * 60 * 60);
}

/**
 * Check if GDPR breach notification required (72 hours)
 */
export function requiresGDPRNotification(incident: SecurityIncident): boolean {
  if (!incident.dataCompromised) return false;
  // Any personal data breach requires notification within 72 hours
  return true;
}

/**
 * Get GDPR notification deadline
 */
export function getGDPRNotificationDeadline(incident: SecurityIncident): Date | null {
  if (!requiresGDPRNotification(incident)) return null;
  return new Date(incident.detectedAt.getTime() + 72 * 60 * 60 * 1000);
}

/**
 * Get status label
 */
export function getIncidentStatusLabel(status: z.infer<typeof IncidentStatusSchema>): string {
  const labels: Record<z.infer<typeof IncidentStatusSchema>, string> = {
    open: 'Open',
    investigating: 'Investigating',
    contained: 'Contained',
    resolved: 'Resolved',
    closed: 'Closed',
    false_positive: 'False Positive',
  };
  return labels[status];
}

/**
 * Get severity color
 */
export function getIncidentSeverityColor(severity: z.infer<typeof IncidentSeveritySchema>): string {
  const colors: Record<z.infer<typeof IncidentSeveritySchema>, string> = {
    critical: '#DC2626',
    high: '#EA580C',
    medium: '#CA8A04',
    low: '#2563EB',
    info: '#6B7280',
  };
  return colors[severity];
}
