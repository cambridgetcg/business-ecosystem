/**
 * @ecosystem/workflow-engine
 * Cross-operational workflow execution engine
 */

// Types
export * from './types.js';

// Parser
export {
  parseWorkflowFile,
  loadWorkflowsFromDirectory,
  resolveInputVariables,
  evaluateCondition,
  parseTimeout,
  buildExecutionOrder,
  WorkflowParseError,
} from './parser.js';

// Executor
export { WorkflowExecutor, type ExecutorConfig } from './executor.js';

// Domain Client
export {
  HttpDomainClient,
  createDomainClients,
  DEFAULT_DOMAIN_ENDPOINTS,
  type HttpDomainClientConfig,
} from './domain-client.js';

// Engine
export { WorkflowEngine, type WorkflowEngineOptions } from './engine.js';

// ============================================================================
// Main Entry Point
// ============================================================================

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { pino } from 'pino';
import { WorkflowEngine } from './engine.js';
import { join } from 'path';
import { createRabbitMQSubscriber, type RabbitMQSubscriber } from '@ecosystem/messaging';

const logger = pino({ name: 'workflow-engine-service' });

async function main() {
  const workflowsDir = process.env.WORKFLOWS_DIR || join(process.cwd(), '../workflows');
  
  const engine = new WorkflowEngine({
    workflowsDir,
    domainEndpoints: {
      'contracts-legal': process.env.CONTRACTS_LEGAL_URL || 'http://localhost:3011',
      'data-privacy': process.env.DATA_PRIVACY_URL || 'http://localhost:3012',
      'insurance': process.env.INSURANCE_URL || 'http://localhost:3013',
      'intellectual-property': process.env.IP_URL || 'http://localhost:3014',
      'operational': process.env.OPERATIONAL_URL || 'http://localhost:3020',
    },
    defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT || '30000', 10),
    defaultRetries: parseInt(process.env.DEFAULT_RETRIES || '3', 10),
    maxConcurrentWorkflows: parseInt(process.env.MAX_CONCURRENT || '10', 10),
  });

  await engine.initialize();

  // Create HTTP API
  const app = new Hono();

  app.use('*', cors());
  app.use('*', honoLogger());

  // Health check
  app.get('/health', (c) => {
    const status = engine.getStatus();
    return c.json({
      status: 'healthy',
      service: 'workflow-engine',
      timestamp: new Date().toISOString(),
      ...status,
    });
  });

  // List workflows
  app.get('/workflows', (c) => {
    const workflows = engine.getAllWorkflows().map(w => ({
      id: w.id,
      name: w.name,
      version: w.version,
      trigger: w.trigger,
      stepCount: w.steps.length,
    }));
    return c.json({ workflows });
  });

  // Get workflow details
  app.get('/workflows/:id', (c) => {
    const workflow = engine.getWorkflow(c.req.param('id'));
    if (!workflow) {
      return c.json({ error: 'Workflow not found' }, 404);
    }
    return c.json(workflow);
  });

  // Manually trigger workflow
  app.post('/workflows/:id/trigger', async (c) => {
    const workflowId = c.req.param('id');
    const input = await c.req.json();

    const execution = await engine.triggerWorkflow(workflowId, input);
    if (!execution) {
      return c.json({ error: 'Workflow not found' }, 404);
    }

    return c.json({
      executionId: execution.id,
      workflowId: execution.workflowId,
      status: execution.status,
      startedAt: execution.startedAt,
    });
  });

  // Reload workflows
  app.post('/workflows/reload', async (c) => {
    await engine.reload();
    const status = engine.getStatus();
    return c.json({
      message: 'Workflows reloaded',
      ...status,
    });
  });

  // Engine status
  app.get('/status', (c) => {
    return c.json(engine.getStatus());
  });

  // Start server
  const port = parseInt(process.env.PORT || '3020', 10);

  serve({ fetch: app.fetch, port }, (info) => {
    logger.info({ port: info.port }, 'Workflow engine service started');
  });

  // Connect to message queue and subscribe to events
  const rabbitmqUrl = process.env.RABBITMQ_URL;
  let subscriber: RabbitMQSubscriber | null = null;

  if (rabbitmqUrl) {
    try {
      subscriber = createRabbitMQSubscriber(rabbitmqUrl, {
        queue: 'workflow-engine',
        exchange: 'ecosystem.events',
      });

      await subscriber.connect();

      // Get the event handler and subscribed event types from the engine
      const eventHandler = engine.createEventHandler();
      const subscribedEvents = engine.getSubscribedEventTypes();

      // Subscribe to all event types that trigger workflows
      if (subscribedEvents.length > 0) {
        await subscriber.subscribeToMany(subscribedEvents, eventHandler);
        await subscriber.startConsuming();
        logger.info({ subscribedEvents }, 'Workflow engine subscribed to domain events');
      } else {
        logger.info('No event-triggered workflows found, skipping message queue subscription');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to connect to message queue - continuing without event subscriptions');
    }
  } else {
    logger.warn('RABBITMQ_URL not configured - event-driven workflows will not trigger automatically');
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down workflow engine...');
    if (subscriber) {
      await subscriber.disconnect();
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error({ error }, 'Failed to start workflow engine');
    process.exit(1);
  });
}
