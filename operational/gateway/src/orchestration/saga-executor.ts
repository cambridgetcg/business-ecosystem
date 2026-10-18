/**
 * Saga Executor
 * Executes saga definitions with compensation support
 */

import { randomUUID } from 'crypto';
import pino from 'pino';
import type {
  SagaDefinition,
  SagaExecution,
  SagaContext,
  SagaStep,
  StepExecution,
  StepResult,
  SagaStatus,
  StepStatus,
  CompensationSummary,
  CompensationResult,
  SagaEvent,
  SagaEventType,
} from './saga-types.js';

const logger = pino({ name: 'saga-executor' });

// ============================================================================
// Saga Executor
// ============================================================================

export interface SagaExecutorOptions {
  /** Default timeout for steps in milliseconds */
  defaultStepTimeoutMs?: number;
  /** Default retry count for steps */
  defaultRetries?: number;
  /** Event handler for saga events */
  onEvent?: (event: SagaEvent) => void | Promise<void>;
  /** Persistence handler for saving executions */
  persistExecution?: (execution: SagaExecution) => Promise<void>;
}

export class SagaExecutor {
  private executions: Map<string, SagaExecution> = new Map();
  private options: Required<SagaExecutorOptions>;

  constructor(options: SagaExecutorOptions = {}) {
    this.options = {
      defaultStepTimeoutMs: options.defaultStepTimeoutMs ?? 30000,
      defaultRetries: options.defaultRetries ?? 3,
      onEvent: options.onEvent ?? (() => {}),
      persistExecution: options.persistExecution ?? (async () => {}),
    };
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start execution of a saga
   */
  async execute(
    definition: SagaDefinition,
    input: Record<string, unknown>,
    options?: {
      correlationId?: string;
      initiatedBy?: string;
    }
  ): Promise<SagaExecution> {
    const executionId = randomUUID();
    const startedAt = new Date();

    // Create initial context
    const context: SagaContext = {
      executionId,
      input,
      stepResults: {},
      metadata: {
        startedAt,
        correlationId: options?.correlationId,
        initiatedBy: options?.initiatedBy,
      },
    };

    // Create execution record
    const execution: SagaExecution = {
      executionId,
      sagaId: definition.metadata.sagaId,
      status: 'pending',
      input,
      context,
      steps: definition.steps.map((step) => ({
        stepName: step.name,
        status: 'pending',
        retryCount: 0,
      })),
      currentStepIndex: 0,
      startedAt,
      correlationId: options?.correlationId,
      initiatedBy: options?.initiatedBy,
    };

    this.executions.set(executionId, execution);
    await this.persistExecution(execution);

    logger.info(
      { executionId, sagaId: definition.metadata.sagaId, input },
      'Starting saga execution'
    );

    await this.emitEvent({
      type: 'saga.started',
      executionId,
      sagaId: definition.metadata.sagaId,
      timestamp: startedAt,
      data: { input },
    });

    // Execute steps
    try {
      execution.status = 'running';
      await this.persistExecution(execution);

      await this.executeSteps(definition, execution);

      // If we get here, all steps completed successfully
      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.result = execution.context.stepResults;
      await this.persistExecution(execution);

      logger.info({ executionId }, 'Saga completed successfully');

      await this.emitEvent({
        type: 'saga.completed',
        executionId,
        sagaId: definition.metadata.sagaId,
        timestamp: execution.completedAt,
        data: { result: execution.result },
      });

      if (definition.onComplete) {
        await definition.onComplete(execution.context);
      }
    } catch (error) {
      // Handle failure and compensation
      await this.handleFailure(definition, execution, error);
    }

    return execution;
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): SagaExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions matching query
   */
  getExecutions(query?: {
    status?: SagaStatus;
    sagaId?: string;
    limit?: number;
    offset?: number;
  }): SagaExecution[] {
    let results = Array.from(this.executions.values());

    if (query?.status) {
      results = results.filter((e) => e.status === query.status);
    }

    if (query?.sagaId) {
      results = results.filter((e) => e.sagaId === query.sagaId);
    }

    // Sort by startedAt descending
    results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 20;
    return results.slice(offset, offset + limit);
  }

  // ==========================================================================
  // Step Execution
  // ==========================================================================

  private async executeSteps(
    definition: SagaDefinition,
    execution: SagaExecution
  ): Promise<void> {
    for (let i = 0; i < definition.steps.length; i++) {
      const step = definition.steps[i];
      const stepExecution = execution.steps[i];
      execution.currentStepIndex = i;

      // Check if step should be skipped
      if (step.shouldExecute && !step.shouldExecute(execution.context)) {
        stepExecution.status = 'skipped';
        await this.emitEvent({
          type: 'saga.step.skipped',
          executionId: execution.executionId,
          sagaId: execution.sagaId,
          timestamp: new Date(),
          stepName: step.name,
        });
        continue;
      }

      // Execute the step
      await this.executeStep(step, stepExecution, execution);

      // If step failed after retries, throw to trigger compensation
      if (stepExecution.status === 'failed') {
        execution.failedStepIndex = i;
        throw new SagaStepError(
          step.name,
          stepExecution.result?.error?.message ?? 'Step failed',
          stepExecution.result?.error
        );
      }

      // Store step result in context
      if (stepExecution.result?.data !== undefined) {
        const resultKey = step.outputMapper
          ? step.name
          : step.name;
        execution.context.stepResults[resultKey] = step.outputMapper
          ? step.outputMapper(stepExecution.result.data)
          : stepExecution.result.data;
      }
    }
  }

  private async executeStep(
    step: SagaStep,
    stepExecution: StepExecution,
    execution: SagaExecution
  ): Promise<void> {
    const maxRetries = step.retries ?? this.options.defaultRetries;
    const timeoutMs = step.timeoutMs ?? this.options.defaultStepTimeoutMs;

    stepExecution.startedAt = new Date();
    stepExecution.status = 'running';
    await this.persistExecution(execution);

    await this.emitEvent({
      type: 'saga.step.started',
      executionId: execution.executionId,
      sagaId: execution.sagaId,
      timestamp: stepExecution.startedAt,
      stepName: step.name,
    });

    logger.info(
      { executionId: execution.executionId, step: step.name },
      'Executing saga step'
    );

    // Prepare input
    const input = step.inputMapper
      ? step.inputMapper(execution.context)
      : execution.context.input;

    // Execute with retries
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      stepExecution.retryCount = attempt;

      try {
        const result = await this.executeWithTimeout(
          () => step.execute(input, execution.context),
          timeoutMs
        );

        stepExecution.result = result;

        if (result.success) {
          stepExecution.status = 'completed';
          stepExecution.completedAt = new Date();
          await this.persistExecution(execution);

          await this.emitEvent({
            type: 'saga.step.completed',
            executionId: execution.executionId,
            sagaId: execution.sagaId,
            timestamp: stepExecution.completedAt,
            stepName: step.name,
            data: result.data,
          });

          logger.info(
            { executionId: execution.executionId, step: step.name },
            'Step completed successfully'
          );
          return;
        }

        lastError = result.error;
      } catch (error) {
        lastError = error;
        logger.warn(
          { executionId: execution.executionId, step: step.name, attempt, error },
          'Step execution failed, may retry'
        );
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await this.delay(Math.min(1000 * Math.pow(2, attempt), 10000));
      }
    }

    // All retries exhausted
    stepExecution.status = 'failed';
    stepExecution.completedAt = new Date();
    stepExecution.result = {
      success: false,
      error: {
        code: 'STEP_FAILED',
        message: lastError instanceof Error ? lastError.message : 'Step execution failed',
        details: lastError,
      },
    };
    await this.persistExecution(execution);

    await this.emitEvent({
      type: 'saga.step.failed',
      executionId: execution.executionId,
      sagaId: execution.sagaId,
      timestamp: stepExecution.completedAt,
      stepName: step.name,
      data: stepExecution.result.error,
    });

    logger.error(
      { executionId: execution.executionId, step: step.name, error: lastError },
      'Step failed after all retries'
    );
  }

  // ==========================================================================
  // Compensation
  // ==========================================================================

  private async handleFailure(
    definition: SagaDefinition,
    execution: SagaExecution,
    error: unknown
  ): Promise<void> {
    const failedStep = definition.steps[execution.failedStepIndex ?? 0]?.name ?? 'unknown';

    execution.status = 'compensating';
    execution.error = {
      code: error instanceof SagaStepError ? 'STEP_FAILED' : 'SAGA_FAILED',
      message: error instanceof Error ? error.message : 'Saga execution failed',
      stepName: failedStep,
      details: error instanceof SagaStepError ? error.details : undefined,
    };
    await this.persistExecution(execution);

    logger.warn(
      { executionId: execution.executionId, failedStep, error },
      'Saga failed, starting compensation'
    );

    await this.emitEvent({
      type: 'saga.compensating',
      executionId: execution.executionId,
      sagaId: execution.sagaId,
      timestamp: new Date(),
      stepName: failedStep,
      data: { error: execution.error },
    });

    // Notify failure hook
    if (definition.onFailure) {
      await definition.onFailure(execution.context, failedStep, error);
    }

    // Run compensations based on strategy
    const compensationSummary = await this.runCompensations(definition, execution);

    execution.status = compensationSummary.compensationsFailed > 0 ? 'failed' : 'compensated';
    execution.completedAt = new Date();
    await this.persistExecution(execution);

    const eventType: SagaEventType =
      execution.status === 'compensated' ? 'saga.completed' : 'saga.failed';

    await this.emitEvent({
      type: eventType,
      executionId: execution.executionId,
      sagaId: execution.sagaId,
      timestamp: execution.completedAt,
      data: { compensationSummary, error: execution.error },
    });

    logger.info(
      {
        executionId: execution.executionId,
        status: execution.status,
        compensationSummary,
      },
      'Saga compensation completed'
    );
  }

  private async runCompensations(
    definition: SagaDefinition,
    execution: SagaExecution
  ): Promise<CompensationSummary> {
    const results: CompensationResult[] = [];
    const failedIndex = execution.failedStepIndex ?? execution.currentStepIndex;

    // Determine which steps to compensate based on strategy
    let stepsToCompensate: number[];

    switch (definition.compensationStrategy) {
      case 'backward':
        // Compensate completed steps in reverse order
        stepsToCompensate = [];
        for (let i = failedIndex - 1; i >= 0; i--) {
          if (execution.steps[i].status === 'completed') {
            stepsToCompensate.push(i);
          }
        }
        break;

      case 'forward':
        // Compensate in forward order (less common)
        stepsToCompensate = [];
        for (let i = 0; i < failedIndex; i++) {
          if (execution.steps[i].status === 'completed') {
            stepsToCompensate.push(i);
          }
        }
        break;

      case 'selective':
        // Only compensate steps that have a compensate function
        stepsToCompensate = [];
        for (let i = failedIndex - 1; i >= 0; i--) {
          if (
            execution.steps[i].status === 'completed' &&
            definition.steps[i].compensate
          ) {
            stepsToCompensate.push(i);
          }
        }
        break;
    }

    // Execute compensations
    for (const stepIndex of stepsToCompensate) {
      const step = definition.steps[stepIndex];
      const stepExecution = execution.steps[stepIndex];

      if (!step.compensate) {
        continue;
      }

      await this.emitEvent({
        type: 'saga.compensation.started',
        executionId: execution.executionId,
        sagaId: execution.sagaId,
        timestamp: new Date(),
        stepName: step.name,
      });

      logger.info(
        { executionId: execution.executionId, step: step.name },
        'Running compensation for step'
      );

      try {
        const result = await this.executeWithTimeout(
          () => step.compensate!(execution.context),
          step.timeoutMs ?? this.options.defaultStepTimeoutMs
        );

        stepExecution.compensationResult = result;

        if (result.success) {
          stepExecution.status = 'compensated';
          results.push({ stepName: step.name, success: true });

          await this.emitEvent({
            type: 'saga.compensation.completed',
            executionId: execution.executionId,
            sagaId: execution.sagaId,
            timestamp: new Date(),
            stepName: step.name,
          });

          logger.info(
            { executionId: execution.executionId, step: step.name },
            'Compensation succeeded'
          );
        } else {
          results.push({
            stepName: step.name,
            success: false,
            error: result.error,
          });

          await this.emitEvent({
            type: 'saga.compensation.failed',
            executionId: execution.executionId,
            sagaId: execution.sagaId,
            timestamp: new Date(),
            stepName: step.name,
            data: result.error,
          });

          logger.error(
            { executionId: execution.executionId, step: step.name, error: result.error },
            'Compensation failed'
          );
        }
      } catch (error) {
        results.push({
          stepName: step.name,
          success: false,
          error: {
            code: 'COMPENSATION_ERROR',
            message: error instanceof Error ? error.message : 'Compensation failed',
          },
        });

        await this.emitEvent({
          type: 'saga.compensation.failed',
          executionId: execution.executionId,
          sagaId: execution.sagaId,
          timestamp: new Date(),
          stepName: step.name,
          data: { error },
        });

        logger.error(
          { executionId: execution.executionId, step: step.name, error },
          'Compensation threw exception'
        );
      }

      await this.persistExecution(execution);
    }

    return {
      executionId: execution.executionId,
      compensationsAttempted: results.length,
      compensationsSucceeded: results.filter((r) => r.success).length,
      compensationsFailed: results.filter((r) => !r.success).length,
      results,
      completedAt: new Date(),
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async emitEvent(event: SagaEvent): Promise<void> {
    try {
      await this.options.onEvent(event);
    } catch (error) {
      logger.error({ event, error }, 'Failed to emit saga event');
    }
  }

  private async persistExecution(execution: SagaExecution): Promise<void> {
    try {
      await this.options.persistExecution(execution);
    } catch (error) {
      logger.error({ executionId: execution.executionId, error }, 'Failed to persist execution');
    }
  }
}

// ============================================================================
// Custom Errors
// ============================================================================

export class SagaStepError extends Error {
  constructor(
    public readonly stepName: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'SagaStepError';
  }
}

export class SagaTimeoutError extends Error {
  constructor(
    public readonly executionId: string,
    public readonly stepName: string,
    timeoutMs: number
  ) {
    super(`Saga step '${stepName}' timed out after ${timeoutMs}ms`);
    this.name = 'SagaTimeoutError';
  }
}
