/**
 * Extended Payment Entity
 *
 * Full-featured payment aggregate with multi-rail routing support,
 * approval workflows, tracking, and recovery capabilities.
 *
 * @see docs/research/nuances/19_MULTI_RAIL_ORCHESTRATION.md
 * @see docs/research/nuances/11_PAYMENT_FAILURE_RECOVERY.md
 */

import type {
  Money,
  PaymentMethod,
  PaymentUrgency,
  PaymentFailureCode,
  ExtendedPaymentStatus,
} from '../../types/financial.js';
import type { DomainEvent, AggregateRoot } from '../events/domain-event.js';
import type { RoutingDecision } from '../value-objects/routing-decision.js';

/**
 * Properties for constructing a PaymentExtended entity.
 */
export interface PaymentExtendedProps {
  id: string;
  transactionId: string;
  sourceAccountId?: string | undefined;
  destinationAccountId?: string | undefined;
  amount: Money;
  method: PaymentMethod;
  urgency: PaymentUrgency;
  invoiceId?: string | undefined;
  description?: string | undefined;

  // Rail and routing
  railId?: string | undefined;
  routingDecisionId?: string | undefined;

  // Timing
  requestedExecutionDate?: Date | undefined;
  scheduledSettlement?: Date | undefined;
  cutoffDeadline?: Date | undefined;
  actualSettlement?: Date | undefined;

  // Tracking
  gpiUetr?: string | undefined; // SWIFT gpi unique reference
  externalReference?: string | undefined; // Bank reference

  // Status
  status: ExtendedPaymentStatus;
  failureCode?: PaymentFailureCode | undefined;
  failureReason?: string | undefined;

  // Recovery
  recallId?: string | undefined;
  inquiryId?: string | undefined;

  // Audit
  createdAt: Date;
  createdBy?: string | undefined;
  approvedAt?: Date | undefined;
  approvedBy?: string | undefined;
  processedAt?: Date | undefined;
  completedAt?: Date | undefined;
}

/**
 * Extended Payment aggregate root.
 *
 * Implements the full payment lifecycle:
 * draft → pending_approval → approved → routing → processing → completed
 *
 * With support for failure, recall, and inquiry states.
 */
export class PaymentExtended implements AggregateRoot {
  private readonly _props: PaymentExtendedProps;
  private readonly _domainEvents: DomainEvent[] = [];

  constructor(props: PaymentExtendedProps) {
    this._props = { ...props };
  }

  // ==========================================================================
  // STATE TRANSITIONS
  // ==========================================================================

  /**
   * Submit a draft payment for approval.
   */
  submitForApproval(): void {
    this.assertStatus(['draft'], 'Can only submit draft payments for approval');
    this._props.status = 'pending_approval';
    this.addEvent('payment.submitted_for_approval', {
      amount: this._props.amount,
      urgency: this._props.urgency,
    });
  }

  /**
   * Approve a pending payment.
   */
  approve(approvedBy: string): void {
    this.assertStatus(['pending_approval'], 'Can only approve pending payments');
    this._props.status = 'approved';
    this._props.approvedAt = new Date();
    this._props.approvedBy = approvedBy;
    this.addEvent('payment.approved', { approvedBy });
  }

  /**
   * Reject a pending payment.
   */
  reject(reason: string, rejectedBy: string): void {
    this.assertStatus(['pending_approval'], 'Can only reject pending payments');
    this._props.status = 'cancelled';
    this._props.failureReason = reason;
    this.addEvent('payment.rejected', { reason, rejectedBy });
  }

  /**
   * Skip approval workflow (for payments below threshold).
   */
  skipApproval(): void {
    this.assertStatus(['draft'], 'Can only skip approval for draft payments');
    this._props.status = 'pending';
    this.addEvent('payment.approval_skipped', {
      reason: 'Below approval threshold',
    });
  }

  /**
   * Assign routing decision to the payment.
   */
  assignRouting(decision: RoutingDecision): void {
    this.assertStatus(
      ['approved', 'pending'],
      'Can only route approved/pending payments'
    );
    this._props.status = 'routing';
    this._props.railId = decision.selectedRailId;
    this._props.routingDecisionId = decision.id;
    this.addEvent('payment.routing_assigned', {
      railId: decision.selectedRailId,
      fallbackRailId: decision.fallbackRailId,
      urgencyLevel: decision.urgencyLevel,
      selectionReason: decision.selectionReason,
    });
  }

  /**
   * Start processing the payment on the assigned rail.
   */
  startProcessing(
    scheduledSettlement: Date,
    cutoffDeadline: Date,
    externalReference?: string,
    gpiUetr?: string
  ): void {
    this.assertStatus(['routing'], 'Can only process routed payments');
    this._props.status = 'processing';
    this._props.processedAt = new Date();
    this._props.scheduledSettlement = scheduledSettlement;
    this._props.cutoffDeadline = cutoffDeadline;
    this._props.externalReference = externalReference;
    this._props.gpiUetr = gpiUetr;
    this.addEvent('payment.processing_started', {
      railId: this._props.railId,
      scheduledSettlement,
      externalReference,
      gpiUetr,
    });
  }

  /**
   * Mark payment as completed/settled.
   */
  complete(actualSettlement?: Date): void {
    this.assertStatus(['processing'], 'Can only complete processing payments');
    this._props.status = 'completed';
    this._props.completedAt = new Date();
    this._props.actualSettlement = actualSettlement ?? new Date();
    this.addEvent('payment.completed', {
      amount: this._props.amount,
      actualSettlement: this._props.actualSettlement,
      railId: this._props.railId,
      externalReference: this._props.externalReference,
    });
  }

  /**
   * Mark payment as failed with error code.
   */
  fail(code: PaymentFailureCode, reason: string): void {
    this.assertStatus(
      ['routing', 'processing'],
      'Can only fail routing/processing payments'
    );
    this._props.status = 'failed';
    this._props.failureCode = code;
    this._props.failureReason = reason;
    this.addEvent('payment.failed', {
      code,
      reason,
      railId: this._props.railId,
    });
  }

  /**
   * Initiate a recall for the payment.
   */
  initiateRecall(recallId: string, reason: string): void {
    this.assertStatus(
      ['processing', 'completed'],
      'Can only recall processing/completed payments'
    );
    this._props.recallId = recallId;
    this.addEvent('payment.recall_initiated', {
      recallId,
      reason,
      railId: this._props.railId,
      gpiUetr: this._props.gpiUetr,
    });
  }

  /**
   * Mark payment as successfully recalled.
   */
  markRecalled(): void {
    if (!this._props.recallId) {
      throw new Error('No recall in progress');
    }
    this._props.status = 'recalled';
    this.addEvent('payment.recalled', {
      recallId: this._props.recallId,
    });
  }

  /**
   * Open an inquiry/investigation for the payment.
   */
  openInquiry(inquiryId: string): void {
    this._props.inquiryId = inquiryId;
    this.addEvent('payment.inquiry_opened', {
      inquiryId,
      status: this._props.status,
    });
  }

  /**
   * Close an open inquiry.
   */
  closeInquiry(resolution: string): void {
    if (!this._props.inquiryId) {
      throw new Error('No inquiry in progress');
    }
    const inquiryId = this._props.inquiryId;
    this._props.inquiryId = undefined;
    this.addEvent('payment.inquiry_closed', {
      inquiryId,
      resolution,
    });
  }

  /**
   * Cancel a payment before processing.
   */
  cancel(reason: string, cancelledBy: string): void {
    this.assertStatus(
      ['draft', 'pending_approval', 'approved', 'pending', 'routing'],
      'Can only cancel payments before processing completes'
    );
    this._props.status = 'cancelled';
    this._props.failureReason = reason;
    this.addEvent('payment.cancelled', { reason, cancelledBy });
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private assertStatus(allowed: ExtendedPaymentStatus[], message: string): void {
    if (!allowed.includes(this._props.status)) {
      throw new Error(`${message}. Current status: ${this._props.status}`);
    }
  }

  private addEvent(
    type: string,
    payload: Record<string, unknown> = {}
  ): void {
    this._domainEvents.push({
      type,
      aggregateId: this._props.id,
      aggregateType: 'Payment',
      payload: {
        ...payload,
        paymentId: this._props.id,
        transactionId: this._props.transactionId,
      },
      occurredAt: new Date(),
    });
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  /**
   * Check if payment can still make the cutoff deadline.
   */
  canMakeCutoff(now: Date = new Date(), bufferMinutes: number = 30): boolean {
    if (!this._props.cutoffDeadline) return true;
    const buffer = bufferMinutes * 60 * 1000;
    return now.getTime() < this._props.cutoffDeadline.getTime() - buffer;
  }

  /**
   * Check if payment is in a terminal state.
   */
  get isTerminal(): boolean {
    return ['completed', 'failed', 'cancelled', 'recalled', 'reversed'].includes(
      this._props.status
    );
  }

  /**
   * Check if payment requires approval based on amount threshold.
   */
  get requiresApproval(): boolean {
    // Configurable threshold - default to $10,000
    return this._props.amount.amount > 10000;
  }

  /**
   * Check if payment is under investigation.
   */
  get hasOpenInquiry(): boolean {
    return this._props.inquiryId !== undefined;
  }

  /**
   * Check if payment recall is in progress.
   */
  get hasOpenRecall(): boolean {
    return (
      this._props.recallId !== undefined &&
      this._props.status !== 'recalled'
    );
  }

  /**
   * Check if payment can be recalled based on rail support.
   */
  canBeRecalled(): boolean {
    // Stablecoins are irreversible
    if (this._props.method === 'stablecoin') return false;
    // Wire transfers typically cannot be recalled
    if (this._props.method === 'wire') return false;
    // Can only recall processing or recently completed
    return ['processing', 'completed'].includes(this._props.status);
  }

  // ==========================================================================
  // GETTERS
  // ==========================================================================

  get id(): string {
    return this._props.id;
  }
  get transactionId(): string {
    return this._props.transactionId;
  }
  get sourceAccountId(): string | undefined {
    return this._props.sourceAccountId;
  }
  get destinationAccountId(): string | undefined {
    return this._props.destinationAccountId;
  }
  get amount(): Money {
    return { ...this._props.amount };
  }
  get method(): PaymentMethod {
    return this._props.method;
  }
  get urgency(): PaymentUrgency {
    return this._props.urgency;
  }
  get invoiceId(): string | undefined {
    return this._props.invoiceId;
  }
  get description(): string | undefined {
    return this._props.description;
  }
  get status(): ExtendedPaymentStatus {
    return this._props.status;
  }
  get railId(): string | undefined {
    return this._props.railId;
  }
  get routingDecisionId(): string | undefined {
    return this._props.routingDecisionId;
  }
  get requestedExecutionDate(): Date | undefined {
    return this._props.requestedExecutionDate;
  }
  get scheduledSettlement(): Date | undefined {
    return this._props.scheduledSettlement;
  }
  get cutoffDeadline(): Date | undefined {
    return this._props.cutoffDeadline;
  }
  get actualSettlement(): Date | undefined {
    return this._props.actualSettlement;
  }
  get gpiUetr(): string | undefined {
    return this._props.gpiUetr;
  }
  get externalReference(): string | undefined {
    return this._props.externalReference;
  }
  get failureCode(): PaymentFailureCode | undefined {
    return this._props.failureCode;
  }
  get failureReason(): string | undefined {
    return this._props.failureReason;
  }
  get recallId(): string | undefined {
    return this._props.recallId;
  }
  get inquiryId(): string | undefined {
    return this._props.inquiryId;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }
  get createdBy(): string | undefined {
    return this._props.createdBy;
  }
  get approvedAt(): Date | undefined {
    return this._props.approvedAt;
  }
  get approvedBy(): string | undefined {
    return this._props.approvedBy;
  }
  get processedAt(): Date | undefined {
    return this._props.processedAt;
  }
  get completedAt(): Date | undefined {
    return this._props.completedAt;
  }

  /**
   * Convert to plain object for persistence.
   */
  toProps(): Readonly<PaymentExtendedProps> {
    return { ...this._props };
  }
}

/**
 * Factory function to create a new draft payment.
 */
export function createDraftPayment(params: {
  id: string;
  transactionId: string;
  amount: Money;
  method: PaymentMethod;
  urgency?: PaymentUrgency;
  sourceAccountId?: string;
  destinationAccountId?: string;
  invoiceId?: string;
  description?: string;
  requestedExecutionDate?: Date;
  createdBy?: string;
}): PaymentExtended {
  return new PaymentExtended({
    id: params.id,
    transactionId: params.transactionId,
    amount: params.amount,
    method: params.method,
    urgency: params.urgency ?? 'standard',
    sourceAccountId: params.sourceAccountId,
    destinationAccountId: params.destinationAccountId,
    invoiceId: params.invoiceId,
    description: params.description,
    requestedExecutionDate: params.requestedExecutionDate,
    status: 'draft',
    createdAt: new Date(),
    createdBy: params.createdBy,
  });
}
