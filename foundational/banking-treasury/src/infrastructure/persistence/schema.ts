import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  decimal,
  boolean,
  jsonb,
  index,
  time,
  text,
  date,
  unique,
} from 'drizzle-orm/pg-core';

/**
 * Bank Accounts Table
 * Core aggregate for cash management
 */
export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').notNull(),
    accountName: varchar('account_name', { length: 200 }).notNull(),
    accountType: varchar('account_type', { length: 50 }).notNull(),
    bankName: varchar('bank_name', { length: 200 }).notNull(),
    accountNumber: varchar('account_number', { length: 255 }).notNull(),
    routingNumber: varchar('routing_number', { length: 255 }),
    iban: varchar('iban', { length: 255 }),
    swiftCode: varchar('swift_code', { length: 255 }),
    currency: varchar('currency', { length: 3 }).notNull(),
    balanceAmount: decimal('balance_amount', { precision: 20, scale: 2 }).notNull(),
    balanceCurrency: varchar('balance_currency', { length: 3 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    version: integer('version').notNull().default(1),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    entityIdIdx: index('idx_bank_accounts_entity_id').on(table.entityId),
    statusIdx: index('idx_bank_accounts_status').on(table.status),
    currencyIdx: index('idx_bank_accounts_currency').on(table.currency),
  })
);

/**
 * Payments Table
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id'),
    transactionId: uuid('transaction_id').notNull(),
    amountValue: decimal('amount_value', { precision: 20, scale: 2 }).notNull(),
    amountCurrency: varchar('amount_currency', { length: 3 }).notNull(),
    method: varchar('method', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    version: integer('version').notNull().default(1),
    metadata: jsonb('metadata'),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    transactionIdIdx: index('idx_payments_transaction_id').on(table.transactionId),
    statusIdx: index('idx_payments_status').on(table.status),
    methodIdx: index('idx_payments_method').on(table.method),
  })
);

/**
 * Cash Forecast Table
 */
export const cashForecasts = pgTable(
  'cash_forecasts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').notNull(),
    period: varchar('period', { length: 50 }).notNull(),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    projectedInflows: decimal('projected_inflows', { precision: 20, scale: 2 }).notNull(),
    projectedOutflows: decimal('projected_outflows', { precision: 20, scale: 2 }).notNull(),
    projectedBalance: decimal('projected_balance', { precision: 20, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    confidence: integer('confidence').notNull(),
    assumptions: jsonb('assumptions'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by'),
    version: integer('version').notNull().default(1),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    entityIdIdx: index('idx_cash_forecasts_entity_id').on(table.entityId),
    periodIdx: index('idx_cash_forecasts_period').on(table.period),
    dateRangeIdx: index('idx_cash_forecasts_date_range').on(table.startDate, table.endDate),
  })
);

/**
 * Reconciliation Table
 */
export const reconciliations = pgTable(
  'reconciliations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bankAccountId: uuid('bank_account_id').notNull(),
    statementDate: timestamp('statement_date').notNull(),
    statementBalance: decimal('statement_balance', { precision: 20, scale: 2 }).notNull(),
    systemBalance: decimal('system_balance', { precision: 20, scale: 2 }).notNull(),
    difference: decimal('difference', { precision: 20, scale: 2 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    notes: varchar('notes', { length: 2000 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by'),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at'),
    metadata: jsonb('metadata'),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    bankAccountIdIdx: index('idx_reconciliations_bank_account_id').on(table.bankAccountId),
    statementDateIdx: index('idx_reconciliations_statement_date').on(table.statementDate),
    statusIdx: index('idx_reconciliations_status').on(table.status),
  })
);

// =============================================================================
// PAYMENT ORCHESTRATION TABLES
// =============================================================================

/**
 * Payment Rails Table
 * Stores payment network definitions with capabilities, costs, and availability
 */
export const paymentRails = pgTable(
  'payment_rails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 50 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    provider: varchar('provider', { length: 100 }),
    corridors: jsonb('corridors').notNull().default([]),

    // Cost structure
    costFixedAmount: decimal('cost_fixed_amount', { precision: 20, scale: 4 }),
    costFixedCurrency: varchar('cost_fixed_currency', { length: 3 }),
    costPercentage: decimal('cost_percentage', { precision: 8, scale: 6 }).default('0'),
    costFxSpread: decimal('cost_fx_spread', { precision: 8, scale: 6 }),
    costMinimumAmount: decimal('cost_minimum_amount', { precision: 20, scale: 4 }),
    costMinimumCurrency: varchar('cost_minimum_currency', { length: 3 }),
    costMaximumAmount: decimal('cost_maximum_amount', { precision: 20, scale: 4 }),
    costMaximumCurrency: varchar('cost_maximum_currency', { length: 3 }),

    // Settlement timing
    minSettlementMinutes: integer('min_settlement_minutes').notNull(),
    maxSettlementMinutes: integer('max_settlement_minutes').notNull(),

    // Availability schedule
    availability24x7: boolean('availability_24x7').default(false),
    availabilityDays: integer('availability_days').array(),
    availabilityHoursStart: time('availability_hours_start'),
    availabilityHoursEnd: time('availability_hours_end'),
    availabilityTimezone: varchar('availability_timezone', { length: 50 }),

    // Capabilities
    complianceRequirements: text('compliance_requirements').array().default([]),
    supportsRecall: boolean('supports_recall').default(false),
    supportsTracking: boolean('supports_tracking').default(false),

    // Limits
    maxAmount: decimal('max_amount', { precision: 20, scale: 4 }),
    maxAmountCurrency: varchar('max_amount_currency', { length: 3 }),

    // Status
    status: varchar('status', { length: 20 }).notNull().default('active'),

    // Audit
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    typeIdx: index('idx_payment_rails_type').on(table.type),
    statusIdx: index('idx_payment_rails_status').on(table.status),
  })
);

/**
 * Holiday Calendars Table
 * Stores holiday dates for cutoff calculations
 */
export const holidayCalendars = pgTable(
  'holiday_calendars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    countryCode: varchar('country_code', { length: 3 }),
    bankCode: varchar('bank_code', { length: 50 }),
    year: integer('year').notNull(),
    holidays: date('holidays').array().notNull().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    yearIdx: index('idx_holiday_calendars_year').on(table.year),
    countryIdx: index('idx_holiday_calendars_country').on(table.countryCode),
    uniqueCalendar: unique('unique_calendar_per_year').on(
      table.countryCode,
      table.bankCode,
      table.year
    ),
  })
);

/**
 * Cutoff Windows Table
 * Bank-specific payment cutoff times for different rails and currencies
 */
export const cutoffWindows = pgTable(
  'cutoff_windows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bankId: uuid('bank_id').notNull(),
    railId: uuid('rail_id')
      .notNull()
      .references(() => paymentRails.id),
    currency: varchar('currency', { length: 3 }).notNull(),
    cutoffTime: time('cutoff_time').notNull(),
    timezone: varchar('timezone', { length: 50 }).notNull(),
    stpAdjustmentMinutes: integer('stp_adjustment_minutes').notNull().default(60),
    activeDays: integer('active_days').array().notNull().default([1, 2, 3, 4, 5]),
    holidayCalendarId: uuid('holiday_calendar_id').references(() => holidayCalendars.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    bankIdx: index('idx_cutoff_windows_bank').on(table.bankId),
    railIdx: index('idx_cutoff_windows_rail').on(table.railId),
    currencyIdx: index('idx_cutoff_windows_currency').on(table.currency),
    uniqueCutoff: unique('unique_cutoff_per_bank_rail_currency').on(
      table.bankId,
      table.railId,
      table.currency
    ),
  })
);

/**
 * Routing Decisions Table
 * Audit trail of payment routing decisions
 */
export const routingDecisions = pgTable(
  'routing_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id').notNull(),
    decisionTimestamp: timestamp('decision_timestamp').notNull().defaultNow(),
    urgencyLevel: varchar('urgency_level', { length: 20 }).notNull().default('standard'),
    optionsConsidered: jsonb('options_considered').notNull(),
    selectedRailId: uuid('selected_rail_id').references(() => paymentRails.id),
    selectionReason: text('selection_reason').notNull(),
    fallbackRailId: uuid('fallback_rail_id').references(() => paymentRails.id),
    scoreWeightCost: decimal('score_weight_cost', { precision: 3, scale: 2 }).notNull(),
    scoreWeightSpeed: decimal('score_weight_speed', { precision: 3, scale: 2 }).notNull(),
    scoreWeightRisk: decimal('score_weight_risk', { precision: 3, scale: 2 }).notNull(),
  },
  (table) => ({
    paymentIdx: index('idx_routing_decisions_payment').on(table.paymentId),
    timestampIdx: index('idx_routing_decisions_timestamp').on(table.decisionTimestamp),
    selectedRailIdx: index('idx_routing_decisions_selected_rail').on(table.selectedRailId),
  })
);

// =============================================================================
// AUDIT & COMPLIANCE TABLES
// =============================================================================

/**
 * Audit Log Table
 * Immutable log of all significant actions for compliance and debugging
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    actorId: uuid('actor_id'),
    actorType: varchar('actor_type', { length: 30 }).default('user'),
    occurredAt: timestamp('occurred_at').notNull().defaultNow(),
    previousState: jsonb('previous_state'),
    newState: jsonb('new_state'),
    changes: jsonb('changes'),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),
  },
  (table) => ({
    entityIdx: index('idx_audit_log_entity').on(table.entityType, table.entityId),
    actorIdx: index('idx_audit_log_actor').on(table.actorId),
    actionIdx: index('idx_audit_log_action').on(table.action),
    occurredAtIdx: index('idx_audit_log_occurred_at').on(table.occurredAt),
  })
);

// =============================================================================
// PAYMENT APPROVAL TABLES
// =============================================================================

/**
 * Approval Policies Table
 * Defines when payments require approval based on amount, entity, or other criteria
 */
export const approvalPolicies = pgTable(
  'approval_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    entityId: uuid('entity_id'),
    minAmount: decimal('min_amount', { precision: 20, scale: 2 }).notNull(),
    maxAmount: decimal('max_amount', { precision: 20, scale: 2 }),
    currency: varchar('currency', { length: 3 }),
    paymentMethod: varchar('payment_method', { length: 50 }),
    requiredLevels: integer('required_levels').notNull().default(1),
    approversPerLevel: jsonb('approvers_per_level').notNull(),
    priority: integer('priority').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by'),
  },
  (table) => ({
    entityIdx: index('idx_approval_policies_entity').on(table.entityId),
    activeIdx: index('idx_approval_policies_active').on(table.isActive),
    priorityIdx: index('idx_approval_policies_priority').on(table.priority),
  })
);

/**
 * Payment Approvals Table
 * Tracks approval workflow state for payments requiring approval
 */
export const paymentApprovals = pgTable(
  'payment_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id').notNull().references(() => payments.id),
    policyId: uuid('policy_id').notNull().references(() => approvalPolicies.id),
    currentLevel: integer('current_level').notNull().default(1),
    totalLevels: integer('total_levels').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    paymentIdx: index('idx_payment_approvals_payment').on(table.paymentId),
    statusIdx: index('idx_payment_approvals_status').on(table.status),
    expiresIdx: index('idx_payment_approvals_expires').on(table.expiresAt),
  })
);

/**
 * Approval Decisions Table
 * Individual approval/rejection decisions within an approval workflow
 */
export const approvalDecisions = pgTable(
  'approval_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    approvalId: uuid('approval_id').notNull().references(() => paymentApprovals.id),
    level: integer('level').notNull(),
    approverId: uuid('approver_id').notNull(),
    decision: varchar('decision', { length: 20 }).notNull(),
    reason: varchar('reason', { length: 500 }),
    decidedAt: timestamp('decided_at').notNull().defaultNow(),
    metadata: jsonb('metadata'),
  },
  (table) => ({
    approvalIdx: index('idx_approval_decisions_approval').on(table.approvalId),
    approverIdx: index('idx_approval_decisions_approver').on(table.approverId),
    levelIdx: index('idx_approval_decisions_level').on(table.level),
  })
);

// =============================================================================
// FORECAST ACCURACY TABLES
// =============================================================================

/**
 * Forecast Accuracy Table
 * Tracks forecast predictions vs actual outcomes for MAPE calculation
 */
export const forecastAccuracy = pgTable(
  'forecast_accuracy',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    forecastId: uuid('forecast_id').notNull().references(() => cashForecasts.id),
    measurementDate: timestamp('measurement_date').notNull(),
    horizonDays: integer('horizon_days').notNull(),
    forecastedAmount: decimal('forecasted_amount', { precision: 20, scale: 2 }).notNull(),
    actualAmount: decimal('actual_amount', { precision: 20, scale: 2 }).notNull(),
    absoluteError: decimal('absolute_error', { precision: 20, scale: 2 }).notNull(),
    percentageError: decimal('percentage_error', { precision: 8, scale: 4 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    forecastIdx: index('idx_forecast_accuracy_forecast').on(table.forecastId),
    dateIdx: index('idx_forecast_accuracy_date').on(table.measurementDate),
    horizonIdx: index('idx_forecast_accuracy_horizon').on(table.horizonDays),
  })
);

// =============================================================================
// BANK CONNECTIVITY TABLES
// =============================================================================

/**
 * Bank Connections Table
 * Stores bank connection configurations (Plaid, direct API, SFTP)
 */
export const bankConnections = pgTable(
  'bank_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id),
    provider: varchar('provider', { length: 50 }).notNull(),
    connectionType: varchar('connection_type', { length: 30 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    accessToken: varchar('access_token', { length: 500 }),
    itemId: varchar('item_id', { length: 200 }),
    institutionId: varchar('institution_id', { length: 100 }),
    institutionName: varchar('institution_name', { length: 200 }),
    lastSyncAt: timestamp('last_sync_at'),
    lastSyncStatus: varchar('last_sync_status', { length: 20 }),
    syncErrorMessage: varchar('sync_error_message', { length: 500 }),
    capabilities: jsonb('capabilities').default([]),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
  },
  (table) => ({
    bankAccountIdx: index('idx_bank_connections_account').on(table.bankAccountId),
    providerIdx: index('idx_bank_connections_provider').on(table.provider),
    statusIdx: index('idx_bank_connections_status').on(table.status),
  })
);
