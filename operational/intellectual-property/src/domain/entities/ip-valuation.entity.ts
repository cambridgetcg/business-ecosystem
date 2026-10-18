/**
 * IP Valuation Entity - Point-in-time valuation of IP assets
 *
 * Unlike IP asset entities, valuations are analysis artifacts with
 * approval workflows. They capture value at a specific moment using
 * various valuation methodologies.
 */

import { AggregateRoot } from './base.entity.js';
import type {
  IPValuationCreatedEvent,
  IPValuationSubmittedEvent,
  IPValuationApprovedEvent,
  IPValuationSupersededEvent,
} from '../events/strategy.events.js';

export type ValuationStatus = 'draft' | 'in_progress' | 'review' | 'approved' | 'superseded' | 'archived';

export type ValuationMethodology =
  | 'cost'
  | 'market'
  | 'income'
  | 'relief_from_royalty'
  | 'excess_earnings'
  | 'real_options'
  | 'monte_carlo'
  | 'comparable_transactions';

export type ValuationPurpose =
  | 'financial_reporting'
  | 'tax'
  | 'litigation'
  | 'licensing'
  | 'sale'
  | 'financing'
  | 'insurance'
  | 'internal_planning'
  | 'm_and_a';

export interface IPAssetReference {
  type: string;
  id: string;
  name: string;
  weight?: number;
}

export interface ValuationAssumption {
  category: string;
  description: string;
  value?: string;
  source?: string;
}

export interface ComparableTransaction {
  description: string;
  value: number;
  date: string;
  source: string;
  adjustmentFactor?: number;
}

export interface SensitivityAnalysis {
  variable: string;
  lowCase: number;
  baseCase: number;
  highCase: number;
}

export interface IPValuationProps {
  valuationNumber: string | undefined;
  title: string;
  status: ValuationStatus;
  purpose: ValuationPurpose;
  methodology: ValuationMethodology;
  ipAssets: IPAssetReference[];
  valuationDate: Date;
  effectiveDate: Date;
  expirationDate: Date | undefined;
  lowValue: number | undefined;
  midValue: number | undefined;
  highValue: number | undefined;
  selectedValue: number | undefined;
  currency: string;
  assumptions: ValuationAssumption[];
  discountRate: number | undefined; // basis points
  royaltyRate: number | undefined; // basis points
  projectionYears: number | undefined;
  terminalGrowthRate: number | undefined; // basis points
  comparableTransactions: ComparableTransaction[];
  sensitivities: SensitivityAnalysis[];
  conclusionSummary: string | undefined;
  limitations: string | undefined;
  preparedBy: string;
  reviewedBy: string | undefined;
  approvedBy: string | undefined;
  approvedDate: Date | undefined;
  externalAppraiser: string | undefined;
  appraisalReportRef: string | undefined;
}

export interface CreateIPValuationInput {
  title: string;
  purpose: ValuationPurpose;
  methodology: ValuationMethodology;
  ipAssets: IPAssetReference[];
  valuationDate: Date;
  effectiveDate: Date;
  currency?: string;
  preparedBy: string;
}

export class IPValuation extends AggregateRoot {
  private props: IPValuationProps;

  private constructor(id: string | undefined, props: IPValuationProps) {
    super(id);
    this.props = props;
  }

  public static create(input: CreateIPValuationInput): IPValuation {
    if (input.ipAssets.length === 0) {
      throw new Error('Valuation must include at least one IP asset');
    }

    const props: IPValuationProps = {
      valuationNumber: undefined,
      title: input.title,
      status: 'draft',
      purpose: input.purpose,
      methodology: input.methodology,
      ipAssets: [...input.ipAssets],
      valuationDate: input.valuationDate,
      effectiveDate: input.effectiveDate,
      expirationDate: undefined,
      lowValue: undefined,
      midValue: undefined,
      highValue: undefined,
      selectedValue: undefined,
      currency: input.currency ?? 'USD',
      assumptions: [],
      discountRate: undefined,
      royaltyRate: undefined,
      projectionYears: undefined,
      terminalGrowthRate: undefined,
      comparableTransactions: [],
      sensitivities: [],
      conclusionSummary: undefined,
      limitations: undefined,
      preparedBy: input.preparedBy,
      reviewedBy: undefined,
      approvedBy: undefined,
      approvedDate: undefined,
      externalAppraiser: undefined,
      appraisalReportRef: undefined,
    };

    const valuation = new IPValuation(undefined, props);

    valuation.addDomainEvent({
      aggregateId: valuation.id,
      occurredAt: new Date(),
      type: 'IPValuation.Created',
      payload: {
        title: input.title,
        purpose: input.purpose,
        methodology: input.methodology,
        assetCount: input.ipAssets.length,
      },
    } as IPValuationCreatedEvent);

    return valuation;
  }

  public static reconstitute(id: string, props: IPValuationProps): IPValuation {
    return new IPValuation(id, props);
  }

  // Getters
  get valuationNumber(): string | undefined { return this.props.valuationNumber; }
  get title(): string { return this.props.title; }
  get status(): ValuationStatus { return this.props.status; }
  get purpose(): ValuationPurpose { return this.props.purpose; }
  get methodology(): ValuationMethodology { return this.props.methodology; }
  get ipAssets(): IPAssetReference[] { return [...this.props.ipAssets]; }
  get valuationDate(): Date { return this.props.valuationDate; }
  get effectiveDate(): Date { return this.props.effectiveDate; }
  get expirationDate(): Date | undefined { return this.props.expirationDate; }
  get lowValue(): number | undefined { return this.props.lowValue; }
  get midValue(): number | undefined { return this.props.midValue; }
  get highValue(): number | undefined { return this.props.highValue; }
  get selectedValue(): number | undefined { return this.props.selectedValue; }
  get currency(): string { return this.props.currency; }
  get assumptions(): ValuationAssumption[] { return [...this.props.assumptions]; }
  get discountRate(): number | undefined { return this.props.discountRate; }
  get royaltyRate(): number | undefined { return this.props.royaltyRate; }
  get projectionYears(): number | undefined { return this.props.projectionYears; }
  get terminalGrowthRate(): number | undefined { return this.props.terminalGrowthRate; }
  get comparableTransactions(): ComparableTransaction[] { return [...this.props.comparableTransactions]; }
  get sensitivities(): SensitivityAnalysis[] { return [...this.props.sensitivities]; }
  get conclusionSummary(): string | undefined { return this.props.conclusionSummary; }
  get limitations(): string | undefined { return this.props.limitations; }
  get preparedBy(): string { return this.props.preparedBy; }
  get reviewedBy(): string | undefined { return this.props.reviewedBy; }
  get approvedBy(): string | undefined { return this.props.approvedBy; }
  get approvedDate(): Date | undefined { return this.props.approvedDate; }
  get externalAppraiser(): string | undefined { return this.props.externalAppraiser; }
  get appraisalReportRef(): string | undefined { return this.props.appraisalReportRef; }

  // Domain operations

  /**
   * Assign a valuation number (typically system-generated)
   */
  public assignNumber(valuationNumber: string, userId?: string): void {
    if (this.props.valuationNumber !== undefined) {
      throw new Error('Valuation number already assigned');
    }
    this.props.valuationNumber = valuationNumber;
    this.touch(userId);
  }

  /**
   * Add an assumption to the valuation
   */
  public addAssumption(assumption: ValuationAssumption, userId?: string): void {
    this.ensureEditable();
    this.props.assumptions.push(assumption);
    this.touch(userId);
  }

  /**
   * Set the valuation model parameters
   */
  public setModelParameters(params: {
    discountRate?: number;
    royaltyRate?: number;
    projectionYears?: number;
    terminalGrowthRate?: number;
  }, userId?: string): void {
    this.ensureEditable();

    if (params.discountRate !== undefined) {
      this.props.discountRate = params.discountRate;
    }
    if (params.royaltyRate !== undefined) {
      this.props.royaltyRate = params.royaltyRate;
    }
    if (params.projectionYears !== undefined) {
      this.props.projectionYears = params.projectionYears;
    }
    if (params.terminalGrowthRate !== undefined) {
      this.props.terminalGrowthRate = params.terminalGrowthRate;
    }

    this.touch(userId);
  }

  /**
   * Set the valuation range
   */
  public setValueRange(range: {
    lowValue: number;
    midValue: number;
    highValue: number;
    selectedValue: number;
  }, userId?: string): void {
    this.ensureEditable();

    if (range.lowValue > range.midValue || range.midValue > range.highValue) {
      throw new Error('Value range must be low <= mid <= high');
    }

    if (range.selectedValue < range.lowValue || range.selectedValue > range.highValue) {
      throw new Error('Selected value must be within the range');
    }

    this.props.lowValue = range.lowValue;
    this.props.midValue = range.midValue;
    this.props.highValue = range.highValue;
    this.props.selectedValue = range.selectedValue;
    this.touch(userId);
  }

  /**
   * Add a comparable transaction for market approach
   */
  public addComparableTransaction(transaction: ComparableTransaction, userId?: string): void {
    this.ensureEditable();
    this.props.comparableTransactions.push(transaction);
    this.touch(userId);
  }

  /**
   * Add sensitivity analysis
   */
  public addSensitivityAnalysis(sensitivity: SensitivityAnalysis, userId?: string): void {
    this.ensureEditable();
    this.props.sensitivities.push(sensitivity);
    this.touch(userId);
  }

  /**
   * Set conclusion and limitations
   */
  public setConclusion(conclusion: { summary: string; limitations?: string }, userId?: string): void {
    this.ensureEditable();
    this.props.conclusionSummary = conclusion.summary;
    if (conclusion.limitations !== undefined) {
      this.props.limitations = conclusion.limitations;
    }
    this.touch(userId);
  }

  /**
   * Start analysis work (transition from draft to in_progress)
   */
  public startAnalysis(userId?: string): void {
    if (this.props.status !== 'draft') {
      throw new Error('Can only start analysis from draft status');
    }
    this.props.status = 'in_progress';
    this.touch(userId);
  }

  /**
   * Submit for review
   */
  public submitForReview(userId?: string): void {
    if (this.props.status !== 'in_progress') {
      throw new Error('Can only submit from in_progress status');
    }

    if (this.props.selectedValue === undefined) {
      throw new Error('Must set value range before submitting for review');
    }

    this.props.status = 'review';
    this.touch(userId);

    this.addDomainEvent({
      aggregateId: this.id,
      occurredAt: new Date(),
      type: 'IPValuation.Submitted',
      payload: {
        valuationNumber: this.props.valuationNumber,
        title: this.props.title,
        selectedValue: this.props.selectedValue,
        currency: this.props.currency,
      },
    } as IPValuationSubmittedEvent);
  }

  /**
   * Review the valuation (can send back to in_progress or forward to approve)
   */
  public review(reviewerId: string, decision: 'return' | 'forward', notes?: string, userId?: string): void {
    if (this.props.status !== 'review') {
      throw new Error('Can only review from review status');
    }

    this.props.reviewedBy = reviewerId;

    if (decision === 'return') {
      this.props.status = 'in_progress';
    }
    // 'forward' stays in review status, waiting for approval

    this.touch(userId);
  }

  /**
   * Approve the valuation
   */
  public approve(approverId: string, expirationDate?: Date, userId?: string): void {
    if (this.props.status !== 'review') {
      throw new Error('Can only approve from review status');
    }

    if (this.props.reviewedBy === undefined) {
      throw new Error('Valuation must be reviewed before approval');
    }

    this.props.status = 'approved';
    this.props.approvedBy = approverId;
    this.props.approvedDate = new Date();

    if (expirationDate !== undefined) {
      this.props.expirationDate = expirationDate;
    }

    this.touch(userId);

    this.addDomainEvent({
      aggregateId: this.id,
      occurredAt: new Date(),
      type: 'IPValuation.Approved',
      payload: {
        valuationNumber: this.props.valuationNumber,
        selectedValue: this.props.selectedValue!,
        currency: this.props.currency,
        approvedBy: approverId,
      },
    } as IPValuationApprovedEvent);
  }

  /**
   * Supersede this valuation with a new one
   */
  public supersede(newValuationId: string, reason: string, userId?: string): void {
    if (this.props.status !== 'approved') {
      throw new Error('Can only supersede approved valuations');
    }

    this.props.status = 'superseded';
    this.touch(userId);

    this.addDomainEvent({
      aggregateId: this.id,
      occurredAt: new Date(),
      type: 'IPValuation.Superseded',
      payload: {
        oldValuationId: this.id,
        newValuationId,
        reason,
      },
    } as IPValuationSupersededEvent);
  }

  /**
   * Archive the valuation
   */
  public archive(userId?: string): void {
    if (this.props.status === 'draft' || this.props.status === 'in_progress') {
      throw new Error('Cannot archive incomplete valuations - consider deleting instead');
    }
    this.props.status = 'archived';
    this.touch(userId);
  }

  /**
   * Set external appraiser information
   */
  public setExternalAppraiser(appraiser: string, reportRef?: string, userId?: string): void {
    this.props.externalAppraiser = appraiser;
    if (reportRef !== undefined) {
      this.props.appraisalReportRef = reportRef;
    }
    this.touch(userId);
  }

  // Helpers

  private ensureEditable(): void {
    if (this.props.status !== 'draft' && this.props.status !== 'in_progress') {
      throw new Error('Valuation can only be modified in draft or in_progress status');
    }
  }

  /**
   * Check if the valuation has expired
   */
  public isExpired(): boolean {
    if (this.props.expirationDate === undefined) {
      return false;
    }
    return new Date() > this.props.expirationDate;
  }

  /**
   * Get value range as percentage
   */
  public getValueRangePercentage(): { lowPct: number; highPct: number } | undefined {
    if (this.props.midValue === undefined || this.props.lowValue === undefined || this.props.highValue === undefined) {
      return undefined;
    }

    return {
      lowPct: ((this.props.midValue - this.props.lowValue) / this.props.midValue) * 100,
      highPct: ((this.props.highValue - this.props.midValue) / this.props.midValue) * 100,
    };
  }
}
