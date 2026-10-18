/**
 * SQS Client for Payment Processing
 *
 * Provides reliable message delivery for payment workflows.
 *
 * @module infrastructure/aws
 */

import {
  SQSClient,
  SendMessageCommand,
  SendMessageBatchCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  DeleteMessageBatchCommand,
  ChangeMessageVisibilityCommand,
  GetQueueAttributesCommand,
  type Message,
} from '@aws-sdk/client-sqs';
import { awsConfig } from './config.js';

const client = new SQSClient({ region: awsConfig.region });

/**
 * Message payload for payment processing.
 */
export interface PaymentMessage {
  paymentId: string;
  type: 'initiate' | 'execute' | 'complete' | 'cancel' | 'retry';
  payload: Record<string, unknown>;
  metadata?: {
    correlationId?: string | undefined;
    causationId?: string | undefined;
    userId?: string | undefined;
    tenantId?: string | undefined;
    priority?: 'low' | 'normal' | 'high' | undefined;
  } | undefined;
}

/**
 * Message payload for balance updates.
 */
export interface BalanceUpdateMessage {
  accountId: string;
  transactionId: string;
  type: 'credit' | 'debit';
  amount: number;
  currency: string;
  reference?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Message payload for reconciliation.
 */
export interface ReconciliationMessage {
  reconciliationId: string;
  type: 'start' | 'match' | 'exception' | 'complete';
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Received message wrapper.
 */
export interface ReceivedMessage<T> {
  messageId: string;
  receiptHandle: string;
  body: T;
  attributes: Record<string, string>;
  approximateReceiveCount: number;
}

/**
 * Base SQS Queue Client
 */
export class QueueClient<T> {
  constructor(
    protected readonly queueUrl: string,
    protected readonly dlqUrl?: string
  ) {}

  /**
   * Send a single message.
   */
  async send(
    message: T,
    options?: {
      delaySeconds?: number | undefined;
      messageGroupId?: string | undefined;  // For FIFO queues
      deduplicationId?: string | undefined;  // For FIFO queues
    }
  ): Promise<string> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
      DelaySeconds: options?.delaySeconds,
      MessageGroupId: options?.messageGroupId,
      MessageDeduplicationId: options?.deduplicationId,
    });

    const response = await client.send(command);
    return response.MessageId ?? '';
  }

  /**
   * Send multiple messages in batch (up to 10).
   */
  async sendBatch(
    messages: Array<{
      id: string;
      body: T;
      delaySeconds?: number | undefined;
      messageGroupId?: string | undefined;
      deduplicationId?: string | undefined;
    }>
  ): Promise<{ successful: string[]; failed: Array<{ id: string; error: string }> }> {
    const command = new SendMessageBatchCommand({
      QueueUrl: this.queueUrl,
      Entries: messages.map((m) => ({
        Id: m.id,
        MessageBody: JSON.stringify(m.body),
        DelaySeconds: m.delaySeconds,
        MessageGroupId: m.messageGroupId,
        MessageDeduplicationId: m.deduplicationId,
      })),
    });

    const response = await client.send(command);

    return {
      successful: (response.Successful ?? []).map((s) => s.Id ?? ''),
      failed: (response.Failed ?? []).map((f) => ({
        id: f.Id ?? '',
        error: f.Message ?? 'Unknown error',
      })),
    };
  }

  /**
   * Receive messages from queue.
   */
  async receive(
    options?: {
      maxMessages?: number | undefined;
      waitTimeSeconds?: number | undefined;
      visibilityTimeout?: number | undefined;
    }
  ): Promise<ReceivedMessage<T>[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: options?.maxMessages ?? 10,
      WaitTimeSeconds: options?.waitTimeSeconds ?? 20,
      VisibilityTimeout: options?.visibilityTimeout,
      AttributeNames: ['All'],
      MessageAttributeNames: ['All'],
    });

    const response = await client.send(command);

    return (response.Messages ?? []).map((m) => this.mapMessage(m));
  }

  /**
   * Delete a processed message.
   */
  async delete(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await client.send(command);
  }

  /**
   * Delete multiple messages.
   */
  async deleteBatch(
    messages: Array<{ id: string; receiptHandle: string }>
  ): Promise<{ successful: string[]; failed: string[] }> {
    const command = new DeleteMessageBatchCommand({
      QueueUrl: this.queueUrl,
      Entries: messages.map((m) => ({
        Id: m.id,
        ReceiptHandle: m.receiptHandle,
      })),
    });

    const response = await client.send(command);

    return {
      successful: (response.Successful ?? []).map((s) => s.Id ?? ''),
      failed: (response.Failed ?? []).map((f) => f.Id ?? ''),
    };
  }

  /**
   * Extend visibility timeout for a message.
   */
  async extendVisibility(
    receiptHandle: string,
    visibilityTimeout: number
  ): Promise<void> {
    const command = new ChangeMessageVisibilityCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: visibilityTimeout,
    });

    await client.send(command);
  }

  /**
   * Get queue attributes.
   */
  async getAttributes(): Promise<{
    approximateMessages: number;
    approximateMessagesDelayed: number;
    approximateMessagesNotVisible: number;
  }> {
    const command = new GetQueueAttributesCommand({
      QueueUrl: this.queueUrl,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesDelayed',
        'ApproximateNumberOfMessagesNotVisible',
      ],
    });

    const response = await client.send(command);
    const attrs = response.Attributes ?? {};

    return {
      approximateMessages: parseInt(attrs.ApproximateNumberOfMessages ?? '0', 10),
      approximateMessagesDelayed: parseInt(attrs.ApproximateNumberOfMessagesDelayed ?? '0', 10),
      approximateMessagesNotVisible: parseInt(attrs.ApproximateNumberOfMessagesNotVisible ?? '0', 10),
    };
  }

  /**
   * Get DLQ message count.
   */
  async getDlqMessageCount(): Promise<number> {
    if (!this.dlqUrl) {
      return 0;
    }

    const command = new GetQueueAttributesCommand({
      QueueUrl: this.dlqUrl,
      AttributeNames: ['ApproximateNumberOfMessages'],
    });

    const response = await client.send(command);
    return parseInt(response.Attributes?.ApproximateNumberOfMessages ?? '0', 10);
  }

  private mapMessage(msg: Message): ReceivedMessage<T> {
    return {
      messageId: msg.MessageId ?? '',
      receiptHandle: msg.ReceiptHandle ?? '',
      body: JSON.parse(msg.Body ?? '{}') as T,
      attributes: msg.Attributes ?? {},
      approximateReceiveCount: parseInt(
        msg.Attributes?.ApproximateReceiveCount ?? '1',
        10
      ),
    };
  }
}

/**
 * Payment Processing Queue
 */
export class PaymentProcessingQueue extends QueueClient<PaymentMessage> {
  constructor() {
    super(
      awsConfig.sqs.paymentProcessing ??
        `https://sqs.${awsConfig.region}.amazonaws.com/${awsConfig.accountId}/banking-treasury-${awsConfig.environment}-payment-processing`,
      awsConfig.sqs.paymentProcessingDlq ??
        `https://sqs.${awsConfig.region}.amazonaws.com/${awsConfig.accountId}/banking-treasury-${awsConfig.environment}-payment-processing-dlq`
    );
  }

  /**
   * Queue a payment for processing.
   */
  async queuePayment(
    paymentId: string,
    type: PaymentMessage['type'],
    payload: Record<string, unknown>,
    metadata?: PaymentMessage['metadata']
  ): Promise<string> {
    return this.send({
      paymentId,
      type,
      payload,
      metadata,
    });
  }
}

/**
 * Payment Execution Queue (FIFO)
 *
 * Ensures ordered execution per account.
 */
export class PaymentExecutionQueue extends QueueClient<PaymentMessage> {
  constructor() {
    super(
      awsConfig.sqs.paymentExecution ??
        `https://sqs.${awsConfig.region}.amazonaws.com/${awsConfig.accountId}/banking-treasury-${awsConfig.environment}-payment-execution.fifo`,
      awsConfig.sqs.paymentExecutionDlq ??
        `https://sqs.${awsConfig.region}.amazonaws.com/${awsConfig.accountId}/banking-treasury-${awsConfig.environment}-payment-execution-dlq.fifo`
    );
  }

  /**
   * Queue a payment for execution with ordering.
   */
  async queueForExecution(
    paymentId: string,
    sourceAccountId: string,
    payload: Record<string, unknown>,
    metadata?: PaymentMessage['metadata']
  ): Promise<string> {
    return this.send(
      {
        paymentId,
        type: 'execute',
        payload,
        metadata,
      },
      {
        // Group by source account for ordered processing
        messageGroupId: sourceAccountId,
        // Use payment ID for deduplication
        deduplicationId: `execute-${paymentId}`,
      }
    );
  }
}

/**
 * Balance Updates Queue
 */
export class BalanceUpdatesQueue extends QueueClient<BalanceUpdateMessage> {
  constructor() {
    super(
      awsConfig.sqs.balanceUpdates ??
        `https://sqs.${awsConfig.region}.amazonaws.com/${awsConfig.accountId}/banking-treasury-${awsConfig.environment}-balance-updates`,
      awsConfig.sqs.balanceUpdatesDlq ??
        `https://sqs.${awsConfig.region}.amazonaws.com/${awsConfig.accountId}/banking-treasury-${awsConfig.environment}-balance-updates-dlq`
    );
  }

  /**
   * Queue a balance update.
   */
  async queueUpdate(
    accountId: string,
    transactionId: string,
    type: 'credit' | 'debit',
    amount: number,
    currency: string,
    reference?: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.send({
      accountId,
      transactionId,
      type,
      amount,
      currency,
      reference,
      metadata,
    });
  }
}

/**
 * Reconciliation Queue
 */
export class ReconciliationQueue extends QueueClient<ReconciliationMessage> {
  constructor() {
    super(
      awsConfig.sqs.reconciliation ??
        `https://sqs.${awsConfig.region}.amazonaws.com/${awsConfig.accountId}/banking-treasury-${awsConfig.environment}-reconciliation`,
      awsConfig.sqs.reconciliationDlq ??
        `https://sqs.${awsConfig.region}.amazonaws.com/${awsConfig.accountId}/banking-treasury-${awsConfig.environment}-reconciliation-dlq`
    );
  }

  /**
   * Queue a reconciliation task.
   */
  async queueTask(
    reconciliationId: string,
    type: ReconciliationMessage['type'],
    payload: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.send({
      reconciliationId,
      type,
      payload,
      metadata,
    });
  }
}

// Singleton instances
export const paymentProcessingQueue = new PaymentProcessingQueue();
export const paymentExecutionQueue = new PaymentExecutionQueue();
export const balanceUpdatesQueue = new BalanceUpdatesQueue();
export const reconciliationQueue = new ReconciliationQueue();
