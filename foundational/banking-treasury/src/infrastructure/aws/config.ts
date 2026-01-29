/**
 * AWS Infrastructure Configuration
 * 
 * Centralized configuration for AWS services used by banking-treasury.
 * Values loaded from environment or defaults for dev.
 */

export const awsConfig = {
  region: process.env.AWS_REGION ?? 'us-east-1',
  
  // SNS Topics for event publishing
  sns: {
    bankingTreasuryEvents: process.env.SNS_BANKING_TREASURY_TOPIC ?? 
      'arn:aws:sns:us-east-1:034362054546:business-ecosystem-banking-treasury-events',
  },
  
  // SQS Queues for event consumption
  sqs: {
    eventsQueue: process.env.SQS_EVENTS_QUEUE ?? 
      'https://sqs.us-east-1.amazonaws.com/034362054546/business-ecosystem-banking-treasury-events-queue',
    accountingIntegrationQueue: process.env.SQS_ACCOUNTING_QUEUE ??
      'https://sqs.us-east-1.amazonaws.com/034362054546/business-ecosystem-accounting-integration-queue',
    dlq: process.env.SQS_DLQ ??
      'https://sqs.us-east-1.amazonaws.com/034362054546/business-ecosystem-banking-treasury-dlq',
  },
  
  // Secrets Manager
  secrets: {
    databaseCredentials: process.env.DB_CREDENTIALS_SECRET ?? 
      'business-ecosystem/database-credentials',
  },
  
  // S3 for document storage
  s3: {
    documentsBucket: process.env.S3_DOCUMENTS_BUCKET ?? 
      'business-ecosystem-documents-dev',
  },
};
