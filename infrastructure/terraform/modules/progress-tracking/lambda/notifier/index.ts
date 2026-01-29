/**
 * Progress Notifier Lambda
 *
 * Routes notifications to appropriate channels (Slack, Email).
 * Triggered by SNS topics.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const secrets = new SecretsManagerClient({});
const ses = new SESClient({});

const {
  SECRET_NAME,
  ENABLE_SLACK,
  ENABLE_EMAIL,
  NOTIFICATION_EMAIL,
  FROM_EMAIL,
  ENVIRONMENT,
} = process.env;

interface NotificationPayload {
  type: string;
  [key: string]: any;
}

/**
 * Get Slack webhook URL from Secrets Manager
 */
async function getSlackWebhookUrl(): Promise<string | null> {
  if (ENABLE_SLACK !== 'true') return null;

  try {
    const response = await secrets.send(
      new GetSecretValueCommand({ SecretId: SECRET_NAME })
    );
    const secret = JSON.parse(response.SecretString || '{}');
    return secret.url || null;
  } catch (error) {
    console.warn('Could not retrieve Slack webhook:', error);
    return null;
  }
}

/**
 * Format message for Slack
 */
function formatSlackMessage(payload: NotificationPayload): any {
  const blocks: any[] = [];

  switch (payload.type) {
    case 'milestones':
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🎉 ${payload.count} Milestone(s) Achieved!`,
          emoji: true,
        },
      });

      for (const milestone of payload.milestones || []) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${milestone.app}*\n${milestone.description}`,
          },
        });
      }
      break;

    case 'new_blockers':
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: `⚠️ New Blockers Detected`,
          emoji: true,
        },
      });

      for (const item of payload.blockers || []) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${item.app}*\nBlockers: ${item.blockers.join(', ')}`,
          },
        });
      }
      break;

    case 'stale_apps':
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: `⏰ ${payload.count} Stale Apps Detected`,
          emoji: true,
        },
      });

      const staleList = (payload.apps || [])
        .map((a: any) => `• ${a.name} (last active: ${a.lastActivity})`)
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: staleList || 'No details available',
        },
      });
      break;

    case 'report':
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📊 ${payload.reportType === 'weekly' ? 'Weekly' : 'Monthly'} Progress Report`,
          emoji: true,
        },
      });

      if (payload.summary) {
        const progressPct = Math.round(payload.summary.overallProgress * 100);
        const changePct = Math.round(payload.summary.progressChange * 100);
        const changeStr = changePct >= 0 ? `+${changePct}%` : `${changePct}%`;

        blocks.push({
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Overall Progress*\n${progressPct}% (${changeStr})`,
            },
            {
              type: 'mrkdwn',
              text: `*Milestones*\n${payload.summary.milestonesCompleted}`,
            },
            {
              type: 'mrkdwn',
              text: `*Apps Advanced*\n${payload.summary.appsAdvanced}`,
            },
            {
              type: 'mrkdwn',
              text: `*Blockers*\n+${payload.summary.newBlockers} / -${payload.summary.blockersResolved}`,
            },
          ],
        });
      }
      break;

    case 'regression':
    case 'status_change':
    case 'blocker_change':
      const severity = payload.severity === 'warning' ? '⚠️' : 'ℹ️';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${severity} *${payload.app}*\n${payload.details}`,
        },
      });
      break;

    default:
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Notification*\n${JSON.stringify(payload, null, 2)}`,
        },
      });
  }

  // Add timestamp footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Environment: ${ENVIRONMENT} | ${new Date().toISOString()}`,
      },
    ],
  });

  return { blocks };
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(
  webhookUrl: string,
  payload: NotificationPayload
): Promise<void> {
  const message = formatSlackMessage(payload);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`Slack API error: ${response.status}`);
  }
}

/**
 * Format message for email
 */
function formatEmailMessage(payload: NotificationPayload): {
  subject: string;
  html: string;
  text: string;
} {
  let subject = '';
  let html = '';
  let text = '';

  switch (payload.type) {
    case 'milestones':
      subject = `[Ecosystem] ${payload.count} Milestone(s) Achieved`;
      html = `
        <h2>🎉 Milestones Achieved</h2>
        <ul>
          ${(payload.milestones || [])
            .map((m: any) => `<li><strong>${m.app}</strong>: ${m.description}</li>`)
            .join('')}
        </ul>
      `;
      text = (payload.milestones || [])
        .map((m: any) => `${m.app}: ${m.description}`)
        .join('\n');
      break;

    case 'new_blockers':
      subject = `[Ecosystem] New Blockers Detected`;
      html = `
        <h2>⚠️ New Blockers</h2>
        <ul>
          ${(payload.blockers || [])
            .map((b: any) => `<li><strong>${b.app}</strong>: ${b.blockers.join(', ')}</li>`)
            .join('')}
        </ul>
      `;
      text = (payload.blockers || [])
        .map((b: any) => `${b.app}: ${b.blockers.join(', ')}`)
        .join('\n');
      break;

    case 'stale_apps':
      subject = `[Ecosystem] ${payload.count} Stale Apps Detected`;
      html = `
        <h2>⏰ Stale Apps</h2>
        <p>The following active apps have had no activity for ${payload.staleDays}+ days:</p>
        <ul>
          ${(payload.apps || [])
            .map((a: any) => `<li><strong>${a.name}</strong> (last: ${a.lastActivity})</li>`)
            .join('')}
        </ul>
      `;
      text = (payload.apps || [])
        .map((a: any) => `${a.name}: last active ${a.lastActivity}`)
        .join('\n');
      break;

    case 'report':
      subject = `[Ecosystem] ${payload.reportType === 'weekly' ? 'Weekly' : 'Monthly'} Progress Report`;
      if (payload.markdown) {
        // Simple markdown to HTML conversion for basic formatting
        html = `
          <h2>📊 Progress Report</h2>
          <p><strong>Period:</strong> ${payload.period?.start} to ${payload.period?.end}</p>
          <h3>Summary</h3>
          <ul>
            <li>Overall Progress: ${Math.round((payload.summary?.overallProgress || 0) * 100)}%</li>
            <li>Progress Change: ${Math.round((payload.summary?.progressChange || 0) * 100)}%</li>
            <li>Milestones: ${payload.summary?.milestonesCompleted || 0}</li>
            <li>Apps Advanced: ${payload.summary?.appsAdvanced || 0}</li>
          </ul>
          <pre>${payload.markdown}</pre>
        `;
        text = payload.markdown;
      }
      break;

    default:
      subject = `[Ecosystem] Progress Notification`;
      html = `<pre>${JSON.stringify(payload, null, 2)}</pre>`;
      text = JSON.stringify(payload, null, 2);
  }

  // Add footer
  html += `
    <hr>
    <p style="color: #666; font-size: 12px;">
      Environment: ${ENVIRONMENT} | ${new Date().toISOString()}<br>
      Ecosystem Progress Tracker
    </p>
  `;

  return { subject, html, text };
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  payload: NotificationPayload
): Promise<void> {
  if (!NOTIFICATION_EMAIL) {
    console.log('No notification email configured');
    return;
  }

  const { subject, html, text } = formatEmailMessage(payload);

  await ses.send(
    new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [NOTIFICATION_EMAIL],
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: html },
          Text: { Data: text },
        },
      },
    })
  );
}

/**
 * Main handler
 */
export async function handler(event: any): Promise<void> {
  console.log('Event:', JSON.stringify(event, null, 2));

  // Parse SNS message
  for (const record of event.Records || []) {
    if (record.EventSource !== 'aws:sns') continue;

    const message = record.Sns.Message;
    let payload: NotificationPayload;

    try {
      payload = JSON.parse(message);
    } catch {
      payload = { type: 'unknown', message };
    }

    console.log('Processing notification:', payload.type);

    // Send to Slack
    if (ENABLE_SLACK === 'true') {
      const webhookUrl = await getSlackWebhookUrl();
      if (webhookUrl) {
        try {
          await sendSlackNotification(webhookUrl, payload);
          console.log('Slack notification sent');
        } catch (error) {
          console.error('Slack notification error:', error);
        }
      }
    }

    // Send email
    if (ENABLE_EMAIL === 'true') {
      try {
        await sendEmailNotification(payload);
        console.log('Email notification sent');
      } catch (error) {
        console.error('Email notification error:', error);
      }
    }
  }
}
