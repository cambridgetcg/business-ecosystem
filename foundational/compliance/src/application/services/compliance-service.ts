/**
 * Compliance Service
 *
 * Manages regulatory requirements, obligations, calendar events,
 * audit findings, and compliance tracking.
 */

import { v4 as uuidv4 } from 'uuid';
import { eq, and, isNull, gt, lt, or, desc, asc, lte, gte, between } from 'drizzle-orm';
import type { Database } from '../../infrastructure/persistence/index.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import {
  type RegulatoryRequirement,
  type CreateRequirementInput,
  isRequirementActive,
  calculateDeadline,
} from '../../domain/entities/regulatory-requirement.js';
import {
  type ComplianceObligation,
  type CreateObligationInput,
  type UpdateObligationInput,
  isOverdue,
  getDaysUntilDue,
  calculatePriority,
} from '../../domain/entities/compliance-obligation.js';
import {
  type ComplianceReport,
  type ComplianceCalendarEvent,
  type CreateCalendarEventInput,
  calculateComplianceRate,
  determineRiskLevel,
  generateCalendarEvents,
} from '../../domain/entities/compliance-calendar.js';
import { type AuditFinding } from '../../domain/entities/audit-finding.js';
import { getGlobalEventPublisher } from '../../infrastructure/messaging/index.js';

export class ComplianceService {
  constructor(private readonly db: Database) {}

  // ===========================================================================
  // Regulatory Requirements
  // ===========================================================================

  async createRequirement(input: CreateRequirementInput): Promise<RegulatoryRequirement> {
    const id = uuidv4();
    const now = new Date();

    const [requirement] = await this.db.insert(schema.regulatoryRequirements).values({
      id,
      tenantId: input.tenantId || null,
      regulator: input.regulator,
      regulationName: input.regulationName,
      regulationReference: input.regulationReference || null,
      jurisdiction: input.jurisdiction,
      category: input.category,
      subCategory: input.subCategory || null,
      description: input.description,
      applicabilityConditions: input.applicabilityConditions || null,
      applicableEntityTypes: input.applicableEntityTypes || null,
      thresholds: input.thresholds || null,
      frequency: input.frequency,
      deadlineRule: input.deadlineRule || null,
      gracePeriodDays: input.gracePeriodDays || null,
      penaltyDescription: input.penaltyDescription || null,
      maxPenaltyAmount: input.maxPenaltyAmount || null,
      exemptions: input.exemptions || null,
      effectiveDate: input.effectiveDate,
      sunsetDate: input.sunsetDate || null,
      guidanceUrl: input.guidanceUrl || null,
      formReference: input.formReference || null,
      metadata: input.metadata || null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }).returning();

    return requirement as unknown as RegulatoryRequirement;
  }

  async getRequirement(id: string): Promise<RegulatoryRequirement | null> {
    const [requirement] = await this.db
      .select()
      .from(schema.regulatoryRequirements)
      .where(eq(schema.regulatoryRequirements.id, id));

    return requirement as unknown as RegulatoryRequirement || null;
  }

  async getActiveRequirements(tenantId?: string): Promise<RegulatoryRequirement[]> {
    const conditions = [
      eq(schema.regulatoryRequirements.isActive, true),
      lte(schema.regulatoryRequirements.effectiveDate, new Date()),
    ];

    if (tenantId) {
      conditions.push(
        or(
          eq(schema.regulatoryRequirements.tenantId, tenantId),
          isNull(schema.regulatoryRequirements.tenantId)
        )!
      );
    }

    const requirements = await this.db
      .select()
      .from(schema.regulatoryRequirements)
      .where(and(...conditions));

    return (requirements as unknown as RegulatoryRequirement[])
      .filter(r => isRequirementActive(r));
  }

  // ===========================================================================
  // Compliance Obligations
  // ===========================================================================

  async createObligation(input: CreateObligationInput): Promise<ComplianceObligation> {
    const id = uuidv4();
    const now = new Date();

    // Get requirement details
    const requirement = await this.getRequirement(input.requirementId);
    if (!requirement) {
      throw new Error('Requirement not found');
    }

    const daysUntilDue = Math.ceil(
      (input.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const priority = input.priority || calculatePriority(daysUntilDue, requirement.category);

    const [obligation] = await this.db.insert(schema.complianceObligations).values({
      id,
      tenantId: input.tenantId,
      entityId: input.entityId,
      requirementId: input.requirementId,
      regulator: requirement.regulator,
      jurisdiction: requirement.jurisdiction,
      category: requirement.category,
      title: input.title,
      description: input.description || null,
      formReference: requirement.formReference || null,
      status: 'pending',
      priority,
      periodStart: input.periodStart || null,
      periodEnd: input.periodEnd || null,
      dueDate: input.dueDate,
      assignedTo: input.assignedTo || null,
      filingFee: input.filingFee || null,
      notes: input.notes || null,
      metadata: input.metadata || null,
      tags: input.tags || null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }).returning();

    // Publish ObligationCreated event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishObligationCreated({
        obligationId: id,
        tenantId: input.tenantId,
        entityId: input.entityId,
        requirementId: input.requirementId,
        title: input.title,
        category: requirement.category,
        regulator: requirement.regulator,
        dueDate: input.dueDate.toISOString(),
        priority,
      });
    }

    return obligation as unknown as ComplianceObligation;
  }

  async getObligation(id: string): Promise<ComplianceObligation | null> {
    const [obligation] = await this.db
      .select()
      .from(schema.complianceObligations)
      .where(eq(schema.complianceObligations.id, id));

    return obligation as unknown as ComplianceObligation || null;
  }

  async updateObligation(
    id: string,
    input: UpdateObligationInput,
    updatedBy?: string
  ): Promise<ComplianceObligation | null> {
    // Get existing obligation to detect status change
    const existing = await this.getObligation(id);
    const previousStatus = existing?.status;

    const updates: any = {
      updatedAt: new Date(),
      updatedBy: updatedBy || null,
    };

    if (input.status !== undefined) updates.status = input.status;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.assignedTo !== undefined) updates.assignedTo = input.assignedTo;
    if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
    if (input.notes !== undefined) updates.notes = input.notes;
    if (input.metadata !== undefined) updates.metadata = input.metadata;
    if (input.tags !== undefined) updates.tags = input.tags;

    const [obligation] = await this.db
      .update(schema.complianceObligations)
      .set(updates)
      .where(eq(schema.complianceObligations.id, id))
      .returning();

    if (!obligation) return null;

    // Publish status change events
    const publisher = getGlobalEventPublisher();
    if (publisher && input.status && input.status !== previousStatus) {
      const obl = obligation as unknown as ComplianceObligation;

      if (input.status === 'completed') {
        const daysBeforeDeadline = Math.ceil(
          (obl.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        await publisher.publishObligationCompleted({
          obligationId: id,
          tenantId: obl.tenantId,
          entityId: obl.entityId,
          title: obl.title,
          regulator: obl.regulator,
          completedBy: updatedBy,
          completedAt: new Date().toISOString(),
          daysBeforeDeadline,
        });
      } else if (input.status === 'overdue') {
        await publisher.publishObligationOverdue({
          obligationId: id,
          tenantId: obl.tenantId,
          entityId: obl.entityId,
          title: obl.title,
          regulator: obl.regulator,
          dueDate: obl.dueDate.toISOString(),
          daysOverdue: Math.ceil(
            (Date.now() - obl.dueDate.getTime()) / (1000 * 60 * 60 * 24)
          ),
          priority: obl.priority,
        });
      }
    }

    return obligation as unknown as ComplianceObligation;
  }

  async getObligationsByEntity(
    tenantId: string,
    entityId: string,
    options?: {
      status?: string;
      regulator?: string;
      category?: string;
      dueBefore?: Date;
      dueAfter?: Date;
    }
  ): Promise<ComplianceObligation[]> {
    const conditions = [
      eq(schema.complianceObligations.tenantId, tenantId),
      eq(schema.complianceObligations.entityId, entityId),
    ];

    if (options?.status) {
      conditions.push(eq(schema.complianceObligations.status, options.status));
    }
    if (options?.regulator) {
      conditions.push(eq(schema.complianceObligations.regulator, options.regulator));
    }
    if (options?.category) {
      conditions.push(eq(schema.complianceObligations.category, options.category));
    }
    if (options?.dueBefore) {
      conditions.push(lt(schema.complianceObligations.dueDate, options.dueBefore));
    }
    if (options?.dueAfter) {
      conditions.push(gt(schema.complianceObligations.dueDate, options.dueAfter));
    }

    const obligations = await this.db
      .select()
      .from(schema.complianceObligations)
      .where(and(...conditions))
      .orderBy(asc(schema.complianceObligations.dueDate));

    return obligations as unknown as ComplianceObligation[];
  }

  async getUpcomingDeadlines(
    tenantId: string,
    daysAhead: number = 30
  ): Promise<ComplianceObligation[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const obligations = await this.db
      .select()
      .from(schema.complianceObligations)
      .where(and(
        eq(schema.complianceObligations.tenantId, tenantId),
        lte(schema.complianceObligations.dueDate, futureDate),
        or(
          eq(schema.complianceObligations.status, 'pending'),
          eq(schema.complianceObligations.status, 'in_progress'),
          eq(schema.complianceObligations.status, 'under_review')
        )
      ))
      .orderBy(asc(schema.complianceObligations.dueDate));

    return obligations as unknown as ComplianceObligation[];
  }

  async getOverdueObligations(tenantId: string): Promise<ComplianceObligation[]> {
    const obligations = await this.db
      .select()
      .from(schema.complianceObligations)
      .where(and(
        eq(schema.complianceObligations.tenantId, tenantId),
        lt(schema.complianceObligations.dueDate, new Date()),
        or(
          eq(schema.complianceObligations.status, 'pending'),
          eq(schema.complianceObligations.status, 'in_progress'),
          eq(schema.complianceObligations.status, 'under_review'),
          eq(schema.complianceObligations.status, 'overdue')
        )
      ))
      .orderBy(asc(schema.complianceObligations.dueDate));

    // Update status to overdue
    for (const obligation of obligations) {
      if (obligation.status !== 'overdue') {
        await this.db
          .update(schema.complianceObligations)
          .set({ status: 'overdue', updatedAt: new Date() })
          .where(eq(schema.complianceObligations.id, obligation.id));
      }
    }

    return obligations as unknown as ComplianceObligation[];
  }

  // ===========================================================================
  // Compliance Reports
  // ===========================================================================

  async generateComplianceReport(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    entityId?: string
  ): Promise<ComplianceReport> {
    const id = uuidv4();
    const now = new Date();

    // Get all obligations for the period
    const conditions = [
      eq(schema.complianceObligations.tenantId, tenantId),
      gt(schema.complianceObligations.dueDate, periodStart),
      lt(schema.complianceObligations.dueDate, periodEnd),
    ];

    if (entityId) {
      conditions.push(eq(schema.complianceObligations.entityId, entityId));
    }

    const obligations = await this.db
      .select()
      .from(schema.complianceObligations)
      .where(and(...conditions));

    const total = obligations.length;
    const completed = obligations.filter(o => o.status === 'completed').length;
    const overdue = obligations.filter(o =>
      o.status === 'overdue' || (o.dueDate < now && o.status !== 'completed')
    ).length;
    const pending = obligations.filter(o =>
      o.status === 'pending' || o.status === 'in_progress'
    ).length;

    const complianceRate = calculateComplianceRate(completed, total);
    const riskLevel = determineRiskLevel(
      complianceRate,
      overdue,
      obligations.filter(o => o.priority === 'critical' && o.status !== 'completed').length
    );

    // Breakdown by regulator
    const breakdownByRegulator: Record<string, { total: number; completed: number; overdue: number }> = {};
    for (const o of obligations) {
      if (!breakdownByRegulator[o.regulator]) {
        breakdownByRegulator[o.regulator] = { total: 0, completed: 0, overdue: 0 };
      }
      breakdownByRegulator[o.regulator].total++;
      if (o.status === 'completed') breakdownByRegulator[o.regulator].completed++;
      if (o.status === 'overdue') breakdownByRegulator[o.regulator].overdue++;
    }

    // Breakdown by category
    const breakdownByCategory: Record<string, { total: number; completed: number; overdue: number }> = {};
    for (const o of obligations) {
      if (!breakdownByCategory[o.category]) {
        breakdownByCategory[o.category] = { total: 0, completed: 0, overdue: 0 };
      }
      breakdownByCategory[o.category].total++;
      if (o.status === 'completed') breakdownByCategory[o.category].completed++;
      if (o.status === 'overdue') breakdownByCategory[o.category].overdue++;
    }

    const [report] = await this.db.insert(schema.complianceReports).values({
      id,
      tenantId,
      entityId: entityId || null,
      reportType: 'monthly_summary',
      title: `Compliance Report ${periodStart.toISOString().slice(0, 7)}`,
      periodStart,
      periodEnd,
      obligationsTotal: total,
      obligationsCompleted: completed,
      obligationsOverdue: overdue,
      obligationsPending: pending,
      breakdownByRegulator,
      breakdownByCategory,
      riskLevel,
      complianceRate,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }).returning();

    return report as unknown as ComplianceReport;
  }

  // ===========================================================================
  // Dashboard Metrics
  // ===========================================================================

  async getDashboardMetrics(tenantId: string): Promise<{
    totalObligations: number;
    completed: number;
    pending: number;
    overdue: number;
    upcomingThisWeek: number;
    complianceRate: number;
    byRegulator: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const obligations = await this.db
      .select()
      .from(schema.complianceObligations)
      .where(eq(schema.complianceObligations.tenantId, tenantId));

    const total = obligations.length;
    const completed = obligations.filter(o => o.status === 'completed').length;
    const pending = obligations.filter(o =>
      o.status === 'pending' || o.status === 'in_progress'
    ).length;
    const overdue = obligations.filter(o =>
      o.status === 'overdue' || (o.dueDate < now && !['completed', 'waived', 'not_applicable'].includes(o.status))
    ).length;
    const upcomingThisWeek = obligations.filter(o =>
      o.dueDate >= now && o.dueDate <= weekFromNow && o.status !== 'completed'
    ).length;

    const byRegulator: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const o of obligations) {
      byRegulator[o.regulator] = (byRegulator[o.regulator] || 0) + 1;
      byCategory[o.category] = (byCategory[o.category] || 0) + 1;
    }

    return {
      totalObligations: total,
      completed,
      pending,
      overdue,
      upcomingThisWeek,
      complianceRate: calculateComplianceRate(completed, total),
      byRegulator,
      byCategory,
    };
  }

  // ===========================================================================
  // Calendar Events
  // ===========================================================================

  async createCalendarEvent(input: CreateCalendarEventInput): Promise<ComplianceCalendarEvent> {
    const id = uuidv4();
    const now = new Date();

    const [event] = await this.db.insert(schema.complianceCalendarEvents).values({
      id,
      tenantId: input.tenantId,
      entityId: input.entityId || null,
      title: input.title,
      description: input.description || null,
      eventType: input.eventType,
      status: 'scheduled',
      regulator: input.regulator || null,
      category: input.category || null,
      obligationId: input.obligationId || null,
      requirementId: input.requirementId || null,
      eventDate: input.eventDate,
      eventEndDate: input.eventEndDate || null,
      allDay: input.allDay ?? true,
      isRecurring: input.isRecurring ?? false,
      recurrenceRule: input.recurrenceRule || null,
      reminderDays: input.reminderDays || null,
      assignedTo: input.assignedTo || null,
      metadata: input.metadata || null,
      createdAt: now,
      updatedAt: now,
    }).returning();

    return event as unknown as ComplianceCalendarEvent;
  }

  async getCalendarEvent(id: string): Promise<ComplianceCalendarEvent | null> {
    const [event] = await this.db
      .select()
      .from(schema.complianceCalendarEvents)
      .where(eq(schema.complianceCalendarEvents.id, id));

    return event as unknown as ComplianceCalendarEvent || null;
  }

  async updateCalendarEvent(
    id: string,
    input: Partial<CreateCalendarEventInput> & { status?: string; completedAt?: Date; completedBy?: string; completionNotes?: string },
    updatedBy?: string
  ): Promise<ComplianceCalendarEvent | null> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: updatedBy || null,
    };

    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.eventType !== undefined) updates.eventType = input.eventType;
    if (input.status !== undefined) updates.status = input.status;
    if (input.eventDate !== undefined) updates.eventDate = input.eventDate;
    if (input.eventEndDate !== undefined) updates.eventEndDate = input.eventEndDate;
    if (input.assignedTo !== undefined) updates.assignedTo = input.assignedTo;
    if (input.completedAt !== undefined) updates.completedAt = input.completedAt;
    if (input.completedBy !== undefined) updates.completedBy = input.completedBy;
    if (input.completionNotes !== undefined) updates.completionNotes = input.completionNotes;
    if (input.metadata !== undefined) updates.metadata = input.metadata;

    const [event] = await this.db
      .update(schema.complianceCalendarEvents)
      .set(updates)
      .where(eq(schema.complianceCalendarEvents.id, id))
      .returning();

    return event as unknown as ComplianceCalendarEvent || null;
  }

  async deleteCalendarEvent(id: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.complianceCalendarEvents)
      .where(eq(schema.complianceCalendarEvents.id, id));

    return true;
  }

  async getCalendarEventsByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    entityId?: string
  ): Promise<ComplianceCalendarEvent[]> {
    const conditions = [
      eq(schema.complianceCalendarEvents.tenantId, tenantId),
      gte(schema.complianceCalendarEvents.eventDate, startDate),
      lte(schema.complianceCalendarEvents.eventDate, endDate),
    ];

    if (entityId) {
      conditions.push(eq(schema.complianceCalendarEvents.entityId, entityId));
    }

    const events = await this.db
      .select()
      .from(schema.complianceCalendarEvents)
      .where(and(...conditions))
      .orderBy(asc(schema.complianceCalendarEvents.eventDate));

    return events as unknown as ComplianceCalendarEvent[];
  }

  async createCalendarEventsForObligation(obligation: ComplianceObligation): Promise<ComplianceCalendarEvent[]> {
    const eventTemplates = generateCalendarEvents({
      id: obligation.id,
      tenantId: obligation.tenantId,
      entityId: obligation.entityId,
      title: obligation.title,
      regulator: obligation.regulator,
      category: obligation.category,
      dueDate: obligation.dueDate,
    });

    const createdEvents: ComplianceCalendarEvent[] = [];

    for (const template of eventTemplates) {
      const event = await this.createCalendarEvent({
        tenantId: template.tenantId!,
        entityId: template.entityId || undefined,
        title: template.title!,
        description: template.title,
        eventType: template.eventType!,
        regulator: template.regulator || undefined,
        category: template.category || undefined,
        obligationId: template.obligationId || undefined,
        eventDate: template.eventDate!,
        allDay: template.allDay,
        reminderDays: template.reminderDays as number[] || undefined,
      });
      createdEvents.push(event);
    }

    return createdEvents;
  }

  // ===========================================================================
  // Audit Findings
  // ===========================================================================

  async createFinding(input: {
    tenantId: string;
    entityId: string;
    title: string;
    description: string;
    findingType: string;
    severity: string;
    auditType: string;
    auditDate: Date;
    auditorName?: string;
    auditReference?: string;
    regulator?: string;
    requirementId?: string;
    obligationId?: string;
    remediationPlan?: string;
    remediationDueDate?: Date;
    assignedTo?: string;
    assignedToName?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditFinding> {
    const id = uuidv4();
    const now = new Date();

    const [finding] = await this.db.insert(schema.auditFindings).values({
      id,
      tenantId: input.tenantId,
      entityId: input.entityId,
      title: input.title,
      description: input.description,
      findingType: input.findingType,
      severity: input.severity,
      status: 'open',
      auditType: input.auditType,
      auditDate: input.auditDate,
      auditorName: input.auditorName || null,
      auditReference: input.auditReference || null,
      regulator: input.regulator || null,
      requirementId: input.requirementId || null,
      obligationId: input.obligationId || null,
      remediationPlan: input.remediationPlan || null,
      remediationDueDate: input.remediationDueDate || null,
      assignedTo: input.assignedTo || null,
      assignedToName: input.assignedToName || null,
      metadata: input.metadata || null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }).returning();

    // Publish event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publishFindingCreated({
        findingId: id,
        tenantId: input.tenantId,
        entityId: input.entityId,
        title: input.title,
        severity: input.severity,
        auditType: input.auditType,
        regulator: input.regulator,
        remediationDueDate: input.remediationDueDate?.toISOString(),
      });
    }

    return finding as unknown as AuditFinding;
  }

  async getFinding(id: string): Promise<AuditFinding | null> {
    const [finding] = await this.db
      .select()
      .from(schema.auditFindings)
      .where(eq(schema.auditFindings.id, id));

    return finding as unknown as AuditFinding || null;
  }

  async updateFinding(
    id: string,
    input: {
      status?: string;
      remediationPlan?: string;
      remediationDueDate?: Date;
      remediationCompletedDate?: Date;
      remediationNotes?: string;
      assignedTo?: string;
      assignedToName?: string;
      evidenceDocuments?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
    updatedBy?: string
  ): Promise<AuditFinding | null> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: updatedBy || null,
    };

    if (input.status !== undefined) updates.status = input.status;
    if (input.remediationPlan !== undefined) updates.remediationPlan = input.remediationPlan;
    if (input.remediationDueDate !== undefined) updates.remediationDueDate = input.remediationDueDate;
    if (input.remediationCompletedDate !== undefined) updates.remediationCompletedDate = input.remediationCompletedDate;
    if (input.remediationNotes !== undefined) updates.remediationNotes = input.remediationNotes;
    if (input.assignedTo !== undefined) updates.assignedTo = input.assignedTo;
    if (input.assignedToName !== undefined) updates.assignedToName = input.assignedToName;
    if (input.evidenceDocuments !== undefined) updates.evidenceDocuments = input.evidenceDocuments;
    if (input.metadata !== undefined) updates.metadata = input.metadata;

    const [finding] = await this.db
      .update(schema.auditFindings)
      .set(updates)
      .where(eq(schema.auditFindings.id, id))
      .returning();

    return finding as unknown as AuditFinding || null;
  }

  async closeFinding(
    id: string,
    input: {
      remediationNotes?: string;
      evidenceDocuments?: Record<string, unknown>;
    },
    closedBy?: string
  ): Promise<AuditFinding | null> {
    const finding = await this.getFinding(id);
    if (!finding) return null;

    const [updated] = await this.db
      .update(schema.auditFindings)
      .set({
        status: 'closed',
        remediationCompletedDate: new Date(),
        remediationNotes: input.remediationNotes || null,
        evidenceDocuments: input.evidenceDocuments || null,
        updatedAt: new Date(),
        updatedBy: closedBy || null,
      })
      .where(eq(schema.auditFindings.id, id))
      .returning();

    // Publish event
    const publisher = getGlobalEventPublisher();
    if (publisher && updated) {
      await publisher.publishFindingClosed({
        findingId: id,
        tenantId: (finding as any).tenantId,
        entityId: (finding as any).entityId,
        title: (finding as any).title,
        severity: (finding as any).severity,
        closedAt: new Date().toISOString(),
        closedBy,
        remediationSummary: input.remediationNotes,
      });
    }

    return updated as unknown as AuditFinding || null;
  }

  async getFindingsByEntity(
    tenantId: string,
    entityId: string,
    options?: {
      status?: string;
      severity?: string;
      auditType?: string;
    }
  ): Promise<AuditFinding[]> {
    const conditions = [
      eq(schema.auditFindings.tenantId, tenantId),
      eq(schema.auditFindings.entityId, entityId),
    ];

    if (options?.status) {
      conditions.push(eq(schema.auditFindings.status, options.status));
    }
    if (options?.severity) {
      conditions.push(eq(schema.auditFindings.severity, options.severity));
    }
    if (options?.auditType) {
      conditions.push(eq(schema.auditFindings.auditType, options.auditType));
    }

    const findings = await this.db
      .select()
      .from(schema.auditFindings)
      .where(and(...conditions))
      .orderBy(desc(schema.auditFindings.auditDate));

    return findings as unknown as AuditFinding[];
  }

  async getOpenFindings(tenantId: string): Promise<AuditFinding[]> {
    const findings = await this.db
      .select()
      .from(schema.auditFindings)
      .where(and(
        eq(schema.auditFindings.tenantId, tenantId),
        or(
          eq(schema.auditFindings.status, 'open'),
          eq(schema.auditFindings.status, 'in_remediation'),
          eq(schema.auditFindings.status, 'pending_verification')
        )
      ))
      .orderBy(desc(schema.auditFindings.severity), asc(schema.auditFindings.remediationDueDate));

    return findings as unknown as AuditFinding[];
  }

  // ===========================================================================
  // Escalation
  // ===========================================================================

  async escalateObligation(
    obligationId: string,
    input: {
      escalatedTo: string;
      escalationReason: string;
    },
    escalatedBy?: string
  ): Promise<ComplianceObligation | null> {
    const obligation = await this.getObligation(obligationId);
    if (!obligation) return null;

    const [updated] = await this.db
      .update(schema.complianceObligations)
      .set({
        escalated: true,
        escalatedAt: new Date(),
        escalatedTo: input.escalatedTo,
        escalationReason: input.escalationReason,
        updatedAt: new Date(),
        updatedBy: escalatedBy || null,
      })
      .where(eq(schema.complianceObligations.id, obligationId))
      .returning();

    // Publish event
    const publisher = getGlobalEventPublisher();
    if (publisher && updated) {
      await publisher.publishObligationEscalated({
        obligationId,
        tenantId: obligation.tenantId,
        entityId: obligation.entityId,
        title: obligation.title,
        escalatedTo: input.escalatedTo,
        escalationReason: input.escalationReason,
        previousAssignee: obligation.assignedTo || undefined,
      });
    }

    return updated as unknown as ComplianceObligation || null;
  }

  // ===========================================================================
  // Compliance Report Management
  // ===========================================================================

  async getReport(id: string): Promise<ComplianceReport | null> {
    const [report] = await this.db
      .select()
      .from(schema.complianceReports)
      .where(eq(schema.complianceReports.id, id));

    return report as unknown as ComplianceReport || null;
  }

  async approveReport(
    id: string,
    approvedBy: string
  ): Promise<ComplianceReport | null> {
    const [report] = await this.db
      .update(schema.complianceReports)
      .set({
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: approvedBy,
      })
      .where(eq(schema.complianceReports.id, id))
      .returning();

    return report as unknown as ComplianceReport || null;
  }

  async getReportsByPeriod(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ComplianceReport[]> {
    const reports = await this.db
      .select()
      .from(schema.complianceReports)
      .where(and(
        eq(schema.complianceReports.tenantId, tenantId),
        gte(schema.complianceReports.periodStart, periodStart),
        lte(schema.complianceReports.periodEnd, periodEnd)
      ))
      .orderBy(desc(schema.complianceReports.createdAt));

    return reports as unknown as ComplianceReport[];
  }

  // ===========================================================================
  // Analytics
  // ===========================================================================

  async getComplianceScore(tenantId: string, entityId?: string): Promise<{
    overall: number;
    byDimension: Record<string, number>;
    trend: 'improving' | 'stable' | 'declining';
  }> {
    const metrics = await this.getDashboardMetrics(tenantId);
    const findings = await this.getOpenFindings(tenantId);

    // Calculate overall score (0-100)
    let overall = metrics.complianceRate;

    // Penalty for open findings
    const criticalFindings = findings.filter(f => (f as any).severity === 'critical').length;
    const highFindings = findings.filter(f => (f as any).severity === 'high').length;

    overall -= criticalFindings * 10;
    overall -= highFindings * 5;
    overall = Math.max(0, Math.min(100, overall));

    // Breakdown by dimension
    const byDimension: Record<string, number> = {
      obligations: metrics.complianceRate,
      findings: Math.max(0, 100 - (criticalFindings * 20 + highFindings * 10)),
      timeliness: metrics.overdue === 0 ? 100 : Math.max(0, 100 - metrics.overdue * 10),
    };

    // Trend (simplified - would need historical data in production)
    const trend: 'improving' | 'stable' | 'declining' =
      metrics.overdue > 5 ? 'declining' :
      metrics.overdue > 0 ? 'stable' : 'improving';

    return { overall, byDimension, trend };
  }
}
