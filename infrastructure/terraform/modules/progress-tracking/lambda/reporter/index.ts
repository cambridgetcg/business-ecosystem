/**
 * Progress Reporter Lambda
 *
 * Generates weekly and monthly progress reports.
 * Triggered by EventBridge schedules.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const s3 = new S3Client({});
const dynamodb = new DynamoDBClient({});
const sns = new SNSClient({});

const {
  S3_BUCKET,
  DYNAMODB_TABLE,
  MILESTONES_TABLE,
  SNS_WEEKLY_TOPIC,
  NOTIFICATION_EMAIL,
  ENVIRONMENT,
} = process.env;

interface ReportData {
  period: {
    start: string;
    end: string;
    type: 'weekly' | 'monthly';
  };
  summary: {
    overallProgress: number;
    progressChange: number;
    milestonesCompleted: number;
    newBlockers: number;
    blockersResolved: number;
    appsAdvanced: number;
  };
  byLayer: Record<
    string,
    {
      progress: number;
      progressChange: number;
      appsCount: number;
    }
  >;
  topPerformers: Array<{
    app: string;
    name: string;
    progressGain: number;
  }>;
  needsAttention: Array<{
    app: string;
    name: string;
    reason: string;
  }>;
  milestones: Array<{
    app: string;
    description: string;
    timestamp: string;
  }>;
  recommendations: string[];
}

/**
 * Get historical snapshots for a period
 */
async function getSnapshotsForPeriod(
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const snapshots: any[] = [];

  // List all snapshot files in the date range
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const datePath = `${currentDate.getFullYear()}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${String(currentDate.getDate()).padStart(2, '0')}`;
    const key = `snapshots/${datePath}/ecosystem-status.json`;

    try {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
        })
      );
      const body = await response.Body?.transformToString();
      if (body) {
        snapshots.push({
          date: currentDate.toISOString().split('T')[0],
          data: JSON.parse(body),
        });
      }
    } catch (error: any) {
      if (error.name !== 'NoSuchKey') {
        console.warn(`Error fetching snapshot for ${datePath}:`, error);
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return snapshots;
}

/**
 * Get milestones for a period
 */
async function getMilestonesForPeriod(
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const milestones: any[] = [];

  const result = await dynamodb.send(
    new ScanCommand({
      TableName: MILESTONES_TABLE,
      FilterExpression: '#ts BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: marshall({
        ':start': startDate.toISOString(),
        ':end': endDate.toISOString(),
      }),
    })
  );

  for (const item of result.Items || []) {
    milestones.push(unmarshall(item));
  }

  return milestones.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Generate report data
 */
async function generateReportData(
  type: 'weekly' | 'monthly'
): Promise<ReportData> {
  const endDate = new Date();
  const startDate = new Date();

  if (type === 'weekly') {
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  // Get snapshots
  const snapshots = await getSnapshotsForPeriod(startDate, endDate);

  if (snapshots.length === 0) {
    throw new Error('No snapshots found for the period');
  }

  const firstSnapshot = snapshots[0].data;
  const lastSnapshot = snapshots[snapshots.length - 1].data;

  // Get milestones
  const milestones = await getMilestonesForPeriod(startDate, endDate);

  // Calculate progress change
  const progressChange =
    lastSnapshot.summary.overallProgress - firstSnapshot.summary.overallProgress;

  // Calculate by layer
  const layers = ['foundational', 'operational', 'gateway'];
  const byLayer: ReportData['byLayer'] = {};

  for (const layer of layers) {
    const firstLayerApps = Object.values(firstSnapshot.apps).filter(
      (a: any) => a.layer === layer
    );
    const lastLayerApps = Object.values(lastSnapshot.apps).filter(
      (a: any) => a.layer === layer
    );

    const firstProgress =
      firstLayerApps.reduce((sum: number, a: any) => sum + a.progress, 0) /
      (firstLayerApps.length || 1);
    const lastProgress =
      lastLayerApps.reduce((sum: number, a: any) => sum + a.progress, 0) /
      (lastLayerApps.length || 1);

    byLayer[layer] = {
      progress: lastProgress,
      progressChange: lastProgress - firstProgress,
      appsCount: lastLayerApps.length,
    };
  }

  // Find top performers (most progress gained)
  const topPerformers: ReportData['topPerformers'] = [];
  for (const [path, lastApp] of Object.entries(lastSnapshot.apps) as any[]) {
    const firstApp = firstSnapshot.apps[path];
    if (firstApp) {
      const gain = lastApp.progress - firstApp.progress;
      if (gain > 0) {
        topPerformers.push({
          app: path,
          name: lastApp.name,
          progressGain: gain,
        });
      }
    }
  }
  topPerformers.sort((a, b) => b.progressGain - a.progressGain);

  // Find apps needing attention
  const needsAttention: ReportData['needsAttention'] = [];
  for (const [path, app] of Object.entries(lastSnapshot.apps) as any[]) {
    // Check for blockers
    if (app.blockers && app.blockers.length > 0) {
      needsAttention.push({
        app: path,
        name: app.name,
        reason: `Has ${app.blockers.length} blocker(s): ${app.blockers.join(', ')}`,
      });
    }

    // Check for regression
    const firstApp = firstSnapshot.apps[path];
    if (firstApp && app.progress < firstApp.progress) {
      needsAttention.push({
        app: path,
        name: app.name,
        reason: `Progress decreased from ${Math.round(firstApp.progress * 100)}% to ${Math.round(app.progress * 100)}%`,
      });
    }

    // Check for stale active apps (simplified check)
    if (app.status === 'active') {
      const lastActivity = new Date(app.lastActivity);
      const daysSinceActivity = Math.floor(
        (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceActivity > 14) {
        needsAttention.push({
          app: path,
          name: app.name,
          reason: `No activity for ${daysSinceActivity} days`,
        });
      }
    }
  }

  // Count blocker changes
  let newBlockers = 0;
  let blockersResolved = 0;
  for (const [path, lastApp] of Object.entries(lastSnapshot.apps) as any[]) {
    const firstApp = firstSnapshot.apps[path];
    if (firstApp) {
      const firstBlockers = firstApp.blockers || [];
      const lastBlockers = lastApp.blockers || [];
      newBlockers += lastBlockers.filter(
        (b: string) => !firstBlockers.includes(b)
      ).length;
      blockersResolved += firstBlockers.filter(
        (b: string) => !lastBlockers.includes(b)
      ).length;
    }
  }

  // Count apps that advanced status
  let appsAdvanced = 0;
  const statusOrder = ['placeholder', 'skeleton', 'active', 'ready'];
  for (const [path, lastApp] of Object.entries(lastSnapshot.apps) as any[]) {
    const firstApp = firstSnapshot.apps[path];
    if (firstApp) {
      const firstIndex = statusOrder.indexOf(firstApp.status);
      const lastIndex = statusOrder.indexOf(lastApp.status);
      if (lastIndex > firstIndex) appsAdvanced++;
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (progressChange < 0) {
    recommendations.push(
      'Overall progress has decreased. Review apps with regression and identify root causes.'
    );
  }

  if (needsAttention.filter((a) => a.reason.includes('blocker')).length > 3) {
    recommendations.push(
      'Multiple apps have blockers. Consider a blocker review session to unblock progress.'
    );
  }

  if (topPerformers.length === 0) {
    recommendations.push(
      'No significant progress this period. Consider reviewing priorities and resource allocation.'
    );
  }

  const skeletonApps = Object.values(lastSnapshot.apps).filter(
    (a: any) => a.status === 'skeleton' || a.status === 'placeholder'
  ).length;
  if (skeletonApps > lastSnapshot.summary.totalApps / 2) {
    recommendations.push(
      `${skeletonApps} apps are still skeleton/placeholder. Consider focusing on fewer apps to completion.`
    );
  }

  return {
    period: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      type,
    },
    summary: {
      overallProgress: lastSnapshot.summary.overallProgress,
      progressChange,
      milestonesCompleted: milestones.filter((m) =>
        ['waypoint_complete', 'status_promotion', 'progress_milestone'].includes(
          m.eventType
        )
      ).length,
      newBlockers,
      blockersResolved,
      appsAdvanced,
    },
    byLayer,
    topPerformers: topPerformers.slice(0, 5),
    needsAttention: needsAttention.slice(0, 10),
    milestones: milestones.slice(0, 10).map((m) => ({
      app: m.pk.replace('APP#', ''),
      description: m.description,
      timestamp: m.timestamp,
    })),
    recommendations,
  };
}

/**
 * Format report as markdown
 */
function formatReportMarkdown(report: ReportData): string {
  const progressBar = (pct: number) => {
    const filled = Math.round(pct * 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  };

  const changeSymbol = (change: number) => {
    if (change > 0) return `+${Math.round(change * 100)}% ↑`;
    if (change < 0) return `${Math.round(change * 100)}% ↓`;
    return '0%';
  };

  let md = `# Progress Report: ${report.period.type === 'weekly' ? 'Weekly' : 'Monthly'}

**Period**: ${report.period.start} to ${report.period.end}
**Generated**: ${new Date().toISOString()}

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Overall Progress | ${progressBar(report.summary.overallProgress)} ${Math.round(report.summary.overallProgress * 100)}% |
| Progress Change | ${changeSymbol(report.summary.progressChange)} |
| Milestones Completed | ${report.summary.milestonesCompleted} |
| Apps Advanced | ${report.summary.appsAdvanced} |
| New Blockers | ${report.summary.newBlockers} |
| Blockers Resolved | ${report.summary.blockersResolved} |

---

## Progress by Layer

| Layer | Progress | Change |
|-------|----------|--------|
`;

  for (const [layer, data] of Object.entries(report.byLayer)) {
    md += `| ${layer} | ${progressBar(data.progress)} ${Math.round(data.progress * 100)}% | ${changeSymbol(data.progressChange)} |\n`;
  }

  md += `
---

## Top Performers

`;

  if (report.topPerformers.length > 0) {
    md += `| App | Progress Gain |\n|-----|---------------|\n`;
    for (const performer of report.topPerformers) {
      md += `| ${performer.name} | +${Math.round(performer.progressGain * 100)}% |\n`;
    }
  } else {
    md += `*No significant progress gains this period.*\n`;
  }

  md += `
---

## Needs Attention

`;

  if (report.needsAttention.length > 0) {
    md += `| App | Issue |\n|-----|-------|\n`;
    for (const item of report.needsAttention) {
      md += `| ${item.name} | ${item.reason} |\n`;
    }
  } else {
    md += `*All apps are on track.*\n`;
  }

  md += `
---

## Recent Milestones

`;

  if (report.milestones.length > 0) {
    for (const milestone of report.milestones) {
      md += `- **${milestone.app}**: ${milestone.description} (${milestone.timestamp.split('T')[0]})\n`;
    }
  } else {
    md += `*No milestones this period.*\n`;
  }

  if (report.recommendations.length > 0) {
    md += `
---

## Recommendations

`;
    for (const rec of report.recommendations) {
      md += `- ${rec}\n`;
    }
  }

  md += `
---

*Generated by Ecosystem Progress Tracker*
`;

  return md;
}

/**
 * Save report to S3
 */
async function saveReport(report: ReportData, markdown: string): Promise<string> {
  const date = new Date().toISOString().split('T')[0];
  const prefix = report.period.type === 'weekly' ? 'weekly' : 'monthly';
  const key = `reports/${prefix}/${date}.md`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: markdown,
      ContentType: 'text/markdown',
    })
  );

  // Also save JSON version
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key.replace('.md', '.json'),
      Body: JSON.stringify(report, null, 2),
      ContentType: 'application/json',
    })
  );

  return key;
}

/**
 * Publish report notification
 */
async function publishReportNotification(
  report: ReportData,
  markdown: string,
  s3Key: string
): Promise<void> {
  const subject =
    report.period.type === 'weekly'
      ? `[WEEKLY] Ecosystem Progress Report (${report.period.start} - ${report.period.end})`
      : `[MONTHLY] Ecosystem Progress Report (${report.period.start} - ${report.period.end})`;

  await sns.send(
    new PublishCommand({
      TopicArn: SNS_WEEKLY_TOPIC,
      Subject: subject,
      Message: JSON.stringify({
        type: 'report',
        reportType: report.period.type,
        period: report.period,
        summary: report.summary,
        s3Key,
        markdown: markdown.substring(0, 10000), // Truncate for SNS limit
        timestamp: new Date().toISOString(),
      }),
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: 'report' },
        reportType: { DataType: 'String', StringValue: report.period.type },
      },
    })
  );
}

/**
 * Main handler
 */
export async function handler(event: any): Promise<any> {
  console.log('Event:', JSON.stringify(event, null, 2));

  const reportType = event.reportType || 'weekly';

  try {
    console.log(`Generating ${reportType} report...`);

    // Generate report data
    const report = await generateReportData(reportType);

    // Format as markdown
    const markdown = formatReportMarkdown(report);

    // Save to S3
    const s3Key = await saveReport(report, markdown);
    console.log(`Report saved to: ${s3Key}`);

    // Publish notification
    await publishReportNotification(report, markdown, s3Key);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `${reportType} report generated successfully`,
        s3Key,
        summary: report.summary,
      }),
    };
  } catch (error) {
    console.error('Reporter error:', error);
    throw error;
  }
}
