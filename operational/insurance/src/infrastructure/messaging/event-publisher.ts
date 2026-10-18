/**
 * Insurance Event Publisher
 *
 * Service-specific wrapper around the event bus for publishing insurance domain events.
 */

import type { EventBus, DomainEvent } from '@ecosystem/messaging';
import { createDomainEvent } from '@ecosystem/messaging';
import {
  InsuranceEventTypes,
  type PolicyCreatedPayload,
  type PolicyQuotedPayload,
  type PolicyUpdatedPayload,
  type PolicyBoundPayload,
  type PolicyActivatedPayload,
  type PolicyExpiredPayload,
  type PolicyCancelledPayload,
  type PolicyRenewedPayload,
  type PolicyExpiringSoonPayload,
  type ClaimCreatedPayload,
  type ClaimUpdatedPayload,
  type ClaimSubmittedPayload,
  type ClaimInvestigationStartedPayload,
  type ClaimApprovedPayload,
  type ClaimDeniedPayload,
  type ClaimSettledPayload,
  type ClaimClosedPayload,
  type ClaimReopenedPayload,
  type ClaimPaymentMadePayload,
  type ClaimReserveUpdatedPayload,
  type EmployersLiabilityGapPayload,
  type CoverageGapDetectedPayload,
  type CertificateGeneratedPayload,
} from './event-types.js';

const SERVICE_NAME = 'insurance';

export class InsuranceEventPublisher {
  constructor(private readonly eventBus: EventBus) {}

  // ===========================================================================
  // Policy Events
  // ===========================================================================

  async publishPolicyCreated(payload: PolicyCreatedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.POLICY_CREATED,
      payload.policyId,
      'InsurancePolicy',
      payload,
      { tenantId: payload.tenantId, userId: payload.createdBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.POLICY_CREATED}:`, payload.policyNumber);
  }

  async publishPolicyUpdated(payload: PolicyUpdatedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.POLICY_UPDATED,
      payload.policyId,
      'InsurancePolicy',
      payload,
      { tenantId: payload.tenantId, userId: payload.updatedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
  }

  async publishPolicyQuoted(payload: PolicyQuotedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.POLICY_QUOTED,
      payload.policyId,
      'InsurancePolicy',
      payload,
      { tenantId: payload.tenantId, userId: payload.quotedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.POLICY_QUOTED}: ${payload.policyNumber} - ${payload.grossPremium.amount} ${payload.grossPremium.currency}`);
  }

  async publishPolicyBound(payload: PolicyBoundPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.POLICY_BOUND,
      payload.policyId,
      'InsurancePolicy',
      payload,
      { tenantId: payload.tenantId, userId: payload.boundBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.POLICY_BOUND}:`, payload.policyNumber);
  }

  async publishPolicyActivated(payload: PolicyActivatedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.POLICY_ACTIVATED,
      payload.policyId,
      'InsurancePolicy',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.POLICY_ACTIVATED}:`, payload.policyNumber);
  }

  async publishPolicyExpired(payload: PolicyExpiredPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.POLICY_EXPIRED,
      payload.policyId,
      'InsurancePolicy',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.POLICY_EXPIRED}:`, payload.policyNumber);
  }

  async publishPolicyCancelled(payload: PolicyCancelledPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.POLICY_CANCELLED,
      payload.policyId,
      'InsurancePolicy',
      payload,
      { tenantId: payload.tenantId, userId: payload.cancelledBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.POLICY_CANCELLED}:`, payload.policyNumber);
  }

  async publishPolicyRenewed(payload: PolicyRenewedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.POLICY_RENEWED,
      payload.policyId,
      'InsurancePolicy',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.POLICY_RENEWED}: ${payload.oldPolicyNumber} -> ${payload.newPolicyNumber}`);
  }

  async publishPolicyExpiringSoon(payload: PolicyExpiringSoonPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.POLICY_EXPIRING_SOON,
      payload.policyId,
      'InsurancePolicy',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.POLICY_EXPIRING_SOON}: ${payload.daysUntilExpiry} days`);
  }

  // ===========================================================================
  // Claim Events
  // ===========================================================================

  async publishClaimCreated(payload: ClaimCreatedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.CLAIM_CREATED,
      payload.claimId,
      'InsuranceClaim',
      payload,
      { tenantId: payload.tenantId, userId: payload.createdBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.CLAIM_CREATED}:`, payload.claimNumber);
  }

  async publishClaimUpdated(payload: ClaimUpdatedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.CLAIM_UPDATED,
      payload.claimId,
      'InsuranceClaim',
      payload,
      { tenantId: payload.tenantId, userId: payload.updatedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
  }

  async publishClaimSubmitted(payload: ClaimSubmittedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.CLAIM_SUBMITTED,
      payload.claimId,
      'InsuranceClaim',
      payload,
      { tenantId: payload.tenantId, userId: payload.submittedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.CLAIM_SUBMITTED}:`, payload.claimNumber);
  }

  async publishClaimInvestigationStarted(payload: ClaimInvestigationStartedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.CLAIM_INVESTIGATION_STARTED,
      payload.claimId,
      'InsuranceClaim',
      payload,
      { tenantId: payload.tenantId, userId: payload.investigationStartedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.CLAIM_INVESTIGATION_STARTED}:`, payload.claimNumber);
  }

  async publishClaimApproved(payload: ClaimApprovedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.CLAIM_APPROVED,
      payload.claimId,
      'InsuranceClaim',
      payload,
      { tenantId: payload.tenantId, userId: payload.approvedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.CLAIM_APPROVED}:`, payload.claimNumber);
  }

  async publishClaimDenied(payload: ClaimDeniedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.CLAIM_DENIED,
      payload.claimId,
      'InsuranceClaim',
      payload,
      { tenantId: payload.tenantId, userId: payload.deniedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.CLAIM_DENIED}:`, payload.claimNumber);
  }

  async publishClaimSettled(payload: ClaimSettledPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.CLAIM_SETTLED,
      payload.claimId,
      'InsuranceClaim',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.CLAIM_SETTLED}:`, payload.claimNumber);
  }

  async publishClaimClosed(payload: ClaimClosedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.CLAIM_CLOSED,
      payload.claimId,
      'InsuranceClaim',
      payload,
      { tenantId: payload.tenantId, userId: payload.closedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.CLAIM_CLOSED}:`, payload.claimNumber);
  }

  async publishClaimReopened(payload: ClaimReopenedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.CLAIM_REOPENED,
      payload.claimId,
      'InsuranceClaim',
      payload,
      { tenantId: payload.tenantId, userId: payload.reopenedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.CLAIM_REOPENED}:`, payload.claimNumber);
  }

  async publishClaimPaymentMade(payload: ClaimPaymentMadePayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.CLAIM_PAYMENT_MADE,
      payload.claimId,
      'InsuranceClaim',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.CLAIM_PAYMENT_MADE}: ${payload.amount.amount} ${payload.amount.currency}`);
  }

  async publishClaimReserveUpdated(payload: ClaimReserveUpdatedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.CLAIM_RESERVE_UPDATED,
      payload.claimId,
      'InsuranceClaim',
      payload,
      { tenantId: payload.tenantId, userId: payload.adjustedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
  }

  // ===========================================================================
  // Compliance Events
  // ===========================================================================

  async publishEmployersLiabilityGap(payload: EmployersLiabilityGapPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.EMPLOYERS_LIABILITY_GAP,
      payload.entityId,
      'InsuranceCompliance',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.EMPLOYERS_LIABILITY_GAP}: ${payload.gapType}`);
  }

  async publishCoverageGapDetected(payload: CoverageGapDetectedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.COVERAGE_GAP_DETECTED,
      payload.entityId,
      'InsuranceCompliance',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.COVERAGE_GAP_DETECTED}: ${payload.gapType}`);
  }

  async publishCertificateGenerated(payload: CertificateGeneratedPayload): Promise<void> {
    const event = createDomainEvent(
      InsuranceEventTypes.CERTIFICATE_GENERATED,
      payload.certificateId,
      'InsuranceCertificate',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Insurance] Published ${InsuranceEventTypes.CERTIFICATE_GENERATED}:`, payload.certificateId);
  }

  // ===========================================================================
  // Generic Publish
  // ===========================================================================

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    await this.eventBus.publish(event);
  }
}

// Global publisher instance
let globalPublisher: InsuranceEventPublisher | null = null;

export function setGlobalEventPublisher(publisher: InsuranceEventPublisher): void {
  globalPublisher = publisher;
}

export function getGlobalEventPublisher(): InsuranceEventPublisher | null {
  return globalPublisher;
}
