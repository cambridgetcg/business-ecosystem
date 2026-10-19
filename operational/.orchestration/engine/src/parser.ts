/**
 * Workflow Definition Parser
 * Parses YAML workflow definitions and validates them
 */

import { parse as parseYaml } from 'yaml';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { workflowDefinitionSchema, type WorkflowDefinition } from './types.js';
import { pino } from 'pino';

const logger = pino({ name: 'workflow-parser' });

export class WorkflowParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: unknown
  ) {
    super(`Failed to parse workflow at ${filePath}: ${message}`);
    this.name = 'WorkflowParseError';
  }
}

/**
 * Parse a single workflow YAML file
 */
export function parseWorkflowFile(filePath: string): WorkflowDefinition {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const raw: unknown = parseYaml(content);

    const result = workflowDefinitionSchema.safeParse(raw);

    if (!result.success) {
      const errors = result.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      throw new WorkflowParseError(errors, filePath);
    }

    logger.debug({ workflowId: result.data.id, filePath }, 'Parsed workflow definition');
    return result.data;
  } catch (error) {
    if (error instanceof WorkflowParseError) {
      throw error;
    }
    throw new WorkflowParseError(
      error instanceof Error ? error.message : 'Unknown error',
      filePath,
      error
    );
  }
}

/**
 * Load all workflow definitions from a directory
 */
export function loadWorkflowsFromDirectory(
  dirPath: string
): Map<string, WorkflowDefinition> {
  const workflows = new Map<string, WorkflowDefinition>();

  const files = readdirSync(dirPath);

  for (const file of files) {
    const filePath = join(dirPath, file);
    const stat = statSync(filePath);

    if (stat.isFile() && (file.endsWith('.yaml') || file.endsWith('.yml'))) {
      try {
        const workflow = parseWorkflowFile(filePath);

        if (workflows.has(workflow.id)) {
          logger.warn(
            { workflowId: workflow.id, filePath },
            'Duplicate workflow ID found, overwriting previous definition'
          );
        }

        workflows.set(workflow.id, workflow);
        logger.info({ workflowId: workflow.id, filePath }, 'Loaded workflow definition');
      } catch (error) {
        logger.error({ error, filePath }, 'Failed to load workflow definition');
      }
    }
  }

  logger.info({ count: workflows.size, dirPath }, 'Loaded workflow definitions');
  return workflows;
}

/**
 * Resolve input variables in a workflow step
 * Supports \${input.varName} and \${workflow.varName} syntax
 */
export function resolveInputVariables(
  template: Record<string, unknown>,
  context: {
    input: Record<string, unknown>;
    workflow: {
      completedSteps: string[];
      skippedSteps: string[];
      failedSteps: string[];
    };
    stepResults: Map<string, unknown>;
  }
): Record<string, unknown> {
  const resolve = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return value.replace(/\\\${([^}]+)}/g, (_, path: string) => {
        const parts = path.split('.');
        let current: unknown = context;

        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) {
            current = (current as Record<string, unknown>)[part];
          } else {
            return `\\\${\${path}}`;
          }
        }

        return String(current);
      });
    }

    if (Array.isArray(value)) {
      return value.map(resolve);
    }

    if (value && typeof value === 'object') {
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        resolved[k] = resolve(v);
      }
      return resolved;
    }

    return value;
  };

  return resolve(template) as Record<string, unknown>;
}

/**
 * Evaluate a condition expression
 */
export function evaluateCondition(
  condition: string,
  context: {
    input: Record<string, unknown>;
    workflow: Record<string, unknown>;
  }
): boolean {
  try {
    const expression = condition.match(/^\\\${(.+)}$/)?.[1];
    if (expression === undefined) {
      logger.warn({ condition }, 'Invalid condition format');
      return true;
    }

    // Handle "X in [...]" pattern
    const [, varPath, arrayStr] = expression.match(/^(.+?)\\s+in\\s+\\[(.+)\\]$/) ?? [];
    if (varPath !== undefined && arrayStr !== undefined) {
      const varValue = resolveVariable(varPath.trim(), context);
      const arrayValues = arrayStr.split(',').map(s =>
        s.trim().replace(/^['"]|['"]$/g, '')
      );
      return arrayValues.includes(String(varValue));
    }

    // Truthy check for single variable
    const value = resolveVariable(expression.trim(), context);
    return Boolean(value);
  } catch (error) {
    logger.error({ condition, error }, 'Failed to evaluate condition');
    return false;
  }
}

function resolveVariable(
  path: string,
  context: Record<string, unknown>
): unknown {
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Parse timeout string to milliseconds
 */
export function parseTimeout(timeout: string): number {
  const [, value, unit] = timeout.match(/^(\\d+)(s|m|h)$/) ?? [];
  if (value === undefined) {
    throw new Error(`Invalid timeout format: ${timeout}`);
  }

  const num = parseInt(value, 10);

  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Build execution order for workflow steps based on dependencies
 */
export function buildExecutionOrder(
  steps: WorkflowDefinition['steps']
): string[][] {
  const order: string[][] = [];
  const completed = new Set<string>();
  const pending = new Map(steps.map(s => [s.id, s]));

  while (pending.size > 0) {
    const batch: string[] = [];

    for (const [id, step] of pending) {
      const deps = step.dependsOn || [];
      const allDepsCompleted = deps.every(dep => completed.has(dep));

      if (allDepsCompleted) {
        batch.push(id);
      }
    }

    if (batch.length === 0 && pending.size > 0) {
      const remaining = Array.from(pending.keys()).join(', ');
      throw new Error(`Circular dependency detected. Remaining: ${remaining}`);
    }

    for (const id of batch) {
      pending.delete(id);
      completed.add(id);
    }

    if (batch.length > 0) {
      order.push(batch);
    }
  }

  return order;
}
