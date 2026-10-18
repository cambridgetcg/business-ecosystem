/**
 * Incident Response Domain Models
 *
 * Models for security incident response, notification, and lessons learned.
 *
 * @module domain/incident-response/models/incident
 */

import { z } from 'zod';

// =============================================================================
// INCIDENT RESPONSE PLAN
// =============================================================================

export const IncidentSeveritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);

export const IncidentCategorySchema = z.enum([
  'data_breach',
  'malware',
  'phishing',
  'unauthorized_access',
  'denial_of_service',
  'insider_threat',
  'physical_security',
  'ransomware',
  'social_engineering',
  'vulnerability_exploitation',
  'policy_violation',
  'other',
]);

export const IncidentResponsePlanSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Plan identification
  name: z.string().min(1).max(200),
  version: z.string(),
  status: z.enum(['draft', 'active', 'under_review', 'archived']),

  // Scope
  incidentTypes: z.array(IncidentCategorySchema),
  applicableSystems: z.array(z.string()).optional(),
  applicableLocations: z.array(z.string()).optional(),

  // Response phases
  phases: z.array(z.object({
    name: z.string(),
    order: z.number().int(),
    description: z.string(),
    objectives: z.array(z.string()),
    activities: z.array(z.string()),
    responsibleRoles: z.array(z.string()),
    maxDuration: z.string().optional(), // ISO 8601 duration
    escalationTriggers: z.array(z.string()).optional(),
  })),

  // Team structure
  incidentCommander: z.object({
    primaryId: z.string().uuid(),
    primaryName: z.string(),
    backupId: z.string().uuid().optional(),
    backupName: z.string().optional(),
  }),
  responseTeam: z.array(z.object({
    role: z.string(),
    identityId: z.string().uuid().optional(),
    name: z.string(),
    contactInfo: z.string().optional(),
    responsibilities: z.array(z.string()),
  })),

  // Communication
  communicationPlan: z.object({
    internalContacts: z.array(z.object({
      role: z.string(),
      name: z.string(),
      contactInfo: z.string(),
      notificationPriority: z.number().int(),
    })),
    externalContacts: z.array(z.object({
      organization: z.string(),
      role: z.string(),
      name: z.string().optional(),
      contactInfo: z.string(),
      notificationThreshold: IncidentSeveritySchema,
    })),
    templates: z.array(z.object({
      name: z.string(),
      audience: z.string(),
      templateUrl: z.string().url().optional(),
    })).optional(),
  }),

  // Documentation
  documentUrl: z.string().url().optional(),
  playbooksUrl: z.string().url().optional(),

  // Testing
  lastTestedAt: z.date().optional(),
  nextTestDue: z.date().optional(),
  testFrequency: z.enum(['monthly', 'quarterly', 'semi_annually', 'annually']),

  // Approval
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.date().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type IncidentResponsePlan = z.infer<typeof IncidentResponsePlanSchema>;

// =============================================================================
// SECURITY INCIDENT
// =============================================================================

export const IncidentStatusSchema = z.enum([
  'reported',
  'triaged',
  'investigating',
  'containing',
  'eradicating',
  'recovering',
  'closed',
  'post_incident_review',
]);

export const SecurityIncidentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  incidentNumber: z.string(),

  // Classification
  category: IncidentCategorySchema,
  severity: IncidentSeveritySchema,
  status: IncidentStatusSchema,

  // Description
  title: z.string().min(1).max(500),
  description: z.string(),
  initialAssessment: z.string().optional(),

  // Detection
  detectedAt: z.date(),
  detectedBy: z.string(),
  detectionMethod: z.enum(['automated', 'user_report', 'audit', 'external_notification', 'other']),
  sourceSystem: z.string().optional(),
  sourceIP: z.string().optional(),

  // Impact
  impactAssessment: z.object({
    dataAffected: z.boolean().default(false),
    dataTypes: z.array(z.string()).optional(),
    recordsAffected: z.number().int().optional(),
    systemsAffected: z.array(z.string()).optional(),
    usersAffected: z.number().int().optional(),
    businessImpact: z.enum(['critical', 'high', 'medium', 'low', 'none']),
    financialImpact: z.number().optional(),
    reputationalImpact: z.enum(['severe', 'moderate', 'minor', 'none']),
  }).optional(),

  // Response
  responsePlanId: z.string().uuid().optional(),
  incidentCommanderId: z.string().uuid().optional(),
  incidentCommanderName: z.string().optional(),
  responseTeamIds: z.array(z.string().uuid()).optional(),

  // Timeline
  reportedAt: z.date(),
  triagedAt: z.date().optional(),
  containedAt: z.date().optional(),
  eradicatedAt: z.date().optional(),
  recoveredAt: z.date().optional(),
  closedAt: z.date().optional(),

  // Containment
  containmentActions: z.array(z.object({
    action: z.string(),
    performedBy: z.string(),
    performedAt: z.date(),
    result: z.string().optional(),
  })).optional(),

  // Root cause
  rootCause: z.string().optional(),
  attackVector: z.string().optional(),
  vulnerabilitiesExploited: z.array(z.string()).optional(),

  // Remediation
  remediationActions: z.array(z.object({
    action: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed']),
    assignedTo: z.string().optional(),
    dueDate: z.date().optional(),
    completedAt: z.date().optional(),
  })).optional(),

  // Evidence
  evidenceUrls: z.array(z.string().url()).optional(),
  forensicsReportUrl: z.string().url().optional(),

  // Notifications
  notificationsSent: z.array(z.object({
    recipient: z.string(),
    method: z.enum(['email', 'phone', 'sms', 'portal']),
    sentAt: z.date(),
    content: z.string().optional(),
  })).optional(),

  // Regulatory
  requiresNotification: z.boolean().default(false),
  regulatoryNotifications: z.array(z.object({
    regulator: z.string(),
    notifiedAt: z.date().optional(),
    dueDate: z.date(),
    referenceNumber: z.string().optional(),
  })).optional(),

  // Lessons learned
  lessonsLearnedId: z.string().uuid().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SecurityIncident = z.infer<typeof SecurityIncidentSchema>;

// =============================================================================
// INCIDENT NOTIFICATION
// =============================================================================

export const IncidentNotificationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  incidentId: z.string().uuid(),

  // Notification type
  type: z.enum([
    'initial_alert',
    'status_update',
    'escalation',
    'containment',
    'resolution',
    'regulatory',
    'customer',
    'media',
    'final_report',
  ]),

  // Recipients
  recipientType: z.enum(['internal', 'external', 'regulatory', 'customer', 'media']),
  recipients: z.array(z.object({
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    organization: z.string().optional(),
  })),

  // Content
  subject: z.string(),
  content: z.string(),
  attachmentUrls: z.array(z.string().url()).optional(),

  // Delivery
  channel: z.enum(['email', 'phone', 'sms', 'portal', 'mail', 'press_release']),
  status: z.enum(['draft', 'pending_approval', 'approved', 'sent', 'failed']),
  scheduledFor: z.date().optional(),
  sentAt: z.date().optional(),
  failureReason: z.string().optional(),

  // Approval
  requiresApproval: z.boolean().default(true),
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.date().optional(),

  // Tracking
  deliveryConfirmed: z.boolean().default(false),
  responseReceived: z.boolean().default(false),
  responseNotes: z.string().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type IncidentNotification = z.infer<typeof IncidentNotificationSchema>;

// =============================================================================
// LESSONS LEARNED
// =============================================================================

export const LessonsLearnedSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  incidentId: z.string().uuid(),

  // Review details
  reviewDate: z.date(),
  facilitatorId: z.string().uuid(),
  facilitatorName: z.string(),
  participants: z.array(z.object({
    identityId: z.string().uuid().optional(),
    name: z.string(),
    role: z.string(),
  })),

  // Timeline review
  timelineAccuracy: z.enum(['accurate', 'partially_accurate', 'inaccurate']),
  timelineNotes: z.string().optional(),

  // What went well
  positives: z.array(z.object({
    category: z.string(),
    description: z.string(),
    shouldContinue: z.boolean().default(true),
  })),

  // Areas for improvement
  improvements: z.array(z.object({
    category: z.string(),
    issue: z.string(),
    impact: z.string(),
    recommendation: z.string(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
  })),

  // Action items
  actionItems: z.array(z.object({
    id: z.string().uuid(),
    description: z.string(),
    category: z.enum(['process', 'technology', 'people', 'documentation', 'training']),
    assignedTo: z.string(),
    assignedToId: z.string().uuid().optional(),
    dueDate: z.date(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
    completedAt: z.date().optional(),
    notes: z.string().optional(),
  })),

  // Root cause analysis
  rootCauseAnalysis: z.object({
    method: z.enum(['five_whys', 'fishbone', 'fault_tree', 'other']),
    findings: z.string(),
    contributingFactors: z.array(z.string()),
    primaryRootCause: z.string(),
  }).optional(),

  // Metrics
  metrics: z.object({
    timeToDetect: z.number().optional(), // minutes
    timeToContain: z.number().optional(),
    timeToEradicate: z.number().optional(),
    timeToRecover: z.number().optional(),
    totalDowntime: z.number().optional(),
  }).optional(),

  // Documentation
  reportUrl: z.string().url().optional(),
  presentationUrl: z.string().url().optional(),

  // Status
  status: z.enum(['draft', 'under_review', 'approved', 'published']),
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.date().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type LessonsLearned = z.infer<typeof LessonsLearnedSchema>;

// =============================================================================
// DOMAIN FUNCTIONS
// =============================================================================

export function calculateIncidentResponseTime(incident: SecurityIncident): {
  detection: number | null;
  triage: number | null;
  containment: number | null;
  resolution: number | null;
} {
  const detectedMs = incident.detectedAt.getTime();

  return {
    detection: incident.reportedAt
      ? Math.round((incident.reportedAt.getTime() - detectedMs) / 60000)
      : null,
    triage: incident.triagedAt
      ? Math.round((incident.triagedAt.getTime() - detectedMs) / 60000)
      : null,
    containment: incident.containedAt
      ? Math.round((incident.containedAt.getTime() - detectedMs) / 60000)
      : null,
    resolution: incident.closedAt
      ? Math.round((incident.closedAt.getTime() - detectedMs) / 60000)
      : null,
  };
}

export function isIncidentActive(incident: SecurityIncident): boolean {
  return !['closed', 'post_incident_review'].includes(incident.status);
}

export function requiresRegulatoryNotification(incident: SecurityIncident): boolean {
  if (incident.severity === 'critical') return true;
  if (incident.impactAssessment?.dataAffected && incident.impactAssessment?.recordsAffected && incident.impactAssessment.recordsAffected > 0) {
    return true;
  }
  return false;
}

export function getEscalationLevel(incident: SecurityIncident): 'executive' | 'management' | 'team' | 'standard' {
  if (incident.severity === 'critical' || incident.impactAssessment?.businessImpact === 'critical') {
    return 'executive';
  }
  if (incident.severity === 'high' || incident.impactAssessment?.businessImpact === 'high') {
    return 'management';
  }
  if (incident.severity === 'medium') {
    return 'team';
  }
  return 'standard';
}
