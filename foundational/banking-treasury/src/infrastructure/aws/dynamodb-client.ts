/**
 * DynamoDB Client for Real-Time Data
 *
 * Provides access to DynamoDB tables for hot cash positions, transaction ledger,
 * and payment status tracking. Designed for <1 minute freshness requirements.
 *
 * @module infrastructure/aws
 */

import {
  DynamoDBClient,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  BatchWriteCommand,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { awsConfig } from './config.js';

const client = new DynamoDBClient({ region: awsConfig.region });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

/**
 * Cash position record structure.
 */
export interface CashPosition {
  entityId: string;
  currencyTimestamp: string;
  accountId: string;
  currency: string;
  availableBalance: number;
  currentBalance: number;
  pendingCredits: number;
  pendingDebits: number;
  lastTransactionId?: string | undefined;
  updatedAt: string;
  expiresAt?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Transaction ledger entry.
 */
export interface TransactionEntry {
  accountId: string;
  transactionId: string;
  paymentId?: string | undefined;
  type: 'credit' | 'debit';
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  description?: string | undefined;
  reference?: string | undefined;
  createdAt: string;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Payment status record.
 */
export interface PaymentStatus {
  paymentId: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled';
  sourceAccount: string;
  destinationAccount: string;
  amount: number;
  currency: string;
  initiatedBy: string;
  workflowExecutionArn?: string | undefined;
  approvedBy?: string | undefined;
  approvedAt?: string | undefined;
  completedAt?: string | undefined;
  failureReason?: string | undefined;
  updatedAt: string;
  archiveAt?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Cash Position Store
 *
 * Manages real-time cash position data in DynamoDB.
 */
export class CashPositionStore {
  private readonly tableName: string;

  constructor(tableName?: string) {
    this.tableName = tableName ?? awsConfig.dynamodb.cashPositionsTable;
  }

  /**
   * Get cash position for an entity and currency.
   */
  async getPosition(entityId: string, currency: string): Promise<CashPosition | null> {
    // Get latest position by querying with currency prefix
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'entity_id = :entityId AND begins_with(currency_timestamp, :currency)',
      ExpressionAttributeValues: {
        ':entityId': entityId,
        ':currency': `${currency}#`,
      },
      ScanIndexForward: false,
      Limit: 1,
    });

    const response = await docClient.send(command);
    const item = response.Items?.[0];

    if (!item) {
      return null;
    }

    return this.mapToPosition(item as Record<string, AttributeValue>);
  }

  /**
   * Get all positions for an entity.
   */
  async getPositionsByEntity(entityId: string): Promise<CashPosition[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'entity_id = :entityId',
      ExpressionAttributeValues: {
        ':entityId': entityId,
      },
    });

    const response = await docClient.send(command);

    // Deduplicate by currency (keep latest)
    const latestByCurrency = new Map<string, CashPosition>();

    for (const item of response.Items ?? []) {
      const position = this.mapToPosition(item as Record<string, AttributeValue>);
      const existing = latestByCurrency.get(position.currency);

      if (!existing || position.updatedAt > existing.updatedAt) {
        latestByCurrency.set(position.currency, position);
      }
    }

    return Array.from(latestByCurrency.values());
  }

  /**
   * Get positions by currency (across all entities).
   */
  async getPositionsByCurrency(currency: string, limit = 100): Promise<CashPosition[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'currency-index',
      KeyConditionExpression: 'currency = :currency',
      ExpressionAttributeValues: {
        ':currency': currency,
      },
      ScanIndexForward: false,
      Limit: limit,
    });

    const response = await docClient.send(command);
    return (response.Items ?? []).map(item => this.mapToPosition(item as Record<string, AttributeValue>));
  }

  /**
   * Get positions by account.
   */
  async getPositionsByAccount(accountId: string): Promise<CashPosition[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'account-index',
      KeyConditionExpression: 'account_id = :accountId',
      ExpressionAttributeValues: {
        ':accountId': accountId,
      },
      ScanIndexForward: false,
    });

    const response = await docClient.send(command);
    return (response.Items ?? []).map(item => this.mapToPosition(item as Record<string, AttributeValue>));
  }

  /**
   * Update cash position.
   */
  async updatePosition(position: CashPosition): Promise<void> {
    const timestamp = new Date().toISOString();
    const currencyTimestamp = `${position.currency}#${timestamp}`;

    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        entity_id: position.entityId,
        currency_timestamp: currencyTimestamp,
        account_id: position.accountId,
        currency: position.currency,
        available_balance: position.availableBalance,
        current_balance: position.currentBalance,
        pending_credits: position.pendingCredits,
        pending_debits: position.pendingDebits,
        last_transaction_id: position.lastTransactionId,
        updated_at: timestamp,
        expires_at: position.expiresAt ?? Math.floor(Date.now() / 1000) + 86400, // 24h TTL
        metadata: position.metadata,
      },
    });

    await docClient.send(command);
  }

  /**
   * Batch update positions.
   */
  async batchUpdatePositions(positions: CashPosition[]): Promise<void> {
    const timestamp = new Date().toISOString();

    // DynamoDB batch write limit is 25 items
    const batches = this.chunk(positions, 25);

    for (const batch of batches) {
      const command = new BatchWriteCommand({
        RequestItems: {
          [this.tableName]: batch.map(position => ({
            PutRequest: {
              Item: {
                entity_id: position.entityId,
                currency_timestamp: `${position.currency}#${timestamp}`,
                account_id: position.accountId,
                currency: position.currency,
                available_balance: position.availableBalance,
                current_balance: position.currentBalance,
                pending_credits: position.pendingCredits,
                pending_debits: position.pendingDebits,
                last_transaction_id: position.lastTransactionId,
                updated_at: timestamp,
                expires_at: position.expiresAt ?? Math.floor(Date.now() / 1000) + 86400,
                metadata: position.metadata,
              },
            },
          })),
        },
      });

      await docClient.send(command);
    }
  }

  private mapToPosition(item: Record<string, unknown>): CashPosition {
    return {
      entityId: item.entity_id as string,
      currencyTimestamp: item.currency_timestamp as string,
      accountId: item.account_id as string,
      currency: item.currency as string,
      availableBalance: item.available_balance as number,
      currentBalance: item.current_balance as number,
      pendingCredits: item.pending_credits as number,
      pendingDebits: item.pending_debits as number,
      lastTransactionId: item.last_transaction_id as string | undefined,
      updatedAt: item.updated_at as string,
      expiresAt: item.expires_at as number | undefined,
      metadata: item.metadata as Record<string, unknown> | undefined,
    };
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Transaction Ledger Store
 *
 * Hot path for recent transactions.
 */
export class TransactionLedgerStore {
  private readonly tableName: string;

  constructor(tableName?: string) {
    this.tableName = tableName ?? awsConfig.dynamodb.transactionLedgerTable;
  }

  /**
   * Record a transaction.
   */
  async recordTransaction(entry: TransactionEntry): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        account_id: entry.accountId,
        transaction_id: entry.transactionId,
        payment_id: entry.paymentId,
        type: entry.type,
        amount: entry.amount,
        currency: entry.currency,
        balance_before: entry.balanceBefore,
        balance_after: entry.balanceAfter,
        description: entry.description,
        reference: entry.reference,
        created_at: entry.createdAt,
        metadata: entry.metadata,
      },
    });

    await docClient.send(command);
  }

  /**
   * Get transactions for an account.
   */
  async getTransactionsByAccount(
    accountId: string,
    options?: {
      limit?: number | undefined;
      startAfter?: string | undefined;
    }
  ): Promise<{ transactions: TransactionEntry[]; lastKey?: string | undefined }> {
    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'account_id = :accountId',
      ExpressionAttributeValues: {
        ':accountId': accountId,
      },
      ScanIndexForward: false,
      Limit: options?.limit ?? 50,
    };

    if (options?.startAfter) {
      queryInput.ExclusiveStartKey = {
        account_id: accountId,
        transaction_id: options.startAfter,
      };
    }

    const response = await docClient.send(new QueryCommand(queryInput));

    return {
      transactions: (response.Items ?? []).map(item => this.mapToEntry(item as Record<string, unknown>)),
      lastKey: response.LastEvaluatedKey?.transaction_id as string | undefined,
    };
  }

  /**
   * Get transactions by payment ID.
   */
  async getTransactionsByPayment(paymentId: string): Promise<TransactionEntry[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'payment-index',
      KeyConditionExpression: 'payment_id = :paymentId',
      ExpressionAttributeValues: {
        ':paymentId': paymentId,
      },
    });

    const response = await docClient.send(command);
    return (response.Items ?? []).map(item => this.mapToEntry(item as Record<string, unknown>));
  }

  private mapToEntry(item: Record<string, unknown>): TransactionEntry {
    return {
      accountId: item.account_id as string,
      transactionId: item.transaction_id as string,
      paymentId: item.payment_id as string | undefined,
      type: item.type as 'credit' | 'debit',
      amount: item.amount as number,
      currency: item.currency as string,
      balanceBefore: item.balance_before as number,
      balanceAfter: item.balance_after as number,
      description: item.description as string | undefined,
      reference: item.reference as string | undefined,
      createdAt: item.created_at as string,
      metadata: item.metadata as Record<string, unknown> | undefined,
    };
  }
}

/**
 * Payment Status Store
 *
 * Real-time payment tracking.
 */
export class PaymentStatusStore {
  private readonly tableName: string;

  constructor(tableName?: string) {
    this.tableName = tableName ?? awsConfig.dynamodb.paymentStatusTable;
  }

  /**
   * Get payment status.
   */
  async getStatus(paymentId: string): Promise<PaymentStatus | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: { payment_id: paymentId },
    });

    const response = await docClient.send(command);

    if (!response.Item) {
      return null;
    }

    return this.mapToStatus(response.Item as Record<string, unknown>);
  }

  /**
   * Create payment status.
   */
  async createStatus(status: PaymentStatus): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        payment_id: status.paymentId,
        status: status.status,
        source_account: status.sourceAccount,
        destination_account: status.destinationAccount,
        amount: status.amount,
        currency: status.currency,
        initiated_by: status.initiatedBy,
        workflow_execution_arn: status.workflowExecutionArn,
        approved_by: status.approvedBy,
        approved_at: status.approvedAt,
        completed_at: status.completedAt,
        failure_reason: status.failureReason,
        updated_at: new Date().toISOString(),
        // Archive completed payments after 30 days
        archive_at: status.status === 'completed' || status.status === 'cancelled'
          ? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
          : undefined,
        metadata: status.metadata,
      },
      ConditionExpression: 'attribute_not_exists(payment_id)',
    });

    await docClient.send(command);
  }

  /**
   * Update payment status.
   */
  async updateStatus(
    paymentId: string,
    updates: Partial<Omit<PaymentStatus, 'paymentId'>>
  ): Promise<void> {
    const updateExpressions: string[] = ['#updatedAt = :updatedAt'];
    const expressionAttributeNames: Record<string, string> = { '#updatedAt': 'updated_at' };
    const expressionAttributeValues: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };

    if (updates.status !== undefined) {
      updateExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = updates.status;

      // Set archive TTL for terminal states
      if (updates.status === 'completed' || updates.status === 'cancelled') {
        updateExpressions.push('archive_at = :archiveAt');
        expressionAttributeValues[':archiveAt'] = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      }
    }

    if (updates.workflowExecutionArn !== undefined) {
      updateExpressions.push('workflow_execution_arn = :workflowArn');
      expressionAttributeValues[':workflowArn'] = updates.workflowExecutionArn;
    }

    if (updates.approvedBy !== undefined) {
      updateExpressions.push('approved_by = :approvedBy');
      expressionAttributeValues[':approvedBy'] = updates.approvedBy;
    }

    if (updates.approvedAt !== undefined) {
      updateExpressions.push('approved_at = :approvedAt');
      expressionAttributeValues[':approvedAt'] = updates.approvedAt;
    }

    if (updates.completedAt !== undefined) {
      updateExpressions.push('completed_at = :completedAt');
      expressionAttributeValues[':completedAt'] = updates.completedAt;
    }

    if (updates.failureReason !== undefined) {
      updateExpressions.push('failure_reason = :failureReason');
      expressionAttributeValues[':failureReason'] = updates.failureReason;
    }

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { payment_id: paymentId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await docClient.send(command);
  }

  /**
   * Get payments by status.
   */
  async getPaymentsByStatus(
    status: PaymentStatus['status'],
    limit = 50
  ): Promise<PaymentStatus[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'status-index',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': status },
      ScanIndexForward: false,
      Limit: limit,
    });

    const response = await docClient.send(command);
    return (response.Items ?? []).map(item => this.mapToStatus(item as Record<string, unknown>));
  }

  /**
   * Get payments by source account.
   */
  async getPaymentsBySourceAccount(
    sourceAccount: string,
    limit = 50
  ): Promise<PaymentStatus[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'source-account-index',
      KeyConditionExpression: 'source_account = :sourceAccount',
      ExpressionAttributeValues: { ':sourceAccount': sourceAccount },
      ScanIndexForward: false,
      Limit: limit,
    });

    const response = await docClient.send(command);
    return (response.Items ?? []).map(item => this.mapToStatus(item as Record<string, unknown>));
  }

  private mapToStatus(item: Record<string, unknown>): PaymentStatus {
    return {
      paymentId: item.payment_id as string,
      status: item.status as PaymentStatus['status'],
      sourceAccount: item.source_account as string,
      destinationAccount: item.destination_account as string,
      amount: item.amount as number,
      currency: item.currency as string,
      initiatedBy: item.initiated_by as string,
      workflowExecutionArn: item.workflow_execution_arn as string | undefined,
      approvedBy: item.approved_by as string | undefined,
      approvedAt: item.approved_at as string | undefined,
      completedAt: item.completed_at as string | undefined,
      failureReason: item.failure_reason as string | undefined,
      updatedAt: item.updated_at as string,
      archiveAt: item.archive_at as number | undefined,
      metadata: item.metadata as Record<string, unknown> | undefined,
    };
  }
}

// Singleton instances
export const cashPositionStore = new CashPositionStore();
export const transactionLedgerStore = new TransactionLedgerStore();
export const paymentStatusStore = new PaymentStatusStore();
