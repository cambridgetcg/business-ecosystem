/**
 * @ecosystem/saga
 * Saga orchestration for distributed transactions
 */

import { pgTable, uuid, varchar, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { eq, and, lt, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import pino from 'pino';
import type { Logger } from 'pino';

const logger: Logger = (pino as unknown as (options: object) => Logger)({ name: 'saga' });

// Saga state table
export const sagaTable = pgTable('sagas', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 100 }).notNull(),
  correlationId: varchar('correlation_id', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  currentStep: integer('current_step').notNull().default(0),
  payload: jsonb('payload').notNull(),
  context: jsonb('context').default({}),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  timeoutAt: timestamp('timeout_at'),
});

// Saga step log table
export const sagaStepTable = pgTable('saga_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  sagaId: uuid('saga_id').notNull().references(() => sagaTable.id),
  stepIndex: integer('step_index').notNull(),
  stepName: varchar('step_name', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  input: jsonb('input'),
  output: jsonb('output'),
  error: text('error'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
});

export type SagaStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensating' | 'compensated';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensated';

export interface SagaRecord {
  id: string;
  type: string;
  correlationId: string;
  status: SagaStatus;
  currentStep: number;
  payload: Record<string, unknown>;
  context: Record<string, unknown>;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  timeoutAt: Date | null;
}

// Saga step definition
export interface SagaStep<TPayload = unknown, TContext = unknown> {
  name: string;
  execute: (payload: TPayload, context: TContext) => Promise<Partial<TContext>>;
  compensate?: (payload: TPayload, context: TContext) => Promise<void>;
  timeout?: number;
}

// Saga definition
export interface SagaDefinition<TPayload = unknown, TContext = unknown> {
  type: string;
  steps: SagaStep<TPayload, TContext>[];
  onComplete?: (payload: TPayload, context: TContext) => Promise<void>;
  onFailed?: (payload: TPayload, context: TContext, error: Error) => Promise<void>;
  defaultTimeout?: number;
}

// Saga executor
export class SagaExecutor<TPayload = unknown, TContext extends Record<string, unknown> = Record<string, unknown>> {
  constructor(
    private db: NodePgDatabase<Record<string, unknown>>,
    private definition: SagaDefinition<TPayload, TContext>
  ) {}

  async start(payload: TPayload, correlationId: string): Promise<string> {
    const timeoutAt = this.definition.defaultTimeout
      ? new Date(Date.now() + this.definition.defaultTimeout)
      : null;

    const [saga] = await this.db.insert(sagaTable).values({
      type: this.definition.type,
      correlationId,
      payload,
      context: {},
      status: 'pending',
      timeoutAt,
    }).returning();

    if (!saga) {
      throw new Error('Failed to create saga');
    }

    logger.info({ sagaId: saga.id, type: this.definition.type }, 'Saga started');

    setImmediate(() => this.execute(saga.id));

    return saga.id;
  }

  async execute(sagaId: string): Promise<void> {
    const saga = await this.getSaga(sagaId);
    if (!saga || saga.status === 'completed' || saga.status === 'compensated') {
      return;
    }

    await this.updateSaga(sagaId, { status: 'running' });

    let context = saga.context as TContext;
    const payload = saga.payload as TPayload;

    try {
      for (let i = saga.currentStep; i < this.definition.steps.length; i++) {
        const step = this.definition.steps[i];
        if (!step) continue;

        const [stepLog] = await this.db.insert(sagaStepTable).values({
          sagaId,
          stepIndex: i,
          stepName: step.name,
          status: 'running',
          input: { payload, context } as Record<string, unknown>,
          startedAt: new Date(),
        }).returning();

        if (!stepLog) {
          throw new Error('Failed to create step log');
        }

        try {
          const result = await this.executeWithTimeout(
            () => step.execute(payload, context),
            step.timeout || 30000
          );

          context = { ...context, ...result } as TContext;

          await this.db.update(sagaStepTable)
            .set({
              status: 'completed',
              output: result as Record<string, unknown>,
              completedAt: new Date(),
            })
            .where(eq(sagaStepTable.id, stepLog.id));

          await this.updateSaga(sagaId, {
            currentStep: i + 1,
            context: context as Record<string, unknown>,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          await this.db.update(sagaStepTable)
            .set({
              status: 'failed',
              error: errorMessage,
              completedAt: new Date(),
            })
            .where(eq(sagaStepTable.id, stepLog.id));

          throw error;
        }
      }

      await this.updateSaga(sagaId, {
        status: 'completed',
        completedAt: new Date(),
      });

      if (this.definition.onComplete) {
        await this.definition.onComplete(payload, context);
      }

      logger.info({ sagaId }, 'Saga completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({ sagaId, error: errorMessage }, 'Saga failed, starting compensation');

      await this.updateSaga(sagaId, {
        status: 'compensating',
        error: errorMessage,
      });

      await this.compensate(sagaId, payload, context);
    }
  }

  private async compensate(sagaId: string, payload: TPayload, context: TContext): Promise<void> {
    const saga = await this.getSaga(sagaId);
    if (!saga) return;

    for (let i = saga.currentStep - 1; i >= 0; i--) {
      const step = this.definition.steps[i];
      if (!step || !step.compensate) continue;

      try {
        await step.compensate(payload, context);

        await this.db.update(sagaStepTable)
          .set({ status: 'compensated' })
          .where(
            and(
              eq(sagaStepTable.sagaId, sagaId),
              eq(sagaStepTable.stepIndex, i)
            )
          );
      } catch (error) {
        logger.error({ sagaId, step: step.name, error }, 'Compensation failed');
      }
    }

    await this.updateSaga(sagaId, {
      status: 'compensated',
      completedAt: new Date(),
    });

    if (this.definition.onFailed) {
      await this.definition.onFailed(payload, context, new Error(saga.error || 'Saga failed'));
    }

    logger.info({ sagaId }, 'Saga compensated');
  }

  private async getSaga(sagaId: string): Promise<SagaRecord | null> {
    const [saga] = await this.db.select()
      .from(sagaTable)
      .where(eq(sagaTable.id, sagaId))
      .limit(1);
    return (saga as SagaRecord) || null;
  }

  private async updateSaga(sagaId: string, updates: Partial<SagaRecord>): Promise<void> {
    await this.db.update(sagaTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sagaTable.id, sagaId));
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Step timeout')), timeout)
      ),
    ]);
  }
}

// Saga registry
const sagaRegistry = new Map<string, SagaDefinition>();

export function registerSaga<TPayload, TContext>(definition: SagaDefinition<TPayload, TContext>): void {
  sagaRegistry.set(definition.type, definition as SagaDefinition);
  logger.info({ type: definition.type, steps: definition.steps.length }, 'Saga registered');
}

export function getSagaDefinition(type: string): SagaDefinition | undefined {
  return sagaRegistry.get(type);
}

export async function recoverSagas(db: NodePgDatabase<Record<string, unknown>>): Promise<void> {
  const stuckSagas = await db.select()
    .from(sagaTable)
    .where(
      or(
        eq(sagaTable.status, 'running'),
        and(
          eq(sagaTable.status, 'pending'),
          lt(sagaTable.timeoutAt, new Date())
        )
      )
    );

  for (const saga of stuckSagas) {
    const definition = getSagaDefinition(saga.type);
    if (!definition) {
      logger.warn({ sagaId: saga.id, type: saga.type }, 'No definition for saga, skipping recovery');
      continue;
    }

    const executor = new SagaExecutor(db, definition);
    logger.info({ sagaId: saga.id }, 'Recovering saga');
    await executor.execute(saga.id);
  }
}

export const sagaMigrationSQL = `
CREATE TABLE IF NOT EXISTS sagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(100) NOT NULL,
  correlation_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  current_step INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  context JSONB DEFAULT '{}',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sagas_status ON sagas (status);
CREATE INDEX IF NOT EXISTS idx_sagas_correlation ON sagas (correlation_id);
CREATE INDEX IF NOT EXISTS idx_sagas_type ON sagas (type);

CREATE TABLE IF NOT EXISTS saga_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saga_id UUID NOT NULL REFERENCES sagas(id),
  step_index INTEGER NOT NULL,
  step_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_saga_steps_saga ON saga_steps (saga_id);
`;
