/**
 * Deadline Escalation Lambda Entry Point
 *
 * Exports the Lambda handler for deadline escalation processing.
 *
 * This Lambda supports two invocation modes:
 * 1. DynamoDB Streams - Real-time processing of deadline changes
 * 2. CloudWatch Events - Scheduled checks for approaching/overdue deadlines
 *
 * @module lambdas/deadline-escalation
 */

export { handler } from './handler.js';

// Re-export types for consumers
export type {
  DeadlineStreamImage,
  ProcessedDeadline,
  DeadlineProcessingResult,
  LambdaExecutionResult,
  ScheduledCheckDetail,
  LambdaConfig,
  DeadlineEscalationHandler,
} from './types.js';

export {
  isDynamoDBStreamEvent,
  isScheduledEvent,
  getLambdaConfig,
} from './types.js';
