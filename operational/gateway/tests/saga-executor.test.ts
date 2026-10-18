/**
 * SagaExecutor Tests
 *
 * Tests for the saga orchestration system including:
 * - Basic saga execution (step success flow)
 * - Step failure and compensation
 * - Timeout handling
 * - Retry logic
 * - Entity creation saga pattern
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SagaExecutor, SagaStepError } from '../src/orchestration/saga-executor.js';
import type {
  SagaDefinition,
  SagaStep,
  SagaContext,
  StepResult,
  SagaEvent,
  SagaExecution,
} from '../src/orchestration/saga-types.js';
import { clearMocks } from './setup.js';

// ============================================================================
// Test Data Factories
// ============================================================================

function createMockStep(
  name: string,
  overrides: Partial<SagaStep> = {}
): SagaStep {
  return {
    name,
    description: `Test step: ${name}`,
    service: 'test-service',
    action: 'testAction',
    execute: vi.fn().mockResolvedValue({ success: true, data: { stepName: name } }),
    ...overrides,
  };
}

function createMockSagaDefinition(
  sagaId: string,
  steps: SagaStep[],
  overrides: Partial<SagaDefinition> = {}
): SagaDefinition {
  return {
    metadata: {
      sagaId,
      name: `Test Saga: ${sagaId}`,
      description: `Test saga definition for ${sagaId}`,
      version: '1.0.0',
    },
    steps,
    compensationStrategy: 'backward',
    ...overrides,
  };
}

function createMockInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    testField: 'test-value',
    entityName: 'Test Entity',
    ...overrides,
  };
}

// Simulates async delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// Tests
// ============================================================================

describe('SagaExecutor', () => {
  let executor: SagaExecutor;
  let eventLog: SagaEvent[];
  let persistedExecutions: SagaExecution[];

  beforeEach(() => {
    clearMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    eventLog = [];
    persistedExecutions = [];

    executor = new SagaExecutor({
      defaultStepTimeoutMs: 5000,
      defaultRetries: 2,
      onEvent: (event) => {
        eventLog.push(event);
      },
      persistExecution: async (execution) => {
        persistedExecutions.push({ ...execution });
      },
    });
  });

  afterEach(() => {
    clearMocks();
    vi.useRealTimers();
  });

  // ==========================================================================
  // Basic Saga Execution
  // ==========================================================================

  describe('basic saga execution', () => {
    it('should execute a single-step saga successfully', async () => {
      const step = createMockStep('single-step');
      const saga = createMockSagaDefinition('single-step-saga', [step]);
      const input = createMockInput();

      const execution = await executor.execute(saga, input);

      expect(execution.status).toBe('completed');
      expect(execution.sagaId).toBe('single-step-saga');
      expect(execution.steps[0].status).toBe('completed');
      expect(step.execute).toHaveBeenCalledTimes(1);
    });

    it('should execute multi-step saga in order', async () => {
      const executionOrder: string[] = [];

      const step1 = createMockStep('step-1', {
        execute: vi.fn().mockImplementation(async () => {
          executionOrder.push('step-1');
          return { success: true, data: { id: 'result-1' } };
        }),
      });

      const step2 = createMockStep('step-2', {
        execute: vi.fn().mockImplementation(async () => {
          executionOrder.push('step-2');
          return { success: true, data: { id: 'result-2' } };
        }),
      });

      const step3 = createMockStep('step-3', {
        execute: vi.fn().mockImplementation(async () => {
          executionOrder.push('step-3');
          return { success: true, data: { id: 'result-3' } };
        }),
      });

      const saga = createMockSagaDefinition('multi-step-saga', [step1, step2, step3]);
      const execution = await executor.execute(saga, createMockInput());

      expect(execution.status).toBe('completed');
      expect(executionOrder).toEqual(['step-1', 'step-2', 'step-3']);
      expect(execution.steps.every((s) => s.status === 'completed')).toBe(true);
    });

    it('should pass input to first step and accumulate results', async () => {
      const step1 = createMockStep('step-1', {
        execute: vi.fn().mockResolvedValue({ success: true, data: { userId: 'user-123' } }),
      });

      const step2 = createMockStep('step-2', {
        inputMapper: (ctx) => ({
          previousResult: ctx.stepResults['step-1'],
          originalInput: ctx.input,
        }),
        execute: vi.fn().mockResolvedValue({ success: true, data: { processed: true } }),
      });

      const saga = createMockSagaDefinition('result-passing-saga', [step1, step2]);
      const input = createMockInput({ requestId: 'req-456' });

      await executor.execute(saga, input);

      // Verify step2 received mapped input with step1 results
      expect(step2.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          previousResult: { userId: 'user-123' },
          originalInput: expect.objectContaining({ requestId: 'req-456' }),
        }),
        expect.any(Object)
      );
    });

    it('should emit events during execution', async () => {
      const step = createMockStep('event-step');
      const saga = createMockSagaDefinition('event-saga', [step]);

      await executor.execute(saga, createMockInput());

      const eventTypes = eventLog.map((e) => e.type);
      expect(eventTypes).toContain('saga.started');
      expect(eventTypes).toContain('saga.step.started');
      expect(eventTypes).toContain('saga.step.completed');
      expect(eventTypes).toContain('saga.completed');
    });

    it('should persist execution state', async () => {
      const step = createMockStep('persist-step');
      const saga = createMockSagaDefinition('persist-saga', [step]);

      await executor.execute(saga, createMockInput());

      // Should have persisted at least: initial, running, step running, step completed, final
      expect(persistedExecutions.length).toBeGreaterThanOrEqual(3);

      // Final persisted state should be completed
      const finalExecution = persistedExecutions[persistedExecutions.length - 1];
      expect(finalExecution.status).toBe('completed');
    });

    it('should call onComplete hook when saga succeeds', async () => {
      const onComplete = vi.fn();
      const step = createMockStep('hook-step');
      const saga = createMockSagaDefinition('hook-saga', [step], { onComplete });

      await executor.execute(saga, createMockInput());

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId: expect.any(String),
          stepResults: expect.any(Object),
        })
      );
    });

    it('should skip steps when shouldExecute returns false', async () => {
      const step1 = createMockStep('always-run');
      const step2 = createMockStep('conditionally-skip', {
        shouldExecute: () => false,
      });
      const step3 = createMockStep('also-runs');

      const saga = createMockSagaDefinition('conditional-saga', [step1, step2, step3]);
      const execution = await executor.execute(saga, createMockInput());

      expect(execution.steps[0].status).toBe('completed');
      expect(execution.steps[1].status).toBe('skipped');
      expect(execution.steps[2].status).toBe('completed');
      expect(step2.execute).not.toHaveBeenCalled();
    });

    it('should include correlationId and initiatedBy when provided', async () => {
      const step = createMockStep('tracking-step');
      const saga = createMockSagaDefinition('tracking-saga', [step]);

      const execution = await executor.execute(saga, createMockInput(), {
        correlationId: 'corr-123',
        initiatedBy: 'user@example.com',
      });

      expect(execution.correlationId).toBe('corr-123');
      expect(execution.initiatedBy).toBe('user@example.com');
    });
  });

  // ==========================================================================
  // Step Failure and Compensation
  // ==========================================================================

  describe('step failure and compensation', () => {
    it('should run compensation when a step fails', async () => {
      const compensateFn = vi.fn().mockResolvedValue({ success: true });

      const step1 = createMockStep('success-step', {
        execute: vi.fn().mockResolvedValue({ success: true, data: { id: '1' } }),
        compensate: compensateFn,
      });

      const step2 = createMockStep('failing-step', {
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'STEP_FAILED', message: 'Intentional failure' },
        }),
      });

      const saga = createMockSagaDefinition('compensation-saga', [step1, step2]);
      const execution = await executor.execute(saga, createMockInput());

      expect(execution.status).toBe('compensated');
      expect(compensateFn).toHaveBeenCalledTimes(1);
    });

    it('should run backward compensation in reverse order', async () => {
      const compensationOrder: string[] = [];

      const createCompensatingStep = (name: string) =>
        createMockStep(name, {
          execute: vi.fn().mockResolvedValue({ success: true, data: { name } }),
          compensate: vi.fn().mockImplementation(async () => {
            compensationOrder.push(name);
            return { success: true };
          }),
        });

      const step1 = createCompensatingStep('step-1');
      const step2 = createCompensatingStep('step-2');
      const step3 = createMockStep('step-3', {
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'FAILED', message: 'Step 3 failed' },
        }),
      });

      const saga = createMockSagaDefinition('backward-comp-saga', [step1, step2, step3], {
        compensationStrategy: 'backward',
      });

      await executor.execute(saga, createMockInput());

      // Backward: step-2 first, then step-1
      expect(compensationOrder).toEqual(['step-2', 'step-1']);
    });

    it('should run forward compensation in forward order', async () => {
      const compensationOrder: string[] = [];

      const createCompensatingStep = (name: string) =>
        createMockStep(name, {
          execute: vi.fn().mockResolvedValue({ success: true, data: { name } }),
          compensate: vi.fn().mockImplementation(async () => {
            compensationOrder.push(name);
            return { success: true };
          }),
        });

      const step1 = createCompensatingStep('step-1');
      const step2 = createCompensatingStep('step-2');
      const step3 = createMockStep('step-3', {
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'FAILED', message: 'Step 3 failed' },
        }),
      });

      const saga = createMockSagaDefinition('forward-comp-saga', [step1, step2, step3], {
        compensationStrategy: 'forward',
      });

      await executor.execute(saga, createMockInput());

      // Forward: step-1 first, then step-2
      expect(compensationOrder).toEqual(['step-1', 'step-2']);
    });

    it('should use selective compensation for steps with compensate function', async () => {
      const compensationCalls: string[] = [];

      const step1 = createMockStep('step-1', {
        execute: vi.fn().mockResolvedValue({ success: true }),
        compensate: vi.fn().mockImplementation(async () => {
          compensationCalls.push('step-1');
          return { success: true };
        }),
      });

      const step2 = createMockStep('step-2', {
        execute: vi.fn().mockResolvedValue({ success: true }),
        // No compensate function
      });

      const step3 = createMockStep('step-3', {
        execute: vi.fn().mockResolvedValue({ success: true }),
        compensate: vi.fn().mockImplementation(async () => {
          compensationCalls.push('step-3');
          return { success: true };
        }),
      });

      const step4 = createMockStep('step-4', {
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'FAILED', message: 'Failed' },
        }),
      });

      const saga = createMockSagaDefinition('selective-saga', [step1, step2, step3, step4], {
        compensationStrategy: 'selective',
      });

      await executor.execute(saga, createMockInput());

      // Only steps with compensate function should be compensated (backward order for selective)
      expect(compensationCalls).toEqual(['step-3', 'step-1']);
    });

    it('should call onFailure hook when saga fails', async () => {
      const onFailure = vi.fn();

      const step = createMockStep('failing-step', {
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'FAILED', message: 'Test failure' },
        }),
      });

      const saga = createMockSagaDefinition('failure-hook-saga', [step], { onFailure });

      await executor.execute(saga, createMockInput());

      expect(onFailure).toHaveBeenCalledTimes(1);
      expect(onFailure).toHaveBeenCalledWith(
        expect.any(Object), // context
        'failing-step', // failed step name
        expect.any(SagaStepError) // error
      );
    });

    it('should set status to failed when compensation fails', async () => {
      const step1 = createMockStep('step-1', {
        execute: vi.fn().mockResolvedValue({ success: true }),
        compensate: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'COMP_FAILED', message: 'Compensation failed' },
        }),
      });

      const step2 = createMockStep('step-2', {
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'FAILED', message: 'Step failed' },
        }),
      });

      const saga = createMockSagaDefinition('comp-fail-saga', [step1, step2]);
      const execution = await executor.execute(saga, createMockInput());

      expect(execution.status).toBe('failed');
    });

    it('should emit compensation events', async () => {
      const step1 = createMockStep('step-1', {
        execute: vi.fn().mockResolvedValue({ success: true }),
        compensate: vi.fn().mockResolvedValue({ success: true }),
      });

      const step2 = createMockStep('step-2', {
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'FAILED', message: 'Failed' },
        }),
      });

      const saga = createMockSagaDefinition('comp-event-saga', [step1, step2]);
      await executor.execute(saga, createMockInput());

      const eventTypes = eventLog.map((e) => e.type);
      expect(eventTypes).toContain('saga.compensating');
      expect(eventTypes).toContain('saga.compensation.started');
      expect(eventTypes).toContain('saga.compensation.completed');
    });

    it('should record error details in execution', async () => {
      const step = createMockStep('error-step', {
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: {
            code: 'CUSTOM_ERROR',
            message: 'Custom error message',
            details: { extra: 'info' },
          },
        }),
      });

      const saga = createMockSagaDefinition('error-detail-saga', [step]);
      const execution = await executor.execute(saga, createMockInput());

      expect(execution.error).toBeDefined();
      expect(execution.error?.code).toBe('STEP_FAILED');
      expect(execution.error?.stepName).toBe('error-step');
    });
  });

  // ==========================================================================
  // Timeout Handling
  // ==========================================================================

  describe('timeout handling', () => {
    it('should fail step when execution exceeds timeout', async () => {
      const step = createMockStep('slow-step', {
        timeoutMs: 100,
        execute: vi.fn().mockImplementation(async () => {
          await delay(200);
          return { success: true };
        }),
      });

      const saga = createMockSagaDefinition('timeout-saga', [step]);

      // Use real timers for this test
      vi.useRealTimers();

      const execution = await executor.execute(saga, createMockInput());

      // Step should fail due to timeout, then compensation runs
      expect(execution.status).toBe('compensated');
      expect(execution.steps[0].status).toBe('failed');
    });

    it('should use default timeout when step timeout not specified', async () => {
      // Create executor with short default timeout
      const shortTimeoutExecutor = new SagaExecutor({
        defaultStepTimeoutMs: 50,
        defaultRetries: 0, // No retries to speed up test
      });

      const step = createMockStep('no-timeout-step', {
        execute: vi.fn().mockImplementation(async () => {
          await delay(100);
          return { success: true };
        }),
      });

      const saga = createMockSagaDefinition('default-timeout-saga', [step]);

      vi.useRealTimers();

      const execution = await shortTimeoutExecutor.execute(saga, createMockInput());

      expect(execution.status).toBe('compensated');
    });

    it('should timeout compensation operations', async () => {
      const step1 = createMockStep('step-1', {
        timeoutMs: 50,
        execute: vi.fn().mockResolvedValue({ success: true }),
        compensate: vi.fn().mockImplementation(async () => {
          await delay(100);
          return { success: true };
        }),
      });

      const step2 = createMockStep('step-2', {
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'FAILED', message: 'Failed' },
        }),
      });

      const saga = createMockSagaDefinition('comp-timeout-saga', [step1, step2]);

      vi.useRealTimers();

      const execution = await executor.execute(saga, createMockInput());

      // Compensation timed out, so status should be failed
      expect(execution.status).toBe('failed');
    });
  });

  // ==========================================================================
  // Retry Logic
  // ==========================================================================

  describe('retry logic', () => {
    it('should retry failed step up to max retries', async () => {
      let attempts = 0;

      const step = createMockStep('retry-step', {
        retries: 2,
        execute: vi.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return { success: true, data: { attempts } };
        }),
      });

      const saga = createMockSagaDefinition('retry-saga', [step]);

      vi.useRealTimers();

      const execution = await executor.execute(saga, createMockInput());

      expect(execution.status).toBe('completed');
      expect(attempts).toBe(3); // Initial + 2 retries
    });

    it('should fail after exhausting all retries', async () => {
      const step = createMockStep('always-fail-step', {
        retries: 2,
        execute: vi.fn().mockImplementation(async () => {
          throw new Error('Persistent failure');
        }),
      });

      const saga = createMockSagaDefinition('exhaust-retry-saga', [step]);

      vi.useRealTimers();

      const execution = await executor.execute(saga, createMockInput());

      expect(execution.status).toBe('compensated');
      expect(step.execute).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should track retry count in step execution', async () => {
      let currentRetryCount = 0;

      const step = createMockStep('track-retry-step', {
        retries: 3,
        execute: vi.fn().mockImplementation(async () => {
          currentRetryCount++;
          if (currentRetryCount <= 2) {
            return {
              success: false,
              error: { code: 'TEMP', message: 'Temporary' },
            };
          }
          return { success: true };
        }),
      });

      const saga = createMockSagaDefinition('track-retry-saga', [step]);

      vi.useRealTimers();

      const execution = await executor.execute(saga, createMockInput());

      expect(execution.status).toBe('completed');
      expect(execution.steps[0].retryCount).toBe(2); // Third attempt (0, 1, 2)
    });

    it('should use default retries when not specified on step', async () => {
      // Executor has defaultRetries: 2
      let attempts = 0;

      const step = createMockStep('default-retry-step', {
        execute: vi.fn().mockImplementation(async () => {
          attempts++;
          throw new Error('Always fails');
        }),
      });

      const saga = createMockSagaDefinition('default-retry-saga', [step]);

      vi.useRealTimers();

      await executor.execute(saga, createMockInput());

      expect(attempts).toBe(3); // 1 + 2 default retries
    });

    it('should apply exponential backoff between retries', async () => {
      const timestamps: number[] = [];

      const step = createMockStep('backoff-step', {
        retries: 2,
        execute: vi.fn().mockImplementation(async () => {
          timestamps.push(Date.now());
          throw new Error('Fail for backoff test');
        }),
      });

      const saga = createMockSagaDefinition('backoff-saga', [step]);

      vi.useRealTimers();

      await executor.execute(saga, createMockInput());

      // Check that delays increase
      if (timestamps.length >= 3) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        // Second delay should be longer than first (exponential backoff)
        expect(delay2).toBeGreaterThanOrEqual(delay1);
      }
    });
  });

  // ==========================================================================
  // Entity Creation Saga Pattern
  // ==========================================================================

  describe('entity creation saga pattern', () => {
    it('should execute multi-service entity creation flow', async () => {
      const createEntity = createMockStep('create-entity', {
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { entityId: 'ent-123' },
        }),
        compensate: vi.fn().mockResolvedValue({ success: true }),
      });

      const createCompliance = createMockStep('create-compliance', {
        inputMapper: (ctx) => ({
          entityId: (ctx.stepResults['create-entity'] as { entityId: string }).entityId,
        }),
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { obligationIds: ['obl-1', 'obl-2'] },
        }),
        compensate: vi.fn().mockResolvedValue({ success: true }),
      });

      const createTax = createMockStep('create-tax-registration', {
        inputMapper: (ctx) => ({
          entityId: (ctx.stepResults['create-entity'] as { entityId: string }).entityId,
        }),
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { registrationId: 'tax-456' },
        }),
        compensate: vi.fn().mockResolvedValue({ success: true }),
      });

      const setupSecurity = createMockStep('setup-security', {
        inputMapper: (ctx) => ({
          entityId: (ctx.stepResults['create-entity'] as { entityId: string }).entityId,
        }),
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { policyId: 'pol-789' },
        }),
        compensate: vi.fn().mockResolvedValue({ success: true }),
      });

      const saga = createMockSagaDefinition(
        'entity-creation',
        [createEntity, createCompliance, createTax, setupSecurity],
        {
          compensationStrategy: 'backward',
        }
      );

      const execution = await executor.execute(saga, {
        entityName: 'Test Corp',
        entityType: 'corporation',
        jurisdiction: 'US-DE',
      });

      expect(execution.status).toBe('completed');
      expect(execution.context.stepResults['create-entity']).toEqual({ entityId: 'ent-123' });
      expect(execution.context.stepResults['create-compliance']).toEqual({
        obligationIds: ['obl-1', 'obl-2'],
      });
      expect(execution.context.stepResults['create-tax-registration']).toEqual({
        registrationId: 'tax-456',
      });
      expect(execution.context.stepResults['setup-security']).toEqual({ policyId: 'pol-789' });
    });

    it('should compensate all completed steps when later step fails', async () => {
      const compensationCalls: string[] = [];

      const createEntity = createMockStep('create-entity', {
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { entityId: 'ent-123' },
        }),
        compensate: vi.fn().mockImplementation(async () => {
          compensationCalls.push('create-entity');
          return { success: true };
        }),
      });

      const createCompliance = createMockStep('create-compliance', {
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { obligationIds: ['obl-1'] },
        }),
        compensate: vi.fn().mockImplementation(async () => {
          compensationCalls.push('create-compliance');
          return { success: true };
        }),
      });

      const createTax = createMockStep('create-tax-registration', {
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'TAX_ERROR', message: 'Tax service unavailable' },
        }),
      });

      const saga = createMockSagaDefinition(
        'entity-creation-fail',
        [createEntity, createCompliance, createTax],
        { compensationStrategy: 'backward' }
      );

      const execution = await executor.execute(saga, createMockInput());

      expect(execution.status).toBe('compensated');
      expect(compensationCalls).toEqual(['create-compliance', 'create-entity']);
    });

    it('should skip conditional steps based on input', async () => {
      const createEntity = createMockStep('create-entity', {
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { entityId: 'ent-123' },
        }),
      });

      const createTax = createMockStep('create-tax-registration', {
        shouldExecute: (ctx) => {
          const input = ctx.input as { includeTax?: boolean };
          return input.includeTax === true;
        },
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { registrationId: 'tax-456' },
        }),
      });

      const saga = createMockSagaDefinition('conditional-entity', [createEntity, createTax]);

      // Execute without includeTax
      const execution1 = await executor.execute(saga, { includeTax: false });
      expect(execution1.steps[1].status).toBe('skipped');

      // Execute with includeTax
      const execution2 = await executor.execute(saga, { includeTax: true });
      expect(execution2.steps[1].status).toBe('completed');
    });

    it('should transform step outputs using outputMapper', async () => {
      const createEntity = createMockStep('create-entity', {
        outputMapper: (result: { id: string; name: string }) => ({
          entityId: result.id,
          entityName: result.name,
        }),
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { id: 'raw-id-123', name: 'Raw Name' },
        }),
      });

      const saga = createMockSagaDefinition('output-mapper-saga', [createEntity]);
      const execution = await executor.execute(saga, createMockInput());

      expect(execution.context.stepResults['create-entity']).toEqual({
        entityId: 'raw-id-123',
        entityName: 'Raw Name',
      });
    });
  });

  // ==========================================================================
  // Execution Queries
  // ==========================================================================

  describe('execution queries', () => {
    it('should retrieve execution by ID', async () => {
      const step = createMockStep('query-step');
      const saga = createMockSagaDefinition('query-saga', [step]);

      const execution = await executor.execute(saga, createMockInput());
      const retrieved = executor.getExecution(execution.executionId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.executionId).toBe(execution.executionId);
    });

    it('should return undefined for non-existent execution', () => {
      const retrieved = executor.getExecution('non-existent-id');
      expect(retrieved).toBeUndefined();
    });

    it('should list executions with filtering', async () => {
      const step = createMockStep('list-step');
      const saga1 = createMockSagaDefinition('saga-a', [step]);
      const saga2 = createMockSagaDefinition('saga-b', [step]);

      await executor.execute(saga1, createMockInput());
      await executor.execute(saga2, createMockInput());

      const allExecutions = executor.getExecutions();
      expect(allExecutions.length).toBe(2);

      const filteredBySaga = executor.getExecutions({ sagaId: 'saga-a' });
      expect(filteredBySaga.length).toBe(1);
      expect(filteredBySaga[0].sagaId).toBe('saga-a');

      const filteredByStatus = executor.getExecutions({ status: 'completed' });
      expect(filteredByStatus.length).toBe(2);
    });

    it('should paginate execution results', async () => {
      const step = createMockStep('page-step');

      for (let i = 0; i < 5; i++) {
        const saga = createMockSagaDefinition(`saga-${i}`, [step]);
        await executor.execute(saga, createMockInput());
      }

      const page1 = executor.getExecutions({ limit: 2, offset: 0 });
      const page2 = executor.getExecutions({ limit: 2, offset: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);

      // Should be different executions
      const page1Ids = page1.map((e) => e.executionId);
      const page2Ids = page2.map((e) => e.executionId);
      expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
    });
  });
});
