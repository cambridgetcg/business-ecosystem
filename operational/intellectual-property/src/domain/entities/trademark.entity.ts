/**
 * Trademark Entity - Core domain object for trademark management
 */

import { AggregateRoot } from './base.entity.js';
import { TrademarkRegisteredEvent, TrademarkRenewedEvent } from '../events/trademark.events.js';

export type TrademarkStatus =
  | 'draft'
  | 'pending'
  | 'published'
  | 'opposed'
  | 'registered'
  | 'cancelled'
  | 'expired'
  | 'abandoned';

export type TrademarkType = 'word' | 'design' | 'combined' | 'sound' | 'color' | '3d';

export interface NiceClassification {
  classNumber: number;
  description: string;
  goodsServices: string[];
}

export interface TrademarkProps {
  applicationNumber: string | undefined;
  registrationNumber: string | undefined;
  mark: string;
  description: string | undefined;
  type: TrademarkType;
  status: TrademarkStatus;
  filingDate: Date | undefined;
  registrationDate: Date | undefined;
  expirationDate: Date | undefined;
  renewalDate: Date | undefined;
  ownerId: string;
  niceClasses: NiceClassification[];
  jurisdictions: string[];
  logoUrl: string | undefined;
}

export interface CreateTrademarkInput {
  mark: string;
  description?: string | undefined;
  type: TrademarkType;
  ownerId: string;
  niceClasses?: NiceClassification[] | undefined;
  jurisdictions?: string[] | undefined;
  logoUrl?: string | undefined;
}

export class Trademark extends AggregateRoot {
  private props: TrademarkProps;

  private constructor(id: string | undefined, props: TrademarkProps) {
    super(id);
    this.props = props;
  }

  public static create(input: CreateTrademarkInput): Trademark {
    const props: TrademarkProps = {
      applicationNumber: undefined,
      registrationNumber: undefined,
      mark: input.mark,
      description: input.description,
      type: input.type,
      status: 'draft',
      filingDate: undefined,
      registrationDate: undefined,
      expirationDate: undefined,
      renewalDate: undefined,
      ownerId: input.ownerId,
      niceClasses: input.niceClasses ?? [],
      jurisdictions: input.jurisdictions ?? [],
      logoUrl: input.logoUrl,
    };
    return new Trademark(undefined, props);
  }

  public static reconstitute(id: string, props: TrademarkProps): Trademark {
    return new Trademark(id, props);
  }

  // Getters
  get applicationNumber(): string | undefined { return this.props.applicationNumber; }
  get registrationNumber(): string | undefined { return this.props.registrationNumber; }
  get mark(): string { return this.props.mark; }
  get description(): string | undefined { return this.props.description; }
  get type(): TrademarkType { return this.props.type; }
  get status(): TrademarkStatus { return this.props.status; }
  get filingDate(): Date | undefined { return this.props.filingDate; }
  get registrationDate(): Date | undefined { return this.props.registrationDate; }
  get expirationDate(): Date | undefined { return this.props.expirationDate; }
  get renewalDate(): Date | undefined { return this.props.renewalDate; }
  get ownerId(): string { return this.props.ownerId; }
  get niceClasses(): NiceClassification[] { return [...this.props.niceClasses]; }
  get jurisdictions(): string[] { return [...this.props.jurisdictions]; }
  get logoUrl(): string | undefined { return this.props.logoUrl; }

  // Domain operations
  public file(applicationNumber: string, filingDate: Date, userId?: string): void {
    if (this.props.status !== 'draft') {
      throw new Error('Can only file trademarks in draft status');
    }

    this.props.applicationNumber = applicationNumber;
    this.props.filingDate = filingDate;
    this.props.status = 'pending';
    this.touch(userId);
  }

  public register(
    registrationNumber: string,
    registrationDate: Date,
    expirationDate: Date,
    userId?: string
  ): void {
    if (this.props.status !== 'pending' && this.props.status !== 'published') {
      throw new Error('Can only register trademarks in pending or published status');
    }

    this.props.registrationNumber = registrationNumber;
    this.props.registrationDate = registrationDate;
    this.props.expirationDate = expirationDate;
    this.props.status = 'registered';
    this.touch(userId);

    this.addDomainEvent(new TrademarkRegisteredEvent(this.id, {
      registrationNumber,
      mark: this.props.mark,
      registrationDate,
      expirationDate,
      niceClasses: this.props.niceClasses.map(c => c.classNumber),
    }));
  }

  public renew(newExpirationDate: Date, userId?: string): void {
    if (this.props.status !== 'registered') {
      throw new Error('Can only renew registered trademarks');
    }

    const previousExpiration = this.props.expirationDate;
    this.props.expirationDate = newExpirationDate;
    this.props.renewalDate = new Date();
    this.touch(userId);

    this.addDomainEvent(new TrademarkRenewedEvent(this.id, {
      registrationNumber: this.props.registrationNumber!,
      previousExpiration: previousExpiration!,
      newExpiration: newExpirationDate,
    }));
  }

  public addNiceClass(niceClass: NiceClassification, userId?: string): void {
    if (this.props.status !== 'draft') {
      throw new Error('Can only modify classes in draft status');
    }
    this.props.niceClasses.push(niceClass);
    this.touch(userId);
  }

  public oppose(userId?: string): void {
    if (this.props.status !== 'published') {
      throw new Error('Can only oppose published trademarks');
    }
    this.props.status = 'opposed';
    this.touch(userId);
  }

  public cancel(userId?: string): void {
    this.props.status = 'cancelled';
    this.touch(userId);
  }
}
