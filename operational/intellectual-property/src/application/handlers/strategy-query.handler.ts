/**
 * Strategy Query Handler
 *
 * CQRS query handler for IP strategy queries:
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
  ValuationSearchFilters,
  FTOSearchFilters,
  DDSearchFilters,
} from '../../infrastructure/persistence/strategy.repository.js';
import type { IPValuation, ValuationStatus } from '../../domain/entities/ip-valuation.entity.js';
import type { FTOAnalysis, FTOStatus, FTORiskLevel } from '../../domain/entities/fto-analysis.entity.js';
import type { DueDiligenceReport, DDStatus } from '../../domain/entities/due-diligence-report.entity.js';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class StrategyQueryHandler {
  constructor(
    private readonly valuationRepo: IPValuationRepository,
    private readonly ftoRepo: FTOAnalysisRepository,
    private readonly ddRepo: DueDiligenceRepository
  ) {}

  // =========================================================================
  // Valuation Queries
  // =========================================================================

  async getValuationById(id: string): Promise<IPValuation | null> {
    return this.valuationRepo.findById(id);
  }

  async getValuationByNumber(valuationNumber: string): Promise<IPValuation | null> {
    return this.valuationRepo.findByNumber(valuationNumber);
  }

  async searchValuations(
    filters: ValuationSearchFilters,
    limit = 50,
    offset = 0
  ): Promise<PaginatedResult<IPValuation>> {
    const { valuations, total } = await this.valuationRepo.search(filters, limit, offset);

    return {
      data: valuations,
      total,
      limit,
      offset,
      hasMore: offset + valuations.length < total,
    };
  }

  async getValuationsByAsset(assetType: string, assetId: string): Promise<IPValuation[]> {
    return this.valuationRepo.findByAsset(assetType, assetId);
  }

  async getValuationsByStatus(status: ValuationStatus): Promise<IPValuation[]> {
    const { valuations } = await this.valuationRepo.search({ status });
    return valuations;
  }

  async getPendingApprovals(): Promise<IPValuation[]> {
    const { valuations } = await this.valuationRepo.search({ status: 'review' });
    return valuations;
  }

  // =========================================================================
  // FTO Queries
  // =========================================================================

  async getFTOById(id: string): Promise<FTOAnalysis | null> {
    return this.ftoRepo.findById(id);
  }

  async getFTOByNumber(ftoNumber: string): Promise<FTOAnalysis | null> {
    return this.ftoRepo.findByNumber(ftoNumber);
  }

  async searchFTOs(
    filters: FTOSearchFilters,
    limit = 50,
    offset = 0
  ): Promise<PaginatedResult<FTOAnalysis>> {
    const { analyses, total } = await this.ftoRepo.search(filters, limit, offset);

    return {
      data: analyses,
      total,
      limit,
      offset,
      hasMore: offset + analyses.length < total,
    };
  }

  async getFTOsByProduct(product: string): Promise<FTOAnalysis[]> {
    const { analyses } = await this.ftoRepo.search({ product });
    return analyses;
  }

  async getFTOsByRiskLevel(riskLevel: FTORiskLevel): Promise<FTOAnalysis[]> {
    const { analyses } = await this.ftoRepo.search({ overallRiskLevel: riskLevel });
    return analyses;
  }

  async getHighRiskFTOs(): Promise<FTOAnalysis[]> {
    const results = await Promise.all([
      this.ftoRepo.search({ overallRiskLevel: 'high' }),
      this.ftoRepo.search({ overallRiskLevel: 'critical' }),
    ]);

    return [...results[0].analyses, ...results[1].analyses];
  }

  async getFTOsInProgress(): Promise<FTOAnalysis[]> {
    const { analyses } = await this.ftoRepo.search({ status: 'in_progress' });
    return analyses;
  }

  // =========================================================================
  // Due Diligence Queries
  // =========================================================================

  async getDueDiligenceById(id: string): Promise<DueDiligenceReport | null> {
    return this.ddRepo.findById(id);
  }

  async getDueDiligenceByNumber(reportNumber: string): Promise<DueDiligenceReport | null> {
    return this.ddRepo.findByNumber(reportNumber);
  }

  async searchDueDiligence(
    filters: DDSearchFilters,
    limit = 50,
    offset = 0
  ): Promise<PaginatedResult<DueDiligenceReport>> {
    const { reports, total } = await this.ddRepo.search(filters, limit, offset);

    return {
      data: reports,
      total,
      limit,
      offset,
      hasMore: offset + reports.length < total,
    };
  }

  async getDueDiligenceByTarget(targetEntity: string): Promise<DueDiligenceReport[]> {
    const { reports } = await this.ddRepo.search({ targetEntity });
    return reports;
  }

  async getDueDiligenceByStatus(status: DDStatus): Promise<DueDiligenceReport[]> {
    const { reports } = await this.ddRepo.search({ status });
    return reports;
  }

  async getActiveDueDiligence(): Promise<DueDiligenceReport[]> {
    const results = await Promise.all([
      this.ddRepo.search({ status: 'initiated' }),
      this.ddRepo.search({ status: 'document_collection' }),
      this.ddRepo.search({ status: 'analysis' }),
      this.ddRepo.search({ status: 'review' }),
    ]);

    return results.flatMap(r => r.reports);
  }

  async getDueDiligenceWithCriticalFindings(): Promise<DueDiligenceReport[]> {
    const { reports } = await this.ddRepo.search({});
    return reports.filter(report =>
      report.findings.some(f => f.severity === 'critical')
    );
  }

  // =========================================================================
  // Cross-domain Statistics
  // =========================================================================

  async getStrategyStatistics(): Promise<{
    valuations: {
      total: number;
      byStatus: Record<string, number>;
      totalValue: number;
      averageValue: number;
    };
    fto: {
      total: number;
      byStatus: Record<string, number>;
      byRiskLevel: Record<string, number>;
      highRiskCount: number;
    };
    dueDiligence: {
      total: number;
      byStatus: Record<string, number>;
      criticalFindingsCount: number;
      activeCount: number;
    };
  }> {
    const [valuations, ftos, dds] = await Promise.all([
      this.valuationRepo.search({}, 10000, 0),
      this.ftoRepo.search({}, 10000, 0),
      this.ddRepo.search({}, 10000, 0),
    ]);

    // Valuation stats
    const valuationByStatus: Record<string, number> = {};
    let totalValue = 0;
    for (const v of valuations.valuations) {
      valuationByStatus[v.status] = (valuationByStatus[v.status] ?? 0) + 1;
      totalValue += v.selectedValue ?? 0;
    }

    // FTO stats
    const ftoByStatus: Record<string, number> = {};
    const ftoByRisk: Record<string, number> = {};
    let highRiskCount = 0;
    for (const f of ftos.analyses) {
      ftoByStatus[f.status] = (ftoByStatus[f.status] ?? 0) + 1;
      if (f.overallRiskLevel) {
        ftoByRisk[f.overallRiskLevel] = (ftoByRisk[f.overallRiskLevel] ?? 0) + 1;
        if (f.overallRiskLevel === 'high' || f.overallRiskLevel === 'critical') {
          highRiskCount++;
        }
      }
    }

    // DD stats
    const ddByStatus: Record<string, number> = {};
    let criticalFindingsCount = 0;
    let activeCount = 0;
    for (const d of dds.reports) {
      ddByStatus[d.status] = (ddByStatus[d.status] ?? 0) + 1;
      criticalFindingsCount += d.findings.filter(f => f.severity === 'critical').length;
      if (['initiated', 'document_collection', 'analysis', 'review'].includes(d.status)) {
        activeCount++;
      }
    }

    return {
      valuations: {
        total: valuations.total,
        byStatus: valuationByStatus,
        totalValue,
        averageValue: valuations.total > 0 ? totalValue / valuations.total : 0,
      },
      fto: {
        total: ftos.total,
        byStatus: ftoByStatus,
        byRiskLevel: ftoByRisk,
        highRiskCount,
      },
      dueDiligence: {
        total: dds.total,
        byStatus: ddByStatus,
        criticalFindingsCount,
        activeCount,
      },
    };
  }
}
