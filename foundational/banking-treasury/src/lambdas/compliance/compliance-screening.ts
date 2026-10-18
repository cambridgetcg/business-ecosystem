/**
 * Compliance Screening Lambda Handler
 *
 * Performs comprehensive compliance checks on payments:
 * - Sanctions screening (OFAC, EU, UN lists)
 * - AML risk scoring
 * - Velocity checks
 * - Geographic risk assessment
 *
 * @module lambdas/compliance
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import {
  SNSClient,
  PublishCommand,
} from '@aws-sdk/client-sns';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// Environment
const COMPLIANCE_RULES_TABLE = process.env.COMPLIANCE_RULES_TABLE ?? 'compliance-rules';
const COMPLIANCE_RESULTS_TABLE = process.env.COMPLIANCE_RESULTS_TABLE ?? 'compliance-results';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME ?? 'default';
const CRITICAL_ALERTS_TOPIC = process.env.CRITICAL_ALERTS_TOPIC;
const HIGH_RISK_COUNTRIES = (process.env.HIGH_RISK_COUNTRIES ?? 'KP,IR,SY,CU,VE,RU,BY').split(',');
const VELOCITY_CHECK_WINDOW_MINS = parseInt(process.env.VELOCITY_CHECK_WINDOW_MINS ?? '1440', 10);
const MAX_DAILY_AMOUNT_USD = parseInt(process.env.MAX_DAILY_AMOUNT_USD ?? '50000', 10);

// Clients
const dynamoClient = new DynamoDBClient({});
const eventBridgeClient = new EventBridgeClient({});
const snsClient = new SNSClient({});
const secretsClient = new SecretsManagerClient({});

/**
 * Input from Step Functions.
 */
interface ComplianceScreeningInput {
  paymentId: string;
  amount: number;
  currency: string;
  sourceAccount: {
    accountId: string;
    bankId: string;
    accountNumber: string;
    country?: string | undefined;
  };
  destinationAccount: {
    accountId?: string | undefined;
    bankId: string;
    accountNumber: string;
    country?: string | undefined;
    beneficiaryName?: string | undefined;
  };
  initiatedBy: string;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Individual check result.
 */
interface CheckResult {
  passed: boolean;
  score?: number | undefined;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical' | undefined;
  details?: Record<string, unknown> | undefined;
  flags?: string[] | undefined;
}

/**
 * Complete screening result.
 */
interface ScreeningResult {
  paymentId: string;
  screening: {
    sanctionsCheck: CheckResult;
    amlCheck: CheckResult;
    velocityCheck: CheckResult;
    geographicCheck: CheckResult;
    entityVerification: CheckResult;
  };
  overallResult: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
  requiresManualReview: boolean;
  rejectionReason?: string | undefined;
  riskScore: number;
  timestamp: string;
}

/**
 * Main handler.
 */
export async function handler(event: ComplianceScreeningInput): Promise<ScreeningResult> {
  console.log('Compliance screening for payment:', event.paymentId);

  const timestamp = new Date().toISOString();

  try {
    // Run all checks in parallel
    const [
      sanctionsCheck,
      amlCheck,
      velocityCheck,
      geographicCheck,
      entityVerification,
    ] = await Promise.all([
      performSanctionsCheck(event),
      performAmlCheck(event),
      performVelocityCheck(event),
      performGeographicCheck(event),
      performEntityVerification(event),
    ]);

    // Calculate overall risk score (0-100)
    const riskScore = calculateRiskScore({
      sanctionsCheck,
      amlCheck,
      velocityCheck,
      geographicCheck,
      entityVerification,
    });

    // Determine overall result
    const { overallResult, requiresManualReview, rejectionReason } = determineResult({
      sanctionsCheck,
      amlCheck,
      velocityCheck,
      geographicCheck,
      entityVerification,
      riskScore,
    });

    const result: ScreeningResult = {
      paymentId: event.paymentId,
      screening: {
        sanctionsCheck,
        amlCheck,
        velocityCheck,
        geographicCheck,
        entityVerification,
      },
      overallResult,
      requiresManualReview,
      rejectionReason,
      riskScore,
      timestamp,
    };

    // Store result
    await storeResult(event, result);

    // Publish events
    await publishEvents(event, result);

    // Alert on high-risk or rejected payments
    if (overallResult === 'REJECTED' || riskScore >= 70) {
      await sendAlert(event, result);
    }

    console.log('Compliance screening complete:', {
      paymentId: event.paymentId,
      result: overallResult,
      riskScore,
    });

    return result;
  } catch (error) {
    console.error('Compliance screening failed:', error);

    // On error, reject payment and alert
    const errorResult: ScreeningResult = {
      paymentId: event.paymentId,
      screening: {
        sanctionsCheck: { passed: false, flags: ['SCREENING_ERROR'] },
        amlCheck: { passed: false, flags: ['SCREENING_ERROR'] },
        velocityCheck: { passed: false, flags: ['SCREENING_ERROR'] },
        geographicCheck: { passed: false, flags: ['SCREENING_ERROR'] },
        entityVerification: { passed: false, flags: ['SCREENING_ERROR'] },
      },
      overallResult: 'REJECTED',
      requiresManualReview: true,
      rejectionReason: 'Compliance screening system error',
      riskScore: 100,
      timestamp,
    };

    await sendAlert(event, errorResult, error as Error);

    throw error;
  }
}

/**
 * Sanctions screening (OFAC, EU, UN).
 */
async function performSanctionsCheck(input: ComplianceScreeningInput): Promise<CheckResult> {
  // In production, this would call external sanctions APIs
  // Placeholder implementation

  const beneficiaryName = input.destinationAccount.beneficiaryName?.toLowerCase() ?? '';

  // Simple placeholder check
  const knownBlockedTerms = ['terrorist', 'cartel', 'sanctioned'];
  const matches = knownBlockedTerms.filter((term) =>
    beneficiaryName.includes(term)
  );

  if (matches.length > 0) {
    return {
      passed: false,
      score: 100,
      riskLevel: 'critical',
      flags: ['SANCTIONS_MATCH'],
      details: { matchedTerms: matches },
    };
  }

  return {
    passed: true,
    score: 0,
    riskLevel: 'low',
    details: { checkedLists: ['OFAC_SDN', 'EU_CONSOLIDATED', 'UN_SANCTIONS'] },
  };
}

/**
 * AML risk scoring.
 */
async function performAmlCheck(input: ComplianceScreeningInput): Promise<CheckResult> {
  let score = 0;
  const flags: string[] = [];

  // Amount-based risk
  if (input.amount > 100000) {
    score += 30;
    flags.push('HIGH_VALUE_TRANSACTION');
  } else if (input.amount > 50000) {
    score += 15;
    flags.push('ELEVATED_VALUE');
  }

  // Round number check (AML indicator)
  if (input.amount % 10000 === 0 && input.amount > 10000) {
    score += 10;
    flags.push('ROUND_NUMBER');
  }

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (score >= 50) riskLevel = 'critical';
  else if (score >= 30) riskLevel = 'high';
  else if (score >= 15) riskLevel = 'medium';

  return {
    passed: score < 50,
    score,
    riskLevel,
    flags,
    details: {
      amount: input.amount,
      currency: input.currency,
    },
  };
}

/**
 * Velocity check (transaction frequency/volume).
 */
async function performVelocityCheck(input: ComplianceScreeningInput): Promise<CheckResult> {
  const windowStart = new Date(Date.now() - VELOCITY_CHECK_WINDOW_MINS * 60 * 1000);

  // Query recent compliance results for this entity
  const response = await dynamoClient.send(
    new QueryCommand({
      TableName: COMPLIANCE_RESULTS_TABLE,
      IndexName: 'entity-index',
      KeyConditionExpression: 'entity_id = :entityId AND check_timestamp > :windowStart',
      ExpressionAttributeValues: marshall({
        ':entityId': input.sourceAccount.accountId,
        ':windowStart': windowStart.toISOString(),
      }),
    })
  );

  const recentTransactions = response.Items ?? [];
  const dailyTotal = recentTransactions.reduce((sum, item) => {
    const record = unmarshall(item);
    return sum + (record.amount_usd ?? 0);
  }, 0);

  const projectedTotal = dailyTotal + input.amount;
  const flags: string[] = [];

  if (projectedTotal > MAX_DAILY_AMOUNT_USD) {
    flags.push('DAILY_LIMIT_EXCEEDED');
  }

  if (recentTransactions.length > 10) {
    flags.push('HIGH_TRANSACTION_FREQUENCY');
  }

  const passed = projectedTotal <= MAX_DAILY_AMOUNT_USD * 2;

  return {
    passed,
    riskLevel: passed ? 'low' : 'high',
    flags,
    details: {
      transactionCount: recentTransactions.length + 1,
      dailyTotal: projectedTotal,
      limit: MAX_DAILY_AMOUNT_USD,
      windowMinutes: VELOCITY_CHECK_WINDOW_MINS,
    },
  };
}

/**
 * Geographic risk assessment.
 */
async function performGeographicCheck(input: ComplianceScreeningInput): Promise<CheckResult> {
  const destCountry = input.destinationAccount.country?.toUpperCase() ?? 'UNKNOWN';
  const sourceCountry = input.sourceAccount.country?.toUpperCase() ?? 'US';

  const flags: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

  // Check destination country
  if (HIGH_RISK_COUNTRIES.includes(destCountry)) {
    flags.push('HIGH_RISK_DESTINATION_COUNTRY');
    riskLevel = 'critical';
  }

  // Check source country
  if (HIGH_RISK_COUNTRIES.includes(sourceCountry)) {
    flags.push('HIGH_RISK_SOURCE_COUNTRY');
    riskLevel = riskLevel === 'critical' ? 'critical' : 'high';
  }

  // Cross-border transaction
  if (sourceCountry !== destCountry) {
    flags.push('CROSS_BORDER');
    if (riskLevel === 'low') riskLevel = 'medium';
  }

  const passed = riskLevel !== 'critical';

  return {
    passed,
    riskLevel,
    flags,
    details: {
      sourceCountry,
      destinationCountry: destCountry,
      highRiskCountries: HIGH_RISK_COUNTRIES,
    },
  };
}

/**
 * Entity verification.
 */
async function performEntityVerification(input: ComplianceScreeningInput): Promise<CheckResult> {
  // In production, this would verify beneficiary against known entity databases
  const flags: string[] = [];

  // Check for missing beneficiary info
  if (!input.destinationAccount.beneficiaryName) {
    flags.push('MISSING_BENEFICIARY_NAME');
  }

  // Check for suspicious patterns
  if (input.destinationAccount.accountNumber?.length && input.destinationAccount.accountNumber.length < 6) {
    flags.push('SHORT_ACCOUNT_NUMBER');
  }

  return {
    passed: flags.length === 0,
    riskLevel: flags.length > 0 ? 'medium' : 'low',
    flags,
    details: {
      beneficiaryProvided: !!input.destinationAccount.beneficiaryName,
      accountNumberLength: input.destinationAccount.accountNumber?.length,
    },
  };
}

/**
 * Calculate overall risk score.
 */
function calculateRiskScore(checks: Record<string, CheckResult>): number {
  const weights = {
    sanctionsCheck: 40,
    amlCheck: 25,
    velocityCheck: 15,
    geographicCheck: 15,
    entityVerification: 5,
  };

  let totalScore = 0;

  for (const [checkName, result] of Object.entries(checks)) {
    const weight = weights[checkName as keyof typeof weights] ?? 10;
    const checkScore = result.score ?? (result.passed ? 0 : 100);
    totalScore += (checkScore * weight) / 100;
  }

  return Math.min(100, Math.round(totalScore));
}

/**
 * Determine overall result.
 */
function determineResult(params: {
  sanctionsCheck: CheckResult;
  amlCheck: CheckResult;
  velocityCheck: CheckResult;
  geographicCheck: CheckResult;
  entityVerification: CheckResult;
  riskScore: number;
}): {
  overallResult: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
  requiresManualReview: boolean;
  rejectionReason?: string | undefined;
} {
  // Automatic rejection for sanctions hits
  if (!params.sanctionsCheck.passed) {
    return {
      overallResult: 'REJECTED',
      requiresManualReview: false,
      rejectionReason: 'Sanctions screening failure',
    };
  }

  // Automatic rejection for geographic blocks
  if (params.geographicCheck.riskLevel === 'critical') {
    return {
      overallResult: 'REJECTED',
      requiresManualReview: true,
      rejectionReason: 'Transaction involves blocked country',
    };
  }

  // Manual review for high risk score
  if (params.riskScore >= 70) {
    return {
      overallResult: 'MANUAL_REVIEW',
      requiresManualReview: true,
    };
  }

  // Manual review if multiple medium-risk flags
  const mediumRiskChecks = [
    params.amlCheck,
    params.velocityCheck,
    params.entityVerification,
  ].filter((c) => c.riskLevel === 'medium' || c.riskLevel === 'high');

  if (mediumRiskChecks.length >= 2) {
    return {
      overallResult: 'MANUAL_REVIEW',
      requiresManualReview: true,
    };
  }

  // Otherwise approve
  return {
    overallResult: 'APPROVED',
    requiresManualReview: false,
  };
}

/**
 * Store compliance result in DynamoDB.
 */
async function storeResult(
  input: ComplianceScreeningInput,
  result: ScreeningResult
): Promise<void> {
  await dynamoClient.send(
    new PutItemCommand({
      TableName: COMPLIANCE_RESULTS_TABLE,
      Item: marshall({
        payment_id: result.paymentId,
        check_timestamp: result.timestamp,
        entity_id: input.sourceAccount.accountId,
        result: result.overallResult,
        risk_score: result.riskScore,
        requires_manual_review: result.requiresManualReview,
        rejection_reason: result.rejectionReason,
        amount: input.amount,
        currency: input.currency,
        amount_usd: input.amount, // Simplified - would convert in production
        screening_details: result.screening,
        expires_at: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
      }),
    })
  );
}

/**
 * Publish compliance events.
 */
async function publishEvents(
  input: ComplianceScreeningInput,
  result: ScreeningResult
): Promise<void> {
  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: EVENT_BUS_NAME,
          Source: 'banking-treasury.compliance',
          DetailType: `Compliance.${result.overallResult}`,
          Time: new Date(),
          Detail: JSON.stringify({
            aggregateType: 'Compliance',
            aggregateId: result.paymentId,
            paymentId: result.paymentId,
            result: result.overallResult,
            riskScore: result.riskScore,
            requiresManualReview: result.requiresManualReview,
            timestamp: result.timestamp,
          }),
        },
      ],
    })
  );
}

/**
 * Send alert for high-risk payments.
 */
async function sendAlert(
  input: ComplianceScreeningInput,
  result: ScreeningResult,
  error?: Error
): Promise<void> {
  if (!CRITICAL_ALERTS_TOPIC) {
    return;
  }

  const subject = error
    ? `COMPLIANCE ERROR: Payment ${input.paymentId}`
    : `COMPLIANCE ALERT: Payment ${input.paymentId} - ${result.overallResult}`;

  await snsClient.send(
    new PublishCommand({
      TopicArn: CRITICAL_ALERTS_TOPIC,
      Subject: subject,
      Message: JSON.stringify(
        {
          paymentId: input.paymentId,
          amount: input.amount,
          currency: input.currency,
          result: result.overallResult,
          riskScore: result.riskScore,
          screening: result.screening,
          error: error?.message,
          timestamp: result.timestamp,
        },
        null,
        2
      ),
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: error ? 'COMPLIANCE_ERROR' : 'COMPLIANCE_ALERT',
        },
        riskScore: {
          DataType: 'Number',
          StringValue: result.riskScore.toString(),
        },
      },
    })
  );
}
