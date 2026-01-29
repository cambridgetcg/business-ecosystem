/**
 * Progress Analyzer Lambda
 *
 * Processes DynamoDB streams to detect changes and calculate trends.
 * Also handles scheduled stale app checks.
 */

import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import { unmarshall, marshall } from '@aws-sdk/util-dynamodb';

const dynamodb = new DynamoDBClient({});
const sns = new SNSClient({});
const cloudwatch = new CloudWatchClient({});

const {
  DYNAMODB_TABLE,
  MILESTONES_TABLE,
  SNS_ALERTS_TOPIC,
  ENVIRONMENT,
} = process.env;

interface StreamRecord {
  eventName: 'INSERT' | 'MODIFY' | 'REMOVE';
  dynamodb: {
    Keys: any;
    OldImage?: any;
    NewImage?: any;
  };
}

/**
 * Analyze progress change
 */
function analyzeChange(oldImage: any, newImage: any): {
  type: 'improvement' | 'regression' | 'status_change' | 'blocker_change' | 'none';
  details: string;
  severity: 'info' | 'warning' | 'critical';
} {
  const oldProgress = oldImage?.progress || 0;
  const newProgress = newImage?.progress || 0;
  const oldStatus = oldImage?.status;
  const newStatus = newImage?.status;
  const oldBlockers = oldImage?.blockers || [];
  const newBlockers = newImage?.blockers || [];

  // Check for regression
  if (newProgress < oldProgress - 0.05) {
    return {
      type: 'regression',
      details: `Progress decreased from ${Math.round(oldProgress * 100)}% to ${Math.round(newProgress * 100)}%`,
      severity: 'warning',
    };
  }

  // Check for significant improvement
  if (newProgress >= oldProgress + 0.1) {
    return {
      type: 'improvement',
      details: `Progress increased from ${Math.round(oldProgress * 100)}% to ${Math.round(newProgress * 100)}%`,
      severity: 'info',
    };
  }

  // Check for status change
  if (oldStatus !== newStatus) {
    const isPromotion =
      (oldStatus === 'placeholder' && newStatus !== 'placeholder') ||
      (oldStatus === 'skeleton' && ['active', 'ready'].includes(newStatus)) ||
      (oldStatus === 'active' && newStatus === 'ready');

    return {
      type: 'status_change',
      details: `Status changed from ${oldStatus} to ${newStatus}`,
      severity: isPromotion ? 'info' : 'warning',
    };
  }

  // Check for new blockers
  const newBlockerAdded = newBlockers.some((b: string) => !oldBlockers.includes(b));
  if (newBlockerAdded) {
    return {
      type: 'blocker_change',
      details: `New blocker added: ${newBlockers.filter((b: string) => !oldBlockers.includes(b)).join(', ')}`,
      severity: 'warning',
    };
  }

  return { type: 'none', details: '', severity: 'info' };
}

/**
 * Record a change event
 */
async function recordEvent(
  app: string,
  eventType: string,
  details: string,
  severity: string
): Promise<void> {
  const timestamp = new Date().toISOString();

  await dynamodb.send(
    new PutItemCommand({
      TableName: MILESTONES_TABLE,
      Item: marshall({
        pk: `APP#${app}`,
        sk: `EVENT#${timestamp}`,
        eventType,
        details,
        severity,
        timestamp,
        ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      }),
    })
  );
}

/**
 * Process DynamoDB stream records
 */
async function processStreamRecords(records: StreamRecord[]): Promise<void> {
  for (const record of records) {
    if (record.eventName === 'REMOVE') continue;

    const newImage = record.dynamodb.NewImage
      ? unmarshall(record.dynamodb.NewImage)
      : null;
    const oldImage = record.dynamodb.OldImage
      ? unmarshall(record.dynamodb.OldImage)
      : null;

    if (!newImage) continue;

    // Only process app status records
    if (!newImage.pk?.startsWith('APP#') || newImage.sk !== 'STATUS') continue;

    const appPath = newImage.pk.replace('APP#', '');

    if (oldImage) {
      const change = analyzeChange(oldImage, newImage);

      if (change.type !== 'none') {
        console.log(`Change detected for ${appPath}:`, change);

        // Record the event
        await recordEvent(appPath, change.type, change.details, change.severity);

        // Send alert for warnings/critical
        if (change.severity !== 'info') {
          await sns.send(
            new PublishCommand({
              TopicArn: SNS_ALERTS_TOPIC,
              Subject: `[${change.severity.toUpperCase()}] Progress Alert: ${appPath}`,
              Message: JSON.stringify({
                app: appPath,
                type: change.type,
                details: change.details,
                severity: change.severity,
                timestamp: new Date().toISOString(),
                oldProgress: oldImage.progress,
                newProgress: newImage.progress,
              }),
              MessageAttributes: {
                eventType: { DataType: 'String', StringValue: change.type },
                severity: { DataType: 'String', StringValue: change.severity },
              },
            })
          );
        }
      }
    }
  }
}

/**
 * Check for stale apps
 */
async function checkStaleApps(staleDays: number): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - staleDays);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // Query active apps with old lastActivity
  const result = await dynamodb.send(
    new QueryCommand({
      TableName: DYNAMODB_TABLE,
      IndexName: 'gsi2-status-activity',
      KeyConditionExpression: 'gsi2pk = :status AND gsi2sk < :cutoff',
      ExpressionAttributeValues: marshall({
        ':status': 'active',
        ':cutoff': cutoffStr,
      }),
    })
  );

  const staleApps = (result.Items || []).map((item) => unmarshall(item));

  if (staleApps.length > 0) {
    console.log(`Found ${staleApps.length} stale apps`);

    // Publish metric
    await cloudwatch.send(
      new PutMetricDataCommand({
        Namespace: 'EcosystemProgress',
        MetricData: [
          {
            MetricName: 'StaleApps',
            Value: staleApps.length,
            Unit: 'Count',
            Timestamp: new Date(),
            Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT! }],
          },
        ],
      })
    );

    // Send alert
    await sns.send(
      new PublishCommand({
        TopicArn: SNS_ALERTS_TOPIC,
        Subject: `[WARNING] ${staleApps.length} Stale Apps Detected`,
        Message: JSON.stringify({
          type: 'stale_apps',
          count: staleApps.length,
          apps: staleApps.map((a) => ({
            path: a.path,
            name: a.name,
            lastActivity: a.lastActivity,
            progress: a.progress,
          })),
          staleDays,
          timestamp: new Date().toISOString(),
        }),
        MessageAttributes: {
          eventType: { DataType: 'String', StringValue: 'stale_apps' },
          severity: { DataType: 'String', StringValue: 'warning' },
        },
      })
    );
  }
}

/**
 * Main handler
 */
export async function handler(event: any): Promise<void> {
  console.log('Event:', JSON.stringify(event, null, 2));

  // Handle scheduled stale check
  if (event.source === 'scheduled' && event.action === 'stale_check') {
    const staleDays = event.staleDays || 14;
    await checkStaleApps(staleDays);
    return;
  }

  // Handle DynamoDB stream
  if (event.Records) {
    await processStreamRecords(event.Records);
    return;
  }

  console.log('Unknown event type');
}
