/**
 * Reconciliation Exception Entity
 *
 * Tracks unmatched or problematic transactions requiring attention.
 *
 * @module reconciliation/entities
 */

import type { Money } from '../../../types/financial.js';
import type { DomainEvent } from '../../events/domain-event.js';
import type {
  ReconciliationItem,
  ExceptionType,
  ExceptionPriority,
  ExceptionResolution,
  ResolutionType,
} from '../types.js';

/**
 * Exception entity properties.
 */
export interface ReconciliationExceptionProps {
  readonly id: string;
  readonly accountId: string;
  readonly reconciliationRunId: string;
  readonly exceptionType: ExceptionType;
  readonly priority: ExceptionPriority;
  readonly internalItem?: ReconciliationItem | undefined;
  readonly externalItem?: ReconciliationItem | undefined;
  readonly amount: Money;
  readonly difference?: Money | undefined;
  readonly description: string;
  readonly suggestedAction?: string | undefined;
  readonly assignedTo?: string | undefined;
  readonly status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  readonly resolution?: ExceptionResolution | undefined;
  readonly notes: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly dueDate?: Date | undefined;
}

/**
 * Reconciliation Exception Entity
 */
export class ReconciliationException {
  private readonly _id: string;
  private readonly _accountId: string;
  private readonly _reconciliationRunId: string;
  private readonly _exceptionType: ExceptionType;
  private _priority: ExceptionPriority;
  private readonly _internalItem?: ReconciliationItem | undefined;
  private readonly _externalItem?: ReconciliationItem | undefined;
  private readonly _amount: Money;
  private readonly _difference?: Money | undefined;
  private _description: string;
  private _suggestedAction?: string | undefined;
  private _assignedTo?: string | undefined;
  private _status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  private _resolution?: ExceptionResolution | undefined;
  private _notes: string[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _dueDate?: Date | undefined;

  private readonly _domainEvents: DomainEvent[] = [];

  constructor(props: ReconciliationExceptionProps) {
    this._id = props.id;
    this._accountId = props.accountId;
    this._reconciliationRunId = props.reconciliationRunId;
    this._exceptionType = props.exceptionType;
    this._priority = props.priority;
    this._internalItem = props.internalItem;
    this._externalItem = props.externalItem;
    this._amount = props.amount;
    this._difference = props.difference;
    this._description = props.description;
    this._suggestedAction = props.suggestedAction;
    this._assignedTo = props.assignedTo;
    this._status = props.status;
    this._resolution = props.resolution;
    this._notes = [...props.notes];
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._dueDate = props.dueDate;
  }

  /**
   * Assign to a user.
   */
  assign(userId: string): void {
    this._assignedTo = userId;
    this._status = 'in_progress';
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'reconciliation_exception.assigned',
      aggregateId: this._id,
      aggregateType: 'ReconciliationException',
      payload: { assignedTo: userId },
      occurredAt: new Date(),
    });
  }

  /**
   * Add a note.
   */
  addNote(note: string, author: string): void {
    this._notes.push(`[${new Date().toISOString()}] ${author}: ${note}`);
    this._updatedAt = new Date();
  }

  /**
   * Escalate the exception.
   */
  escalate(reason: string): void {
    this._status = 'escalated';
    this._priority = 'critical';
    this._updatedAt = new Date();

    this.addNote(`Escalated: ${reason}`, 'system');

    this.addDomainEvent({
      type: 'reconciliation_exception.escalated',
      aggregateId: this._id,
      aggregateType: 'ReconciliationException',
      payload: { reason, previousPriority: this._priority },
      occurredAt: new Date(),
    });
  }

  /**
   * Resolve the exception.
   */
  resolve(
    type: ResolutionType,
    resolvedBy: string,
    notes: string,
    adjustmentAmount?: Money,
    linkedMatchId?: string
  ): void {
    this._resolution = {
      type,
      resolvedAt: new Date(),
      resolvedBy,
      notes,
      adjustmentAmount,
      linkedMatchId,
    };
    this._status = 'resolved';
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'reconciliation_exception.resolved',
      aggregateId: this._id,
      aggregateType: 'ReconciliationException',
      payload: { resolutionType: type, resolvedBy },
      occurredAt: new Date(),
    });
  }

  /**
   * Set due date for SLA tracking.
   */
  setDueDate(dueDate: Date): void {
    this._dueDate = dueDate;
    this._updatedAt = new Date();
  }

  /**
   * Check if exception is overdue.
   */
  isOverdue(): boolean {
    if (!this._dueDate) return false;
    return new Date() > this._dueDate && this._status !== 'resolved';
  }

  /**
   * Get age in days.
   */
  ageInDays(): number {
    const now = new Date();
    const diff = now.getTime() - this._createdAt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }

  // Getters
  get id(): string { return this._id; }
  get accountId(): string { return this._accountId; }
  get reconciliationRunId(): string { return this._reconciliationRunId; }
  get exceptionType(): ExceptionType { return this._exceptionType; }
  get priority(): ExceptionPriority { return this._priority; }
  get internalItem(): ReconciliationItem | undefined { return this._internalItem; }
  get externalItem(): ReconciliationItem | undefined { return this._externalItem; }
  get amount(): Money { return this._amount; }
  get difference(): Money | undefined { return this._difference; }
  get description(): string { return this._description; }
  get suggestedAction(): string | undefined { return this._suggestedAction; }
  get assignedTo(): string | undefined { return this._assignedTo; }
  get status(): 'open' | 'in_progress' | 'resolved' | 'escalated' { return this._status; }
  get resolution(): ExceptionResolution | undefined { return this._resolution; }
  get notes(): readonly string[] { return this._notes; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get dueDate(): Date | undefined { return this._dueDate; }

  toProps(): ReconciliationExceptionProps {
    return {
      id: this._id,
      accountId: this._accountId,
      reconciliationRunId: this._reconciliationRunId,
      exceptionType: this._exceptionType,
      priority: this._priority,
      internalItem: this._internalItem,
      externalItem: this._externalItem,
      amount: this._amount,
      difference: this._difference,
      description: this._description,
      suggestedAction: this._suggestedAction,
      assignedTo: this._assignedTo,
      status: this._status,
      resolution: this._resolution,
      notes: [...this._notes],
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      dueDate: this._dueDate,
    };
  }
}
