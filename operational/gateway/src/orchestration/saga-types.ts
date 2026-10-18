/**
 * Saga Orchestration Types
 * Types for defining and executing distributed sagas
 */

import { z } from 'zod';

// ============================================================================
// Step Types
// ============================================================================

/**
 * Represents the status of a saga step execution
 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensated' | 'skipped';

/**
 * Context passed to each saga step
 */
export interface SagaContext {
  /** Unique identifier for this saga execution */
  executionId: string;
  /** Input data for the saga */
  input: Record<string, unknown>;
  /** Results accumulated from previous steps */
  stepResults: Record<string, unknown>;
  /** Metadata about the execution */
  metadata: {
    startedAt: Date;
    correlationId?: string;
    initiatedBy?: string;
  };
}

/**
 * Result returned by a step execution
 */
export interface StepResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * A single step in a saga
 */
export interface SagaStep<TInput = unknown, TOutput = unknown> {
  /** Unique name for this step */
  name: string;
  /** Human-readable description */
  description: string;
  /** Service to invoke */
  service: string;
  /** Action/endpoint to call */
  action: string;
  /** Transform context into step input */
  inputMapper?: (context: SagaContext) => TInput;
  /** Transform step output for storage in context */
  outputMapper?: (result: TOutput) => unknown;
  /** Execute the step */
  execute: (input: TInput, context: SagaContext) => Promise<StepResult>;
  /** Compensation action to undo this step on failure */
  compensate?: (context: SagaContext) => Promise<StepResult>;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Number of retry attempts */
  retries?: number;
  /** Condition to determine if step should run */
  shouldExecute?: (context: SagaContext) => boolean;
}

// ============================================================================
// Saga Definition Types
// ============================================================================

/**
 * Metadata about a saga definition
 */
export interface SagaMetadata {
  /** Unique identifier for the saga type */
  sagaId: string;
  /** Human-readable name */
  name: string;
  /** Description of what the saga does */
  description: string;
  /** Version of the saga definition */
  version: string;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Complete saga definition
 */
export interface SagaDefinition {
  /** Saga metadata */
  metadata: SagaMetadata;
  /** Ordered list of steps to execute */
  steps: SagaStep[];
  /** Global timeout for entire saga in milliseconds */
  timeoutMs?: number;
  /** Compensation strategy */
  compensationStrategy: 'backward' | 'forward' | 'selective';
  /** Hook called on saga completion */
  onComplete?: (context: SagaContext) => Promise<void>;
  /** Hook called on saga failure */
  onFailure?: (context: SagaContext, failedStep: string, error: unknown) => Promise<void>;
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Status of a saga execution
 */
export type SagaStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensating' | 'compensated';

/**
 * Record of a single step execution
 */
export interface StepExecution {
  stepName: string;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  result?: StepResult;
  retryCount: number;
  compensationResult?: StepResult;
}

/**
 * Complete execution record for a saga
 */
export interface SagaExecution {
  /** Unique execution identifier */
  executionId: string;
  /** Reference to saga definition */
  sagaId: string;
  /** Current status */
  status: SagaStatus;
  /** Input data */
  input: Record<string, unknown>;
  /** Execution context */
  context: SagaContext;
  /** Step execution records */
  steps: StepExecution[];
  /** Index of current step being executed */
  currentStepIndex: number;
  /** Index of step that failed (if any) */
  failedStepIndex?: number;
  /** When execution started */
  startedAt: Date;
  /** When execution completed */
  completedAt?: Date;
  /** Final result or error */
  result?: unknown;
  /** Error if failed */
  error?: {
    code: string;
    message: string;
    stepName: string;
    details?: unknown;
  };
  /** Correlation ID for tracing */
  correlationId?: string;
  /** Who initiated the saga */
  initiatedBy?: string;
}

// ============================================================================
// Compensation Types
// ============================================================================

/**
 * Result of a compensation operation
 */
export interface CompensationResult {
  stepName: string;
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Summary of all compensations for a failed saga
 */
export interface CompensationSummary {
  executionId: string;
  compensationsAttempted: number;
  compensationsSucceeded: number;
  compensationsFailed: number;
  results: CompensationResult[];
  completedAt: Date;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted during saga execution
 */
export type SagaEventType =
  | 'saga.started'
  | 'saga.step.started'
  | 'saga.step.completed'
  | 'saga.step.failed'
  | 'saga.step.skipped'
  | 'saga.compensating'
  | 'saga.compensation.started'
  | 'saga.compensation.completed'
  | 'saga.compensation.failed'
  | 'saga.completed'
  | 'saga.failed';

export interface SagaEvent {
  type: SagaEventType;
  executionId: string;
  sagaId: string;
  timestamp: Date;
  stepName?: string;
  data?: unknown;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const sagaExecutionStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'compensating',
  'compensated',
]);

export const stepStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'compensated',
  'skipped',
]);

export const sagaExecutionQuerySchema = z.object({
  status: sagaExecutionStatusSchema.optional(),
  sagaId: z.string().optional(),
  initiatedBy: z.string().optional(),
  correlationId: z.string().uuid().optional(),
  startedAfter: z.string().datetime().optional(),
  startedBefore: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SagaExecutionQuery = z.infer<typeof sagaExecutionQuerySchema>;
