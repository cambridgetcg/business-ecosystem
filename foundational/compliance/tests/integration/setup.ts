/**
 * Integration Test Setup
 *
 * Provides mocked database, services, and event handlers for testing.
 */

import { vi } from 'vitest';
import type { ComplianceObligation, CreateObligationInput } from '../../src/domain/entities/compliance-obligation.js';
import type { RegulatoryRequirement, CreateRequirementInput } from '../../src/domain/entities/regulatory-requirement.js';
import type { AuditFinding } from '../../src/domain/entities/audit-finding.js';
import type { ComplianceCalendarEvent } from '../../src/domain/entities/compliance-calendar.js';

// =============================================================================
// Mock Data Generators
// =============================================================================

export function createMockRequirement(
  overrides: Partial<RegulatoryRequirement> = {}
): RegulatoryRequirement {
  const id = overrides.id || `req-${Date.now()}`;
  return {
    id,
    tenantId: null,
    regulator: 'companies_house',
    regulationName: 'Annual Accounts Filing',
    regulationReference: 'CA2006',
    jurisdiction: 'GB',
    category: 'corporate_filing',
    subCategory: 'annual_accounts',
    description: 'File annual accounts with Companies House',
    applicabilityConditions: null,
    applicableEntityTypes: ['limited_company', 'plc'],
    thresholds: null,
    frequency: 'annual',
    deadlineRule: '9 months after financial year end',
    gracePeriodDays: 0,
    penaltyDescription: 'Late filing penalty from £150 to £1,500',
    maxPenaltyAmount: 1500,
    exemptions: null,
    effectiveDate: new Date('2020-01-01'),
    sunsetDate: null,
    guidanceUrl: 'https://www.gov.uk/annual-accounts',
    formReference: 'AA01',
    isActive: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

export function createMockObligation(
  overrides: Partial<ComplianceObligation> = {}
): ComplianceObligation {
  const id = overrides.id || `obl-${Date.now()}`;
  return {
    id,
    tenantId: 'tenant-123',
    entityId: 'entity-123',
    requirementId: 'req-123',
    regulator: 'companies_house',
    jurisdiction: 'GB',
    category: 'corporate_filing',
    title: 'Annual Accounts Filing 2024',
    description: 'File annual accounts for financial year 2024',
    formReference: 'AA01',
    status: 'pending',
    priority: 'medium',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-12-31'),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    originalDueDate: null,
    assignedTo: null,
    reviewedBy: null,
    reviewedAt: null,
    submittedAt: null,
    submissionReference: null,
    completedAt: null,
    completedBy: null,
    filingFee: null,
    evidenceDocuments: null,
    escalatedAt: null,
    escalatedTo: null,
    escalationReason: null,
    notes: null,
    metadata: null,
    tags: null,
    createdAt: new Date(),
    createdBy: null,
    updatedAt: new Date(),
    updatedBy: null,
    version: 1,
    deletedAt: null,
    ...overrides,
  };
}

export function createMockFinding(
  overrides: Partial<AuditFinding> = {}
): AuditFinding {
  const id = overrides.id || `find-${Date.now()}`;
  return {
    id,
    tenantId: 'tenant-123',
    entityId: 'entity-123',
    title: 'Compliance Gap Identified',
    description: 'Annual accounts not filed on time',
    findingType: 'compliance_gap',
    severity: 'medium',
    status: 'open',
    auditType: 'internal_review',
    auditId: null,
    auditor: null,
    auditDate: new Date(),
    regulator: 'companies_house',
    obligationId: null,
    rootCause: null,
    remediationPlan: null,
    remediationDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    remediationOwner: null,
    remediationCompletedAt: null,
    remediationNotes: null,
    evidenceDocuments: null,
    recurrenceRisk: null,
    closedAt: null,
    closedBy: null,
    closureNotes: null,
    metadata: null,
    createdAt: new Date(),
    createdBy: null,
    updatedAt: new Date(),
    updatedBy: null,
    version: 1,
    ...overrides,
  };
}

export function createMockCalendarEvent(
  overrides: Partial<ComplianceCalendarEvent> = {}
): ComplianceCalendarEvent {
  return {
    id: overrides.id || `cal-${Date.now()}`,
    tenantId: 'tenant-123',
    entityId: 'entity-123',
    obligationId: 'obl-123',
    eventType: 'deadline',
    title: 'Annual Accounts Deadline',
    description: 'Deadline for annual accounts filing',
    eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'scheduled',
    priority: 'medium',
    recurrence: null,
    reminders: [7, 3, 1],
    lastReminderSent: null,
    assignedTo: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

// =============================================================================
// Mock Service
// =============================================================================

export interface MockComplianceServiceConfig {
  requirements?: Map<string, RegulatoryRequirement>;
  obligations?: Map<string, ComplianceObligation>;
  findings?: Map<string, AuditFinding>;
  calendarEvents?: Map<string, ComplianceCalendarEvent>;
}

export class MockComplianceService {
  private requirements: Map<string, RegulatoryRequirement>;
  private obligations: Map<string, ComplianceObligation>;
  private findings: Map<string, AuditFinding>;
  private calendarEvents: Map<string, ComplianceCalendarEvent>;

  constructor(config: MockComplianceServiceConfig = {}) {
    this.requirements = config.requirements || new Map();
    this.obligations = config.obligations || new Map();
    this.findings = config.findings || new Map();
    this.calendarEvents = config.calendarEvents || new Map();
  }

  // Requirements
  async createRequirement(input: CreateRequirementInput): Promise<RegulatoryRequirement> {
    const requirement = createMockRequirement({
      ...input,
      id: `req-${Date.now()}`,
    } as any);
    this.requirements.set(requirement.id, requirement);
    return requirement;
  }

  async getRequirement(id: string): Promise<RegulatoryRequirement | null> {
    return this.requirements.get(id) || null;
  }

  async getActiveRequirements(tenantId?: string): Promise<RegulatoryRequirement[]> {
    return Array.from(this.requirements.values()).filter(r => r.isActive);
  }

  // Obligations
  async createObligation(input: CreateObligationInput): Promise<ComplianceObligation> {
    const requirement = await this.getRequirement(input.requirementId);
    if (!requirement) throw new Error('Requirement not found');

    const obligation = createMockObligation({
      ...input,
      id: `obl-${Date.now()}`,
      regulator: requirement.regulator,
      jurisdiction: requirement.jurisdiction,
      category: requirement.category,
    } as any);
    this.obligations.set(obligation.id, obligation);
    return obligation;
  }

  async getObligation(id: string): Promise<ComplianceObligation | null> {
    return this.obligations.get(id) || null;
  }

  async updateObligation(
    id: string,
    input: Partial<ComplianceObligation>,
    updatedBy?: string
  ): Promise<ComplianceObligation | null> {
    const existing = this.obligations.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...input,
      updatedAt: new Date(),
      updatedBy,
    };
    this.obligations.set(id, updated);
    return updated;
  }

  async getObligationsByEntity(
    tenantId: string,
    entityId: string,
    filters?: { status?: string; category?: string }
  ): Promise<ComplianceObligation[]> {
    return Array.from(this.obligations.values()).filter(o => {
      if (o.tenantId !== tenantId) return false;
      if (o.entityId !== entityId) return false;
      if (filters?.status && o.status !== filters.status) return false;
      if (filters?.category && o.category !== filters.category) return false;
      return true;
    });
  }

  async getOverdueObligations(tenantId: string): Promise<ComplianceObligation[]> {
    const now = new Date();
    return Array.from(this.obligations.values()).filter(o =>
      o.tenantId === tenantId &&
      o.status === 'pending' &&
      o.dueDate < now
    );
  }

  async getUpcomingDeadlines(tenantId: string, daysAhead: number): Promise<ComplianceObligation[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    return Array.from(this.obligations.values()).filter(o =>
      o.tenantId === tenantId &&
      ['pending', 'in_progress'].includes(o.status) &&
      o.dueDate >= now &&
      o.dueDate <= futureDate
    );
  }

  // Findings
  async createFinding(input: any): Promise<AuditFinding> {
    const finding = createMockFinding({
      ...input,
      id: `find-${Date.now()}`,
    });
    this.findings.set(finding.id, finding);
    return finding;
  }

  async getFinding(id: string): Promise<AuditFinding | null> {
    return this.findings.get(id) || null;
  }

  async updateFinding(
    id: string,
    input: Partial<AuditFinding>,
    updatedBy?: string
  ): Promise<AuditFinding | null> {
    const existing = this.findings.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...input,
      updatedAt: new Date(),
      updatedBy,
    };
    this.findings.set(id, updated);
    return updated;
  }

  async closeFinding(id: string, notes: string, closedBy?: string): Promise<AuditFinding | null> {
    return this.updateFinding(id, {
      status: 'closed',
      closedAt: new Date(),
      closedBy,
      closureNotes: notes,
    }, closedBy);
  }

  // Calendar
  async createCalendarEvent(input: any): Promise<ComplianceCalendarEvent> {
    const event = createMockCalendarEvent({
      ...input,
      id: `cal-${Date.now()}`,
    });
    this.calendarEvents.set(event.id, event);
    return event;
  }

  async getCalendarEventsByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceCalendarEvent[]> {
    return Array.from(this.calendarEvents.values()).filter(e =>
      e.tenantId === tenantId &&
      e.eventDate >= startDate &&
      e.eventDate <= endDate
    );
  }

  // Reports
  async generateComplianceReport(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    entityId?: string
  ): Promise<{ id: string; complianceRate: number }> {
    const obligations = Array.from(this.obligations.values()).filter(o =>
      o.tenantId === tenantId &&
      (!entityId || o.entityId === entityId) &&
      o.dueDate >= periodStart &&
      o.dueDate <= periodEnd
    );

    const completed = obligations.filter(o => o.status === 'completed').length;
    const rate = obligations.length > 0 ? (completed / obligations.length) * 100 : 100;

    return {
      id: `report-${Date.now()}`,
      complianceRate: Math.round(rate * 100) / 100,
    };
  }

  async getDashboardMetrics(tenantId: string): Promise<any> {
    const obligations = Array.from(this.obligations.values()).filter(o => o.tenantId === tenantId);
    const findings = Array.from(this.findings.values()).filter(f => f.tenantId === tenantId);

    const now = new Date();
    const overdue = obligations.filter(o => o.status === 'pending' && o.dueDate < now).length;
    const upcoming = obligations.filter(o => {
      const days = Math.ceil((o.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return o.status === 'pending' && days >= 0 && days <= 30;
    }).length;

    return {
      totalObligations: obligations.length,
      overdueObligations: overdue,
      upcomingDeadlines: upcoming,
      openFindings: findings.filter(f => f.status === 'open').length,
      complianceRate: obligations.length > 0
        ? (obligations.filter(o => o.status === 'completed').length / obligations.length) * 100
        : 100,
    };
  }

  // Expose internal state for testing
  _getObligations(): Map<string, ComplianceObligation> {
    return this.obligations;
  }

  _getFindings(): Map<string, AuditFinding> {
    return this.findings;
  }
}

// =============================================================================
// Event Test Helpers
// =============================================================================

export function createDomainEvent(
  eventType: string,
  data: Record<string, unknown>,
  overrides: Partial<{
    event_id: string;
    timestamp: string;
    source: string;
    correlation_id: string;
    user_id: string;
    version: number;
  }> = {}
): any {
  return {
    event_type: eventType,
    event_id: overrides.event_id || `evt-${Date.now()}`,
    timestamp: overrides.timestamp || new Date().toISOString(),
    source: overrides.source || 'test-service',
    correlation_id: overrides.correlation_id || 'tenant-123',
    user_id: overrides.user_id,
    version: overrides.version || 1,
    data,
  };
}

export function clearMocks() {
  vi.clearAllMocks();
  vi.restoreAllMocks();
}
