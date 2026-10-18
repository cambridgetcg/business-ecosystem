/**
 * Entity Governance - Database Schema (Drizzle ORM)
 *
 * Core tables for legal entity management, governance, and compliance tracking.
 * Follows @ecosystem/database Entity/AuditableEntity/SoftDeletableEntity patterns.
 */

import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =============================================================================
// Enums
// =============================================================================

export const entityTypeEnum = pgEnum('entity_type', [
  'corporation',
  'llc',
  'lp',
  'llp',
  'partnership',
  'sole_proprietorship',
  'nonprofit',
  'trust',
  'other'
]);

export const entityStatusEnum = pgEnum('entity_status', [
  'active',
  'inactive',
  'dissolved',
  'merged',
  'converted',
  'suspended'
]);

export const shareClassTypeEnum = pgEnum('share_class_type', [
  'common',
  'preferred',
  'series_a',
  'series_b',
  'series_c',
  'convertible',
  'other'
]);

export const officerTitleEnum = pgEnum('officer_title', [
  'ceo',
  'cfo',
  'coo',
  'cto',
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'general_counsel',
  'other'
]);

export const filingStatusEnum = pgEnum('filing_status', [
  'pending',
  'submitted',
  'accepted',
  'rejected',
  'overdue'
]);

// =============================================================================
// Base Columns (AuditableEntity + SoftDeletableEntity pattern)
// =============================================================================

const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

// =============================================================================
// Entity Subdomain
// =============================================================================

export const legalEntities = pgTable('legal_entities', {
  ...baseColumns,
  name: varchar('name', { length: 255 }).notNull(),
  legalName: varchar('legal_name', { length: 500 }).notNull(),
  entityType: entityTypeEnum('entity_type').notNull(),
  status: entityStatusEnum('status').notNull().default('active'),
  jurisdictionCountry: varchar('jurisdiction_country', { length: 2 }).notNull(),
  jurisdictionState: varchar('jurisdiction_state', { length: 100 }),
  incorporationDate: timestamp('incorporation_date', { withTimezone: true }),
  dissolutionDate: timestamp('dissolution_date', { withTimezone: true }),
  taxId: varchar('tax_id', { length: 50 }),
  registrationNumber: varchar('registration_number', { length: 100 }),
  // Compliance tracking
  complianceStatus: varchar('compliance_status', { length: 50 }).default('pending'),
  lastComplianceCheck: timestamp('last_compliance_check', { withTimezone: true }),
  metadata: jsonb('metadata'),
});

export const incorporationDocuments = pgTable('incorporation_documents', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  documentType: varchar('document_type', { length: 100 }).notNull(),
  documentName: varchar('document_name', { length: 255 }).notNull(),
  fileStorageKey: varchar('file_storage_key', { length: 500 }),
  filedDate: timestamp('filed_date', { withTimezone: true }),
  effectiveDate: timestamp('effective_date', { withTimezone: true }),
  metadata: jsonb('metadata'),
});

// =============================================================================
// Corporate Structure Subdomain
// =============================================================================

export const parentSubsidiaryRelationships = pgTable('parent_subsidiary_relationships', {
  ...baseColumns,
  parentEntityId: uuid('parent_entity_id').notNull().references(() => legalEntities.id),
  subsidiaryEntityId: uuid('subsidiary_entity_id').notNull().references(() => legalEntities.id),
  ownershipPercentage: integer('ownership_percentage'),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  relationshipType: varchar('relationship_type', { length: 50 }).notNull().default('subsidiary'),
  metadata: jsonb('metadata'),
});

// =============================================================================
// Governance Subdomain
// =============================================================================

export const boards = pgTable('boards', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  name: varchar('name', { length: 255 }).notNull().default('Board of Directors'),
  minimumMembers: integer('minimum_members').default(1),
  maximumMembers: integer('maximum_members'),
  quorumPercentage: integer('quorum_percentage').default(5000),
  metadata: jsonb('metadata'),
});

export const committees = pgTable('committees', {
  ...baseColumns,
  boardId: uuid('board_id').notNull().references(() => boards.id),
  name: varchar('name', { length: 255 }).notNull(),
  committeeType: varchar('committee_type', { length: 100 }).notNull(),
  charter: text('charter'),
  metadata: jsonb('metadata'),
});

export const bylaws = pgTable('bylaws', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  content: text('content'),
  fileStorageKey: varchar('file_storage_key', { length: 500 }),
  amendmentNumber: integer('amendment_number').default(0),
  metadata: jsonb('metadata'),
});

// =============================================================================
// Shareholders Subdomain
// =============================================================================

export const shareholders = pgTable('shareholders', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  shareholderType: varchar('shareholder_type', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  taxId: varchar('tax_id', { length: 50 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  address: jsonb('address'),
  metadata: jsonb('metadata'),
});

export const shareClasses = pgTable('share_classes', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  className: varchar('class_name', { length: 100 }).notNull(),
  classType: shareClassTypeEnum('class_type').notNull(),
  authorizedShares: integer('authorized_shares').notNull(),
  parValue: integer('par_value'),
  votingRightsPerShare: integer('voting_rights_per_share').default(1),
  dividendPreference: integer('dividend_preference'),
  liquidationPreference: integer('liquidation_preference'),
  isConvertible: boolean('is_convertible').default(false),
  metadata: jsonb('metadata'),
});

export const shareholdings = pgTable('shareholdings', {
  ...baseColumns,
  shareholderId: uuid('shareholder_id').notNull().references(() => shareholders.id),
  shareClassId: uuid('share_class_id').notNull().references(() => shareClasses.id),
  sharesOwned: integer('shares_owned').notNull(),
  certificateNumber: varchar('certificate_number', { length: 50 }),
  acquisitionDate: timestamp('acquisition_date', { withTimezone: true }).notNull(),
  acquisitionPrice: integer('acquisition_price'),
  metadata: jsonb('metadata'),
});

export const equityGrants = pgTable('equity_grants', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  recipientId: uuid('recipient_id').notNull(),
  grantType: varchar('grant_type', { length: 50 }).notNull(),
  shareClassId: uuid('share_class_id').references(() => shareClasses.id),
  sharesGranted: integer('shares_granted').notNull(),
  exercisePrice: integer('exercise_price'),
  grantDate: timestamp('grant_date', { withTimezone: true }).notNull(),
  vestingStartDate: timestamp('vesting_start_date', { withTimezone: true }),
  vestingSchedule: jsonb('vesting_schedule'),
  expirationDate: timestamp('expiration_date', { withTimezone: true }),
  metadata: jsonb('metadata'),
});

// =============================================================================
// Officers & Directors Subdomain
// =============================================================================

export const directors = pgTable('directors', {
  ...baseColumns,
  boardId: uuid('board_id').notNull().references(() => boards.id),
  personId: uuid('person_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  appointmentDate: timestamp('appointment_date', { withTimezone: true }).notNull(),
  termEndDate: timestamp('term_end_date', { withTimezone: true }),
  isIndependent: boolean('is_independent').default(false),
  isChairperson: boolean('is_chairperson').default(false),
  compensationAmount: integer('compensation_amount'),
  metadata: jsonb('metadata'),
});

export const officers = pgTable('officers', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  personId: uuid('person_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  title: officerTitleEnum('title').notNull(),
  customTitle: varchar('custom_title', { length: 100 }),
  email: varchar('email', { length: 255 }),
  appointmentDate: timestamp('appointment_date', { withTimezone: true }).notNull(),
  terminationDate: timestamp('termination_date', { withTimezone: true }),
  compensationAmount: integer('compensation_amount'),
  metadata: jsonb('metadata'),
});

// =============================================================================
// Corporate Records Subdomain
// =============================================================================

export const meetingMinutes = pgTable('meeting_minutes', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  boardId: uuid('board_id').references(() => boards.id),
  meetingType: varchar('meeting_type', { length: 50 }).notNull(),
  meetingDate: timestamp('meeting_date', { withTimezone: true }).notNull(),
  location: varchar('location', { length: 255 }),
  attendees: jsonb('attendees'),
  agendaItems: jsonb('agenda_items'),
  content: text('content'),
  fileStorageKey: varchar('file_storage_key', { length: 500 }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
});

export const resolutions = pgTable('resolutions', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  boardId: uuid('board_id').references(() => boards.id),
  resolutionType: varchar('resolution_type', { length: 50 }).notNull(),
  resolutionNumber: varchar('resolution_number', { length: 50 }),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  votesFor: integer('votes_for'),
  votesAgainst: integer('votes_against'),
  votesAbstained: integer('votes_abstained'),
  isPassed: boolean('is_passed').notNull(),
  metadata: jsonb('metadata'),
});

// =============================================================================
// Registered Agent Subdomain
// =============================================================================

export const registeredAgents = pgTable('registered_agents', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  agentName: varchar('agent_name', { length: 255 }).notNull(),
  agentType: varchar('agent_type', { length: 50 }).notNull(),
  address: jsonb('address').notNull(),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  metadata: jsonb('metadata'),
});

// =============================================================================
// Annual Filings Subdomain
// =============================================================================

export const filingRequirements = pgTable('filing_requirements', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  jurisdictionCountry: varchar('jurisdiction_country', { length: 2 }).notNull(),
  jurisdictionState: varchar('jurisdiction_state', { length: 100 }),
  filingType: varchar('filing_type', { length: 100 }).notNull(),
  frequency: varchar('frequency', { length: 50 }).notNull(),
  dueDateRule: jsonb('due_date_rule'),
  fee: integer('fee'),
  metadata: jsonb('metadata'),
});

export const annualFilings = pgTable('annual_filings', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  requirementId: uuid('requirement_id').references(() => filingRequirements.id),
  filingType: varchar('filing_type', { length: 100 }).notNull(),
  filingYear: integer('filing_year').notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  filedDate: timestamp('filed_date', { withTimezone: true }),
  status: filingStatusEnum('status').notNull().default('pending'),
  confirmationNumber: varchar('confirmation_number', { length: 100 }),
  feePaid: integer('fee_paid'),
  fileStorageKey: varchar('file_storage_key', { length: 500 }),
  metadata: jsonb('metadata'),
});

// =============================================================================
// Audit Log
// =============================================================================

export const entityGovernanceAuditLog = pgTable('entity_governance_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  actorId: uuid('actor_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  changes: jsonb('changes'),
  metadata: jsonb('metadata'),
});

// =============================================================================
// Relations
// =============================================================================

export const legalEntitiesRelations = relations(legalEntities, ({ many }) => ({
  incorporationDocuments: many(incorporationDocuments),
  boards: many(boards),
  shareholders: many(shareholders),
  shareClasses: many(shareClasses),
  officers: many(officers),
  meetingMinutes: many(meetingMinutes),
  resolutions: many(resolutions),
  registeredAgents: many(registeredAgents),
  filingRequirements: many(filingRequirements),
  annualFilings: many(annualFilings),
  bylaws: many(bylaws),
  equityGrants: many(equityGrants),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  entity: one(legalEntities, {
    fields: [boards.entityId],
    references: [legalEntities.id],
  }),
  committees: many(committees),
  directors: many(directors),
  meetingMinutes: many(meetingMinutes),
  resolutions: many(resolutions),
}));

export const shareholdersRelations = relations(shareholders, ({ one, many }) => ({
  entity: one(legalEntities, {
    fields: [shareholders.entityId],
    references: [legalEntities.id],
  }),
  shareholdings: many(shareholdings),
}));

export const shareClassesRelations = relations(shareClasses, ({ one, many }) => ({
  entity: one(legalEntities, {
    fields: [shareClasses.entityId],
    references: [legalEntities.id],
  }),
  shareholdings: many(shareholdings),
  equityGrants: many(equityGrants),
}));
