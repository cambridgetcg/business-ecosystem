/**
 * Standard Essential Patent (SEP) Entity
 *
 * Tracks patents declared essential to industry standards with FRAND commitments.
 * Manages standards body relationships, essentiality declarations, and licensing obligations.
 *
 * @module domain/entities
 */

import { AggregateRoot } from './base.entity.js';

/**
 * Standards bodies that patents can be declared essential to.
 */
export type StandardsBody =
  | 'ETSI'           // European Telecommunications Standards Institute
  | 'IEEE'           // Institute of Electrical and Electronics Engineers
  | 'ITU'            // International Telecommunication Union
  | 'ISO'            // International Organization for Standardization
  | 'IEC'            // International Electrotechnical Commission
  | 'JEDEC'          // JEDEC Solid State Technology Association
  | 'IETF'           // Internet Engineering Task Force
  | '3GPP'           // 3rd Generation Partnership Project
  | 'W3C'            // World Wide Web Consortium
  | 'MPEG_LA'        // MPEG Licensing Authority
  | 'HEVC_Advance'   // HEVC Advance
  | 'Other';

/**
 * Standard technology areas.
 */
export type StandardTechnology =
  | '5G'
  | '4G_LTE'
  | '3G_UMTS'
  | 'WiFi'
  | 'Bluetooth'
  | 'HEVC_H265'
  | 'AVC_H264'
  | 'VVC_H266'
  | 'USB'
  | 'HDMI'
  | 'NFC'
  | 'MPEG_Audio'
  | 'MPEG_Video'
  | 'Other';

/**
 * FRAND commitment status.
 */
export type FRANDStatus =
  | 'committed'           // FRAND terms offered
  | 'royalty_free'        // RF commitment (common in some SDOs)
  | 'no_commitment'       // No licensing commitment
  | 'withdrawn'           // Commitment withdrawn
  | 'disputed'            // Commitment under dispute
  | 'unknown';

/**
 * Essentiality status.
 */
export type EssentialityStatus =
  | 'declared_essential'  // Declared by patent holder
  | 'confirmed_essential' // Independently verified
  | 'potentially_essential'
  | 'non_essential'       // Determined not essential
  | 'disputed'            // Essentiality under challenge
  | 'expired';            // Patent expired

/**
 * Declaration to a standards body.
 */
export interface EssentialityDeclaration {
  id: string;
  standardsBody: StandardsBody;
  standard: string;                    // e.g., "IEEE 802.11ax", "3GPP TS 38.331"
  standardVersion?: string;
  technology: StandardTechnology;
  declarationDate: Date;
  declarant: string;                   // Who made the declaration
  declarationType: 'blanket' | 'specific' | 'voluntary';
  frandCommitment: FRANDStatus;
  essentialityStatus: EssentialityStatus;
  essentialClaims?: number[];          // Specific claims declared essential
  essentialityEvidence?: string;       // Reference to claim charts, etc.
  thirdPartyValidation?: {
    validator: string;
    validationDate: Date;
    result: 'essential' | 'not_essential' | 'inconclusive';
    report?: string;
  };
  notes?: string;
}

/**
 * Licensing pool membership.
 */
export interface PoolMembership {
  id: string;
  poolName: string;                    // e.g., "MPEG LA AVC/H.264", "Via Licensing WiFi"
  poolAdministrator: string;
  joinDate: Date;
  exitDate?: Date;
  status: 'active' | 'inactive' | 'pending';
  royaltyRate?: {
    rate: number;
    basis: 'per_unit' | 'percentage' | 'lump_sum';
    currency: string;
    cap?: number;
  };
  contributionShare?: number;          // Percentage of pool royalties
  licensedTerritories: string[];
}

/**
 * Government or regulatory use rights.
 */
export interface GovernmentUseRight {
  id: string;
  governmentEntity: string;
  country: string;
  grantDate: Date;
  expirationDate?: Date;
  scope: 'defense' | 'health_emergency' | 'general_government' | 'compulsory_license';
  compensation?: {
    amount: number;
    currency: string;
    basis: string;
  };
  legalBasis: string;                  // e.g., "28 USC 1498", "TRIPS Art. 31"
  notes?: string;
}

/**
 * SEP properties.
 */
export interface SEPProps {
  id: string;
  patentId: string;                    // Reference to base patent
  patentNumber: string;
  patentTitle: string;
  declarations: EssentialityDeclaration[];
  poolMemberships: PoolMembership[];
  governmentUseRights: GovernmentUseRight[];
  primaryStandard?: string;
  primaryTechnology?: StandardTechnology;
  overallFRANDStatus: FRANDStatus;
  overallEssentialityStatus: EssentialityStatus;
  licensingTerms?: {
    publishedRate?: number;
    rateBasis?: string;
    licensingGuide?: string;
    availableLicenses: ('device' | 'component' | 'access_level')[];
  };
  disputeHistory: Array<{
    id: string;
    counterparty: string;
    disputeType: 'essentiality' | 'frand_rate' | 'injunction' | 'hold_up' | 'hold_out';
    status: 'pending' | 'settled' | 'adjudicated';
    outcome?: string;
    startDate: Date;
    endDate?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Create SEP input.
 */
export interface CreateSEPInput {
  patentId: string;
  patentNumber: string;
  patentTitle: string;
  primaryStandard?: string;
  primaryTechnology?: StandardTechnology;
}

/**
 * Standard Essential Patent Aggregate
 *
 * Manages patents essential to industry standards.
 */
export class StandardEssentialPatent extends AggregateRoot {
  private props: SEPProps;

  private constructor(id: string | undefined, props: SEPProps) {
    super(id);
    this.props = props;
  }

  /**
   * Create a new SEP record.
   */
  static create(input: CreateSEPInput): StandardEssentialPatent {
    const now = new Date();

    const props: SEPProps = {
      id: '', // Will be set by parent
      patentId: input.patentId,
      patentNumber: input.patentNumber,
      patentTitle: input.patentTitle,
      declarations: [],
      poolMemberships: [],
      governmentUseRights: [],
      primaryStandard: input.primaryStandard,
      primaryTechnology: input.primaryTechnology,
      overallFRANDStatus: 'unknown',
      overallEssentialityStatus: 'declared_essential',
      disputeHistory: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const sep = new StandardEssentialPatent(undefined, props);
    // Sync the id from parent
    sep.props.id = sep.id;

    sep.addDomainEvent({
      type: 'SEP.Created',
      aggregateId: sep.id,
      occurredAt: now,
      payload: {
        patentId: input.patentId,
        patentNumber: input.patentNumber,
        primaryStandard: input.primaryStandard,
        primaryTechnology: input.primaryTechnology,
      },
    });

    return sep;
  }

  /**
   * Reconstitute from persistence.
   */
  static fromPersistence(props: SEPProps): StandardEssentialPatent {
    return new StandardEssentialPatent(props.id, props);
  }

  // =========================================================================
  // Getters
  // =========================================================================

  get patentId(): string { return this.props.patentId; }
  get patentNumber(): string { return this.props.patentNumber; }
  get patentTitle(): string { return this.props.patentTitle; }
  get declarations(): EssentialityDeclaration[] { return [...this.props.declarations]; }
  get poolMemberships(): PoolMembership[] { return [...this.props.poolMemberships]; }
  get governmentUseRights(): GovernmentUseRight[] { return [...this.props.governmentUseRights]; }
  get primaryStandard(): string | undefined { return this.props.primaryStandard; }
  get primaryTechnology(): StandardTechnology | undefined { return this.props.primaryTechnology; }
  get overallFRANDStatus(): FRANDStatus { return this.props.overallFRANDStatus; }
  get overallEssentialityStatus(): EssentialityStatus { return this.props.overallEssentialityStatus; }
  get licensingTerms() { return this.props.licensingTerms; }
  get disputeHistory() { return [...this.props.disputeHistory]; }
  get hasFRANDCommitment(): boolean { return this.props.overallFRANDStatus === 'committed'; }
  get isRoyaltyFree(): boolean { return this.props.overallFRANDStatus === 'royalty_free'; }
  get isConfirmedEssential(): boolean { return this.props.overallEssentialityStatus === 'confirmed_essential'; }

  // =========================================================================
  // Declaration Management
  // =========================================================================

  /**
   * Add essentiality declaration.
   */
  addDeclaration(declaration: Omit<EssentialityDeclaration, 'id'>): EssentialityDeclaration {
    const newDeclaration: EssentialityDeclaration = {
      ...declaration,
      id: crypto.randomUUID(),
    };

    this.props.declarations.push(newDeclaration);
    this.updateOverallStatus();
    this.touch();

    this.addDomainEvent({
      type: 'SEP.DeclarationAdded',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        declarationId: newDeclaration.id,
        standardsBody: newDeclaration.standardsBody,
        standard: newDeclaration.standard,
        frandCommitment: newDeclaration.frandCommitment,
      },
    });

    return newDeclaration;
  }

  /**
   * Update declaration status.
   */
  updateDeclarationStatus(
    declarationId: string,
    essentialityStatus: EssentialityStatus,
    validation?: EssentialityDeclaration['thirdPartyValidation']
  ): void {
    const declaration = this.props.declarations.find(d => d.id === declarationId);
    if (!declaration) {
      throw new Error(`Declaration ${declarationId} not found`);
    }

    declaration.essentialityStatus = essentialityStatus;
    if (validation) {
      declaration.thirdPartyValidation = validation;
    }

    this.updateOverallStatus();
    this.touch();

    this.addDomainEvent({
      type: 'SEP.EssentialityStatusChanged',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        declarationId,
        newStatus: essentialityStatus,
        validated: !!validation,
      },
    });
  }

  /**
   * Update FRAND commitment.
   */
  updateFRANDCommitment(declarationId: string, status: FRANDStatus): void {
    const declaration = this.props.declarations.find(d => d.id === declarationId);
    if (!declaration) {
      throw new Error(`Declaration ${declarationId} not found`);
    }

    const previousStatus = declaration.frandCommitment;
    declaration.frandCommitment = status;
    this.updateOverallStatus();
    this.touch();

    this.addDomainEvent({
      type: 'SEP.FRANDStatusChanged',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        declarationId,
        previousStatus,
        newStatus: status,
      },
    });
  }

  // =========================================================================
  // Pool Membership
  // =========================================================================

  /**
   * Join a licensing pool.
   */
  joinPool(membership: Omit<PoolMembership, 'id' | 'status'>): PoolMembership {
    const newMembership: PoolMembership = {
      ...membership,
      id: crypto.randomUUID(),
      status: 'active',
    };

    this.props.poolMemberships.push(newMembership);
    this.touch();

    this.addDomainEvent({
      type: 'SEP.JoinedPool',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        poolName: newMembership.poolName,
        poolAdministrator: newMembership.poolAdministrator,
        joinDate: newMembership.joinDate.toISOString(),
      },
    });

    return newMembership;
  }

  /**
   * Exit a licensing pool.
   */
  exitPool(membershipId: string, exitDate: Date): void {
    const membership = this.props.poolMemberships.find(m => m.id === membershipId);
    if (!membership) {
      throw new Error(`Pool membership ${membershipId} not found`);
    }

    membership.exitDate = exitDate;
    membership.status = 'inactive';
    this.touch();

    this.addDomainEvent({
      type: 'SEP.ExitedPool',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        poolName: membership.poolName,
        exitDate: exitDate.toISOString(),
      },
    });
  }

  // =========================================================================
  // Government Use
  // =========================================================================

  /**
   * Record government use right.
   */
  addGovernmentUseRight(right: Omit<GovernmentUseRight, 'id'>): GovernmentUseRight {
    const newRight: GovernmentUseRight = {
      ...right,
      id: crypto.randomUUID(),
    };

    this.props.governmentUseRights.push(newRight);
    this.touch();

    this.addDomainEvent({
      type: 'SEP.GovernmentUseGranted',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        governmentEntity: newRight.governmentEntity,
        country: newRight.country,
        scope: newRight.scope,
      },
    });

    return newRight;
  }

  // =========================================================================
  // Disputes
  // =========================================================================

  /**
   * Record a dispute.
   */
  addDispute(dispute: {
    counterparty: string;
    disputeType: 'essentiality' | 'frand_rate' | 'injunction' | 'hold_up' | 'hold_out';
    startDate: Date;
  }): void {
    this.props.disputeHistory.push({
      id: crypto.randomUUID(),
      ...dispute,
      status: 'pending',
    });
    this.touch();

    this.addDomainEvent({
      type: 'SEP.DisputeFiled',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        counterparty: dispute.counterparty,
        disputeType: dispute.disputeType,
      },
    });
  }

  /**
   * Resolve a dispute.
   */
  resolveDispute(disputeId: string, outcome: string, endDate: Date): void {
    const dispute = this.props.disputeHistory.find(d => d.id === disputeId);
    if (!dispute) {
      throw new Error(`Dispute ${disputeId} not found`);
    }

    dispute.status = 'settled';
    dispute.outcome = outcome;
    dispute.endDate = endDate;
    this.touch();
  }

  // =========================================================================
  // Licensing Terms
  // =========================================================================

  /**
   * Set published licensing terms.
   */
  setLicensingTerms(terms: NonNullable<SEPProps['licensingTerms']>): void {
    this.props.licensingTerms = terms;
    this.touch();

    this.addDomainEvent({
      type: 'SEP.LicensingTermsPublished',
      aggregateId: this.props.id,
      occurredAt: new Date(),
      payload: {
        publishedRate: terms.publishedRate,
        rateBasis: terms.rateBasis,
        availableLicenses: terms.availableLicenses,
      },
    });
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private updateOverallStatus(): void {
    // Update overall FRAND status
    if (this.props.declarations.some(d => d.frandCommitment === 'committed')) {
      this.props.overallFRANDStatus = 'committed';
    } else if (this.props.declarations.some(d => d.frandCommitment === 'royalty_free')) {
      this.props.overallFRANDStatus = 'royalty_free';
    } else if (this.props.declarations.some(d => d.frandCommitment === 'disputed')) {
      this.props.overallFRANDStatus = 'disputed';
    } else if (this.props.declarations.length === 0) {
      this.props.overallFRANDStatus = 'unknown';
    } else {
      this.props.overallFRANDStatus = 'no_commitment';
    }

    // Update overall essentiality status
    if (this.props.declarations.some(d => d.essentialityStatus === 'confirmed_essential')) {
      this.props.overallEssentialityStatus = 'confirmed_essential';
    } else if (this.props.declarations.some(d => d.essentialityStatus === 'disputed')) {
      this.props.overallEssentialityStatus = 'disputed';
    } else if (this.props.declarations.some(d => d.essentialityStatus === 'declared_essential')) {
      this.props.overallEssentialityStatus = 'declared_essential';
    } else if (this.props.declarations.some(d => d.essentialityStatus === 'non_essential')) {
      this.props.overallEssentialityStatus = 'non_essential';
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.props.version++;
  }

  /**
   * Convert to persistence format.
   */
  toPersistence(): SEPProps {
    return { ...this.props };
  }
}
