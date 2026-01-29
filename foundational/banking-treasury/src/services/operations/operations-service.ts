/**
 * Operations Service
 *
 * Operational queries, status tracking, and administrative functions.
 *
 * @module services/operations
 */

import type { Money } from '../../types/financial.js';
import type {
  TransactionInquiry,
  TransactionInquiryResult,
  TransactionSummary,
  BalanceInquiry,
  BalanceInquiryResult,
  AccountBalanceSummary,
  StatementRequest,
  StatementResult,
  OperationalDashboard,
  PaymentStatistics,
  PaymentMetrics,
  SystemStatus,
  ComponentStatus,
  HealthStatus,
  PendingAction,
  OperationalAlert,
  AuditLogEntry,
  AuditLogQuery,
  AuditLogResult,
  AuditAction,
  ReportRequest,
  ReportResult,
} from './types.js';

/**
 * Transaction repository interface.
 */
export interface ITransactionRepository {
  query(inquiry: TransactionInquiry): Promise<TransactionSummary[]>;
  count(inquiry: TransactionInquiry): Promise<number>;
  getById(transactionId: string): Promise<TransactionSummary | null>;
}

/**
 * Balance repository interface.
 */
export interface IBalanceRepository {
  getBalances(entityId: string, accountIds?: string[]): Promise<AccountBalanceSummary[]>;
  getHistoricalBalance(accountId: string, asOfDate: Date): Promise<AccountBalanceSummary | null>;
}

/**
 * Statement generator interface.
 */
export interface IStatementGenerator {
  generate(request: StatementRequest): Promise<StatementResult>;
  getStatus(requestId: string): Promise<StatementResult>;
}

/**
 * Audit log repository interface.
 */
export interface IAuditLogRepository {
  log(entry: Omit<AuditLogEntry, 'entryId' | 'timestamp'>): Promise<void>;
  query(query: AuditLogQuery): Promise<AuditLogEntry[]>;
  count(query: AuditLogQuery): Promise<number>;
}

/**
 * Operations Service
 *
 * Provides comprehensive operational capabilities:
 * - Transaction and balance inquiries
 * - Statement generation
 * - Operational dashboards
 * - Audit logging
 * - System health monitoring
 */
export class OperationsService {
  private readonly transactionRepo: ITransactionRepository;
  private readonly balanceRepo: IBalanceRepository;
  private readonly statementGenerator: IStatementGenerator;
  private readonly auditRepo: IAuditLogRepository;
  private readonly pendingActions: Map<string, PendingAction[]> = new Map();
  private readonly alertHistory: OperationalAlert[] = [];
  private readonly componentStatuses: Map<string, ComponentStatus> = new Map();

  constructor(
    transactionRepo: ITransactionRepository,
    balanceRepo: IBalanceRepository,
    statementGenerator: IStatementGenerator,
    auditRepo: IAuditLogRepository
  ) {
    this.transactionRepo = transactionRepo;
    this.balanceRepo = balanceRepo;
    this.statementGenerator = statementGenerator;
    this.auditRepo = auditRepo;
    this.initializeComponentStatuses();
  }

  /**
   * Query transactions.
   */
  async queryTransactions(inquiry: TransactionInquiry): Promise<TransactionInquiryResult> {
    const limit = inquiry.limit ?? 50;
    const transactions = await this.transactionRepo.query({
      ...inquiry,
      limit: limit + 1, // Fetch one extra to check hasMore
    });

    const hasMore = transactions.length > limit;
    const resultTransactions = hasMore ? transactions.slice(0, limit) : transactions;
    const totalCount = await this.transactionRepo.count(inquiry);

    await this.logAudit(inquiry.entityId, 'system', 'read', 'transaction_inquiry', inquiry.inquiryId, {
      filters: inquiry,
      resultCount: resultTransactions.length,
    });

    return {
      inquiryId: inquiry.inquiryId,
      transactions: resultTransactions,
      totalCount,
      hasMore,
      executedAt: new Date(),
    };
  }

  /**
   * Get transaction by ID.
   */
  async getTransaction(
    entityId: string,
    transactionId: string
  ): Promise<TransactionSummary | null> {
    const transaction = await this.transactionRepo.getById(transactionId);

    await this.logAudit(entityId, 'system', 'read', 'transaction', transactionId, {
      found: transaction !== null,
    });

    return transaction;
  }

  /**
   * Query balances.
   */
  async queryBalances(inquiry: BalanceInquiry): Promise<BalanceInquiryResult> {
    let balances: AccountBalanceSummary[];

    if (inquiry.asOfDate) {
      // Historical balance query
      const accountIds = inquiry.accountIds ?? [];
      const historicalBalances: AccountBalanceSummary[] = [];

      for (const accountId of accountIds) {
        const balance = await this.balanceRepo.getHistoricalBalance(
          accountId,
          inquiry.asOfDate
        );
        if (balance) {
          historicalBalances.push(balance);
        }
      }
      balances = historicalBalances;
    } else {
      // Current balance query
      balances = await this.balanceRepo.getBalances(
        inquiry.entityId,
        inquiry.accountIds
      );
    }

    // Filter by currency if specified
    if (inquiry.currencies && inquiry.currencies.length > 0) {
      balances = balances.filter(b => inquiry.currencies!.includes(b.currency));
    }

    // Calculate totals by currency
    const totalByCurrency = new Map<string, Money>();
    for (const balance of balances) {
      const existing = totalByCurrency.get(balance.currency);
      totalByCurrency.set(balance.currency, {
        amount: (existing?.amount ?? 0) + balance.availableBalance.amount,
        currency: balance.currency,
      });
    }

    await this.logAudit(inquiry.entityId, 'system', 'read', 'balance_inquiry', inquiry.inquiryId, {
      accountCount: balances.length,
      currencies: Array.from(totalByCurrency.keys()),
    });

    return {
      inquiryId: inquiry.inquiryId,
      balances,
      totalByurrency: totalByCurrency,
      asOfDate: inquiry.asOfDate ?? new Date(),
      executedAt: new Date(),
    };
  }

  /**
   * Request statement generation.
   */
  async requestStatement(request: StatementRequest): Promise<StatementResult> {
    const result = await this.statementGenerator.generate(request);

    await this.logAudit(request.entityId, 'system', 'create', 'statement', request.requestId, {
      accountId: request.accountId,
      format: request.format,
      periodStart: request.periodStart,
      periodEnd: request.periodEnd,
    });

    return result;
  }

  /**
   * Get statement status.
   */
  async getStatementStatus(requestId: string): Promise<StatementResult> {
    return this.statementGenerator.getStatus(requestId);
  }

  /**
   * Get operational dashboard.
   */
  async getDashboard(entityId: string): Promise<OperationalDashboard> {
    const [paymentStats, pendingActions, recentAlerts] = await Promise.all([
      this.getPaymentStatistics(entityId),
      this.getPendingActions(entityId),
      this.getRecentAlerts(entityId),
    ]);

    const systemStatus = this.getSystemStatus();

    return {
      entityId,
      asOfDate: new Date(),
      paymentStats,
      systemStatus,
      pendingActions,
      recentAlerts,
    };
  }

  /**
   * Get payment statistics.
   */
  private async getPaymentStatistics(entityId: string): Promise<PaymentStatistics> {
    const now = new Date();

    // Today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // This week (Monday start)
    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - daysToMonday);
    weekStart.setHours(0, 0, 0, 0);

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayTx, weekTx, monthTx] = await Promise.all([
      this.transactionRepo.query({
        inquiryId: 'stats-today',
        entityId,
        dateRange: { from: todayStart, to: now },
      }),
      this.transactionRepo.query({
        inquiryId: 'stats-week',
        entityId,
        dateRange: { from: weekStart, to: now },
      }),
      this.transactionRepo.query({
        inquiryId: 'stats-month',
        entityId,
        dateRange: { from: monthStart, to: now },
      }),
    ]);

    return {
      today: this.calculateMetrics(todayTx),
      thisWeek: this.calculateMetrics(weekTx),
      thisMonth: this.calculateMetrics(monthTx),
    };
  }

  /**
   * Calculate metrics from transactions.
   */
  private calculateMetrics(transactions: TransactionSummary[]): PaymentMetrics {
    let totalInbound = 0;
    let totalOutbound = 0;
    let countInbound = 0;
    let countOutbound = 0;
    let successCount = 0;
    let totalProcessingTime = 0;
    let processedCount = 0;

    for (const tx of transactions) {
      if (tx.type === 'inbound') {
        totalInbound += tx.amount.amount;
        countInbound++;
      } else if (tx.type === 'outbound') {
        totalOutbound += tx.amount.amount;
        countOutbound++;
      }

      if (tx.status === 'completed') {
        successCount++;
      }

      if (tx.completedAt && tx.initiatedAt) {
        totalProcessingTime += tx.completedAt.getTime() - tx.initiatedAt.getTime();
        processedCount++;
      }
    }

    const totalCount = transactions.length;

    return {
      totalInbound: { amount: totalInbound, currency: 'USD' },
      totalOutbound: { amount: totalOutbound, currency: 'USD' },
      countInbound,
      countOutbound,
      successRate: totalCount > 0 ? successCount / totalCount : 1.0,
      averageProcessingTimeMs: processedCount > 0 ? totalProcessingTime / processedCount : 0,
    };
  }

  /**
   * Get pending actions for entity.
   */
  async getPendingActions(entityId: string): Promise<PendingAction[]> {
    return this.pendingActions.get(entityId) ?? [];
  }

  /**
   * Add pending action.
   */
  addPendingAction(entityId: string, action: PendingAction): void {
    const existing = this.pendingActions.get(entityId) ?? [];
    existing.push(action);
    this.pendingActions.set(entityId, existing);
  }

  /**
   * Remove pending action.
   */
  removePendingAction(entityId: string, actionId: string): void {
    const existing = this.pendingActions.get(entityId) ?? [];
    this.pendingActions.set(
      entityId,
      existing.filter(a => a.actionId !== actionId)
    );
  }

  /**
   * Get recent alerts.
   */
  getRecentAlerts(entityId: string, limit: number = 10): OperationalAlert[] {
    return this.alertHistory
      .filter(a => !entityId || a.alertId.includes(entityId))
      .slice(-limit)
      .reverse();
  }

  /**
   * Create operational alert.
   */
  createAlert(alert: Omit<OperationalAlert, 'alertId' | 'occurredAt' | 'acknowledged'>): OperationalAlert {
    const fullAlert: OperationalAlert = {
      ...alert,
      alertId: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      occurredAt: new Date(),
      acknowledged: false,
    };

    this.alertHistory.push(fullAlert);
    return fullAlert;
  }

  /**
   * Acknowledge alert.
   */
  acknowledgeAlert(alertId: string, userId: string): boolean {
    const alert = this.alertHistory.find(a => a.alertId === alertId);
    if (!alert || alert.acknowledged) return false;

    // Create new alert object with acknowledged fields
    const index = this.alertHistory.indexOf(alert);
    this.alertHistory[index] = {
      ...alert,
      acknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    };

    return true;
  }

  /**
   * Get system status.
   */
  getSystemStatus(): SystemStatus {
    const components = Array.from(this.componentStatuses.values());

    let overall: HealthStatus = 'healthy';
    if (components.some(c => c.status === 'unhealthy')) {
      overall = 'unhealthy';
    } else if (components.some(c => c.status === 'degraded')) {
      overall = 'degraded';
    }

    return {
      overall,
      components,
      lastChecked: new Date(),
    };
  }

  /**
   * Update component status.
   */
  updateComponentStatus(
    name: string,
    status: HealthStatus,
    latencyMs?: number,
    error?: string
  ): void {
    const existing = this.componentStatuses.get(name);
    this.componentStatuses.set(name, {
      name,
      status,
      latencyMs,
      lastError: error ?? existing?.lastError,
      lastErrorAt: error ? new Date() : existing?.lastErrorAt,
    });
  }

  /**
   * Query audit log.
   */
  async queryAuditLog(query: AuditLogQuery): Promise<AuditLogResult> {
    const limit = query.limit ?? 100;
    const entries = await this.auditRepo.query({
      ...query,
      limit: limit + 1,
    });

    const hasMore = entries.length > limit;
    const resultEntries = hasMore ? entries.slice(0, limit) : entries;
    const totalCount = await this.auditRepo.count(query);

    return {
      entries: resultEntries,
      totalCount,
      hasMore,
    };
  }

  /**
   * Log audit entry.
   */
  async logAudit(
    entityId: string,
    userId: string,
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    details: Record<string, unknown>,
    outcome: 'success' | 'failure' = 'success',
    failureReason?: string
  ): Promise<void> {
    await this.auditRepo.log({
      userId,
      action,
      resourceType,
      resourceId,
      details: { ...details, entityId },
      outcome,
      failureReason,
    });
  }

  /**
   * Generate report (placeholder for report generation).
   */
  async generateReport(request: ReportRequest): Promise<ReportResult> {
    // In production, this would delegate to a report generation service
    await this.logAudit(request.entityId, 'system', 'create', 'report', request.requestId, {
      reportType: request.reportType,
      format: request.format,
      dateRange: request.dateRange,
    });

    return {
      requestId: request.requestId,
      reportType: request.reportType,
      status: 'generating',
    };
  }

  /**
   * Initialize component statuses.
   */
  private initializeComponentStatuses(): void {
    const components = [
      'payment_gateway',
      'bank_connections',
      'reconciliation_engine',
      'compliance_engine',
      'fx_service',
      'database',
      'cache',
      'message_queue',
    ];

    for (const name of components) {
      this.componentStatuses.set(name, {
        name,
        status: 'healthy',
      });
    }
  }
}
