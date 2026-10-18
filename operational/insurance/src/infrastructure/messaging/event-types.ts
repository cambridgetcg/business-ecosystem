/**
 * Insurance Service Event Types
 *
 * Defines all domain events published by the insurance service.
 */

// =============================================================================
// Event Type Constants
// =============================================================================

export const InsuranceEventTypes = {
  // Policy Events
  POLICY_CREATED: 'insurance.policy.created',
  POLICY_UPDATED: 'insurance.policy.updated',
  POLICY_QUOTED: 'insurance.policy.quoted',
  POLICY_BOUND: 'insurance.policy.bound',
  POLICY_ACTIVATED: 'insurance.policy.activated',
  POLICY_EXPIRED: 'insurance.policy.expired',
  POLICY_CANCELLED: 'insurance.policy.cancelled',
  POLICY_RENEWED: 'insurance.policy.renewed',
  POLICY_EXPIRING_SOON: 'insurance.policy.expiring_soon',

  // Claim Events
  CLAIM_CREATED: 'insurance.claim.created',
  CLAIM_UPDATED: 'insurance.claim.updated',
  CLAIM_SUBMITTED: 'insurance.claim.submitted',
  CLAIM_INVESTIGATION_STARTED: 'insurance.claim.investigation_started',
  CLAIM_APPROVED: 'insurance.claim.approved',
  CLAIM_DENIED: 'insurance.claim.denied',
  CLAIM_SETTLED: 'insurance.claim.settled',
  CLAIM_CLOSED: 'insurance.claim.closed',
  CLAIM_REOPENED: 'insurance.claim.reopened',
  CLAIM_PAYMENT_MADE: 'insurance.claim.payment_made',
  CLAIM_RESERVE_UPDATED: 'insurance.claim.reserve_updated',

  // Compliance Events
  EMPLOYERS_LIABILITY_GAP: 'insurance.compliance.employers_liability_gap',
  COVERAGE_GAP_DETECTED: 'insurance.compliance.coverage_gap_detected',
  CERTIFICATE_GENERATED: 'insurance.certificate.generated',
} as const;

export type InsuranceEventType = typeof InsuranceEventTypes[keyof typeof InsuranceEventTypes];

// =============================================================================
// Event Payloads
// =============================================================================

export interface PolicyCreatedPayload {
  policyId: string;
  tenantId: string;
  entityId: string;
  policyNumber: string;
  policyType: string;
  policyName: string;
  inceptionDate: string;
  expiryDate: string;
  totalLimit: { amount: number; currency: string };
  createdBy?: string;
}

export interface PolicyQuotedPayload {
  policyId: string;
  tenantId: string;
  entityId: string;
  policyNumber: string;
  policyType: string;
  grossPremium: { amount: number; currency: string };
  ipt: { amount: number; currency: string };
  netPremium: { amount: number; currency: string };
  paymentFrequency: string;
  quotedBy?: string;
  quotedAt: string;
}

export interface PolicyUpdatedPayload {
  policyId: string;
  tenantId: string;
  entityId: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  updatedBy?: string;
}

export interface PolicyBoundPayload {
  policyId: string;
  tenantId: string;
  entityId: string;
  policyNumber: string;
  policyType: string;
  inceptionDate: string;
  expiryDate: string;
  grossPremium: { amount: number; currency: string };
  insurerName: string;
  boundBy?: string;
  boundAt: string;
}

export interface PolicyActivatedPayload {
  policyId: string;
  tenantId: string;
  entityId: string;
  policyNumber: string;
  policyType: string;
  inceptionDate: string;
  expiryDate: string;
}

export interface PolicyExpiredPayload {
  policyId: string;
  tenantId: string;
  entityId: string;
  policyNumber: string;
  policyType: string;
  expiryDate: string;
  wasRenewed: boolean;
  renewedByPolicyId?: string;
}

export interface PolicyCancelledPayload {
  policyId: string;
  tenantId: string;
  entityId: string;
  policyNumber: string;
  policyType: string;
  cancellationDate: string;
  cancellationReason?: string;
  cancelledBy?: string;
  refundAmount?: { amount: number; currency: string };
}

export interface PolicyRenewedPayload {
  policyId: string;
  tenantId: string;
  entityId: string;
  oldPolicyId: string;
  oldPolicyNumber: string;
  newPolicyNumber: string;
  policyType: string;
  newInceptionDate: string;
  newExpiryDate: string;
  premiumChange?: { percentage: number; direction: 'increase' | 'decrease' | 'flat' };
}

export interface PolicyExpiringSoonPayload {
  policyId: string;
  tenantId: string;
  entityId: string;
  policyNumber: string;
  policyType: string;
  expiryDate: string;
  daysUntilExpiry: number;
  autoRenewal: boolean;
}

export interface ClaimCreatedPayload {
  claimId: string;
  tenantId: string;
  entityId: string;
  policyId: string;
  claimNumber: string;
  claimType: string;
  title: string;
  incidentDate: string;
  claimedAmount?: { amount: number; currency: string };
  priority: string;
  createdBy?: string;
}

export interface ClaimUpdatedPayload {
  claimId: string;
  tenantId: string;
  entityId: string;
  policyId: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  updatedBy?: string;
}

export interface ClaimSubmittedPayload {
  claimId: string;
  tenantId: string;
  entityId: string;
  policyId: string;
  claimNumber: string;
  claimType: string;
  claimedAmount?: { amount: number; currency: string };
  submittedAt: string;
  submittedBy?: string;
}

export interface ClaimInvestigationStartedPayload {
  claimId: string;
  tenantId: string;
  entityId: string;
  policyId: string;
  claimNumber: string;
  claimType: string;
  investigationStartedAt: string;
  investigationStartedBy?: string;
}

export interface ClaimApprovedPayload {
  claimId: string;
  tenantId: string;
  entityId: string;
  policyId: string;
  claimNumber: string;
  approvedAmount: { amount: number; currency: string };
  approvedAt: string;
  approvedBy?: string;
  coverageConfirmed: boolean;
}

export interface ClaimDeniedPayload {
  claimId: string;
  tenantId: string;
  entityId: string;
  policyId: string;
  claimNumber: string;
  denialReason: string;
  deniedAt: string;
  deniedBy?: string;
}

export interface ClaimSettledPayload {
  claimId: string;
  tenantId: string;
  entityId: string;
  policyId: string;
  claimNumber: string;
  settlementAmount: { amount: number; currency: string };
  settlementDate: string;
  totalPaid: { amount: number; currency: string };
  recoveries?: { amount: number; currency: string };
}

export interface ClaimClosedPayload {
  claimId: string;
  tenantId: string;
  entityId: string;
  policyId: string;
  claimNumber: string;
  closedAt: string;
  closedBy?: string;
  finalStatus: string;
  totalPaid: { amount: number; currency: string };
  claimAgeInDays: number;
}

export interface ClaimReopenedPayload {
  claimId: string;
  tenantId: string;
  entityId: string;
  policyId: string;
  claimNumber: string;
  reopenedAt: string;
  reopenedBy?: string;
  reopenReason: string;
}

export interface ClaimPaymentMadePayload {
  claimId: string;
  tenantId: string;
  entityId: string;
  policyId: string;
  claimNumber: string;
  paymentId: string;
  paymentType: string;
  amount: { amount: number; currency: string };
  payee: string;
  paymentDate: string;
  totalClaimPaid: { amount: number; currency: string };
}

export interface ClaimReserveUpdatedPayload {
  claimId: string;
  tenantId: string;
  entityId: string;
  policyId: string;
  claimNumber: string;
  previousReserve: { amount: number; currency: string };
  newReserve: { amount: number; currency: string };
  reason: string;
  adjustedBy?: string;
}

export interface EmployersLiabilityGapPayload {
  tenantId: string;
  entityId: string;
  entityName: string;
  hasEmployees: boolean;
  currentCoverage?: { amount: number; currency: string };
  requiredMinimum: { amount: number; currency: string };
  gapType: 'no_coverage' | 'insufficient_coverage' | 'expired_coverage';
}

export interface CoverageGapDetectedPayload {
  tenantId: string;
  entityId: string;
  gapType: string;
  description: string;
  recommendedCoverage: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface CertificateGeneratedPayload {
  certificateId: string;
  tenantId: string;
  entityId: string;
  policyId: string;
  certificateType: string;
  issuedTo: string;
  validFrom: string;
  validUntil: string;
  documentKey: string;
}

// =============================================================================
// External Event Types (Events we consume)
// =============================================================================

export const ExternalEventTypes = {
  // From Entity Governance
  ENTITY_CREATED: 'entity-governance.entity.created',
  ENTITY_UPDATED: 'entity-governance.entity.updated',
  ENTITY_DISSOLVED: 'entity-governance.entity.dissolved',

  // From Compliance
  COMPLIANCE_OBLIGATION_CREATED: 'compliance.obligation.created',
  COMPLIANCE_BREACH_DETECTED: 'compliance.breach.detected',

  // From Data Privacy
  DATA_BREACH_REPORTED: 'data-privacy.breach.reported',

  // From Accounting
  FISCAL_PERIOD_CLOSED: 'accounting.fiscal_period.closed',
} as const;

export type ExternalEventType = typeof ExternalEventTypes[keyof typeof ExternalEventTypes];
