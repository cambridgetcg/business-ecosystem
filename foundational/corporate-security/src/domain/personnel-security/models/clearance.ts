/**
 * Personnel Security Domain Models
 *
 * Models for background checks, security clearances, and personnel vetting.
 *
 * @module domain/personnel-security/models/clearance
 */

import { z } from 'zod';

// =============================================================================
// BACKGROUND CHECK
// =============================================================================

export const BackgroundCheckTypeSchema = z.enum([
  'pre_employment',
  'periodic',
  'promotion',
  'incident_triggered',
  'contractor',
  'volunteer',
]);

export const BackgroundCheckStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'expired',
  'cancelled',
]);

export const BackgroundCheckResultSchema = z.enum([
  'clear',
  'adverse_info',
  'disqualifying',
  'incomplete',
  'pending_adjudication',
]);

export const BackgroundCheckSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  identityId: z.string().uuid(),

  // Check details
  checkType: BackgroundCheckTypeSchema,
  status: BackgroundCheckStatusSchema,
  result: BackgroundCheckResultSchema.optional(),

  // Scope
  scope: z.object({
    criminalHistory: z.boolean().default(true),
    creditHistory: z.boolean().default(false),
    employmentVerification: z.boolean().default(true),
    educationVerification: z.boolean().default(true),
    referenceCheck: z.boolean().default(true),
    drugScreen: z.boolean().default(false),
    socialMediaReview: z.boolean().default(false),
    internationalCheck: z.boolean().default(false),
  }),

  // Provider
  providerId: z.string().optional(),
  providerName: z.string().optional(),
  providerReferenceId: z.string().optional(),

  // Timeline
  requestedAt: z.date(),
  requestedBy: z.string().uuid(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  expiresAt: z.date().optional(),

  // Results
  findings: z.array(z.object({
    category: z.string(),
    description: z.string(),
    severity: z.enum(['informational', 'minor', 'major', 'disqualifying']),
    documentUrl: z.string().url().optional(),
  })).optional(),

  // Adjudication
  adjudicatedBy: z.string().uuid().optional(),
  adjudicatedAt: z.date().optional(),
  adjudicationNotes: z.string().optional(),
  adjudicationDecision: z.enum(['approved', 'denied', 'conditional']).optional(),

  // Documents
  consentFormUrl: z.string().url().optional(),
  reportUrl: z.string().url().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type BackgroundCheck = z.infer<typeof BackgroundCheckSchema>;

// =============================================================================
// SECURITY CLEARANCE
// =============================================================================

export const ClearanceLevelSchema = z.enum([
  'public_trust',
  'confidential',
  'secret',
  'top_secret',
  'top_secret_sci',
]);

export const ClearanceStatusSchema = z.enum([
  'pending',
  'active',
  'suspended',
  'revoked',
  'expired',
  'denied',
]);

export const SecurityClearanceSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  identityId: z.string().uuid(),

  // Clearance details
  level: ClearanceLevelSchema,
  status: ClearanceStatusSchema,

  // Sponsor
  sponsoringOrganization: z.string(),
  sponsoringContactId: z.string().uuid().optional(),

  // Investigation
  investigationType: z.string(),
  investigatingAgency: z.string().optional(),
  investigationNumber: z.string().optional(),

  // Timeline
  applicationDate: z.date(),
  grantedDate: z.date().optional(),
  effectiveDate: z.date().optional(),
  expirationDate: z.date().optional(),
  lastReinvestigationDate: z.date().optional(),
  nextReinvestigationDate: z.date().optional(),

  // Access
  specialAccess: z.array(z.string()).optional(), // SAP, SCI programs
  caveats: z.array(z.string()).optional(),
  briefedPrograms: z.array(z.string()).optional(),

  // Suspension/Revocation
  suspendedAt: z.date().optional(),
  suspendedBy: z.string().uuid().optional(),
  suspensionReason: z.string().optional(),
  revokedAt: z.date().optional(),
  revokedBy: z.string().uuid().optional(),
  revocationReason: z.string().optional(),

  // Polygraph
  lastPolygraphDate: z.date().optional(),
  polygraphType: z.string().optional(),
  polygraphResult: z.enum(['pass', 'fail', 'inconclusive']).optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SecurityClearance = z.infer<typeof SecurityClearanceSchema>;

// =============================================================================
// PERIODIC REINVESTIGATION
// =============================================================================

export const ReinvestigationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  clearanceId: z.string().uuid(),
  identityId: z.string().uuid(),

  // Investigation
  investigationType: z.string(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),

  // Timeline
  dueDate: z.date(),
  initiatedAt: z.date().optional(),
  completedAt: z.date().optional(),

  // Result
  result: z.enum(['favorable', 'unfavorable', 'pending']).optional(),
  findings: z.string().optional(),

  // Extension
  extensionGranted: z.boolean().default(false),
  extensionReason: z.string().optional(),
  newDueDate: z.date().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Reinvestigation = z.infer<typeof ReinvestigationSchema>;

// =============================================================================
// ADVERSE INFORMATION
// =============================================================================

export const AdverseInformationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  identityId: z.string().uuid(),
  clearanceId: z.string().uuid().optional(),

  // Information details
  category: z.enum([
    'criminal',
    'financial',
    'foreign_contact',
    'substance_abuse',
    'security_violation',
    'conduct',
    'mental_health',
    'technology_misuse',
    'other',
  ]),
  description: z.string(),
  severity: z.enum(['minor', 'moderate', 'serious', 'disqualifying']),

  // Source
  source: z.enum(['self_reported', 'investigation', 'incident', 'third_party', 'continuous_evaluation']),
  reportedAt: z.date(),
  reportedBy: z.string().uuid().optional(),

  // Assessment
  assessmentRequired: z.boolean().default(true),
  assessedBy: z.string().uuid().optional(),
  assessedAt: z.date().optional(),
  assessmentNotes: z.string().optional(),

  // Outcome
  outcome: z.enum([
    'no_action',
    'counseling',
    'warning',
    'suspension',
    'revocation',
    'pending',
  ]).optional(),
  outcomeDate: z.date().optional(),
  outcomeNotes: z.string().optional(),

  // Mitigation
  mitigationFactors: z.array(z.string()).optional(),
  mitigationAccepted: z.boolean().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AdverseInformation = z.infer<typeof AdverseInformationSchema>;

// =============================================================================
// DOMAIN FUNCTIONS
// =============================================================================

export function isClearanceActive(clearance: SecurityClearance): boolean {
  if (clearance.status !== 'active') return false;
  if (clearance.expirationDate && clearance.expirationDate < new Date()) return false;
  return true;
}

export function isClearanceDueForReinvestigation(
  clearance: SecurityClearance,
  daysThreshold: number = 90
): boolean {
  if (!clearance.nextReinvestigationDate) return false;

  const now = new Date();
  const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

  return clearance.nextReinvestigationDate <= threshold;
}

export function getClearanceLevelNumeric(level: z.infer<typeof ClearanceLevelSchema>): number {
  const levels: Record<string, number> = {
    public_trust: 1,
    confidential: 2,
    secret: 3,
    top_secret: 4,
    top_secret_sci: 5,
  };
  return levels[level] ?? 0;
}

export function hasRequiredClearance(
  clearance: SecurityClearance | null,
  requiredLevel: z.infer<typeof ClearanceLevelSchema>
): boolean {
  if (!clearance || !isClearanceActive(clearance)) return false;
  return getClearanceLevelNumeric(clearance.level) >= getClearanceLevelNumeric(requiredLevel);
}
