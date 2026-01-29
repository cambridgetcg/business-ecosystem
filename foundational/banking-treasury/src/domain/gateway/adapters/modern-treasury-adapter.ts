/**
 * Modern Treasury Bank Adapter
 *
 * Adapter for Modern Treasury API.
 * Provides full payment lifecycle management with multiple bank integrations.
 *
 * @see https://docs.moderntreasury.com/
 */

import type {
  BankCredentials,
  PaymentInstruction,
  PaymentSubmissionResult,
  PaymentStatusUpdate,
  PaymentExecutionStatus,
  FXQuoteRequest,
  FXExecutionRequest,
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
  FXQuote,
  FXExecution,
  PaymentDirection,
} from '../types.js';
import { BaseBankAdapter, DEFAULT_RATE_LIMITS } from './base-adapter.js';

/**
 * Modern Treasury-specific credentials.
 */
interface ModernTreasuryCredentials {
  apiKey: string;
  organizationId: string;
  internalAccountId: string;  // MT's internal account ID
  counterpartyId?: string;
}

/**
 * Modern Treasury adapter implementation.
 */
export class ModernTreasuryAdapter extends BaseBankAdapter {
  readonly provider: BankProvider = 'modern_treasury';

  private readonly baseUrl = 'https://app.moderntreasury.com/api';

  async connect(credentials: BankCredentials): Promise<BankConnection> {
    const mtCreds = credentials.credentials as unknown as ModernTreasuryCredentials;

    // Validate by fetching internal account
    const account = await this.fetchInternalAccount(mtCreds);

    const connectionId = this.generateConnectionId(
      mtCreds.organizationId,
      mtCreds.internalAccountId
    );

    const connection: BankConnection = {
      id: connectionId,
      provider: this.provider,
      bankName: account.bank_name ?? 'Modern Treasury',
      bankCode: account.routing_details?.[0]?.routing_number ?? '',
      accountId: mtCreds.internalAccountId,
      internalAccountId: credentials.accountIdentifier,
      capabilities: this.getMTCapabilities(),
      rateLimits: {
        ...DEFAULT_RATE_LIMITS,
        balanceRequestsPerMinute: 60,
        transactionRequestsPerMinute: 60,
        paymentsPerHour: 1000,
      },
      status: 'connected',
      lastSuccessfulSync: new Date(),
      metadata: {
        apiKey: mtCreds.apiKey,
        organizationId: mtCreds.organizationId,
        mtInternalAccountId: mtCreds.internalAccountId,
      },
    };

    this.connections.set(connectionId, connection);
    return connection;
  }

  private getMTCapabilities(): BankCapabilities {
    return {
      realTimeBalance: true,
      webhookNotifications: true,      // MT webhooks
      transactionHistory: true,
      paymentInitiation: true,         // Full payment support
      sameDayPayments: true,           // Same-day ACH
      realTimePayments: true,          // RTP support
      internationalWires: true,        // SWIFT via some banks
      fxConversion: true,              // FX support
      virtualAccounts: true,           // Virtual account management
      statements: true,
      paymentRecall: true,             // Return handling
      trackingIds: true,               // Payment tracking
    };
  }

  protected async performHealthCheck(connectionId: BankConnectionId): Promise<void> {
    const connection = this.getConnectionOrThrow(connectionId);
    const metadata = connection.metadata as { mtInternalAccountId: string };

    await this.mtRequest(`/internal_accounts/${metadata.mtInternalAccountId}`, 'GET');
  }

  async refreshCredentials(_connectionId: BankConnectionId): Promise<void> {
    // MT uses API keys which don't expire
    // Just verify the key is still valid
    await this.performHealthCheck(_connectionId);
  }

  async getCapabilities(_connectionId: BankConnectionId): Promise<BankCapabilities> {
    return this.getMTCapabilities();
  }

  async getBalance(connectionId: BankConnectionId): Promise<BalancePosition> {
    const connection = this.getConnectionOrThrow(connectionId);
    const metadata = connection.metadata as { mtInternalAccountId: string };

    const account = await this.mtRequest(
      `/internal_accounts/${metadata.mtInternalAccountId}`,
      'GET'
    );

    const balances = account.balances ?? {};

    return {
      connectionId,
      accountId: metadata.mtInternalAccountId,
      ledgerBalance: {
        amount: balances.current_balance ?? 0,
        currency: account.currency ?? 'USD',
      },
      availableBalance: {
        amount: balances.available_balance ?? balances.current_balance ?? 0,
        currency: account.currency ?? 'USD',
      },
      pendingCredits: {
        amount: balances.pending_balance ?? 0,
        currency: account.currency ?? 'USD',
      },
      pendingDebits: {
        amount: 0, // MT doesn't separate pending debits
        currency: account.currency ?? 'USD',
      },
      totalHolds: {
        amount: 0,
        currency: account.currency ?? 'USD',
      },
      holds: [],
      asOfTimestamp: new Date(account.updated_at ?? Date.now()),
      fetchedAt: new Date(),
      freshness: 'real_time' as BalanceFreshness,
    };
  }

  async submitPayment(
    connectionId: BankConnectionId,
    instruction: PaymentInstruction
  ): Promise<PaymentSubmissionResult> {
    const connection = this.getConnectionOrThrow(connectionId);
    const metadata = connection.metadata as { mtInternalAccountId: string };

    // First, create or find counterparty
    const counterparty = await this.ensureCounterparty(instruction.beneficiary);

    // Determine payment type based on instruction
    const paymentType = this.determinePaymentType(instruction);

    // Create payment order
    const paymentOrder = await this.mtRequest('/payment_orders', 'POST', {
      type: paymentType,
      amount: Math.round(instruction.amount.amount * 100), // MT uses cents
      currency: instruction.amount.currency,
      direction: 'credit',
      originating_account_id: metadata.mtInternalAccountId,
      receiving_account_id: counterparty.accounts[0]?.id,
      description: instruction.reference,
      statement_descriptor: instruction.remittanceInfo?.substring(0, 22),
      metadata: {
        instruction_id: instruction.instructionId,
        ...instruction.metadata,
      },
      priority: instruction.urgency === 'critical' ? 'high' : 'normal',
    });

    return {
      instructionId: instruction.instructionId,
      bankReference: paymentOrder.id,
      trackingId: paymentOrder.reference_numbers?.[0]?.reference_number,
      status: this.mapMTStatus(paymentOrder.status),
      selectedRail: paymentType,
      estimatedSettlement: new Date(paymentOrder.effective_date ?? Date.now()),
      fees: {
        amount: 0, // MT doesn't return fees in response
        currency: instruction.amount.currency,
      },
      submittedAt: new Date(),
      rawResponse: paymentOrder,
    };
  }

  async getPaymentStatus(
    _connectionId: BankConnectionId,
    bankReference: string
  ): Promise<PaymentStatusUpdate> {
    const paymentOrder = await this.mtRequest(`/payment_orders/${bankReference}`, 'GET');

    return {
      instructionId: paymentOrder.metadata?.instruction_id ?? '',
      bankReference,
      previousStatus: 'processing', // We don't track previous
      currentStatus: this.mapMTStatus(paymentOrder.status),
      updatedAt: new Date(paymentOrder.updated_at),
      reason: paymentOrder.status_history?.[0]?.reason,
    };
  }

  async getStatement(
    connectionId: BankConnectionId,
    startDate: Date,
    endDate: Date
  ): Promise<BankStatement> {
    const connection = this.getConnectionOrThrow(connectionId);
    const metadata = connection.metadata as { mtInternalAccountId: string };

    // Fetch transactions for the period
    const transactions = await this.mtRequest(
      `/transactions?internal_account_id=${metadata.mtInternalAccountId}&posted_at_lower_bound=${startDate.toISOString()}&posted_at_upper_bound=${endDate.toISOString()}`,
      'GET'
    );

    const balance = await this.getBalance(connectionId);

    return {
      statementId: `mt-${connectionId}-${startDate.toISOString()}`,
      connectionId,
      accountId: metadata.mtInternalAccountId,
      periodStart: startDate,
      periodEnd: endDate,
      openingBalance: balance.ledgerBalance, // Approximation
      closingBalance: balance.ledgerBalance,
      transactions: (transactions.items ?? []).map((tx: MTTransaction) =>
        this.mapMTTransaction(tx, connectionId)
      ),
      retrievedAt: new Date(),
      format: 'api',
    };
  }

  // ==========================================================================
  // FX SUPPORT
  // ==========================================================================

  async getFXQuote(
    _connectionId: BankConnectionId,
    request: FXQuoteRequest
  ): Promise<FXQuote> {
    const quote = await this.mtRequest('/foreign_exchange_quotes', 'POST', {
      internal_account_id: this.getConnectionOrThrow(_connectionId).metadata
        .mtInternalAccountId,
      target_currency: request.targetCurrency,
      base_currency: request.sourceCurrency,
      base_amount: Math.round(request.amount.amount * 100),
    });

    return {
      quoteId: quote.id,
      provider: this.provider,
      sourceCurrency: request.sourceCurrency,
      targetCurrency: request.targetCurrency,
      rate: quote.rate,
      inverseRate: 1 / quote.rate,
      sourceAmount: request.amount,
      targetAmount: {
        amount: quote.target_amount / 100,
        currency: request.targetCurrency,
      },
      spread: 0, // MT doesn't expose spread
      validFrom: new Date(),
      validUntil: new Date(quote.expires_at),
      settlementDate: new Date(quote.effective_at),
      isIndicative: false,
    };
  }

  async executeFX(
    _connectionId: BankConnectionId,
    request: FXExecutionRequest
  ): Promise<FXExecution> {
    if (!request.quoteId) {
      throw new Error('Quote ID required for FX execution');
    }

    const trade = await this.mtRequest('/foreign_exchange_trades', 'POST', {
      foreign_exchange_quote_id: request.quoteId,
    });

    return {
      executionId: trade.id,
      quoteId: request.quoteId,
      sourceCurrency: trade.base_currency,
      targetCurrency: trade.target_currency,
      sourceAmount: {
        amount: trade.base_amount / 100,
        currency: trade.base_currency,
      },
      targetAmount: {
        amount: trade.target_amount / 100,
        currency: trade.target_currency,
      },
      executedRate: trade.rate,
      executedAt: new Date(trade.created_at),
      settlementDate: new Date(trade.effective_at),
      status: 'pending',
      reference: trade.id,
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async fetchInternalAccount(
    creds: ModernTreasuryCredentials
  ): Promise<MTInternalAccount> {
    return this.mtRequest(`/internal_accounts/${creds.internalAccountId}`, 'GET');
  }

  private async ensureCounterparty(
    beneficiary: PaymentInstruction['beneficiary']
  ): Promise<MTCounterparty> {
    // Search for existing counterparty
    const search = await this.mtRequest(
      `/counterparties?name=${encodeURIComponent(beneficiary.name)}`,
      'GET'
    );

    if (search.items?.length > 0) {
      return search.items[0];
    }

    // Create new counterparty
    return this.mtRequest('/counterparties', 'POST', {
      name: beneficiary.name,
      accounts: [
        {
          account_type: beneficiary.partyType === 'individual' ? 'checking' : 'other',
          routing_type: beneficiary.routingNumber ? 'aba' : 'swift',
          routing_number: beneficiary.routingNumber ?? beneficiary.swiftBic,
          account_number: beneficiary.accountNumber,
          account_holder_name: beneficiary.name,
        },
      ],
    });
  }

  private determinePaymentType(instruction: PaymentInstruction): string {
    // Map urgency and preferences to MT payment types
    if (instruction.preferredRail) {
      return instruction.preferredRail;
    }

    if (instruction.urgency === 'critical') {
      return 'rtp'; // Real-time
    }

    if (instruction.urgency === 'urgent') {
      return 'wire'; // Same-day
    }

    return 'ach'; // Standard
  }

  private mapMTStatus(mtStatus: string): PaymentExecutionStatus {
    const statusMap: Record<string, PaymentExecutionStatus> = {
      pending: 'accepted',
      processing: 'processing',
      pending_approval: 'pending_approval',
      approved: 'processing',
      sent: 'processing',
      completed: 'completed',
      returned: 'returned',
      failed: 'failed',
      cancelled: 'cancelled',
      reversed: 'returned',
    };

    return statusMap[mtStatus] ?? 'processing';
  }

  private mapMTTransaction(tx: MTTransaction, connectionId: BankConnectionId): BankTransaction {
    return {
      transactionId: tx.id,
      connectionId,
      accountId: tx.internal_account_id,
      direction: (tx.direction === 'credit' ? 'inbound' : 'outbound') as PaymentDirection,
      amount: {
        amount: tx.amount / 100,
        currency: tx.currency,
      },
      postedDate: new Date(tx.posted_at ?? tx.created_at),
      valueDate: new Date(tx.as_of_date ?? tx.created_at),
      description: tx.description ?? '',
      reference: tx.vendor_code ?? tx.id,
      isPending: !tx.posted_at,
      metadata: {
        type: tx.type,
        vendorCode: tx.vendor_code,
      },
    };
  }

  private async mtRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: Record<string, unknown>
  ): Promise<any> {
    const _url = `${this.baseUrl}${endpoint}`;
    const _headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MODERN_TREASURY_API_KEY}`,
    };

    // TODO: Implement actual HTTP request
    // const response = await fetch(url, {
    //   method,
    //   headers,
    //   body: body ? JSON.stringify(body) : undefined,
    // });
    // return response.json();

    throw new Error(
      `Modern Treasury API client not implemented - ${method} ${endpoint} - requires HTTP client`
    );
  }
}

// ==========================================================================
// MODERN TREASURY TYPES
// ==========================================================================

interface MTInternalAccount {
  id: string;
  bank_name: string | null;
  currency: string;
  balances: {
    current_balance: number;
    available_balance: number;
    pending_balance: number;
  };
  routing_details: Array<{ routing_number: string }>;
  updated_at: string;
}

interface MTCounterparty {
  id: string;
  name: string;
  accounts: Array<{ id: string }>;
}

interface MTTransaction {
  id: string;
  internal_account_id: string;
  direction: 'credit' | 'debit';
  amount: number;
  currency: string;
  type: string;
  description: string | null;
  posted_at: string | null;
  as_of_date: string | null;
  created_at: string;
  vendor_code: string | null;
}
