/**
 * Data Breach Domain Model
 * GDPR Articles 33-34 - Breach notification requirements
 */

// ============================================================================
// ENUMS
// ============================================================================

export type BreachSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type BreachCategory =
  | 'CONFIDENTIALITY'  // Unauthorized disclosure
  | 'INTEGRITY'        // Unauthorized alteration
  | 'AVAILABILITY'     // Loss of access
  | 'MIXED';           // Multiple categories

export type BreachStatus =
  | 'IDENTIFIED'
  | 'ASSESSING'
  | 'CONTAINED'
  | 'NOTIFYING'
  | 'REMEDIATING'
  | 'RESOLVED'
  | 'CLOSED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RemediationStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'VERIFIED';

// ============================================================================
// DOMAIN MODELS
// ============================================================================

export interface DataBreach {
  id: string;
  entityId: string;
  breachNumber: string;
  title: string;
  description: string;

  // Classification
  severity: BreachSeverity;
  category: BreachCategory;

  // Timeline
  discoveredAt: Date;
  occurredAt?: Date;
  containedAt?: Date;
  resolvedAt?: Date;

  // Impact assessment
  affectedCount?: number;
  affectedCategories: string[];
  crossBorder: boolean;

  // Risk assessment
  riskToSubjects: RiskLevel;
  likelihoodOfHarm?: RiskLevel;

  // Status
  status: BreachStatus;

  // Authority notification (72-hour rule)
  authorityNotificationRequired: boolean;
  authorityNotifiedAt?: Date;
  authorityReference?: string;
  notificationDeadline?: Date;

  // Subject notification
  subjectNotificationRequired: boolean;
  subjectsNotifiedAt?: Date;
  notificationMethod?: string;

  // Root cause
  rootCause?: string;
  attackVector?: string;

  // Remediation
  remediationPlan?: string;
  remediationStatus: RemediationStatus;
  lessonsLearned?: string;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  assignedTo?: string;
}

export interface BreachActivity {
  id: string;
  breachId: string;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
  performedBy: string;
  performedAt: Date;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateBreachInput {
  entityId: string;
  title: string;
  description: string;
  severity: BreachSeverity;
  category: BreachCategory;
  discoveredAt: Date;
  occurredAt?: Date | undefined;
  affectedCount?: number | undefined;
  affectedCategories?: string[] | undefined;
  crossBorder?: boolean | undefined;
  riskToSubjects: RiskLevel;
  likelihoodOfHarm?: RiskLevel | undefined;
  authorityNotificationRequired?: boolean | undefined;
  createdBy: string;
}

export interface UpdateBreachInput {
  title?: string | undefined;
  description?: string | undefined;
  severity?: BreachSeverity | undefined;
  affectedCount?: number | undefined;
  affectedCategories?: string[] | undefined;
  rootCause?: string | undefined;
  attackVector?: string | undefined;
  remediationPlan?: string | undefined;
  lessonsLearned?: string | undefined;
}

export interface NotifyAuthorityInput {
  authorityReference?: string | undefined;
  notifiedBy: string;
}

export interface NotifySubjectsInput {
  notificationMethod: string;
  notifiedBy: string;
}

export interface BreachQueryFilter {
  entityId?: string | undefined;
  severity?: BreachSeverity | undefined;
  status?: BreachStatus | undefined;
  pendingNotification?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

// ============================================================================
// DOMAIN LOGIC - GDPR 72-Hour Rule
// ============================================================================

/** GDPR Art. 33: 72 hours to notify supervisory authority */
const NOTIFICATION_DEADLINE_HOURS = 72;

/**
 * Calculate 72-hour notification deadline from discovery
 */
export function calculateNotificationDeadline(discoveredAt: Date): Date {
  const deadline = new Date(discoveredAt);
  deadline.setHours(deadline.getHours() + NOTIFICATION_DEADLINE_HOURS);
  return deadline;
}

/**
 * Check if authority notification is overdue
 */
export function isNotificationOverdue(breach: DataBreach): boolean {
  if (!breach.authorityNotificationRequired) return false;
  if (breach.authorityNotifiedAt) return false;
  if (!breach.notificationDeadline) return false;
  return new Date() > breach.notificationDeadline;
}

/**
 * Get hours remaining until notification deadline
 */
export function getHoursRemaining(breach: DataBreach): number | null {
  if (!breach.notificationDeadline) return null;
  if (breach.authorityNotifiedAt) return null;
  const now = new Date();
  const diffMs = breach.notificationDeadline.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60 * 60));
}

/**
 * Check if notification was late
 */
export function wasNotificationLate(breach: DataBreach): boolean {
  if (!breach.authorityNotifiedAt) return false;
  if (!breach.notificationDeadline) return false;
  return breach.authorityNotifiedAt > breach.notificationDeadline;
}

/**
 * Determine if authority notification is required based on risk
 * GDPR Art. 33: Required unless unlikely to result in risk to rights/freedoms
 */
export function requiresAuthorityNotification(
  riskToSubjects: RiskLevel,
  affectedCount?: number
): boolean {
  // LOW risk with minimal affected count may not require notification
  if (riskToSubjects === 'LOW' && (!affectedCount || affectedCount < 10)) {
    return false;
  }
  return true;
}

/**
 * Determine if subject notification is required
 * GDPR Art. 34: Required if HIGH risk to rights/freedoms
 */
export function requiresSubjectNotification(riskToSubjects: RiskLevel): boolean {
  return riskToSubjects === 'HIGH' || riskToSubjects === 'CRITICAL';
}

/**
 * Check if breach can be contained (not already resolved)
 */
export function canContain(breach: DataBreach): boolean {
  return breach.status !== 'RESOLVED' && breach.status !== 'CLOSED';
}

/**
 * Check if breach can be resolved
 */
export function canResolve(breach: DataBreach): boolean {
  return breach.status !== 'RESOLVED' && breach.status !== 'CLOSED';
}

/**
 * Check if breach is in terminal state
 */
export function isTerminal(breach: DataBreach): boolean {
  return breach.status === 'RESOLVED' || breach.status === 'CLOSED';
}

/**
 * Generate breach number
 */
export function generateBreachNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BRH-${timestamp}-${random}`;
}
