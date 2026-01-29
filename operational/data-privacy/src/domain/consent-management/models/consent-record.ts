/**
 * Consent Record Domain Model
 * GDPR Art. 6 - Lawful basis for processing
 */

// ============================================================================
// ENUMS (mirror Prisma but domain-owned)
// ============================================================================

export type SubjectType =
  | 'CUSTOMER'
  | 'EMPLOYEE'
  | 'CONTRACTOR'
  | 'PROSPECT'
  | 'PARTNER'
  | 'OTHER';

export type LawfulBasis =
  | 'CONSENT'           // GDPR Art. 6(1)(a) - explicit consent
  | 'CONTRACT'          // GDPR Art. 6(1)(b) - contract performance
  | 'LEGAL_OBLIGATION'  // GDPR Art. 6(1)(c) - legal requirement
  | 'VITAL_INTEREST'    // GDPR Art. 6(1)(d) - protect life
  | 'PUBLIC_TASK'       // GDPR Art. 6(1)(e) - public authority
  | 'LEGITIMATE_INTEREST'; // GDPR Art. 6(1)(f) - balanced interest

export type ConsentStatus =
  | 'ACTIVE'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'SUPERSEDED';

export type CaptureMethod =
  | 'FORM'
  | 'API'
  | 'VERBAL'
  | 'WRITTEN'
  | 'CHECKBOX'
  | 'DOUBLE_OPT_IN'
  | 'IMPLICIT';

// ============================================================================
// DOMAIN MODEL
// ============================================================================

export interface ConsentRecord {
  id: string;

  // Entity ownership (FK to entity-governance)
  entityId: string;

  // Data subject identification
  subjectId: string;
  subjectEmail?: string;
  subjectType: SubjectType;

  // Consent details
  purpose: string;
  purposeGroup?: string;
  lawfulBasis: LawfulBasis;

  // Status
  status: ConsentStatus;

  // Timestamps
  grantedAt: Date;
  withdrawnAt?: Date;
  expiresAt?: Date;

  // Evidence and audit
  proofRef?: string;
  captureMethod: CaptureMethod;
  sourceSystem?: string;
  version?: string;

  // Withdrawal handling
  withdrawalReason?: string;
  withdrawalMethod?: CaptureMethod;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface GrantConsentInput {
  entityId: string;
  subjectId: string;
  subjectEmail?: string | undefined;
  subjectType?: SubjectType | undefined;
  purpose: string;
  purposeGroup?: string | undefined;
  lawfulBasis: LawfulBasis;
  grantedAt: Date;
  expiresAt?: Date | undefined;
  proofRef?: string | undefined;
  captureMethod?: CaptureMethod | undefined;
  sourceSystem?: string | undefined;
  version?: string | undefined;
  createdBy?: string | undefined;
}

export interface WithdrawConsentInput {
  reason?: string | undefined;
  method?: CaptureMethod | undefined;
}

export interface ConsentQueryFilter {
  entityId?: string | undefined;
  subjectId?: string | undefined;
  purpose?: string | undefined;
  status?: ConsentStatus | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

// ============================================================================
// DOMAIN LOGIC
// ============================================================================

/**
 * Check if consent record has expired
 */
export function isExpired(consent: ConsentRecord): boolean {
  if (!consent.expiresAt) return false;
  return consent.expiresAt < new Date();
}

/**
 * Check if consent is currently valid (active and not expired)
 */
export function isValid(consent: ConsentRecord): boolean {
  return consent.status === 'ACTIVE' && !isExpired(consent);
}

/**
 * Check if consent can be withdrawn (must be active)
 */
export function canWithdraw(consent: ConsentRecord): boolean {
  return consent.status === 'ACTIVE';
}

/**
 * Consent requires explicit consent capture (not just legitimate interest)
 */
export function requiresExplicitCapture(lawfulBasis: LawfulBasis): boolean {
  return lawfulBasis === 'CONSENT';
}
