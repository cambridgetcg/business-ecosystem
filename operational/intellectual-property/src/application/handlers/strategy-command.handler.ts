/**
 * Strategy Command Handler
 *
 * CQRS command handler for IP strategy operations:
 * - IP Valuations
 * - FTO Analyses
 * - Due Diligence Reports
 *
 * @module application/handlers
 */

import type {
  IPValuationRepository,
  FTOAnalysisRepository,
  DueDiligenceRepository,
} from '../../infrastructure/persistence/strategy.repository.js';
import { IPValuation } from '../../domain/entities/ip-valuation.entity.js';
import { FTOAnalysis } from '../../domain/entities/fto-analysis.entity.js';
import { DueDiligenceReport } from '../../domain/entities/due-diligence-report.entity.js';
import type {
  CreateValuationCommand,
  UpdateValuationCommand,
  CompleteValuationCommand,
  SubmitValuationForApprovalCommand,
  ApproveValuationCommand,
  RejectValuationCommand,
  ArchiveValuationCommand,
  CreateFTOAnalysisCommand,
  UpdateFTOAnalysisCommand,
  AddFTOFindingCommand,
  UpdateFTOFindingCommand,
  CompleteFTOAnalysisCommand,
  CreateDueDiligenceCommand,
  UpdateDueDiligenceCommand,
  AddDDFindingCommand,
  UpdateDDFindingCommand,
  CompleteDueDiligenceCommand,
  HoldDueDiligenceCommand,
  CancelDueDiligenceCommand,
} from '../commands/strategy.commands.js';
import { strategyEventHandler } from './strategy-event.handler.js';

export interface EventPublisher {
  publish(eventType: string, aggregateId: string, payload: Record<string, unknown>): Promise<void>;
}

export class StrategyCommandHandler {
  constructor(
    private readonly valuationRepo: IPValuationRepository,
    private readonly ftoRepo: FTOAnalysisRepository,
    private readonly ddRepo: DueDiligenceRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  // =========================================================================
  // Valuation Commands
  // =========================================================================

  async createValuation(command: CreateValuationCommand): Promise<IPValuation> {
    const valuation = IPValuation.create({
      name: command.name,
      purpose: command.purpose,
      methodology: command.methodology,
      valuationDate: command.valuationDate,
      ipAssets: command.ipAssets,
      assumptions: command.assumptions,
      preparedBy: command.preparedBy,
    });

    await this.valuationRepo.save(valuation);

    await strategyEventHandler.handleValuationCreated({
      valuationId: valuation.id,
      name: valuation.name,
      purpose: valuation.purpose,
      methodology: valuation.methodology,
      valuationDate: valuation.valuationDate,
      ipAssets: command.ipAssets,
      status: valuation.status,
      preparedBy: command.preparedBy,
    }, { userId: command.actorId });

    return valuation;
  }

  async updateValuation(command: UpdateValuationCommand): Promise<IPValuation> {
    const valuation = await this.valuationRepo.findById(command.valuationId);
    if (!valuation) {
      throw new Error(`Valuation not found: ${command.valuationId}`);
    }

    if (command.name) valuation.updateName(command.name);
    if (command.methodology) valuation.updateMethodology(command.methodology);
    if (command.assumptions) valuation.updateAssumptions(command.assumptions);

    await this.valuationRepo.save(valuation);
    return valuation;
  }

  async completeValuation(command: CompleteValuationCommand): Promise<IPValuation> {
    const valuation = await this.valuationRepo.findById(command.valuationId);
    if (!valuation) {
      throw new Error(`Valuation not found: ${command.valuationId}`);
    }

    valuation.complete(
      command.valuedAmount,
      command.currency,
      command.confidenceLevel,
      command.supportingAnalysis
    );

    await this.valuationRepo.save(valuation);

    await strategyEventHandler.handleValuationCompleted(
      valuation.id,
      command.valuedAmount,
      command.currency,
      command.confidenceLevel,
      valuation.methodology,
      { userId: command.actorId }
    );

    return valuation;
  }

  async submitValuationForApproval(command: SubmitValuationForApprovalCommand): Promise<IPValuation> {
    const valuation = await this.valuationRepo.findById(command.valuationId);
    if (!valuation) {
      throw new Error(`Valuation not found: ${command.valuationId}`);
    }

    valuation.submitForApproval();
    await this.valuationRepo.save(valuation);
    return valuation;
  }

  async approveValuation(command: ApproveValuationCommand): Promise<IPValuation> {
    const valuation = await this.valuationRepo.findById(command.valuationId);
    if (!valuation) {
      throw new Error(`Valuation not found: ${command.valuationId}`);
    }

    valuation.approve(command.actorId, command.comments);
    await this.valuationRepo.save(valuation);

    await strategyEventHandler.handleValuationApproved(
      valuation.id,
      command.actorId,
      new Date(),
      command.comments,
      { userId: command.actorId }
    );

    return valuation;
  }

  async rejectValuation(command: RejectValuationCommand): Promise<IPValuation> {
    const valuation = await this.valuationRepo.findById(command.valuationId);
    if (!valuation) {
      throw new Error(`Valuation not found: ${command.valuationId}`);
    }

    valuation.reject(command.actorId, command.reason);
    await this.valuationRepo.save(valuation);

    await strategyEventHandler.handleValuationRejected(
      valuation.id,
      command.actorId,
      command.reason,
      { userId: command.actorId }
    );

    return valuation;
  }

  async archiveValuation(command: ArchiveValuationCommand): Promise<void> {
    const valuation = await this.valuationRepo.findById(command.valuationId);
    if (!valuation) {
      throw new Error(`Valuation not found: ${command.valuationId}`);
    }

    valuation.archive();
    await this.valuationRepo.save(valuation);
  }

  // =========================================================================
  // FTO Commands
  // =========================================================================

  async createFTOAnalysis(command: CreateFTOAnalysisCommand): Promise<FTOAnalysis> {
    const fto = FTOAnalysis.create({
      name: command.name,
      product: command.product,
      productDescription: command.productDescription,
      jurisdiction: command.jurisdiction,
      targetLaunchDate: command.targetLaunchDate,
      analyst: command.analyst,
    });

    await this.ftoRepo.save(fto);

    await strategyEventHandler.handleFTOCreated({
      ftoId: fto.id,
      name: fto.name,
      product: fto.product,
      jurisdiction: fto.jurisdiction,
      status: fto.status,
      analysisDate: fto.createdAt,
      analyst: command.analyst,
    }, { userId: command.actorId });

    return fto;
  }

  async updateFTOAnalysis(command: UpdateFTOAnalysisCommand): Promise<FTOAnalysis> {
    const fto = await this.ftoRepo.findById(command.ftoId);
    if (!fto) {
      throw new Error(`FTO Analysis not found: ${command.ftoId}`);
    }

    if (command.name) fto.updateName(command.name);
    if (command.productDescription) fto.updateProductDescription(command.productDescription);
    if (command.jurisdiction) fto.updateJurisdiction(command.jurisdiction);
    if (command.targetLaunchDate) fto.updateTargetLaunchDate(command.targetLaunchDate);

    await this.ftoRepo.save(fto);
    return fto;
  }

  async addFTOFinding(command: AddFTOFindingCommand): Promise<FTOAnalysis> {
    const fto = await this.ftoRepo.findById(command.ftoId);
    if (!fto) {
      throw new Error(`FTO Analysis not found: ${command.ftoId}`);
    }

    const finding = fto.addFinding({
      patentNumber: command.patentNumber,
      patentTitle: command.patentTitle,
      patentHolder: command.patentHolder,
      findingType: command.findingType,
      riskLevel: command.riskLevel,
      relevantClaims: command.relevantClaims,
      analysis: command.analysis,
      recommendation: command.recommendation,
      designAroundPossible: command.designAroundPossible,
      licensingOption: command.licensingOption,
      estimatedLicenseCost: command.estimatedLicenseCost,
    });

    await this.ftoRepo.save(fto);

    await strategyEventHandler.handleFTOFindingAdded({
      ftoId: fto.id,
      findingId: finding.id,
      patentNumber: command.patentNumber,
      patentTitle: command.patentTitle,
      riskLevel: command.riskLevel,
      relevantClaims: command.relevantClaims,
      analysis: command.analysis,
      recommendation: command.recommendation,
      designAroundPossible: command.designAroundPossible,
      licensingOption: command.licensingOption,
    }, { userId: command.actorId });

    return fto;
  }

  async updateFTOFinding(command: UpdateFTOFindingCommand): Promise<FTOAnalysis> {
    const fto = await this.ftoRepo.findById(command.ftoId);
    if (!fto) {
      throw new Error(`FTO Analysis not found: ${command.ftoId}`);
    }

    fto.updateFinding(command.findingId, {
      riskLevel: command.riskLevel,
      analysis: command.analysis,
      recommendation: command.recommendation,
    });

    await this.ftoRepo.save(fto);
    return fto;
  }

  async completeFTOAnalysis(command: CompleteFTOAnalysisCommand): Promise<FTOAnalysis> {
    const fto = await this.ftoRepo.findById(command.ftoId);
    if (!fto) {
      throw new Error(`FTO Analysis not found: ${command.ftoId}`);
    }

    fto.complete(
      command.overallRiskLevel,
      command.overallRecommendation,
      command.executiveSummary
    );

    await this.ftoRepo.save(fto);

    const highRiskFindings = fto.findings.filter(
      f => f.riskLevel === 'high' || f.riskLevel === 'critical'
    ).length;

    await strategyEventHandler.handleFTOCompleted(
      fto.id,
      command.overallRiskLevel,
      fto.findings.length,
      fto.findings.reduce((sum, f) => sum + f.relevantClaims.length, 0),
      highRiskFindings,
      command.overallRecommendation,
      { userId: command.actorId }
    );

    return fto;
  }

  // =========================================================================
  // Due Diligence Commands
  // =========================================================================

  async createDueDiligence(command: CreateDueDiligenceCommand): Promise<DueDiligenceReport> {
    const report = DueDiligenceReport.create({
      name: command.name,
      type: command.ddType,
      targetEntity: command.targetEntity,
      transactionType: command.transactionType,
      transactionValue: command.transactionValue,
      leadAnalyst: command.leadAnalyst,
      dueDate: command.dueDate,
    });

    await this.ddRepo.save(report);

    await strategyEventHandler.handleDueDiligenceCreated({
      reportId: report.id,
      name: report.name,
      type: report.type,
      targetEntity: command.targetEntity,
      transactionType: command.transactionType,
      status: report.status,
      startDate: report.createdAt,
      leadAnalyst: command.leadAnalyst,
    }, { userId: command.actorId });

    return report;
  }

  async updateDueDiligence(command: UpdateDueDiligenceCommand): Promise<DueDiligenceReport> {
    const report = await this.ddRepo.findById(command.reportId);
    if (!report) {
      throw new Error(`Due Diligence Report not found: ${command.reportId}`);
    }

    if (command.name) report.updateName(command.name);
    if (command.targetEntity) report.updateTargetEntity(command.targetEntity);
    if (command.transactionValue) report.updateTransactionValue(command.transactionValue);
    if (command.dueDate) report.updateDueDate(command.dueDate);

    await this.ddRepo.save(report);
    return report;
  }

  async addDDFinding(command: AddDDFindingCommand): Promise<DueDiligenceReport> {
    const report = await this.ddRepo.findById(command.reportId);
    if (!report) {
      throw new Error(`Due Diligence Report not found: ${command.reportId}`);
    }

    const finding = report.addFinding({
      category: command.category,
      severity: command.severity,
      title: command.title,
      description: command.description,
      impact: command.impact,
      recommendation: command.recommendation,
      affectedAssets: command.affectedAssets,
    });

    await this.ddRepo.save(report);

    await strategyEventHandler.handleDDFindingAdded({
      reportId: report.id,
      findingId: finding.id,
      category: command.category,
      severity: command.severity,
      title: command.title,
      description: command.description,
      impact: command.impact,
      recommendation: command.recommendation,
      affectedAssets: command.affectedAssets,
    }, { userId: command.actorId });

    return report;
  }

  async updateDDFinding(command: UpdateDDFindingCommand): Promise<DueDiligenceReport> {
    const report = await this.ddRepo.findById(command.reportId);
    if (!report) {
      throw new Error(`Due Diligence Report not found: ${command.reportId}`);
    }

    report.updateFinding(command.findingId, {
      severity: command.severity,
      impact: command.impact,
      recommendation: command.recommendation,
    });

    await this.ddRepo.save(report);
    return report;
  }

  async completeDueDiligence(command: CompleteDueDiligenceCommand): Promise<DueDiligenceReport> {
    const report = await this.ddRepo.findById(command.reportId);
    if (!report) {
      throw new Error(`Due Diligence Report not found: ${command.reportId}`);
    }

    report.complete(
      command.overallRisk,
      command.recommendation,
      command.executiveSummary
    );

    await this.ddRepo.save(report);

    const criticalFindings = report.findings.filter(
      f => f.severity === 'critical' || f.severity === 'high'
    ).length;

    await strategyEventHandler.handleDueDiligenceCompleted(
      report.id,
      new Date(),
      command.overallRisk,
      criticalFindings,
      report.findings.length,
      command.recommendation,
      command.executiveSummary,
      { userId: command.actorId }
    );

    return report;
  }

  async holdDueDiligence(command: HoldDueDiligenceCommand): Promise<DueDiligenceReport> {
    const report = await this.ddRepo.findById(command.reportId);
    if (!report) {
      throw new Error(`Due Diligence Report not found: ${command.reportId}`);
    }

    report.hold(command.reason);
    await this.ddRepo.save(report);
    return report;
  }

  async cancelDueDiligence(command: CancelDueDiligenceCommand): Promise<DueDiligenceReport> {
    const report = await this.ddRepo.findById(command.reportId);
    if (!report) {
      throw new Error(`Due Diligence Report not found: ${command.reportId}`);
    }

    report.cancel(command.reason);
    await this.ddRepo.save(report);
    return report;
  }
}
