/**
 * FTO Analysis Entity - Freedom-to-Operate Analysis
 *
 * Tracks patent landscape analysis for product/technology launch decisions.
 * Contains findings about potential blocking patents and mitigation options.
 */

import { AggregateRoot } from './base.entity.js';
import type {
  FTOAnalysisInitiatedEvent,
  FTOAnalysisCompletedEvent,
  FTOFindingAddedEvent,
  FTORiskEscalatedEvent,
} from '../events/strategy.events.js';

export type FTOStatus =
  | 'initiated'
  | 'search_complete'
  | 'analysis_in_progress'
  | 'review'
  | 'complete'
  | 'updated'
  | 'superseded';

export type FTORiskLevel = 'clear' | 'low' | 'moderate' | 'high' | 'blocking';

export type FTOFindingType =
  | 'clear'
  | 'potential_issue'
  | 'design_around_needed'
  | 'license_required'
  | 'blocking'
  | 'expired'
  | 'narrow_claim';

export interface RecommendedAction {
  action: string;
  priority: string;
  deadline?: string;
  estimatedCost?: number;
}

export interface FTOFinding {
  id: string;
  patentNumber: string;
  patentTitle: string;
  patentHolder: string | undefined;
  patentExpiration: Date | undefined;
  jurisdiction: string;
  findingType: FTOFindingType;
  riskLevel: FTORiskLevel;
  claimsAtIssue: number[];
  analysisNotes: string;
  overlapDescription: string | undefined;
  differentiatingFeatures: string | undefined;
  designAroundOption: string | undefined;
  designAroundFeasibility: string | undefined;
  designAroundCost: number | undefined;
  licensingOption: boolean;
  estimatedLicenseCost: number | undefined;
  invalidityArguments: string | undefined;
  priorArtReferences: string[];
  recommendation: string | undefined;
}

export interface FTOAnalysisProps {
  analysisNumber: string | undefined;
  title: string;
  status: FTOStatus;
  overallRisk: FTORiskLevel | undefined;
  productName: string;
  productDescription: string;
  technicalSpecification: string | undefined;
  targetMarkets: string[];
  launchDate: Date | undefined;
  jurisdictions: string[];
  patentClassifications: string[];
  searchStrategy: string | undefined;
  initiatedDate: Date;
  searchCompletedDate: Date | undefined;
  analysisCompletedDate: Date | undefined;
  reviewCompletedDate: Date | undefined;
  patentsSearched: number;
  patentsReviewed: number;
  potentialIssuesCount: number;
  findings: FTOFinding[];
  recommendation: string | undefined;
  recommendedActions: RecommendedAction[];
  assignedTo: string;
  reviewedBy: string | undefined;
  approvedBy: string | undefined;
  outsideCounselId: string | undefined;
  outsideCounselOpinionRef: string | undefined;
}

export interface CreateFTOAnalysisInput {
  title: string;
  productName: string;
  productDescription: string;
  technicalSpecification?: string;
  targetMarkets: string[];
  launchDate?: Date;
  jurisdictions: string[];
  patentClassifications?: string[];
  searchStrategy?: string;
  assignedTo: string;
}

export class FTOAnalysis extends AggregateRoot {
  private props: FTOAnalysisProps;

  private constructor(id: string | undefined, props: FTOAnalysisProps) {
    super(id);
    this.props = props;
  }

  public static create(input: CreateFTOAnalysisInput): FTOAnalysis {
    if (input.jurisdictions.length === 0) {
      throw new Error('FTO analysis must specify at least one jurisdiction');
    }

    const props: FTOAnalysisProps = {
      analysisNumber: undefined,
      title: input.title,
      status: 'initiated',
      overallRisk: undefined,
      productName: input.productName,
      productDescription: input.productDescription,
      technicalSpecification: input.technicalSpecification,
      targetMarkets: [...input.targetMarkets],
      launchDate: input.launchDate,
      jurisdictions: [...input.jurisdictions],
      patentClassifications: input.patentClassifications ?? [],
      searchStrategy: input.searchStrategy,
      initiatedDate: new Date(),
      searchCompletedDate: undefined,
      analysisCompletedDate: undefined,
      reviewCompletedDate: undefined,
      patentsSearched: 0,
      patentsReviewed: 0,
      potentialIssuesCount: 0,
      findings: [],
      recommendation: undefined,
      recommendedActions: [],
      assignedTo: input.assignedTo,
      reviewedBy: undefined,
      approvedBy: undefined,
      outsideCounselId: undefined,
      outsideCounselOpinionRef: undefined,
    };

    const analysis = new FTOAnalysis(undefined, props);

    analysis.addDomainEvent({
      aggregateId: analysis.id,
      occurredAt: new Date(),
      type: 'FTOAnalysis.Initiated',
      payload: {
        productName: input.productName,
        jurisdictions: input.jurisdictions,
        launchDate: input.launchDate?.toISOString(),
      },
    } as FTOAnalysisInitiatedEvent);

    return analysis;
  }

  public static reconstitute(id: string, props: FTOAnalysisProps): FTOAnalysis {
    return new FTOAnalysis(id, props);
  }

  // Getters
  get analysisNumber(): string | undefined { return this.props.analysisNumber; }
  get title(): string { return this.props.title; }
  get status(): FTOStatus { return this.props.status; }
  get overallRisk(): FTORiskLevel | undefined { return this.props.overallRisk; }
  get productName(): string { return this.props.productName; }
  get productDescription(): string { return this.props.productDescription; }
  get technicalSpecification(): string | undefined { return this.props.technicalSpecification; }
  get targetMarkets(): string[] { return [...this.props.targetMarkets]; }
  get launchDate(): Date | undefined { return this.props.launchDate; }
  get jurisdictions(): string[] { return [...this.props.jurisdictions]; }
  get patentClassifications(): string[] { return [...this.props.patentClassifications]; }
  get searchStrategy(): string | undefined { return this.props.searchStrategy; }
  get initiatedDate(): Date { return this.props.initiatedDate; }
  get searchCompletedDate(): Date | undefined { return this.props.searchCompletedDate; }
  get analysisCompletedDate(): Date | undefined { return this.props.analysisCompletedDate; }
  get reviewCompletedDate(): Date | undefined { return this.props.reviewCompletedDate; }
  get patentsSearched(): number { return this.props.patentsSearched; }
  get patentsReviewed(): number { return this.props.patentsReviewed; }
  get potentialIssuesCount(): number { return this.props.potentialIssuesCount; }
  get findings(): FTOFinding[] { return [...this.props.findings]; }
  get recommendation(): string | undefined { return this.props.recommendation; }
  get recommendedActions(): RecommendedAction[] { return [...this.props.recommendedActions]; }
  get assignedTo(): string { return this.props.assignedTo; }
  get reviewedBy(): string | undefined { return this.props.reviewedBy; }
  get approvedBy(): string | undefined { return this.props.approvedBy; }
  get outsideCounselId(): string | undefined { return this.props.outsideCounselId; }
  get outsideCounselOpinionRef(): string | undefined { return this.props.outsideCounselOpinionRef; }

  // Domain operations

  /**
   * Assign analysis number
   */
  public assignNumber(analysisNumber: string, userId?: string): void {
    if (this.props.analysisNumber !== undefined) {
      throw new Error('Analysis number already assigned');
    }
    this.props.analysisNumber = analysisNumber;
    this.touch(userId);
  }

  /**
   * Update search statistics
   */
  public updateSearchStats(stats: { patentsSearched: number; patentsReviewed: number }, userId?: string): void {
    if (this.props.status !== 'initiated' && this.props.status !== 'search_complete') {
      throw new Error('Cannot update search stats after analysis phase');
    }
    this.props.patentsSearched = stats.patentsSearched;
    this.props.patentsReviewed = stats.patentsReviewed;
    this.touch(userId);
  }

  /**
   * Complete the patent search phase
   */
  public completeSearch(userId?: string): void {
    if (this.props.status !== 'initiated') {
      throw new Error('Search can only be completed from initiated status');
    }
    this.props.status = 'search_complete';
    this.props.searchCompletedDate = new Date();
    this.touch(userId);
  }

  /**
   * Start the analysis phase
   */
  public startAnalysis(userId?: string): void {
    if (this.props.status !== 'search_complete') {
      throw new Error('Analysis can only start after search is complete');
    }
    this.props.status = 'analysis_in_progress';
    this.touch(userId);
  }

  /**
   * Add a finding to the analysis
   */
  public addFinding(finding: Omit<FTOFinding, 'id'>, userId?: string): string {
    if (this.props.status !== 'analysis_in_progress') {
      throw new Error('Findings can only be added during analysis phase');
    }

    const findingId = crypto.randomUUID();
    const newFinding: FTOFinding = {
      id: findingId,
      ...finding,
    };

    this.props.findings.push(newFinding);

    if (finding.findingType !== 'clear' && finding.findingType !== 'expired') {
      this.props.potentialIssuesCount++;
    }

    this.touch(userId);

    this.addDomainEvent({
      aggregateId: this.id,
      occurredAt: new Date(),
      type: 'FTOAnalysis.FindingAdded',
      payload: {
        findingId,
        patentNumber: finding.patentNumber,
        findingType: finding.findingType,
        riskLevel: finding.riskLevel,
      },
    } as FTOFindingAddedEvent);

    // Check if we need to escalate overall risk
    this.recalculateOverallRisk(userId);

    return findingId;
  }

  /**
   * Update a finding
   */
  public updateFinding(findingId: string, updates: Partial<Omit<FTOFinding, 'id'>>, userId?: string): void {
    if (this.props.status !== 'analysis_in_progress' && this.props.status !== 'review') {
      throw new Error('Findings can only be updated during analysis or review');
    }

    const findingIndex = this.props.findings.findIndex(f => f.id === findingId);
    if (findingIndex === -1) {
      throw new Error(`Finding ${findingId} not found`);
    }

    this.props.findings[findingIndex] = {
      ...this.props.findings[findingIndex],
      ...updates,
    };

    this.recalculateOverallRisk(userId);
    this.touch(userId);
  }

  /**
   * Complete the analysis phase
   */
  public completeAnalysis(overallRisk: FTORiskLevel, recommendation: string, userId?: string): void {
    if (this.props.status !== 'analysis_in_progress') {
      throw new Error('Can only complete from analysis_in_progress status');
    }

    const previousRisk = this.props.overallRisk;
    this.props.overallRisk = overallRisk;
    this.props.recommendation = recommendation;
    this.props.status = 'review';
    this.props.analysisCompletedDate = new Date();
    this.touch(userId);

    // Check for escalation
    if (previousRisk !== undefined && this.isRiskHigher(overallRisk, previousRisk)) {
      this.addDomainEvent({
        aggregateId: this.id,
        occurredAt: new Date(),
        type: 'FTOAnalysis.RiskEscalated',
        payload: {
          productName: this.props.productName,
          previousRisk,
          newRisk: overallRisk,
          launchDate: this.props.launchDate?.toISOString(),
        },
      } as FTORiskEscalatedEvent);
    }
  }

  /**
   * Add a recommended action
   */
  public addRecommendedAction(action: RecommendedAction, userId?: string): void {
    if (this.props.status !== 'analysis_in_progress' && this.props.status !== 'review') {
      throw new Error('Actions can only be added during analysis or review');
    }
    this.props.recommendedActions.push(action);
    this.touch(userId);
  }

  /**
   * Review the analysis
   */
  public review(reviewerId: string, decision: 'return' | 'approve', userId?: string): void {
    if (this.props.status !== 'review') {
      throw new Error('Can only review from review status');
    }

    this.props.reviewedBy = reviewerId;

    if (decision === 'return') {
      this.props.status = 'analysis_in_progress';
    } else {
      this.props.status = 'complete';
      this.props.reviewCompletedDate = new Date();
      this.props.approvedBy = reviewerId;

      this.addDomainEvent({
        aggregateId: this.id,
        occurredAt: new Date(),
        type: 'FTOAnalysis.Completed',
        payload: {
          analysisNumber: this.props.analysisNumber,
          productName: this.props.productName,
          overallRisk: this.props.overallRisk,
          findingsCount: this.props.findings.length,
          potentialIssuesCount: this.props.potentialIssuesCount,
        },
      } as FTOAnalysisCompletedEvent);
    }

    this.touch(userId);
  }

  /**
   * Assign outside counsel
   */
  public assignOutsideCounsel(counselId: string, opinionRef?: string, userId?: string): void {
    this.props.outsideCounselId = counselId;
    if (opinionRef !== undefined) {
      this.props.outsideCounselOpinionRef = opinionRef;
    }
    this.touch(userId);
  }

  /**
   * Update the analysis (e.g., when new patents are published)
   */
  public markAsUpdated(reason: string, userId?: string): void {
    if (this.props.status !== 'complete') {
      throw new Error('Can only update a complete analysis');
    }
    this.props.status = 'updated';
    this.touch(userId);
  }

  /**
   * Supersede with a new analysis
   */
  public supersede(newAnalysisId: string, userId?: string): void {
    if (this.props.status !== 'complete' && this.props.status !== 'updated') {
      throw new Error('Can only supersede complete or updated analyses');
    }
    this.props.status = 'superseded';
    this.touch(userId);
  }

  // Helpers

  private recalculateOverallRisk(userId?: string): void {
    const previousRisk = this.props.overallRisk;
    let highestRisk: FTORiskLevel = 'clear';

    for (const finding of this.props.findings) {
      if (this.isRiskHigher(finding.riskLevel, highestRisk)) {
        highestRisk = finding.riskLevel;
      }
    }

    if (highestRisk !== previousRisk) {
      const oldRisk = this.props.overallRisk;
      this.props.overallRisk = highestRisk;

      if (oldRisk !== undefined && this.isRiskHigher(highestRisk, oldRisk)) {
        this.addDomainEvent({
          aggregateId: this.id,
          occurredAt: new Date(),
          type: 'FTOAnalysis.RiskEscalated',
          payload: {
            productName: this.props.productName,
            previousRisk: oldRisk,
            newRisk: highestRisk,
            launchDate: this.props.launchDate?.toISOString(),
          },
        } as FTORiskEscalatedEvent);
      }
    }
  }

  private isRiskHigher(risk1: FTORiskLevel, risk2: FTORiskLevel): boolean {
    const riskOrder: Record<FTORiskLevel, number> = {
      clear: 0,
      low: 1,
      moderate: 2,
      high: 3,
      blocking: 4,
    };
    return riskOrder[risk1] > riskOrder[risk2];
  }

  /**
   * Get findings by risk level
   */
  public getFindingsByRisk(riskLevel: FTORiskLevel): FTOFinding[] {
    return this.props.findings.filter(f => f.riskLevel === riskLevel);
  }

  /**
   * Get blocking findings
   */
  public getBlockingFindings(): FTOFinding[] {
    return this.props.findings.filter(f => f.findingType === 'blocking');
  }

  /**
   * Check if launch is at risk
   */
  public isLaunchAtRisk(): boolean {
    return this.props.overallRisk === 'high' || this.props.overallRisk === 'blocking';
  }
}
