/**
 * DSAR (Data Subject Access Request) Domain Model
 * GDPR Articles 15-22 - Data Subject Rights
 */

// ============================================================================
// ENUMS
// ============================================================================

export type DSARType =
  | 'ACCESS'            // Art. 15 - Right of access
  | 'RECTIFICATION'     // Art. 16 - Right to rectification
  | 'ERASURE'           // Art. 17 - Right to erasure ("right to be forgotten")
  | 'RESTRICTION'       // Art. 18 - Right to restriction of processing
  | 'PORTABILITY'       // Art. 20 - Right to data portability
  | 'OBJECTION'         // Art. 21 - Right to object
  | 'AUTOMATED_DECISION'; // Art. 22 - Automated decision-making

export type DSARStatus =
  | 'RECEIVED'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'PROCESSING'
  | 'PENDING_REVIEW'
  | 'AWAITING_APPROVAL'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXTENDED'
  | 'CLOSED';

export type VerificationMethod =
  | 'ID_DOCUMENT'
  | 'EMAIL_VERIFICATION'
  | 'PHONE_VERIFICATION'
  | 'ACCOUNT_LOGIN'
  | 'KNOWLEDGE_BASED'
  | 'IN_PERSON'
  | 'OTHER';

export type ResponseMethod =
  | 'EMAIL'
  | 'PORTAL_DOWNLOAD'
  | 'PHYSICAL_MAIL'
  | 'SECURE_TRANSFER';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// ============================================================================
// DOMAIN MODELS
// ============================================================================

export interface DSARRequest {
  id: string;
  entityId: string;
  requestNumber: string;

  // Data subject
  subjectId?: string;
  subjectEmail: string;
  subjectName?: string;

  // Request details
  requestType: DSARType;
  description?: string;

  // Status and workflow
  status: DSARStatus;
  priority: Priority;

  // Timeline (GDPR: 30 days, extendable to 90)
  receivedAt: Date;
  deadline: Date;
  extendedDeadline?: Date;
  extensionReason?: string;

  // Verification
  verifiedAt?: Date;
  verifiedBy?: string;
  verificationMethod?: VerificationMethod;

  // Processing
  assignedTo?: string;
  startedAt?: Date;
  completedAt?: Date;

  // Response
  responseRef?: string;
  responseMethod?: ResponseMethod;
  responseSentAt?: Date;

  // Rejection
  rejectedAt?: Date;
  rejectionReason?: string;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface DSARActivity {
  id: string;
  dsarId: string;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
  performedBy: string;
  performedAt: Date;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateDSARInput {
  entityId: string;
  subjectEmail: string;
  subjectName?: string | undefined;
  subjectId?: string | undefined;
  requestType: DSARType;
  description?: string | undefined;
  priority?: Priority | undefined;
}

export interface VerifyDSARInput {
  verificationMethod: VerificationMethod;
  verifiedBy: string;
}

export interface CompleteDSARInput {
  responseRef?: string | undefined;
  responseMethod: ResponseMethod;
}

export interface ExtendDSARInput {
  reason: string;
}

export interface RejectDSARInput {
  reason: string;
}

export interface DSARQueryFilter {
  entityId?: string | undefined;
  status?: DSARStatus | undefined;
  requestType?: DSARType | undefined;
  overdue?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

// ============================================================================
// DOMAIN LOGIC - GDPR Deadline Rules
// ============================================================================

/** GDPR standard deadline: 30 days from receipt */
const STANDARD_DEADLINE_DAYS = 30;

/** GDPR maximum extension: 90 days from receipt (for complex requests) */
const EXTENDED_DEADLINE_DAYS = 90;

/**
 * Calculate initial GDPR deadline (30 days from receipt)
 */
export function calculateDeadline(receivedAt: Date): Date {
  const deadline = new Date(receivedAt);
  deadline.setDate(deadline.getDate() + STANDARD_DEADLINE_DAYS);
  return deadline;
}

/**
 * Calculate extended deadline (90 days from receipt)
 * GDPR Art. 12(3) - extension allowed for complex requests
 */
export function calculateExtendedDeadline(receivedAt: Date): Date {
  const deadline = new Date(receivedAt);
  deadline.setDate(deadline.getDate() + EXTENDED_DEADLINE_DAYS);
  return deadline;
}

/**
 * Check if DSAR is overdue
 */
export function isOverdue(dsar: DSARRequest): boolean {
  const now = new Date();
  const effectiveDeadline = dsar.extendedDeadline ?? dsar.deadline;
  const terminalStatuses: DSARStatus[] = ['COMPLETED', 'REJECTED', 'CLOSED'];

  return !terminalStatuses.includes(dsar.status) && now > effectiveDeadline;
}

/**
 * Get days remaining until deadline
 */
export function getDaysRemaining(dsar: DSARRequest): number {
  const now = new Date();
  const effectiveDeadline = dsar.extendedDeadline ?? dsar.deadline;
  const diffMs = effectiveDeadline.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if deadline extension is still allowed
 * Can only extend once, and only before original deadline
 */
export function canExtend(dsar: DSARRequest): boolean {
  return !dsar.extendedDeadline && new Date() <= dsar.deadline;
}

/**
 * Check if DSAR can be verified
 */
export function canVerify(dsar: DSARRequest): boolean {
  return dsar.status === 'RECEIVED' || dsar.status === 'PENDING_VERIFICATION';
}

/**
 * Check if DSAR processing can start
 */
export function canStartProcessing(dsar: DSARRequest): boolean {
  return dsar.status === 'VERIFIED';
}

/**
 * Check if DSAR can be completed
 */
export function canComplete(dsar: DSARRequest): boolean {
  return dsar.status === 'PROCESSING' || dsar.status === 'PENDING_REVIEW';
}

/**
 * Check if DSAR is in terminal state
 */
export function isTerminal(dsar: DSARRequest): boolean {
  const terminalStatuses: DSARStatus[] = ['COMPLETED', 'REJECTED', 'CLOSED'];
  return terminalStatuses.includes(dsar.status);
}

/**
 * Generate DSAR request number
 */
export function generateRequestNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DSAR-${timestamp}-${random}`;
}
