/**
 * Drizzle Schema - IP Domain Tables
 * Conventions from: BACKBONE.md Database Schema Conventions
 */

import { pgTable, uuid, text, varchar, timestamp, integer, boolean, jsonb, date, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const patentStatusEnum = pgEnum('patent_status', [
  'draft', 'provisional', 'pending', 'published', 'granted', 'abandoned', 'expired', 'lapsed'
]);

export const patentTypeEnum = pgEnum('patent_type', ['utility', 'design', 'plant', 'reissue']);

export const trademarkStatusEnum = pgEnum('trademark_status', [
  'draft', 'pending', 'published', 'opposed', 'registered', 'cancelled', 'expired', 'abandoned'
]);

export const trademarkTypeEnum = pgEnum('trademark_type', ['word', 'design', 'combined', 'sound', 'color', '3d']);

export const copyrightStatusEnum = pgEnum('copyright_status', ['unregistered', 'pending', 'registered', 'disputed']);

export const workTypeEnum = pgEnum('work_type', [
  'literary', 'musical', 'dramatic', 'choreographic', 'pictorial',
  'audiovisual', 'sound_recording', 'architectural', 'software', 'compilation', 'derivative'
]);

export const licenseStatusEnum = pgEnum('license_status', ['draft', 'active', 'suspended', 'terminated', 'expired']);
export const licenseTypeEnum = pgEnum('license_type', ['exclusive', 'non_exclusive', 'sole', 'sublicense']);
export const ipTypeEnum = pgEnum('ip_type', ['patent', 'trademark', 'copyright', 'trade_secret']);

// Patents Table
export const patents = pgTable('patents', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationNumber: varchar('application_number', { length: 50 }).unique(),
  patentNumber: varchar('patent_number', { length: 50 }).unique(),
  title: text('title').notNull(),
  abstract: text('abstract'),
  type: patentTypeEnum('type').notNull(),
  status: patentStatusEnum('status').notNull().default('draft'),
  filingDate: date('filing_date'),
  priorityDate: date('priority_date'),
  publicationDate: date('publication_date'),
  grantDate: date('grant_date'),
  expirationDate: date('expiration_date'),
  inventors: jsonb('inventors').$type<string[]>().notNull().default([]),
  assigneeId: uuid('assignee_id'),
  jurisdictions: jsonb('jurisdictions').$type<string[]>().notNull().default([]),
  claims: jsonb('claims').$type<Array<{number: number; text: string; isIndependent: boolean; dependsOn?: number | undefined}>>().notNull().default([]),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Trademarks Table
export const trademarks = pgTable('trademarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationNumber: varchar('application_number', { length: 50 }).unique(),
  registrationNumber: varchar('registration_number', { length: 50 }).unique(),
  mark: text('mark').notNull(),
  description: text('description'),
  type: trademarkTypeEnum('type').notNull(),
  status: trademarkStatusEnum('status').notNull().default('draft'),
  filingDate: date('filing_date'),
  registrationDate: date('registration_date'),
  expirationDate: date('expiration_date'),
  renewalDate: date('renewal_date'),
  ownerId: uuid('owner_id').notNull(),
  niceClasses: jsonb('nice_classes').$type<Array<{classNumber: number; description: string; goodsServices: string[]}>>().notNull().default([]),
  jurisdictions: jsonb('jurisdictions').$type<string[]>().notNull().default([]),
  logoUrl: text('logo_url'),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Copyrights Table
export const copyrights = pgTable('copyrights', {
  id: uuid('id').primaryKey().defaultRandom(),
  registrationNumber: varchar('registration_number', { length: 50 }).unique(),
  title: text('title').notNull(),
  alternativeTitles: jsonb('alternative_titles').$type<string[]>().default([]),
  workType: workTypeEnum('work_type').notNull(),
  status: copyrightStatusEnum('status').notNull().default('unregistered'),
  creationDate: date('creation_date').notNull(),
  publicationDate: date('publication_date'),
  registrationDate: date('registration_date'),
  authors: jsonb('authors').$type<Array<{name: string; contribution: string; isWorkForHire: boolean; nationality?: string | undefined}>>().notNull().default([]),
  claimantId: uuid('claimant_id').notNull(),
  description: text('description'),
  nation: varchar('nation', { length: 2 }).notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Licenses Table
export const licenses = pgTable('licenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  licenseNumber: varchar('license_number', { length: 50 }).notNull().unique(),
  ipType: ipTypeEnum('ip_type').notNull(),
  ipAssetId: uuid('ip_asset_id').notNull(),
  licenseType: licenseTypeEnum('license_type').notNull(),
  status: licenseStatusEnum('status').notNull().default('draft'),
  licensorId: uuid('licensor_id').notNull(),
  licenseeId: uuid('licensee_id').notNull(),
  effectiveDate: date('effective_date').notNull(),
  expirationDate: date('expiration_date'),
  terminationDate: date('termination_date'),
  territory: jsonb('territory').$type<{includedCountries?: string[] | undefined; excludedCountries?: string[] | undefined; worldwide: boolean}>().notNull(),
  royaltyTerms: jsonb('royalty_terms').$type<{type: string; rate?: number | undefined; fixedAmount?: number | undefined; minimumAnnual?: number | undefined; paymentFrequency: string; currency: string}>().notNull(),
  fieldOfUse: text('field_of_use'),
  canSublicense: boolean('can_sublicense').notNull().default(false),
  sublicenseOf: uuid('sublicense_of'),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Trade Secrets Enums
export const tradeSecretStatusEnum = pgEnum('trade_secret_status', [
  'active', 'disclosed', 'abandoned', 'converted_to_patent'
]);

export const tradeSecretCategoryEnum = pgEnum('trade_secret_category', [
  'technical', 'business', 'financial', 'customer', 'process', 'formula', 'other'
]);

export const sensitivityLevelEnum = pgEnum('sensitivity_level', [
  'confidential', 'highly_confidential', 'restricted'
]);

export const protectionMeasureStatusEnum = pgEnum('protection_measure_status', [
  'active', 'inactive', 'expired'
]);

// Trade Secrets Table
export const tradeSecrets = pgTable('trade_secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: tradeSecretCategoryEnum('category').notNull(),
  sensitivityLevel: sensitivityLevelEnum('sensitivity_level').notNull(),
  status: tradeSecretStatusEnum('status').notNull().default('active'),
  ownerId: uuid('owner_id').notNull(),
  custodianId: uuid('custodian_id'),
  identifiedDate: date('identified_date').notNull(),
  lastReviewDate: date('last_review_date'),
  economicValueDescription: text('economic_value_description').notNull(),
  estimatedValue: integer('estimated_value'),
  accessList: jsonb('access_list').$type<Array<{
    userId: string;
    accessLevel: 'read' | 'write' | 'admin';
    grantedAt: string;
    grantedBy: string;
  }>>().notNull().default([]),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Trade Secret Protection Measures Table
export const tradeSecretProtectionMeasures = pgTable('trade_secret_protection_measures', {
  id: uuid('id').primaryKey().defaultRandom(),
  tradeSecretId: uuid('trade_secret_id').notNull().references(() => tradeSecrets.id),
  category: varchar('category', { length: 50 }).notNull(), // contractual, physical, digital, administrative
  measureType: varchar('measure_type', { length: 100 }).notNull(),
  description: text('description').notNull(),
  implementedDate: date('implemented_date').notNull(),
  lastVerifiedDate: date('last_verified_date'),
  responsibleParty: uuid('responsible_party').notNull(),
  status: protectionMeasureStatusEnum('status').notNull().default('active'),
  relatedAgreementId: uuid('related_agreement_id'),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Patent Family Enums
export const continuationTypeEnum = pgEnum('continuation_type', [
  'original', 'continuation', 'divisional', 'continuation_in_part'
]);

export const maintenanceFeeStatusEnum = pgEnum('maintenance_fee_status', [
  'upcoming', 'payable', 'grace_period', 'paid', 'missed'
]);

export const entitySizeEnum = pgEnum('entity_size', ['large', 'small', 'micro']);

// Patent Families Table
export const patentFamilies = pgTable('patent_families', {
  id: uuid('id').primaryKey().defaultRandom(),
  familyName: varchar('family_name', { length: 255 }).notNull(),
  priorityPatentId: uuid('priority_patent_id').notNull().references(() => patents.id),
  priorityDate: date('priority_date').notNull(),
  description: text('description'),
  technologyArea: varchar('technology_area', { length: 100 }),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Patent Family Members Table (junction with relationship type)
export const patentFamilyMembers = pgTable('patent_family_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  familyId: uuid('family_id').notNull().references(() => patentFamilies.id),
  patentId: uuid('patent_id').notNull().references(() => patents.id),
  parentPatentId: uuid('parent_patent_id').references(() => patents.id),
  continuationType: continuationTypeEnum('continuation_type').notNull(),
  isTrueDivisional: boolean('is_true_divisional').notNull().default(false),
  restrictionDate: date('restriction_date'),
  notes: text('notes'),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Patent Maintenance Fees Table
export const patentMaintenanceFees = pgTable('patent_maintenance_fees', {
  id: uuid('id').primaryKey().defaultRandom(),
  patentId: uuid('patent_id').notNull().references(() => patents.id),
  feeNumber: integer('fee_number').notNull(), // 1 (3.5yr), 2 (7.5yr), or 3 (11.5yr) for US
  jurisdiction: varchar('jurisdiction', { length: 2 }).notNull().default('US'),
  dueDate: date('due_date').notNull(),
  windowOpensDate: date('window_opens_date').notNull(),
  gracePeriodEndsDate: date('grace_period_ends_date').notNull(),
  status: maintenanceFeeStatusEnum('status').notNull().default('upcoming'),
  paidDate: date('paid_date'),
  paidAmount: integer('paid_amount'), // in cents
  surchargeApplied: boolean('surcharge_applied').notNull().default(false),
  entitySizeAtPayment: entitySizeEnum('entity_size_at_payment'),
  receiptNumber: varchar('receipt_number', { length: 100 }),
  notes: text('notes'),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Domain Names Enums
export const domainNameStatusEnum = pgEnum('domain_name_status', [
  'active', 'pending_transfer', 'expired', 'redemption', 'deleted', 'reserved'
]);

export const domainPurposeEnum = pgEnum('domain_purpose', [
  'primary', 'redirect', 'defensive', 'regional', 'campaign', 'product'
]);

export const domainDisputeMechanismEnum = pgEnum('domain_dispute_mechanism', [
  'udrp', 'urs', 'local_court', 'arbitration', 'negotiation'
]);

export const domainDisputeStatusEnum = pgEnum('domain_dispute_status', [
  'pending', 'filed', 'response_due', 'hearing', 'decided', 'appealed', 'closed'
]);

export const domainDisputeOutcomeEnum = pgEnum('domain_dispute_outcome', [
  'transfer', 'cancel', 'maintain', 'settled', 'withdrawn'
]);

// Domain Names Table
export const domainNames = pgTable('domain_names', {
  id: uuid('id').primaryKey().defaultRandom(),
  domainName: varchar('domain_name', { length: 255 }).notNull().unique(),
  tld: varchar('tld', { length: 50 }).notNull(), // .com, .org, .io, etc.
  status: domainNameStatusEnum('status').notNull().default('active'),
  purpose: domainPurposeEnum('purpose').notNull().default('primary'),
  registrantId: uuid('registrant_id').notNull(),
  adminContactId: uuid('admin_contact_id'),
  techContactId: uuid('tech_contact_id'),
  registrarName: varchar('registrar_name', { length: 255 }).notNull(),
  registrarIanaId: varchar('registrar_iana_id', { length: 50 }),
  registrationDate: date('registration_date').notNull(),
  expirationDate: date('expiration_date').notNull(),
  autoRenew: boolean('auto_renew').notNull().default(true),
  privacyEnabled: boolean('privacy_enabled').notNull().default(true),
  locked: boolean('locked').notNull().default(true),
  dnssecEnabled: boolean('dnssec_enabled').notNull().default(false),
  // Defensive registration link to trademark
  linkedTrademarkId: uuid('linked_trademark_id').references(() => trademarks.id),
  defensiveNotes: text('defensive_notes'),
  // DNS configuration (stored as JSON, actual records managed externally)
  nameservers: jsonb('nameservers').$type<string[]>().notNull().default([]),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Domain Disputes Table (UDRP, URS, etc.)
export const domainDisputes = pgTable('domain_disputes', {
  id: uuid('id').primaryKey().defaultRandom(),
  domainNameId: uuid('domain_name_id').notNull().references(() => domainNames.id),
  caseNumber: varchar('case_number', { length: 100 }),
  mechanism: domainDisputeMechanismEnum('mechanism').notNull(),
  status: domainDisputeStatusEnum('status').notNull().default('pending'),
  filingDate: date('filing_date'),
  responseDeadline: date('response_deadline'),
  decisionDate: date('decision_date'),
  outcome: domainDisputeOutcomeEnum('outcome'),
  complainantName: text('complainant_name').notNull(),
  complainantTrademarkId: uuid('complainant_trademark_id').references(() => trademarks.id),
  respondentName: text('respondent_name').notNull(),
  panelProvider: varchar('panel_provider', { length: 255 }), // WIPO, NAF, etc.
  panelistNames: jsonb('panelist_names').$type<string[]>().default([]),
  allegationsOfBadFaith: text('allegations_of_bad_faith'),
  defenseArguments: text('defense_arguments'),
  decisionSummary: text('decision_summary'),
  appealDeadline: date('appeal_deadline'),
  appealFiled: boolean('appeal_filed').notNull().default(false),
  legalCounselId: uuid('legal_counsel_id'),
  estimatedCosts: integer('estimated_costs'), // in cents
  actualCosts: integer('actual_costs'), // in cents
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// IP Audit Log Table
export const ipAuditLog = pgTable('ip_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  actorId: uuid('actor_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  changes: jsonb('changes'),
  metadata: jsonb('metadata'),
});

// ============================================================================
// ENFORCEMENT DOMAIN
// ============================================================================

// Enforcement Enums
export const enforcementTypeEnum = pgEnum('enforcement_type', [
  'infringement', 'misappropriation', 'counterfeiting', 'cybersquatting',
  'unfair_competition', 'breach_of_license', 'other'
]);

export const enforcementStatusEnum = pgEnum('enforcement_status', [
  'monitoring', 'investigation', 'cease_and_desist', 'negotiation',
  'litigation', 'settled', 'resolved', 'abandoned'
]);

export const enforcementPriorityEnum = pgEnum('enforcement_priority', [
  'low', 'medium', 'high', 'critical'
]);

export const actionTypeEnum = pgEnum('enforcement_action_type', [
  'cease_and_desist', 'dmca_takedown', 'customs_recordation', 'court_filing',
  'motion', 'discovery', 'settlement_offer', 'judgment', 'appeal',
  'monitoring_alert', 'investigation', 'negotiation', 'other'
]);

export const actionStatusEnum = pgEnum('enforcement_action_status', [
  'pending', 'in_progress', 'completed', 'cancelled', 'failed'
]);

export const partyRoleEnum = pgEnum('enforcement_party_role', [
  'infringer', 'defendant', 'plaintiff', 'respondent', 'petitioner',
  'internal_counsel', 'external_counsel', 'investigator', 'expert_witness'
]);

// Enforcement Matters Table (main aggregate)
export const enforcementMatters = pgTable('enforcement_matters', {
  id: uuid('id').primaryKey().defaultRandom(),
  matterNumber: varchar('matter_number', { length: 50 }).unique(),
  title: text('title').notNull(),
  description: text('description'),
  type: enforcementTypeEnum('type').notNull(),
  status: enforcementStatusEnum('status').notNull().default('monitoring'),
  priority: enforcementPriorityEnum('priority').notNull().default('medium'),
  // Cross-IP reference (can reference any IP asset type)
  ipAssetType: ipTypeEnum('ip_asset_type').notNull(),
  ipAssetId: uuid('ip_asset_id').notNull(),
  // Additional affected assets (for multi-IP enforcement)
  additionalAssets: jsonb('additional_assets').$type<Array<{type: string; id: string; description: string}>>().default([]),
  // Jurisdiction and venue
  jurisdiction: varchar('jurisdiction', { length: 100 }).notNull(),
  venue: varchar('venue', { length: 255 }),
  caseNumber: varchar('case_number', { length: 100 }),
  // Timeline
  detectedDate: date('detected_date').notNull(),
  openedDate: date('opened_date'),
  resolvedDate: date('resolved_date'),
  // Financial tracking
  estimatedDamages: integer('estimated_damages'), // in cents
  actualDamages: integer('actual_damages'), // in cents
  settlementAmount: integer('settlement_amount'), // in cents
  estimatedCosts: integer('estimated_costs'), // in cents
  actualCosts: integer('actual_costs'), // in cents
  // Outcome
  outcome: varchar('outcome', { length: 255 }),
  outcomeNotes: text('outcome_notes'),
  // Internal tracking
  assignedTo: uuid('assigned_to'),
  tags: jsonb('tags').$type<string[]>().default([]),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Enforcement Actions Table (child of matter)
export const enforcementActions = pgTable('enforcement_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  matterId: uuid('matter_id').notNull().references(() => enforcementMatters.id),
  actionType: actionTypeEnum('action_type').notNull(),
  status: actionStatusEnum('status').notNull().default('pending'),
  title: text('title').notNull(),
  description: text('description'),
  // Timeline
  scheduledDate: date('scheduled_date'),
  dueDate: date('due_date'),
  completedDate: date('completed_date'),
  // Court/filing details
  filingNumber: varchar('filing_number', { length: 100 }),
  courtName: varchar('court_name', { length: 255 }),
  judgeName: varchar('judge_name', { length: 255 }),
  // Response tracking
  responseReceived: boolean('response_received').notNull().default(false),
  responseDate: date('response_date'),
  responseSummary: text('response_summary'),
  // Cost tracking
  cost: integer('cost'), // in cents
  // Document references (S3 keys)
  documents: jsonb('documents').$type<Array<{name: string; s3Key: string; uploadedAt: string}>>().default([]),
  // Notes
  notes: text('notes'),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Enforcement Parties Table (parties involved in a matter)
export const enforcementParties = pgTable('enforcement_parties', {
  id: uuid('id').primaryKey().defaultRandom(),
  matterId: uuid('matter_id').notNull().references(() => enforcementMatters.id),
  role: partyRoleEnum('role').notNull(),
  name: text('name').notNull(),
  organization: varchar('organization', { length: 255 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  address: text('address'),
  // Attorney/counsel specific
  barNumber: varchar('bar_number', { length: 50 }),
  firmName: varchar('firm_name', { length: 255 }),
  // Reference to internal contact if applicable
  internalContactId: uuid('internal_contact_id'),
  // Notes
  notes: text('notes'),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ============================================================================
// IP STRATEGY DOMAIN
// ============================================================================

// IP Valuation Enums
export const valuationMethodologyEnum = pgEnum('valuation_methodology', [
  'cost', 'market', 'income', 'relief_from_royalty', 'excess_earnings',
  'real_options', 'monte_carlo', 'comparable_transactions'
]);

export const valuationPurposeEnum = pgEnum('valuation_purpose', [
  'financial_reporting', 'tax', 'litigation', 'licensing', 'sale',
  'financing', 'insurance', 'internal_planning', 'm_and_a'
]);

export const valuationStatusEnum = pgEnum('valuation_status', [
  'draft', 'in_progress', 'review', 'approved', 'superseded', 'archived'
]);

// FTO Analysis Enums
export const ftoStatusEnum = pgEnum('fto_status', [
  'initiated', 'search_complete', 'analysis_in_progress', 'review',
  'complete', 'updated', 'superseded'
]);

export const ftoRiskLevelEnum = pgEnum('fto_risk_level', [
  'clear', 'low', 'moderate', 'high', 'blocking'
]);

export const ftoFindingTypeEnum = pgEnum('fto_finding_type', [
  'clear', 'potential_issue', 'design_around_needed', 'license_required',
  'blocking', 'expired', 'narrow_claim'
]);

// Due Diligence Enums
export const ddTypeEnum = pgEnum('dd_type', [
  'acquisition', 'divestiture', 'licensing_in', 'licensing_out',
  'investment', 'joint_venture', 'ipo', 'financing'
]);

export const ddStatusEnum = pgEnum('dd_status', [
  'initiated', 'document_review', 'analysis', 'findings_review',
  'complete', 'terminated'
]);

export const ddFindingSeverityEnum = pgEnum('dd_finding_severity', [
  'critical', 'major', 'moderate', 'minor', 'informational'
]);

// IP Valuations Table
export const ipValuations = pgTable('ip_valuations', {
  id: uuid('id').primaryKey().defaultRandom(),
  valuationNumber: varchar('valuation_number', { length: 50 }).unique(),
  title: text('title').notNull(),
  status: valuationStatusEnum('status').notNull().default('draft'),
  purpose: valuationPurposeEnum('purpose').notNull(),
  methodology: valuationMethodologyEnum('methodology').notNull(),
  // Scope - can include multiple IP assets
  ipAssets: jsonb('ip_assets').$type<Array<{
    type: string;
    id: string;
    name: string;
    weight?: number;
  }>>().notNull().default([]),
  // Valuation details
  valuationDate: date('valuation_date').notNull(),
  effectiveDate: date('effective_date').notNull(),
  expirationDate: date('expiration_date'), // When this valuation is no longer valid
  // Financial values (in cents)
  lowValue: integer('low_value'),
  midValue: integer('mid_value'),
  highValue: integer('high_value'),
  selectedValue: integer('selected_value'),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  // Assumptions and inputs
  assumptions: jsonb('assumptions').$type<Array<{
    category: string;
    description: string;
    value?: string;
    source?: string;
  }>>().notNull().default([]),
  discountRate: integer('discount_rate'), // basis points (e.g., 1000 = 10%)
  royaltyRate: integer('royalty_rate'), // basis points
  projectionYears: integer('projection_years'),
  terminalGrowthRate: integer('terminal_growth_rate'), // basis points
  // Analysis
  comparableTransactions: jsonb('comparable_transactions').$type<Array<{
    description: string;
    value: number;
    date: string;
    source: string;
    adjustmentFactor?: number;
  }>>().default([]),
  sensitivities: jsonb('sensitivities').$type<Array<{
    variable: string;
    lowCase: number;
    baseCase: number;
    highCase: number;
  }>>().default([]),
  // Conclusion
  conclusionSummary: text('conclusion_summary'),
  limitations: text('limitations'),
  // Approval workflow
  preparedBy: uuid('prepared_by').notNull(),
  reviewedBy: uuid('reviewed_by'),
  approvedBy: uuid('approved_by'),
  approvedDate: date('approved_date'),
  // External validation
  externalAppraiser: varchar('external_appraiser', { length: 255 }),
  appraisalReportRef: varchar('appraisal_report_ref', { length: 100 }),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// FTO Analyses Table
export const ftoAnalyses = pgTable('fto_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  analysisNumber: varchar('analysis_number', { length: 50 }).unique(),
  title: text('title').notNull(),
  status: ftoStatusEnum('status').notNull().default('initiated'),
  overallRisk: ftoRiskLevelEnum('overall_risk'),
  // Product/technology being analyzed
  productName: text('product_name').notNull(),
  productDescription: text('product_description').notNull(),
  technicalSpecification: text('technical_specification'),
  targetMarkets: jsonb('target_markets').$type<string[]>().notNull().default([]),
  launchDate: date('launch_date'),
  // Scope
  jurisdictions: jsonb('jurisdictions').$type<string[]>().notNull().default([]),
  patentClassifications: jsonb('patent_classifications').$type<string[]>().default([]),
  searchStrategy: text('search_strategy'),
  // Timeline
  initiatedDate: date('initiated_date').notNull(),
  searchCompletedDate: date('search_completed_date'),
  analysisCompletedDate: date('analysis_completed_date'),
  reviewCompletedDate: date('review_completed_date'),
  // Results summary
  patentsSearched: integer('patents_searched').default(0),
  patentsReviewed: integer('patents_reviewed').default(0),
  potentialIssuesCount: integer('potential_issues_count').default(0),
  // Recommendation
  recommendation: text('recommendation'),
  recommendedActions: jsonb('recommended_actions').$type<Array<{
    action: string;
    priority: string;
    deadline?: string;
    estimatedCost?: number;
  }>>().default([]),
  // Ownership
  assignedTo: uuid('assigned_to').notNull(),
  reviewedBy: uuid('reviewed_by'),
  approvedBy: uuid('approved_by'),
  // External counsel
  outsideCounselId: uuid('outside_counsel_id'),
  outsideCounselOpinionRef: varchar('outside_counsel_opinion_ref', { length: 100 }),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// FTO Findings Table (child of FTO Analysis)
export const ftoFindings = pgTable('fto_findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  analysisId: uuid('analysis_id').notNull().references(() => ftoAnalyses.id),
  // Patent reference
  patentNumber: varchar('patent_number', { length: 100 }).notNull(),
  patentTitle: text('patent_title').notNull(),
  patentHolder: varchar('patent_holder', { length: 255 }),
  patentExpiration: date('patent_expiration'),
  jurisdiction: varchar('jurisdiction', { length: 100 }).notNull(),
  // Analysis
  findingType: ftoFindingTypeEnum('finding_type').notNull(),
  riskLevel: ftoRiskLevelEnum('risk_level').notNull(),
  claimsAtIssue: jsonb('claims_at_issue').$type<number[]>().default([]),
  analysisNotes: text('analysis_notes').notNull(),
  // Overlap assessment
  overlapDescription: text('overlap_description'),
  differentiatingFeatures: text('differentiating_features'),
  // Mitigation options
  designAroundOption: text('design_around_option'),
  designAroundFeasibility: varchar('design_around_feasibility', { length: 50 }),
  designAroundCost: integer('design_around_cost'), // in cents
  licensingOption: boolean('licensing_option').default(false),
  estimatedLicenseCost: integer('estimated_license_cost'), // in cents
  invalidityArguments: text('invalidity_arguments'),
  priorArtReferences: jsonb('prior_art_references').$type<string[]>().default([]),
  // Recommendation
  recommendation: text('recommendation'),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Due Diligence Reports Table
export const dueDiligenceReports = pgTable('due_diligence_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportNumber: varchar('report_number', { length: 50 }).unique(),
  title: text('title').notNull(),
  status: ddStatusEnum('status').notNull().default('initiated'),
  ddType: ddTypeEnum('dd_type').notNull(),
  // Target information
  targetEntityName: text('target_entity_name').notNull(),
  targetEntityId: uuid('target_entity_id'),
  transactionValue: integer('transaction_value'), // in cents
  transactionCurrency: varchar('transaction_currency', { length: 3 }).default('USD'),
  // Timeline
  initiatedDate: date('initiated_date').notNull(),
  documentRequestDate: date('document_request_date'),
  documentsReceivedDate: date('documents_received_date'),
  analysisStartDate: date('analysis_start_date'),
  draftReportDate: date('draft_report_date'),
  finalReportDate: date('final_report_date'),
  dealCloseDate: date('deal_close_date'),
  // Scope
  ipTypesInScope: jsonb('ip_types_in_scope').$type<string[]>().notNull().default([]),
  jurisdictionsInScope: jsonb('jurisdictions_in_scope').$type<string[]>().notNull().default([]),
  materialsReviewed: jsonb('materials_reviewed').$type<Array<{
    category: string;
    documentName: string;
    receivedDate: string;
    reviewer: string;
  }>>().default([]),
  // Portfolio summary
  patentCount: integer('patent_count').default(0),
  trademarkCount: integer('trademark_count').default(0),
  copyrightCount: integer('copyright_count').default(0),
  tradeSecretCount: integer('trade_secret_count').default(0),
  licenseCount: integer('license_count').default(0),
  // Valuation summary
  statedPortfolioValue: integer('stated_portfolio_value'), // in cents
  assessedPortfolioValue: integer('assessed_portfolio_value'), // in cents
  valuationGapNotes: text('valuation_gap_notes'),
  // Overall assessment
  overallRiskRating: ddFindingSeverityEnum('overall_risk_rating'),
  executiveSummary: text('executive_summary'),
  keyFindings: text('key_findings'),
  recommendations: text('recommendations'),
  dealBreakerIssues: jsonb('deal_breaker_issues').$type<string[]>().default([]),
  // Team
  leadAnalyst: uuid('lead_analyst').notNull(),
  teamMembers: jsonb('team_members').$type<string[]>().default([]),
  outsideCounselId: uuid('outside_counsel_id'),
  // Approval
  reviewedBy: uuid('reviewed_by'),
  approvedBy: uuid('approved_by'),
  approvedDate: date('approved_date'),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Due Diligence Findings Table (child of DD Report)
export const dueDiligenceFindings = pgTable('due_diligence_findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id').notNull().references(() => dueDiligenceReports.id),
  // Finding details
  category: varchar('category', { length: 100 }).notNull(), // ownership, validity, infringement, encumbrance, maintenance, etc.
  severity: ddFindingSeverityEnum('severity').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  // Affected assets
  affectedAssets: jsonb('affected_assets').$type<Array<{
    type: string;
    id: string;
    name: string;
  }>>().default([]),
  // Impact assessment
  financialImpact: integer('financial_impact'), // in cents
  impactDescription: text('impact_description'),
  // Mitigation
  mitigationOptions: jsonb('mitigation_options').$type<Array<{
    option: string;
    cost?: number;
    timeframe?: string;
    feasibility: string;
  }>>().default([]),
  recommendedAction: text('recommended_action'),
  // Risk allocation
  suggestedRepresentations: text('suggested_representations'),
  suggestedIndemnities: text('suggested_indemnities'),
  escrowRecommendation: text('escrow_recommendation'),
  priceAdjustmentRecommendation: integer('price_adjustment_recommendation'), // in cents
  // Status
  resolved: boolean('resolved').notNull().default(false),
  resolutionNotes: text('resolution_notes'),
  // Audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
