/**
 * Reports API Routes
 *
 * REST API endpoints for generating IP portfolio reports.
 *
 * @module api/rest/routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  ReportGeneratorService,
  createReportGeneratorService,
} from '../../../application/services/report-generator.service.js';
import type { ReportFormat, ReportGenerationOptions } from '../../../application/services/report-types.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const ReportFormatSchema = z.enum(['json', 'html', 'pdf']).default('json');

const ReportOptionsQuerySchema = z.object({
  format: ReportFormatSchema.optional(),
  asOfDate: z.string().datetime().optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
  title: z.string().optional(),
  includeDetails: z.coerce.boolean().optional().default(true),
});

const DeadlineCalendarQuerySchema = ReportOptionsQuerySchema.extend({
  daysAhead: z.coerce.number().int().min(1).max(365).optional().default(90),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Reports API routes plugin.
 */
export const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  // Create service instance - db is decorated on the fastify instance
  const getService = (): ReportGeneratorService => {
    return createReportGeneratorService((fastify as any).db);
  };

  // ============================================================================
  // PORTFOLIO SUMMARY
  // ============================================================================

  /**
   * Generate portfolio summary report.
   *
   * Includes:
   * - Executive summary
   * - IP asset inventory by type
   * - Asset status breakdown
   * - Deadline calendar (upcoming 90 days)
   * - Compliance status
   * - Valuation summary
   * - Enforcement matters summary
   */
  fastify.get('/portfolio-summary', {
    schema: {
      tags: ['reports'],
      summary: 'Generate portfolio summary report',
      description: 'Generates a comprehensive portfolio summary report with executive summary, asset inventory, deadlines, compliance status, valuations, and enforcement matters.',
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['json', 'html', 'pdf'], default: 'json' },
          asOfDate: { type: 'string', format: 'date-time' },
          title: { type: 'string' },
          includeArchived: { type: 'boolean', default: false },
          includeDetails: { type: 'boolean', default: true },
        },
      },
    },
  }, async (request, reply) => {
    const query = ReportOptionsQuerySchema.parse(request.query);
    const service = getService();

    const options: ReportGenerationOptions = {
      format: (query.format ?? 'json') as ReportFormat,
      asOfDate: query.asOfDate ? new Date(query.asOfDate) : undefined,
      includeArchived: query.includeArchived,
      customTitle: query.title,
      includeDetails: query.includeDetails,
    };

    const report = await service.generatePortfolioSummary(options);

    return sendReport(reply, report);
  });

  // ============================================================================
  // COMPLIANCE REPORT
  // ============================================================================

  /**
   * Generate compliance status report.
   *
   * Includes:
   * - Overall compliance score
   * - Compliance by category
   * - Compliance by jurisdiction
   * - Critical issues
   * - Upcoming deadlines
   * - Historical trend
   */
  fastify.get('/compliance', {
    schema: {
      tags: ['reports'],
      summary: 'Generate compliance status report',
      description: 'Generates a detailed compliance status report with scores, breakdowns, critical issues, and trends.',
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['json', 'html', 'pdf'], default: 'json' },
          asOfDate: { type: 'string', format: 'date-time' },
          title: { type: 'string' },
          includeArchived: { type: 'boolean', default: false },
          includeDetails: { type: 'boolean', default: true },
        },
      },
    },
  }, async (request, reply) => {
    const query = ReportOptionsQuerySchema.parse(request.query);
    const service = getService();

    const options: ReportGenerationOptions = {
      format: (query.format ?? 'json') as ReportFormat,
      asOfDate: query.asOfDate ? new Date(query.asOfDate) : undefined,
      includeArchived: query.includeArchived,
      customTitle: query.title,
      includeDetails: query.includeDetails,
    };

    const report = await service.generateComplianceReport(options);

    return sendReport(reply, report);
  });

  // ============================================================================
  // DEADLINE CALENDAR
  // ============================================================================

  /**
   * Generate deadline calendar report.
   *
   * Includes:
   * - Deadline statistics
   * - Calendar view by month
   * - Overdue deadlines
   * - Critical deadlines
   * - All deadlines in period
   */
  fastify.get('/deadline-calendar', {
    schema: {
      tags: ['reports'],
      summary: 'Generate deadline calendar report',
      description: 'Generates a deadline calendar report with statistics, calendar view, and deadline lists.',
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['json', 'html', 'pdf'], default: 'json' },
          daysAhead: { type: 'integer', minimum: 1, maximum: 365, default: 90 },
          title: { type: 'string' },
          includeArchived: { type: 'boolean', default: false },
          includeDetails: { type: 'boolean', default: true },
        },
      },
    },
  }, async (request, reply) => {
    const query = DeadlineCalendarQuerySchema.parse(request.query);
    const service = getService();

    const options: ReportGenerationOptions = {
      format: (query.format ?? 'json') as ReportFormat,
      asOfDate: query.asOfDate ? new Date(query.asOfDate) : undefined,
      includeArchived: query.includeArchived,
      customTitle: query.title,
      includeDetails: query.includeDetails,
    };

    const report = await service.generateDeadlineCalendar(query.daysAhead, options);

    return sendReport(reply, report);
  });

  // ============================================================================
  // VALUATION REPORT
  // ============================================================================

  /**
   * Generate valuation summary report.
   *
   * Includes:
   * - Portfolio valuation summary
   * - Valuations by methodology
   * - Valuations by purpose
   * - Valuations by status
   * - Recent valuations
   * - Expired valuations needing refresh
   */
  fastify.get('/valuations', {
    schema: {
      tags: ['reports'],
      summary: 'Generate valuation summary report',
      description: 'Generates an IP valuation summary report with portfolio totals, methodology analysis, and valuation details.',
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['json', 'html', 'pdf'], default: 'json' },
          asOfDate: { type: 'string', format: 'date-time' },
          title: { type: 'string' },
          includeArchived: { type: 'boolean', default: false },
          includeDetails: { type: 'boolean', default: true },
        },
      },
    },
  }, async (request, reply) => {
    const query = ReportOptionsQuerySchema.parse(request.query);
    const service = getService();

    const options: ReportGenerationOptions = {
      format: (query.format ?? 'json') as ReportFormat,
      asOfDate: query.asOfDate ? new Date(query.asOfDate) : undefined,
      includeArchived: query.includeArchived,
      customTitle: query.title,
      includeDetails: query.includeDetails,
    };

    const report = await service.generateValuationReport(options);

    return sendReport(reply, report);
  });
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Send report with appropriate content type and headers.
 */
function sendReport<T>(
  reply: any,
  report: { data: T; format: string; content?: string | Buffer; contentType: string; filename: string }
) {
  // Set content type
  reply.header('Content-Type', report.contentType);

  // Set download headers for non-JSON formats
  if (report.format !== 'json') {
    reply.header('Content-Disposition', `attachment; filename="${report.filename}"`);
  }

  // Return content based on format
  if (report.format === 'json') {
    return reply.send(report.data);
  } else {
    return reply.send(report.content);
  }
}

export default reportsRoutes;
