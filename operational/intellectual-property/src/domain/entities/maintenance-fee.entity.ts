/**
 * Maintenance Fee Entity - Tracks patent maintenance fee obligations
 * Pattern: trademark.entity.ts
 *
 * In the US, maintenance fees are due at 3.5, 7.5, and 11.5 years after grant.
 * This entity tracks each fee obligation and its payment status.
 */

import { AggregateRoot } from './base.entity.js';
import {
  MaintenanceFeeCreatedEvent,
  MaintenanceFeePaidEvent,
  MaintenanceFeeMissedEvent,
} from '../events/maintenance-fee.events.js';

export type MaintenanceFeeStatus = 'upcoming' | 'payable' | 'grace_period' | 'paid' | 'missed';
export type EntitySize = 'large' | 'small' | 'micro';

export interface MaintenanceFeeProps {
  patentId: string;
  feeNumber: 1 | 2 | 3; // 3.5yr, 7.5yr, 11.5yr for US
  jurisdiction: string;
  dueDate: Date;
  windowOpensDate: Date;
  gracePeriodEndsDate: Date;
  status: MaintenanceFeeStatus;
  paidDate?: Date;
  paidAmount?: number; // in cents
  surchargeApplied: boolean;
  entitySizeAtPayment?: EntitySize;
  receiptNumber?: string;
  notes?: string;
}

export interface CreateMaintenanceFeeInput {
  patentId: string;
  feeNumber: 1 | 2 | 3;
  jurisdiction?: string;
  dueDate: Date;
  windowOpensDate: Date;
  gracePeriodEndsDate: Date;
}

export interface PayMaintenanceFeeInput {
  paidDate: Date;
  paidAmount: number;
  entitySize: EntitySize;
  receiptNumber?: string;
  notes?: string;
}

export class MaintenanceFee extends AggregateRoot {
  private props: MaintenanceFeeProps;

  private constructor(id: string | undefined, props: MaintenanceFeeProps) {
    super(id);
    this.props = props;
  }

  public static create(input: CreateMaintenanceFeeInput): MaintenanceFee {
    const props: MaintenanceFeeProps = {
      patentId: input.patentId,
      feeNumber: input.feeNumber,
      jurisdiction: input.jurisdiction ?? 'US',
      dueDate: input.dueDate,
      windowOpensDate: input.windowOpensDate,
      gracePeriodEndsDate: input.gracePeriodEndsDate,
      status: 'upcoming',
      surchargeApplied: false,
    };

    const fee = new MaintenanceFee(undefined, props);

    fee.addDomainEvent(new MaintenanceFeeCreatedEvent(fee.id, {
      patentId: props.patentId,
      feeNumber: props.feeNumber,
      dueDate: props.dueDate,
      gracePeriodEndsDate: props.gracePeriodEndsDate,
    }));

    return fee;
  }

  public static reconstitute(id: string, props: MaintenanceFeeProps): MaintenanceFee {
    return new MaintenanceFee(id, props);
  }

  /**
   * Calculate maintenance fee dates for a US patent based on grant date.
   * Returns array of fee inputs for 3.5yr, 7.5yr, and 11.5yr maintenance fees.
   */
  public static calculateUSMaintenanceFees(patentId: string, grantDate: Date): CreateMaintenanceFeeInput[] {
    const fees: CreateMaintenanceFeeInput[] = [];

    // Fee schedules: 3.5yr, 7.5yr, 11.5yr after grant
    const feeSchedule = [
      { feeNumber: 1 as const, years: 3.5, windowYears: 3, graceMonths: 6 },
      { feeNumber: 2 as const, years: 7.5, windowYears: 7, graceMonths: 6 },
      { feeNumber: 3 as const, years: 11.5, windowYears: 11, graceMonths: 6 },
    ];

    for (const schedule of feeSchedule) {
      const dueDate = new Date(grantDate);
      dueDate.setFullYear(dueDate.getFullYear() + Math.floor(schedule.years));
      dueDate.setMonth(dueDate.getMonth() + (schedule.years % 1) * 12);

      const windowOpensDate = new Date(grantDate);
      windowOpensDate.setFullYear(windowOpensDate.getFullYear() + schedule.windowYears);

      const gracePeriodEndsDate = new Date(dueDate);
      gracePeriodEndsDate.setMonth(gracePeriodEndsDate.getMonth() + schedule.graceMonths);

      fees.push({
        patentId,
        feeNumber: schedule.feeNumber,
        jurisdiction: 'US',
        dueDate,
        windowOpensDate,
        gracePeriodEndsDate,
      });
    }

    return fees;
  }

  // Getters
  get patentId(): string { return this.props.patentId; }
  get feeNumber(): 1 | 2 | 3 { return this.props.feeNumber; }
  get jurisdiction(): string { return this.props.jurisdiction; }
  get dueDate(): Date { return this.props.dueDate; }
  get windowOpensDate(): Date { return this.props.windowOpensDate; }
  get gracePeriodEndsDate(): Date { return this.props.gracePeriodEndsDate; }
  get status(): MaintenanceFeeStatus { return this.props.status; }
  get paidDate(): Date | undefined { return this.props.paidDate; }
  get paidAmount(): number | undefined { return this.props.paidAmount; }
  get surchargeApplied(): boolean { return this.props.surchargeApplied; }
  get entitySizeAtPayment(): EntitySize | undefined { return this.props.entitySizeAtPayment; }
  get receiptNumber(): string | undefined { return this.props.receiptNumber; }
  get notes(): string | undefined { return this.props.notes; }

  // Computed properties
  get feeLabel(): string {
    const labels: Record<number, string> = {
      1: '3.5 Year',
      2: '7.5 Year',
      3: '11.5 Year',
    };
    return labels[this.props.feeNumber] ?? `Fee ${this.props.feeNumber}`;
  }

  get isOverdue(): boolean {
    if (this.props.status === 'paid' || this.props.status === 'missed') {
      return false;
    }
    return new Date() > this.props.dueDate;
  }

  get isInGracePeriod(): boolean {
    if (this.props.status === 'paid' || this.props.status === 'missed') {
      return false;
    }
    const now = new Date();
    return now > this.props.dueDate && now <= this.props.gracePeriodEndsDate;
  }

  get daysUntilDue(): number {
    const now = new Date();
    const diffTime = this.props.dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Domain operations
  public updateStatus(actorId?: string): void {
    if (this.props.status === 'paid' || this.props.status === 'missed') {
      return; // Terminal states
    }

    const now = new Date();

    if (now >= this.props.windowOpensDate && now < this.props.dueDate) {
      this.props.status = 'payable';
    } else if (now >= this.props.dueDate && now <= this.props.gracePeriodEndsDate) {
      this.props.status = 'grace_period';
    } else if (now > this.props.gracePeriodEndsDate) {
      this.props.status = 'missed';
      this.addDomainEvent(new MaintenanceFeeMissedEvent(this.id, {
        patentId: this.props.patentId,
        feeNumber: this.props.feeNumber,
        gracePeriodEndedAt: this.props.gracePeriodEndsDate,
      }));
    }

    this.touch(actorId);
  }

  public pay(input: PayMaintenanceFeeInput, actorId?: string): void {
    if (this.props.status === 'paid') {
      throw new Error('Maintenance fee has already been paid');
    }

    if (this.props.status === 'missed') {
      throw new Error('Cannot pay a missed maintenance fee - patent may have lapsed');
    }

    // Determine if surcharge applies (paid after due date but within grace period)
    const surchargeApplied = input.paidDate > this.props.dueDate;

    this.props.paidDate = input.paidDate;
    this.props.paidAmount = input.paidAmount;
    this.props.entitySizeAtPayment = input.entitySize;
    this.props.surchargeApplied = surchargeApplied;
    this.props.status = 'paid';

    if (input.receiptNumber) {
      this.props.receiptNumber = input.receiptNumber;
    }
    if (input.notes) {
      this.props.notes = input.notes;
    }

    this.touch(actorId);

    this.addDomainEvent(new MaintenanceFeePaidEvent(this.id, {
      patentId: this.props.patentId,
      feeNumber: this.props.feeNumber,
      paidDate: input.paidDate,
      paidAmount: input.paidAmount,
      entitySize: input.entitySize,
      surchargeApplied,
    }));
  }

  public addNotes(notes: string, actorId?: string): void {
    this.props.notes = this.props.notes
      ? `${this.props.notes}\n${notes}`
      : notes;
    this.touch(actorId);
  }
}
