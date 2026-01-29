/**
 * Progress Comparator Lambda
 *
 * Compares progress snapshots to detect milestones and significant changes.
 * Triggered by S3 events when new snapshots are uploaded.
 */

import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const s3 = new S3Client({});
const dynamodb = new DynamoDBClient({});
const sns = new SNSClient({});
const cloudwatch = new CloudWatchClient({});

const {
  S3_BUCKET,
  DYNAMODB_TABLE,
  MILESTONES_TABLE,
  SNS_MILESTONES_TOPIC,
  SNS_BLOCKERS_TOPIC,
  ENVIRONMENT,
} = process.env;

interface AppStatus {
  name: string;
  path: string;
  layer: string;
  status: string;
  progress: number;
  currentWaypoint: string | null;
  waypointName: string | null;
  blockers: string[];
}

interface EcosystemStatus {
  lastUpdated: string;
  summary: {
    totalApps: number;
    productionReady: number;
    inDevelopment: number;
    overallProgress: number;
  };
  apps: Record<string, AppStatus>;
}

interface MilestoneEvent {
  app: string;
  type: 'waypoint_complete' | 'status_promotion' | 'progress_milestone';
  description: string;
  oldValue?: any;
  newValue?: any;
}

/**
 * Get previous snapshot from S3
 */
async function getPreviousSnapshot(): Promise<EcosystemStatus | null> {
  // Get list of snapshots and find the previous one
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const datePath = `${yesterday.getFullYear()}/${String(yesterday.getMonth() + 1).padStart(2, '0')}/${String(yesterday.getDate()).padStart(2, '0')}`;

  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: `snapshots/${datePath}/ecosystem-status.json`,
      })
    );
    const body = await response.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      console.log('No previous snapshot found');
      return null;
    }
    throw error;
  }
}

/**
 * Get current snapshot from S3
 */
async function getCurrentSnapshot(key: string): Promise<EcosystemStatus> {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
  const body = await response.Body?.transformToString();
  return JSON.parse(body!);
}

/**
 * Detect milestones by comparing snapshots
 */
function detectMilestones(
  previous: EcosystemStatus | null,
  current: EcosystemStatus
): MilestoneEvent[] {
  const milestones: MilestoneEvent[] = [];

  if (!previous) {
    // First snapshot - no comparison possible
    return milestones;
  }

  for (const [path, currentApp] of Object.entries(current.apps)) {
    const previousApp = previous.apps[path];

    if (!previousApp) {
      // New app detected
      if (currentApp.progress > 0) {
        milestones.push({
          app: path,
          type: 'progress_milestone',
          description: `New app ${currentApp.name} added with ${Math.round(currentApp.progress * 100)}% progress`,
          newValue: currentApp.progress,
        });
      }
      continue;
    }

    // Check for waypoint completion
    if (
      currentApp.currentWaypoint !== previousApp.currentWaypoint &&
      previousApp.currentWaypoint
    ) {
      milestones.push({
        app: path,
        type: 'waypoint_complete',
        description: `${currentApp.name} completed waypoint ${previousApp.currentWaypoint}`,
        oldValue: previousApp.currentWaypoint,
        newValue: currentApp.currentWaypoint,
      });
    }

    // Check for status promotion
    const statusOrder = ['placeholder', 'skeleton', 'active', 'ready'];
    const previousIndex = statusOrder.indexOf(previousApp.status);
    const currentIndex = statusOrder.indexOf(currentApp.status);

    if (currentIndex > previousIndex) {
      milestones.push({
        app: path,
        type: 'status_promotion',
        description: `${currentApp.name} promoted from ${previousApp.status} to ${currentApp.status}`,
        oldValue: previousApp.status,
        newValue: currentApp.status,
      });
    }

    // Check for significant progress milestones (25%, 50%, 75%, 100%)
    const progressMilestones = [0.25, 0.5, 0.75, 1.0];
    for (const milestone of progressMilestones) {
      if (previousApp.progress < milestone && currentApp.progress >= milestone) {
        milestones.push({
          app: path,
          type: 'progress_milestone',
          description: `${currentApp.name} reached ${Math.round(milestone * 100)}% progress`,
          oldValue: previousApp.progress,
          newValue: currentApp.progress,
        });
      }
    }
  }

  return milestones;
}

/**
 * Detect new blockers
 */
function detectNewBlockers(
  previous: EcosystemStatus | null,
  current: EcosystemStatus
): Array<{ app: string; blockers: string[] }> {
  const newBlockers: Array<{ app: string; blockers: string[] }> = [];

  if (!previous) return newBlockers;

  for (const [path, currentApp] of Object.entries(current.apps)) {
    const previousApp = previous.apps[path];
    const previousBlockers = previousApp?.blockers || [];
    const addedBlockers = currentApp.blockers.filter(
      (b) => !previousBlockers.includes(b)
    );

    if (addedBlockers.length > 0) {
      newBlockers.push({
        app: path,
        blockers: addedBlockers,
      });
    }
  }

  return newBlockers;
}

/**
 * Record milestone to DynamoDB
 */
async function recordMilestone(milestone: MilestoneEvent): Promise<void> {
  const timestamp = new Date().toISOString();

  await dynamodb.send(
    new PutItemCommand({
      TableName: MILESTONES_TABLE,
      Item: marshall({
        pk: `APP#${milestone.app}`,
        sk: `MILESTONE#${timestamp}`,
        eventType: milestone.type,
        description: milestone.description,
        oldValue: milestone.oldValue,
        newValue: milestone.newValue,
        timestamp,
        ttl: Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 60 * 60, // 2 years
      }),
    })
  );
}

/**
 * Publish milestone notification
 */
async function publishMilestoneNotification(
  milestones: MilestoneEvent[]
): Promise<void> {
  if (milestones.length === 0) return;

  // Publish metric
  await cloudwatch.send(
    new PutMetricDataCommand({
      Namespace: 'EcosystemProgress',
      MetricData: [
        {
          MetricName: 'MilestonesCompleted',
          Value: milestones.length,
          Unit: 'Count',
          Timestamp: new Date(),
          Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT! }],
        },
      ],
    })
  );

  // Publish to SNS
  await sns.send(
    new PublishCommand({
      TopicArn: SNS_MILESTONES_TOPIC,
      Subject: `[MILESTONE] ${milestones.length} milestone(s) achieved`,
      Message: JSON.stringify({
        type: 'milestones',
        count: milestones.length,
        milestones: milestones.map((m) => ({
          app: m.app,
          type: m.type,
          description: m.description,
        })),
        timestamp: new Date().toISOString(),
      }),
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: 'milestone' },
        count: { DataType: 'Number', StringValue: String(milestones.length) },
      },
    })
  );
}

/**
 * Publish blocker notification
 */
async function publishBlockerNotification(
  blockers: Array<{ app: string; blockers: string[] }>
): Promise<void> {
  if (blockers.length === 0) return;

  await sns.send(
    new PublishCommand({
      TopicArn: SNS_BLOCKERS_TOPIC,
      Subject: `[BLOCKER] New blockers detected in ${blockers.length} app(s)`,
      Message: JSON.stringify({
        type: 'new_blockers',
        count: blockers.length,
        blockers: blockers.map((b) => ({
          app: b.app,
          blockers: b.blockers,
        })),
        timestamp: new Date().toISOString(),
      }),
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: 'blocker' },
        count: { DataType: 'Number', StringValue: String(blockers.length) },
      },
    })
  );
}

/**
 * Main handler
 */
export async function handler(event: any): Promise<void> {
  console.log('Event:', JSON.stringify(event, null, 2));

  // Get S3 object key from event
  const record = event.Records?.[0];
  if (!record) {
    console.log('No S3 record found');
    return;
  }

  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  console.log(`Processing snapshot: ${key}`);

  // Skip if not a dated snapshot (avoid processing 'latest')
  if (key.includes('/latest/')) {
    console.log('Skipping latest snapshot');
    return;
  }

  try {
    // Get current and previous snapshots
    const current = await getCurrentSnapshot(key);
    const previous = await getPreviousSnapshot();

    // Detect milestones
    const milestones = detectMilestones(previous, current);
    console.log(`Detected ${milestones.length} milestones`);

    // Record milestones
    for (const milestone of milestones) {
      await recordMilestone(milestone);
    }

    // Publish milestone notifications
    await publishMilestoneNotification(milestones);

    // Detect and publish blocker notifications
    const newBlockers = detectNewBlockers(previous, current);
    await publishBlockerNotification(newBlockers);

    console.log('Comparison complete');
  } catch (error) {
    console.error('Comparator error:', error);
    throw error;
  }
}
