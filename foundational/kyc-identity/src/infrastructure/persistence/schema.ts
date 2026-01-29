/**
 * KYC Database Schema - Drizzle ORM
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  date,
} from 'drizzle-orm/pg-core';

// Identities table
export const identities = pgTable('identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 255 }),
  tenantId: uuid('tenant_id').notNull(),
  
  // Type
  type: varchar('type', { length: 50 }).notNull(), // INDIVIDUAL, CORPORATE, TRUST, PARTNERSHIP
  
  // Individual fields
  firstName: varchar('first_name', { length: 100 }),
  middleName: varchar('middle_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  dateOfBirth: date('date_of_birth'),
  nationality: varchar('nationality', { length: 2 }),
  taxId: varchar('tax_id', { length: 50 }),
  
  // Corporate fields
  legalName: varchar('legal_name', { length: 500 }),
  tradingName: varchar('trading_name', { length: 500 }),
  registrationNumber: varchar('registration_number', { length: 100 }),
  registrationCountry: varchar('registration_country', { length: 2 }),
  incorporationDate: date('incorporation_date'),
  entityType: varchar('entity_type', { length: 100 }),
  industry: varchar('industry', { length: 200 }),
  website: varchar('website', { length: 500 }),
  
  // Contact
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 30 }),
  
  // Address
  addressLine1: varchar('address_line1', { length: 200 }),
  addressLine2: varchar('address_line2', { length: 200 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 2 }),
  
  // Verification
  verificationStatus: varchar('verification_status', { length: 50 }).notNull().default('PENDING'),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: varchar('verified_by', { length: 255 }),
  verificationExpiresAt: timestamp('verification_expires_at'),
  
  // Risk
  riskLevel: varchar('risk_level', { length: 20 }),
  riskAssessment: jsonb('risk_assessment'),
  
  // Flags
  isPep: boolean('is_pep').notNull().default(false),
  isSanctioned: boolean('is_sanctioned').notNull().default(false),
  hasAdverseMedia: boolean('has_adverse_media').notNull().default(false),
  
  // Beneficial owners (for corporate)
  beneficialOwners: jsonb('beneficial_owners'),
  
  // Metadata
  metadata: jsonb('metadata'),
  tags: jsonb('tags'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index('identities_tenant_idx').on(table.tenantId),
  externalIdIdx: uniqueIndex('identities_external_id_idx').on(table.tenantId, table.externalId),
  statusIdx: index('identities_status_idx').on(table.verificationStatus),
  typeIdx: index('identities_type_idx').on(table.type),
  riskIdx: index('identities_risk_idx').on(table.riskLevel),
  emailIdx: index('identities_email_idx').on(table.email),
}));

// Documents table
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  identityId: uuid('identity_id').notNull().references(() => identities.id),
  tenantId: uuid('tenant_id').notNull(),
  
  // Document info
  type: varchar('type', { length: 50 }).notNull(),
  documentNumber: varchar('document_number', { length: 100 }),
  issuingCountry: varchar('issuing_country', { length: 2 }),
  issuingAuthority: varchar('issuing_authority', { length: 200 }),
  issueDate: date('issue_date'),
  expiryDate: date('expiry_date'),
  
  // File info
  fileName: varchar('file_name', { length: 500 }).notNull(),
  fileType: varchar('file_type', { length: 100 }).notNull(),
  fileSize: integer('file_size').notNull(),
  storageKey: varchar('storage_key', { length: 1000 }).notNull(),
  checksum: varchar('checksum', { length: 128 }),
  
  // Processing
  status: varchar('status', { length: 50 }).notNull().default('UPLOADED'),
  ocrData: jsonb('ocr_data'),
  extractedData: jsonb('extracted_data'),
  
  // Verification
  verificationStatus: varchar('verification_status', { length: 50 }).notNull().default('PENDING'),
  verificationChecks: jsonb('verification_checks'),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: varchar('verified_by', { length: 255 }),
  rejectionReason: text('rejection_reason'),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Timestamps
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  identityIdx: index('documents_identity_idx').on(table.identityId),
  tenantIdx: index('documents_tenant_idx').on(table.tenantId),
  typeIdx: index('documents_type_idx').on(table.type),
  statusIdx: index('documents_status_idx').on(table.status),
  expiryIdx: index('documents_expiry_idx').on(table.expiryDate),
}));

// Verification Requests table
export const verificationRequests = pgTable('verification_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  identityId: uuid('identity_id').notNull().references(() => identities.id),
  tenantId: uuid('tenant_id').notNull(),
  
  // Request info
  type: varchar('type', { length: 50 }).notNull(),
  priority: varchar('priority', { length: 20 }).notNull().default('NORMAL'),
  
  // Status
  status: varchar('status', { length: 50 }).notNull().default('PENDING'),
  
  // Required documents
  requiredDocuments: jsonb('required_documents').notNull(),
  
  // Checks
  checks: jsonb('checks'),
  checksCompleted: integer('checks_completed').notNull().default(0),
  checksTotal: integer('checks_total').notNull().default(0),
  
  // Risk
  riskLevel: varchar('risk_level', { length: 20 }),
  riskScore: integer('risk_score'),
  riskFactors: jsonb('risk_factors'),
  
  // Assignment
  assignedTo: varchar('assigned_to', { length: 255 }),
  assignedAt: timestamp('assigned_at'),
  
  // Review
  reviewNotes: text('review_notes'),
  internalNotes: text('internal_notes'),
  
  // Timestamps
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  expiresAt: timestamp('expires_at'),
  
  // Requester
  requestedBy: varchar('requested_by', { length: 255 }).notNull(),
  requestSource: varchar('request_source', { length: 50 }).notNull(),
  
  // Decision
  decision: varchar('decision', { length: 20 }),
  decisionReason: text('decision_reason'),
  decisionBy: varchar('decision_by', { length: 255 }),
  decisionAt: timestamp('decision_at'),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  identityIdx: index('verification_requests_identity_idx').on(table.identityId),
  tenantIdx: index('verification_requests_tenant_idx').on(table.tenantId),
  statusIdx: index('verification_requests_status_idx').on(table.status),
  typeIdx: index('verification_requests_type_idx').on(table.type),
  assignedIdx: index('verification_requests_assigned_idx').on(table.assignedTo),
  priorityIdx: index('verification_requests_priority_idx').on(table.priority),
}));

// AML Screening Results table
export const amlScreeningResults = pgTable('aml_screening_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  identityId: uuid('identity_id').notNull().references(() => identities.id),
  verificationRequestId: uuid('verification_request_id').references(() => verificationRequests.id),
  tenantId: uuid('tenant_id').notNull(),
  
  // Screening info
  screeningType: varchar('screening_type', { length: 50 }).notNull(), // PEP, SANCTIONS, ADVERSE_MEDIA
  provider: varchar('provider', { length: 100 }),
  providerReference: varchar('provider_reference', { length: 255 }),
  
  // Results
  matchFound: boolean('match_found').notNull().default(false),
  matchScore: integer('match_score'),
  matchCount: integer('match_count').default(0),
  matches: jsonb('matches'),
  
  // Status
  status: varchar('status', { length: 50 }).notNull().default('PENDING'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  disposition: varchar('disposition', { length: 50 }), // CONFIRMED_MATCH, FALSE_POSITIVE, REQUIRES_EDD
  
  // Timestamps
  screenedAt: timestamp('screened_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  identityIdx: index('aml_screening_identity_idx').on(table.identityId),
  tenantIdx: index('aml_screening_tenant_idx').on(table.tenantId),
  typeIdx: index('aml_screening_type_idx').on(table.screeningType),
  matchIdx: index('aml_screening_match_idx').on(table.matchFound),
}));

// Audit Log table
export const kycAuditLog = pgTable('kyc_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  
  // Reference
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  
  // Action
  action: varchar('action', { length: 100 }).notNull(),
  previousValue: jsonb('previous_value'),
  newValue: jsonb('new_value'),
  
  // Actor
  performedBy: varchar('performed_by', { length: 255 }).notNull(),
  performedByType: varchar('performed_by_type', { length: 50 }).notNull(), // USER, SYSTEM, API
  
  // Context
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  correlationId: uuid('correlation_id'),
  
  // Timestamps
  performedAt: timestamp('performed_at').notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index('kyc_audit_tenant_idx').on(table.tenantId),
  entityIdx: index('kyc_audit_entity_idx').on(table.entityType, table.entityId),
  actionIdx: index('kyc_audit_action_idx').on(table.action),
  performedAtIdx: index('kyc_audit_performed_at_idx').on(table.performedAt),
}));

// Type exports
export type IdentityRecord = typeof identities.$inferSelect;
export type NewIdentityRecord = typeof identities.$inferInsert;

export type DocumentRecord = typeof documents.$inferSelect;
export type NewDocumentRecord = typeof documents.$inferInsert;

export type VerificationRequestRecord = typeof verificationRequests.$inferSelect;
export type NewVerificationRequestRecord = typeof verificationRequests.$inferInsert;

export type AmlScreeningResultRecord = typeof amlScreeningResults.$inferSelect;
export type NewAmlScreeningResultRecord = typeof amlScreeningResults.$inferInsert;

export type KycAuditLogRecord = typeof kycAuditLog.$inferSelect;
export type NewKycAuditLogRecord = typeof kycAuditLog.$inferInsert;
