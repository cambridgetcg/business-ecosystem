/**
 * Due Diligence Report Entity - IP Portfolio Assessment for M&A
 *
 * Tracks comprehensive IP due diligence for transactions including
 * acquisitions, divestitures, licensing, and financing.
 */

import { AggregateRoot } from './base.entity.js';
import type {
  DDReportInitiatedEvent,
  DDReportCompletedEvent,
  DDFindingAddedEvent,
  DDDealBreakerIdentifiedEvent,
} from '../events/strategy.events.js';

export type DDType =
  | 'acquisition'
  | 'divestiture'
  | 'licensing_in'
  | 'licensing_out'
  | 'investment'
  | 'joint_venture'
  | 'ipo'
  | 'financing';

export type DDStatus =
  | 'initiated'
  | 'document_review'
  | 'analysis'
  | 'findings_review'
  | 'complete'
  | 'terminated';

export type DDFindingSeverity = 'critical' | 'major' | 'moderate' | 'minor' | 'informational';

export interface MaterialReviewed {
  category: string;
  documentName: string;
  receivedDate: string;
  reviewer: string;
}

export interface MitigationOption {
  option: string;
  cost?: number;
  timeframe?: string;
  feasibility: string;
}

export interface DDFinding {
  id: string;
  category: string;
  severity: DDFindingSeverity;
  title: string;
  description: string;
  affectedAssets: Array<{ type: string; id: string; name: string }>;
  financialImpact: number | undefined;
  impactDescription: string | undefined;
  mitigationOptions: MitigationOption[];
  recommendedAction: string | undefined;
  suggestedRepresentations: string | undefined;
  suggestedIndemnities: string | undefined;
  escrowRecommendation: string | undefined;
  priceAdjustmentRecommendation: number | undefined;
  resolved: boolean;
  resolutionNotes: string | undefined;
}

export interface DueDiligenceReportProps {
  reportNumber: string | undefined;
  title: string;
  status: DDStatus;
  ddType: DDType;
  targetEntityName: string;
  targetEntityId: string | undefined;
  transactionValue: number | undefined;
  transactionCurrency: string;
  initiatedDate: Date;
  documentRequestDate: Date | undefined;
  documentsReceivedDate: Date | undefined;
  analysisStartDate: Date | undefined;
  draftReportDate: Date | undefined;
  finalReportDate: Date | undefined;
  dealCloseDate: Date | undefined;
  ipTypesInScope: string[];
  jurisdictionsInScope: string[];
  materialsReviewed: MaterialReviewed[];
  patentCount: number;
  trademarkCount: number;
  copyrightCount: number;
  tradeSecretCount: number;
  licenseCount: number;
  statedPortfolioValue: number | undefined;
  assessedPortfolioValue: number | undefined;
  valuationGapNotes: string | undefined;
  findings: DDFinding[];
  overallRiskRating: DDFindingSeverity | undefined;
  executiveSummary: string | undefined;
  keyFindings: string | undefined;
  recommendations: string | undefined;
  dealBreakerIssues: string[];
  leadAnalyst: string;
  teamMembers: string[];
  outsideCounselId: string | undefined;
  reviewedBy: string | undefined;
  approvedBy: string | undefined;
  approvedDate: Date | undefined;
}

export interface CreateDueDiligenceReportInput {
  title: string;
  ddType: DDType;
  targetEntityName: string;
  targetEntityId?: string;
  transactionValue?: number;
  transactionCurrency?: string;
  ipTypesInScope: string[];
  jurisdictionsInScope: string[];
  dealCloseDate?: Date;
  leadAnalyst: string;
  teamMembers?: string[];
}

export class DueDiligenceReport extends AggregateRoot {
  private props: DueDiligenceReportProps;

  private constructor(id: string | undefined, props: DueDiligenceReportProps) {
    super(id);
    this.props = props;
  }

  public static create(input: CreateDueDiligenceReportInput): DueDiligenceReport {
    if (input.ipTypesInScope.length === 0) {
      throw new Error('Due diligence must specify at least one IP type in scope');
    }

    const props: DueDiligenceReportProps = {
      reportNumber: undefined,
      title: input.title,
      status: 'initiated',
      ddType: input.ddType,
      targetEntityName: input.targetEntityName,
      targetEntityId: input.targetEntityId,
      transactionValue: input.transactionValue,
      transactionCurrency: input.transactionCurrency ?? 'USD',
      initiatedDate: new Date(),
      documentRequestDate: undefined,
      documentsReceivedDate: undefined,
      analysisStartDate: undefined,
      draftReportDate: undefined,
      finalReportDate: undefined,
      dealCloseDate: input.dealCloseDate,
      ipTypesInScope: [...input.ipTypesInScope],
      jurisdictionsInScope: [...input.jurisdictionsInScope],
      materialsReviewed: [],
      patentCount: 0,
      trademarkCount: 0,
      copyrightCount: 0,
      tradeSecretCount: 0,
      licenseCount: 0,
      statedPortfolioValue: undefined,
      assessedPortfolioValue: undefined,
      valuationGapNotes: undefined,
      findings: [],
      overallRiskRating: undefined,
      executiveSummary: undefined,
      keyFindings: undefined,
      recommendations: undefined,
      dealBreakerIssues: [],
      leadAnalyst: input.leadAnalyst,
      teamMembers: input.teamMembers ?? [],
      outsideCounselId: undefined,
      reviewedBy: undefined,
      approvedBy: undefined,
      approvedDate: undefined,
    };

    const report = new DueDiligenceReport(undefined, props);

    report.addDomainEvent({
      aggregateId: report.id,
      occurredAt: new Date(),
      type: 'DDReport.Initiated',
      payload: {
        targetEntityName: input.targetEntityName,
        ddType: input.ddType,
        transactionValue: input.transactionValue,
        dealCloseDate: input.dealCloseDate?.toISOString(),
      },
    } as DDReportInitiatedEvent);

    return report;
  }

  public static reconstitute(id: string, props: DueDiligenceReportProps): DueDiligenceReport {
    return new DueDiligenceReport(id, props);
  }

  // Getters
  get reportNumber(): string | undefined { return this.props.reportNumber; }
  get title(): string { return this.props.title; }
  get status(): DDStatus { return this.props.status; }
  get ddType(): DDType { return this.props.ddType; }
  get targetEntityName(): string { return this.props.targetEntityName; }
  get targetEntityId(): string | undefined { return this.props.targetEntityId; }
  get transactionValue(): number | undefined { return this.props.transactionValue; }
  get transactionCurrency(): string { return this.props.transactionCurrency; }
  get initiatedDate(): Date { return this.props.initiatedDate; }
  get documentRequestDate(): Date | undefined { return this.props.documentRequestDate; }
  get documentsReceivedDate(): Date | undefined { return this.props.documentsReceivedDate; }
  get analysisStartDate(): Date | undefined { return this.props.analysisStartDate; }
  get draftReportDate(): Date | undefined { return this.props.draftReportDate; }
  get finalReportDate(): Date | undefined { return this.props.finalReportDate; }
  get dealCloseDate(): Date | undefined { return this.props.dealCloseDate; }
  get ipTypesInScope(): string[] { return [...this.props.ipTypesInScope]; }
  get jurisdictionsInScope(): string[] { return [...this.props.jurisdictionsInScope]; }
  get materialsReviewed(): MaterialReviewed[] { return [...this.props.materialsReviewed]; }
  get patentCount(): number { return this.props.patentCount; }
  get trademarkCount(): number { return this.props.trademarkCount; }
  get copyrightCount(): number { return this.props.copyrightCount; }
  get tradeSecretCount(): number { return this.props.tradeSecretCount; }
  get licenseCount(): number { return this.props.licenseCount; }
  get statedPortfolioValue(): number | undefined { return this.props.statedPortfolioValue; }
  get assessedPortfolioValue(): number | undefined { return this.props.assessedPortfolioValue; }
  get valuationGapNotes(): string | undefined { return this.props.valuationGapNotes; }
  get findings(): DDFinding[] { return [...this.props.findings]; }
  get overallRiskRating(): DDFindingSeverity | undefined { return this.props.overallRiskRating; }
  get executiveSummary(): string | undefined { return this.props.executiveSummary; }
  get keyFindings(): string | undefined { return this.props.keyFindings; }
  get recommendations(): string | undefined { return this.props.recommendations; }
  get dealBreakerIssues(): string[] { return [...this.props.dealBreakerIssues]; }
  get leadAnalyst(): string { return this.props.leadAnalyst; }
  get teamMembers(): string[] { return [...this.props.teamMembers]; }
  get outsideCounselId(): string | undefined { return this.props.outsideCounselId; }
  get reviewedBy(): string | undefined { return this.props.reviewedBy; }
  get approvedBy(): string | undefined { return this.props.approvedBy; }
  get approvedDate(): Date | undefined { return this.props.approvedDate; }

  // Domain operations

  /**
   * Assign report number
   */
  public assignNumber(reportNumber: string, userId?: string): void {
    if (this.props.reportNumber !== undefined) {
      throw new Error('Report number already assigned');
    }
    this.props.reportNumber = reportNumber;
    this.touch(userId);
  }

  /**
   * Send document request
   */
  public sendDocumentRequest(userId?: string): void {
    if (this.props.status !== 'initiated') {
      throw new Error('Can only send document request from initiated status');
    }
    this.props.documentRequestDate = new Date();
    this.touch(userId);
  }

  /**
   * Record documents received and start document review
   */
  public documentsReceived(userId?: string): void {
    if (this.props.documentRequestDate === undefined) {
      throw new Error('Must send document request first');
    }
    this.props.documentsReceivedDate = new Date();
    this.props.status = 'document_review';
    this.touch(userId);
  }

  /**
   * Add a reviewed material
   */
  public addMaterialReviewed(material: MaterialReviewed, userId?: string): void {
    if (this.props.status !== 'document_review' && this.props.status !== 'analysis') {
      throw new Error('Can only add materials during document review or analysis');
    }
    this.props.materialsReviewed.push(material);
    this.touch(userId);
  }

  /**
   * Update portfolio counts
   */
  public updatePortfolioCounts(counts: {
    patents?: number;
    trademarks?: number;
    copyrights?: number;
    tradeSecrets?: number;
    licenses?: number;
  }, userId?: string): void {
    if (counts.patents !== undefined) this.props.patentCount = counts.patents;
    if (counts.trademarks !== undefined) this.props.trademarkCount = counts.trademarks;
    if (counts.copyrights !== undefined) this.props.copyrightCount = counts.copyrights;
    if (counts.tradeSecrets !== undefined) this.props.tradeSecretCount = counts.tradeSecrets;
    if (counts.licenses !== undefined) this.props.licenseCount = counts.licenses;
    this.touch(userId);
  }

  /**
   * Set valuation comparison
   */
  public setValuation(valuation: {
    statedValue: number;
    assessedValue: number;
    gapNotes?: string;
  }, userId?: string): void {
    this.props.statedPortfolioValue = valuation.statedValue;
    this.props.assessedPortfolioValue = valuation.assessedValue;
    if (valuation.gapNotes !== undefined) {
      this.props.valuationGapNotes = valuation.gapNotes;
    }
    this.touch(userId);
  }

  /**
   * Start analysis phase
   */
  public startAnalysis(userId?: string): void {
    if (this.props.status !== 'document_review') {
      throw new Error('Can only start analysis from document_review status');
    }
    this.props.status = 'analysis';
    this.props.analysisStartDate = new Date();
    this.touch(userId);
  }

  /**
   * Add a finding
   */
  public addFinding(finding: Omit<DDFinding, 'id' | 'resolved' | 'resolutionNotes'>, userId?: string): string {
    if (this.props.status !== 'analysis' && this.props.status !== 'findings_review') {
      throw new Error('Can only add findings during analysis or review');
    }

    const findingId = crypto.randomUUID();
    const newFinding: DDFinding = {
      id: findingId,
      ...finding,
      resolved: false,
      resolutionNotes: undefined,
    };

    this.props.findings.push(newFinding);
    this.touch(userId);

    this.addDomainEvent({
      aggregateId: this.id,
      occurredAt: new Date(),
      type: 'DDReport.FindingAdded',
      payload: {
        findingId,
        category: finding.category,
        severity: finding.severity,
        title: finding.title,
      },
    } as DDFindingAddedEvent);

    // Check if this is a critical/deal-breaker issue
    if (finding.severity === 'critical') {
      this.addDealBreaker(finding.title, userId);
    }

    // Recalculate overall risk
    this.recalculateOverallRisk();

    return findingId;
  }

  /**
   * Update a finding
   */
  public updateFinding(findingId: string, updates: Partial<Omit<DDFinding, 'id'>>, userId?: string): void {
    const findingIndex = this.props.findings.findIndex(f => f.id === findingId);
    if (findingIndex === -1) {
      throw new Error(`Finding ${findingId} not found`);
    }

    this.props.findings[findingIndex] = {
      ...this.props.findings[findingIndex],
      ...updates,
    };

    this.recalculateOverallRisk();
    this.touch(userId);
  }

  /**
   * Resolve a finding
   */
  public resolveFinding(findingId: string, resolutionNotes: string, userId?: string): void {
    const finding = this.props.findings.find(f => f.id === findingId);
    if (finding === undefined) {
      throw new Error(`Finding ${findingId} not found`);
    }

    finding.resolved = true;
    finding.resolutionNotes = resolutionNotes;
    this.recalculateOverallRisk();
    this.touch(userId);
  }

  /**
   * Add a deal-breaker issue
   */
  public addDealBreaker(issue: string, userId?: string): void {
    if (!this.props.dealBreakerIssues.includes(issue)) {
      this.props.dealBreakerIssues.push(issue);
      this.touch(userId);

      this.addDomainEvent({
        aggregateId: this.id,
        occurredAt: new Date(),
        type: 'DDReport.DealBreakerIdentified',
        payload: {
          reportNumber: this.props.reportNumber,
          targetEntityName: this.props.targetEntityName,
          issue,
          dealCloseDate: this.props.dealCloseDate?.toISOString(),
        },
      } as DDDealBreakerIdentifiedEvent);
    }
  }

  /**
   * Submit draft report for review
   */
  public submitDraftReport(summary: {
    executiveSummary: string;
    keyFindings: string;
    recommendations: string;
  }, userId?: string): void {
    if (this.props.status !== 'analysis') {
      throw new Error('Can only submit draft from analysis status');
    }

    this.props.executiveSummary = summary.executiveSummary;
    this.props.keyFindings = summary.keyFindings;
    this.props.recommendations = summary.recommendations;
    this.props.status = 'findings_review';
    this.props.draftReportDate = new Date();
    this.touch(userId);
  }

  /**
   * Review the report
   */
  public review(reviewerId: string, decision: 'return' | 'approve', userId?: string): void {
    if (this.props.status !== 'findings_review') {
      throw new Error('Can only review from findings_review status');
    }

    this.props.reviewedBy = reviewerId;

    if (decision === 'return') {
      this.props.status = 'analysis';
    } else {
      this.props.status = 'complete';
      this.props.finalReportDate = new Date();
      this.props.approvedBy = reviewerId;
      this.props.approvedDate = new Date();

      this.addDomainEvent({
        aggregateId: this.id,
        occurredAt: new Date(),
        type: 'DDReport.Completed',
        payload: {
          reportNumber: this.props.reportNumber,
          targetEntityName: this.props.targetEntityName,
          ddType: this.props.ddType,
          overallRiskRating: this.props.overallRiskRating,
          findingsCount: this.props.findings.length,
          dealBreakerCount: this.props.dealBreakerIssues.length,
          assessedPortfolioValue: this.props.assessedPortfolioValue,
        },
      } as DDReportCompletedEvent);
    }

    this.touch(userId);
  }

  /**
   * Terminate the due diligence
   */
  public terminate(reason: string, userId?: string): void {
    if (this.props.status === 'complete' || this.props.status === 'terminated') {
      throw new Error('Cannot terminate a completed or already terminated report');
    }
    this.props.status = 'terminated';
    this.props.recommendations = `TERMINATED: ${reason}`;
    this.touch(userId);
  }

  /**
   * Add team member
   */
  public addTeamMember(memberId: string, userId?: string): void {
    if (!this.props.teamMembers.includes(memberId)) {
      this.props.teamMembers.push(memberId);
      this.touch(userId);
    }
  }

  /**
   * Assign outside counsel
   */
  public assignOutsideCounsel(counselId: string, userId?: string): void {
    this.props.outsideCounselId = counselId;
    this.touch(userId);
  }

  // Helpers

  private recalculateOverallRisk(): void {
    const unresolvedFindings = this.props.findings.filter(f => !f.resolved);

    if (unresolvedFindings.length === 0) {
      this.props.overallRiskRating = undefined;
      return;
    }

    const severityOrder: Record<DDFindingSeverity, number> = {
      informational: 0,
      minor: 1,
      moderate: 2,
      major: 3,
      critical: 4,
    };

    let highestSeverity: DDFindingSeverity = 'informational';
    for (const finding of unresolvedFindings) {
      if (severityOrder[finding.severity] > severityOrder[highestSeverity]) {
        highestSeverity = finding.severity;
      }
    }

    this.props.overallRiskRating = highestSeverity;
  }

  /**
   * Get total IP asset count
   */
  public getTotalAssetCount(): number {
    return (
      this.props.patentCount +
      this.props.trademarkCount +
      this.props.copyrightCount +
      this.props.tradeSecretCount +
      this.props.licenseCount
    );
  }

  /**
   * Get valuation gap percentage
   */
  public getValuationGapPercentage(): number | undefined {
    if (this.props.statedPortfolioValue === undefined ||
        this.props.assessedPortfolioValue === undefined ||
        this.props.statedPortfolioValue === 0) {
      return undefined;
    }

    return (
      ((this.props.statedPortfolioValue - this.props.assessedPortfolioValue) /
       this.props.statedPortfolioValue) * 100
    );
  }

  /**
   * Get critical findings
   */
  public getCriticalFindings(): DDFinding[] {
    return this.props.findings.filter(f => f.severity === 'critical' && !f.resolved);
  }

  /**
   * Check if there are deal-breakers
   */
  public hasDealBreakers(): boolean {
    return this.props.dealBreakerIssues.length > 0;
  }

  /**
   * Get days until deal close
   */
  public getDaysUntilClose(): number | undefined {
    if (this.props.dealCloseDate === undefined) {
      return undefined;
    }
    const now = new Date();
    const diffTime = this.props.dealCloseDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
