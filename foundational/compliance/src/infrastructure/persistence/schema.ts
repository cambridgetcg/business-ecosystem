/**
 * Compliance Database Schema
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  real,
} from 'drizzle-orm/pg-core';

// =============================================================================
// Regulatory Requirements Table
// =============================================================================

export const regulatoryRequirements = pgTable('regulatory_requirements', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),

  // Regulator details
  regulator: varchar('regulator', { length: 50 }).notNull(),
  regulationName: varchar('regulation_name', { length: 255 }).notNull(),
  regulationReference: varchar('regulation_reference', { length: 100 }),
  jurisdiction: varchar('jurisdiction', { length: 30 }).notNull(),

  // Classification
  category: varchar('category', { length: 50 }).notNull(),
  subCategory: varchar('sub_category', { length: 100 }),
  description: text('description').notNull(),

  // Applicability
  applicabilityConditions: jsonb('applicability_conditions'),
  applicableEntityTypes: jsonb('applicable_entity_types'),
  thresholds: jsonb('thresholds'),

  // Timing
  frequency: varchar('frequency', { length: 30 }).notNull(),
  deadlineRule: varchar('deadline_rule', { length: 500 }),
  gracePeriodDays: integer('grace_period_days'),

  // Penalties
  penaltyDescription: text('penalty_description'),
  maxPenaltyAmount: real('max_penalty_amount'),
  penaltyCurrency: varchar('penalty_currency', { length: 3 }).notNull().default('GBP'),

  // Exemptions
  exemptions: jsonb('exemptions'),
  exemptionConditions: jsonb('exemption_conditions'),

  // Validity
  effectiveDate: timestamp('effective_date').notNull(),
  sunsetDate: timestamp('sunset_date'),
  isActive: boolean('is_active').notNull().default(true),

  // Documentation
  guidanceUrl: text('guidance_url'),
  formReference: varchar('form_reference', { length: 50 }),

  // Audit
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
}, (table) => ({
  tenantIdx: index('reg_requirements_tenant_idx').on(table.tenantId),
  regulatorIdx: index('reg_requirements_regulator_idx').on(table.regulator),
  categoryIdx: index('reg_requirements_category_idx').on(table.category),
  activeIdx: index('reg_requirements_active_idx').on(table.isActive),
}));

// =============================================================================
// Compliance Obligations Table
// =============================================================================

export const complianceObligations = pgTable('compliance_obligations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  requirementId: uuid('requirement_id').notNull(),

  // Regulator reference
  regulator: varchar('regulator', { length: 50 }).notNull(),
  jurisdiction: varchar('jurisdiction', { length: 30 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),

  // Obligation details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  formReference: varchar('form_reference', { length: 50 }),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),

  // Timing
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  dueDate: timestamp('due_date').notNull(),
  submittedDate: timestamp('submitted_date'),
  completedDate: timestamp('completed_date'),

  // Assignment
  assignedTo: uuid('assigned_to'),
  assignedToName: varchar('assigned_to_name', { length: 255 }),
  assignedAt: timestamp('assigned_at'),

  // Review
  reviewedBy: uuid('reviewed_by'),
  reviewedByName: varchar('reviewed_by_name', { length: 255 }),
  reviewedDate: timestamp('reviewed_date'),
  reviewNotes: text('review_notes'),

  // Completion
  completedBy: uuid('completed_by'),
  completedByName: varchar('completed_by_name', { length: 255 }),
  completionNotes: text('completion_notes'),

  // Evidence
  evidenceDocuments: jsonb('evidence_documents'),

  // External references
  submissionReference: varchar('submission_reference', { length: 100 }),
  externalUrl: text('external_url'),

  // Reminders and escalation
  reminderSentAt: timestamp('reminder_sent_at'),
  escalated: boolean('escalated').notNull().default(false),
  escalatedAt: timestamp('escalated_at'),
  escalatedTo: uuid('escalated_to'),
  escalationReason: text('escalation_reason'),

  // Cost tracking
  filingFee: real('filing_fee'),
  penaltyAmount: real('penalty_amount'),
  totalCost: real('total_cost'),

  // Audit
  notes: text('notes'),
  metadata: jsonb('metadata'),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
}, (table) => ({
  tenantIdx: index('obligations_tenant_idx').on(table.tenantId),
  entityIdx: index('obligations_entity_idx').on(table.entityId),
  requirementIdx: index('obligations_requirement_idx').on(table.requirementId),
  statusIdx: index('obligations_status_idx').on(table.status),
  dueDateIdx: index('obligations_due_date_idx').on(table.dueDate),
  regulatorIdx: index('obligations_regulator_idx').on(table.regulator),
}));

// =============================================================================
// Compliance Calendar Events Table
// =============================================================================

export const complianceCalendarEvents = pgTable('compliance_calendar_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id'),

  // Event details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  eventType: varchar('event_type', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('scheduled'),

  // Regulatory context
  regulator: varchar('regulator', { length: 50 }),
  category: varchar('category', { length: 50 }),
  obligationId: uuid('obligation_id'),
  requirementId: uuid('requirement_id'),

  // Timing
  eventDate: timestamp('event_date').notNull(),
  eventEndDate: timestamp('event_end_date'),
  allDay: boolean('all_day').notNull().default(true),
  timeZone: varchar('time_zone', { length: 50 }).notNull().default('Europe/London'),

  // Recurrence
  isRecurring: boolean('is_recurring').notNull().default(false),
  recurrenceRule: varchar('recurrence_rule', { length: 255 }),
  parentEventId: uuid('parent_event_id'),

  // Reminders
  reminderDays: jsonb('reminder_days'),
  remindersSent: jsonb('reminders_sent'),

  // Assignment
  assignedTo: jsonb('assigned_to'),

  // Completion
  completedAt: timestamp('completed_at'),
  completedBy: uuid('completed_by'),
  completionNotes: text('completion_notes'),

  // Audit
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  tenantIdx: index('calendar_events_tenant_idx').on(table.tenantId),
  entityIdx: index('calendar_events_entity_idx').on(table.entityId),
  eventDateIdx: index('calendar_events_event_date_idx').on(table.eventDate),
  obligationIdx: index('calendar_events_obligation_idx').on(table.obligationId),
}));

// =============================================================================
// Compliance Reports Table
// =============================================================================

export const complianceReports = pgTable('compliance_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id'),

  // Report details
  reportType: varchar('report_type', { length: 30 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),

  // Content
  summary: text('summary'),
  obligationsTotal: integer('obligations_total').notNull(),
  obligationsCompleted: integer('obligations_completed').notNull(),
  obligationsOverdue: integer('obligations_overdue').notNull(),
  obligationsPending: integer('obligations_pending').notNull(),

  // Breakdown
  breakdownByRegulator: jsonb('breakdown_by_regulator'),
  breakdownByCategory: jsonb('breakdown_by_category'),

  // Risk assessment
  riskLevel: varchar('risk_level', { length: 20 }).notNull(),
  riskNotes: text('risk_notes'),

  // Metrics
  complianceRate: real('compliance_rate').notNull(),
  averageCompletionDays: real('average_completion_days'),
  totalPenalties: real('total_penalties'),

  // Actions
  recommendedActions: jsonb('recommended_actions'),
  escalationItems: jsonb('escalation_items'),

  // Status
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),
  distributedTo: jsonb('distributed_to'),
  distributedAt: timestamp('distributed_at'),

  // Storage
  documentStorageKey: varchar('document_storage_key', { length: 500 }),

  // Audit
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
}, (table) => ({
  tenantIdx: index('reports_tenant_idx').on(table.tenantId),
  entityIdx: index('reports_entity_idx').on(table.entityId),
  periodIdx: index('reports_period_idx').on(table.periodStart, table.periodEnd),
}));

// =============================================================================
// Audit Findings Table
// =============================================================================

export const auditFindings = pgTable('audit_findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),

  // Finding details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  findingType: varchar('finding_type', { length: 30 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('open'),

  // Source
  auditType: varchar('audit_type', { length: 30 }).notNull(),
  auditDate: timestamp('audit_date').notNull(),
  auditorName: varchar('auditor_name', { length: 255 }),
  auditReference: varchar('audit_reference', { length: 100 }),

  // Regulatory context
  regulator: varchar('regulator', { length: 50 }),
  requirementId: uuid('requirement_id'),
  obligationId: uuid('obligation_id'),

  // Remediation
  remediationPlan: text('remediation_plan'),
  remediationDueDate: timestamp('remediation_due_date'),
  remediationCompletedDate: timestamp('remediation_completed_date'),
  remediationNotes: text('remediation_notes'),

  // Assignment
  assignedTo: uuid('assigned_to'),
  assignedToName: varchar('assigned_to_name', { length: 255 }),

  // Evidence
  evidenceDocuments: jsonb('evidence_documents'),

  // Audit
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
}, (table) => ({
  tenantIdx: index('findings_tenant_idx').on(table.tenantId),
  entityIdx: index('findings_entity_idx').on(table.entityId),
  statusIdx: index('findings_status_idx').on(table.status),
  severityIdx: index('findings_severity_idx').on(table.severity),
}));

// =============================================================================
// BOI Filings Table (Corporate Transparency Act)
// =============================================================================

export const boiFilings = pgTable('boi_filings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),

  // Filing details
  filingType: varchar('filing_type', { length: 20 }).notNull(), // initial, updated, corrected
  status: varchar('status', { length: 30 }).notNull().default('draft'),

  // Exemption
  isExempt: boolean('is_exempt').notNull().default(false),
  exemptionReason: varchar('exemption_reason', { length: 50 }),
  exemptionJustification: text('exemption_justification'),

  // Beneficial owners and applicants (stored as JSONB)
  beneficialOwners: jsonb('beneficial_owners').notNull(),
  companyApplicants: jsonb('company_applicants'),

  // FinCEN tracking
  fincenId: varchar('fincen_id', { length: 50 }),
  submissionReference: varchar('submission_reference', { length: 100 }),

  // Dates
  dueDate: timestamp('due_date').notNull(),
  submittedAt: timestamp('submitted_at'),
  acceptedAt: timestamp('accepted_at'),
  rejectedAt: timestamp('rejected_at'),
  rejectionReason: text('rejection_reason'),
  updateDueDate: timestamp('update_due_date'),
  lastChangeDate: timestamp('last_change_date'),

  // Document storage
  documentStorageKey: varchar('document_storage_key', { length: 500 }),

  // Audit
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
}, (table) => ({
  tenantIdx: index('boi_filings_tenant_idx').on(table.tenantId),
  entityIdx: index('boi_filings_entity_idx').on(table.entityId),
  statusIdx: index('boi_filings_status_idx').on(table.status),
  dueDateIdx: index('boi_filings_due_date_idx').on(table.dueDate),
}));

// =============================================================================
// Control Requirements Table
// =============================================================================

export const controlRequirements = pgTable('control_requirements', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id'),

  // Control identification
  controlId: varchar('control_id', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),

  // Classification
  controlType: varchar('control_type', { length: 30 }).notNull(),
  framework: varchar('framework', { length: 30 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  riskLevel: varchar('risk_level', { length: 20 }).notNull(),

  // Regulatory linkage
  relatedRequirementIds: jsonb('related_requirement_ids'),
  regulators: jsonb('regulators'),

  // Control design
  objective: text('objective').notNull(),
  procedure: text('procedure'),
  frequency: varchar('frequency', { length: 30 }).notNull(),
  automationLevel: varchar('automation_level', { length: 30 }).notNull(),

  // Ownership
  controlOwner: uuid('control_owner'),
  controlOwnerName: varchar('control_owner_name', { length: 255 }),
  processOwner: uuid('process_owner'),
  processOwnerName: varchar('process_owner_name', { length: 255 }),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('not_implemented'),
  implementedDate: timestamp('implemented_date'),
  lastTestedDate: timestamp('last_tested_date'),
  nextTestDueDate: timestamp('next_test_due_date'),

  // Testing
  testingFrequency: varchar('testing_frequency', { length: 30 }),
  lastTestResult: varchar('last_test_result', { length: 20 }),
  testingProcedure: text('testing_procedure'),
  sampleSize: integer('sample_size'),

  // Evidence
  evidenceRequirements: jsonb('evidence_requirements'),
  evidenceLocations: jsonb('evidence_locations'),

  // Deficiencies
  deficiencyCount: integer('deficiency_count').notNull().default(0),
  materialWeakness: boolean('material_weakness').notNull().default(false),
  significantDeficiency: boolean('significant_deficiency').notNull().default(false),

  // Dependencies
  dependsOnControls: jsonb('depends_on_controls'),
  compensatesFor: uuid('compensates_for'),

  // Risk assessment
  inherentRisk: integer('inherent_risk'),
  residualRisk: integer('residual_risk'),
  controlEffectiveness: integer('control_effectiveness'),

  // Audit
  notes: text('notes'),
  metadata: jsonb('metadata'),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
}, (table) => ({
  tenantIdx: index('controls_tenant_idx').on(table.tenantId),
  controlIdIdx: uniqueIndex('controls_control_id_idx').on(table.tenantId, table.controlId),
  frameworkIdx: index('controls_framework_idx').on(table.framework),
  statusIdx: index('controls_status_idx').on(table.status),
}));

// =============================================================================
// Policies Table
// =============================================================================

export const policies = pgTable('policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id'),

  // Policy identification
  policyNumber: varchar('policy_number', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),

  // Classification
  category: varchar('category', { length: 50 }).notNull(),
  regulators: jsonb('regulators'),
  relatedRequirementIds: jsonb('related_requirement_ids'),

  // Content
  purpose: text('purpose').notNull(),
  scope: text('scope').notNull(),
  content: text('content').notNull(),
  exceptions: text('exceptions'),
  definitions: jsonb('definitions'),

  // Ownership
  policyOwner: uuid('policy_owner'),
  policyOwnerName: varchar('policy_owner_name', { length: 255 }),
  approver: uuid('approver'),
  approverName: varchar('approver_name', { length: 255 }),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  effectiveDate: timestamp('effective_date'),
  reviewDate: timestamp('review_date'),
  expirationDate: timestamp('expiration_date'),
  approvedDate: timestamp('approved_date'),
  publishedDate: timestamp('published_date'),
  lastReviewedDate: timestamp('last_reviewed_date'),

  // Versioning
  versionNumber: varchar('version_number', { length: 20 }).notNull().default('1.0'),
  previousVersionId: uuid('previous_version_id'),
  changeLog: text('change_log'),

  // Document
  documentStorageKey: varchar('document_storage_key', { length: 500 }),

  // Training
  requiresTraining: boolean('requires_training').notNull().default(false),
  trainingCourseId: uuid('training_course_id'),

  // Acknowledgment
  requiresAcknowledgment: boolean('requires_acknowledgment').notNull().default(false),
  acknowledgmentFrequency: varchar('acknowledgment_frequency', { length: 20 }),

  // Audit
  notes: text('notes'),
  metadata: jsonb('metadata'),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
}, (table) => ({
  tenantIdx: index('policies_tenant_idx').on(table.tenantId),
  policyNumberIdx: uniqueIndex('policies_number_idx').on(table.tenantId, table.policyNumber),
  statusIdx: index('policies_status_idx').on(table.status),
  categoryIdx: index('policies_category_idx').on(table.category),
}));

// =============================================================================
// Procedures Table
// =============================================================================

export const procedures = pgTable('procedures', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id'),

  // Procedure identification
  procedureNumber: varchar('procedure_number', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),

  // Relationship to policy
  policyId: uuid('policy_id'),

  // Classification
  category: varchar('category', { length: 50 }).notNull(),
  controlIds: jsonb('control_ids'),

  // Content
  purpose: text('purpose').notNull(),
  scope: text('scope').notNull(),
  prerequisites: jsonb('prerequisites'),
  steps: jsonb('steps').notNull(),
  frequencyOfUse: varchar('frequency_of_use', { length: 30 }).notNull(),

  // Ownership
  procedureOwner: uuid('procedure_owner'),
  procedureOwnerName: varchar('procedure_owner_name', { length: 255 }),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  effectiveDate: timestamp('effective_date'),
  reviewDate: timestamp('review_date'),
  lastReviewedDate: timestamp('last_reviewed_date'),

  // Versioning
  versionNumber: varchar('version_number', { length: 20 }).notNull().default('1.0'),
  previousVersionId: uuid('previous_version_id'),

  // Document
  documentStorageKey: varchar('document_storage_key', { length: 500 }),

  // Audit
  notes: text('notes'),
  metadata: jsonb('metadata'),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
}, (table) => ({
  tenantIdx: index('procedures_tenant_idx').on(table.tenantId),
  procedureNumberIdx: uniqueIndex('procedures_number_idx').on(table.tenantId, table.procedureNumber),
  policyIdx: index('procedures_policy_idx').on(table.policyId),
  statusIdx: index('procedures_status_idx').on(table.status),
}));

// =============================================================================
// Attestations Table
// =============================================================================

export const attestations = pgTable('attestations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id'),

  // Attestation type
  attestationType: varchar('attestation_type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),

  // What is being attested to
  policyId: uuid('policy_id'),
  procedureId: uuid('procedure_id'),
  trainingId: uuid('training_id'),
  customContent: text('custom_content'),

  // Attestation statement
  attestationStatement: text('attestation_statement').notNull(),

  // Who must attest
  requiredFor: jsonb('required_for').notNull(),
  requiredForGroups: jsonb('required_for_groups'),

  // Timing
  dueDate: timestamp('due_date').notNull(),
  reminderDays: jsonb('reminder_days'),
  expirationDate: timestamp('expiration_date'),
  frequencyDays: integer('frequency_days'),

  // Completion
  completedBy: uuid('completed_by'),
  completedByName: varchar('completed_by_name', { length: 255 }),
  completedAt: timestamp('completed_at'),
  status: varchar('status', { length: 30 }).notNull().default('pending'),

  // Response
  response: varchar('response', { length: 20 }),
  comments: text('comments'),
  signature: text('signature'),
  ipAddress: varchar('ip_address', { length: 45 }),

  // Audit
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  version: integer('version').notNull().default(1),
}, (table) => ({
  tenantIdx: index('attestations_tenant_idx').on(table.tenantId),
  policyIdx: index('attestations_policy_idx').on(table.policyId),
  statusIdx: index('attestations_status_idx').on(table.status),
  dueDateIdx: index('attestations_due_date_idx').on(table.dueDate),
}));
