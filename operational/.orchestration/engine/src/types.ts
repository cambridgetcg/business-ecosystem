/**
 * Workflow Engine Types
 * Defines the structure of workflow definitions and execution state
 */

import { z } from 'zod';

// ============================================================================
// Workflow Definition Types
// ============================================================================

export const workflowTriggerSchema = z.object({
  type: z.enum(['event', 'schedule', 'manual']),
  source: z.string().optional(),
  filter: z.record(z.unknown()).optional(),
});

export type WorkflowTrigger = z.infer<typeof workflowTriggerSchema>;

export const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  action: z.string(),
  dependsOn: z.array(z.string()).optional(),
  condition: z.string().optional(),
  input: z.record(z.unknown()).optional(),
  timeout: z.string().optional(),
  retries: z.number().int().min(0).max(10).optional(),
  onFailure: z.enum(['stop', 'continue', 'compensate']).optional(),
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;

export const compensationStepSchema = z.object({
  step: z.string(),
  action: z.string(),
  input: z.record(z.unknown()).optional(),
});

export type CompensationStep = z.infer<typeof compensationStepSchema>;

export const workflowMetadataSchema = z.object({
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sla: z.object({
    target: z.string().optional(),
    critical: z.string().optional(),
  }).optional(),
});

export type WorkflowMetadata = z.infer<typeof workflowMetadataSchema>;

export const workflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  trigger: workflowTriggerSchema,
  input: z.record(z.string()).optional(),
  steps: z.array(workflowStepSchema),
  compensation: z.array(compensationStepSchema).optional(),
  metadata: workflowMetadataSchema.optional(),
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

// ============================================================================
// Workflow Execution Types
// ============================================================================

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'compensating'
  | 'compensated';

export interface StepExecution {
  stepId: string;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
  retryCount: number;
}

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'compensating'
  | 'compensated'
  | 'cancelled';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: string;
  status: WorkflowStatus;
  triggerEvent?: unknown;
  input: Record<string, unknown>;
  steps: Map<string, StepExecution>;
  completedSteps: string[];
  failedSteps: string[];
  skippedSteps: string[];
  startedAt: Date;
  completedAt?: Date;
  correlationId: string;
  error?: string;
}

// ============================================================================
// Domain Action Types
// ============================================================================

export interface DomainActionRequest {
  domain: string;
  action: string;
  input: Record<string, unknown>;
  correlationId: string;
  timeout?: number;
}

export interface DomainActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface DomainClient {
  execute(request: DomainActionRequest): Promise<DomainActionResult>;
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// Workflow Engine Configuration
// ============================================================================

export interface WorkflowEngineConfig {
  workflowsDir: string;
  messageQueueUrl: string;
  databaseUrl: string;
  domainEndpoints: Record<string, string>;
  defaultTimeout: number;
  defaultRetries: number;
  maxConcurrentWorkflows: number;
}

// ============================================================================
// Workflow Events
// ============================================================================

export interface WorkflowStartedEvent {
  workflowExecutionId: string;
  workflowId: string;
  triggerEvent: unknown;
  startedAt: Date;
}

export interface WorkflowCompletedEvent {
  workflowExecutionId: string;
  workflowId: string;
  status: 'completed' | 'failed' | 'compensated';
  completedSteps: string[];
  failedSteps: string[];
  skippedSteps: string[];
  completedAt: Date;
  durationMs: number;
}

export interface StepCompletedEvent {
  workflowExecutionId: string;
  stepId: string;
  status: StepStatus;
  result?: unknown;
  error?: string;
  durationMs: number;
}
