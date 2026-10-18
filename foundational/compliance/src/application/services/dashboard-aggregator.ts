/**
 * Dashboard Aggregator Service
 *
 * Aggregates compliance metrics from all ecosystem data sources
 * and provides unified dashboard views.
 *
 * @module application/services/dashboard-aggregator
 */

import { eq, and, lte, gte, desc, lt, or } from 'drizzle-orm';
import type { Database } from '../../infrastructure/persistence/index.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import {
  type ObligationMetrics,
  type FindingMetrics,
  type ControlMetrics,
  type ComplianceScore,
  type RiskExposure,
  type TrendDataPoint,
  calculateComplianceRate,
  calculateComplianceScore,
  calculateRiskExposure,
  calculateTrendData,
  analyzeTrendDirection,
  categorizeDeadlines,
  getDeadlineDistribution,
  aggregateByDimension,
} from './compliance-metrics.js';

// =============================================================================
// Types
// =============================================================================

export interface DashboardSummary {
  complianceRate: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalObligations: number;
  completedObligations: number;
  overdueObligations: number;
  criticalOverdue: number;
  openFindings: number;
  criticalFindings: number;
  upcomingDeadlines: number;
  score: ComplianceScore;
}

export interface FullDashboardData {
  summary: DashboardSummary;
  obligations: ObligationMetrics;
  findings: FindingMetrics;
  controls: ControlMetrics;
  attestations: {
    total: number;
    pending: number;
    overdue: number;
    completed: number;
  };
  policies: {
    total: number;
    published: number;
    needingReview: number;
    expiringSoon: number;
  };
  riskExposure: RiskExposure;
  byRegulator: Record<string, { total: number; completed: number; overdue: number; score: number }>;
  byCategory: Record<string, { total: number; completed: number; overdue: number; score: number }>;
  generatedAt: string;
}

export interface ComplianceAlert {
  id: string;
  type: 'overdue' | 'critical_finding' | 'material_weakness' | 'deadline_approaching' | 'escalation' | 'policy_expiring';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  entityId?: string;
  relatedId?: string;
  relatedType?: string;
  actionRequired: string;
  dueDate?: string;
  createdAt: string;
}

// =============================================================================
// Dashboard Aggregator Service
// =============================================================================

export class DashboardAggregator {
  constructor(private readonly db: Database) {}

  // ===========================================================================
  // Full Dashboard
  // ===========================================================================

  /**
   * Get complete dashboard data
   */
  async getFullDashboard(
    tenantId: string,
    entityId?: string
  ): Promise<FullDashboardData> {
    const now = new Date();

    // Fetch all required data in parallel
    const [
      obligations,
      findings,
      controls,
      attestations,
      policies,
    ] = await Promise.all([
      this.fetchObligations(tenantId, entityId),
      this.fetchFindings(tenantId, entityId),
      this.fetchControls(tenantId, entityId),
      this.fetchAttestations(tenantId, entityId),
      this.fetchPolicies(tenantId, entityId),
    ]);

    // Calculate metrics
    const obligationMetrics = this.calculateObligationMetrics(obligations, now);
    const findingMetrics = this.calculateFindingMetrics(findings);
    const controlMetrics = this.calculateControlMetrics(controls, now);

    // Calculate scores
    const score = calculateComplianceScore(obligationMetrics, findingMetrics, controlMetrics);
    const riskExposure = calculateRiskExposure(obligationMetrics, findingMetrics, controlMetrics);

    // Aggregations
    const byRegulator = this.aggregateByRegulatorWithScore(obligations, now);
    const byCategory = this.aggregateByCategoryWithScore(obligations, now);

    // Attestations metrics
    const attestationMetrics = {
      total: attestations.length,
      pending: attestations.filter(a => a.status === 'pending').length,
      overdue: attestations.filter(a => a.status === 'pending' && new Date(a.dueDate) < now).length,
      completed: attestations.filter(a => a.status === 'completed').length,
    };

    // Policy metrics
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const policyMetrics = {
      total: policies.length,
      published: policies.filter(p => p.status === 'published').length,
      needingReview: policies.filter(p => p.status === 'published' && p.reviewDate && new Date(p.reviewDate) <= now).length,
      expiringSoon: policies.filter(p => p.expirationDate && new Date(p.expirationDate) <= thirtyDaysOut).length,
    };

    // Summary
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = obligations.filter(o =>
      !['completed', 'waived', 'not_applicable'].includes(o.status) &&
      new Date(o.dueDate) >= now &&
      new Date(o.dueDate) <= sevenDaysOut
    ).length;

    const summary: DashboardSummary = {
      complianceRate: calculateComplianceRate(obligationMetrics.completed, obligationMetrics.total),
      riskLevel: riskExposure.level,
      totalObligations: obligationMetrics.total,
      completedObligations: obligationMetrics.completed,
      overdueObligations: obligationMetrics.overdue,
      criticalOverdue: obligationMetrics.criticalOverdue,
      openFindings: findingMetrics.open,
      criticalFindings: findingMetrics.critical,
      upcomingDeadlines,
      score,
    };

    return {
      summary,
      obligations: obligationMetrics,
      findings: findingMetrics,
      controls: controlMetrics,
      attestations: attestationMetrics,
      policies: policyMetrics,
      riskExposure,
      byRegulator,
      byCategory,
      generatedAt: now.toISOString(),
    };
  }

  // ===========================================================================
  // Summary Dashboard
  // ===========================================================================

  /**
   * Get summary metrics only (lighter weight)
   */
  async getSummary(tenantId: string, entityId?: string): Promise<DashboardSummary> {
    const now = new Date();

    const [obligations, findings, controls] = await Promise.all([
      this.fetchObligations(tenantId, entityId),
      this.fetchFindings(tenantId, entityId),
      this.fetchControls(tenantId, entityId),
    ]);

    const obligationMetrics = this.calculateObligationMetrics(obligations, now);
    const findingMetrics = this.calculateFindingMetrics(findings);
    const controlMetrics = this.calculateControlMetrics(controls, now);

    const score = calculateComplianceScore(obligationMetrics, findingMetrics, controlMetrics);
    const riskExposure = calculateRiskExposure(obligationMetrics, findingMetrics, controlMetrics);

    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = obligations.filter(o =>
      !['completed', 'waived', 'not_applicable'].includes(o.status) &&
      new Date(o.dueDate) >= now &&
      new Date(o.dueDate) <= sevenDaysOut
    ).length;

    return {
      complianceRate: calculateComplianceRate(obligationMetrics.completed, obligationMetrics.total),
      riskLevel: riskExposure.level,
      totalObligations: obligationMetrics.total,
      completedObligations: obligationMetrics.completed,
      overdueObligations: obligationMetrics.overdue,
      criticalOverdue: obligationMetrics.criticalOverdue,
      openFindings: findingMetrics.open,
      criticalFindings: findingMetrics.critical,
      upcomingDeadlines,
      score,
    };
  }

  // ===========================================================================
  // Trend Data
  // ===========================================================================

  /**
   * Get trend data over time
   */
  async getTrends(
    tenantId: string,
    months: number = 6,
    entityId?: string
  ): Promise<{
    data: TrendDataPoint[];
    analysis: { direction: 'improving' | 'stable' | 'declining'; changePercent: number };
  }> {
    const [obligations, findings] = await Promise.all([
      this.fetchObligations(tenantId, entityId),
      this.fetchFindings(tenantId, entityId),
    ]);

    const data = calculateTrendData(
      obligations.map(o => ({
        status: o.status,
        dueDate: o.dueDate,
        completedDate: o.completedDate,
      })),
      findings.map(f => ({
        status: f.status,
        createdAt: f.createdAt,
        severity: f.severity,
      })),
      months
    );

    const analysis = analyzeTrendDirection(data);

    return { data, analysis };
  }

  // ===========================================================================
  // Alerts
  // ===========================================================================

  /**
   * Get compliance alerts
   */
  async getAlerts(
    tenantId: string,
    entityId?: string
  ): Promise<ComplianceAlert[]> {
    const now = new Date();
    const alerts: ComplianceAlert[] = [];

    const [obligations, findings, controls, policies] = await Promise.all([
      this.fetchObligations(tenantId, entityId),
      this.fetchFindings(tenantId, entityId),
      this.fetchControls(tenantId, entityId),
      this.fetchPolicies(tenantId, entityId),
    ]);

    // Overdue obligations
    const overdueObligations = obligations.filter(o =>
      !['completed', 'waived', 'not_applicable'].includes(o.status) &&
      new Date(o.dueDate) < now
    );

    for (const obl of overdueObligations) {
      alerts.push({
        id: `overdue-${obl.id}`,
        type: 'overdue',
        severity: obl.priority === 'critical' ? 'critical' : 'high',
        title: `Overdue: ${obl.title}`,
        description: `Obligation was due on ${obl.dueDate.toISOString().split('T')[0]}`,
        entityId: obl.entityId,
        relatedId: obl.id,
        relatedType: 'obligation',
        actionRequired: 'Complete the obligation immediately or escalate',
        dueDate: obl.dueDate.toISOString(),
        createdAt: now.toISOString(),
      });
    }

    // Critical findings
    const criticalFindings = findings.filter(f => f.severity === 'critical' && f.status !== 'closed');
    for (const finding of criticalFindings) {
      alerts.push({
        id: `finding-${finding.id}`,
        type: 'critical_finding',
        severity: 'critical',
        title: `Critical Finding: ${finding.title}`,
        description: finding.description,
        entityId: finding.entityId,
        relatedId: finding.id,
        relatedType: 'finding',
        actionRequired: 'Address critical finding with immediate remediation plan',
        dueDate: finding.remediationDueDate?.toISOString(),
        createdAt: finding.createdAt.toISOString(),
      });
    }

    // Material weaknesses in controls
    const materialWeaknesses = controls.filter(c => c.materialWeakness);
    for (const control of materialWeaknesses) {
      alerts.push({
        id: `weakness-${control.id}`,
        type: 'material_weakness',
        severity: 'critical',
        title: `Material Weakness: ${control.name}`,
        description: `Control ${control.controlId} has material weakness`,
        entityId: control.entityId || undefined,
        relatedId: control.id,
        relatedType: 'control',
        actionRequired: 'Implement remediation plan for material weakness',
        createdAt: control.updatedAt.toISOString(),
      });
    }

    // Upcoming critical deadlines
    const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const upcomingCritical = obligations.filter(o =>
      o.priority === 'critical' &&
      !['completed', 'waived', 'not_applicable'].includes(o.status) &&
      new Date(o.dueDate) >= now &&
      new Date(o.dueDate) <= threeDaysOut
    );

    for (const obl of upcomingCritical) {
      alerts.push({
        id: `deadline-${obl.id}`,
        type: 'deadline_approaching',
        severity: 'high',
        title: `Critical Deadline Approaching: ${obl.title}`,
        description: `Due in ${Math.ceil((new Date(obl.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days`,
        entityId: obl.entityId,
        relatedId: obl.id,
        relatedType: 'obligation',
        actionRequired: 'Ensure completion before deadline',
        dueDate: obl.dueDate.toISOString(),
        createdAt: now.toISOString(),
      });
    }

    // Escalated obligations
    const escalated = obligations.filter(o => o.escalated);
    for (const obl of escalated) {
      alerts.push({
        id: `escalation-${obl.id}`,
        type: 'escalation',
        severity: 'high',
        title: `Escalated: ${obl.title}`,
        description: obl.escalationReason || 'Obligation has been escalated',
        entityId: obl.entityId,
        relatedId: obl.id,
        relatedType: 'obligation',
        actionRequired: 'Review escalation and take appropriate action',
        dueDate: obl.dueDate.toISOString(),
        createdAt: obl.escalatedAt?.toISOString() || now.toISOString(),
      });
    }

    // Expiring policies
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringPolicies = policies.filter(p =>
      p.expirationDate && new Date(p.expirationDate) <= thirtyDaysOut
    );

    for (const policy of expiringPolicies) {
      alerts.push({
        id: `policy-${policy.id}`,
        type: 'policy_expiring',
        severity: 'medium',
        title: `Policy Expiring: ${policy.title}`,
        description: `Policy expires on ${policy.expirationDate!.toISOString().split('T')[0]}`,
        entityId: policy.entityId || undefined,
        relatedId: policy.id,
        relatedType: 'policy',
        actionRequired: 'Review and renew policy before expiration',
        dueDate: policy.expirationDate!.toISOString(),
        createdAt: now.toISOString(),
      });
    }

    // Sort by severity and date
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return alerts;
  }

  // ===========================================================================
  // Entity Dashboard
  // ===========================================================================

  /**
   * Get dashboard for a specific entity
   */
  async getEntityDashboard(
    tenantId: string,
    entityId: string
  ): Promise<FullDashboardData & { entityId: string }> {
    const dashboard = await this.getFullDashboard(tenantId, entityId);
    return {
      ...dashboard,
      entityId,
    };
  }

  // ===========================================================================
  // Deadline Analysis
  // ===========================================================================

  /**
   * Get deadline analysis
   */
  async getDeadlineAnalysis(
    tenantId: string,
    daysAhead: number = 30,
    entityId?: string
  ): Promise<{
    categorized: ReturnType<typeof categorizeDeadlines>;
    distribution: Record<string, number>;
    summary: {
      critical: number;
      thisWeek: number;
      thisMonth: number;
      upcoming: number;
      total: number;
    };
  }> {
    const obligations = await this.fetchObligations(tenantId, entityId);

    const obligationData = obligations.map(o => ({
      dueDate: o.dueDate,
      status: o.status,
      priority: o.priority,
      title: o.title,
    }));

    const categorized = categorizeDeadlines(obligationData);
    const distribution = getDeadlineDistribution(obligationData, daysAhead);

    return {
      categorized,
      distribution,
      summary: {
        critical: categorized.critical.length,
        thisWeek: categorized.thisWeek.length,
        thisMonth: categorized.thisMonth.length,
        upcoming: categorized.upcoming.length,
        total: categorized.critical.length + categorized.thisWeek.length +
               categorized.thisMonth.length + categorized.upcoming.length,
      },
    };
  }

  // ===========================================================================
  // Private Helpers - Data Fetching
  // ===========================================================================

  private async fetchObligations(tenantId: string, entityId?: string) {
    const conditions = [eq(schema.complianceObligations.tenantId, tenantId)];
    if (entityId) {
      conditions.push(eq(schema.complianceObligations.entityId, entityId));
    }

    return this.db
      .select()
      .from(schema.complianceObligations)
      .where(and(...conditions));
  }

  private async fetchFindings(tenantId: string, entityId?: string) {
    const conditions = [eq(schema.auditFindings.tenantId, tenantId)];
    if (entityId) {
      conditions.push(eq(schema.auditFindings.entityId, entityId));
    }

    return this.db
      .select()
      .from(schema.auditFindings)
      .where(and(...conditions));
  }

  private async fetchControls(tenantId: string, entityId?: string) {
    const conditions = [eq(schema.controlRequirements.tenantId, tenantId)];
    if (entityId) {
      conditions.push(eq(schema.controlRequirements.entityId, entityId));
    }

    return this.db
      .select()
      .from(schema.controlRequirements)
      .where(and(...conditions));
  }

  private async fetchAttestations(tenantId: string, entityId?: string) {
    const conditions = [eq(schema.attestations.tenantId, tenantId)];
    if (entityId) {
      conditions.push(eq(schema.attestations.entityId, entityId));
    }

    return this.db
      .select()
      .from(schema.attestations)
      .where(and(...conditions));
  }

  private async fetchPolicies(tenantId: string, entityId?: string) {
    const conditions = [eq(schema.policies.tenantId, tenantId)];
    if (entityId) {
      conditions.push(eq(schema.policies.entityId, entityId));
    }

    return this.db
      .select()
      .from(schema.policies)
      .where(and(...conditions));
  }

  // ===========================================================================
  // Private Helpers - Metrics Calculation
  // ===========================================================================

  private calculateObligationMetrics(
    obligations: Array<{
      status: string;
      priority: string;
      dueDate: Date;
      escalated: boolean;
    }>,
    now: Date
  ): ObligationMetrics {
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const activeStatuses = ['pending', 'in_progress', 'under_review', 'overdue'];
    const completedStatuses = ['completed', 'waived', 'not_applicable'];

    return {
      total: obligations.length,
      completed: obligations.filter(o => o.status === 'completed').length,
      pending: obligations.filter(o => o.status === 'pending').length,
      inProgress: obligations.filter(o => o.status === 'in_progress').length,
      overdue: obligations.filter(o =>
        !completedStatuses.includes(o.status) && new Date(o.dueDate) < now
      ).length,
      escalated: obligations.filter(o => o.escalated).length,
      upcomingDeadlines: obligations.filter(o =>
        !completedStatuses.includes(o.status) &&
        new Date(o.dueDate) >= now &&
        new Date(o.dueDate) <= sevenDaysOut
      ).length,
      criticalOverdue: obligations.filter(o =>
        o.priority === 'critical' &&
        !completedStatuses.includes(o.status) &&
        new Date(o.dueDate) < now
      ).length,
    };
  }

  private calculateFindingMetrics(
    findings: Array<{ status: string; severity: string }>
  ): FindingMetrics {
    return {
      total: findings.length,
      open: findings.filter(f => f.status === 'open').length,
      inRemediation: findings.filter(f => f.status === 'in_remediation').length,
      pendingVerification: findings.filter(f => f.status === 'pending_verification').length,
      closed: findings.filter(f => f.status === 'closed').length,
      critical: findings.filter(f => f.severity === 'critical' && f.status !== 'closed').length,
      high: findings.filter(f => f.severity === 'high' && f.status !== 'closed').length,
      medium: findings.filter(f => f.severity === 'medium' && f.status !== 'closed').length,
      low: findings.filter(f => f.severity === 'low' && f.status !== 'closed').length,
    };
  }

  private calculateControlMetrics(
    controls: Array<{
      status: string;
      materialWeakness: boolean;
      significantDeficiency: boolean;
      nextTestDueDate: Date | null;
    }>,
    now: Date
  ): ControlMetrics {
    const total = controls.length;
    const operatingEffectively = controls.filter(c => c.status === 'operating_effectively').length;

    return {
      total,
      operatingEffectively,
      deficient: controls.filter(c => c.status === 'deficient').length,
      notImplemented: controls.filter(c => c.status === 'not_implemented').length,
      needsTesting: controls.filter(c =>
        c.nextTestDueDate && new Date(c.nextTestDueDate) <= now
      ).length,
      materialWeaknesses: controls.filter(c => c.materialWeakness).length,
      significantDeficiencies: controls.filter(c => c.significantDeficiency).length,
      effectivenessRate: total > 0 ? Math.round((operatingEffectively / total) * 100) : 100,
    };
  }

  private aggregateByRegulatorWithScore(
    obligations: Array<{ regulator: string; status: string; dueDate: Date }>,
    now: Date
  ): Record<string, { total: number; completed: number; overdue: number; score: number }> {
    const aggregated: Record<string, { total: number; completed: number; overdue: number; score: number }> = {};

    for (const obl of obligations) {
      if (!aggregated[obl.regulator]) {
        aggregated[obl.regulator] = { total: 0, completed: 0, overdue: 0, score: 0 };
      }

      aggregated[obl.regulator].total++;
      if (obl.status === 'completed') {
        aggregated[obl.regulator].completed++;
      }
      if (!['completed', 'waived', 'not_applicable'].includes(obl.status) && new Date(obl.dueDate) < now) {
        aggregated[obl.regulator].overdue++;
      }
    }

    // Calculate scores
    for (const key of Object.keys(aggregated)) {
      aggregated[key].score = calculateComplianceRate(
        aggregated[key].completed,
        aggregated[key].total
      );
    }

    return aggregated;
  }

  private aggregateByCategoryWithScore(
    obligations: Array<{ category: string; status: string; dueDate: Date }>,
    now: Date
  ): Record<string, { total: number; completed: number; overdue: number; score: number }> {
    const aggregated: Record<string, { total: number; completed: number; overdue: number; score: number }> = {};

    for (const obl of obligations) {
      if (!aggregated[obl.category]) {
        aggregated[obl.category] = { total: 0, completed: 0, overdue: 0, score: 0 };
      }

      aggregated[obl.category].total++;
      if (obl.status === 'completed') {
        aggregated[obl.category].completed++;
      }
      if (!['completed', 'waived', 'not_applicable'].includes(obl.status) && new Date(obl.dueDate) < now) {
        aggregated[obl.category].overdue++;
      }
    }

    // Calculate scores
    for (const key of Object.keys(aggregated)) {
      aggregated[key].score = calculateComplianceRate(
        aggregated[key].completed,
        aggregated[key].total
      );
    }

    return aggregated;
  }
}
