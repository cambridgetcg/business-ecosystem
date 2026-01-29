/**
 * Workflow Engine
 * Main orchestration engine that loads workflows, subscribes to events, and executes
 */

import pino from 'pino';
import { randomUUID } from 'crypto';
import type { DomainEvent, EventHandler } from '@ecosystem/messaging';
import {
  type WorkflowDefinition,
  type WorkflowExecution,
  type WorkflowEngineConfig,
  type DomainClient,
} from './types.js';
import { loadWorkflowsFromDirectory } from './parser.js';
import { WorkflowExecutor, type ExecutorConfig } from './executor.js';
import { createDomainClients, DEFAULT_DOMAIN_ENDPOINTS } from './domain-client.js';

const logger = pino({ name: 'workflow-engine' });

export interface WorkflowEngineOptions {
  workflowsDir: string;
  domainEndpoints?: Record<string, string>;
  defaultTimeout?: number;
  defaultRetries?: number;
  maxConcurrentWorkflows?: number;
}

export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private triggerIndex: Map<string, WorkflowDefinition[]> = new Map();
  private executor: WorkflowExecutor;
  private options: Required<WorkflowEngineOptions>;
  private runningCount = 0;
  private queue: Array<() => Promise<void>> = [];

  constructor(options: WorkflowEngineOptions) {
    this.options = {
      workflowsDir: options.workflowsDir,
      domainEndpoints: options.domainEndpoints ?? DEFAULT_DOMAIN_ENDPOINTS,
      defaultTimeout: options.defaultTimeout ?? 30000,
      defaultRetries: options.defaultRetries ?? 3,
      maxConcurrentWorkflows: options.maxConcurrentWorkflows ?? 10,
    };

    const domainClients = createDomainClients(this.options.domainEndpoints);

    this.executor = new WorkflowExecutor({
      domainClients,
      defaultTimeout: this.options.defaultTimeout,
      defaultRetries: this.options.defaultRetries,
    });
  }

  /**
   * Initialize the engine by loading workflow definitions
   */
  async initialize(): Promise<void> {
    logger.info({ workflowsDir: this.options.workflowsDir }, 'Initializing workflow engine');

    this.workflows = loadWorkflowsFromDirectory(this.options.workflowsDir);
    this.buildTriggerIndex();

    logger.info({
      workflowCount: this.workflows.size,
      triggers: Array.from(this.triggerIndex.keys()),
    }, 'Workflow engine initialized');
  }

  private buildTriggerIndex(): void {
    this.triggerIndex.clear();

    for (const workflow of this.workflows.values()) {
      if (workflow.trigger.type === 'event' && workflow.trigger.source) {
        const existing = this.triggerIndex.get(workflow.trigger.source) || [];
        existing.push(workflow);
        this.triggerIndex.set(workflow.trigger.source, existing);
      }
    }
  }

  /**
   * Get event handler for subscribing to message queue
   */
  createEventHandler(): EventHandler {
    return {
      handle: async (event: DomainEvent) => {
        await this.handleEvent(event);
      },
    };
  }

  /**
   * Get list of event types to subscribe to
   */
  getSubscribedEventTypes(): string[] {
    return Array.from(this.triggerIndex.keys());
  }

  /**
   * Handle an incoming event
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    const eventType = event.type;
    const workflows = this.triggerIndex.get(eventType) || [];

    if (workflows.length === 0) {
      logger.debug({ eventType }, 'No workflows triggered by event');
      return;
    }

    logger.info({
      eventType,
      workflowCount: workflows.length,
      eventId: event.id,
    }, 'Event triggered workflows');

    for (const workflow of workflows) {
      // Check filter conditions
      if (workflow.trigger.filter) {
        if (!this.matchesFilter(event, workflow.trigger.filter)) {
          logger.debug({
            workflowId: workflow.id,
            filter: workflow.trigger.filter,
          }, 'Event did not match workflow filter');
          continue;
        }
      }

      // Extract input from event
      const input = this.extractInput(workflow, event);

      // Queue execution
      this.queueExecution(workflow, event, input);
    }
  }

  private matchesFilter(
    event: DomainEvent,
    filter: Record<string, unknown>
  ): boolean {
    for (const [key, expectedValue] of Object.entries(filter)) {
      const actualValue = this.getNestedValue(event, key);
      if (actualValue !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private extractInput(
    workflow: WorkflowDefinition,
    event: DomainEvent
  ): Record<string, unknown> {
    const input: Record<string, unknown> = {};

    if (workflow.input) {
      for (const [key, path] of Object.entries(workflow.input)) {
        // Path like "$.aggregateId" or "$.payload.type"
        const actualPath = path.startsWith('$.') ? path.slice(2) : path;
        input[key] = this.getNestedValue(event, actualPath);
      }
    }

    return input;
  }

  private queueExecution(
    workflow: WorkflowDefinition,
    event: DomainEvent,
    input: Record<string, unknown>
  ): void {
    const execute = async () => {
      this.runningCount++;
      try {
        await this.executor.execute(workflow, event, input);
      } finally {
        this.runningCount--;
        this.processQueue();
      }
    };

    if (this.runningCount < this.options.maxConcurrentWorkflows) {
      execute();
    } else {
      this.queue.push(execute);
      logger.debug({
        workflowId: workflow.id,
        queueLength: this.queue.length,
      }, 'Workflow execution queued');
    }
  }

  private processQueue(): void {
    while (
      this.queue.length > 0 &&
      this.runningCount < this.options.maxConcurrentWorkflows
    ) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * Manually trigger a workflow
   */
  async triggerWorkflow(
    workflowId: string,
    input: Record<string, unknown>
  ): Promise<WorkflowExecution | undefined> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      logger.error({ workflowId }, 'Workflow not found');
      return undefined;
    }

    if (workflow.trigger.type !== 'manual') {
      logger.warn({ workflowId, triggerType: workflow.trigger.type },
        'Workflow is not configured for manual triggering');
    }

    return this.executor.execute(workflow, { manual: true }, input);
  }

  /**
   * Get workflow definition by ID
   */
  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all workflow definitions
   */
  getAllWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Reload workflow definitions from disk
   */
  async reload(): Promise<void> {
    logger.info('Reloading workflow definitions');
    this.workflows = loadWorkflowsFromDirectory(this.options.workflowsDir);
    this.buildTriggerIndex();
    logger.info({ workflowCount: this.workflows.size }, 'Workflows reloaded');
  }

  /**
   * Get engine status
   */
  getStatus(): {
    workflowCount: number;
    runningExecutions: number;
    queuedExecutions: number;
    subscribedEvents: string[];
  } {
    return {
      workflowCount: this.workflows.size,
      runningExecutions: this.runningCount,
      queuedExecutions: this.queue.length,
      subscribedEvents: this.getSubscribedEventTypes(),
    };
  }
}
