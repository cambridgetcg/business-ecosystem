/**
 * Patent Entity - Core domain object for patent management
 */

import { AggregateRoot } from './base.entity.js';
import { PatentFiledEvent, PatentGrantedEvent, PatentAbandonedEvent } from '../events/patent.events.js';

export type PatentStatus =
  | 'draft'
  | 'provisional'
  | 'pending'
  | 'published'
  | 'granted'
  | 'abandoned'
  | 'expired'
  | 'lapsed';

export type PatentType = 'utility' | 'design' | 'plant' | 'reissue';

export interface PatentProps {
  applicationNumber: string | undefined;
  patentNumber: string | undefined;
  title: string;
  abstract: string | undefined;
  type: PatentType;
  status: PatentStatus;
  filingDate: Date | undefined;
  priorityDate: Date | undefined;
  publicationDate: Date | undefined;
  grantDate: Date | undefined;
  expirationDate: Date | undefined;
  inventors: string[];
  assigneeId: string | undefined;
  jurisdictions: string[];
  claims: PatentClaim[];
}

export interface PatentClaim {
  number: number;
  text: string;
  isIndependent: boolean;
  dependsOn?: number | undefined;
}

export interface CreatePatentInput {
  title: string;
  abstract?: string | undefined;
  type: PatentType;
  inventors: string[];
  assigneeId?: string | undefined;
  jurisdictions?: string[] | undefined;
  claims?: PatentClaim[] | undefined;
}

export class Patent extends AggregateRoot {
  private props: PatentProps;

  private constructor(id: string | undefined, props: PatentProps) {
    super(id);
    this.props = props;
  }

  public static create(input: CreatePatentInput): Patent {
    const props: PatentProps = {
      applicationNumber: undefined,
      patentNumber: undefined,
      title: input.title,
      abstract: input.abstract,
      type: input.type,
      status: 'draft',
      filingDate: undefined,
      priorityDate: undefined,
      publicationDate: undefined,
      grantDate: undefined,
      expirationDate: undefined,
      inventors: input.inventors,
      assigneeId: input.assigneeId,
      jurisdictions: input.jurisdictions ?? [],
      claims: input.claims ?? [],
    };
    return new Patent(undefined, props);
  }

  public static reconstitute(id: string, props: PatentProps): Patent {
    return new Patent(id, props);
  }

  // Getters
  get applicationNumber(): string | undefined { return this.props.applicationNumber; }
  get patentNumber(): string | undefined { return this.props.patentNumber; }
  get title(): string { return this.props.title; }
  get abstract(): string | undefined { return this.props.abstract; }
  get type(): PatentType { return this.props.type; }
  get status(): PatentStatus { return this.props.status; }
  get filingDate(): Date | undefined { return this.props.filingDate; }
  get priorityDate(): Date | undefined { return this.props.priorityDate; }
  get publicationDate(): Date | undefined { return this.props.publicationDate; }
  get grantDate(): Date | undefined { return this.props.grantDate; }
  get expirationDate(): Date | undefined { return this.props.expirationDate; }
  get inventors(): string[] { return [...this.props.inventors]; }
  get assigneeId(): string | undefined { return this.props.assigneeId; }
  get jurisdictions(): string[] { return [...this.props.jurisdictions]; }
  get claims(): PatentClaim[] { return [...this.props.claims]; }

  // Domain operations
  public file(applicationNumber: string, filingDate: Date, userId?: string): void {
    if (this.props.status !== 'draft' && this.props.status !== 'provisional') {
      throw new Error('Can only file patents in draft or provisional status');
    }

    this.props.applicationNumber = applicationNumber;
    this.props.filingDate = filingDate;
    this.props.status = 'pending';
    this.touch(userId);

    this.addDomainEvent(new PatentFiledEvent(this.id, {
      applicationNumber,
      title: this.props.title,
      filingDate,
      type: this.props.type,
      inventors: this.props.inventors,
    }));
  }

  public grant(patentNumber: string, grantDate: Date, expirationDate: Date, userId?: string): void {
    if (this.props.status !== 'pending' && this.props.status !== 'published') {
      throw new Error('Can only grant patents in pending or published status');
    }

    this.props.patentNumber = patentNumber;
    this.props.grantDate = grantDate;
    this.props.expirationDate = expirationDate;
    this.props.status = 'granted';
    this.touch(userId);

    this.addDomainEvent(new PatentGrantedEvent(this.id, {
      patentNumber,
      applicationNumber: this.props.applicationNumber!,
      title: this.props.title,
      grantDate,
      expirationDate,
    }));
  }

  public abandon(reason: string, userId?: string): void {
    if (this.props.status === 'abandoned' || this.props.status === 'expired') {
      throw new Error('Patent is already abandoned or expired');
    }

    const previousStatus = this.props.status;
    this.props.status = 'abandoned';
    this.touch(userId);

    this.addDomainEvent(new PatentAbandonedEvent(this.id, {
      applicationNumber: this.props.applicationNumber,
      patentNumber: this.props.patentNumber,
      previousStatus,
      reason,
    }));
  }

  public addClaim(claim: PatentClaim, userId?: string): void {
    if (this.props.status !== 'draft' && this.props.status !== 'provisional') {
      throw new Error('Can only modify claims in draft or provisional status');
    }
    this.props.claims.push(claim);
    this.touch(userId);
  }

  public updateTitle(title: string, userId?: string): void {
    this.props.title = title;
    this.touch(userId);
  }

  public assignTo(assigneeId: string, userId?: string): void {
    this.props.assigneeId = assigneeId;
    this.touch(userId);
  }
}
