/**
 * Automated Reconciliation Engine
 *
 * Bank statement reconciliation with target 95%+ auto-match rate.
 * Uses multi-pass matching with confidence scoring.
 *
 * @module lambdas/reconciliation
 */

import type { SQSEvent, SQSRecord } from 'aws-lambda';
import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
  UpdateItemCommand,
  BatchWriteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import {
  SNSClient,
  PublishCommand,
} from '@aws-sdk/client-sns';
import { v4 as uuidv4 } from 'uuid';

// Environment
const RECONCILIATION_SESSIONS_TABLE = process.env.RECONCILIATION_SESSIONS_TABLE ?? 'reconciliation-sessions';
const RECONCILIATION_MATCHES_TABLE = process.env.RECONCILIATION_MATCHES_TABLE ?? 'reconciliation-matches';
const RECONCILIATION_EXCEPTIONS_TABLE = process.env.RECONCILIATION_EXCEPTIONS_TABLE ?? 'reconciliation-exceptions';
const TRANSACTION_LEDGER_TABLE = process.env.TRANSACTION_LEDGER_TABLE ?? 'transaction-ledger';
const BANK_STATEMENTS_BUCKET = process.env.BANK_STATEMENTS_BUCKET ?? 'bank-statements';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME ?? 'default';
const RECONCILIATION_TOPIC_ARN = process.env.RECONCILIATION_TOPIC_ARN;
const CRITICAL_ALERTS_TOPIC_ARN = process.env.CRITICAL_ALERTS_TOPIC_ARN;
const MATCH_AMOUNT_TOLERANCE = parseFloat(process.env.MATCH_AMOUNT_TOLERANCE ?? '0.01');
const MATCH_DATE_TOLERANCE_DAYS = parseInt(process.env.MATCH_DATE_TOLERANCE_DAYS ?? '3', 10);
const AUTO_MATCH_THRESHOLD = parseFloat(process.env.AUTO_MATCH_THRESHOLD ?? '0.95');

// Clients
const dynamoClient = new DynamoDBClient({});
const s3Client = new S3Client({});
const eventBridgeClient = new EventBridgeClient({});
const snsClient = new SNSClient({});

/**
 * Bank statement transaction.
 */
interface StatementTransaction {
  transactionId: string;
  date: string;
  valueDate?: string | undefined;
  amount: number;
  currency: string;
  description: string;
  reference?: string | undefined;
  type: 'credit' | 'debit';
  balance?: number | undefined;
  rawData?: Record<string, unknown> | undefined;
}

/**
 * Internal transaction record.
 */
interface InternalTransaction {
  transactionId: string;
  accountId: string;
  date: string;
  amount: number;
  currency: string;
  description?: string | undefined;
  reference?: string | undefined;
  type: 'credit' | 'debit';
  paymentId?: string | undefined;
}

/**
 * Match result.
 */
interface MatchResult {
  matchId: string;
  statementTransaction: StatementTransaction;
  internalTransaction: InternalTransaction;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'reference' | 'amount_date';
  matchedFields: string[];
  autoApproved: boolean;
}

/**
 * Exception record.
 */
interface ExceptionRecord {
  exceptionId: string;
  sessionId: string;
  exceptionType: 'unmatched_statement' | 'unmatched_internal' | 'amount_mismatch' | 'duplicate';
  transaction: StatementTransaction | InternalTransaction;
  status: 'pending' | 'resolved' | 'ignored';
  suggestedMatches?: Array<{
    transaction: InternalTransaction;
    confidence: number;
  }> | undefined;
  resolution?: {
    action: string;
    resolvedBy: string;
    resolvedAt: string;
    notes?: string | undefined;
  } | undefined;
  createdAt: string;
}

/**
 * Reconciliation session.
 */
interface ReconciliationSession {
  sessionId: string;
  accountId: string;
  statementPeriod: {
    start: string;
    end: string;
  };
  status: 'processing' | 'completed' | 'failed' | 'pending_review';
  metrics: {
    totalStatementTransactions: number;
    totalInternalTransactions: number;
    autoMatched: number;
    manualReviewRequired: number;
    exceptions: number;
    matchRate: number;
  };
  createdAt: string;
  completedAt?: string | undefined;
  error?: string | undefined;
}

/**
 * SQS message payload.
 */
interface ReconciliationMessage {
  accountId: string;
  statementKey: string;
  statementFormat: 'MT940' | 'BAI2' | 'CSV' | 'JSON';
  periodStart: string;
  periodEnd: string;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Main handler for SQS events.
 */
export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

/**
 * Process a single SQS record.
 */
async function processRecord(record: SQSRecord): Promise<void> {
  const message: ReconciliationMessage = JSON.parse(record.body);

  console.log('Processing reconciliation:', {
    accountId: message.accountId,
    period: `${message.periodStart} - ${message.periodEnd}`,
  });

  const sessionId = uuidv4();
  const session: ReconciliationSession = {
    sessionId,
    accountId: message.accountId,
    statementPeriod: {
      start: message.periodStart,
      end: message.periodEnd,
    },
    status: 'processing',
    metrics: {
      totalStatementTransactions: 0,
      totalInternalTransactions: 0,
      autoMatched: 0,
      manualReviewRequired: 0,
      exceptions: 0,
      matchRate: 0,
    },
    createdAt: new Date().toISOString(),
  };

  try {
    // Create session record
    await createSession(session);

    // Load bank statement
    const statementTransactions = await loadBankStatement(
      message.statementKey,
      message.statementFormat
    );

    session.metrics.totalStatementTransactions = statementTransactions.length;

    // Load internal transactions for the period
    const internalTransactions = await loadInternalTransactions(
      message.accountId,
      message.periodStart,
      message.periodEnd
    );

    session.metrics.totalInternalTransactions = internalTransactions.length;

    // Run matching engine
    const { matches, exceptions } = await runMatchingEngine(
      sessionId,
      statementTransactions,
      internalTransactions
    );

    // Calculate metrics
    session.metrics.autoMatched = matches.filter((m) => m.autoApproved).length;
    session.metrics.manualReviewRequired = matches.filter((m) => !m.autoApproved).length;
    session.metrics.exceptions = exceptions.length;
    session.metrics.matchRate =
      statementTransactions.length > 0
        ? matches.length / statementTransactions.length
        : 0;

    // Store matches
    await storeMatches(sessionId, matches);

    // Store exceptions
    await storeExceptions(exceptions);

    // Update session status
    session.status =
      session.metrics.matchRate >= 0.95 && exceptions.length === 0
        ? 'completed'
        : 'pending_review';
    session.completedAt = new Date().toISOString();

    await updateSession(session);

    // Publish events
    await publishReconciliationEvents(session, matches, exceptions);

    // Archive processed statement
    await archiveStatement(message.statementKey, sessionId);

    console.log('Reconciliation complete:', {
      sessionId,
      matchRate: (session.metrics.matchRate * 100).toFixed(1) + '%',
      autoMatched: session.metrics.autoMatched,
      exceptions: session.metrics.exceptions,
    });
  } catch (error) {
    console.error('Reconciliation failed:', error);

    session.status = 'failed';
    session.error = error instanceof Error ? error.message : 'Unknown error';
    session.completedAt = new Date().toISOString();

    await updateSession(session);
    await sendAlert(session, error as Error);

    throw error;
  }
}

/**
 * Load and parse bank statement from S3.
 */
async function loadBankStatement(
  key: string,
  format: ReconciliationMessage['statementFormat']
): Promise<StatementTransaction[]> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: BANK_STATEMENTS_BUCKET,
      Key: key,
    })
  );

  const content = await response.Body?.transformToString();
  if (!content) {
    throw new Error('Empty statement file');
  }

  switch (format) {
    case 'JSON':
      return parseJsonStatement(content);
    case 'CSV':
      return parseCsvStatement(content);
    case 'MT940':
      return parseMt940Statement(content);
    case 'BAI2':
      return parseBai2Statement(content);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Parse JSON format statement.
 */
function parseJsonStatement(content: string): StatementTransaction[] {
  const data = JSON.parse(content);
  return data.transactions ?? data;
}

/**
 * Parse CSV format statement.
 */
function parseCsvStatement(content: string): StatementTransaction[] {
  const lines = content.split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  return lines.slice(1).filter((l) => l.trim()).map((line, index) => {
    const values = line.split(',');
    const record: Record<string, string> = {};

    headers.forEach((header, i) => {
      record[header] = values[i]?.trim() ?? '';
    });

    const amount = parseFloat(record.amount ?? record.value ?? '0');

    return {
      transactionId: record.id ?? record.transaction_id ?? `csv-${index}`,
      date: record.date ?? record.transaction_date ?? new Date().toISOString(),
      valueDate: record.value_date,
      amount: Math.abs(amount),
      currency: record.currency ?? 'USD',
      description: record.description ?? record.narrative ?? '',
      reference: record.reference ?? record.ref,
      type: amount >= 0 ? 'credit' : 'debit',
      balance: record.balance ? parseFloat(record.balance) : undefined,
    };
  });
}

/**
 * Parse MT940 SWIFT format (simplified).
 */
function parseMt940Statement(content: string): StatementTransaction[] {
  // Simplified MT940 parser - production would use proper parser
  const transactions: StatementTransaction[] = [];
  const lines = content.split('\n');

  let currentTx: Partial<StatementTransaction> | null = null;

  for (const line of lines) {
    if (line.startsWith(':61:')) {
      // Transaction line
      if (currentTx) {
        transactions.push(currentTx as StatementTransaction);
      }

      const match = line.match(/:61:(\d{6})(\d{4})?([CD])(\d+),(\d+)(\w+)(.+)/);
      if (match) {
        currentTx = {
          transactionId: `mt940-${transactions.length}`,
          date: `20${match[1].substring(0, 2)}-${match[1].substring(2, 4)}-${match[1].substring(4, 6)}`,
          type: match[3] === 'C' ? 'credit' : 'debit',
          amount: parseFloat(`${match[4]}.${match[5]}`),
          currency: 'USD', // Would be from :60F: field
          description: match[7]?.trim() ?? '',
          reference: match[6],
        };
      }
    } else if (line.startsWith(':86:') && currentTx) {
      // Description continuation
      currentTx.description = (currentTx.description ?? '') + ' ' + line.substring(4);
    }
  }

  if (currentTx) {
    transactions.push(currentTx as StatementTransaction);
  }

  return transactions;
}

/**
 * Parse BAI2 format (simplified).
 */
function parseBai2Statement(content: string): StatementTransaction[] {
  // Simplified BAI2 parser
  const transactions: StatementTransaction[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.startsWith('16,')) {
      // Transaction detail record
      const parts = line.split(',');
      const typeCode = parts[1];
      const amount = parseFloat(parts[2] ?? '0') / 100; // BAI2 amounts in cents

      transactions.push({
        transactionId: `bai2-${transactions.length}`,
        date: new Date().toISOString().split('T')[0],
        type: parseInt(typeCode) >= 400 ? 'credit' : 'debit',
        amount: Math.abs(amount),
        currency: 'USD',
        description: parts[5] ?? '',
        reference: parts[4],
      });
    }
  }

  return transactions;
}

/**
 * Load internal transactions from DynamoDB.
 */
async function loadInternalTransactions(
  accountId: string,
  startDate: string,
  endDate: string
): Promise<InternalTransaction[]> {
  const response = await dynamoClient.send(
    new QueryCommand({
      TableName: TRANSACTION_LEDGER_TABLE,
      KeyConditionExpression: 'account_id = :accountId AND transaction_id BETWEEN :start AND :end',
      ExpressionAttributeValues: marshall({
        ':accountId': accountId,
        ':start': startDate,
        ':end': endDate + 'Z',
      }),
    })
  );

  return (response.Items ?? []).map((item) => {
    const record = unmarshall(item);
    return {
      transactionId: record.transaction_id,
      accountId: record.account_id,
      date: record.created_at,
      amount: record.amount,
      currency: record.currency,
      description: record.description,
      reference: record.reference,
      type: record.type,
      paymentId: record.payment_id,
    };
  });
}

/**
 * Run the matching engine.
 */
async function runMatchingEngine(
  sessionId: string,
  statementTxs: StatementTransaction[],
  internalTxs: InternalTransaction[]
): Promise<{
  matches: MatchResult[];
  exceptions: ExceptionRecord[];
}> {
  const matches: MatchResult[] = [];
  const exceptions: ExceptionRecord[] = [];

  const matchedStatementIds = new Set<string>();
  const matchedInternalIds = new Set<string>();

  // Pass 1: Exact reference matching
  for (const stmtTx of statementTxs) {
    if (matchedStatementIds.has(stmtTx.transactionId)) continue;

    for (const intTx of internalTxs) {
      if (matchedInternalIds.has(intTx.transactionId)) continue;

      if (isExactReferenceMatch(stmtTx, intTx)) {
        const match = createMatch(stmtTx, intTx, 1.0, 'exact', ['reference', 'amount', 'type']);
        matches.push(match);
        matchedStatementIds.add(stmtTx.transactionId);
        matchedInternalIds.add(intTx.transactionId);
        break;
      }
    }
  }

  // Pass 2: Amount + date matching
  for (const stmtTx of statementTxs) {
    if (matchedStatementIds.has(stmtTx.transactionId)) continue;

    const candidates = internalTxs
      .filter((intTx) => !matchedInternalIds.has(intTx.transactionId))
      .filter((intTx) => isAmountDateMatch(stmtTx, intTx))
      .map((intTx) => ({
        intTx,
        confidence: calculateMatchConfidence(stmtTx, intTx),
      }))
      .sort((a, b) => b.confidence - a.confidence);

    if (candidates.length > 0 && candidates[0].confidence >= 0.8) {
      const best = candidates[0];
      const match = createMatch(
        stmtTx,
        best.intTx,
        best.confidence,
        'amount_date',
        ['amount', 'date', 'type']
      );
      matches.push(match);
      matchedStatementIds.add(stmtTx.transactionId);
      matchedInternalIds.add(best.intTx.transactionId);
    }
  }

  // Pass 3: Fuzzy description matching
  for (const stmtTx of statementTxs) {
    if (matchedStatementIds.has(stmtTx.transactionId)) continue;

    const candidates = internalTxs
      .filter((intTx) => !matchedInternalIds.has(intTx.transactionId))
      .filter((intTx) => isFuzzyMatch(stmtTx, intTx))
      .map((intTx) => ({
        intTx,
        confidence: calculateMatchConfidence(stmtTx, intTx),
      }))
      .sort((a, b) => b.confidence - a.confidence);

    if (candidates.length > 0 && candidates[0].confidence >= 0.7) {
      const best = candidates[0];
      const match = createMatch(
        stmtTx,
        best.intTx,
        best.confidence,
        'fuzzy',
        ['amount', 'description']
      );
      matches.push(match);
      matchedStatementIds.add(stmtTx.transactionId);
      matchedInternalIds.add(best.intTx.transactionId);
    }
  }

  // Create exceptions for unmatched transactions
  for (const stmtTx of statementTxs) {
    if (!matchedStatementIds.has(stmtTx.transactionId)) {
      // Find potential matches for suggestion
      const potentialMatches = internalTxs
        .filter((intTx) => !matchedInternalIds.has(intTx.transactionId))
        .map((intTx) => ({
          transaction: intTx,
          confidence: calculateMatchConfidence(stmtTx, intTx),
        }))
        .filter((m) => m.confidence > 0.3)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      exceptions.push({
        exceptionId: uuidv4(),
        sessionId,
        exceptionType: 'unmatched_statement',
        transaction: stmtTx,
        status: 'pending',
        suggestedMatches: potentialMatches.length > 0 ? potentialMatches : undefined,
        createdAt: new Date().toISOString(),
      });
    }
  }

  for (const intTx of internalTxs) {
    if (!matchedInternalIds.has(intTx.transactionId)) {
      exceptions.push({
        exceptionId: uuidv4(),
        sessionId,
        exceptionType: 'unmatched_internal',
        transaction: intTx,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return { matches, exceptions };
}

/**
 * Check for exact reference match.
 */
function isExactReferenceMatch(
  stmtTx: StatementTransaction,
  intTx: InternalTransaction
): boolean {
  if (!stmtTx.reference || !intTx.reference) return false;

  return (
    stmtTx.reference.toLowerCase() === intTx.reference.toLowerCase() &&
    stmtTx.type === intTx.type &&
    Math.abs(stmtTx.amount - intTx.amount) <= stmtTx.amount * MATCH_AMOUNT_TOLERANCE
  );
}

/**
 * Check for amount + date match.
 */
function isAmountDateMatch(
  stmtTx: StatementTransaction,
  intTx: InternalTransaction
): boolean {
  const amountMatch =
    Math.abs(stmtTx.amount - intTx.amount) <= stmtTx.amount * MATCH_AMOUNT_TOLERANCE;

  const stmtDate = new Date(stmtTx.date);
  const intDate = new Date(intTx.date);
  const daysDiff = Math.abs(stmtDate.getTime() - intDate.getTime()) / (1000 * 60 * 60 * 24);
  const dateMatch = daysDiff <= MATCH_DATE_TOLERANCE_DAYS;

  const typeMatch = stmtTx.type === intTx.type;

  return amountMatch && dateMatch && typeMatch;
}

/**
 * Check for fuzzy description match.
 */
function isFuzzyMatch(
  stmtTx: StatementTransaction,
  intTx: InternalTransaction
): boolean {
  if (!stmtTx.description || !intTx.description) return false;

  const stmtWords = stmtTx.description.toLowerCase().split(/\s+/);
  const intWords = (intTx.description ?? '').toLowerCase().split(/\s+/);

  const commonWords = stmtWords.filter((w) => intWords.includes(w));
  const similarity = (commonWords.length * 2) / (stmtWords.length + intWords.length);

  return (
    similarity >= 0.5 &&
    stmtTx.type === intTx.type &&
    Math.abs(stmtTx.amount - intTx.amount) <= stmtTx.amount * MATCH_AMOUNT_TOLERANCE * 2
  );
}

/**
 * Calculate match confidence score.
 */
function calculateMatchConfidence(
  stmtTx: StatementTransaction,
  intTx: InternalTransaction
): number {
  let score = 0;

  // Amount match (40%)
  const amountDiff = Math.abs(stmtTx.amount - intTx.amount) / stmtTx.amount;
  if (amountDiff === 0) score += 0.4;
  else if (amountDiff <= 0.01) score += 0.35;
  else if (amountDiff <= 0.05) score += 0.2;

  // Date match (25%)
  const stmtDate = new Date(stmtTx.date);
  const intDate = new Date(intTx.date);
  const daysDiff = Math.abs(stmtDate.getTime() - intDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff === 0) score += 0.25;
  else if (daysDiff <= 1) score += 0.2;
  else if (daysDiff <= 3) score += 0.1;

  // Type match (15%)
  if (stmtTx.type === intTx.type) score += 0.15;

  // Reference match (15%)
  if (stmtTx.reference && intTx.reference) {
    if (stmtTx.reference.toLowerCase() === intTx.reference.toLowerCase()) {
      score += 0.15;
    } else if (
      stmtTx.reference.toLowerCase().includes(intTx.reference.toLowerCase()) ||
      intTx.reference.toLowerCase().includes(stmtTx.reference.toLowerCase())
    ) {
      score += 0.1;
    }
  }

  // Description similarity (5%)
  if (stmtTx.description && intTx.description) {
    const stmtWords = stmtTx.description.toLowerCase().split(/\s+/);
    const intWords = intTx.description.toLowerCase().split(/\s+/);
    const commonWords = stmtWords.filter((w) => intWords.includes(w));
    score += (commonWords.length / Math.max(stmtWords.length, intWords.length)) * 0.05;
  }

  return Math.min(1, score);
}

/**
 * Create a match result.
 */
function createMatch(
  stmtTx: StatementTransaction,
  intTx: InternalTransaction,
  confidence: number,
  matchType: MatchResult['matchType'],
  matchedFields: string[]
): MatchResult {
  return {
    matchId: uuidv4(),
    statementTransaction: stmtTx,
    internalTransaction: intTx,
    confidence,
    matchType,
    matchedFields,
    autoApproved: confidence >= AUTO_MATCH_THRESHOLD,
  };
}

/**
 * Create reconciliation session.
 */
async function createSession(session: ReconciliationSession): Promise<void> {
  await dynamoClient.send(
    new PutItemCommand({
      TableName: RECONCILIATION_SESSIONS_TABLE,
      Item: marshall({
        session_id: session.sessionId,
        account_id: session.accountId,
        statement_period: session.statementPeriod,
        status: session.status,
        metrics: session.metrics,
        created_at: session.createdAt,
      }),
    })
  );
}

/**
 * Update reconciliation session.
 */
async function updateSession(session: ReconciliationSession): Promise<void> {
  await dynamoClient.send(
    new UpdateItemCommand({
      TableName: RECONCILIATION_SESSIONS_TABLE,
      Key: marshall({
        session_id: session.sessionId,
        account_id: session.accountId,
      }),
      UpdateExpression: 'SET #status = :status, metrics = :metrics, completed_at = :completedAt, #error = :error',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#error': 'error',
      },
      ExpressionAttributeValues: marshall({
        ':status': session.status,
        ':metrics': session.metrics,
        ':completedAt': session.completedAt,
        ':error': session.error ?? null,
      }),
    })
  );
}

/**
 * Store matches in DynamoDB.
 */
async function storeMatches(sessionId: string, matches: MatchResult[]): Promise<void> {
  if (matches.length === 0) return;

  // Batch write in groups of 25
  for (let i = 0; i < matches.length; i += 25) {
    const batch = matches.slice(i, i + 25);

    await dynamoClient.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [RECONCILIATION_MATCHES_TABLE]: batch.map((match) => ({
            PutRequest: {
              Item: marshall({
                match_id: match.matchId,
                session_id: sessionId,
                statement_transaction_id: match.statementTransaction.transactionId,
                internal_transaction_id: match.internalTransaction.transactionId,
                confidence: match.confidence,
                match_type: match.matchType,
                matched_fields: match.matchedFields,
                auto_approved: match.autoApproved,
                statement_transaction: match.statementTransaction,
                internal_transaction: match.internalTransaction,
                created_at: new Date().toISOString(),
                expires_at: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
              }),
            },
          })),
        },
      })
    );
  }
}

/**
 * Store exceptions in DynamoDB.
 */
async function storeExceptions(exceptions: ExceptionRecord[]): Promise<void> {
  if (exceptions.length === 0) return;

  for (let i = 0; i < exceptions.length; i += 25) {
    const batch = exceptions.slice(i, i + 25);

    await dynamoClient.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [RECONCILIATION_EXCEPTIONS_TABLE]: batch.map((exc) => ({
            PutRequest: {
              Item: marshall({
                exception_id: exc.exceptionId,
                session_id: exc.sessionId,
                exception_type: exc.exceptionType,
                transaction: exc.transaction,
                status: exc.status,
                suggested_matches: exc.suggestedMatches,
                created_at: exc.createdAt,
              }),
            },
          })),
        },
      })
    );
  }
}

/**
 * Publish reconciliation events.
 */
async function publishReconciliationEvents(
  session: ReconciliationSession,
  matches: MatchResult[],
  exceptions: ExceptionRecord[]
): Promise<void> {
  const eventType =
    session.status === 'completed'
      ? 'Reconciliation.Completed'
      : session.status === 'pending_review'
      ? 'Reconciliation.ExceptionsDetected'
      : 'Reconciliation.Failed';

  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: EVENT_BUS_NAME,
          Source: 'banking-treasury.reconciliation',
          DetailType: eventType,
          Time: new Date(),
          Detail: JSON.stringify({
            aggregateType: 'Reconciliation',
            aggregateId: session.sessionId,
            sessionId: session.sessionId,
            accountId: session.accountId,
            status: session.status,
            metrics: session.metrics,
            period: session.statementPeriod,
          }),
        },
      ],
    })
  );

  // Publish to SNS if configured
  if (RECONCILIATION_TOPIC_ARN) {
    await snsClient.send(
      new PublishCommand({
        TopicArn: RECONCILIATION_TOPIC_ARN,
        Subject: `Reconciliation ${session.status}: ${session.accountId}`,
        Message: JSON.stringify({
          sessionId: session.sessionId,
          accountId: session.accountId,
          status: session.status,
          matchRate: `${(session.metrics.matchRate * 100).toFixed(1)}%`,
          autoMatched: session.metrics.autoMatched,
          exceptions: session.metrics.exceptions,
        }),
        MessageAttributes: {
          status: { DataType: 'String', StringValue: session.status },
          accountId: { DataType: 'String', StringValue: session.accountId },
        },
      })
    );
  }
}

/**
 * Archive processed statement.
 */
async function archiveStatement(originalKey: string, sessionId: string): Promise<void> {
  const archiveKey = originalKey.replace('raw/', 'processed/');

  // Copy to processed folder with session metadata
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BANK_STATEMENTS_BUCKET,
      Key: archiveKey,
      CopySource: `${BANK_STATEMENTS_BUCKET}/${originalKey}`,
      Metadata: {
        'reconciliation-session': sessionId,
        'processed-at': new Date().toISOString(),
      },
    })
  );
}

/**
 * Send alert for failed reconciliation.
 */
async function sendAlert(session: ReconciliationSession, error: Error): Promise<void> {
  if (!CRITICAL_ALERTS_TOPIC_ARN) return;

  await snsClient.send(
    new PublishCommand({
      TopicArn: CRITICAL_ALERTS_TOPIC_ARN,
      Subject: `RECONCILIATION FAILED: ${session.accountId}`,
      Message: JSON.stringify({
        sessionId: session.sessionId,
        accountId: session.accountId,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      MessageAttributes: {
        severity: { DataType: 'String', StringValue: 'critical' },
      },
    })
  );
}
