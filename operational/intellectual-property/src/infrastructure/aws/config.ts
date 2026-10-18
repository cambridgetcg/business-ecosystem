/**
 * AWS Infrastructure Configuration
 *
 * Centralized configuration for AWS services used by intellectual-property.
 * Values loaded from environment or defaults for dev.
 *
 * @module infrastructure/aws
 */

const environment = process.env.NODE_ENV ?? 'development';
const accountId = process.env.AWS_ACCOUNT_ID ?? '034362054546';
const region = process.env.AWS_REGION ?? 'us-east-1';

export const awsConfig = {
  region,
  accountId,
  environment,

  // EventBridge for event routing
  eventBridge: {
    eventBusName: process.env.EVENTBRIDGE_BUS_NAME ??
      `intellectual-property-${environment}-events`,
    eventBusArn: process.env.EVENTBRIDGE_BUS_ARN ??
      `arn:aws:events:${region}:${accountId}:event-bus/intellectual-property-${environment}-events`,
  },

  // SNS Topics for event distribution
  sns: {
    deadlineAlerts: process.env.SNS_DEADLINE_ALERTS_TOPIC ??
      `arn:aws:sns:${region}:${accountId}:intellectual-property-${environment}-deadline-alerts`,
    criticalAlerts: process.env.SNS_CRITICAL_ALERTS_TOPIC ??
      `arn:aws:sns:${region}:${accountId}:intellectual-property-${environment}-critical-alerts`,
    ipEvents: process.env.SNS_IP_EVENTS_TOPIC ??
      `arn:aws:sns:${region}:${accountId}:intellectual-property-${environment}-events`,
    tradeSecretAlerts: process.env.SNS_TRADE_SECRET_ALERTS_TOPIC ??
      `arn:aws:sns:${region}:${accountId}:intellectual-property-${environment}-trade-secret-alerts`,
    crossService: process.env.SNS_CROSS_SERVICE_TOPIC ??
      `arn:aws:sns:${region}:${accountId}:intellectual-property-${environment}-cross-service`,
  },

  // S3 Buckets
  s3: {
    documentsBucket: process.env.S3_IP_DOCUMENTS_BUCKET ??
      `intellectual-property-${environment}-documents-${accountId}`,
    tradeSecretsBucket: process.env.S3_TRADE_SECRETS_BUCKET ??
      `intellectual-property-${environment}-trade-secrets-${accountId}`,
  },

  // KMS Keys
  kms: {
    documentsKeyId: process.env.KMS_DOCUMENTS_KEY_ID ??
      `alias/intellectual-property-${environment}-documents`,
    tradeSecretsKeyId: process.env.KMS_TRADE_SECRETS_KEY_ID ??
      `alias/intellectual-property-${environment}-trade-secrets`,
  },

  // DynamoDB
  dynamodb: {
    deadlinesTable: process.env.DYNAMODB_DEADLINES_TABLE ??
      `intellectual-property-${environment}-deadlines`,
    eventsTable: process.env.DYNAMODB_EVENTS_TABLE ??
      `intellectual-property-${environment}-events`,
  },

  // CloudWatch
  cloudWatch: {
    auditLogGroup: process.env.CLOUDWATCH_AUDIT_LOG_GROUP ??
      `/intellectual-property/${environment}/audit`,
    applicationLogGroup: process.env.CLOUDWATCH_APPLICATION_LOG_GROUP ??
      `/intellectual-property/${environment}/application`,
    tradeSecretLogGroup: process.env.CLOUDWATCH_TRADE_SECRET_LOG_GROUP ??
      `/intellectual-property/${environment}/trade-secret-access`,
  },
};
