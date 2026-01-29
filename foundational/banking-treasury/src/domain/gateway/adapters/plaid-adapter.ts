/**
 * Plaid Bank Adapter
 *
 * Adapter for Plaid aggregation API.
 * Provides read-only access to balances and transactions across 11,000+ institutions.
 *
 * @see https://plaid.com/docs/
 */

import type {
  BankCredentials,
  PaymentInstruction,
  PaymentSubmissionResult,
  PaymentStatusUpdate,
} from '../interfaces.js';
import type {
  BankConnection,
  BankConnectionId,
  BankProvider,
  BankCapabilities,
  BalancePosition,
  BalanceFreshness,
  BankStatement,
  BankTransaction,
  PaymentDirection,
} from '../types.js';
import { BaseBankAdapter, DEFAULT_RATE_LIMITS } from './base-adapter.js';

/**
 * Plaid-specific credentials.
 */
interface PlaidCredentials {
  clientId: string;
  secret: string;
  accessToken: string;        // Obtained after Link flow
  institutionId: string;
  accountIds: string[];
}

/**
 * Plaid adapter implementation.
 */
export class PlaidAdapter extends BaseBankAdapter {
  readonly provider: BankProvider = 'plaid';

  private baseUrl: string;

  constructor(environment: 'sandbox' | 'development' | 'production' = 'production') {
    super();
    this.baseUrl = this.getBaseUrl(environment);
  }

  private getBaseUrl(env: string): string {
    switch (env) {
      case 'sandbox':
        return 'https://sandbox.plaid.com';
      case 'development':
        return 'https://development.plaid.com';
      default:
        return 'https://production.plaid.com';
    }
  }

  async connect(credentials: BankCredentials): Promise<BankConnection> {
    const plaidCreds = credentials.credentials as unknown as PlaidCredentials;

    // Validate access token by fetching accounts
    const accounts = await this.fetchAccounts(plaidCreds);

    const firstAccountId = plaidCreds.accountIds[0];
    if (!firstAccountId) {
      throw new Error('No account IDs provided in Plaid credentials');
    }

    const connectionId = this.generateConnectionId(
      plaidCreds.institutionId,
      firstAccountId
    );

    const connection: BankConnection = {
      id: connectionId,
      provider: this.provider,
      bankName: accounts.institution?.name ?? 'Unknown Bank',
      bankCode: plaidCreds.institutionId,
      accountId: firstAccountId,
      internalAccountId: credentials.accountIdentifier,
      capabilities: this.getPlaidCapabilities(),
      rateLimits: {
        ...DEFAULT_RATE_LIMITS,
        balanceRequestsPerMinute: 30,  // Plaid allows more
        transactionRequestsPerMinute: 20,
      },
      status: 'connected',
      lastSuccessfulSync: new Date(),
      metadata: {
        accessToken: plaidCreds.accessToken,
        accountIds: plaidCreds.accountIds,
        institutionId: plaidCreds.institutionId,
      },
    };

    this.connections.set(connectionId, connection);
    return connection;
  }

  private getPlaidCapabilities(): BankCapabilities {
    return {
      realTimeBalance: true,           // Via /accounts/balance/get
      webhookNotifications: true,      // Plaid webhooks
      transactionHistory: true,        // Via /transactions/get
      paymentInitiation: false,        // Read-only (Plaid Transfer is separate)
      sameDayPayments: false,
      realTimePayments: false,
      internationalWires: false,
      fxConversion: false,
      virtualAccounts: false,
      statements: false,               // No formal statements
      paymentRecall: false,
      trackingIds: false,
    };
  }

  protected async performHealthCheck(connectionId: BankConnectionId): Promise<void> {
    const connection = this.getConnectionOrThrow(connectionId);
    const metadata = connection.metadata as { accessToken: string };

    // Simple health check by fetching accounts
    await this.plaidRequest('/accounts/get', {
      access_token: metadata.accessToken,
    });
  }

  async refreshCredentials(connectionId: BankConnectionId): Promise<void> {
    // Plaid access tokens don't expire but can become invalid
    // if user revokes access. In that case, need to re-link.
    const connection = this.getConnectionOrThrow(connectionId);

    try {
      await this.performHealthCheck(connectionId);
    } catch (error) {
      this.updateConnectionStatus(connectionId, 'expired');
      throw new Error('Plaid access token invalid. User must re-link account.');
    }
  }

  async getCapabilities(_connectionId: BankConnectionId): Promise<BankCapabilities> {
    return this.getPlaidCapabilities();
  }

  async getBalance(connectionId: BankConnectionId): Promise<BalancePosition> {
    const connection = this.getConnectionOrThrow(connectionId);
    const metadata = connection.metadata as {
      accessToken: string;
      accountIds: string[];
    };

    const response = await this.plaidRequest('/accounts/balance/get', {
      access_token: metadata.accessToken,
      options: {
        account_ids: metadata.accountIds,
      },
    });

    const account = response.accounts[0];

    return {
      connectionId,
      accountId: account.account_id,
      ledgerBalance: {
        amount: account.balances.current ?? 0,
        currency: account.balances.iso_currency_code ?? 'USD',
      },
      availableBalance: {
        amount: account.balances.available ?? account.balances.current ?? 0,
        currency: account.balances.iso_currency_code ?? 'USD',
      },
      pendingCredits: { amount: 0, currency: account.balances.iso_currency_code ?? 'USD' },
      pendingDebits: { amount: 0, currency: account.balances.iso_currency_code ?? 'USD' },
      totalHolds: { amount: 0, currency: account.balances.iso_currency_code ?? 'USD' },
      holds: [],
      asOfTimestamp: new Date(response.request_id ? Date.now() : Date.now()),
      fetchedAt: new Date(),
      freshness: this.calculateFreshness(response),
    };
  }

  private calculateFreshness(_response: unknown): BalanceFreshness {
    // Plaid balance is typically near real-time for most institutions
    return 'near_real_time';
  }

  async submitPayment(
    _connectionId: BankConnectionId,
    _instruction: PaymentInstruction
  ): Promise<PaymentSubmissionResult> {
    throw new Error('Payment initiation not supported via Plaid. Use Plaid Transfer API separately.');
  }

  async getPaymentStatus(
    _connectionId: BankConnectionId,
    _bankReference: string
  ): Promise<PaymentStatusUpdate> {
    throw new Error('Payment status not supported via Plaid.');
  }

  async getStatement(
    connectionId: BankConnectionId,
    startDate: Date,
    endDate: Date
  ): Promise<BankStatement> {
    const connection = this.getConnectionOrThrow(connectionId);
    const metadata = connection.metadata as {
      accessToken: string;
      accountIds: string[];
    };

    const primaryAccountId = metadata.accountIds[0];
    if (!primaryAccountId) {
      throw new Error('No account IDs configured for this connection');
    }

    // Use transactions endpoint since Plaid doesn't have formal statements
    const transactions = await this.fetchTransactions(
      metadata.accessToken,
      primaryAccountId,
      startDate,
      endDate
    );

    // Calculate opening/closing balance from transactions
    const balance = await this.getBalance(connectionId);

    return {
      statementId: `plaid-${connectionId}-${startDate.toISOString()}`,
      connectionId,
      accountId: primaryAccountId,
      periodStart: startDate,
      periodEnd: endDate,
      openingBalance: balance.ledgerBalance, // Approximation
      closingBalance: balance.ledgerBalance,
      transactions: transactions.map(this.mapPlaidTransaction),
      retrievedAt: new Date(),
      format: 'api',
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async fetchAccounts(
    creds: PlaidCredentials
  ): Promise<{ accounts: unknown[]; institution?: { name: string } }> {
    return this.plaidRequest('/accounts/get', {
      access_token: creds.accessToken,
    });
  }

  private async fetchTransactions(
    accessToken: string,
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PlaidTransaction[]> {
    const response = await this.plaidRequest('/transactions/get', {
      access_token: accessToken,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      options: {
        account_ids: [accountId],
        count: 500,
        offset: 0,
      },
    });

    return response.transactions ?? [];
  }

  private mapPlaidTransaction(tx: PlaidTransaction): BankTransaction {
    return {
      transactionId: tx.transaction_id,
      connectionId: '', // Will be set by caller
      accountId: tx.account_id,
      direction: tx.amount < 0 ? 'inbound' : 'outbound' as PaymentDirection,
      amount: {
        amount: Math.abs(tx.amount),
        currency: tx.iso_currency_code ?? 'USD',
      },
      postedDate: new Date(tx.date),
      valueDate: new Date(tx.date),
      description: tx.name,
      reference: tx.transaction_id,
      category: tx.category?.[0],
      isPending: tx.pending,
      metadata: {
        merchantName: tx.merchant_name,
        categories: tx.category,
        paymentChannel: tx.payment_channel,
      },
    };
  }

  private async plaidRequest(endpoint: string, body: Record<string, unknown>): Promise<any> {
    // In real implementation, this would make HTTP request
    // For now, this is a placeholder showing the structure
    const _url = `${this.baseUrl}${endpoint}`;
    const _payload = {
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      ...body,
    };

    // TODO: Implement actual HTTP request
    // const response = await fetch(url, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(payload),
    // });
    // return response.json();

    throw new Error('Plaid API client not implemented - requires HTTP client');
  }
}

/**
 * Plaid transaction structure (simplified).
 */
interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code: string | null;
  date: string;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  category: string[] | null;
  payment_channel: string;
}
