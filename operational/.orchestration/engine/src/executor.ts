/**
 * Workflow Executor
 * Executes workflow definitions with step management, retry logic, and compensation
 */

import { randomUUID } from 'crypto';
import { pino } from 'pino';
import {
  type WorkflowDefinition,
  type WorkflowExecution,
  type StepExecution,
  type DomainClient,
  type DomainActionRequest,
} from './types.js';
import {
  buildExecutionOrder,
  evaluateCondition,
  resolveInputVariables,
  parseTimeout,
} from './parser.js';

const logger = pino({ name: 'workflow-executor' });

export interface ExecutorConfig {
  domainClients: Map<string, DomainClient>;
  defaultTimeout: number;
  defaultRetries: number;
}

export class WorkflowExecutor {
  private config: ExecutorConfig;
  private activeExecutions: Map<string, WorkflowExecution> = new Map();

  constructor(config: ExecutorConfig) {
    this.config = config;
  }

  /**
   * Execute a workflow with the given input
   */
  async execute(
    workflow: WorkflowDefinition,
    triggerEvent: unknown,
    input: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    const executionId = randomUUID();
    const correlationId = randomUUID();

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      workflowVersion: workflow.version || '1.0.0',
      status: 'pending',
      triggerEvent,
      input,
      steps: new Map(),
      completedSteps: [],
      failedSteps: [],
      skippedSteps: [],
      startedAt: new Date(),
      correlationId,
    };

    // Initialize step executions
    for (const step of workflow.steps) {
      execution.steps.set(step.id, {
        stepId: step.id,
        status: 'pending',
        retryCount: 0,
      });
    }

    this.activeExecutions.set(executionId, execution);

    logger.info({
      executionId,
      workflowId: workflow.id,
      correlationId,
    }, 'Starting workflow execution');

    try {
      execution.status = 'running';
      await this.executeSteps(workflow, execution);

      if (execution.failedSteps.length > 0) {
        execution.status = 'failed';
        
        // Run compensation if configured
        if (workflow.compensation && workflow.compensation.length > 0) {
          await this.runCompensation(workflow, execution);
        }
      } else {
        execution.status = 'completed';
      }
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      logger.error({ executionId, error }, 'Workflow execution failed');
    } finally {
      execution.completedAt = new Date();
      this.activeExecutions.delete(executionId);
    }

    const durationMs = execution.completedAt.getTime() - execution.startedAt.getTime();
    logger.info({
      executionId,
      workflowId: workflow.id,
      status: execution.status,
      completedSteps: execution.completedSteps.length,
      failedSteps: execution.failedSteps.length,
      skippedSteps: execution.skippedSteps.length,
      durationMs,
    }, 'Workflow execution completed');

    return execution;
  }

  private async executeSteps(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution
  ): Promise<void> {
    const executionOrder = buildExecutionOrder(workflow.steps);
    const stepMap = new Map(workflow.steps.map(s => [s.id, s]));
    const stepResults = new Map<string, unknown>();

    for (const batch of executionOrder) {
      // Execute steps in parallel within each batch
      const promises = batch.map(async (stepId) => {
        const step = stepMap.get(stepId)!;
        const stepExecution = execution.steps.get(stepId)!;

        // Check condition
        if (step.condition) {
          const shouldRun = evaluateCondition(step.condition, {
            input: execution.input,
            workflow: {
              completedSteps: execution.completedSteps,
              skippedSteps: execution.skippedSteps,
              failedSteps: execution.failedSteps,
            },
          });

          if (!shouldRun) {
            stepExecution.status = 'skipped';
            execution.skippedSteps.push(stepId);
            logger.info({ stepId, condition: step.condition }, 'Step skipped due to condition');
            return;
          }
        }

        await this.executeStep(step, stepExecution, execution, stepResults);
      });

      await Promise.all(promises);

      // Check if any step failed with 'stop' policy
      for (const stepId of batch) {
        const step = stepMap.get(stepId)!;
        const stepExecution = execution.steps.get(stepId)!;

        if (stepExecution.status === 'failed' && step.onFailure === 'stop') {
          logger.info({ stepId }, 'Stopping workflow due to step failure');
          return;
        }
      }
    }
  }

  private async executeStep(
    step: WorkflowDefinition['steps'][0],
    stepExecution: StepExecution,
    execution: WorkflowExecution,
    stepResults: Map<string, unknown>
  ): Promise<void> {
    const maxRetries = step.retries ?? this.config.defaultRetries;
    const timeout = step.timeout
      ? parseTimeout(step.timeout)
      : this.config.defaultTimeout;

    stepExecution.status = 'running';
    stepExecution.startedAt = new Date();

    logger.info({ stepId: step.id, domain: step.domain, action: step.action }, 'Executing step');

    while (stepExecution.retryCount <= maxRetries) {
      try {
        const client = this.config.domainClients.get(step.domain);
        if (!client) {
          throw new Error(`No client configured for domain: ${step.domain}`);
        }

        // Resolve input variables
        const resolvedInput = step.input
          ? resolveInputVariables(step.input, {
              input: execution.input,
              workflow: {
                completedSteps: execution.completedSteps,
                skippedSteps: execution.skippedSteps,
                failedSteps: execution.failedSteps,
              },
              stepResults,
            })
          : {};

        const request: DomainActionRequest = {
          domain: step.domain,
          action: step.action,
          input: resolvedInput,
          correlationId: execution.correlationId,
          timeout,
        };

        const result = await this.executeWithTimeout(
          client.execute(request),
          timeout
        );

        if (result.success) {
          stepExecution.status = 'completed';
          stepExecution.result = result.data;
          stepExecution.completedAt = new Date();
          execution.completedSteps.push(step.id);
          stepResults.set(step.id, result.data);

          logger.info({ stepId: step.id }, 'Step completed successfully');
          return;
        } else {
          throw new Error(result.error || 'Step execution failed');
        }
      } catch (error) {
        stepExecution.retryCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (stepExecution.retryCount > maxRetries) {
          stepExecution.status = 'failed';
          stepExecution.error = errorMessage;
          stepExecution.completedAt = new Date();
          execution.failedSteps.push(step.id);

          logger.error({
            stepId: step.id,
            error: errorMessage,
            retries: stepExecution.retryCount,
          }, 'Step failed after retries');
          return;
        }

        logger.warn({
          stepId: step.id,
          error: errorMessage,
          retry: stepExecution.retryCount,
          maxRetries,
        }, 'Step failed, retrying');

        // Exponential backoff
        await this.delay(Math.pow(2, stepExecution.retryCount) * 1000);
      }
    }
  }

  private async runCompensation(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution
  ): Promise<void> {
    if (!workflow.compensation) return;

    execution.status = 'compensating';
    logger.info({ executionId: execution.id }, 'Running compensation');

    // Run compensation in reverse order of completed steps
    const compensationSteps = workflow.compensation.filter(c =>
      execution.completedSteps.includes(c.step)
    );

    for (const comp of compensationSteps.reverse()) {
      try {
        const step = workflow.steps.find(s => s.id === comp.step);
        if (!step) continue;

        const client = this.config.domainClients.get(step.domain);
        if (!client) continue;

        const resolvedInput = comp.input
          ? resolveInputVariables(comp.input, {
              input: execution.input,
              workflow: {
                completedSteps: execution.completedSteps,
                skippedSteps: execution.skippedSteps,
                failedSteps: execution.failedSteps,
              },
              stepResults: new Map(),
            })
          : {};

        const request: DomainActionRequest = {
          domain: step.domain,
          action: comp.action,
          input: resolvedInput,
          correlationId: execution.correlationId,
          timeout: this.config.defaultTimeout,
        };

        await client.execute(request);
        logger.info({ step: comp.step, action: comp.action }, 'Compensation completed');
      } catch (error) {
        logger.error({ step: comp.step, error }, 'Compensation failed');
      }
    }

    execution.status = 'compensated';
  }

  private executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Step execution timed out')), timeout)
      ),
    ]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current execution status
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.activeExecutions.values());
  }
}
