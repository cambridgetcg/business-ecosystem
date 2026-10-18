/**
 * @ecosystem/operational-gateway
 * Unified API gateway for cross-operational queries
 */

export * from './types.js';
export {
  DomainClient,
  createDomainClients,
  DEFAULT_DOMAIN_ENDPOINTS,
  CircuitOpenError,
  getDomainCircuitStats,
  hasOpenDomainCircuits,
  getDomainCircuitCounts,
  resetDomainCircuit,
  resetAllDomainCircuits,
} from './domain-client.js';
export { OperationalAggregator } from './aggregator.js';
export { cache, cacheMiddleware, invalidateEntityCache } from './middleware/cache.js';
export { errorHandler, notFoundHandler, OperationalError } from './middleware/error-handler.js';
export {
  CircuitBreaker,
  CircuitBreakerRegistry,
  circuitRegistry,
  type CircuitState,
  type CircuitBreakerOptions,
} from './middleware/circuit-breaker.js';

// Orchestration exports
export {
  SagaExecutor,
  SagaStepError,
  SagaTimeoutError,
  createEntityCreationSaga,
  sagaExecutionStatusSchema,
  stepStatusSchema,
  sagaExecutionQuerySchema,
} from './orchestration/index.js';

export type {
  SagaStep,
  SagaDefinition,
  SagaExecution,
  SagaContext,
  SagaMetadata,
  SagaStatus,
  StepStatus,
  StepResult,
  StepExecution,
  SagaExecutorOptions,
  EntityCreationInput,
  EntityCreationResult,
  EntityCreationSagaConfig,
} from './orchestration/index.js';

// ============================================================================
// Main Entry Point
// ============================================================================

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import { rateLimiter } from 'hono-rate-limiter';
import pino from 'pino';
import {
  createDomainClients,
  getDomainCircuitStats,
  hasOpenDomainCircuits,
  getDomainCircuitCounts,
  resetDomainCircuit,
  resetAllDomainCircuits,
} from './domain-client.js';
import { OperationalAggregator } from './aggregator.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { cacheMiddleware, cache } from './middleware/cache.js';
import { createSearchRoutes } from './routes/search.js';
import { createTimelineRoutes } from './routes/timeline.js';
import { createStatsRoutes } from './routes/stats.js';
import { createFinancialDashboardRoutes } from './routes/financial-dashboard.js';
import { createOrchestrationRoutes } from './routes/orchestration.routes.js';
import { createCorrelationRoutes } from './routes/correlation.routes.js';
import type { OperationalDomain } from './types.js';

const logger = pino({ name: 'operational-gateway' });

async function main() {
  // Create domain clients with environment overrides
  const domainEndpoints: Partial<Record<OperationalDomain, string>> = {
    'contracts-legal': process.env.CONTRACTS_LEGAL_URL,
    'insurance': process.env.INSURANCE_URL,
    'intellectual-property': process.env.IP_URL,
    'data-privacy': process.env.DATA_PRIVACY_URL,
  };

  // Remove undefined values
  for (const key of Object.keys(domainEndpoints) as OperationalDomain[]) {
    if (!domainEndpoints[key]) delete domainEndpoints[key];
  }

  const domainClients = createDomainClients(domainEndpoints);

  const aggregator = new OperationalAggregator(domainClients, {
    baseUrl: process.env.COMPLIANCE_URL || 'http://localhost:3021',
    timeout: parseInt(process.env.COMPLIANCE_TIMEOUT || '10000', 10),
  });

  const app = new Hono();

  // ============================================================================
  // Middleware
  // ============================================================================

  app.use('*', cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  }));
  app.use('*', secureHeaders());
  app.use('*', timing());
  app.use('*', honoLogger());
  app.use('*', errorHandler);

  // Rate limiting
  const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';
  if (rateLimitEnabled) {
    app.use('*', rateLimiter({
      windowMs: 60 * 1000, // 1 minute
      limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      standardHeaders: 'draft-6',
      keyGenerator: (c) => c.req.header('x-forwarded-for') || 'anonymous',
    }));
  }

  // Response caching
  const cacheEnabled = process.env.CACHE_ENABLED !== 'false';
  app.use('*', cacheMiddleware({ enabled: cacheEnabled }));

  // ============================================================================
  // Health Endpoints
  // ============================================================================

  app.get('/health', async (c) => {
    return c.json({
      status: 'healthy',
      service: 'operational-gateway',
      timestamp: new Date().toISOString(),
      version: process.env.SERVICE_VERSION || '1.0.0',
    });
  });

  app.get('/health/detailed', async (c) => {
    const domainHealth = await aggregator.getDomainsHealth();
    const healthObj: Record<string, { status: string; timestamp: string }> = {};

    let allHealthy = true;
    for (const [domain, health] of domainHealth) {
      healthObj[domain] = {
        status: health.status,
        timestamp: health.timestamp.toISOString(),
      };
      if (health.status !== 'healthy') {
        allHealthy = false;
      }
    }

    const circuitCounts = getDomainCircuitCounts();
    const hasOpenCircuits = hasOpenDomainCircuits();

    return c.json({
      status: allHealthy && !hasOpenCircuits ? 'healthy' : 'degraded',
      service: 'operational-gateway',
      timestamp: new Date().toISOString(),
      domains: healthObj,
      cache: {
        enabled: cacheEnabled,
        entries: cache.size,
      },
      circuitBreakers: {
        hasOpenCircuits,
        counts: circuitCounts,
      },
    });
  });

  app.get('/ready', async (c) => {
    const domainHealth = await aggregator.getDomainsHealth();
    const healthyCount = Array.from(domainHealth.values()).filter(h => h.status === 'healthy').length;

    if (healthyCount === 0) {
      return c.json({ ready: false, reason: 'No domain services available' }, 503);
    }

    return c.json({
      ready: true,
      healthyDomains: healthyCount,
      totalDomains: domainHealth.size,
    });
  });

  // ============================================================================
  // Entity Operational Overview
  // ============================================================================

  /**
   * GET /operational/entities/:entityId/overview
   * Comprehensive operational overview for an entity across all domains
   */
  app.get('/operational/entities/:entityId/overview', async (c) => {
    const entityId = c.req.param('entityId');
    const includeCompliance = c.req.query('compliance') !== 'false';
    const includePendingActions = c.req.query('pending-actions') !== 'false';
    const includeExpiringItems = c.req.query('expiring') !== 'false';
    const expiringWithinDays = parseInt(c.req.query('expiring-days') || '30', 10);
    const domainsParam = c.req.query('domains');
    const includeDomains = domainsParam
      ? (domainsParam.split(',') as OperationalDomain[])
      : undefined;

    const overview = await aggregator.getEntityOverview({
      entityId,
      includeDomains,
      includeCompliance,
      includePendingActions,
      includeExpiringItems,
      expiringWithinDays,
    });

    return c.json(overview);
  });

  // ============================================================================
  // Compliance
  // ============================================================================

  /**
   * GET /operational/entities/:entityId/compliance
   * Proxy to compliance aggregator service
   */
  app.get('/operational/entities/:entityId/compliance', async (c) => {
    const entityId = c.req.param('entityId');
    const complianceUrl = process.env.COMPLIANCE_URL || 'http://localhost:3021';

    try {
      const response = await fetch(`${complianceUrl}/entities/${entityId}/compliance`);
      const data = await response.json();
      return c.json(data);
    } catch (error) {
      logger.error({ entityId, error }, 'Failed to fetch compliance');
      return c.json({ error: 'Compliance service unavailable' }, 503);
    }
  });

  /**
   * GET /operational/entities/:entityId/compliance/dashboard
   * Proxy to compliance dashboard endpoint
   */
  app.get('/operational/entities/:entityId/compliance/dashboard', async (c) => {
    const entityId = c.req.param('entityId');
    const complianceUrl = process.env.COMPLIANCE_URL || 'http://localhost:3021';

    try {
      const response = await fetch(`${complianceUrl}/entities/${entityId}/compliance/dashboard`);
      const data = await response.json();
      return c.json(data);
    } catch (error) {
      logger.error({ entityId, error }, 'Failed to fetch compliance dashboard');
      return c.json({ error: 'Compliance service unavailable' }, 503);
    }
  });

  // ============================================================================
  // Pending Actions
  // ============================================================================

  /**
   * GET /operational/pending-actions
   * All pending actions across operational domains
   */
  app.get('/operational/pending-actions', async (c) => {
    const entityId = c.req.query('entityId');
    const priority = c.req.query('priority') as 'high' | 'medium' | 'low' | undefined;
    const assignee = c.req.query('assignee');
    const dueBefore = c.req.query('dueBefore');
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const domainsParam = c.req.query('domains');
    const domains = domainsParam
      ? (domainsParam.split(',') as OperationalDomain[])
      : undefined;

    const actions = await aggregator.fetchPendingActions({
      entityId,
      domains,
      priority,
      assignee,
      dueBefore: dueBefore ? new Date(dueBefore) : undefined,
      limit,
      offset,
    });

    return c.json({
      actions,
      count: actions.length,
      limit,
      offset,
    });
  });

  /**
   * GET /operational/entities/:entityId/pending-actions
   * Pending actions for a specific entity
   */
  app.get('/operational/entities/:entityId/pending-actions', async (c) => {
    const entityId = c.req.param('entityId');
    const priority = c.req.query('priority') as 'high' | 'medium' | 'low' | undefined;
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const actions = await aggregator.fetchPendingActions({
      entityId,
      priority,
      limit,
      offset,
    });

    return c.json({
      entityId,
      actions,
      count: actions.length,
    });
  });

  // ============================================================================
  // Expiring Items
  // ============================================================================

  /**
   * GET /operational/expiring
   * All items expiring within specified days
   */
  app.get('/operational/expiring', async (c) => {
    const entityId = c.req.query('entityId');
    const withinDays = parseInt(c.req.query('days') || '30', 10);
    const renewalRequiredOnly = c.req.query('renewal-required') === 'true';
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const domainsParam = c.req.query('domains');
    const domains = domainsParam
      ? (domainsParam.split(',') as OperationalDomain[])
      : undefined;

    const items = await aggregator.fetchExpiringItems({
      entityId,
      domains,
      withinDays,
      renewalRequiredOnly,
      limit,
      offset,
    });

    return c.json({
      items,
      count: items.length,
      withinDays,
      limit,
      offset,
    });
  });

  /**
   * GET /operational/entities/:entityId/expiring
   * Expiring items for a specific entity
   */
  app.get('/operational/entities/:entityId/expiring', async (c) => {
    const entityId = c.req.param('entityId');
    const withinDays = parseInt(c.req.query('days') || '30', 10);
    const renewalRequiredOnly = c.req.query('renewal-required') === 'true';

    const items = await aggregator.fetchExpiringItems({
      entityId,
      withinDays,
      renewalRequiredOnly,
    });

    return c.json({
      entityId,
      items,
      count: items.length,
      withinDays,
    });
  });

  // ============================================================================
  // Domain Health
  // ============================================================================

  /**
   * GET /operational/domains/health
   * Health status of all operational domain services
   */
  app.get('/operational/domains/health', async (c) => {
    const domainHealth = await aggregator.getDomainsHealth();
    const healthObj: Record<string, { status: string; timestamp: string }> = {};

    let allHealthy = true;
    for (const [domain, health] of domainHealth) {
      healthObj[domain] = {
        status: health.status,
        timestamp: health.timestamp.toISOString(),
      };
      if (health.status !== 'healthy') {
        allHealthy = false;
      }
    }

    return c.json({
      overall: allHealthy ? 'healthy' : 'degraded',
      domains: healthObj,
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================================================
  // Workflow Integration
  // ============================================================================

  /**
   * POST /operational/workflows/:workflowId/trigger
   * Proxy to workflow engine
   */
  app.post('/operational/workflows/:workflowId/trigger', async (c) => {
    const workflowId = c.req.param('workflowId');
    const workflowEngineUrl = process.env.WORKFLOW_ENGINE_URL || 'http://localhost:3020';
    const body = await c.req.json();

    try {
      const response = await fetch(`${workflowEngineUrl}/workflows/${workflowId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return c.json(data, response.status as 200 | 404);
    } catch (error) {
      logger.error({ workflowId, error }, 'Failed to trigger workflow');
      return c.json({ error: 'Workflow engine unavailable' }, 503);
    }
  });

  /**
   * GET /operational/workflows
   * List available workflows
   */
  app.get('/operational/workflows', async (c) => {
    const workflowEngineUrl = process.env.WORKFLOW_ENGINE_URL || 'http://localhost:3020';

    try {
      const response = await fetch(`${workflowEngineUrl}/workflows`);
      const data = await response.json();
      return c.json(data);
    } catch (error) {
      logger.error({ error }, 'Failed to list workflows');
      return c.json({ error: 'Workflow engine unavailable' }, 503);
    }
  });

  // ============================================================================
  // Additional Route Modules
  // ============================================================================

  // Search routes
  app.route('/operational/search', createSearchRoutes(domainClients));

  // Timeline routes
  app.route('/operational/timeline', createTimelineRoutes(domainClients));

  // Statistics routes
  app.route('/operational/stats', createStatsRoutes(domainClients));

  // Financial dashboard routes
  app.route('/operational/financial', createFinancialDashboardRoutes({
    accountingUrl: process.env.ACCOUNTING_URL || 'http://localhost:3002',
    bankingUrl: process.env.BANKING_URL || 'http://localhost:3003',
    taxUrl: process.env.TAX_URL || 'http://localhost:3006',
    complianceUrl: process.env.COMPLIANCE_URL || 'http://localhost:3007',
  }));

  // Orchestration routes (saga execution)
  app.route('/orchestration', createOrchestrationRoutes({
    entityGovernanceUrl: process.env.ENTITY_GOVERNANCE_URL || 'http://localhost:3004',
    complianceUrl: process.env.COMPLIANCE_URL || 'http://localhost:3007',
    taxUrl: process.env.TAX_URL || 'http://localhost:3006',
    securityUrl: process.env.SECURITY_URL || 'http://localhost:3008',
    stepTimeout: parseInt(process.env.SAGA_STEP_TIMEOUT || '30000', 10),
  }));

  // ============================================================================
  // Cache Management
  // ============================================================================

  app.post('/admin/cache/clear', async (c) => {
    cache.clear();
    return c.json({ message: 'Cache cleared' });
  });

  app.get('/admin/cache/stats', async (c) => {
    return c.json({
      entries: cache.size,
      enabled: cacheEnabled,
    });
  });

  // ============================================================================
  // Circuit Breaker Management
  // ============================================================================

  /**
   * GET /admin/circuits
   * Get circuit breaker status for all domains
   */
  app.get('/admin/circuits', async (c) => {
    const stats = getDomainCircuitStats();
    const counts = getDomainCircuitCounts();
    const hasOpen = hasOpenDomainCircuits();

    return c.json({
      hasOpenCircuits: hasOpen,
      summary: counts,
      circuits: stats.map(s => ({
        ...s,
        lastFailure: s.lastFailure?.toISOString() || null,
        openedAt: s.openedAt?.toISOString() || null,
      })),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /admin/circuits/reset
   * Reset all circuit breakers
   */
  app.post('/admin/circuits/reset', async (c) => {
    resetAllDomainCircuits();
    logger.info('All domain circuit breakers reset');
    return c.json({
      message: 'All circuit breakers reset',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /admin/circuits/:domain/reset
   * Reset a specific domain's circuit breaker
   */
  app.post('/admin/circuits/:domain/reset', async (c) => {
    const domain = c.req.param('domain') as OperationalDomain;
    const validDomains: OperationalDomain[] = ['contracts-legal', 'insurance', 'intellectual-property', 'data-privacy'];

    if (!validDomains.includes(domain)) {
      return c.json({ error: `Invalid domain: ${domain}` }, 400);
    }

    resetDomainCircuit(domain);
    logger.info({ domain }, 'Domain circuit breaker reset');
    return c.json({
      message: `Circuit breaker for ${domain} reset`,
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================================================
  // 404 Handler
  // ============================================================================

  app.notFound(notFoundHandler);

  // Start server
  const port = parseInt(process.env.PORT || '3022', 10);

  serve({ fetch: app.fetch, port }, (info) => {
    logger.info({ port: info.port }, 'Operational gateway started');
    logger.info({
      endpoints: {
        overview: '/operational/entities/:entityId/overview',
        compliance: '/operational/entities/:entityId/compliance',
        pendingActions: '/operational/pending-actions',
        expiring: '/operational/expiring',
        domainsHealth: '/operational/domains/health',
        workflows: '/operational/workflows',
        search: '/operational/search',
        timeline: '/operational/timeline',
        stats: '/operational/stats',
        orchestration: '/orchestration',
      },
      features: {
        caching: cacheEnabled,
        rateLimiting: rateLimitEnabled,
        sagaOrchestration: true,
        circuitBreaker: true,
      },
    }, 'Available endpoints');
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error({ error }, 'Failed to start operational gateway');
    process.exit(1);
  });
}
