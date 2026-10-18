/**
 * Privacy Program Metrics Routes
 * Program-level compliance metrics and dashboards
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { MetricsService } from '../domain/privacy-program/services/metrics.service.js';

const metricsRoutes = new Hono();

// ===========================================================================
// Validation Schemas
// ===========================================================================

const entityIdParamSchema = z.object({
  entityId: z.string().uuid(),
});

const periodQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ===========================================================================
// Program Metrics
// ===========================================================================

// Get comprehensive privacy program metrics
metricsRoutes.get(
  '/program/:entityId',
  zValidator('param', entityIdParamSchema),
  async (c) => {
    const service = c.get('metricsService') as MetricsService;
    const { entityId } = c.req.valid('param');

    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const period = startDate && endDate
      ? { start: new Date(startDate), end: new Date(endDate) }
      : undefined;

    const result = await service.generateProgramMetrics(entityId, period);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// ===========================================================================
// Compliance Dashboard
// ===========================================================================

// Get compliance dashboard
metricsRoutes.get(
  '/dashboard/:entityId',
  zValidator('param', entityIdParamSchema),
  async (c) => {
    const service = c.get('metricsService') as MetricsService;
    const { entityId } = c.req.valid('param');

    const result = await service.generateDashboard(entityId);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// ===========================================================================
// Quick Status
// ===========================================================================

// Get quick compliance status
metricsRoutes.get(
  '/status/:entityId',
  zValidator('param', entityIdParamSchema),
  async (c) => {
    const service = c.get('metricsService') as MetricsService;
    const { entityId } = c.req.valid('param');

    const result = await service.getComplianceStatus(entityId);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// ===========================================================================
// Action Items
// ===========================================================================

// Get priority action items
metricsRoutes.get(
  '/actions/:entityId',
  zValidator('param', entityIdParamSchema),
  async (c) => {
    const service = c.get('metricsService') as MetricsService;
    const { entityId } = c.req.valid('param');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 10;

    const result = await service.getPriorityActions(entityId, limit);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// ===========================================================================
// Compliance Reports
// ===========================================================================

// Export compliance report (for regulators/auditors)
metricsRoutes.get(
  '/report/:entityId',
  zValidator('param', entityIdParamSchema),
  async (c) => {
    const service = c.get('metricsService') as MetricsService;
    const { entityId } = c.req.valid('param');

    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    if (!startDate || !endDate) {
      return c.json({
        error: {
          code: 'MISSING_DATES',
          message: 'startDate and endDate query parameters are required',
        },
      }, 400);
    }

    const result = await service.exportComplianceReport(entityId, {
      start: new Date(startDate),
      end: new Date(endDate),
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// ===========================================================================
// Summary Endpoints
// ===========================================================================

// Get KPI summary (lightweight endpoint for status bars/widgets)
metricsRoutes.get(
  '/kpis/:entityId',
  zValidator('param', entityIdParamSchema),
  async (c) => {
    const service = c.get('metricsService') as MetricsService;
    const { entityId } = c.req.valid('param');

    const result = await service.generateDashboard(entityId);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      entityId,
      kpis: result.data.kpis,
      currentStatus: result.data.currentStatus,
      generatedAt: result.data.generatedAt,
    });
  }
);

// Get alerts only
metricsRoutes.get(
  '/alerts/:entityId',
  zValidator('param', entityIdParamSchema),
  async (c) => {
    const service = c.get('metricsService') as MetricsService;
    const { entityId } = c.req.valid('param');

    const result = await service.generateDashboard(entityId);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      entityId,
      alerts: result.data.alerts,
      generatedAt: result.data.generatedAt,
    });
  }
);

export { metricsRoutes };
