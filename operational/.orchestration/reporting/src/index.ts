/**
 * @ecosystem/operational-reporting
 * Cross-operational reporting service
 */

export * from './types.js';
export { ReportGenerator } from './generator.js';

// ============================================================================
// Main Entry Point
// ============================================================================

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { pino } from 'pino';
import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import { ReportGenerator } from './generator.js';
import type {
  ReportDefinition,
  ReportExecution,
  ReportFormat,
  ReportStatus,
  ScheduleConfig,
  ScheduledReport,
  OperationalDomain,
} from './types.js';

const logger = pino({ name: 'reporting-service' });

// In-memory stores (replace with database in production)
const reportDefinitions = new Map<string, ReportDefinition>();
const reportExecutions = new Map<string, ReportExecution>();
const scheduledReports = new Map<string, ScheduledReport>();
const cronJobs = new Map<string, cron.ScheduledTask>();

async function loadReportDefinitions(definitionsDir: string): Promise<void> {
  try {
    const files = await readdir(definitionsDir);
    for (const file of files) {
      if (extname(file) === '.yaml' || extname(file) === '.yml') {
        const content = await readFile(join(definitionsDir, file), 'utf-8');
        const definition = parseYaml(content) as ReportDefinition;
        reportDefinitions.set(definition.id, definition);
        logger.info({ reportId: definition.id, name: definition.name }, 'Loaded report definition');
      }
    }
  } catch (error) {
    logger.warn({ definitionsDir, error }, 'Could not load report definitions');
  }
}

async function loadSchedules(schedulesDir: string, generator: ReportGenerator): Promise<void> {
  try {
    const files = await readdir(schedulesDir);
    for (const file of files) {
      if (extname(file) === '.yaml' || extname(file) === '.yml') {
        const content = await readFile(join(schedulesDir, file), 'utf-8');
        const data = parseYaml(content) as { schedules: ScheduleConfig[] };
        
        for (const config of data.schedules || []) {
          const id = uuidv4();
          const scheduled: ScheduledReport = {
            id,
            config,
            nextRun: getNextCronRun(config.cron),
          };
          scheduledReports.set(id, scheduled);

          if (config.enabled !== false) {
            const job = cron.schedule(config.cron, async () => {
              await runScheduledReport(scheduled, generator);
            });
            cronJobs.set(id, job);
            logger.info({ scheduleId: id, report: config.report, cron: config.cron }, 'Scheduled report');
          }
        }
      }
    }
  } catch (error) {
    logger.warn({ schedulesDir, error }, 'Could not load schedules');
  }
}

function getNextCronRun(cronExpr: string): Date {
  // Simple approximation - in production use a proper cron parser
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

async function runScheduledReport(scheduled: ScheduledReport, generator: ReportGenerator): Promise<void> {
  const { config } = scheduled;
  const definition = reportDefinitions.get(config.report);
  
  if (!definition) {
    logger.error({ report: config.report }, 'Report definition not found for scheduled report');
    return;
  }

  const executionId = uuidv4();
  const execution: ReportExecution = {
    id: executionId,
    reportId: definition.id,
    reportName: definition.name,
    status: 'generating',
    format: config.format || 'json',
    parameters: config.parameters,
    requestedAt: new Date(),
    startedAt: new Date(),
  };
  reportExecutions.set(executionId, execution);

  try {
    const data = await generator.generate(definition, config.parameters);
    
    // Save output
    const outputDir = process.env.OUTPUT_DIR || '/tmp/reports';
    await mkdir(outputDir, { recursive: true });
    const outputPath = join(outputDir, executionId + '.' + config.format);
    await writeFile(outputPath, JSON.stringify(data, null, 2));

    execution.status = 'completed';
    execution.completedAt = new Date();
    execution.outputPath = outputPath;

    scheduled.lastRun = new Date();
    scheduled.lastStatus = 'completed';
    scheduled.nextRun = getNextCronRun(config.cron);

    logger.info({ executionId, reportId: definition.id }, 'Scheduled report completed');

    // TODO: Handle distribution (email, slack, webhook)

  } catch (error) {
    execution.status = 'failed';
    execution.error = (error as Error).message;
    scheduled.lastStatus = 'failed';
    logger.error({ executionId, error }, 'Scheduled report failed');
  }
}

async function main() {
  const definitionsDir = process.env.DEFINITIONS_DIR || join(process.cwd(), 'definitions');
  const schedulesDir = process.env.SCHEDULES_DIR || join(process.cwd(), 'schedules');
  const outputDir = process.env.OUTPUT_DIR || '/tmp/reports';

  await mkdir(outputDir, { recursive: true });

  const generator = new ReportGenerator({
    'contracts-legal': process.env.CONTRACTS_LEGAL_URL || 'http://localhost:3011',
    'insurance': process.env.INSURANCE_URL || 'http://localhost:3013',
    'intellectual-property': process.env.IP_URL || 'http://localhost:3014',
    'data-privacy': process.env.DATA_PRIVACY_URL || 'http://localhost:3012',
  });

  await loadReportDefinitions(definitionsDir);
  await loadSchedules(schedulesDir, generator);

  const app = new Hono();
  app.use('*', cors());
  app.use('*', honoLogger());

  // Health check
  app.get('/health', (c) => c.json({
    status: 'healthy',
    service: 'operational-reporting',
    timestamp: new Date().toISOString(),
    reportCount: reportDefinitions.size,
    scheduledCount: scheduledReports.size,
  }));

  // List available reports
  app.get('/reports', (c) => {
    const reports = Array.from(reportDefinitions.values()).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      parameters: r.parameters,
      formats: r.formats,
    }));
    return c.json({ reports });
  });

  // Get report definition
  app.get('/reports/:reportId', (c) => {
    const reportId = c.req.param('reportId');
    const definition = reportDefinitions.get(reportId);
    if (!definition) {
      return c.json({ error: 'Report not found' }, 404);
    }
    return c.json(definition);
  });

  // Generate report
  app.post('/reports/generate', async (c) => {
    const body = await c.req.json() as {
      reportId: string;
      parameters: Record<string, unknown>;
      format: ReportFormat;
    };

    const definition = reportDefinitions.get(body.reportId);
    if (!definition) {
      return c.json({ error: 'Report not found' }, 404);
    }

    if (!definition.formats.includes(body.format)) {
      return c.json({ error: 'Unsupported format: ' + body.format }, 400);
    }

    const executionId = uuidv4();
    const execution: ReportExecution = {
      id: executionId,
      reportId: definition.id,
      reportName: definition.name,
      status: 'pending',
      format: body.format,
      parameters: body.parameters,
      requestedAt: new Date(),
    };
    reportExecutions.set(executionId, execution);

    // Generate asynchronously
    setImmediate(async () => {
      execution.status = 'generating';
      execution.startedAt = new Date();

      try {
        const data = await generator.generate(definition, body.parameters);
        
        const outputPath = join(outputDir, executionId + '.' + body.format);
        await writeFile(outputPath, JSON.stringify(data, null, 2));

        execution.status = 'completed';
        execution.completedAt = new Date();
        execution.outputPath = outputPath;

        logger.info({ executionId, reportId: definition.id }, 'Report generated');
      } catch (error) {
        execution.status = 'failed';
        execution.error = (error as Error).message;
        logger.error({ executionId, error }, 'Report generation failed');
      }
    });

    return c.json({
      executionId,
      status: 'pending',
      statusUrl: '/reports/executions/' + executionId,
    }, 202);
  });

  // Get execution status
  app.get('/reports/executions/:executionId', (c) => {
    const executionId = c.req.param('executionId');
    const execution = reportExecutions.get(executionId);
    if (!execution) {
      return c.json({ error: 'Execution not found' }, 404);
    }
    return c.json(execution);
  });

  // Download report
  app.get('/reports/executions/:executionId/download', async (c) => {
    const executionId = c.req.param('executionId');
    const execution = reportExecutions.get(executionId);
    
    if (!execution) {
      return c.json({ error: 'Execution not found' }, 404);
    }
    
    if (execution.status !== 'completed' || !execution.outputPath) {
      return c.json({ error: 'Report not ready', status: execution.status }, 400);
    }

    const content = await readFile(execution.outputPath, 'utf-8');
    const contentType = execution.format === 'json' ? 'application/json' : 'application/octet-stream';
    
    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'attachment; filename="' + execution.reportId + '-' + executionId + '.' + execution.format + '"',
      },
    });
  });

  // List executions
  app.get('/reports/executions', (c) => {
    const reportId = c.req.query('reportId');
    const status = c.req.query('status') as ReportStatus | undefined;
    const limit = parseInt(c.req.query('limit') || '50', 10);

    let executions = Array.from(reportExecutions.values());
    
    if (reportId) {
      executions = executions.filter((e) => e.reportId === reportId);
    }
    if (status) {
      executions = executions.filter((e) => e.status === status);
    }

    executions.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
    executions = executions.slice(0, limit);

    return c.json({ executions });
  });

  // List scheduled reports
  app.get('/schedules', (c) => {
    const schedules = Array.from(scheduledReports.values()).map((s) => ({
      id: s.id,
      report: s.config.report,
      cron: s.config.cron,
      format: s.config.format,
      enabled: s.config.enabled !== false,
      lastRun: s.lastRun,
      lastStatus: s.lastStatus,
      nextRun: s.nextRun,
    }));
    return c.json({ schedules });
  });

  // Reload definitions
  app.post('/reload', async (c) => {
    reportDefinitions.clear();
    await loadReportDefinitions(definitionsDir);
    return c.json({ 
      message: 'Definitions reloaded',
      reportCount: reportDefinitions.size,
    });
  });

  const port = parseInt(process.env.PORT || '3023', 10);

  serve({ fetch: app.fetch, port }, (info) => {
    logger.info({ port: info.port }, 'Reporting service started');
    logger.info({
      endpoints: {
        listReports: 'GET /reports',
        generateReport: 'POST /reports/generate',
        executionStatus: 'GET /reports/executions/:id',
        downloadReport: 'GET /reports/executions/:id/download',
        schedules: 'GET /schedules',
      },
    }, 'Available endpoints');
  });
}

if (import.meta.url === 'file://' + process.argv[1]) {
  main().catch((error) => {
    logger.error({ error }, 'Failed to start reporting service');
    process.exit(1);
  });
}
