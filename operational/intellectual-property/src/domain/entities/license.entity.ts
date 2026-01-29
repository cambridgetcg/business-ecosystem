/**
 * License Entity - Core domain object for IP licensing
 * Pattern: trademark.entity.ts
 */

import { AggregateRoot } from './base.entity.js';
import { LicenseGrantedEvent, LicenseTerminatedEvent } from '../events/license.events.js';

export type LicenseStatus = 'draft' | 'active' | 'suspended' | 'terminated' | 'expired';
export type LicenseType = 'exclusive' | 'non_exclusive' | 'sole' | 'sublicense';
export type IPType = 'patent' | 'trademark' | 'copyright' | 'trade_secret';

export interface RoyaltyTerms {
  type: 'percentage' | 'fixed' | 'hybrid' | 'lump_sum';
  rate?: number | undefined;
  fixedAmount?: number | undefined;
  minimumAnnual?: number | undefined;
  paymentFrequency: 'monthly' | 'quarterly' | 'annually' | 'one_time';
  currency: string;
}

export interface TerritoryRestriction {
  includedCountries?: string[] | undefined;
  excludedCountries?: string[] | undefined;
  worldwide: boolean;
}

export interface LicenseProps {
  licenseNumber: string;
  ipType: IPType;
  ipAssetId: string;
  licenseType: LicenseType;
  status: LicenseStatus;
  licensorId: string;
  licenseeId: string;
  effectiveDate: Date;
  expirationDate?: Date | undefined;
  terminationDate?: Date | undefined;
  territory: TerritoryRestriction;
  royaltyTerms: RoyaltyTerms;
  fieldOfUse?: string | undefined;
  canSublicense: boolean;
  sublicenseOf?: string | undefined;
}

export class License extends AggregateRoot {
  private props: LicenseProps;

  private constructor(id: string | undefined, props: LicenseProps) {
    super(id);
    this.props = props;
  }

  public static create(props: Omit<LicenseProps, 'status'>): License {
    return new License(undefined, {
      ...props,
      status: 'draft',
    });
  }

  public static reconstitute(id: string, props: LicenseProps): License {
    return new License(id, props);
  }

  // Getters
  get licenseNumber(): string { return this.props.licenseNumber; }
  get ipType(): IPType { return this.props.ipType; }
  get ipAssetId(): string { return this.props.ipAssetId; }
  get licenseType(): LicenseType { return this.props.licenseType; }
  get status(): LicenseStatus { return this.props.status; }
  get licensorId(): string { return this.props.licensorId; }
  get licenseeId(): string { return this.props.licenseeId; }
  get effectiveDate(): Date { return this.props.effectiveDate; }
  get expirationDate(): Date | undefined { return this.props.expirationDate; }
  get terminationDate(): Date | undefined { return this.props.terminationDate; }
  get territory(): TerritoryRestriction { return { ...this.props.territory }; }
  get royaltyTerms(): RoyaltyTerms { return { ...this.props.royaltyTerms }; }
  get fieldOfUse(): string | undefined { return this.props.fieldOfUse; }
  get canSublicense(): boolean { return this.props.canSublicense; }
  get sublicenseOf(): string | undefined { return this.props.sublicenseOf; }

  // Domain operations
  public activate(userId?: string): void {
    if (this.props.status !== 'draft') {
      throw new Error('Can only activate licenses in draft status');
    }

    if (this.props.effectiveDate > new Date()) {
      throw new Error('Cannot activate license before effective date');
    }

    this.props.status = 'active';
    this.touch(userId);

    this.addDomainEvent(new LicenseGrantedEvent(this.id, {
      licenseNumber: this.props.licenseNumber,
      ipType: this.props.ipType,
      ipAssetId: this.props.ipAssetId,
      licenseType: this.props.licenseType,
      licensorId: this.props.licensorId,
      licenseeId: this.props.licenseeId,
      effectiveDate: this.props.effectiveDate,
    }));
  }

  public suspend(reason: string, userId?: string): void {
    if (this.props.status !== 'active') {
      throw new Error('Can only suspend active licenses');
    }
    this.props.status = 'suspended';
    this.touch(userId);
  }

  public reinstate(userId?: string): void {
    if (this.props.status !== 'suspended') {
      throw new Error('Can only reinstate suspended licenses');
    }
    this.props.status = 'active';
    this.touch(userId);
  }

  public terminate(reason: string, terminationDate: Date, userId?: string): void {
    if (this.props.status === 'terminated' || this.props.status === 'expired') {
      throw new Error('License is already terminated or expired');
    }

    const previousStatus = this.props.status;
    this.props.status = 'terminated';
    this.props.terminationDate = terminationDate;
    this.touch(userId);

    this.addDomainEvent(new LicenseTerminatedEvent(this.id, {
      licenseNumber: this.props.licenseNumber,
      previousStatus,
      terminationDate,
      reason,
    }));
  }

  public expire(userId?: string): void {
    if (!this.props.expirationDate || this.props.expirationDate > new Date()) {
      throw new Error('License has not expired yet');
    }
    this.props.status = 'expired';
    this.touch(userId);
  }

  public updateRoyaltyTerms(terms: RoyaltyTerms, userId?: string): void {
    if (this.props.status !== 'draft') {
      throw new Error('Can only modify royalty terms in draft status');
    }
    this.props.royaltyTerms = terms;
    this.touch(userId);
  }

  public isActive(): boolean {
    return this.props.status === 'active';
  }

  public isExpired(): boolean {
    if (!this.props.expirationDate) return false;
    return this.props.expirationDate < new Date();
  }
}
