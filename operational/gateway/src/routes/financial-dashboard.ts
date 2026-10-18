/**
 * Financial Dashboard Routes
 *
 * Aggregates financial data from Accounting, Banking-Treasury, and Tax services
 * to provide unified financial intelligence and dashboards.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import pino from 'pino';

const logger = pino({ name: 'operational-gateway-financial' });

// =============================================================================
// Types
// =============================================================================

export interface FinancialOverview {
  entityId: string;
  period: string;
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    cashPosition: number;
    accountsReceivable: number;
    accountsPayable: number;
    currency: string;
  };
  ratios: {
    currentRatio: number | null;
    quickRatio: number | null;
    debtToEquity: number | null;
    grossMargin: number | null;
    netMargin: number | null;
  };
  trends: {
    revenueGrowth: number | null;
    expenseGrowth: number | null;
    cashFlowTrend: 'positive' | 'negative' | 'stable';
  };
  compliance: {
    filingsDue: number;
    filingsOverdue: number;
    taxObligations: Array<{
      type: string;
      amount: number;
      dueDate: string;
      status: string;
    }>;
  };
  lastUpdated: Date;
}

export interface CashFlowForecast {
  entityId: string;
  forecastPeriod: string;
  projections: Array<{
    date: string;
    projectedInflows: number;
    projectedOutflows: number;
    projectedBalance: number;
    confidence: number;
  }>;
  assumptions: string[];
  warnings: string[];
}

export interface ReconciliationStatus {
  entityId: string;
  accounts: Array<{
    accountId: string;
    accountName: string;
    lastReconciled: string | null;
    status: 'current' | 'pending' | 'overdue';
    difference: number;
    currency: string;
  }>;
  summary: {
    totalAccounts: number;
    reconciled: number;
    pending: number;
    overdue: number;
    totalDifference: number;
  };
}

// =============================================================================
// Service Clients Configuration
// =============================================================================

interface ServiceClients {
  accountingUrl: string;
  bankingUrl: string;
  taxUrl: string;
  complianceUrl: string;
  timeout: number;
}

const defaultClients: ServiceClients = {
  accountingUrl: process.env.ACCOUNTING_URL || 'http://localhost:3002',
  bankingUrl: process.env.BANKING_URL || 'http://localhost:3003',
  taxUrl: process.env.TAX_URL || 'http://localhost:3006',
  complianceUrl: process.env.COMPLIANCE_URL || 'http://localhost:3007',
  timeout: 10000,
};

// =============================================================================
// Helper Functions
// =============================================================================

async function fetchWithTimeout(
  url: string,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchAccountingData(
  entityId: string,
  clients: ServiceClients
): Promise<{
  trialBalance?: any;
  balanceSheet?: any;
  incomeStatement?: any;
}> {
  const results: any = {};

  try {
    // Fetch trial balance
    const tbResponse = await fetchWithTimeout(
      `${clients.accountingUrl}/api/v1/reports/trial-balance?entity_id=${entityId}`,
      clients.timeout
    );
    if (tbResponse.ok) {
      results.trialBalance = await tbResponse.json();
    }
  } catch (error) {
    logger.warn({ entityId, error }, 'Failed to fetch trial balance');
  }

  try {
    // Fetch balance sheet
    const bsResponse = await fetchWithTimeout(
      `${clients.accountingUrl}/api/v1/reports/balance-sheet?entity_id=${entityId}`,
      clients.timeout
    );
    if (bsResponse.ok) {
      results.balanceSheet = await bsResponse.json();
    }
  } catch (error) {
    logger.warn({ entityId, error }, 'Failed to fetch balance sheet');
  }

  try {
    // Fetch income statement
    const isResponse = await fetchWithTimeout(
      `${clients.accountingUrl}/api/v1/reports/income-statement?entity_id=${entityId}`,
      clients.timeout
    );
    if (isResponse.ok) {
      results.incomeStatement = await isResponse.json();
    }
  } catch (error) {
    logger.warn({ entityId, error }, 'Failed to fetch income statement');
  }

  return results;
}

async function fetchBankingData(
  entityId: string,
  clients: ServiceClients
): Promise<{
  cashPosition?: any;
  forecast?: any;
  accounts?: any[];
}> {
  const results: any = {};

  try {
    const positionResponse = await fetchWithTimeout(
      `${clients.bankingUrl}/api/v1/entities/${entityId}/cash-position`,
      clients.timeout
    );
    if (positionResponse.ok) {
      results.cashPosition = await positionResponse.json();
    }
  } catch (error) {
    logger.warn({ entityId, error }, 'Failed to fetch cash position');
  }

  try {
    const forecastResponse = await fetchWithTimeout(
      `${clients.bankingUrl}/api/v1/entities/${entityId}/forecast`,
      clients.timeout
    );
    if (forecastResponse.ok) {
      results.forecast = await forecastResponse.json();
    }
  } catch (error) {
    logger.warn({ entityId, error }, 'Failed to fetch cash forecast');
  }

  return results;
}

async function fetchTaxData(
  entityId: string,
  clients: ServiceClients
): Promise<{
  obligations?: any[];
  filings?: any[];
}> {
  const results: any = {};

  try {
    const obligationsResponse = await fetchWithTimeout(
      `${clients.taxUrl}/api/v1/entities/${entityId}/obligations`,
      clients.timeout
    );
    if (obligationsResponse.ok) {
      results.obligations = await obligationsResponse.json();
    }
  } catch (error) {
    logger.warn({ entityId, error }, 'Failed to fetch tax obligations');
  }

  return results;
}

async function fetchComplianceData(
  entityId: string,
  clients: ServiceClients
): Promise<{
  dashboard?: any;
  upcomingDeadlines?: any[];
}> {
  const results: any = {};

  try {
    const dashboardResponse = await fetchWithTimeout(
      `${clients.complianceUrl}/api/v1/entities/${entityId}/dashboard`,
      clients.timeout
    );
    if (dashboardResponse.ok) {
      results.dashboard = await dashboardResponse.json();
    }
  } catch (error) {
    logger.warn({ entityId, error }, 'Failed to fetch compliance dashboard');
  }

  return results;
}

// =============================================================================
// Routes
// =============================================================================

export function createFinancialDashboardRoutes(
  clients: Partial<ServiceClients> = {}
) {
  const router = new Hono();
  const config = { ...defaultClients, ...clients };

  /**
   * GET /financial/overview/:entityId
   * Comprehensive financial overview for an entity
   */
  router.get(
    '/overview/:entityId',
    zValidator(
      'query',
      z.object({
        period: z.string().optional().default('current'),
        currency: z.string().optional().default('USD'),
      })
    ),
    async (c) => {
      const entityId = c.req.param('entityId');
      const { period, currency } = c.req.valid('query');

      logger.info({ entityId, period }, 'Fetching financial overview');

      // Fetch data from all services in parallel
      const [accountingData, bankingData, taxData, complianceData] = await Promise.all([
        fetchAccountingData(entityId, config),
        fetchBankingData(entityId, config),
        fetchTaxData(entityId, config),
        fetchComplianceData(entityId, config),
      ]);

      // Build financial overview
      const overview: FinancialOverview = {
        entityId,
        period,
        summary: {
          totalRevenue: accountingData.incomeStatement?.totalRevenue || 0,
          totalExpenses: accountingData.incomeStatement?.totalExpenses || 0,
          netIncome: accountingData.incomeStatement?.netIncome || 0,
          cashPosition: bankingData.cashPosition?.totalBalance || 0,
          accountsReceivable: accountingData.balanceSheet?.accountsReceivable || 0,
          accountsPayable: accountingData.balanceSheet?.accountsPayable || 0,
          currency,
        },
        ratios: {
          currentRatio: accountingData.balanceSheet?.ratios?.currentRatio || null,
          quickRatio: accountingData.balanceSheet?.ratios?.quickRatio || null,
          debtToEquity: accountingData.balanceSheet?.ratios?.debtToEquity || null,
          grossMargin: accountingData.incomeStatement?.grossMargin || null,
          netMargin: accountingData.incomeStatement?.netMargin || null,
        },
        trends: {
          revenueGrowth: null, // Would calculate from historical data
          expenseGrowth: null,
          cashFlowTrend: bankingData.cashPosition?.trend || 'stable',
        },
        compliance: {
          filingsDue: complianceData.dashboard?.upcomingDeadlines || 0,
          filingsOverdue: complianceData.dashboard?.overdueCount || 0,
          taxObligations: (taxData.obligations || []).map((o: any) => ({
            type: o.taxType,
            amount: o.amount,
            dueDate: o.dueDate,
            status: o.status,
          })),
        },
        lastUpdated: new Date(),
      };

      return c.json(overview);
    }
  );

  /**
   * GET /financial/cash-forecast/:entityId
   * Cash flow forecast for an entity
   */
  router.get(
    '/cash-forecast/:entityId',
    zValidator(
      'query',
      z.object({
        days: z.coerce.number().int().min(7).max(365).optional().default(30),
      })
    ),
    async (c) => {
      const entityId = c.req.param('entityId');
      const { days } = c.req.valid('query');

      logger.info({ entityId, days }, 'Fetching cash forecast');

      const bankingData = await fetchBankingData(entityId, config);

      const forecast: CashFlowForecast = {
        entityId,
        forecastPeriod: `${days} days`,
        projections: bankingData.forecast?.projections || [],
        assumptions: bankingData.forecast?.assumptions || [
          'Based on historical patterns',
          'Excludes one-time transactions',
        ],
        warnings: bankingData.forecast?.warnings || [],
      };

      return c.json(forecast);
    }
  );

  /**
   * GET /financial/reconciliation/:entityId
   * Bank reconciliation status for an entity
   */
  router.get('/reconciliation/:entityId', async (c) => {
    const entityId = c.req.param('entityId');

    logger.info({ entityId }, 'Fetching reconciliation status');

    // Fetch from banking service
    let accounts: any[] = [];
    try {
      const response = await fetchWithTimeout(
        `${config.bankingUrl}/api/v1/entities/${entityId}/accounts`,
        config.timeout
      );
      if (response.ok) {
        accounts = (await response.json())?.accounts || [];
      }
    } catch (error) {
      logger.warn({ entityId, error }, 'Failed to fetch bank accounts');
    }

    // Build reconciliation status
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const accountStatuses = accounts.map((account: any) => {
      const lastReconciled = account.lastReconciledDate
        ? new Date(account.lastReconciledDate)
        : null;

      let status: 'current' | 'pending' | 'overdue' = 'pending';
      if (lastReconciled) {
        if (lastReconciled > thirtyDaysAgo) {
          status = 'current';
        } else {
          status = 'overdue';
        }
      }

      return {
        accountId: account.id,
        accountName: account.name,
        lastReconciled: lastReconciled?.toISOString() || null,
        status,
        difference: account.unreconciledDifference || 0,
        currency: account.currency || 'USD',
      };
    });

    const reconciliationStatus: ReconciliationStatus = {
      entityId,
      accounts: accountStatuses,
      summary: {
        totalAccounts: accountStatuses.length,
        reconciled: accountStatuses.filter((a) => a.status === 'current').length,
        pending: accountStatuses.filter((a) => a.status === 'pending').length,
        overdue: accountStatuses.filter((a) => a.status === 'overdue').length,
        totalDifference: accountStatuses.reduce((sum, a) => sum + Math.abs(a.difference), 0),
      },
    };

    return c.json(reconciliationStatus);
  });

  /**
   * GET /financial/key-metrics/:entityId
   * Key financial metrics for dashboards
   */
  router.get(
    '/key-metrics/:entityId',
    zValidator(
      'query',
      z.object({
        compareWith: z.enum(['prior_period', 'prior_year', 'budget']).optional(),
      })
    ),
    async (c) => {
      const entityId = c.req.param('entityId');
      const { compareWith } = c.req.valid('query');

      logger.info({ entityId, compareWith }, 'Fetching key metrics');

      const [accountingData, bankingData] = await Promise.all([
        fetchAccountingData(entityId, config),
        fetchBankingData(entityId, config),
      ]);

      const metrics = {
        entityId,
        period: 'current',
        metrics: [
          {
            name: 'Net Income',
            value: accountingData.incomeStatement?.netIncome || 0,
            format: 'currency',
            trend: null,
            comparison: null,
          },
          {
            name: 'Cash Position',
            value: bankingData.cashPosition?.totalBalance || 0,
            format: 'currency',
            trend: bankingData.cashPosition?.trend || null,
            comparison: null,
          },
          {
            name: 'Gross Margin',
            value: accountingData.incomeStatement?.grossMargin || 0,
            format: 'percentage',
            trend: null,
            comparison: null,
          },
          {
            name: 'Current Ratio',
            value: accountingData.balanceSheet?.ratios?.currentRatio || 0,
            format: 'ratio',
            trend: null,
            comparison: null,
          },
          {
            name: 'Days Sales Outstanding',
            value: accountingData.balanceSheet?.ratios?.dso || 0,
            format: 'days',
            trend: null,
            comparison: null,
          },
          {
            name: 'Days Payable Outstanding',
            value: accountingData.balanceSheet?.ratios?.dpo || 0,
            format: 'days',
            trend: null,
            comparison: null,
          },
        ],
        lastUpdated: new Date().toISOString(),
      };

      return c.json(metrics);
    }
  );

  /**
   * GET /financial/alerts/:entityId
   * Financial alerts and warnings
   */
  router.get('/alerts/:entityId', async (c) => {
    const entityId = c.req.param('entityId');

    logger.info({ entityId }, 'Fetching financial alerts');

    const [bankingData, complianceData] = await Promise.all([
      fetchBankingData(entityId, config),
      fetchComplianceData(entityId, config),
    ]);

    const alerts: Array<{
      type: string;
      severity: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      action?: string;
      dueDate?: string;
    }> = [];

    // Cash position alerts
    if (bankingData.cashPosition?.totalBalance < 0) {
      alerts.push({
        type: 'cash',
        severity: 'critical',
        title: 'Negative Cash Position',
        description: 'Total cash position is negative. Immediate action required.',
        action: 'Review cash flow and arrange financing',
      });
    } else if (bankingData.cashPosition?.belowMinimum) {
      alerts.push({
        type: 'cash',
        severity: 'warning',
        title: 'Cash Below Minimum Threshold',
        description: 'Cash position is below the configured minimum threshold.',
        action: 'Monitor closely and prepare contingency',
      });
    }

    // Compliance alerts
    if (complianceData.dashboard?.overdueCount > 0) {
      alerts.push({
        type: 'compliance',
        severity: 'critical',
        title: 'Overdue Compliance Filings',
        description: `${complianceData.dashboard.overdueCount} compliance filing(s) are overdue.`,
        action: 'File immediately to avoid penalties',
      });
    }

    // Upcoming deadlines
    const upcomingDeadlines = complianceData.dashboard?.upcomingDeadlines || [];
    for (const deadline of upcomingDeadlines.slice(0, 3)) {
      if (deadline.daysUntilDue <= 7) {
        alerts.push({
          type: 'deadline',
          severity: deadline.daysUntilDue <= 3 ? 'critical' : 'warning',
          title: `Deadline: ${deadline.title}`,
          description: `Due in ${deadline.daysUntilDue} day(s)`,
          dueDate: deadline.dueDate,
          action: deadline.action,
        });
      }
    }

    return c.json({
      entityId,
      alerts,
      summary: {
        critical: alerts.filter((a) => a.severity === 'critical').length,
        warning: alerts.filter((a) => a.severity === 'warning').length,
        info: alerts.filter((a) => a.severity === 'info').length,
      },
      lastChecked: new Date().toISOString(),
    });
  });

  return router;
}
