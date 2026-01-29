/**
 * Base Bank Adapter
 *
 * Abstract base class for bank adapters providing common functionality.
 * Concrete adapters extend this for specific providers.
 */

import type {
  IBankAdapter,
  BankCredentials,
  ConnectionHealthCheck,
  PaymentInstruction,
  PaymentSubmissionResult,
  PaymentStatusUpdate,
  FXQuoteRequest,
  FXExecutionRequest,
} from '../interfaces.js';
import type {
  BankConnection,
  BankConnectionId,
  BankProvider,
  BankCapabilities,
  BalancePosition,
  BankStatement,
  FXQuote,
  FXExecution,
  ConnectionStatus,
} from '../types.js';

/**
 * Abstract base adapter with common functionality.
 */
export abstract class BaseBankAdapter implements IBankAdapter {
  abstract readonly provider: BankProvider;

  protected connections: Map<BankConnectionId, BankConnection> = new Map();

  /**
   * Connect to the bank with credentials.
   */
  abstract connect(credentials: BankCredentials): Promise<BankConnection>;

  /**
   * Disconnect and cleanup.
   */
  async disconnect(connectionId: BankConnectionId): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    await this.onDisconnect(connectionId);
    this.connections.delete(connectionId);
  }

  /**
   * Override in subclass for provider-specific disconnect logic.
   */
  protected async onDisconnect(_connectionId: BankConnectionId): Promise<void> {
    // Default: no-op
  }

  /**
   * Check connection health.
   */
  async checkHealth(connectionId: BankConnectionId): Promise<ConnectionHealthCheck> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return {
        connectionId,
        isHealthy: false,
        latencyMs: 0,
        lastSuccessfulOperation: new Date(0),
        issues: ['Connection not found'],
        checkedAt: new Date(),
      };
    }

    const startTime = Date.now();

    try {
      await this.performHealthCheck(connectionId);
      const latencyMs = Date.now() - startTime;

      return {
        connectionId,
        isHealthy: true,
        latencyMs,
        lastSuccessfulOperation: new Date(),
        issues: [],
        checkedAt: new Date(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      return {
        connectionId,
        isHealthy: false,
        latencyMs,
        lastSuccessfulOperation: connection.lastSuccessfulSync,
        issues: [message],
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Override in subclass for provider-specific health check.
   */
  protected abstract performHealthCheck(connectionId: BankConnectionId): Promise<void>;

  /**
   * Refresh credentials (e.g., OAuth token).
   */
  abstract refreshCredentials(connectionId: BankConnectionId): Promise<void>;

  /**
   * Get capabilities for connection.
   */
  abstract getCapabilities(connectionId: BankConnectionId): Promise<BankCapabilities>;

  /**
   * Get balance for connection.
   */
  abstract getBalance(connectionId: BankConnectionId): Promise<BalancePosition>;

  /**
   * Submit payment.
   */
  abstract submitPayment(
    connectionId: BankConnectionId,
    instruction: PaymentInstruction
  ): Promise<PaymentSubmissionResult>;

  /**
   * Get payment status.
   */
  abstract getPaymentStatus(
    connectionId: BankConnectionId,
    bankReference: string
  ): Promise<PaymentStatusUpdate>;

  /**
   * Get statement.
   */
  abstract getStatement(
    connectionId: BankConnectionId,
    startDate: Date,
    endDate: Date
  ): Promise<BankStatement>;

  /**
   * FX quote (optional - throws if not supported).
   */
  getFXQuote?(
    _connectionId: BankConnectionId,
    _request: FXQuoteRequest
  ): Promise<FXQuote> {
    throw new Error(`FX quotes not supported by ${this.provider}`);
  }

  /**
   * FX execution (optional - throws if not supported).
   */
  executeFX?(
    _connectionId: BankConnectionId,
    _request: FXExecutionRequest
  ): Promise<FXExecution> {
    throw new Error(`FX execution not supported by ${this.provider}`);
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Generate connection ID.
   */
  protected generateConnectionId(bankCode: string, accountId: string): BankConnectionId {
    return `${this.provider}:${bankCode}:${accountId}`;
  }

  /**
   * Update connection status.
   */
  protected updateConnectionStatus(
    connectionId: BankConnectionId,
    status: ConnectionStatus
  ): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.set(connectionId, {
        ...connection,
        status,
      });
    }
  }

  /**
   * Get connection or throw.
   */
  protected getConnectionOrThrow(connectionId: BankConnectionId): BankConnection {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }
    return connection;
  }

  /**
   * Assert capability is available.
   */
  protected assertCapability(
    capabilities: BankCapabilities,
    capability: keyof BankCapabilities,
    operation: string
  ): void {
    if (!capabilities[capability]) {
      throw new Error(`${operation} not supported by this connection`);
    }
  }
}

/**
 * Default capabilities (most conservative).
 */
export const DEFAULT_CAPABILITIES: BankCapabilities = {
  realTimeBalance: false,
  webhookNotifications: false,
  transactionHistory: true,
  paymentInitiation: false,
  sameDayPayments: false,
  realTimePayments: false,
  internationalWires: false,
  fxConversion: false,
  virtualAccounts: false,
  statements: true,
  paymentRecall: false,
  trackingIds: false,
};

/**
 * Default rate limits (conservative).
 */
export const DEFAULT_RATE_LIMITS = {
  balanceRequestsPerMinute: 10,
  transactionRequestsPerMinute: 5,
  paymentsPerHour: 100,
  maxConcurrentConnections: 5,
};
