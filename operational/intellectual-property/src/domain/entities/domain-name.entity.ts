/**
 * Domain Name Entity - Core domain object for domain name management
 * Supports defensive registrations linked to trademarks
 */

import { AggregateRoot } from './base.entity.js';
import {
  DomainNameRegisteredEvent,
  DomainNameRenewedEvent,
  DomainNameTransferInitiatedEvent,
  DomainNameLinkedToTrademarkEvent,
} from '../events/domain-name.events.js';

export type DomainNameStatus =
  | 'active'
  | 'pending_transfer'
  | 'expired'
  | 'redemption'
  | 'deleted'
  | 'reserved';

export type DomainPurpose =
  | 'primary'
  | 'redirect'
  | 'defensive'
  | 'regional'
  | 'campaign'
  | 'product';

export interface DomainNameProps {
  domainName: string;
  tld: string;
  status: DomainNameStatus;
  purpose: DomainPurpose;
  registrantId: string;
  adminContactId: string | undefined;
  techContactId: string | undefined;
  registrarName: string;
  registrarIanaId: string | undefined;
  registrationDate: Date;
  expirationDate: Date;
  autoRenew: boolean;
  privacyEnabled: boolean;
  locked: boolean;
  dnssecEnabled: boolean;
  linkedTrademarkId: string | undefined;
  defensiveNotes: string | undefined;
  nameservers: string[];
}

export interface CreateDomainNameInput {
  domainName: string;
  registrantId: string;
  registrarName: string;
  registrationDate: Date;
  expirationDate: Date;
  purpose?: DomainPurpose | undefined;
  adminContactId?: string | undefined;
  techContactId?: string | undefined;
  registrarIanaId?: string | undefined;
  autoRenew?: boolean | undefined;
  privacyEnabled?: boolean | undefined;
  locked?: boolean | undefined;
  dnssecEnabled?: boolean | undefined;
  linkedTrademarkId?: string | undefined;
  defensiveNotes?: string | undefined;
  nameservers?: string[] | undefined;
}

export class DomainName extends AggregateRoot {
  private props: DomainNameProps;

  private constructor(id: string | undefined, props: DomainNameProps) {
    super(id);
    this.props = props;
  }

  public static create(input: CreateDomainNameInput): DomainName {
    const tld = DomainName.extractTld(input.domainName);

    const props: DomainNameProps = {
      domainName: input.domainName.toLowerCase(),
      tld,
      status: 'active',
      purpose: input.purpose ?? 'primary',
      registrantId: input.registrantId,
      adminContactId: input.adminContactId,
      techContactId: input.techContactId,
      registrarName: input.registrarName,
      registrarIanaId: input.registrarIanaId,
      registrationDate: input.registrationDate,
      expirationDate: input.expirationDate,
      autoRenew: input.autoRenew ?? true,
      privacyEnabled: input.privacyEnabled ?? true,
      locked: input.locked ?? true,
      dnssecEnabled: input.dnssecEnabled ?? false,
      linkedTrademarkId: input.linkedTrademarkId,
      defensiveNotes: input.defensiveNotes,
      nameservers: input.nameservers ?? [],
    };

    const domain = new DomainName(undefined, props);

    domain.addDomainEvent(new DomainNameRegisteredEvent(domain.id, {
      domainName: props.domainName,
      tld: props.tld,
      registrantId: props.registrantId,
      registrarName: props.registrarName,
      expirationDate: props.expirationDate,
      purpose: props.purpose,
    }));

    return domain;
  }

  public static reconstitute(id: string, props: DomainNameProps): DomainName {
    return new DomainName(id, props);
  }

  private static extractTld(domainName: string): string {
    const parts = domainName.split('.');
    if (parts.length < 2) {
      throw new Error('Invalid domain name format');
    }
    // Handle multi-part TLDs like .co.uk, .com.br
    const secondToLast = parts[parts.length - 2];
    if (parts.length >= 3 && secondToLast && secondToLast.length <= 3) {
      return `.${parts.slice(-2).join('.')}`;
    }
    return `.${parts[parts.length - 1]}`;
  }

  // Getters
  get domainName(): string { return this.props.domainName; }
  get tld(): string { return this.props.tld; }
  get status(): DomainNameStatus { return this.props.status; }
  get purpose(): DomainPurpose { return this.props.purpose; }
  get registrantId(): string { return this.props.registrantId; }
  get adminContactId(): string | undefined { return this.props.adminContactId; }
  get techContactId(): string | undefined { return this.props.techContactId; }
  get registrarName(): string { return this.props.registrarName; }
  get registrarIanaId(): string | undefined { return this.props.registrarIanaId; }
  get registrationDate(): Date { return this.props.registrationDate; }
  get expirationDate(): Date { return this.props.expirationDate; }
  get autoRenew(): boolean { return this.props.autoRenew; }
  get privacyEnabled(): boolean { return this.props.privacyEnabled; }
  get locked(): boolean { return this.props.locked; }
  get dnssecEnabled(): boolean { return this.props.dnssecEnabled; }
  get linkedTrademarkId(): string | undefined { return this.props.linkedTrademarkId; }
  get defensiveNotes(): string | undefined { return this.props.defensiveNotes; }
  get nameservers(): string[] { return [...this.props.nameservers]; }

  // Computed properties
  get isExpired(): boolean {
    return this.props.status === 'expired' || this.props.expirationDate < new Date();
  }

  get isDefensiveRegistration(): boolean {
    return this.props.purpose === 'defensive' || this.props.linkedTrademarkId !== undefined;
  }

  get daysUntilExpiration(): number {
    const now = new Date();
    const diffTime = this.props.expirationDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Domain operations
  public renew(newExpirationDate: Date, userId?: string): void {
    if (this.props.status === 'deleted') {
      throw new Error('Cannot renew deleted domain');
    }

    const previousExpiration = this.props.expirationDate;
    this.props.expirationDate = newExpirationDate;
    if (this.props.status === 'expired' || this.props.status === 'redemption') {
      this.props.status = 'active';
    }
    this.touch(userId);

    this.addDomainEvent(new DomainNameRenewedEvent(this.id, {
      domainName: this.props.domainName,
      previousExpiration,
      newExpiration: newExpirationDate,
    }));
  }

  public initiateTransfer(newRegistrarName: string, userId?: string): void {
    if (this.props.status !== 'active') {
      throw new Error('Can only transfer active domains');
    }
    if (this.props.locked) {
      throw new Error('Domain must be unlocked before transfer');
    }

    const previousRegistrar = this.props.registrarName;
    this.props.status = 'pending_transfer';
    this.props.registrarName = newRegistrarName;
    this.touch(userId);

    this.addDomainEvent(new DomainNameTransferInitiatedEvent(this.id, {
      domainName: this.props.domainName,
      fromRegistrar: previousRegistrar,
      toRegistrar: newRegistrarName,
    }));
  }

  public completeTransfer(registrarIanaId?: string, userId?: string): void {
    if (this.props.status !== 'pending_transfer') {
      throw new Error('Domain is not pending transfer');
    }

    this.props.status = 'active';
    if (registrarIanaId) {
      this.props.registrarIanaId = registrarIanaId;
    }
    this.touch(userId);
  }

  public cancelTransfer(userId?: string): void {
    if (this.props.status !== 'pending_transfer') {
      throw new Error('Domain is not pending transfer');
    }
    this.props.status = 'active';
    this.touch(userId);
  }

  public linkToTrademark(trademarkId: string, notes?: string, userId?: string): void {
    this.props.linkedTrademarkId = trademarkId;
    if (notes) {
      this.props.defensiveNotes = notes;
    }
    if (this.props.purpose === 'primary') {
      this.props.purpose = 'defensive';
    }
    this.touch(userId);

    this.addDomainEvent(new DomainNameLinkedToTrademarkEvent(this.id, {
      domainName: this.props.domainName,
      trademarkId,
    }));
  }

  public unlinkFromTrademark(userId?: string): void {
    this.props.linkedTrademarkId = undefined;
    this.props.defensiveNotes = undefined;
    this.touch(userId);
  }

  public updatePurpose(purpose: DomainPurpose, userId?: string): void {
    this.props.purpose = purpose;
    this.touch(userId);
  }

  public lock(userId?: string): void {
    this.props.locked = true;
    this.touch(userId);
  }

  public unlock(userId?: string): void {
    this.props.locked = false;
    this.touch(userId);
  }

  public setAutoRenew(autoRenew: boolean, userId?: string): void {
    this.props.autoRenew = autoRenew;
    this.touch(userId);
  }

  public enablePrivacy(userId?: string): void {
    this.props.privacyEnabled = true;
    this.touch(userId);
  }

  public disablePrivacy(userId?: string): void {
    this.props.privacyEnabled = false;
    this.touch(userId);
  }

  public enableDnssec(userId?: string): void {
    this.props.dnssecEnabled = true;
    this.touch(userId);
  }

  public disableDnssec(userId?: string): void {
    this.props.dnssecEnabled = false;
    this.touch(userId);
  }

  public updateNameservers(nameservers: string[], userId?: string): void {
    this.props.nameservers = nameservers;
    this.touch(userId);
  }

  public markExpired(userId?: string): void {
    this.props.status = 'expired';
    this.touch(userId);
  }

  public enterRedemption(userId?: string): void {
    if (this.props.status !== 'expired') {
      throw new Error('Only expired domains can enter redemption');
    }
    this.props.status = 'redemption';
    this.touch(userId);
  }

  public markDeleted(userId?: string): void {
    this.props.status = 'deleted';
    this.deletedAt = new Date();
    this.touch(userId);
  }

  public updateContacts(
    contacts: {
      adminContactId?: string | undefined;
      techContactId?: string | undefined;
    },
    userId?: string
  ): void {
    if (contacts.adminContactId !== undefined) {
      this.props.adminContactId = contacts.adminContactId;
    }
    if (contacts.techContactId !== undefined) {
      this.props.techContactId = contacts.techContactId;
    }
    this.touch(userId);
  }
}
