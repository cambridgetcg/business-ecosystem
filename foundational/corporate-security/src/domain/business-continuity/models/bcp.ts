/**
 * Business Continuity Domain Models
 *
 * Models for business continuity planning, crisis management, and disaster recovery.
 *
 * @module domain/business-continuity/models/bcp
 */

import { z } from 'zod';

// =============================================================================
// BUSINESS CONTINUITY PLAN
// =============================================================================

export const BCPStatusSchema = z.enum([
  'draft',
  'under_review',
  'approved',
  'active',
  'expired',
  'superseded',
]);

export const BCPTypeSchema = z.enum([
  'enterprise',
  'business_unit',
  'department',
  'system',
  'facility',
  'vendor',
]);

export const BusinessContinuityPlanSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid().optional(),

  // Plan identification
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20),
  type: BCPTypeSchema,
  status: BCPStatusSchema,
  version: z.string(),

  // Scope
  description: z.string(),
  scope: z.string(),
  assumptions: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),

  // Ownership
  ownerId: z.string().uuid(),
  ownerName: z.string(),
  departmentId: z.string().uuid().optional(),
  reviewers: z.array(z.string().uuid()).optional(),
  approvers: z.array(z.string().uuid()).optional(),

  // Recovery objectives
  rto: z.number().int().min(0), // Recovery Time Objective (hours)
  rpo: z.number().int().min(0), // Recovery Point Objective (hours)
  mtpd: z.number().int().min(0), // Maximum Tolerable Period of Disruption (hours)

  // Critical functions
  criticalFunctions: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    rto: z.number().int(),
    minimumStaff: z.number().int().optional(),
    dependencies: z.array(z.string()).optional(),
    recoveryProcedure: z.string().optional(),
  })),

  // Resources
  criticalResources: z.array(z.object({
    type: z.enum(['system', 'equipment', 'facility', 'personnel', 'vendor', 'data']),
    name: z.string(),
    description: z.string().optional(),
    alternativeSource: z.string().optional(),
  })).optional(),

  // Contact information
  emergencyContacts: z.array(z.object({
    role: z.string(),
    name: z.string(),
    phone: z.string(),
    alternatePhone: z.string().optional(),
    email: z.string().email().optional(),
  })),

  // Alternate sites
  alternateSites: z.array(z.object({
    name: z.string(),
    type: z.enum(['hot', 'warm', 'cold', 'mobile', 'reciprocal']),
    address: z.string(),
    capacity: z.number().int().optional(),
    activationTime: z.number().int(), // hours
    contactInfo: z.string().optional(),
  })).optional(),

  // Documents
  documentUrl: z.string().url().optional(),
  proceduresUrl: z.string().url().optional(),
  checklistUrl: z.string().url().optional(),

  // Lifecycle
  effectiveDate: z.date(),
  expirationDate: z.date(),
  lastReviewDate: z.date().optional(),
  nextReviewDate: z.date(),
  lastTestDate: z.date().optional(),
  nextTestDate: z.date().optional(),

  // Approval
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.date().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type BusinessContinuityPlan = z.infer<typeof BusinessContinuityPlanSchema>;

// =============================================================================
// CRISIS
// =============================================================================

export const CrisisSeveritySchema = z.enum([
  'level_1', // Minor - localized impact
  'level_2', // Moderate - department impact
  'level_3', // Major - business unit impact
  'level_4', // Severe - enterprise impact
  'level_5', // Critical - existential threat
]);

export const CrisisStatusSchema = z.enum([
  'declared',
  'active',
  'contained',
  'recovering',
  'resolved',
  'post_incident_review',
  'closed',
]);

export const CrisisTypeSchema = z.enum([
  'natural_disaster',
  'cyber_attack',
  'data_breach',
  'system_outage',
  'supply_chain',
  'workplace_violence',
  'pandemic',
  'financial',
  'reputational',
  'regulatory',
  'other',
]);

export const CrisisSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Crisis identification
  name: z.string().min(1).max(200),
  type: CrisisTypeSchema,
  severity: CrisisSeveritySchema,
  status: CrisisStatusSchema,

  // Description
  description: z.string(),
  triggerEvent: z.string(),
  impactSummary: z.string().optional(),

  // Affected areas
  affectedFacilities: z.array(z.string().uuid()).optional(),
  affectedSystems: z.array(z.string()).optional(),
  affectedBusinessUnits: z.array(z.string()).optional(),
  estimatedAffectedEmployees: z.number().int().optional(),
  estimatedAffectedCustomers: z.number().int().optional(),

  // Timeline
  detectedAt: z.date(),
  declaredAt: z.date(),
  containedAt: z.date().optional(),
  resolvedAt: z.date().optional(),
  closedAt: z.date().optional(),

  // Response team
  incidentCommanderId: z.string().uuid(),
  incidentCommanderName: z.string(),
  responseTeam: z.array(z.object({
    identityId: z.string().uuid(),
    name: z.string(),
    role: z.string(),
    contactPhone: z.string().optional(),
  })),

  // BCP activation
  bcpActivated: z.boolean().default(false),
  activatedBcpIds: z.array(z.string().uuid()).optional(),
  alternateSiteActivated: z.boolean().default(false),

  // Impact assessment
  financialImpact: z.number().optional(),
  operationalImpact: z.string().optional(),
  reputationalImpact: z.string().optional(),
  regulatoryImpact: z.string().optional(),

  // External notifications
  regulatorsNotified: z.boolean().default(false),
  regulatorNotificationDate: z.date().optional(),
  customersNotified: z.boolean().default(false),
  customerNotificationDate: z.date().optional(),
  mediaStatementIssued: z.boolean().default(false),

  // Lessons learned
  lessonsLearned: z.string().optional(),
  improvementActions: z.array(z.object({
    action: z.string(),
    assignedTo: z.string().uuid(),
    dueDate: z.date(),
    status: z.enum(['pending', 'in_progress', 'completed']),
  })).optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Crisis = z.infer<typeof CrisisSchema>;

// =============================================================================
// BCP TEST
// =============================================================================

export const BCPTestTypeSchema = z.enum([
  'tabletop',
  'walkthrough',
  'simulation',
  'parallel',
  'full_interruption',
]);

export const BCPTestSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  bcpId: z.string().uuid(),

  // Test details
  name: z.string().min(1).max(200),
  type: BCPTestTypeSchema,
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']),

  // Scope
  description: z.string(),
  objectives: z.array(z.string()),
  scenario: z.string(),
  functionsIncluded: z.array(z.string()),

  // Schedule
  scheduledDate: z.date(),
  actualStartDate: z.date().optional(),
  actualEndDate: z.date().optional(),
  duration: z.number().int().optional(), // minutes

  // Participants
  coordinatorId: z.string().uuid(),
  participants: z.array(z.object({
    identityId: z.string().uuid(),
    name: z.string(),
    role: z.string(),
    attendance: z.enum(['confirmed', 'attended', 'absent']).optional(),
  })),

  // Results
  rtoAchieved: z.number().int().optional(),
  rpoAchieved: z.number().int().optional(),
  objectivesMet: z.number().int().optional(),
  objectivesTotal: z.number().int().optional(),

  // Findings
  findings: z.array(z.object({
    category: z.enum(['process', 'technology', 'people', 'documentation', 'communication']),
    description: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    recommendation: z.string().optional(),
  })).optional(),

  // Improvement actions
  improvementActions: z.array(z.object({
    action: z.string(),
    assignedTo: z.string().uuid(),
    dueDate: z.date(),
    status: z.enum(['pending', 'in_progress', 'completed']),
  })).optional(),

  // Documentation
  testPlanUrl: z.string().url().optional(),
  resultsReportUrl: z.string().url().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type BCPTest = z.infer<typeof BCPTestSchema>;

// =============================================================================
// DOMAIN FUNCTIONS
// =============================================================================

export function isBCPActive(bcp: BusinessContinuityPlan): boolean {
  if (bcp.status !== 'active') return false;
  const now = new Date();
  if (bcp.expirationDate < now) return false;
  return true;
}

export function isBCPDueForReview(bcp: BusinessContinuityPlan, daysThreshold: number = 30): boolean {
  if (!bcp.nextReviewDate) return false;
  const now = new Date();
  const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
  return bcp.nextReviewDate <= threshold;
}

export function isBCPDueForTest(bcp: BusinessContinuityPlan, daysThreshold: number = 30): boolean {
  if (!bcp.nextTestDate) return false;
  const now = new Date();
  const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
  return bcp.nextTestDate <= threshold;
}

export function getCrisisSeverityLevel(severity: z.infer<typeof CrisisSeveritySchema>): number {
  const levels: Record<string, number> = {
    level_1: 1,
    level_2: 2,
    level_3: 3,
    level_4: 4,
    level_5: 5,
  };
  return levels[severity] ?? 0;
}
