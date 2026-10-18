/**
 * Strategy Domain Repository
 *
 * Persistence layer for IP Strategy entities: Valuations, FTO Analyses, Due Diligence Reports.
 */

import { eq, and, isNull, desc, gte, lte, or, ilike, inArray, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import {
  IPValuation,
  type IPValuationProps,
  type ValuationStatus,
  type ValuationMethodology,
  type ValuationPurpose,
} from '../../domain/entities/ip-valuation.entity.js';
import {
  FTOAnalysis,
  type FTOAnalysisProps,
  type FTOStatus,
  type FTORiskLevel,
  type FTOFinding,
} from '../../domain/entities/fto-analysis.entity.js';
import {
  DueDiligenceReport,
  type DueDiligenceReportProps,
  type DDStatus,
  type DDType,
  type DDFinding,
} from '../../domain/entities/due-diligence-report.entity.js';

// ============================================================================
// IP VALUATION REPOSITORY
// ============================================================================

export interface ValuationSearchFilters {
  status?: ValuationStatus;
  purpose?: ValuationPurpose;
  methodology?: ValuationMethodology;
  preparedBy?: string;
  approvedBy?: string;
  valuationDateFrom?: Date;
  valuationDateTo?: Date;
  minValue?: number;
  maxValue?: number;
  searchTerm?: string;
}

export class IPValuationRepository {
  constructor(private db: PostgresJsDatabase<typeof schema>) {}

  async save(valuation: IPValuation): Promise<void> {
    const data = this.toRow(valuation);

    await this.db
      .insert(schema.ipValuations)
      .values(data)
      .onConflictDoUpdate({
        target: schema.ipValuations.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });
  }

  async findById(id: string): Promise<IPValuation | null> {
    const rows = await this.db
      .select()
      .from(schema.ipValuations)
      .where(and(
        eq(schema.ipValuations.id, id),
        isNull(schema.ipValuations.deletedAt)
      ));

    if (rows.length === 0) return null;
    return this.toDomain(rows[0]);
  }

  async findByNumber(valuationNumber: string): Promise<IPValuation | null> {
    const rows = await this.db
      .select()
      .from(schema.ipValuations)
      .where(and(
        eq(schema.ipValuations.valuationNumber, valuationNumber),
        isNull(schema.ipValuations.deletedAt)
      ));

    if (rows.length === 0) return null;
    return this.toDomain(rows[0]);
  }

  async search(filters: ValuationSearchFilters, limit = 50, offset = 0): Promise<{ valuations: IPValuation[]; total: number }> {
    const conditions = [isNull(schema.ipValuations.deletedAt)];

    if (filters.status !== undefined) {
      conditions.push(eq(schema.ipValuations.status, filters.status));
    }
    if (filters.purpose !== undefined) {
      conditions.push(eq(schema.ipValuations.purpose, filters.purpose));
    }
    if (filters.methodology !== undefined) {
      conditions.push(eq(schema.ipValuations.methodology, filters.methodology));
    }
    if (filters.preparedBy !== undefined) {
      conditions.push(eq(schema.ipValuations.preparedBy, filters.preparedBy));
    }
    if (filters.approvedBy !== undefined) {
      conditions.push(eq(schema.ipValuations.approvedBy, filters.approvedBy));
    }
    if (filters.valuationDateFrom !== undefined) {
      conditions.push(gte(schema.ipValuations.valuationDate, filters.valuationDateFrom.toISOString().split('T')[0]));
    }
    if (filters.valuationDateTo !== undefined) {
      conditions.push(lte(schema.ipValuations.valuationDate, filters.valuationDateTo.toISOString().split('T')[0]));
    }
    if (filters.minValue !== undefined) {
      conditions.push(gte(schema.ipValuations.selectedValue, filters.minValue));
    }
    if (filters.maxValue !== undefined) {
      conditions.push(lte(schema.ipValuations.selectedValue, filters.maxValue));
    }
    if (filters.searchTerm !== undefined) {
      conditions.push(ilike(schema.ipValuations.title, `%${filters.searchTerm}%`));
    }

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(schema.ipValuations)
        .where(and(...conditions))
        .orderBy(desc(schema.ipValuations.valuationDate))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.ipValuations)
        .where(and(...conditions)),
    ]);

    return {
      valuations: rows.map(row => this.toDomain(row)),
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async findByAsset(assetType: string, assetId: string): Promise<IPValuation[]> {
    // JSON query to find valuations containing the asset
    const rows = await this.db
      .select()
      .from(schema.ipValuations)
      .where(and(
        isNull(schema.ipValuations.deletedAt),
        sql`${schema.ipValuations.ipAssets}::jsonb @> ${JSON.stringify([{ type: assetType, id: assetId }])}::jsonb`
      ))
      .orderBy(desc(schema.ipValuations.valuationDate));

    return rows.map(row => this.toDomain(row));
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(schema.ipValuations)
      .set({ deletedAt: new Date() })
      .where(eq(schema.ipValuations.id, id));
  }

  async generateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.ipValuations)
      .where(ilike(schema.ipValuations.valuationNumber, `VAL-${year}-%`));

    const count = Number(countResult[0]?.count ?? 0) + 1;
    return `VAL-${year}-${count.toString().padStart(4, '0')}`;
  }

  private toRow(valuation: IPValuation): typeof schema.ipValuations.$inferInsert {
    return {
      id: valuation.id,
      valuationNumber: valuation.valuationNumber,
      title: valuation.title,
      status: valuation.status,
      purpose: valuation.purpose,
      methodology: valuation.methodology,
      ipAssets: valuation.ipAssets,
      valuationDate: valuation.valuationDate.toISOString().split('T')[0],
      effectiveDate: valuation.effectiveDate.toISOString().split('T')[0],
      expirationDate: valuation.expirationDate?.toISOString().split('T')[0],
      lowValue: valuation.lowValue,
      midValue: valuation.midValue,
      highValue: valuation.highValue,
      selectedValue: valuation.selectedValue,
      currency: valuation.currency,
      assumptions: valuation.assumptions,
      discountRate: valuation.discountRate,
      royaltyRate: valuation.royaltyRate,
      projectionYears: valuation.projectionYears,
      terminalGrowthRate: valuation.terminalGrowthRate,
      comparableTransactions: valuation.comparableTransactions,
      sensitivities: valuation.sensitivities,
      conclusionSummary: valuation.conclusionSummary,
      limitations: valuation.limitations,
      preparedBy: valuation.preparedBy,
      reviewedBy: valuation.reviewedBy,
      approvedBy: valuation.approvedBy,
      approvedDate: valuation.approvedDate?.toISOString().split('T')[0],
      externalAppraiser: valuation.externalAppraiser,
      appraisalReportRef: valuation.appraisalReportRef,
      createdAt: valuation.createdAt,
      updatedAt: valuation.updatedAt,
      createdBy: valuation.createdBy,
      updatedBy: valuation.updatedBy,
      version: valuation.version,
      deletedAt: valuation.deletedAt,
    };
  }

  private toDomain(row: typeof schema.ipValuations.$inferSelect): IPValuation {
    const props: IPValuationProps = {
      valuationNumber: row.valuationNumber ?? undefined,
      title: row.title,
      status: row.status,
      purpose: row.purpose,
      methodology: row.methodology,
      ipAssets: (row.ipAssets as IPValuationProps['ipAssets']) ?? [],
      valuationDate: new Date(row.valuationDate),
      effectiveDate: new Date(row.effectiveDate),
      expirationDate: row.expirationDate ? new Date(row.expirationDate) : undefined,
      lowValue: row.lowValue ?? undefined,
      midValue: row.midValue ?? undefined,
      highValue: row.highValue ?? undefined,
      selectedValue: row.selectedValue ?? undefined,
      currency: row.currency,
      assumptions: (row.assumptions as IPValuationProps['assumptions']) ?? [],
      discountRate: row.discountRate ?? undefined,
      royaltyRate: row.royaltyRate ?? undefined,
      projectionYears: row.projectionYears ?? undefined,
      terminalGrowthRate: row.terminalGrowthRate ?? undefined,
      comparableTransactions: (row.comparableTransactions as IPValuationProps['comparableTransactions']) ?? [],
      sensitivities: (row.sensitivities as IPValuationProps['sensitivities']) ?? [],
      conclusionSummary: row.conclusionSummary ?? undefined,
      limitations: row.limitations ?? undefined,
      preparedBy: row.preparedBy,
      reviewedBy: row.reviewedBy ?? undefined,
      approvedBy: row.approvedBy ?? undefined,
      approvedDate: row.approvedDate ? new Date(row.approvedDate) : undefined,
      externalAppraiser: row.externalAppraiser ?? undefined,
      appraisalReportRef: row.appraisalReportRef ?? undefined,
    };

    const valuation = IPValuation.reconstitute(row.id, props);
    (valuation as any).createdAt = row.createdAt;
    (valuation as any).updatedAt = row.updatedAt;
    (valuation as any).createdBy = row.createdBy ?? undefined;
    (valuation as any).updatedBy = row.updatedBy ?? undefined;
    (valuation as any).version = row.version;
    (valuation as any).deletedAt = row.deletedAt ?? undefined;

    return valuation;
  }
}

// ============================================================================
// FTO ANALYSIS REPOSITORY
// ============================================================================

export interface FTOSearchFilters {
  status?: FTOStatus;
  overallRisk?: FTORiskLevel;
  assignedTo?: string;
  jurisdiction?: string;
  searchTerm?: string;
  initiatedDateFrom?: Date;
  initiatedDateTo?: Date;
}

export class FTOAnalysisRepository {
  constructor(private db: PostgresJsDatabase<typeof schema>) {}

  async save(analysis: FTOAnalysis): Promise<void> {
    // Save main analysis
    const data = this.toRow(analysis);
    await this.db
      .insert(schema.ftoAnalyses)
      .values(data)
      .onConflictDoUpdate({
        target: schema.ftoAnalyses.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });

    // Sync findings
    const existingFindings = await this.db
      .select()
      .from(schema.ftoFindings)
      .where(eq(schema.ftoFindings.analysisId, analysis.id));

    const existingIds = new Set(existingFindings.map(f => f.id));
    const currentIds = new Set(analysis.findings.map(f => f.id));

    // Delete removed findings
    const toDelete = [...existingIds].filter(id => !currentIds.has(id));
    if (toDelete.length > 0) {
      await this.db
        .delete(schema.ftoFindings)
        .where(inArray(schema.ftoFindings.id, toDelete));
    }

    // Upsert current findings
    for (const finding of analysis.findings) {
      await this.db
        .insert(schema.ftoFindings)
        .values(this.findingToRow(analysis.id, finding))
        .onConflictDoUpdate({
          target: schema.ftoFindings.id,
          set: this.findingToRow(analysis.id, finding),
        });
    }
  }

  async findById(id: string): Promise<FTOAnalysis | null> {
    const rows = await this.db
      .select()
      .from(schema.ftoAnalyses)
      .where(and(
        eq(schema.ftoAnalyses.id, id),
        isNull(schema.ftoAnalyses.deletedAt)
      ));

    if (rows.length === 0) return null;

    const findings = await this.db
      .select()
      .from(schema.ftoFindings)
      .where(eq(schema.ftoFindings.analysisId, id));

    return this.toDomain(rows[0], findings);
  }

  async findByNumber(analysisNumber: string): Promise<FTOAnalysis | null> {
    const rows = await this.db
      .select()
      .from(schema.ftoAnalyses)
      .where(and(
        eq(schema.ftoAnalyses.analysisNumber, analysisNumber),
        isNull(schema.ftoAnalyses.deletedAt)
      ));

    if (rows.length === 0) return null;

    const findings = await this.db
      .select()
      .from(schema.ftoFindings)
      .where(eq(schema.ftoFindings.analysisId, rows[0].id));

    return this.toDomain(rows[0], findings);
  }

  async search(filters: FTOSearchFilters, limit = 50, offset = 0): Promise<{ analyses: FTOAnalysis[]; total: number }> {
    const conditions = [isNull(schema.ftoAnalyses.deletedAt)];

    if (filters.status !== undefined) {
      conditions.push(eq(schema.ftoAnalyses.status, filters.status));
    }
    if (filters.overallRisk !== undefined) {
      conditions.push(eq(schema.ftoAnalyses.overallRisk, filters.overallRisk));
    }
    if (filters.assignedTo !== undefined) {
      conditions.push(eq(schema.ftoAnalyses.assignedTo, filters.assignedTo));
    }
    if (filters.jurisdiction !== undefined) {
      conditions.push(sql`${schema.ftoAnalyses.jurisdictions}::jsonb ? ${filters.jurisdiction}`);
    }
    if (filters.searchTerm !== undefined) {
      conditions.push(or(
        ilike(schema.ftoAnalyses.title, `%${filters.searchTerm}%`),
        ilike(schema.ftoAnalyses.productName, `%${filters.searchTerm}%`)
      ));
    }
    if (filters.initiatedDateFrom !== undefined) {
      conditions.push(gte(schema.ftoAnalyses.initiatedDate, filters.initiatedDateFrom.toISOString().split('T')[0]));
    }
    if (filters.initiatedDateTo !== undefined) {
      conditions.push(lte(schema.ftoAnalyses.initiatedDate, filters.initiatedDateTo.toISOString().split('T')[0]));
    }

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(schema.ftoAnalyses)
        .where(and(...conditions))
        .orderBy(desc(schema.ftoAnalyses.initiatedDate))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.ftoAnalyses)
        .where(and(...conditions)),
    ]);

    // Fetch findings for each analysis
    const analyses: FTOAnalysis[] = [];
    for (const row of rows) {
      const findings = await this.db
        .select()
        .from(schema.ftoFindings)
        .where(eq(schema.ftoFindings.analysisId, row.id));
      analyses.push(this.toDomain(row, findings));
    }

    return {
      analyses,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async findAtRisk(): Promise<FTOAnalysis[]> {
    const rows = await this.db
      .select()
      .from(schema.ftoAnalyses)
      .where(and(
        isNull(schema.ftoAnalyses.deletedAt),
        inArray(schema.ftoAnalyses.overallRisk, ['high', 'blocking']),
        eq(schema.ftoAnalyses.status, 'complete')
      ))
      .orderBy(desc(schema.ftoAnalyses.initiatedDate));

    const analyses: FTOAnalysis[] = [];
    for (const row of rows) {
      const findings = await this.db
        .select()
        .from(schema.ftoFindings)
        .where(eq(schema.ftoFindings.analysisId, row.id));
      analyses.push(this.toDomain(row, findings));
    }

    return analyses;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(schema.ftoAnalyses)
      .set({ deletedAt: new Date() })
      .where(eq(schema.ftoAnalyses.id, id));
  }

  async generateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.ftoAnalyses)
      .where(ilike(schema.ftoAnalyses.analysisNumber, `FTO-${year}-%`));

    const count = Number(countResult[0]?.count ?? 0) + 1;
    return `FTO-${year}-${count.toString().padStart(4, '0')}`;
  }

  private toRow(analysis: FTOAnalysis): typeof schema.ftoAnalyses.$inferInsert {
    return {
      id: analysis.id,
      analysisNumber: analysis.analysisNumber,
      title: analysis.title,
      status: analysis.status,
      overallRisk: analysis.overallRisk,
      productName: analysis.productName,
      productDescription: analysis.productDescription,
      technicalSpecification: analysis.technicalSpecification,
      targetMarkets: analysis.targetMarkets,
      launchDate: analysis.launchDate?.toISOString().split('T')[0],
      jurisdictions: analysis.jurisdictions,
      patentClassifications: analysis.patentClassifications,
      searchStrategy: analysis.searchStrategy,
      initiatedDate: analysis.initiatedDate.toISOString().split('T')[0],
      searchCompletedDate: analysis.searchCompletedDate?.toISOString().split('T')[0],
      analysisCompletedDate: analysis.analysisCompletedDate?.toISOString().split('T')[0],
      reviewCompletedDate: analysis.reviewCompletedDate?.toISOString().split('T')[0],
      patentsSearched: analysis.patentsSearched,
      patentsReviewed: analysis.patentsReviewed,
      potentialIssuesCount: analysis.potentialIssuesCount,
      recommendation: analysis.recommendation,
      recommendedActions: analysis.recommendedActions,
      assignedTo: analysis.assignedTo,
      reviewedBy: analysis.reviewedBy,
      approvedBy: analysis.approvedBy,
      outsideCounselId: analysis.outsideCounselId,
      outsideCounselOpinionRef: analysis.outsideCounselOpinionRef,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt,
      createdBy: analysis.createdBy,
      updatedBy: analysis.updatedBy,
      version: analysis.version,
      deletedAt: analysis.deletedAt,
    };
  }

  private findingToRow(analysisId: string, finding: FTOFinding): typeof schema.ftoFindings.$inferInsert {
    return {
      id: finding.id,
      analysisId,
      patentNumber: finding.patentNumber,
      patentTitle: finding.patentTitle,
      patentHolder: finding.patentHolder,
      patentExpiration: finding.patentExpiration?.toISOString().split('T')[0],
      jurisdiction: finding.jurisdiction,
      findingType: finding.findingType,
      riskLevel: finding.riskLevel,
      claimsAtIssue: finding.claimsAtIssue,
      analysisNotes: finding.analysisNotes,
      overlapDescription: finding.overlapDescription,
      differentiatingFeatures: finding.differentiatingFeatures,
      designAroundOption: finding.designAroundOption,
      designAroundFeasibility: finding.designAroundFeasibility,
      designAroundCost: finding.designAroundCost,
      licensingOption: finding.licensingOption,
      estimatedLicenseCost: finding.estimatedLicenseCost,
      invalidityArguments: finding.invalidityArguments,
      priorArtReferences: finding.priorArtReferences,
      recommendation: finding.recommendation,
    };
  }

  private toDomain(
    row: typeof schema.ftoAnalyses.$inferSelect,
    findingRows: Array<typeof schema.ftoFindings.$inferSelect>
  ): FTOAnalysis {
    const findings: FTOFinding[] = findingRows.map(f => ({
      id: f.id,
      patentNumber: f.patentNumber,
      patentTitle: f.patentTitle,
      patentHolder: f.patentHolder ?? undefined,
      patentExpiration: f.patentExpiration ? new Date(f.patentExpiration) : undefined,
      jurisdiction: f.jurisdiction,
      findingType: f.findingType,
      riskLevel: f.riskLevel,
      claimsAtIssue: (f.claimsAtIssue as number[]) ?? [],
      analysisNotes: f.analysisNotes,
      overlapDescription: f.overlapDescription ?? undefined,
      differentiatingFeatures: f.differentiatingFeatures ?? undefined,
      designAroundOption: f.designAroundOption ?? undefined,
      designAroundFeasibility: f.designAroundFeasibility ?? undefined,
      designAroundCost: f.designAroundCost ?? undefined,
      licensingOption: f.licensingOption ?? false,
      estimatedLicenseCost: f.estimatedLicenseCost ?? undefined,
      invalidityArguments: f.invalidityArguments ?? undefined,
      priorArtReferences: (f.priorArtReferences as string[]) ?? [],
      recommendation: f.recommendation ?? undefined,
    }));

    const props: FTOAnalysisProps = {
      analysisNumber: row.analysisNumber ?? undefined,
      title: row.title,
      status: row.status,
      overallRisk: row.overallRisk ?? undefined,
      productName: row.productName,
      productDescription: row.productDescription,
      technicalSpecification: row.technicalSpecification ?? undefined,
      targetMarkets: (row.targetMarkets as string[]) ?? [],
      launchDate: row.launchDate ? new Date(row.launchDate) : undefined,
      jurisdictions: (row.jurisdictions as string[]) ?? [],
      patentClassifications: (row.patentClassifications as string[]) ?? [],
      searchStrategy: row.searchStrategy ?? undefined,
      initiatedDate: new Date(row.initiatedDate),
      searchCompletedDate: row.searchCompletedDate ? new Date(row.searchCompletedDate) : undefined,
      analysisCompletedDate: row.analysisCompletedDate ? new Date(row.analysisCompletedDate) : undefined,
      reviewCompletedDate: row.reviewCompletedDate ? new Date(row.reviewCompletedDate) : undefined,
      patentsSearched: row.patentsSearched ?? 0,
      patentsReviewed: row.patentsReviewed ?? 0,
      potentialIssuesCount: row.potentialIssuesCount ?? 0,
      findings,
      recommendation: row.recommendation ?? undefined,
      recommendedActions: (row.recommendedActions as FTOAnalysisProps['recommendedActions']) ?? [],
      assignedTo: row.assignedTo,
      reviewedBy: row.reviewedBy ?? undefined,
      approvedBy: row.approvedBy ?? undefined,
      outsideCounselId: row.outsideCounselId ?? undefined,
      outsideCounselOpinionRef: row.outsideCounselOpinionRef ?? undefined,
    };

    const analysis = FTOAnalysis.reconstitute(row.id, props);
    (analysis as any).createdAt = row.createdAt;
    (analysis as any).updatedAt = row.updatedAt;
    (analysis as any).createdBy = row.createdBy ?? undefined;
    (analysis as any).updatedBy = row.updatedBy ?? undefined;
    (analysis as any).version = row.version;
    (analysis as any).deletedAt = row.deletedAt ?? undefined;

    return analysis;
  }
}

// ============================================================================
// DUE DILIGENCE REPOSITORY
// ============================================================================

export interface DDSearchFilters {
  status?: DDStatus;
  ddType?: DDType;
  leadAnalyst?: string;
  targetEntityName?: string;
  searchTerm?: string;
  initiatedDateFrom?: Date;
  initiatedDateTo?: Date;
  hasDealBreakers?: boolean;
}

export class DueDiligenceRepository {
  constructor(private db: PostgresJsDatabase<typeof schema>) {}

  async save(report: DueDiligenceReport): Promise<void> {
    const data = this.toRow(report);
    await this.db
      .insert(schema.dueDiligenceReports)
      .values(data)
      .onConflictDoUpdate({
        target: schema.dueDiligenceReports.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });

    // Sync findings
    const existingFindings = await this.db
      .select()
      .from(schema.dueDiligenceFindings)
      .where(eq(schema.dueDiligenceFindings.reportId, report.id));

    const existingIds = new Set(existingFindings.map(f => f.id));
    const currentIds = new Set(report.findings.map(f => f.id));

    // Delete removed findings
    const toDelete = [...existingIds].filter(id => !currentIds.has(id));
    if (toDelete.length > 0) {
      await this.db
        .delete(schema.dueDiligenceFindings)
        .where(inArray(schema.dueDiligenceFindings.id, toDelete));
    }

    // Upsert current findings
    for (const finding of report.findings) {
      await this.db
        .insert(schema.dueDiligenceFindings)
        .values(this.findingToRow(report.id, finding))
        .onConflictDoUpdate({
          target: schema.dueDiligenceFindings.id,
          set: this.findingToRow(report.id, finding),
        });
    }
  }

  async findById(id: string): Promise<DueDiligenceReport | null> {
    const rows = await this.db
      .select()
      .from(schema.dueDiligenceReports)
      .where(and(
        eq(schema.dueDiligenceReports.id, id),
        isNull(schema.dueDiligenceReports.deletedAt)
      ));

    if (rows.length === 0) return null;

    const findings = await this.db
      .select()
      .from(schema.dueDiligenceFindings)
      .where(eq(schema.dueDiligenceFindings.reportId, id));

    return this.toDomain(rows[0], findings);
  }

  async findByNumber(reportNumber: string): Promise<DueDiligenceReport | null> {
    const rows = await this.db
      .select()
      .from(schema.dueDiligenceReports)
      .where(and(
        eq(schema.dueDiligenceReports.reportNumber, reportNumber),
        isNull(schema.dueDiligenceReports.deletedAt)
      ));

    if (rows.length === 0) return null;

    const findings = await this.db
      .select()
      .from(schema.dueDiligenceFindings)
      .where(eq(schema.dueDiligenceFindings.reportId, rows[0].id));

    return this.toDomain(rows[0], findings);
  }

  async search(filters: DDSearchFilters, limit = 50, offset = 0): Promise<{ reports: DueDiligenceReport[]; total: number }> {
    const conditions = [isNull(schema.dueDiligenceReports.deletedAt)];

    if (filters.status !== undefined) {
      conditions.push(eq(schema.dueDiligenceReports.status, filters.status));
    }
    if (filters.ddType !== undefined) {
      conditions.push(eq(schema.dueDiligenceReports.ddType, filters.ddType));
    }
    if (filters.leadAnalyst !== undefined) {
      conditions.push(eq(schema.dueDiligenceReports.leadAnalyst, filters.leadAnalyst));
    }
    if (filters.targetEntityName !== undefined) {
      conditions.push(ilike(schema.dueDiligenceReports.targetEntityName, `%${filters.targetEntityName}%`));
    }
    if (filters.searchTerm !== undefined) {
      conditions.push(or(
        ilike(schema.dueDiligenceReports.title, `%${filters.searchTerm}%`),
        ilike(schema.dueDiligenceReports.targetEntityName, `%${filters.searchTerm}%`)
      ));
    }
    if (filters.initiatedDateFrom !== undefined) {
      conditions.push(gte(schema.dueDiligenceReports.initiatedDate, filters.initiatedDateFrom.toISOString().split('T')[0]));
    }
    if (filters.initiatedDateTo !== undefined) {
      conditions.push(lte(schema.dueDiligenceReports.initiatedDate, filters.initiatedDateTo.toISOString().split('T')[0]));
    }
    if (filters.hasDealBreakers === true) {
      conditions.push(sql`jsonb_array_length(${schema.dueDiligenceReports.dealBreakerIssues}::jsonb) > 0`);
    }

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(schema.dueDiligenceReports)
        .where(and(...conditions))
        .orderBy(desc(schema.dueDiligenceReports.initiatedDate))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.dueDiligenceReports)
        .where(and(...conditions)),
    ]);

    const reports: DueDiligenceReport[] = [];
    for (const row of rows) {
      const findings = await this.db
        .select()
        .from(schema.dueDiligenceFindings)
        .where(eq(schema.dueDiligenceFindings.reportId, row.id));
      reports.push(this.toDomain(row, findings));
    }

    return {
      reports,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async findInProgress(): Promise<DueDiligenceReport[]> {
    const rows = await this.db
      .select()
      .from(schema.dueDiligenceReports)
      .where(and(
        isNull(schema.dueDiligenceReports.deletedAt),
        inArray(schema.dueDiligenceReports.status, ['initiated', 'document_review', 'analysis', 'findings_review'])
      ))
      .orderBy(desc(schema.dueDiligenceReports.initiatedDate));

    const reports: DueDiligenceReport[] = [];
    for (const row of rows) {
      const findings = await this.db
        .select()
        .from(schema.dueDiligenceFindings)
        .where(eq(schema.dueDiligenceFindings.reportId, row.id));
      reports.push(this.toDomain(row, findings));
    }

    return reports;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(schema.dueDiligenceReports)
      .set({ deletedAt: new Date() })
      .where(eq(schema.dueDiligenceReports.id, id));
  }

  async generateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.dueDiligenceReports)
      .where(ilike(schema.dueDiligenceReports.reportNumber, `DD-${year}-%`));

    const count = Number(countResult[0]?.count ?? 0) + 1;
    return `DD-${year}-${count.toString().padStart(4, '0')}`;
  }

  private toRow(report: DueDiligenceReport): typeof schema.dueDiligenceReports.$inferInsert {
    return {
      id: report.id,
      reportNumber: report.reportNumber,
      title: report.title,
      status: report.status,
      ddType: report.ddType,
      targetEntityName: report.targetEntityName,
      targetEntityId: report.targetEntityId,
      transactionValue: report.transactionValue,
      transactionCurrency: report.transactionCurrency,
      initiatedDate: report.initiatedDate.toISOString().split('T')[0],
      documentRequestDate: report.documentRequestDate?.toISOString().split('T')[0],
      documentsReceivedDate: report.documentsReceivedDate?.toISOString().split('T')[0],
      analysisStartDate: report.analysisStartDate?.toISOString().split('T')[0],
      draftReportDate: report.draftReportDate?.toISOString().split('T')[0],
      finalReportDate: report.finalReportDate?.toISOString().split('T')[0],
      dealCloseDate: report.dealCloseDate?.toISOString().split('T')[0],
      ipTypesInScope: report.ipTypesInScope,
      jurisdictionsInScope: report.jurisdictionsInScope,
      materialsReviewed: report.materialsReviewed,
      patentCount: report.patentCount,
      trademarkCount: report.trademarkCount,
      copyrightCount: report.copyrightCount,
      tradeSecretCount: report.tradeSecretCount,
      licenseCount: report.licenseCount,
      statedPortfolioValue: report.statedPortfolioValue,
      assessedPortfolioValue: report.assessedPortfolioValue,
      valuationGapNotes: report.valuationGapNotes,
      overallRiskRating: report.overallRiskRating,
      executiveSummary: report.executiveSummary,
      keyFindings: report.keyFindings,
      recommendations: report.recommendations,
      dealBreakerIssues: report.dealBreakerIssues,
      leadAnalyst: report.leadAnalyst,
      teamMembers: report.teamMembers,
      outsideCounselId: report.outsideCounselId,
      reviewedBy: report.reviewedBy,
      approvedBy: report.approvedBy,
      approvedDate: report.approvedDate?.toISOString().split('T')[0],
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      createdBy: report.createdBy,
      updatedBy: report.updatedBy,
      version: report.version,
      deletedAt: report.deletedAt,
    };
  }

  private findingToRow(reportId: string, finding: DDFinding): typeof schema.dueDiligenceFindings.$inferInsert {
    return {
      id: finding.id,
      reportId,
      category: finding.category,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      affectedAssets: finding.affectedAssets,
      financialImpact: finding.financialImpact,
      impactDescription: finding.impactDescription,
      mitigationOptions: finding.mitigationOptions,
      recommendedAction: finding.recommendedAction,
      suggestedRepresentations: finding.suggestedRepresentations,
      suggestedIndemnities: finding.suggestedIndemnities,
      escrowRecommendation: finding.escrowRecommendation,
      priceAdjustmentRecommendation: finding.priceAdjustmentRecommendation,
      resolved: finding.resolved,
      resolutionNotes: finding.resolutionNotes,
    };
  }

  private toDomain(
    row: typeof schema.dueDiligenceReports.$inferSelect,
    findingRows: Array<typeof schema.dueDiligenceFindings.$inferSelect>
  ): DueDiligenceReport {
    const findings: DDFinding[] = findingRows.map(f => ({
      id: f.id,
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.description,
      affectedAssets: (f.affectedAssets as DDFinding['affectedAssets']) ?? [],
      financialImpact: f.financialImpact ?? undefined,
      impactDescription: f.impactDescription ?? undefined,
      mitigationOptions: (f.mitigationOptions as DDFinding['mitigationOptions']) ?? [],
      recommendedAction: f.recommendedAction ?? undefined,
      suggestedRepresentations: f.suggestedRepresentations ?? undefined,
      suggestedIndemnities: f.suggestedIndemnities ?? undefined,
      escrowRecommendation: f.escrowRecommendation ?? undefined,
      priceAdjustmentRecommendation: f.priceAdjustmentRecommendation ?? undefined,
      resolved: f.resolved,
      resolutionNotes: f.resolutionNotes ?? undefined,
    }));

    const props: DueDiligenceReportProps = {
      reportNumber: row.reportNumber ?? undefined,
      title: row.title,
      status: row.status,
      ddType: row.ddType,
      targetEntityName: row.targetEntityName,
      targetEntityId: row.targetEntityId ?? undefined,
      transactionValue: row.transactionValue ?? undefined,
      transactionCurrency: row.transactionCurrency ?? 'USD',
      initiatedDate: new Date(row.initiatedDate),
      documentRequestDate: row.documentRequestDate ? new Date(row.documentRequestDate) : undefined,
      documentsReceivedDate: row.documentsReceivedDate ? new Date(row.documentsReceivedDate) : undefined,
      analysisStartDate: row.analysisStartDate ? new Date(row.analysisStartDate) : undefined,
      draftReportDate: row.draftReportDate ? new Date(row.draftReportDate) : undefined,
      finalReportDate: row.finalReportDate ? new Date(row.finalReportDate) : undefined,
      dealCloseDate: row.dealCloseDate ? new Date(row.dealCloseDate) : undefined,
      ipTypesInScope: (row.ipTypesInScope as string[]) ?? [],
      jurisdictionsInScope: (row.jurisdictionsInScope as string[]) ?? [],
      materialsReviewed: (row.materialsReviewed as DueDiligenceReportProps['materialsReviewed']) ?? [],
      patentCount: row.patentCount ?? 0,
      trademarkCount: row.trademarkCount ?? 0,
      copyrightCount: row.copyrightCount ?? 0,
      tradeSecretCount: row.tradeSecretCount ?? 0,
      licenseCount: row.licenseCount ?? 0,
      statedPortfolioValue: row.statedPortfolioValue ?? undefined,
      assessedPortfolioValue: row.assessedPortfolioValue ?? undefined,
      valuationGapNotes: row.valuationGapNotes ?? undefined,
      findings,
      overallRiskRating: row.overallRiskRating ?? undefined,
      executiveSummary: row.executiveSummary ?? undefined,
      keyFindings: row.keyFindings ?? undefined,
      recommendations: row.recommendations ?? undefined,
      dealBreakerIssues: (row.dealBreakerIssues as string[]) ?? [],
      leadAnalyst: row.leadAnalyst,
      teamMembers: (row.teamMembers as string[]) ?? [],
      outsideCounselId: row.outsideCounselId ?? undefined,
      reviewedBy: row.reviewedBy ?? undefined,
      approvedBy: row.approvedBy ?? undefined,
      approvedDate: row.approvedDate ? new Date(row.approvedDate) : undefined,
    };

    const report = DueDiligenceReport.reconstitute(row.id, props);
    (report as any).createdAt = row.createdAt;
    (report as any).updatedAt = row.updatedAt;
    (report as any).createdBy = row.createdBy ?? undefined;
    (report as any).updatedBy = row.updatedBy ?? undefined;
    (report as any).version = row.version;
    (report as any).deletedAt = row.deletedAt ?? undefined;

    return report;
  }
}
