/**
 * Privacy Program Metrics Service
 * Aggregates metrics across all privacy domains for program-level view
 */

import type {
  PrivacyProgramMetrics,
  ComplianceDashboard,
  DSARMetrics,
  ConsentMetrics,
  BreachMetrics,
  DPIAMetrics,
  ProcessorMetrics,
  TransferMetrics,
  ActivityMetrics,
} from '../models/privacy-metrics.js';
import {
  calculateComplianceScore,
  getComplianceLevel,
  generateActionItems,
  calculateRiskSummary,
  generateAlerts,
} from '../models/privacy-metrics.js';

// ============================================================================
// METRIC PROVIDERS INTERFACE
// ============================================================================

/**
 * Interface for services that provide metrics data.
 * Each domain service should implement the relevant method.
 */
export interface MetricProviders {
  getDSARMetrics(entityId: string, startDate: Date, endDate: Date): Promise<DSARMetrics>;
  getConsentMetrics(entityId: string, startDate: Date, endDate: Date): Promise<ConsentMetrics>;
  getBreachMetrics(entityId: string, startDate: Date, endDate: Date): Promise<BreachMetrics>;
  getDPIAMetrics(entityId: string, startDate: Date, endDate: Date): Promise<DPIAMetrics>;
  getProcessorMetrics(entityId: string): Promise<ProcessorMetrics>;
  getTransferMetrics(entityId: string): Promise<TransferMetrics>;
  getActivityMetrics(entityId: string): Promise<ActivityMetrics>;
  getTrendData(entityId: string, months: number): Promise<ComplianceDashboard['trends']>;
}

// ============================================================================
// SERVICE RESULT TYPES
// ============================================================================

export interface ServiceError {
  code: string;
  message: string;
}

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: ServiceError };

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class MetricsService {
  constructor(private providers: MetricProviders) {}

  /**
   * Generate comprehensive privacy program metrics
   */
  async generateProgramMetrics(
    entityId: string,
    period?: { start: Date; end: Date }
  ): Promise<ServiceResult<PrivacyProgramMetrics>> {
    const endDate = period?.end || new Date();
    const startDate = period?.start || new Date(endDate.getFullYear(), endDate.getMonth() - 12, 1);

    try {
      // Gather all metrics in parallel
      const [dsar, consent, breach, dpia, processors, transfers, activities] = await Promise.all([
        this.providers.getDSARMetrics(entityId, startDate, endDate),
        this.providers.getConsentMetrics(entityId, startDate, endDate),
        this.providers.getBreachMetrics(entityId, startDate, endDate),
        this.providers.getDPIAMetrics(entityId, startDate, endDate),
        this.providers.getProcessorMetrics(entityId),
        this.providers.getTransferMetrics(entityId),
        this.providers.getActivityMetrics(entityId),
      ]);

      const metrics: PrivacyProgramMetrics = {
        entityId,
        generatedAt: new Date(),
        period: { start: startDate, end: endDate },
        overallComplianceLevel: 'NOT_ASSESSED', // Will be calculated
        complianceScore: 0, // Will be calculated
        trend: 'STABLE', // Would need historical data
        dsar,
        consent,
        breach,
        dpia,
        processors,
        transfers,
        activities,
        riskSummary: { criticalItems: 0, highRiskItems: 0, mediumRiskItems: 0, lowRiskItems: 0 },
        actionItems: [],
      };

      // Calculate derived fields
      metrics.complianceScore = calculateComplianceScore(metrics);
      metrics.overallComplianceLevel = getComplianceLevel(metrics.complianceScore);
      metrics.riskSummary = calculateRiskSummary(metrics);
      metrics.actionItems = generateActionItems(metrics);

      return { success: true, data: metrics };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'METRICS_ERROR',
          message: `Failed to generate metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      };
    }
  }

  /**
   * Generate compliance dashboard
   */
  async generateDashboard(entityId: string): Promise<ServiceResult<ComplianceDashboard>> {
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 12, 1);

    try {
      const [metricsResult, trends] = await Promise.all([
        this.generateProgramMetrics(entityId, { start: startDate, end: endDate }),
        this.providers.getTrendData(entityId, 6),
      ]);

      if (!metricsResult.success) {
        return metricsResult;
      }

      const metrics = metricsResult.data;

      const dashboard: ComplianceDashboard = {
        entityId,
        generatedAt: new Date(),
        kpis: {
          dsarResponseRate: metrics.dsar.complianceRate * 100,
          consentCompliance: metrics.consent.consentRate * 100,
          breachNotificationRate: metrics.breach.notificationComplianceRate * 100,
          processorCompliance: metrics.processors.complianceRate * 100,
          transferCompliance: metrics.transfers.totalTransfers > 0
            ? (metrics.transfers.approvedTransfers / metrics.transfers.totalTransfers) * 100
            : 100,
        },
        currentStatus: {
          pendingDSARs: metrics.dsar.pendingRequests,
          overdueDSARs: metrics.dsar.overdueRequests,
          openBreaches: metrics.breach.openBreaches,
          pendingDPIAs: metrics.dpia.pendingAssessments,
          expiringDPAs: metrics.processors.dpaExpiringSoon,
          reviewDueActivities: metrics.activities.reviewDue,
        },
        trends,
        alerts: generateAlerts(metrics),
      };

      return { success: true, data: dashboard };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DASHBOARD_ERROR',
          message: `Failed to generate dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      };
    }
  }

  /**
   * Get compliance status summary (lightweight)
   */
  async getComplianceStatus(entityId: string): Promise<ServiceResult<{
    level: string;
    score: number;
    criticalIssues: number;
    lastUpdated: Date;
  }>> {
    const result = await this.generateProgramMetrics(entityId);

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: {
        level: result.data.overallComplianceLevel,
        score: result.data.complianceScore,
        criticalIssues: result.data.riskSummary.criticalItems,
        lastUpdated: result.data.generatedAt,
      },
    };
  }

  /**
   * Get priority action items
   */
  async getPriorityActions(
    entityId: string,
    limit: number = 10
  ): Promise<ServiceResult<PrivacyProgramMetrics['actionItems']>> {
    const result = await this.generateProgramMetrics(entityId);

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: result.data.actionItems.slice(0, limit),
    };
  }

  /**
   * Export compliance report (for regulators)
   */
  async exportComplianceReport(
    entityId: string,
    period: { start: Date; end: Date }
  ): Promise<ServiceResult<{
    report: PrivacyProgramMetrics;
    exportedAt: Date;
    format: string;
  }>> {
    const result = await this.generateProgramMetrics(entityId, period);

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: {
        report: result.data,
        exportedAt: new Date(),
        format: 'JSON',
      },
    };
  }
}

// ============================================================================
// DEFAULT METRIC PROVIDERS (STUBS)
// ============================================================================

/**
 * Creates stub metric providers for testing.
 * In production, these would be implemented by actual domain services.
 */
export function createStubProviders(): MetricProviders {
  return {
    async getDSARMetrics(): Promise<DSARMetrics> {
      return {
        totalRequests: 0,
        pendingRequests: 0,
        completedRequests: 0,
        overdueRequests: 0,
        averageCompletionDays: 0,
        complianceRate: 1,
        byType: {},
      };
    },
    async getConsentMetrics(): Promise<ConsentMetrics> {
      return {
        totalConsents: 0,
        activeConsents: 0,
        withdrawnConsents: 0,
        expiredConsents: 0,
        consentRate: 1,
        byPurpose: {},
        withdrawalRate: 0,
      };
    },
    async getBreachMetrics(): Promise<BreachMetrics> {
      return {
        totalBreaches: 0,
        openBreaches: 0,
        resolvedBreaches: 0,
        notifiedOnTime: 0,
        notifiedLate: 0,
        averageResolutionDays: 0,
        bySeverity: {},
        notificationComplianceRate: 1,
      };
    },
    async getDPIAMetrics(): Promise<DPIAMetrics> {
      return {
        totalAssessments: 0,
        pendingAssessments: 0,
        approvedAssessments: 0,
        rejectedAssessments: 0,
        requiresConsultation: 0,
        averageCompletionDays: 0,
      };
    },
    async getProcessorMetrics(): Promise<ProcessorMetrics> {
      return {
        totalProcessors: 0,
        activeProcessors: 0,
        euProcessors: 0,
        nonEuProcessors: 0,
        dpaExpiringSoon: 0,
        auditOverdue: 0,
        complianceRate: 1,
      };
    },
    async getTransferMetrics(): Promise<TransferMetrics> {
      return {
        totalTransfers: 0,
        approvedTransfers: 0,
        adequacyBased: 0,
        sccBased: 0,
        highRiskTransfers: 0,
        missingTIA: 0,
        destinationCountries: 0,
      };
    },
    async getActivityMetrics(): Promise<ActivityMetrics> {
      return {
        totalActivities: 0,
        activeActivities: 0,
        withSpecialCategories: 0,
        dpiaRequired: 0,
        reviewDue: 0,
      };
    },
    async getTrendData(): Promise<ComplianceDashboard['trends']> {
      return [];
    },
  };
}

// ============================================================================
// PRISMA-BACKED METRIC PROVIDERS
// ============================================================================

import type { PrismaClient } from '@prisma/client';

/**
 * Creates real metric providers backed by Prisma.
 * These aggregate data from all privacy domain tables.
 */
export function createPrismaProviders(prisma: PrismaClient): MetricProviders {
  return {
    async getDSARMetrics(entityId: string, startDate: Date, endDate: Date): Promise<DSARMetrics> {
      const dsars = await prisma.dSARRequest.findMany({
        where: {
          entityId,
          receivedAt: { gte: startDate, lte: endDate },
        },
      });

      const total = dsars.length;
      const pending = dsars.filter(d => !['COMPLETED', 'REJECTED', 'CLOSED'].includes(d.status)).length;
      const completed = dsars.filter(d => d.status === 'COMPLETED').length;
      const overdue = dsars.filter(d => {
        const deadline = d.extendedDeadline || d.deadline;
        return !['COMPLETED', 'REJECTED', 'CLOSED'].includes(d.status) && new Date() > deadline;
      }).length;

      const completedWithDates = dsars.filter(d => d.status === 'COMPLETED' && d.completedAt);
      const avgDays = completedWithDates.length > 0
        ? completedWithDates.reduce((sum, d) => {
            const days = Math.ceil((d.completedAt!.getTime() - d.receivedAt.getTime()) / (1000 * 60 * 60 * 24));
            return sum + days;
          }, 0) / completedWithDates.length
        : 0;

      const byType: Record<string, number> = {};
      dsars.forEach(d => {
        byType[d.requestType] = (byType[d.requestType] || 0) + 1;
      });

      return {
        totalRequests: total,
        pendingRequests: pending,
        completedRequests: completed,
        overdueRequests: overdue,
        averageCompletionDays: avgDays,
        complianceRate: total > 0 ? (total - overdue) / total : 1,
        byType,
      };
    },

    async getConsentMetrics(entityId: string, startDate: Date, endDate: Date): Promise<ConsentMetrics> {
      const consents = await prisma.consentRecord.findMany({
        where: {
          entityId,
          grantedAt: { gte: startDate, lte: endDate },
        },
      });

      const total = consents.length;
      const active = consents.filter(c => c.status === 'ACTIVE').length;
      const withdrawn = consents.filter(c => c.status === 'WITHDRAWN').length;
      const expired = consents.filter(c => c.status === 'EXPIRED').length;

      const byPurpose: Record<string, number> = {};
      consents.forEach(c => {
        byPurpose[c.purpose] = (byPurpose[c.purpose] || 0) + 1;
      });

      return {
        totalConsents: total,
        activeConsents: active,
        withdrawnConsents: withdrawn,
        expiredConsents: expired,
        consentRate: total > 0 ? active / total : 1,
        byPurpose,
        withdrawalRate: total > 0 ? withdrawn / total : 0,
      };
    },

    async getBreachMetrics(entityId: string, startDate: Date, endDate: Date): Promise<BreachMetrics> {
      const breaches = await prisma.dataBreach.findMany({
        where: {
          entityId,
          discoveredAt: { gte: startDate, lte: endDate },
        },
      });

      const total = breaches.length;
      const open = breaches.filter(b => !['RESOLVED', 'CLOSED'].includes(b.status)).length;
      const resolved = breaches.filter(b => b.status === 'RESOLVED' || b.status === 'CLOSED').length;

      const notified = breaches.filter(b => b.authorityNotificationRequired && b.authorityNotifiedAt);
      const notifiedOnTime = notified.filter(b => {
        if (!b.notificationDeadline || !b.authorityNotifiedAt) return false;
        return b.authorityNotifiedAt <= b.notificationDeadline;
      }).length;
      const notifiedLate = notified.length - notifiedOnTime;

      const resolvedWithDates = breaches.filter(b => (b.status === 'RESOLVED' || b.status === 'CLOSED') && b.resolvedAt);
      const avgDays = resolvedWithDates.length > 0
        ? resolvedWithDates.reduce((sum, b) => {
            const days = Math.ceil((b.resolvedAt!.getTime() - b.discoveredAt.getTime()) / (1000 * 60 * 60 * 24));
            return sum + days;
          }, 0) / resolvedWithDates.length
        : 0;

      const bySeverity: Record<string, number> = {};
      breaches.forEach(b => {
        bySeverity[b.severity] = (bySeverity[b.severity] || 0) + 1;
      });

      const totalRequiringNotification = breaches.filter(b => b.authorityNotificationRequired).length;

      return {
        totalBreaches: total,
        openBreaches: open,
        resolvedBreaches: resolved,
        notifiedOnTime,
        notifiedLate,
        averageResolutionDays: avgDays,
        bySeverity,
        notificationComplianceRate: totalRequiringNotification > 0 ? notifiedOnTime / totalRequiringNotification : 1,
      };
    },

    async getDPIAMetrics(entityId: string, startDate: Date, endDate: Date): Promise<DPIAMetrics> {
      const dpias = await prisma.privacyImpactAssessment.findMany({
        where: {
          entityId,
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      const total = dpias.length;
      const pending = dpias.filter(d => ['DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'PENDING_APPROVAL'].includes(d.status)).length;
      const approved = dpias.filter(d => d.status === 'APPROVED').length;
      const rejected = dpias.filter(d => d.status === 'REJECTED').length;
      const requiresConsultation = dpias.filter(d => d.status === 'REQUIRES_CONSULTATION').length;

      const completedDpias = dpias.filter(d => d.status === 'APPROVED' && d.completedAt);
      const avgDays = completedDpias.length > 0
        ? completedDpias.reduce((sum, d) => {
            const days = Math.ceil((d.completedAt!.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            return sum + days;
          }, 0) / completedDpias.length
        : 0;

      return {
        totalAssessments: total,
        pendingAssessments: pending,
        approvedAssessments: approved,
        rejectedAssessments: rejected,
        requiresConsultation,
        averageCompletionDays: avgDays,
      };
    },

    async getProcessorMetrics(entityId: string): Promise<ProcessorMetrics> {
      const processors = await prisma.dataProcessor.findMany({
        where: { entityId },
      });

      const total = processors.length;
      const active = processors.filter(p => p.status === 'ACTIVE').length;
      const eu = processors.filter(p => p.isEU).length;
      const nonEu = processors.filter(p => !p.isEU).length;

      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + 90);
      const dpaExpiring = processors.filter(p => p.dpaExpiresAt && p.dpaExpiresAt <= thresholdDate && p.dpaExpiresAt >= new Date()).length;

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const auditOverdue = processors.filter(p => !p.lastAuditDate || p.lastAuditDate < oneYearAgo).length;

      const compliant = processors.filter(p => p.complianceStatus === 'COMPLIANT').length;

      return {
        totalProcessors: total,
        activeProcessors: active,
        euProcessors: eu,
        nonEuProcessors: nonEu,
        dpaExpiringSoon: dpaExpiring,
        auditOverdue,
        complianceRate: total > 0 ? compliant / total : 1,
      };
    },

    async getTransferMetrics(entityId: string): Promise<TransferMetrics> {
      const transfers = await prisma.dataTransfer.findMany({
        where: { entityId },
      });

      const total = transfers.length;
      const approved = transfers.filter(t => t.status === 'APPROVED').length;
      const adequacy = transfers.filter(t => t.transferBasis === 'ADEQUACY_DECISION').length;
      const scc = transfers.filter(t => t.transferBasis === 'STANDARD_CONTRACTUAL_CLAUSES').length;
      const missingTIA = transfers.filter(t => !t.transferImpactAssessment).length;

      const countries = new Set(transfers.map(t => t.destinationCountry));

      // Simple high-risk detection: non-adequacy without TIA
      const highRisk = transfers.filter(t => {
        const tia = t.transferImpactAssessment as { riskLevel?: string } | null;
        return tia?.riskLevel === 'HIGH' || tia?.riskLevel === 'CRITICAL';
      }).length;

      return {
        totalTransfers: total,
        approvedTransfers: approved,
        adequacyBased: adequacy,
        sccBased: scc,
        highRiskTransfers: highRisk,
        missingTIA,
        destinationCountries: countries.size,
      };
    },

    async getActivityMetrics(entityId: string): Promise<ActivityMetrics> {
      const activities = await prisma.processingActivity.findMany({
        where: { entityId },
      });

      const total = activities.length;
      const active = activities.filter(a => a.status === 'ACTIVE').length;
      const withSpecial = activities.filter(a => a.specialCategories && a.specialCategories.length > 0).length;
      const dpiaRequired = activities.filter(a => a.dpiaRequired).length;
      const reviewDue = activities.filter(a => a.nextReviewDue && a.nextReviewDue <= new Date()).length;

      return {
        totalActivities: total,
        activeActivities: active,
        withSpecialCategories: withSpecial,
        dpiaRequired,
        reviewDue,
      };
    },

    async getTrendData(entityId: string, months: number): Promise<ComplianceDashboard['trends']> {
      const trends: ComplianceDashboard['trends'] = [];
      const now = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const [dsarCount, breachCount] = await Promise.all([
          prisma.dSARRequest.count({
            where: {
              entityId,
              receivedAt: { gte: monthStart, lte: monthEnd },
            },
          }),
          prisma.dataBreach.count({
            where: {
              entityId,
              discoveredAt: { gte: monthStart, lte: monthEnd },
            },
          }),
        ]);

        trends.push({
          period: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
          dsarCount,
          breachCount,
          complianceScore: 100 - (breachCount * 10), // Simplified scoring
        });
      }

      return trends;
    },
  };
}
