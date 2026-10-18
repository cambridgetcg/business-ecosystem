/**
 * Contracts Legal - Database Schema (Drizzle ORM)
 *
 * Tables for contract management, templates, and signatures.
 */

import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =============================================================================
// Enums
// =============================================================================

export const contractStatusEnum = pgEnum('contract_status', [
  'draft',
  'pending_review',
  'pending_signatures',
  'active',
  'expired',
  'terminated',
  'renewed',
  'suspended',
]);

export const contractTypeEnum = pgEnum('contract_type', [
  'service_agreement',
  'employment',
  'nda',
  'msa',
  'sow',
  'lease',
  'vendor',
  'partnership',
  'licensing',
  'subscription',
  'loan',
  'consulting',
  'other',
]);

export const templateStatusEnum = pgEnum('template_status', [
  'draft',
  'active',
  'archived',
  'deprecated',
]);

export const partyTypeEnum = pgEnum('party_type', [
  'entity',
  'individual',
  'external',
]);

export const partyRoleEnum = pgEnum('party_role', [
  'owner',
  'counterparty',
  'guarantor',
  'witness',
  'notary',
]);

export const signatureStatusEnum = pgEnum('signature_status', [
  'pending',
  'signed',
  'declined',
  'expired',
  'voided',
]);

export const signatureProviderEnum = pgEnum('signature_provider', [
  'docusign',
  'hellosign',
  'adobe_sign',
  'internal',
]);

// =============================================================================
// Base Columns
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
// Contract Templates
// =============================================================================

export const contractTemplates = pgTable('contract_templates', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  contractType: contractTypeEnum('contract_type').notNull(),
  status: templateStatusEnum('status').notNull().default('draft'),
  content: text('content').notNull(),
  variables: jsonb('variables'),
  previousVersionId: uuid('previous_version_id'),
  usageCount: integer('usage_count').notNull().default(0),
  requiresApproval: boolean('requires_approval').notNull().default(false),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  documentStorageKey: varchar('document_storage_key', { length: 500 }),
  metadata: jsonb('metadata'),
  tags: jsonb('tags'),
});

// =============================================================================
// Contracts
// =============================================================================

export const contracts = pgTable('contracts', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  contractNumber: varchar('contract_number', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  contractType: contractTypeEnum('contract_type').notNull(),
  status: contractStatusEnum('status').notNull().default('draft'),
  ownerEntityId: uuid('owner_entity_id').notNull(),
  templateId: uuid('template_id').references(() => contractTemplates.id),
  templateVersion: integer('template_version'),
  effectiveDate: timestamp('effective_date', { withTimezone: true }),
  expirationDate: timestamp('expiration_date', { withTimezone: true }),
  executedDate: timestamp('executed_date', { withTimezone: true }),
  terminatedDate: timestamp('terminated_date', { withTimezone: true }),
  totalValueAmount: integer('total_value_amount'),
  totalValueCurrency: varchar('total_value_currency', { length: 3 }).default('USD'),
  paymentTerms: varchar('payment_terms', { length: 500 }),
  renewalTerms: jsonb('renewal_terms'),
  renewalCount: integer('renewal_count').notNull().default(0),
  documentStorageKey: varchar('document_storage_key', { length: 500 }),
  documentVersion: integer('document_version').notNull().default(1),
  externalContractId: varchar('external_contract_id', { length: 100 }),
  metadata: jsonb('metadata'),
  tags: jsonb('tags'),
});

// =============================================================================
// Contract Parties
// =============================================================================

export const contractParties = pgTable('contract_parties', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id').notNull().references(() => contracts.id),
  partyType: partyTypeEnum('party_type').notNull(),
  partyRole: partyRoleEnum('party_role').notNull(),
  entityId: uuid('entity_id'),
  personId: uuid('person_id'),
  externalName: varchar('external_name', { length: 255 }),
  externalEmail: varchar('external_email', { length: 255 }),
  signatureRequired: boolean('signature_required').notNull().default(true),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  signedBy: uuid('signed_by'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// =============================================================================
// Signature Requests
// =============================================================================

export const signatureRequests = pgTable('signature_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id').notNull().references(() => contracts.id),
  contractPartyId: uuid('contract_party_id').notNull().references(() => contractParties.id),
  tenantId: uuid('tenant_id').notNull(),
  signerName: varchar('signer_name', { length: 255 }).notNull(),
  signerEmail: varchar('signer_email', { length: 255 }).notNull(),
  status: signatureStatusEnum('status').notNull().default('pending'),
  externalProvider: signatureProviderEnum('external_provider'),
  externalRequestId: varchar('external_request_id', { length: 255 }),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  requestedBy: uuid('requested_by').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  signatureData: text('signature_data'),
  signedIpAddress: varchar('signed_ip_address', { length: 45 }),
  signedUserAgent: varchar('signed_user_agent', { length: 500 }),
  declinedAt: timestamp('declined_at', { withTimezone: true }),
  declineReason: varchar('decline_reason', { length: 500 }),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidReason: varchar('void_reason', { length: 500 }),
  reminderCount: integer('reminder_count').notNull().default(0),
  lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// =============================================================================
// Signature Audit Log
// =============================================================================

export const signatureAuditLog = pgTable('signature_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  signatureRequestId: uuid('signature_request_id').notNull().references(() => signatureRequests.id),
  action: varchar('action', { length: 50 }).notNull(),
  actorId: uuid('actor_id'),
  actorEmail: varchar('actor_email', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  details: jsonb('details'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});

// =============================================================================
// Contract Documents (Versions)
// =============================================================================

export const contractDocuments = pgTable('contract_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id').notNull().references(() => contracts.id),
  version: integer('version').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 100 }).notNull(),
  fileSize: integer('file_size').notNull(),
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  checksum: varchar('checksum', { length: 64 }),
  uploadedBy: uuid('uploaded_by').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata'),
});

// =============================================================================
// Relations
// =============================================================================

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  template: one(contractTemplates, {
    fields: [contracts.templateId],
    references: [contractTemplates.id],
  }),
  parties: many(contractParties),
  signatureRequests: many(signatureRequests),
  documents: many(contractDocuments),
}));

export const contractPartiesRelations = relations(contractParties, ({ one, many }) => ({
  contract: one(contracts, {
    fields: [contractParties.contractId],
    references: [contracts.id],
  }),
  signatureRequests: many(signatureRequests),
}));

export const signatureRequestsRelations = relations(signatureRequests, ({ one, many }) => ({
  contract: one(contracts, {
    fields: [signatureRequests.contractId],
    references: [contracts.id],
  }),
  party: one(contractParties, {
    fields: [signatureRequests.contractPartyId],
    references: [contractParties.id],
  }),
  auditLogs: many(signatureAuditLog),
}));

export const signatureAuditLogRelations = relations(signatureAuditLog, ({ one }) => ({
  signatureRequest: one(signatureRequests, {
    fields: [signatureAuditLog.signatureRequestId],
    references: [signatureRequests.id],
  }),
}));

export const contractDocumentsRelations = relations(contractDocuments, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractDocuments.contractId],
    references: [contracts.id],
  }),
}));
