/**
 * Compliance Metrics API Routes
 *
 * REST endpoints for compliance metrics and KPIs.
 *
 * @module api/rest/routes/metrics
 */

import { FastifyInstance } from 'fastify';
import { eq, and, lt, or } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/persistence/index.js';
import * as schema from '../../../infrastructure/persistence/schema.js';
import {
  calculateComplianceRate,
  calculateComplianceScore,
  calculateRiskExposure,
  calculateWeightedComplianceRate,
  getGradeFromScore,
  type ObligationMetrics,
  type FindingMetrics,
  type ControlMetrics,
} from '../../../application/services/compliance-metrics.js';

// =============================================================================
// ROUTES
// =============================================================================

export async function metricsRoutes(
  fastify: FastifyInstance,
  options: { db: Database }
) {
  const { db } = options;

  // ---------------------------------------------------------------------------
  // GET /metrics/compliance-score - Get overall compliance score
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { entityId?: string };
  }>('/metrics/compliance-score', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId } = request.query;
    const now = new Date();

    // Fetch data
    const [obligations, findings, controls] = await Promise.all([
      fetchObligations(db, tenantId, entityId),
      fetchFindings(db, tenantId, entityId),
      fetchControls(db, tenantId, entityId),
    ]);

    // Calculate metrics
    const obligationMetrics = calculateObligationMetrics(obligations, now);
    const findingMetrics = calculateFindingMetrics(findings);
    const controlMetrics = calculateControlMetrics(controls, now);

    // Calculate score
    const score = calculateComplianceScore(obligationMetrics, findingMetrics, controlMetrics);
    const weightedRate = calculateWeightedComplianceRate(
      obligations.map(o => ({ status: o.status, priority: o.priority }))
    );

    return reply.send({
      overall: score.overall,
      grade: score.grade,
      trend: score.trend,
      byDimension: score.byDimension,
      weightedComplianceRate: weightedRate,
      generatedAt: now.toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /metrics/obligations - Get obligation statistics
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { entityId?: string };
  }>('/metrics/obligations', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId } = request.query;
    const now = new Date();

    const obligations = await fetchObligations(db, tenantId, entityId);
    const metrics = calculateObligationMetrics(obligations, now);

    // Additional breakdowns
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byRegulator: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const obl of obligations) {
      byStatus[obl.status] = (byStatus[obl.status] || 0) + 1;
      byPriority[obl.priority] = (byPriority[obl.priority] || 0) + 1;
      byRegulator[obl.regulator] = (byRegulator[obl.regulator] || 0) + 1;
      byCategory[obl.category] = (byCategory[obl.category] || 0) + 1;
    }

    // Completion rate
    const completionRate = calculateComplianceRate(metrics.completed, metrics.total);

    return reply.send({
      metrics,
      completionRate,
      byStatus,
      byPriority,
      byRegulator,
      byCategory,
      generatedAt: now.toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /metrics/findings - Get finding statistics
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { entityId?: string };
  }>('/metrics/findings', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId } = request.query;
    const now = new Date();

    const findings = await fetchFindings(db, tenantId, entityId);
    const metrics = calculateFindingMetrics(findings);

    // Additional breakdowns
    const byAuditType: Record<string, number> = {};
    const byFindingType: Record<string, number> = {};
    const byRegulator: Record<string, { total: number; open: number }> = {};

    for (const finding of findings) {
      byAuditType[finding.auditType] = (byAuditType[finding.auditType] || 0) + 1;
      byFindingType[finding.findingType] = (byFindingType[finding.findingType] || 0) + 1;

      if (finding.regulator) {
        if (!byRegulator[finding.regulator]) {
          byRegulator[finding.regulator] = { total: 0, open: 0 };
        }
        byRegulator[finding.regulator].total++;
        if (finding.status !== 'closed') {
          byRegulator[finding.regulator].open++;
        }
      }
    }

    // Overdue remediations
    const overdueRemediation = findings.filter(f =>
      f.status !== 'closed' &&
      f.remediationDueDate &&
      new Date(f.remediationDueDate) < now
    ).length;

    // Average remediation time (for closed findings)
    const closedFindings = findings.filter(f =>
      f.status === 'closed' && f.remediationCompletedDate
    );
    let avgRemediationDays = 0;
    if (closedFindings.length > 0) {
      const totalDays = closedFindings.reduce((sum, f) => {
        const created = new Date(f.createdAt);
        const completed = new Date(f.remediationCompletedDate!);
        return sum + Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgRemediationDays = Math.round(totalDays / closedFindings.length);
    }

    return reply.send({
      metrics,
      overdueRemediation,
      avgRemediationDays,
      byAuditType,
      byFindingType,
      byRegulator,
      generatedAt: now.toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /metrics/controls - Get control statistics
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { entityId?: string };
  }>('/metrics/controls', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId } = request.query;
    const now = new Date();

    const controls = await fetchControls(db, tenantId, entityId);
    const metrics = calculateControlMetrics(controls, now);

    // Additional breakdowns
    const byFramework: Record<string, { total: number; effective: number }> = {};
    const byControlType: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};

    for (const control of controls) {
      if (!byFramework[control.framework]) {
        byFramework[control.framework] = { total: 0, effective: 0 };
      }
      byFramework[control.framework].total++;
      if (control.status === 'operating_effectively') {
        byFramework[control.framework].effective++;
      }

      byControlType[control.controlType] = (byControlType[control.controlType] || 0) + 1;
      byRiskLevel[control.riskLevel] = (byRiskLevel[control.riskLevel] || 0) + 1;
    }

    return reply.send({
      metrics,
      byFramework,
      byControlType,
      byRiskLevel,
      generatedAt: now.toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /metrics/deadlines - Get upcoming deadline count
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { days?: number; entityId?: string };
  }>('/metrics/deadlines', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { days = 30, entityId } = request.query;
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const obligations = await fetchObligations(db, tenantId, entityId);

    const activeObligations = obligations.filter(o =>
      !['completed', 'waived', 'not_applicable'].includes(o.status)
    );

    // Categorize deadlines
    const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const overdue = activeObligations.filter(o => new Date(o.dueDate) < now);
    const thisWeek = activeObligations.filter(o =>
      new Date(o.dueDate) >= now && new Date(o.dueDate) <= oneWeek
    );
    const nextWeek = activeObligations.filter(o =>
      new Date(o.dueDate) > oneWeek && new Date(o.dueDate) <= twoWeeks
    );
    const upcoming = activeObligations.filter(o =>
      new Date(o.dueDate) > twoWeeks && new Date(o.dueDate) <= cutoff
    );

    // By priority
    const criticalDue = activeObligations.filter(o =>
      o.priority === 'critical' && new Date(o.dueDate) <= cutoff
    ).length;
    const highDue = activeObligations.filter(o =>
      o.priority === 'high' && new Date(o.dueDate) <= cutoff
    ).length;

    // Distribution by day
    const byDay: Record<string, number> = {};
    for (const obl of activeObligations) {
      const dueDate = new Date(obl.dueDate);
      if (dueDate >= now && dueDate <= cutoff) {
        const dateKey = dueDate.toISOString().split('T')[0];
        byDay[dateKey] = (byDay[dateKey] || 0) + 1;
      }
    }

    return reply.send({
      summary: {
        total: overdue.length + thisWeek.length + nextWeek.length + upcoming.length,
        overdue: overdue.length,
        thisWeek: thisWeek.length,
        nextWeek: nextWeek.length,
        upcoming: upcoming.length,
        criticalDue,
        highDue,
      },
      byDay,
      dateRange: {
        from: now.toISOString(),
        to: cutoff.toISOString(),
        days,
      },
      generatedAt: now.toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /metrics/risk-exposure - Get risk exposure metrics
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { entityId?: string };
  }>('/metrics/risk-exposure', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId } = request.query;
    const now = new Date();

    const [obligations, findings, controls] = await Promise.all([
      fetchObligations(db, tenantId, entityId),
      fetchFindings(db, tenantId, entityId),
      fetchControls(db, tenantId, entityId),
    ]);

    const obligationMetrics = calculateObligationMetrics(obligations, now);
    const findingMetrics = calculateFindingMetrics(findings);
    const controlMetrics = calculateControlMetrics(controls, now);

    const riskExposure = calculateRiskExposure(obligationMetrics, findingMetrics, controlMetrics);

    return reply.send({
      ...riskExposure,
      generatedAt: now.toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /metrics/summary - Get key metrics summary (lightweight)
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { entityId?: string };
  }>('/metrics/summary', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId } = request.query;
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [obligations, findings, controls] = await Promise.all([
      fetchObligations(db, tenantId, entityId),
      fetchFindings(db, tenantId, entityId),
      fetchControls(db, tenantId, entityId),
    ]);

    const totalObligations = obligations.length;
    const completedObligations = obligations.filter(o => o.status === 'completed').length;
    const overdueObligations = obligations.filter(o =>
      !['completed', 'waived', 'not_applicable'].includes(o.status) &&
      new Date(o.dueDate) < now
    ).length;
    const upcomingDeadlines = obligations.filter(o =>
      !['completed', 'waived', 'not_applicable'].includes(o.status) &&
      new Date(o.dueDate) >= now &&
      new Date(o.dueDate) <= sevenDaysOut
    ).length;

    const openFindings = findings.filter(f => f.status !== 'closed').length;
    const criticalFindings = findings.filter(f => f.severity === 'critical' && f.status !== 'closed').length;

    const totalControls = controls.length;
    const effectiveControls = controls.filter(c => c.status === 'operating_effectively').length;

    const complianceRate = calculateComplianceRate(completedObligations, totalObligations);
    const controlEffectiveness = totalControls > 0
      ? Math.round((effectiveControls / totalControls) * 100)
      : 100;

    return reply.send({
      complianceRate,
      controlEffectiveness,
      totalObligations,
      completedObligations,
      overdueObligations,
      upcomingDeadlines,
      openFindings,
      criticalFindings,
      totalControls,
      effectiveControls,
      generatedAt: now.toISOString(),
    });
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

async function fetchObligations(db: Database, tenantId: string, entityId?: string) {
  const conditions = [eq(schema.complianceObligations.tenantId, tenantId)];
  if (entityId) {
    conditions.push(eq(schema.complianceObligations.entityId, entityId));
  }

  return db
    .select()
    .from(schema.complianceObligations)
    .where(and(...conditions));
}

async function fetchFindings(db: Database, tenantId: string, entityId?: string) {
  const conditions = [eq(schema.auditFindings.tenantId, tenantId)];
  if (entityId) {
    conditions.push(eq(schema.auditFindings.entityId, entityId));
  }

  return db
    .select()
    .from(schema.auditFindings)
    .where(and(...conditions));
}

async function fetchControls(db: Database, tenantId: string, entityId?: string) {
  const conditions = [eq(schema.controlRequirements.tenantId, tenantId)];
  if (entityId) {
    conditions.push(eq(schema.controlRequirements.entityId, entityId));
  }

  return db
    .select()
    .from(schema.controlRequirements)
    .where(and(...conditions));
}

function calculateObligationMetrics(
  obligations: Array<{
    status: string;
    priority: string;
    dueDate: Date;
    escalated: boolean;
  }>,
  now: Date
): ObligationMetrics {
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
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

function calculateFindingMetrics(
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

function calculateControlMetrics(
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
