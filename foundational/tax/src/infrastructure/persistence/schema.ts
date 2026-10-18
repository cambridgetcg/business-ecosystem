/**
 * UK Tax Service - Database Schema (Drizzle ORM)
 *
 * Tables for UK tax compliance:
 * 1. uk_tax_registrations - Entity tax registration with HMRC
 * 2. corporation_tax_periods - Corporation Tax accounting periods
 * 3. uk_vat_returns - VAT returns (MTD format)
 * 4. paye_submissions - RTI submissions (FPS/EPS)
 * 5. employee_tax_records - Employee tax data
 * 6. tax_calculations - Calculation audit trail
 * 7. tax_audit_log - All tax-related changes
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  decimal,
  date,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =============================================================================
// Enums
// =============================================================================

export const vatSchemeEnum = pgEnum('vat_scheme', [
  'standard',
  'flat_rate',
  'cash_accounting',
  'annual_accounting',
]);

export const vatQuarterEndEnum = pgEnum('vat_quarter_end', [
  'march',
  'april',
  'may',
]);

export const registrationStatusEnum = pgEnum('registration_status', [
  'pending',
  'active',
  'suspended',
  'deregistered',
  'cancelled',
]);

export const ctPeriodStatusEnum = pgEnum('ct_period_status', [
  'draft',
  'calculated',
  'filed',
  'amended',
  'paid',
  'overdue',
]);

export const vatReturnStatusEnum = pgEnum('vat_return_status', [
  'draft',
  'calculated',
  'submitted',
  'acknowledged',
  'error',
  'amended',
]);

export const payeSubmissionTypeEnum = pgEnum('paye_submission_type', [
  'fps',
  'eps',
  'nvr',
  'ear',
]);

export const payeSubmissionStatusEnum = pgEnum('paye_submission_status', [
  'draft',
  'validated',
  'submitted',
  'acknowledged',
  'error',
  'superseded',
]);

export const employmentStatusEnum = pgEnum('employment_status', [
  'active',
  'on_leave',
  'terminated',
  'suspended',
]);

export const niCategoryEnum = pgEnum('ni_category', [
  'A', 'B', 'C', 'F', 'H', 'I', 'J', 'L', 'M', 'S', 'V', 'Z',
]);

export const studentLoanPlanEnum = pgEnum('student_loan_plan', [
  'plan1',
  'plan2',
  'plan4',
  'plan5',
  'postgrad',
]);

export const payFrequencyEnum = pgEnum('pay_frequency', [
  'weekly',
  'fortnightly',
  'four_weekly',
  'monthly',
  'quarterly',
  'annually',
]);

export const starterDeclarationEnum = pgEnum('starter_declaration', [
  'A',
  'B',
  'C',
]);

export const directorNIMethodEnum = pgEnum('director_ni_method', [
  'annual',
  'alternative',
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
// 1. UK Tax Registrations
// =============================================================================

export const ukTaxRegistrations = pgTable('uk_tax_registrations', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(), // Reference to entity-governance

  // HMRC Identifiers
  companyUTR: varchar('company_utr', { length: 10 }),
  vatNumber: varchar('vat_number', { length: 15 }),
  payeReference: varchar('paye_reference', { length: 20 }),
  accountsOfficeReference: varchar('accounts_office_reference', { length: 13 }),
  corporationTaxReference: varchar('corporation_tax_reference', { length: 20 }),

  // Corporation Tax
  corporationTaxRegistered: boolean('corporation_tax_registered').notNull().default(false),
  corporationTaxRegistrationDate: timestamp('corporation_tax_registration_date', { withTimezone: true }),

  // VAT Registration
  vatRegistered: boolean('vat_registered').notNull().default(false),
  vatRegistrationDate: timestamp('vat_registration_date', { withTimezone: true }),
  vatDeregistrationDate: timestamp('vat_deregistration_date', { withTimezone: true }),
  vatScheme: vatSchemeEnum('vat_scheme'),
  flatRatePercentage: decimal('flat_rate_percentage', { precision: 5, scale: 2 }),
  vatStatus: registrationStatusEnum('vat_status'),

  // PAYE Registration
  payeRegistered: boolean('paye_registered').notNull().default(false),
  payeRegistrationDate: timestamp('paye_registration_date', { withTimezone: true }),
  payeDeregistrationDate: timestamp('paye_deregistration_date', { withTimezone: true }),
  payeStatus: registrationStatusEnum('paye_status'),

  // Accounting Periods
  accountingPeriodEnd: date('accounting_period_end').notNull(), // MM-DD
  vatQuarterEnd: vatQuarterEndEnum('vat_quarter_end'),

  // MTD Status
  mtdVatEnabled: boolean('mtd_vat_enabled').notNull().default(false),
  mtdVatMandated: boolean('mtd_vat_mandated').notNull().default(false),
  mtdItEnabled: boolean('mtd_it_enabled').notNull().default(false),

  // VAT Thresholds
  vatThresholdExceeded: boolean('vat_threshold_exceeded').notNull().default(false),
  annualTurnover: decimal('annual_turnover', { precision: 15, scale: 2 }),

  // Contact Details
  taxCorrespondenceEmail: varchar('tax_correspondence_email', { length: 255 }),
  taxCorrespondencePhone: varchar('tax_correspondence_phone', { length: 20 }),

  // Metadata
  metadata: jsonb('metadata'),
}, (table) => ({
  entityIdIdx: index('uk_tax_reg_entity_id_idx').on(table.entityId),
  tenantIdIdx: index('uk_tax_reg_tenant_id_idx').on(table.tenantId),
  vatNumberIdx: index('uk_tax_reg_vat_number_idx').on(table.vatNumber),
  payeRefIdx: index('uk_tax_reg_paye_ref_idx').on(table.payeReference),
}));

// =============================================================================
// 2. Corporation Tax Periods
// =============================================================================

export const corporationTaxPeriods = pgTable('corporation_tax_periods', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  registrationId: uuid('registration_id').notNull().references(() => ukTaxRegistrations.id),

  // Period
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  financialYear: varchar('financial_year', { length: 6 }).notNull(), // FY2024

  // Profit Computation
  tradingProfits: decimal('trading_profits', { precision: 15, scale: 2 }).notNull().default('0'),
  tradingLossesBroughtForward: decimal('trading_losses_bf', { precision: 15, scale: 2 }).notNull().default('0'),
  tradingLossesCarriedBack: decimal('trading_losses_cb', { precision: 15, scale: 2 }).notNull().default('0'),
  investmentIncome: decimal('investment_income', { precision: 15, scale: 2 }).notNull().default('0'),
  propertyIncome: decimal('property_income', { precision: 15, scale: 2 }).notNull().default('0'),
  otherIncome: decimal('other_income', { precision: 15, scale: 2 }).notNull().default('0'),
  chargeableGains: decimal('chargeable_gains', { precision: 15, scale: 2 }).notNull().default('0'),
  capitalLossesBroughtForward: decimal('capital_losses_bf', { precision: 15, scale: 2 }).notNull().default('0'),
  capitalLossesUsed: decimal('capital_losses_used', { precision: 15, scale: 2 }).notNull().default('0'),

  // Totals
  totalProfitsBeforeDeductions: decimal('total_profits_before_deductions', { precision: 15, scale: 2 }).notNull().default('0'),
  tradingLossesRelief: decimal('trading_losses_relief', { precision: 15, scale: 2 }).notNull().default('0'),
  groupRelief: decimal('group_relief', { precision: 15, scale: 2 }).notNull().default('0'),
  managementExpenses: decimal('management_expenses', { precision: 15, scale: 2 }).notNull().default('0'),
  qualifyingCharitableDonations: decimal('qualifying_charitable_donations', { precision: 15, scale: 2 }).notNull().default('0'),
  profitsChargeableToCT: decimal('profits_chargeable_to_ct', { precision: 15, scale: 2 }).notNull().default('0'),

  // Associated Companies
  associatedCompaniesCount: integer('associated_companies_count').notNull().default(0),
  adjustedLowerLimit: decimal('adjusted_lower_limit', { precision: 15, scale: 2 }).notNull().default('50000'),
  adjustedUpperLimit: decimal('adjusted_upper_limit', { precision: 15, scale: 2 }).notNull().default('250000'),

  // Tax Calculation
  smallProfitsRateAmount: decimal('small_profits_rate_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  mainRateAmount: decimal('main_rate_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  marginalReliefAmount: decimal('marginal_relief_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  effectiveRate: decimal('effective_rate', { precision: 10, scale: 6 }).notNull().default('0'),
  corporationTaxLiability: decimal('corporation_tax_liability', { precision: 15, scale: 2 }).notNull().default('0'),

  // Credits
  rdTaxCredits: decimal('rd_tax_credits', { precision: 15, scale: 2 }),
  foreignTaxCredit: decimal('foreign_tax_credit', { precision: 15, scale: 2 }),
  otherCredits: decimal('other_credits', { precision: 15, scale: 2 }),

  // Net Tax
  taxDue: decimal('tax_due', { precision: 15, scale: 2 }).notNull().default('0'),
  taxPaid: decimal('tax_paid', { precision: 15, scale: 2 }).notNull().default('0'),
  taxOutstanding: decimal('tax_outstanding', { precision: 15, scale: 2 }).notNull().default('0'),

  // Status
  status: ctPeriodStatusEnum('status').notNull().default('draft'),
  filingDeadline: date('filing_deadline').notNull(),
  paymentDeadline: date('payment_deadline').notNull(),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }),
  filedAt: timestamp('filed_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),

  // HMRC References
  hmrcSubmissionId: varchar('hmrc_submission_id', { length: 100 }),
  hmrcReceiptNumber: varchar('hmrc_receipt_number', { length: 100 }),

  // Audit
  notes: text('notes'),
  metadata: jsonb('metadata'),
}, (table) => ({
  entityIdIdx: index('ct_period_entity_id_idx').on(table.entityId),
  tenantIdIdx: index('ct_period_tenant_id_idx').on(table.tenantId),
  periodEndIdx: index('ct_period_end_idx').on(table.periodEnd),
  statusIdx: index('ct_period_status_idx').on(table.status),
}));

// =============================================================================
// 3. UK VAT Returns
// =============================================================================

export const ukVatReturns = pgTable('uk_vat_returns', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  registrationId: uuid('registration_id').notNull().references(() => ukTaxRegistrations.id),

  // Period
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  periodKey: varchar('period_key', { length: 10 }).notNull(),

  // VAT Boxes (MTD format)
  box1: decimal('box1', { precision: 13, scale: 2 }).notNull().default('0'), // VAT due on sales
  box2: decimal('box2', { precision: 13, scale: 2 }).notNull().default('0'), // VAT due on acquisitions
  box3: decimal('box3', { precision: 13, scale: 2 }).notNull().default('0'), // Total VAT due
  box4: decimal('box4', { precision: 13, scale: 2 }).notNull().default('0'), // VAT reclaimed
  box5: decimal('box5', { precision: 13, scale: 2 }).notNull().default('0'), // Net VAT
  box6: decimal('box6', { precision: 13, scale: 0 }).notNull().default('0'), // Total sales ex VAT (whole pounds)
  box7: decimal('box7', { precision: 13, scale: 0 }).notNull().default('0'), // Total purchases ex VAT
  box8: decimal('box8', { precision: 13, scale: 0 }).notNull().default('0'), // EU supplies
  box9: decimal('box9', { precision: 13, scale: 0 }).notNull().default('0'), // EU acquisitions

  // Flat Rate Scheme
  flatRateScheme: boolean('flat_rate_scheme').notNull().default(false),
  flatRateTurnover: decimal('flat_rate_turnover', { precision: 15, scale: 2 }),
  flatRatePercentage: decimal('flat_rate_percentage', { precision: 5, scale: 2 }),
  flatRateVAT: decimal('flat_rate_vat', { precision: 15, scale: 2 }),

  // Status
  status: vatReturnStatusEnum('status').notNull().default('draft'),
  submissionDeadline: date('submission_deadline').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),

  // MTD Tracking
  mtdObligationId: varchar('mtd_obligation_id', { length: 100 }),
  mtdReceiptId: varchar('mtd_receipt_id', { length: 100 }),
  mtdFormBundleNumber: varchar('mtd_form_bundle_number', { length: 100 }),
  mtdPaymentIndicator: varchar('mtd_payment_indicator', { length: 50 }),

  // Declaration
  declarationAccepted: boolean('declaration_accepted').notNull().default(false),
  declarationAcceptedBy: varchar('declaration_accepted_by', { length: 255 }),
  declarationAcceptedAt: timestamp('declaration_accepted_at', { withTimezone: true }),

  // Adjustments
  adjustments: jsonb('adjustments'),

  // Audit
  notes: text('notes'),
  metadata: jsonb('metadata'),
}, (table) => ({
  entityIdIdx: index('vat_return_entity_id_idx').on(table.entityId),
  tenantIdIdx: index('vat_return_tenant_id_idx').on(table.tenantId),
  periodEndIdx: index('vat_return_period_end_idx').on(table.periodEnd),
  statusIdx: index('vat_return_status_idx').on(table.status),
  periodKeyIdx: index('vat_return_period_key_idx').on(table.periodKey),
}));

// =============================================================================
// 4. PAYE Submissions
// =============================================================================

export const payeSubmissions = pgTable('paye_submissions', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  registrationId: uuid('registration_id').notNull().references(() => ukTaxRegistrations.id),

  submissionType: payeSubmissionTypeEnum('submission_type').notNull(),

  // Period
  taxYear: varchar('tax_year', { length: 7 }).notNull(), // 2024-25
  taxMonth: integer('tax_month').notNull(), // 1-12
  paymentDate: date('payment_date'),
  payFrequency: payFrequencyEnum('pay_frequency'),

  // FPS Totals
  employeeCount: integer('employee_count'),
  totalPayInPeriod: decimal('total_pay_in_period', { precision: 15, scale: 2 }),
  totalTaxDeducted: decimal('total_tax_deducted', { precision: 15, scale: 2 }),
  totalStudentLoan: decimal('total_student_loan', { precision: 15, scale: 2 }),
  totalPostgraduateLoan: decimal('total_postgraduate_loan', { precision: 15, scale: 2 }),
  totalEmployeeNI: decimal('total_employee_ni', { precision: 15, scale: 2 }),
  totalEmployerNI: decimal('total_employer_ni', { precision: 15, scale: 2 }),

  // Statutory Payments
  totalSMP: decimal('total_smp', { precision: 15, scale: 2 }),
  totalSPP: decimal('total_spp', { precision: 15, scale: 2 }),
  totalSAP: decimal('total_sap', { precision: 15, scale: 2 }),
  totalShPP: decimal('total_shpp', { precision: 15, scale: 2 }),
  totalSSP: decimal('total_ssp', { precision: 15, scale: 2 }),

  // EPS Fields
  smpRecovered: decimal('smp_recovered', { precision: 15, scale: 2 }),
  sppRecovered: decimal('spp_recovered', { precision: 15, scale: 2 }),
  sapRecovered: decimal('sap_recovered', { precision: 15, scale: 2 }),
  shppRecovered: decimal('shpp_recovered', { precision: 15, scale: 2 }),
  nicCompensation: decimal('nic_compensation', { precision: 15, scale: 2 }),
  cisDeductionsSuffered: decimal('cis_deductions_suffered', { precision: 15, scale: 2 }),

  // EPS Flags
  noPaymentForPeriod: boolean('no_payment_for_period').default(false),
  periodOfInactivity: jsonb('period_of_inactivity'),
  employmentAllowanceClaim: boolean('employment_allowance_claim').default(false),
  apprenticeshipLevyClaim: decimal('apprenticeship_levy_claim', { precision: 15, scale: 2 }),
  finalSubmissionForYear: boolean('final_submission_for_year').default(false),
  dateSchemesClosed: date('date_schemes_closed'),
  schemeCeasedDate: date('scheme_ceased_date'),

  // Status
  status: payeSubmissionStatusEnum('status').notNull().default('draft'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),

  // HMRC Response
  hmrcCorrelationId: varchar('hmrc_correlation_id', { length: 100 }),
  hmrcReceiptTimestamp: timestamp('hmrc_receipt_timestamp', { withTimezone: true }),
  hmrcErrors: jsonb('hmrc_errors'),

  // Audit
  notes: text('notes'),
  metadata: jsonb('metadata'),
}, (table) => ({
  entityIdIdx: index('paye_sub_entity_id_idx').on(table.entityId),
  tenantIdIdx: index('paye_sub_tenant_id_idx').on(table.tenantId),
  taxYearIdx: index('paye_sub_tax_year_idx').on(table.taxYear),
  submissionTypeIdx: index('paye_sub_type_idx').on(table.submissionType),
}));

// =============================================================================
// 5. Employee Tax Records
// =============================================================================

export const employeeTaxRecords = pgTable('employee_tax_records', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  employeeId: uuid('employee_id').notNull(),

  // Tax Identifiers
  nationalInsuranceNumber: varchar('national_insurance_number', { length: 9 }),
  taxCode: varchar('tax_code', { length: 10 }).notNull().default('1257L'),
  niCategory: niCategoryEnum('ni_category').notNull().default('A'),
  isDirector: boolean('is_director').notNull().default(false),
  directorNIMethod: directorNIMethodEnum('director_ni_method'),
  directorAppointmentDate: date('director_appointment_date'),

  // Student Loans
  studentLoanPlan: studentLoanPlanEnum('student_loan_plan'),
  hasPostgraduateLoan: boolean('has_postgraduate_loan').notNull().default(false),

  // Employment
  employmentStatus: employmentStatusEnum('employment_status').notNull().default('active'),
  payFrequency: payFrequencyEnum('pay_frequency').notNull().default('monthly'),
  payrollId: varchar('payroll_id', { length: 35 }),

  // Current Tax Year
  taxYear: varchar('tax_year', { length: 7 }).notNull(),

  // YTD Figures
  grossPayYTD: decimal('gross_pay_ytd', { precision: 15, scale: 2 }).notNull().default('0'),
  taxablePayYTD: decimal('taxable_pay_ytd', { precision: 15, scale: 2 }).notNull().default('0'),
  taxPaidYTD: decimal('tax_paid_ytd', { precision: 15, scale: 2 }).notNull().default('0'),
  niablePayYTD: decimal('niable_pay_ytd', { precision: 15, scale: 2 }).notNull().default('0'),
  employeeNIYTD: decimal('employee_ni_ytd', { precision: 15, scale: 2 }).notNull().default('0'),
  employerNIYTD: decimal('employer_ni_ytd', { precision: 15, scale: 2 }).notNull().default('0'),
  studentLoanYTD: decimal('student_loan_ytd', { precision: 15, scale: 2 }).notNull().default('0'),
  postgraduateLoanYTD: decimal('postgraduate_loan_ytd', { precision: 15, scale: 2 }).notNull().default('0'),

  // Benefits
  benefitsInKindYTD: decimal('benefits_in_kind_ytd', { precision: 15, scale: 2 }).notNull().default('0'),
  benefitsTaxYTD: decimal('benefits_tax_ytd', { precision: 15, scale: 2 }).notNull().default('0'),

  // Statutory Payments YTD
  smpYTD: decimal('smp_ytd', { precision: 15, scale: 2 }).notNull().default('0'),
  sppYTD: decimal('spp_ytd', { precision: 15, scale: 2 }).notNull().default('0'),
  sapYTD: decimal('sap_ytd', { precision: 15, scale: 2 }).notNull().default('0'),
  shppYTD: decimal('shpp_ytd', { precision: 15, scale: 2 }).notNull().default('0'),
  sspYTD: decimal('ssp_ytd', { precision: 15, scale: 2 }).notNull().default('0'),

  // Period Tracking
  currentPeriodNumber: integer('current_period_number').notNull().default(1),
  periodsWorkedThisYear: integer('periods_worked_this_year').notNull().default(0),

  // Starter/Leaver
  startDate: date('start_date').notNull(),
  leaveDate: date('leave_date'),
  starterDeclaration: starterDeclarationEnum('starter_declaration'),
  p45Details: jsonb('p45_details'),

  // P60/P45
  p60Issued: boolean('p60_issued').notNull().default(false),
  p60IssuedAt: timestamp('p60_issued_at', { withTimezone: true }),
  p45Issued: boolean('p45_issued').notNull().default(false),
  p45IssuedAt: timestamp('p45_issued_at', { withTimezone: true }),

  // Special Cases
  week1Month1Basis: boolean('week1_month1_basis').notNull().default(false),
  irregularPaymentPattern: boolean('irregular_payment_pattern').notNull().default(false),
  offPayrollWorker: boolean('off_payroll_worker').notNull().default(false),

  // Audit
  notes: text('notes'),
  metadata: jsonb('metadata'),
}, (table) => ({
  entityIdIdx: index('emp_tax_entity_id_idx').on(table.entityId),
  tenantIdIdx: index('emp_tax_tenant_id_idx').on(table.tenantId),
  employeeIdIdx: index('emp_tax_employee_id_idx').on(table.employeeId),
  ninoIdx: index('emp_tax_nino_idx').on(table.nationalInsuranceNumber),
  taxYearIdx: index('emp_tax_year_idx').on(table.taxYear),
}));

// =============================================================================
// 6. Tax Calculations (Audit Trail)
// =============================================================================

export const taxCalculations = pgTable('tax_calculations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),

  // Reference
  calculationType: varchar('calculation_type', { length: 50 }).notNull(), // corporation_tax, vat, paye, ni
  referenceId: uuid('reference_id').notNull(), // ID of period/return/submission
  referenceType: varchar('reference_type', { length: 50 }).notNull(),

  // Calculation Details
  input: jsonb('input').notNull(),
  output: jsonb('output').notNull(),
  breakdown: jsonb('breakdown'),

  // Result
  calculatedAmount: decimal('calculated_amount', { precision: 15, scale: 2 }).notNull(),

  // Audit
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
  calculatedBy: uuid('calculated_by'),
  notes: text('notes'),
  metadata: jsonb('metadata'),
}, (table) => ({
  entityIdIdx: index('tax_calc_entity_id_idx').on(table.entityId),
  referenceIdIdx: index('tax_calc_reference_id_idx').on(table.referenceId),
  typeIdx: index('tax_calc_type_idx').on(table.calculationType),
}));

// =============================================================================
// 7. Tax Audit Log
// =============================================================================

export const taxAuditLog = pgTable('tax_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  actorId: uuid('actor_id'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  changes: jsonb('changes'),
  previousState: jsonb('previous_state'),
  newState: jsonb('new_state'),
  metadata: jsonb('metadata'),
}, (table) => ({
  entityIdIdx: index('tax_audit_entity_id_idx').on(table.entityId),
  entityTypeIdx: index('tax_audit_entity_type_idx').on(table.entityType),
  occurredAtIdx: index('tax_audit_occurred_at_idx').on(table.occurredAt),
}));

// =============================================================================
// 8. HMRC OAuth Tokens
// =============================================================================

export const hmrcOAuthTokens = pgTable('hmrc_oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  registrationId: uuid('registration_id').notNull().references(() => ukTaxRegistrations.id),

  // Token Scope
  scope: varchar('scope', { length: 100 }).notNull(), // 'read:vat', 'write:vat', etc.

  // Tokens (encrypted)
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  // Metadata
  grantedScopes: jsonb('granted_scopes').$type<string[]>(),
  environment: varchar('environment', { length: 20 }).notNull().default('sandbox'), // 'sandbox' | 'production'

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (table) => ({
  entityScopeIdx: index('hmrc_oauth_entity_scope_idx').on(table.entityId, table.scope),
  registrationIdx: index('hmrc_oauth_registration_idx').on(table.registrationId),
}));

// =============================================================================
// Relations
// =============================================================================

export const ukTaxRegistrationsRelations = relations(ukTaxRegistrations, ({ many }) => ({
  corporationTaxPeriods: many(corporationTaxPeriods),
  vatReturns: many(ukVatReturns),
  payeSubmissions: many(payeSubmissions),
}));

export const corporationTaxPeriodsRelations = relations(corporationTaxPeriods, ({ one }) => ({
  registration: one(ukTaxRegistrations, {
    fields: [corporationTaxPeriods.registrationId],
    references: [ukTaxRegistrations.id],
  }),
}));

export const ukVatReturnsRelations = relations(ukVatReturns, ({ one }) => ({
  registration: one(ukTaxRegistrations, {
    fields: [ukVatReturns.registrationId],
    references: [ukTaxRegistrations.id],
  }),
}));

export const payeSubmissionsRelations = relations(payeSubmissions, ({ one }) => ({
  registration: one(ukTaxRegistrations, {
    fields: [payeSubmissions.registrationId],
    references: [ukTaxRegistrations.id],
  }),
}));
