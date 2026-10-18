/**
 * Bank Statement Processor Lambda
 *
 * Processes uploaded bank statement files from S3.
 * Parses MT940, BAI2, CSV, and JSON formats.
 *
 * @module lambdas/bank-connectivity
 */

import type { S3Event, S3EventRecord } from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import { v4 as uuidv4 } from 'uuid';

// Environment
const STATEMENT_IMPORTS_TABLE = process.env.STATEMENT_IMPORTS_TABLE ?? 'statement-imports';
const BANK_STATEMENTS_BUCKET = process.env.BANK_STATEMENTS_BUCKET ?? 'bank-statements';
const RECONCILIATION_QUEUE_URL = process.env.RECONCILIATION_QUEUE_URL ?? '';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME ?? 'default';

// Clients
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const sqsClient = new SQSClient({});
const eventBridgeClient = new EventBridgeClient({});

/**
 * Parsed statement metadata.
 */
interface StatementMetadata {
  importId: string;
  accountId: string;
  bankId: string;
  statementDate: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  currency: string;
  transactionCount: number;
  totalCredits: number;
  totalDebits: number;
  format: 'MT940' | 'BAI2' | 'CSV' | 'JSON';
  s3Key: string;
  processedAt: string;
}

/**
 * Import record.
 */
interface ImportRecord {
  importId: string;
  accountId: string;
  status: 'processing' | 'completed' | 'failed' | 'pending_reconciliation';
  statementMetadata: StatementMetadata;
  importedAt: string;
  error?: string | undefined;
  reconSessionId?: string | undefined;
}

/**
 * Main handler for S3 events.
 */
export async function handler(event: S3Event): Promise<void> {
  console.log(`Processing ${event.Records.length} S3 events`);

  for (const record of event.Records) {
    await processS3Record(record);
  }
}

/**
 * Process a single S3 event record.
 */
async function processS3Record(record: S3EventRecord): Promise<void> {
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

  console.log(`Processing statement: s3://${bucket}/${key}`);

  const importId = uuidv4();
  const importRecord: ImportRecord = {
    importId,
    accountId: '', // Will be extracted from statement
    status: 'processing',
    statementMetadata: {} as StatementMetadata,
    importedAt: new Date().toISOString(),
  };

  try {
    // Determine format from file extension
    const format = getStatementFormat(key);

    // Download and parse statement
    const content = await downloadStatement(bucket, key);
    const metadata = await parseStatement(content, format, key);

    metadata.importId = importId;
    importRecord.accountId = metadata.accountId;
    importRecord.statementMetadata = metadata;

    // Check for duplicate imports
    const isDuplicate = await checkDuplicateImport(
      metadata.accountId,
      metadata.periodStart,
      metadata.periodEnd
    );

    if (isDuplicate) {
      console.log('Duplicate statement detected, skipping');
      importRecord.status = 'completed';
      importRecord.error = 'Duplicate statement - already imported';
      await saveImportRecord(importRecord);
      return;
    }

    // Save import record
    importRecord.status = 'pending_reconciliation';
    await saveImportRecord(importRecord);

    // Move file to processed folder
    await archiveStatement(bucket, key, importId);

    // Queue for reconciliation
    await queueForReconciliation(metadata);

    // Publish event
    await publishImportEvent(metadata);

    console.log('Statement processed successfully:', {
      importId,
      accountId: metadata.accountId,
      transactionCount: metadata.transactionCount,
    });
  } catch (error) {
    console.error('Statement processing failed:', error);

    importRecord.status = 'failed';
    importRecord.error = error instanceof Error ? error.message : 'Unknown error';
    await saveImportRecord(importRecord);

    // Move to error folder
    await moveToErrorFolder(bucket, key, importId, importRecord.error);

    throw error;
  }
}

/**
 * Get statement format from file extension.
 */
function getStatementFormat(key: string): StatementMetadata['format'] {
  const ext = key.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'mt940':
    case 'sta':
      return 'MT940';
    case 'bai2':
    case 'bai':
      return 'BAI2';
    case 'csv':
      return 'CSV';
    case 'json':
      return 'JSON';
    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
}

/**
 * Download statement from S3.
 */
async function downloadStatement(bucket: string, key: string): Promise<string> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );

  const content = await response.Body?.transformToString();
  if (!content) {
    throw new Error('Empty statement file');
  }

  return content;
}

/**
 * Parse statement based on format.
 */
async function parseStatement(
  content: string,
  format: StatementMetadata['format'],
  s3Key: string
): Promise<StatementMetadata> {
  switch (format) {
    case 'MT940':
      return parseMT940(content, s3Key);
    case 'BAI2':
      return parseBAI2(content, s3Key);
    case 'CSV':
      return parseCSV(content, s3Key);
    case 'JSON':
      return parseJSON(content, s3Key);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Parse MT940 SWIFT format.
 */
function parseMT940(content: string, s3Key: string): StatementMetadata {
  const lines = content.split('\n');

  let accountId = '';
  let bankId = '';
  let statementDate = '';
  let periodStart = '';
  let periodEnd = '';
  let openingBalance = 0;
  let closingBalance = 0;
  let currency = 'USD';
  let transactionCount = 0;
  let totalCredits = 0;
  let totalDebits = 0;

  for (const line of lines) {
    // Account identification (:25:)
    if (line.startsWith(':25:')) {
      const accountInfo = line.substring(4).trim();
      const parts = accountInfo.split('/');
      bankId = parts[0] ?? '';
      accountId = parts[1] ?? accountInfo;
    }

    // Statement number/sequence (:28C:)
    if (line.startsWith(':28C:')) {
      // Statement sequence
    }

    // Opening balance (:60F: or :60M:)
    if (line.startsWith(':60F:') || line.startsWith(':60M:')) {
      const balanceData = line.substring(5);
      const creditDebit = balanceData[0];
      const dateStr = balanceData.substring(1, 7);
      currency = balanceData.substring(7, 10);
      const amountStr = balanceData.substring(10).replace(',', '.');

      periodStart = `20${dateStr.substring(0, 2)}-${dateStr.substring(2, 4)}-${dateStr.substring(4, 6)}`;
      openingBalance = parseFloat(amountStr) * (creditDebit === 'D' ? -1 : 1);
    }

    // Closing balance (:62F: or :62M:)
    if (line.startsWith(':62F:') || line.startsWith(':62M:')) {
      const balanceData = line.substring(5);
      const creditDebit = balanceData[0];
      const dateStr = balanceData.substring(1, 7);
      const amountStr = balanceData.substring(10).replace(',', '.');

      periodEnd = `20${dateStr.substring(0, 2)}-${dateStr.substring(2, 4)}-${dateStr.substring(4, 6)}`;
      statementDate = periodEnd;
      closingBalance = parseFloat(amountStr) * (creditDebit === 'D' ? -1 : 1);
    }

    // Transaction (:61:)
    if (line.startsWith(':61:')) {
      transactionCount++;
      const txData = line.substring(4);
      const creditDebit = txData[10]; // Position varies, simplified
      const amountMatch = txData.match(/[CD](\d+),(\d+)/);

      if (amountMatch) {
        const amount = parseFloat(`${amountMatch[1]}.${amountMatch[2]}`);
        if (creditDebit === 'C') {
          totalCredits += amount;
        } else {
          totalDebits += amount;
        }
      }
    }
  }

  return {
    importId: '',
    accountId: accountId || `unknown-${Date.now()}`,
    bankId: bankId || 'unknown',
    statementDate: statementDate || new Date().toISOString().split('T')[0],
    periodStart: periodStart || statementDate,
    periodEnd: periodEnd || statementDate,
    openingBalance,
    closingBalance,
    currency,
    transactionCount,
    totalCredits,
    totalDebits,
    format: 'MT940',
    s3Key,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Parse BAI2 format.
 */
function parseBAI2(content: string, s3Key: string): StatementMetadata {
  const lines = content.split('\n');

  let accountId = '';
  let bankId = '';
  let currency = 'USD';
  let openingBalance = 0;
  let closingBalance = 0;
  let transactionCount = 0;
  let totalCredits = 0;
  let totalDebits = 0;
  let statementDate = '';

  for (const line of lines) {
    const parts = line.split(',');
    const recordType = parts[0];

    switch (recordType) {
      case '01': // File header
        bankId = parts[2] ?? '';
        break;

      case '02': // Group header
        bankId = bankId || parts[2] ?? '';
        break;

      case '03': // Account identifier
        accountId = parts[1] ?? '';
        currency = parts[2] ?? 'USD';
        // Type code 010 = opening ledger balance
        // Type code 015 = closing ledger balance
        for (let i = 3; i < parts.length; i += 3) {
          const typeCode = parts[i];
          const amount = parseInt(parts[i + 1] ?? '0', 10) / 100;
          if (typeCode === '010') openingBalance = amount;
          if (typeCode === '015') closingBalance = amount;
        }
        break;

      case '16': // Transaction detail
        transactionCount++;
        const txTypeCode = parseInt(parts[1] ?? '0', 10);
        const txAmount = parseInt(parts[2] ?? '0', 10) / 100;

        // Type codes 400-499 are credits, 100-399 are debits
        if (txTypeCode >= 400) {
          totalCredits += txAmount;
        } else {
          totalDebits += txAmount;
        }
        break;
    }
  }

  statementDate = new Date().toISOString().split('T')[0];

  return {
    importId: '',
    accountId: accountId || `unknown-${Date.now()}`,
    bankId,
    statementDate,
    periodStart: statementDate,
    periodEnd: statementDate,
    openingBalance,
    closingBalance,
    currency,
    transactionCount,
    totalCredits,
    totalDebits,
    format: 'BAI2',
    s3Key,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Parse CSV format.
 */
function parseCSV(content: string, s3Key: string): StatementMetadata {
  const lines = content.split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  let accountId = '';
  let currency = 'USD';
  let totalCredits = 0;
  let totalDebits = 0;
  let minDate = '';
  let maxDate = '';
  let transactionCount = 0;

  const dateIdx = headers.findIndex((h) => h.includes('date'));
  const amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('value'));
  const accountIdx = headers.findIndex((h) => h.includes('account'));
  const currencyIdx = headers.findIndex((h) => h.includes('currency'));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',');
    transactionCount++;

    if (accountIdx >= 0 && !accountId) {
      accountId = values[accountIdx]?.trim() ?? '';
    }

    if (currencyIdx >= 0 && !currency) {
      currency = values[currencyIdx]?.trim() ?? 'USD';
    }

    if (dateIdx >= 0) {
      const date = values[dateIdx]?.trim() ?? '';
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }

    if (amountIdx >= 0) {
      const amount = parseFloat(values[amountIdx] ?? '0');
      if (amount >= 0) {
        totalCredits += amount;
      } else {
        totalDebits += Math.abs(amount);
      }
    }
  }

  return {
    importId: '',
    accountId: accountId || `csv-${Date.now()}`,
    bankId: 'csv-import',
    statementDate: maxDate || new Date().toISOString().split('T')[0],
    periodStart: minDate || maxDate,
    periodEnd: maxDate || new Date().toISOString().split('T')[0],
    openingBalance: 0,
    closingBalance: 0,
    currency,
    transactionCount,
    totalCredits,
    totalDebits,
    format: 'CSV',
    s3Key,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Parse JSON format.
 */
function parseJSON(content: string, s3Key: string): StatementMetadata {
  const data = JSON.parse(content);

  const transactions = data.transactions ?? data.entries ?? [];
  let totalCredits = 0;
  let totalDebits = 0;

  for (const tx of transactions) {
    const amount = tx.amount ?? tx.value ?? 0;
    if (amount >= 0) {
      totalCredits += amount;
    } else {
      totalDebits += Math.abs(amount);
    }
  }

  return {
    importId: '',
    accountId: data.accountId ?? data.account_id ?? `json-${Date.now()}`,
    bankId: data.bankId ?? data.bank_id ?? 'json-import',
    statementDate: data.statementDate ?? data.statement_date ?? new Date().toISOString().split('T')[0],
    periodStart: data.periodStart ?? data.period_start ?? data.statementDate,
    periodEnd: data.periodEnd ?? data.period_end ?? data.statementDate,
    openingBalance: data.openingBalance ?? data.opening_balance ?? 0,
    closingBalance: data.closingBalance ?? data.closing_balance ?? 0,
    currency: data.currency ?? 'USD',
    transactionCount: transactions.length,
    totalCredits,
    totalDebits,
    format: 'JSON',
    s3Key,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Check for duplicate import.
 */
async function checkDuplicateImport(
  accountId: string,
  periodStart: string,
  periodEnd: string
): Promise<boolean> {
  const response = await dynamoClient.send(
    new QueryCommand({
      TableName: STATEMENT_IMPORTS_TABLE,
      IndexName: 'account-index',
      KeyConditionExpression: 'account_id = :accountId',
      FilterExpression: 'statement_metadata.period_start = :periodStart AND statement_metadata.period_end = :periodEnd AND #status <> :failed',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: marshall({
        ':accountId': accountId,
        ':periodStart': periodStart,
        ':periodEnd': periodEnd,
        ':failed': 'failed',
      }),
      Limit: 1,
    })
  );

  return (response.Items?.length ?? 0) > 0;
}

/**
 * Save import record.
 */
async function saveImportRecord(record: ImportRecord): Promise<void> {
  await dynamoClient.send(
    new PutItemCommand({
      TableName: STATEMENT_IMPORTS_TABLE,
      Item: marshall({
        import_id: record.importId,
        account_id: record.accountId,
        status: record.status,
        statement_metadata: record.statementMetadata,
        imported_at: record.importedAt,
        error: record.error,
        recon_session_id: record.reconSessionId,
        expires_at: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
      }),
    })
  );
}

/**
 * Archive processed statement.
 */
async function archiveStatement(
  bucket: string,
  key: string,
  importId: string
): Promise<void> {
  const archiveKey = key.replace('raw/', 'processed/').replace(/(\.[^.]+)$/, `-${importId}$1`);

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${key}`,
      Key: archiveKey,
      Metadata: {
        'import-id': importId,
        'processed-at': new Date().toISOString(),
      },
      MetadataDirective: 'REPLACE',
    })
  );
}

/**
 * Move failed statement to error folder.
 */
async function moveToErrorFolder(
  bucket: string,
  key: string,
  importId: string,
  error: string
): Promise<void> {
  const errorKey = key.replace('raw/', 'errors/').replace(/(\.[^.]+)$/, `-${importId}$1`);

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${key}`,
      Key: errorKey,
      Metadata: {
        'import-id': importId,
        'error': error.substring(0, 1024),
        'failed-at': new Date().toISOString(),
      },
      MetadataDirective: 'REPLACE',
    })
  );
}

/**
 * Queue statement for reconciliation.
 */
async function queueForReconciliation(metadata: StatementMetadata): Promise<void> {
  if (!RECONCILIATION_QUEUE_URL) {
    console.log('Reconciliation queue not configured, skipping');
    return;
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: RECONCILIATION_QUEUE_URL,
      MessageBody: JSON.stringify({
        accountId: metadata.accountId,
        statementKey: metadata.s3Key.replace('raw/', 'processed/').replace(
          /(\.[^.]+)$/,
          `-${metadata.importId}$1`
        ),
        statementFormat: metadata.format,
        periodStart: metadata.periodStart,
        periodEnd: metadata.periodEnd,
        metadata: {
          importId: metadata.importId,
          transactionCount: metadata.transactionCount,
        },
      }),
    })
  );

  console.log('Queued for reconciliation:', metadata.importId);
}

/**
 * Publish import event.
 */
async function publishImportEvent(metadata: StatementMetadata): Promise<void> {
  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: EVENT_BUS_NAME,
          Source: 'banking-treasury.bank-connectivity',
          DetailType: 'Statement.Imported',
          Time: new Date(),
          Detail: JSON.stringify({
            aggregateType: 'Statement',
            aggregateId: metadata.importId,
            importId: metadata.importId,
            accountId: metadata.accountId,
            bankId: metadata.bankId,
            format: metadata.format,
            transactionCount: metadata.transactionCount,
            periodStart: metadata.periodStart,
            periodEnd: metadata.periodEnd,
            processedAt: metadata.processedAt,
          }),
        },
      ],
    })
  );
}
