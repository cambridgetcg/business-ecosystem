/**
 * Copyright Entity - Core domain object for copyright management
 * Pattern: trademark.entity.ts
 */

import { AggregateRoot } from './base.entity.js';
import { CopyrightRegisteredEvent } from '../events/copyright.events.js';

export type CopyrightStatus = 'unregistered' | 'pending' | 'registered' | 'disputed';

export type WorkType =
  | 'literary'
  | 'musical'
  | 'dramatic'
  | 'choreographic'
  | 'pictorial'
  | 'audiovisual'
  | 'sound_recording'
  | 'architectural'
  | 'software'
  | 'compilation'
  | 'derivative';

export interface Author {
  name: string;
  contribution: string;
  isWorkForHire: boolean;
  nationality?: string;
}

export interface CopyrightProps {
  registrationNumber?: string;
  title: string;
  alternativeTitles?: string[];
  workType: WorkType;
  status: CopyrightStatus;
  creationDate: Date;
  publicationDate?: Date;
  registrationDate?: Date;
  authors: Author[];
  claimantId: string;
  description?: string;
  nation: string;
  isPublished: boolean;
}

export class Copyright extends AggregateRoot {
  private props: CopyrightProps;

  private constructor(id: string | undefined, props: CopyrightProps) {
    super(id);
    this.props = props;
  }

  public static create(props: Omit<CopyrightProps, 'status'>): Copyright {
    return new Copyright(undefined, {
      ...props,
      status: 'unregistered',
    });
  }

  public static reconstitute(id: string, props: CopyrightProps): Copyright {
    return new Copyright(id, props);
  }

  // Getters
  get registrationNumber(): string | undefined { return this.props.registrationNumber; }
  get title(): string { return this.props.title; }
  get alternativeTitles(): string[] { return [...(this.props.alternativeTitles ?? [])]; }
  get workType(): WorkType { return this.props.workType; }
  get status(): CopyrightStatus { return this.props.status; }
  get creationDate(): Date { return this.props.creationDate; }
  get publicationDate(): Date | undefined { return this.props.publicationDate; }
  get registrationDate(): Date | undefined { return this.props.registrationDate; }
  get authors(): Author[] { return [...this.props.authors]; }
  get claimantId(): string { return this.props.claimantId; }
  get description(): string | undefined { return this.props.description; }
  get nation(): string { return this.props.nation; }
  get isPublished(): boolean { return this.props.isPublished; }

  // Domain operations
  public register(registrationNumber: string, registrationDate: Date, userId?: string): void {
    if (this.props.status !== 'unregistered' && this.props.status !== 'pending') {
      throw new Error('Can only register unregistered or pending copyrights');
    }

    this.props.registrationNumber = registrationNumber;
    this.props.registrationDate = registrationDate;
    this.props.status = 'registered';
    this.touch(userId);

    this.addDomainEvent(new CopyrightRegisteredEvent(this.id, {
      registrationNumber,
      title: this.props.title,
      workType: this.props.workType,
      registrationDate,
      authors: this.props.authors.map(a => a.name),
    }));
  }

  public publish(publicationDate: Date, userId?: string): void {
    if (this.props.isPublished) {
      throw new Error('Work is already published');
    }

    this.props.publicationDate = publicationDate;
    this.props.isPublished = true;
    this.touch(userId);
  }

  public addAuthor(author: Author, userId?: string): void {
    this.props.authors.push(author);
    this.touch(userId);
  }

  public dispute(userId?: string): void {
    this.props.status = 'disputed';
    this.touch(userId);
  }

  public submitForRegistration(userId?: string): void {
    if (this.props.status !== 'unregistered') {
      throw new Error('Can only submit unregistered works for registration');
    }
    this.props.status = 'pending';
    this.touch(userId);
  }
}
