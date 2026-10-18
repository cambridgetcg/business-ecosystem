/**
 * Compliance Dashboard API Routes
 *
 * REST endpoints for compliance dashboard, metrics, and reporting.
 *
 * @module api/rest/routes/dashboard
 */

import { FastifyInstance } from 'fastify';
import { eq, and, lte, gte, desc, count, sql } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/persistence/index.js';
import * as schema from '../../../infrastructure/persistence/schema.js';
import { calculateComplianceRate, determineRiskLevel } from '../../../domain/entities/compliance-calendar.js';

// =============================================================================
// ROUTES
// =============================================================================

export async function dashboardRoutes(
  fastify: FastifyInstance,
  options: { db: Database }
) {
  const { db } = options;

  // ---------------------------------------------------------------------------
  // GET /dashboard - Get compliance dashboard summary
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { entityId?: string };
  }>('/dashboard', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId } = request.query;
    const now = new Date();

    // Build base conditions
    const obligationConditions = entityId
      ? [eq(schema.complianceObligations.tenantId, tenantId), eq(schema.complianceObligations.entityId, entityId)]
      : [eq(schema.complianceObligations.tenantId, tenantId)];

    // Get obligations
    const obligations = await db
      .select()
      .from(schema.complianceObligations)
      .where(and(...obligationConditions));

    // Calculate obligation metrics
    const totalObligations = obligations.length;
    const completedObligations = obligations.filter(o => o.status === 'completed').length;
    const pendingObligations = obligations.filter(o => o.status === 'pending').length;
    const inProgressObligations = obligations.filter(o => o.status === 'in_progress').length;
    const overdueObligations = obligations.filter(o =>
      !['completed', 'waived', 'not_applicable'].includes(o.status) &&
      new Date(o.dueDate) < now
    ).length;
    const escalatedObligations = obligations.filter(o => o.escalated).length;

    // Critical overdue (priority = critical and overdue)
    const criticalOverdue = obligations.filter(o =>
      o.priority === 'critical' &&
      !['completed', 'waived', 'not_applicable'].includes(o.status) &&
      new Date(o.dueDate) < now
    ).length;

    // Calculate compliance rate
    const complianceRate = calculateComplianceRate(completedObligations, totalObligations);

    // Determine risk level
    const riskLevel = determineRiskLevel(complianceRate, overdueObligations, criticalOverdue);

    // Get findings metrics
    const findingConditions = entityId
      ? [eq(schema.auditFindings.tenantId, tenantId), eq(schema.auditFindings.entityId, entityId)]
      : [eq(schema.auditFindings.tenantId, tenantId)];

    const findings = await db
      .select()
      .from(schema.auditFindings)
      .where(and(...findingConditions));

    const openFindings = findings.filter(f => f.status === 'open').length;
    const criticalFindings = findings.filter(f => f.severity === 'critical' && f.status !== 'closed').length;
    const highFindings = findings.filter(f => f.severity === 'high' && f.status !== 'closed').length;

    // Get controls metrics
    const controlConditions = entityId
      ? [eq(schema.controlRequirements.tenantId, tenantId), eq(schema.controlRequirements.entityId, entityId)]
      : [eq(schema.controlRequirements.tenantId, tenantId)];

    const controls = await db
      .select()
      .from(schema.controlRequirements)
      .where(and(...controlConditions));

    const totalControls = controls.length;
    const effectiveControls = controls.filter(c => c.status === 'operating_effectively').length;
    const deficientControls = controls.filter(c => c.status === 'deficient').length;
    const controlsNeedingTest = controls.filter(c =>
      c.nextTestDueDate && new Date(c.nextTestDueDate) <= now
    ).length;

    // Get attestation metrics
    const attestationConditions = entityId
      ? [eq(schema.attestations.tenantId, tenantId), eq(schema.attestations.entityId, entityId)]
      : [eq(schema.attestations.tenantId, tenantId)];

    const attestations = await db
      .select()
      .from(schema.attestations)
      .where(and(...attestationConditions));

    const pendingAttestations = attestations.filter(a => a.status === 'pending').length;
    const overdueAttestations = attestations.filter(a =>
      a.status === 'pending' && new Date(a.dueDate) < now
    ).length;

    // Upcoming deadlines (next 7 days)
    const sevenDaysOut = new Date();
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

    const upcomingDeadlines = obligations.filter(o =>
      !['completed', 'waived', 'not_applicable'].includes(o.status) &&
      new Date(o.dueDate) >= now &&
      new Date(o.dueDate) <= sevenDaysOut
    ).length;

    // Get policies needing review
    const policyConditions = entityId
      ? [eq(schema.policies.tenantId, tenantId), eq(schema.policies.entityId, entityId)]
      : [eq(schema.policies.tenantId, tenantId)];

    const policies = await db
      .select()
      .from(schema.policies)
      .where(and(...policyConditions));

    const policiesNeedingReview = policies.filter(p =>
      p.status === 'published' && p.reviewDate && new Date(p.reviewDate) <= now
    ).length;

    return reply.send({
      summary: {
        complianceRate,
        riskLevel,
        totalObligations,
        completedObligations,
        overdueObligations,
        criticalOverdue,
      },
      obligations: {
        total: totalObligations,
        completed: completedObligations,
        pending: pendingObligations,
        inProgress: inProgressObligations,
        overdue: overdueObligations,
        escalated: escalatedObligations,
        upcomingDeadlines,
      },
      findings: {
        total: findings.length,
        open: openFindings,
        critical: criticalFindings,
        high: highFindings,
      },
      controls: {
        total: totalControls,
        effective: effectiveControls,
        deficient: deficientControls,
        needingTest: controlsNeedingTest,
        effectivenessRate: totalControls > 0
          ? ((effectiveControls / totalControls) * 100).toFixed(1)
          : '100',
      },
      attestations: {
        total: attestations.length,
        pending: pendingAttestations,
        overdue: overdueAttestations,
      },
      policies: {
        total: policies.length,
        published: policies.filter(p => p.status === 'published').length,
        needingReview: policiesNeedingReview,
      },
      generatedAt: now.toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /dashboard/compliance-score - Get detailed compliance score
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { entityId?: string };
  }>('/dashboard/compliance-score', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId } = request.query;
    const now = new Date();

    // Get obligations by regulator
    const conditions = entityId
      ? [eq(schema.complianceObligations.tenantId, tenantId), eq(schema.complianceObligations.entityId, entityId)]
      : [eq(schema.complianceObligations.tenantId, tenantId)];

    const obligations = await db
      .select()
      .from(schema.complianceObligations)
      .where(and(...conditions));

    // Calculate scores by regulator
    const byRegulator: Record<string, { total: number; completed: number; overdue: number; score: number }> = {};
    const byCategory: Record<string, { total: number; completed: number; overdue: number; score: number }> = {};

    for (const obligation of obligations) {
      // By regulator
      if (!byRegulator[obligation.regulator]) {
        byRegulator[obligation.regulator] = { total: 0, completed: 0, overdue: 0, score: 0 };
      }
      byRegulator[obligation.regulator].total++;
      if (obligation.status === 'completed') {
        byRegulator[obligation.regulator].completed++;
      }
      if (!['completed', 'waived', 'not_applicable'].includes(obligation.status) && new Date(obligation.dueDate) < now) {
        byRegulator[obligation.regulator].overdue++;
      }

      // By category
      if (!byCategory[obligation.category]) {
        byCategory[obligation.category] = { total: 0, completed: 0, overdue: 0, score: 0 };
      }
      byCategory[obligation.category].total++;
      if (obligation.status === 'completed') {
        byCategory[obligation.category].completed++;
      }
      if (!['completed', 'waived', 'not_applicable'].includes(obligation.status) && new Date(obligation.dueDate) < now) {
        byCategory[obligation.category].overdue++;
      }
    }

    // Calculate scores
    for (const regulator of Object.keys(byRegulator)) {
      const { total, completed } = byRegulator[regulator];
      byRegulator[regulator].score = calculateComplianceRate(completed, total);
    }

    for (const category of Object.keys(byCategory)) {
      const { total, completed } = byCategory[category];
      byCategory[category].score = calculateComplianceRate(completed, total);
    }

    // Overall score
    const totalObligations = obligations.length;
    const completedObligations = obligations.filter(o => o.status === 'completed').length;
    const overallScore = calculateComplianceRate(completedObligations, totalObligations);

    // Trend data (last 6 months - simplified)
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - i);
      const monthName = monthDate.toLocaleString('default', { month: 'short' });

      // Filter obligations by due date in that month
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

      const monthObligations = obligations.filter(o =>
        new Date(o.dueDate) >= monthStart && new Date(o.dueDate) <= monthEnd
      );
      const monthCompleted = monthObligations.filter(o => o.status === 'completed').length;
      const monthScore = calculateComplianceRate(monthCompleted, monthObligations.length);

      trend.push({
        month: monthName,
        score: monthScore,
        total: monthObligations.length,
        completed: monthCompleted,
      });
    }

    return reply.send({
      overallScore,
      byRegulator,
      byCategory,
      trend,
      generatedAt: now.toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /dashboard/upcoming-deadlines - Get upcoming deadlines
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { days?: number; entityId?: string };
  }>('/dashboard/upcoming-deadlines', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { days = 30, entityId } = request.query;
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    const conditions = [
      eq(schema.complianceObligations.tenantId, tenantId),
      gte(schema.complianceObligations.dueDate, now),
      lte(schema.complianceObligations.dueDate, cutoffDate),
    ];

    if (entityId) {
      conditions.push(eq(schema.complianceObligations.entityId, entityId));
    }

    const deadlines = await db
      .select()
      .from(schema.complianceObligations)
      .where(and(...conditions))
      .orderBy(schema.complianceObligations.dueDate);

    // Also get calendar events
    const calendarConditions = [
      eq(schema.complianceCalendarEvents.tenantId, tenantId),
      gte(schema.complianceCalendarEvents.eventDate, now),
      lte(schema.complianceCalendarEvents.eventDate, cutoffDate),
    ];

    if (entityId) {
      calendarConditions.push(eq(schema.complianceCalendarEvents.entityId, entityId));
    }

    const events = await db
      .select()
      .from(schema.complianceCalendarEvents)
      .where(and(...calendarConditions))
      .orderBy(schema.complianceCalendarEvents.eventDate);

    return reply.send({
      obligations: {
        data: deadlines,
        total: deadlines.length,
      },
      events: {
        data: events,
        total: events.length,
      },
      dateRange: {
        from: now.toISOString(),
        to: cutoffDate.toISOString(),
      },
    });
  });

  // ---------------------------------------------------------------------------
  // GET /dashboard/risk-summary - Get risk summary
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { entityId?: string };
  }>('/dashboard/risk-summary', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId } = request.query;
    const now = new Date();

    // Get obligations
    const oblConditions = entityId
      ? [eq(schema.complianceObligations.tenantId, tenantId), eq(schema.complianceObligations.entityId, entityId)]
      : [eq(schema.complianceObligations.tenantId, tenantId)];

    const obligations = await db
      .select()
      .from(schema.complianceObligations)
      .where(and(...oblConditions));

    // Get controls
    const ctrlConditions = entityId
      ? [eq(schema.controlRequirements.tenantId, tenantId), eq(schema.controlRequirements.entityId, entityId)]
      : [eq(schema.controlRequirements.tenantId, tenantId)];

    const controls = await db
      .select()
      .from(schema.controlRequirements)
      .where(and(...ctrlConditions));

    // Get findings
    const findConditions = entityId
      ? [eq(schema.auditFindings.tenantId, tenantId), eq(schema.auditFindings.entityId, entityId)]
      : [eq(schema.auditFindings.tenantId, tenantId)];

    const findings = await db
      .select()
      .from(schema.auditFindings)
      .where(and(...findConditions));

    // Calculate risk factors
    const riskFactors = [];

    // Overdue obligations
    const overdueObligations = obligations.filter(o =>
      !['completed', 'waived', 'not_applicable'].includes(o.status) &&
      new Date(o.dueDate) < now
    );
    if (overdueObligations.length > 0) {
      riskFactors.push({
        category: 'Compliance',
        factor: 'Overdue Obligations',
        severity: overdueObligations.some(o => o.priority === 'critical') ? 'critical' : 'high',
        count: overdueObligations.length,
        description: `${overdueObligations.length} obligation(s) past due date`,
      });
    }

    // Critical findings
    const criticalFindings = findings.filter(f => f.severity === 'critical' && f.status !== 'closed');
    if (criticalFindings.length > 0) {
      riskFactors.push({
        category: 'Audit',
        factor: 'Critical Findings',
        severity: 'critical',
        count: criticalFindings.length,
        description: `${criticalFindings.length} critical finding(s) open`,
      });
    }

    // Material weaknesses
    const materialWeaknesses = controls.filter(c => c.materialWeakness);
    if (materialWeaknesses.length > 0) {
      riskFactors.push({
        category: 'Controls',
        factor: 'Material Weaknesses',
        severity: 'critical',
        count: materialWeaknesses.length,
        description: `${materialWeaknesses.length} control(s) with material weaknesses`,
      });
    }

    // Deficient controls
    const deficientControls = controls.filter(c => c.status === 'deficient');
    if (deficientControls.length > 0) {
      riskFactors.push({
        category: 'Controls',
        factor: 'Deficient Controls',
        severity: 'high',
        count: deficientControls.length,
        description: `${deficientControls.length} control(s) operating deficiently`,
      });
    }

    // Controls needing testing
    const controlsNeedingTest = controls.filter(c =>
      c.nextTestDueDate && new Date(c.nextTestDueDate) <= now
    );
    if (controlsNeedingTest.length > 0) {
      riskFactors.push({
        category: 'Controls',
        factor: 'Overdue Testing',
        severity: 'medium',
        count: controlsNeedingTest.length,
        description: `${controlsNeedingTest.length} control(s) with overdue testing`,
      });
    }

    // Determine overall risk level
    const hasCritical = riskFactors.some(r => r.severity === 'critical');
    const hasHigh = riskFactors.some(r => r.severity === 'high');
    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (hasCritical) overallRisk = 'critical';
    else if (hasHigh) overallRisk = 'high';
    else if (riskFactors.length > 0) overallRisk = 'medium';

    return reply.send({
      overallRisk,
      riskFactors,
      summary: {
        totalRiskFactors: riskFactors.length,
        criticalFactors: riskFactors.filter(r => r.severity === 'critical').length,
        highFactors: riskFactors.filter(r => r.severity === 'high').length,
        mediumFactors: riskFactors.filter(r => r.severity === 'medium').length,
      },
      generatedAt: now.toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /dashboard/activity-feed - Get recent compliance activity
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { limit?: number; entityId?: string };
  }>('/dashboard/activity-feed', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { limit = 20, entityId } = request.query;

    // Get recent obligations
    const oblConditions = entityId
      ? [eq(schema.complianceObligations.tenantId, tenantId), eq(schema.complianceObligations.entityId, entityId)]
      : [eq(schema.complianceObligations.tenantId, tenantId)];

    const recentObligations = await db
      .select()
      .from(schema.complianceObligations)
      .where(and(...oblConditions))
      .orderBy(desc(schema.complianceObligations.updatedAt))
      .limit(limit);

    // Get recent findings
    const findConditions = entityId
      ? [eq(schema.auditFindings.tenantId, tenantId), eq(schema.auditFindings.entityId, entityId)]
      : [eq(schema.auditFindings.tenantId, tenantId)];

    const recentFindings = await db
      .select()
      .from(schema.auditFindings)
      .where(and(...findConditions))
      .orderBy(desc(schema.auditFindings.updatedAt))
      .limit(limit);

    // Get recent attestations
    const attConditions = entityId
      ? [eq(schema.attestations.tenantId, tenantId), eq(schema.attestations.entityId, entityId)]
      : [eq(schema.attestations.tenantId, tenantId)];

    const recentAttestations = await db
      .select()
      .from(schema.attestations)
      .where(and(...attConditions))
      .orderBy(desc(schema.attestations.updatedAt))
      .limit(limit);

    // Combine and sort by date
    const activities: Array<{
      type: string;
      id: string;
      title: string;
      status: string;
      timestamp: string;
    }> = [];

    for (const obl of recentObligations) {
      activities.push({
        type: 'obligation',
        id: obl.id,
        title: obl.title,
        status: obl.status,
        timestamp: obl.updatedAt.toISOString(),
      });
    }

    for (const find of recentFindings) {
      activities.push({
        type: 'finding',
        id: find.id,
        title: find.title,
        status: find.status,
        timestamp: find.updatedAt.toISOString(),
      });
    }

    for (const att of recentAttestations) {
      activities.push({
        type: 'attestation',
        id: att.id,
        title: att.title,
        status: att.status,
        timestamp: att.updatedAt.toISOString(),
      });
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return reply.send({
      data: activities.slice(0, limit),
      total: activities.length,
    });
  });
}
