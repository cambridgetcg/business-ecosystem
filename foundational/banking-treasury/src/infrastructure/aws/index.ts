/**
 * AWS Infrastructure Module
 *
 * Exports all AWS service clients and configurations.
 *
 * @module infrastructure/aws
 */

// Configuration
export { awsConfig } from './config.js';

// Secrets Manager
export { getDatabaseCredentials, buildDatabaseUrl, type DatabaseCredentials } from './secrets.js';

// Event Publishing (Legacy SNS)
export { EventPublisher, eventPublisher } from './event-publisher.js';

// EventBridge (New - preferred)
export {
  EventBridgePublisher,
  eventBridgePublisher,
  type DomainEvent,
  type PublishResult,
} from './eventbridge-publisher.js';

// Step Functions
export {
  StepFunctionsClient,
  stepFunctionsClient,
  type PaymentWorkflowInput,
  type WorkflowExecution,
  type WorkflowStatus,
  type ApprovalCallbackInput,
} from './step-functions-client.js';

// Audit Logging
export {
  AuditLogger,
  auditLogger,
  type AuditEvent,
} from './audit-logger.js';

// DynamoDB (Real-time data)
export {
  CashPositionStore,
  TransactionLedgerStore,
  PaymentStatusStore,
  cashPositionStore,
  transactionLedgerStore,
  paymentStatusStore,
  type CashPosition,
  type TransactionEntry,
  type PaymentStatus,
} from './dynamodb-client.js';

// SQS (Reliable messaging)
export {
  QueueClient,
  PaymentProcessingQueue,
  PaymentExecutionQueue,
  BalanceUpdatesQueue,
  ReconciliationQueue,
  paymentProcessingQueue,
  paymentExecutionQueue,
  balanceUpdatesQueue,
  reconciliationQueue,
  type PaymentMessage,
  type BalanceUpdateMessage,
  type ReconciliationMessage,
  type ReceivedMessage,
} from './sqs-client.js';
