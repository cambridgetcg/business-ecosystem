/**
 * Audit Routes
 */

import type { FastifyInstance } from 'fastify';
import type { SecurityService } from '../../../application/services/security-service.js';

export function registerAuditRoutes(app: FastifyInstance, service: SecurityService) {
  // Get audit logs
  app.get('/audit/logs', async (request, reply) => {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || '';

      if (!tenantId) {
        return reply.status(400).send({ error: 'X-Tenant-Id header required' });
      }

      const {
        startDate,
        endDate,
        eventType,
        actorId,
        limit,
        offset,
      } = request.query as any;

      const logs = await service.getAuditLogs(tenantId, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        eventType,
        actorId,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      return {
        data: logs,
        pagination: {
          limit: limit ? parseInt(limit, 10) : 100,
          offset: offset ? parseInt(offset, 10) : 0,
          total: logs.length,
        },
      };
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Export audit logs (CSV format hint)
  app.get('/audit/logs/export', async (request, reply) => {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || '';

      if (!tenantId) {
        return reply.status(400).send({ error: 'X-Tenant-Id header required' });
      }

      const { startDate, endDate, format = 'json' } = request.query as any;

      const logs = await service.getAuditLogs(tenantId, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: 10000, // Export limit
      });

      if (format === 'csv') {
        // CSV export
        const headers = [
          'id', 'timestamp', 'eventType', 'eventCategory', 'severity',
          'actorId', 'actorEmail', 'action', 'outcome', 'targetType',
          'targetId', 'ipAddress', 'reason'
        ];

        const csvRows = [headers.join(',')];

        for (const log of logs) {
          const row = [
            log.id,
            log.timestamp.toISOString(),
            log.eventType,
            log.eventCategory,
            log.severity,
            log.actorId || '',
            log.actorEmail || '',
            log.action,
            log.outcome,
            log.targetType || '',
            log.targetId || '',
            log.ipAddress || '',
            (log.reason || '').replace(/,/g, ';'),
          ];
          csvRows.push(row.join(','));
        }

        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename="audit-logs-${tenantId}.csv"`);
        return csvRows.join('\n');
      }

      return { data: logs };
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
