/**
 * @ecosystem/operational-gateway
 * Unified API gateway for cross-operational queries
 */

export * from './types.js';
export { DomainClient, createDomainClients, DEFAULT_DOMAIN_ENDPOINTS } from './domain-client.js';
export { OperationalAggregator } from './aggregator.js';

// ============================================================================
// Main Entry Point
// ============================================================================

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { pino } from 'pino';
import { createDomainClients } from './domain-client.js';
import { OperationalAggregator } from './aggregator.js';
import type { OperationalDomain } from './types.js';

const logger = pino({ name: 'operational-gateway' });

function main(): void {
  // Create domain clients with environment overrides
  const domainEndpoints: Partial<Record<OperationalDomain, string | undefined>> = {
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

  app.use('*', cors());
  app.use('*', honoLogger());

  // Health check
  app.get('/health', async (c) => {
    const domainHealth = await aggregator.getDomainsHealth();
    const healthObj: Record<string, { status: string; timestamp: string }> = {};
    
    for (const [domain, health] of domainHealth) {
      healthObj[domain] = {
        status: health.status,
        timestamp: health.timestamp.toISOString(),
      };
    }

    return c.json({
      status: 'healthy',
      service: 'operational-gateway',
      timestamp: new Date().toISOString(),
      domains: healthObj,
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
    const body = await c.req.json<unknown>();

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
      },
    }, 'Available endpoints');
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    logger.error({ error }, 'Failed to start operational gateway');
    process.exit(1);
  }
}
