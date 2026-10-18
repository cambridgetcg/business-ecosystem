/**
 * AWS Infrastructure Configuration
 *
 * Centralized configuration for AWS services used by banking-treasury.
 * Values loaded from environment or defaults for dev.
 *
 * @module infrastructure/aws
 */

const environment = process.env.NODE_ENV ?? 'development';
const accountId = process.env.AWS_ACCOUNT_ID ?? '034362054546';
const region = process.env.AWS_REGION ?? 'us-east-1';

export const awsConfig = {
  region,
  accountId,
  environment,

  // EventBridge for event routing
  eventBridge: {
    eventBusName: process.env.EVENTBRIDGE_BUS_NAME ??
      `banking-treasury-${environment}-events`,
    eventBusArn: process.env.EVENTBRIDGE_BUS_ARN ??
      `arn:aws:events:${region}:${accountId}:event-bus/banking-treasury-${environment}-events`,
  },

  // SNS Topics for event distribution
  sns: {
    paymentEvents: process.env.SNS_PAYMENT_EVENTS_TOPIC ??
      `arn:aws:sns:${region}:${accountId}:banking-treasury-${environment}-payment-events`,
    balanceEvents: process.env.SNS_BALANCE_EVENTS_TOPIC ??
      `arn:aws:sns:${region}:${accountId}:banking-treasury-${environment}-balance-events`,
    reconciliationEvents: process.env.SNS_RECONCILIATION_EVENTS_TOPIC ??
      `arn:aws:sns:${region}:${accountId}:banking-treasury-${environment}-reconciliation-events`,
    criticalAlerts: process.env.SNS_CRITICAL_ALERTS_TOPIC ??
      `arn:aws:sns:${region}:${accountId}:banking-treasury-${environment}-critical-alerts`,
    // Legacy topic (for backwards compatibility)
    bankingTreasuryEvents: process.env.SNS_BANKING_TREASURY_TOPIC ??
      `arn:aws:sns:${region}:${accountId}:business-ecosystem-banking-treasury-events`,
  },

  // SQS Queues
  sqs: {
    // Step Functions approval queues
    paymentApproval: process.env.SQS_PAYMENT_APPROVAL_QUEUE ??
      `https://sqs.${region}.amazonaws.com/${accountId}/banking-treasury-${environment}-payment-approval`,
    complianceReview: process.env.SQS_COMPLIANCE_REVIEW_QUEUE ??
      `https://sqs.${region}.amazonaws.com/${accountId}/banking-treasury-${environment}-compliance-review`,

    // Payment processing queues
    paymentProcessing: process.env.SQS_PAYMENT_PROCESSING_QUEUE ??
      `https://sqs.${region}.amazonaws.com/${accountId}/banking-treasury-${environment}-payment-processing`,
    paymentProcessingDlq: process.env.SQS_PAYMENT_PROCESSING_DLQ ??
      `https://sqs.${region}.amazonaws.com/${accountId}/banking-treasury-${environment}-payment-processing-dlq`,

    // Payment execution FIFO queues
    paymentExecution: process.env.SQS_PAYMENT_EXECUTION_QUEUE ??
      `https://sqs.${region}.amazonaws.com/${accountId}/banking-treasury-${environment}-payment-execution.fifo`,
    paymentExecutionDlq: process.env.SQS_PAYMENT_EXECUTION_DLQ ??
      `https://sqs.${region}.amazonaws.com/${accountId}/banking-treasury-${environment}-payment-execution-dlq.fifo`,

    // Balance update queues
    balanceUpdates: process.env.SQS_BALANCE_UPDATES_QUEUE ??
      `https://sqs.${region}.amazonaws.com/${accountId}/banking-treasury-${environment}-balance-updates`,
    balanceUpdatesDlq: process.env.SQS_BALANCE_UPDATES_DLQ ??
      `https://sqs.${region}.amazonaws.com/${accountId}/banking-treasury-${environment}-balance-updates-dlq`,

    // Reconciliation queues
    reconciliation: process.env.SQS_RECONCILIATION_QUEUE ??
      `https://sqs.${region}.amazonaws.com/${accountId}/banking-treasury-${environment}-reconciliation`,
    reconciliationDlq: process.env.SQS_RECONCILIATION_DLQ ??
      `https://sqs.${region}.amazonaws.com/${accountId}/banking-treasury-${environment}-reconciliation-dlq`,

    // Bank statement import
    bankStatementImport: process.env.SQS_BANK_STATEMENT_IMPORT_QUEUE ??
      `https://sqs.${region}.amazonaws.com/${accountId}/banking-treasury-${environment}-bank-statement-import`,
    bankStatementImportDlq: process.env.SQS_BANK_STATEMENT_IMPORT_DLQ ??
      `https://sqs.${region}.amazonaws.com/${accountId}/banking-treasury-${environment}-bank-statement-import-dlq`,

    // Legacy queues
    eventsQueue: process.env.SQS_EVENTS_QUEUE ??
      `https://sqs.${region}.amazonaws.com/${accountId}/business-ecosystem-banking-treasury-events-queue`,
    accountingIntegrationQueue: process.env.SQS_ACCOUNTING_QUEUE ??
      `https://sqs.${region}.amazonaws.com/${accountId}/business-ecosystem-accounting-integration-queue`,
  },

  // Step Functions
  stepFunctions: {
    paymentWorkflowArn: process.env.STEP_FUNCTIONS_PAYMENT_WORKFLOW_ARN ??
      `arn:aws:states:${region}:${accountId}:stateMachine:banking-treasury-${environment}-payment-workflow`,
    paymentWorkflowName: process.env.STEP_FUNCTIONS_PAYMENT_WORKFLOW_NAME ??
      `banking-treasury-${environment}-payment-workflow`,
  },

  // Secrets Manager
  secrets: {
    databaseCredentials: process.env.DB_CREDENTIALS_SECRET ??
      `banking-treasury-${environment}-banking_treasury-db`,
    bankApiCredentials: process.env.BANK_API_CREDENTIALS_SECRET ??
      `banking-treasury-${environment}-bank-api`,
    fxProviderCredentials: process.env.FX_PROVIDER_CREDENTIALS_SECRET ??
      `banking-treasury-${environment}-fx-provider`,
  },

  // S3 Buckets
  s3: {
    documentsBucket: process.env.S3_DOCUMENTS_BUCKET ??
      `business-ecosystem-documents-${environment}`,
    auditLogsBucket: process.env.S3_AUDIT_LOGS_BUCKET ??
      `banking-treasury-${environment}-audit-logs-${accountId}`,
  },

  // CloudWatch
  cloudWatch: {
    auditLogGroup: process.env.CLOUDWATCH_AUDIT_LOG_GROUP ??
      `/banking-treasury/${environment}/audit`,
    eventsLogGroup: process.env.CLOUDWATCH_EVENTS_LOG_GROUP ??
      `/aws/events/banking-treasury-${environment}`,
  },

  // Athena
  athena: {
    workgroupName: process.env.ATHENA_WORKGROUP ??
      `banking-treasury-${environment}-audit-queries`,
    databaseName: process.env.ATHENA_DATABASE ??
      `banking_treasury_${environment}_audit`,
  },

  // DynamoDB
  dynamodb: {
    cashPositionsTable: process.env.DYNAMODB_CASH_POSITIONS_TABLE ??
      `banking-treasury-${environment}-cash-positions`,
    transactionLedgerTable: process.env.DYNAMODB_TRANSACTION_LEDGER_TABLE ??
      `banking-treasury-${environment}-transaction-ledger`,
    paymentStatusTable: process.env.DYNAMODB_PAYMENT_STATUS_TABLE ??
      `banking-treasury-${environment}-payment-status`,
    complianceRulesTable: process.env.DYNAMODB_COMPLIANCE_RULES_TABLE ??
      `banking-treasury-${environment}-compliance-rules`,
    complianceResultsTable: process.env.DYNAMODB_COMPLIANCE_RESULTS_TABLE ??
      `banking-treasury-${environment}-compliance-results`,
  },
};
