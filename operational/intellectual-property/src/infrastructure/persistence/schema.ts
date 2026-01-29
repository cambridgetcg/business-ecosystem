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
