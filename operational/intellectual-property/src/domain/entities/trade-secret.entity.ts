/**
 * Trade Secret Entity - Core domain object for trade secret management
 * Pattern: trademark.entity.ts
 */

import { AggregateRoot } from './base.entity.js';
import {
  TradeSecretCreatedEvent,
  TradeSecretDisclosedEvent,
  TradeSecretAccessGrantedEvent,
} from '../events/trade-secret.events.js';

export type TradeSecretStatus = 'active' | 'disclosed' | 'abandoned' | 'converted_to_patent';

export type TradeSecretCategory =
  | 'technical'
  | 'business'
  | 'financial'
  | 'customer'
  | 'process'
  | 'formula'
  | 'other';

export type SensitivityLevel = 'confidential' | 'highly_confidential' | 'restricted';

export type AccessLevel = 'read' | 'write' | 'admin';

export interface AccessListEntry {
  userId: string;
  accessLevel: AccessLevel;
  grantedAt: string;
  grantedBy: string;
}

export interface ProtectionMeasure {
  id: string;
  category: 'contractual' | 'physical' | 'digital' | 'administrative';
  measureType: string;
  description: string;
  implementedDate: Date;
  lastVerifiedDate?: Date;
  responsibleParty: string;
  status: 'active' | 'inactive' | 'expired';
  relatedAgreementId?: string;
}

export interface TradeSecretProps {
  title: string;
  description: string;
  category: TradeSecretCategory;
  sensitivityLevel: SensitivityLevel;
  status: TradeSecretStatus;
  ownerId: string;
  custodianId?: string;
  identifiedDate: Date;
  lastReviewDate?: Date;
  economicValueDescription: string;
  estimatedValue?: number;
  accessList: AccessListEntry[];
}

export interface CreateTradeSecretInput {
  title: string;
  description: string;
  category: TradeSecretCategory;
  sensitivityLevel: SensitivityLevel;
  ownerId: string;
  custodianId?: string;
  identifiedDate: Date;
  economicValueDescription: string;
  estimatedValue?: number;
}

export class TradeSecret extends AggregateRoot {
  private props: TradeSecretProps;

  private constructor(id: string | undefined, props: TradeSecretProps) {
    super(id);
    this.props = props;
  }

  public static create(input: CreateTradeSecretInput): TradeSecret {
    const props: TradeSecretProps = {
      title: input.title,
      description: input.description,
      category: input.category,
      sensitivityLevel: input.sensitivityLevel,
      status: 'active',
      ownerId: input.ownerId,
      identifiedDate: input.identifiedDate,
      economicValueDescription: input.economicValueDescription,
      accessList: [],
      ...(input.custodianId && { custodianId: input.custodianId }),
      ...(input.estimatedValue && { estimatedValue: input.estimatedValue }),
    };

    const tradeSecret = new TradeSecret(undefined, props);

    tradeSecret.addDomainEvent(new TradeSecretCreatedEvent(tradeSecret.id, {
      title: props.title,
      category: props.category,
      sensitivityLevel: props.sensitivityLevel,
      ownerId: props.ownerId,
    }));

    return tradeSecret;
  }

  public static reconstitute(id: string, props: TradeSecretProps): TradeSecret {
    return new TradeSecret(id, props);
  }

  // Getters
  get title(): string { return this.props.title; }
  get description(): string { return this.props.description; }
  get category(): TradeSecretCategory { return this.props.category; }
  get sensitivityLevel(): SensitivityLevel { return this.props.sensitivityLevel; }
  get status(): TradeSecretStatus { return this.props.status; }
  get ownerId(): string { return this.props.ownerId; }
  get custodianId(): string | undefined { return this.props.custodianId; }
  get identifiedDate(): Date { return this.props.identifiedDate; }
  get lastReviewDate(): Date | undefined { return this.props.lastReviewDate; }
  get economicValueDescription(): string { return this.props.economicValueDescription; }
  get estimatedValue(): number | undefined { return this.props.estimatedValue; }
  get accessList(): AccessListEntry[] { return [...this.props.accessList]; }

  // Domain operations
  public grantAccess(
    userId: string,
    accessLevel: AccessLevel,
    grantedBy: string,
    actorId?: string
  ): void {
    if (this.props.status !== 'active') {
      throw new Error('Cannot grant access to inactive trade secrets');
    }

    // Check if user already has access
    const existingIndex = this.props.accessList.findIndex(a => a.userId === userId);
    if (existingIndex >= 0) {
      // Update existing access
      this.props.accessList[existingIndex] = {
        userId,
        accessLevel,
        grantedAt: new Date().toISOString(),
        grantedBy,
      };
    } else {
      // Add new access
      this.props.accessList.push({
        userId,
        accessLevel,
        grantedAt: new Date().toISOString(),
        grantedBy,
      });
    }

    this.touch(actorId);

    this.addDomainEvent(new TradeSecretAccessGrantedEvent(this.id, {
      userId,
      accessLevel,
      grantedBy,
    }));
  }

  public revokeAccess(userId: string, actorId?: string): void {
    const index = this.props.accessList.findIndex(a => a.userId === userId);
    if (index >= 0) {
      this.props.accessList.splice(index, 1);
      this.touch(actorId);
    }
  }

  public markAsDisclosed(reason: string, actorId?: string): void {
    if (this.props.status !== 'active') {
      throw new Error('Can only disclose active trade secrets');
    }

    this.props.status = 'disclosed';
    this.touch(actorId);

    this.addDomainEvent(new TradeSecretDisclosedEvent(this.id, {
      title: this.props.title,
      reason,
      disclosedAt: new Date(),
    }));
  }

  public abandon(actorId?: string): void {
    if (this.props.status !== 'active') {
      throw new Error('Can only abandon active trade secrets');
    }

    this.props.status = 'abandoned';
    this.touch(actorId);
  }

  public convertToPatent(actorId?: string): void {
    if (this.props.status !== 'active') {
      throw new Error('Can only convert active trade secrets to patent');
    }

    this.props.status = 'converted_to_patent';
    this.touch(actorId);
  }

  public updateReviewDate(reviewDate: Date, actorId?: string): void {
    this.props.lastReviewDate = reviewDate;
    this.touch(actorId);
  }

  public updateEstimatedValue(value: number, actorId?: string): void {
    this.props.estimatedValue = value;
    this.touch(actorId);
  }

  public assignCustodian(custodianId: string, actorId?: string): void {
    this.props.custodianId = custodianId;
    this.touch(actorId);
  }

  public updateSensitivityLevel(level: SensitivityLevel, actorId?: string): void {
    this.props.sensitivityLevel = level;
    this.touch(actorId);
  }

  public hasAccess(userId: string): boolean {
    return this.props.accessList.some(a => a.userId === userId);
  }

  public getAccessLevel(userId: string): AccessLevel | undefined {
    const entry = this.props.accessList.find(a => a.userId === userId);
    return entry?.accessLevel;
  }
}
