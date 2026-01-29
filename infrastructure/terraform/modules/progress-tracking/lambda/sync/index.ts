/**
 * Progress Sync Lambda
 *
 * Syncs STATUS.md files from GitHub repository to DynamoDB and S3.
 * Triggered by:
 * - EventBridge schedule (daily)
 * - GitHub webhook (on push)
 * - Manual invocation
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  PutItemCommand,
  BatchWriteItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import { marshall } from '@aws-sdk/util-dynamodb';

const s3 = new S3Client({});
const dynamodb = new DynamoDBClient({});
const secrets = new SecretsManagerClient({});
const cloudwatch = new CloudWatchClient({});

const {
  S3_BUCKET,
  DYNAMODB_TABLE,
  MILESTONES_TABLE,
  GITHUB_REPO,
  GITHUB_BRANCH,
  SECRET_NAME,
  ENVIRONMENT,
} = process.env;

interface AppStatus {
  name: string;
  path: string;
  layer: string;
  status: 'ready' | 'active' | 'skeleton' | 'placeholder';
  progress: number;
  currentWaypoint: string | null;
  waypointName: string | null;
  blockers: string[];
  lastActivity: string;
}

interface EcosystemStatus {
  lastUpdated: string;
  summary: {
    totalApps: number;
    productionReady: number;
    inDevelopment: number;
    skeleton: number;
    placeholder: number;
    overallProgress: number;
  };
  apps: Record<string, AppStatus>;
}

/**
 * Get GitHub token from Secrets Manager
 */
async function getGitHubToken(): Promise<string> {
  const response = await secrets.send(
    new GetSecretValueCommand({ SecretId: SECRET_NAME })
  );
  const secret = JSON.parse(response.SecretString || '{}');
  return secret.token;
}

/**
 * Fetch file content from GitHub
 */
async function fetchFromGitHub(path: string, token: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3.raw',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.text();
}

/**
 * Parse STATUS.md content to extract status information
 */
function parseStatusFile(content: string, appPath: string): Partial<AppStatus> {
  const result: Partial<AppStatus> = {
    path: appPath,
    layer: appPath.split('/')[0],
  };

  // Extract name from title
  const titleMatch = content.match(/^#\s+(.+?)\s+Status/m);
  if (titleMatch) {
    result.name = titleMatch[1];
  }

  // Extract status
  const statusMatch = content.match(/\*\*Status\*\*:\s*(Ready|Active|Skeleton|Placeholder)/i);
  if (statusMatch) {
    result.status = statusMatch[1].toLowerCase() as AppStatus['status'];
  }

  // Extract progress percentage
  const progressMatch = content.match(/Overall Progress\s*\|\s*(\d+)%/);
  if (progressMatch) {
    result.progress = parseInt(progressMatch[1], 10) / 100;
  }

  // Extract current waypoint
  const waypointMatch = content.match(/Current Waypoint\s*\|\s*([^|]+)/);
  if (waypointMatch) {
    const wp = waypointMatch[1].trim();
    if (wp && wp !== '-' && wp !== 'Not started' && wp !== 'Maintenance') {
      result.currentWaypoint = wp.split(':')[0].trim();
      result.waypointName = wp.includes(':') ? wp.split(':')[1].trim() : wp;
    } else if (wp === 'Maintenance') {
      result.waypointName = 'Maintenance';
    }
  }

  // Extract blockers
  const blockersMatch = content.match(/Blockers\s*\|\s*([^|]+)/);
  if (blockersMatch) {
    const blockers = blockersMatch[1].trim();
    if (blockers && blockers !== 'None' && blockers !== '-') {
      result.blockers = [blockers];
    } else {
      result.blockers = [];
    }
  }

  // Extract last updated date
  const dateMatch = content.match(/Last [Uu]pdated[:\s]*(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    result.lastActivity = dateMatch[1];
  } else {
    result.lastActivity = new Date().toISOString().split('T')[0];
  }

  return result;
}

/**
 * Discover all apps by checking known paths
 */
async function discoverApps(token: string): Promise<AppStatus[]> {
  const layers = ['foundational', 'operational', 'gateway'];
  const apps: AppStatus[] = [];

  for (const layer of layers) {
    // Fetch directory listing
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${layer}?ref=${GITHUB_BRANCH}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) continue;

    const entries = await response.json();

    for (const entry of entries) {
      if (entry.type !== 'dir') continue;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.name === 'research' || entry.name === 'shared') continue;

      const appPath = `${layer}/${entry.name}`;
      const statusPath = `${appPath}/STATUS.md`;

      const statusContent = await fetchFromGitHub(statusPath, token);

      if (statusContent) {
        const parsed = parseStatusFile(statusContent, appPath);
        apps.push({
          name: parsed.name || entry.name,
          path: appPath,
          layer,
          status: parsed.status || 'placeholder',
          progress: parsed.progress || 0,
          currentWaypoint: parsed.currentWaypoint || null,
          waypointName: parsed.waypointName || null,
          blockers: parsed.blockers || [],
          lastActivity: parsed.lastActivity || new Date().toISOString().split('T')[0],
        });
      } else {
        // No STATUS.md, treat as placeholder
        apps.push({
          name: entry.name,
          path: appPath,
          layer,
          status: 'placeholder',
          progress: 0,
          currentWaypoint: null,
          waypointName: null,
          blockers: [],
          lastActivity: new Date().toISOString().split('T')[0],
        });
      }
    }
  }

  return apps;
}

/**
 * Calculate ecosystem summary
 */
function calculateSummary(apps: AppStatus[]): EcosystemStatus['summary'] {
  const totalApps = apps.length;
  const productionReady = apps.filter((a) => a.status === 'ready').length;
  const inDevelopment = apps.filter((a) => a.status === 'active').length;
  const skeleton = apps.filter((a) => a.status === 'skeleton').length;
  const placeholder = apps.filter((a) => a.status === 'placeholder').length;
  const overallProgress =
    apps.reduce((sum, a) => sum + a.progress, 0) / (totalApps || 1);

  return {
    totalApps,
    productionReady,
    inDevelopment,
    skeleton,
    placeholder,
    overallProgress: Math.round(overallProgress * 100) / 100,
  };
}

/**
 * Save to DynamoDB
 */
async function saveToDynamoDB(status: EcosystemStatus): Promise<void> {
  const timestamp = new Date().toISOString();

  // Save ecosystem summary
  await dynamodb.send(
    new PutItemCommand({
      TableName: DYNAMODB_TABLE,
      Item: marshall({
        pk: 'ECOSYSTEM',
        sk: 'STATUS',
        ...status.summary,
        lastUpdated: timestamp,
        gsi1pk: 'ECOSYSTEM',
        gsi1sk: status.summary.overallProgress,
        gsi2pk: 'SUMMARY',
        gsi2sk: timestamp,
      }),
    })
  );

  // Save each app status
  const appItems = Object.entries(status.apps).map(([path, app]) => ({
    PutRequest: {
      Item: marshall({
        pk: `APP#${path}`,
        sk: 'STATUS',
        ...app,
        lastUpdated: timestamp,
        gsi1pk: app.layer,
        gsi1sk: app.progress,
        gsi2pk: app.status,
        gsi2sk: app.lastActivity,
      }),
    },
  }));

  // Batch write (max 25 items per batch)
  for (let i = 0; i < appItems.length; i += 25) {
    const batch = appItems.slice(i, i + 25);
    await dynamodb.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [DYNAMODB_TABLE!]: batch,
        },
      })
    );
  }

  // Save history record
  await dynamodb.send(
    new PutItemCommand({
      TableName: DYNAMODB_TABLE,
      Item: marshall({
        pk: 'ECOSYSTEM',
        sk: `HISTORY#${timestamp}`,
        ...status.summary,
        timestamp,
        ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year TTL
      }),
    })
  );
}

/**
 * Save snapshot to S3
 */
async function saveToS3(status: EcosystemStatus): Promise<void> {
  const date = new Date();
  const datePath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;

  // Save dated snapshot
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: `snapshots/${datePath}/ecosystem-status.json`,
      Body: JSON.stringify(status, null, 2),
      ContentType: 'application/json',
    })
  );

  // Save latest snapshot
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: 'snapshots/latest/ecosystem-status.json',
      Body: JSON.stringify(status, null, 2),
      ContentType: 'application/json',
    })
  );
}

/**
 * Publish CloudWatch metrics
 */
async function publishMetrics(status: EcosystemStatus): Promise<void> {
  const timestamp = new Date();

  const metrics = [
    {
      MetricName: 'OverallProgress',
      Value: status.summary.overallProgress,
      Unit: 'None',
    },
    {
      MetricName: 'ProductionReadyApps',
      Value: status.summary.productionReady,
      Unit: 'Count',
    },
    {
      MetricName: 'ActiveBlockers',
      Value: Object.values(status.apps).reduce(
        (sum, app) => sum + app.blockers.length,
        0
      ),
      Unit: 'Count',
    },
    {
      MetricName: 'AppsByStatus',
      Value: status.summary.productionReady,
      Unit: 'Count',
      Dimensions: [{ Name: 'Status', Value: 'ready' }],
    },
    {
      MetricName: 'AppsByStatus',
      Value: status.summary.inDevelopment,
      Unit: 'Count',
      Dimensions: [{ Name: 'Status', Value: 'active' }],
    },
    {
      MetricName: 'AppsByStatus',
      Value: status.summary.skeleton,
      Unit: 'Count',
      Dimensions: [{ Name: 'Status', Value: 'skeleton' }],
    },
    {
      MetricName: 'AppsByStatus',
      Value: status.summary.placeholder,
      Unit: 'Count',
      Dimensions: [{ Name: 'Status', Value: 'placeholder' }],
    },
  ];

  // Layer progress
  const layers = ['foundational', 'operational', 'gateway'];
  for (const layer of layers) {
    const layerApps = Object.values(status.apps).filter((a) => a.layer === layer);
    const layerProgress =
      layerApps.reduce((sum, a) => sum + a.progress, 0) / (layerApps.length || 1);

    metrics.push({
      MetricName: 'LayerProgress',
      Value: layerProgress,
      Unit: 'None',
      Dimensions: [{ Name: 'Layer', Value: layer }],
    });
  }

  await cloudwatch.send(
    new PutMetricDataCommand({
      Namespace: 'EcosystemProgress',
      MetricData: metrics.map((m) => ({
        ...m,
        Timestamp: timestamp,
        Dimensions: [
          { Name: 'Environment', Value: ENVIRONMENT! },
          ...(m.Dimensions || []),
        ],
      })),
    })
  );
}

/**
 * Main handler
 */
export async function handler(event: any): Promise<any> {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Get GitHub token
    const token = await getGitHubToken();

    // Discover and parse all apps
    console.log('Discovering apps...');
    const apps = await discoverApps(token);
    console.log(`Found ${apps.length} apps`);

    // Calculate summary
    const summary = calculateSummary(apps);

    // Build ecosystem status
    const status: EcosystemStatus = {
      lastUpdated: new Date().toISOString(),
      summary,
      apps: Object.fromEntries(apps.map((a) => [a.path, a])),
    };

    // Save to DynamoDB
    console.log('Saving to DynamoDB...');
    await saveToDynamoDB(status);

    // Save to S3
    console.log('Saving to S3...');
    await saveToS3(status);

    // Publish metrics
    console.log('Publishing metrics...');
    await publishMetrics(status);

    console.log('Sync complete');

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Progress synced successfully',
        summary,
        appsProcessed: apps.length,
      }),
    };
  } catch (error) {
    console.error('Sync error:', error);
    throw error;
  }
}
