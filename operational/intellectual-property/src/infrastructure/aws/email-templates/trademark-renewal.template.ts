/**
 * Trademark Renewal Email Template
 *
 * Template for trademark renewal deadline reminders.
 * Supports various classes and jurisdictions.
 *
 * @module infrastructure/aws/email-templates
 */

export interface TrademarkRenewalTemplateData {
  trademarkId: string;
  registrationNumber: string;
  mark: string;
  markType: 'word' | 'design' | 'combined' | 'sound' | 'motion' | 'other';
  classes: string[];
  dueDate: Date;
  jurisdiction: string;
  daysUntilDue: number;
  ownerName: string;
  actionUrl: string;
  renewalFee?: number;
  currency?: string;
  declarationRequired?: boolean;
  specimenRequired?: boolean;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Generate subject line based on urgency.
 */
function getSubject(data: TrademarkRenewalTemplateData): string {
  if (data.daysUntilDue <= 30) {
    return `URGENT: Trademark Renewal Due in ${data.daysUntilDue} Days - ${data.mark}`;
  }
  if (data.daysUntilDue <= 90) {
    return `Action Required: Trademark Renewal Due Soon - ${data.mark}`;
  }
  return `Reminder: Trademark Renewal Approaching - ${data.mark}`;
}

/**
 * Get priority badge color.
 */
function getPriorityBadge(daysUntilDue: number): { color: string; text: string } {
  if (daysUntilDue <= 30) {
    return { color: '#dc3545', text: 'CRITICAL' };
  }
  if (daysUntilDue <= 90) {
    return { color: '#fd7e14', text: 'HIGH PRIORITY' };
  }
  if (daysUntilDue <= 180) {
    return { color: '#ffc107', text: 'MEDIUM PRIORITY' };
  }
  return { color: '#17a2b8', text: 'ADVANCE NOTICE' };
}

/**
 * Format currency amount.
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Format date for display.
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get mark type display name.
 */
function getMarkTypeDisplay(markType: TrademarkRenewalTemplateData['markType']): string {
  const types: Record<typeof markType, string> = {
    word: 'Word Mark',
    design: 'Design Mark',
    combined: 'Combined Mark (Word + Design)',
    sound: 'Sound Mark',
    motion: 'Motion Mark',
    other: 'Other',
  };
  return types[markType];
}

/**
 * Generate HTML email content.
 */
function generateHtml(data: TrademarkRenewalTemplateData): string {
  const badge = getPriorityBadge(data.daysUntilDue);
  const formattedDate = formatDate(data.dueDate);
  const formattedFee = data.renewalFee && data.currency
    ? formatCurrency(data.renewalFee, data.currency)
    : 'Contact registry for fee schedule';

  const requirementsHtml = [];
  if (data.declarationRequired) {
    requirementsHtml.push('<li>Declaration of Use (Affidavit)</li>');
  }
  if (data.specimenRequired) {
    requirementsHtml.push('<li>Specimens showing current use in commerce</li>');
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trademark Renewal Reminder</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #6f42c1 0%, #9b59b6 100%);
      color: #ffffff;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      margin: 10px 0 0;
      opacity: 0.9;
    }
    .priority-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 15px;
      background-color: ${badge.color};
      color: #ffffff;
    }
    .content {
      padding: 30px;
    }
    .mark-display {
      background: #f8f9fa;
      border: 2px solid #6f42c1;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      text-align: center;
    }
    .mark-display h2 {
      margin: 0;
      font-size: 28px;
      color: #6f42c1;
    }
    .mark-display p {
      margin: 10px 0 0;
      color: #6c757d;
    }
    .deadline-box {
      background: #f8f9fa;
      border-left: 4px solid ${badge.color};
      padding: 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .deadline-box h3 {
      margin: 0 0 10px;
      color: #1a365d;
    }
    .deadline-date {
      font-size: 24px;
      font-weight: 700;
      color: ${badge.color};
      margin: 10px 0;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .details-table th,
    .details-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e9ecef;
    }
    .details-table th {
      color: #6c757d;
      font-weight: 500;
      width: 40%;
    }
    .details-table td {
      color: #212529;
      font-weight: 500;
    }
    .classes-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .classes-list li {
      background: #e9ecef;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 14px;
    }
    .requirements-box {
      background: #d4edda;
      border: 1px solid #c3e6cb;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .requirements-box h4 {
      margin: 0 0 10px;
      color: #155724;
    }
    .requirements-box ul {
      margin: 0;
      padding-left: 20px;
      color: #155724;
    }
    .action-button {
      display: inline-block;
      background: linear-gradient(135deg, #6f42c1 0%, #9b59b6 100%);
      color: #ffffff;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    .footer p {
      margin: 5px 0;
      font-size: 12px;
      color: #6c757d;
    }
    .footer a {
      color: #6f42c1;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Trademark Renewal Reminder</h1>
      <p>Intellectual Property Management System</p>
      <span class="priority-badge">${badge.text}</span>
    </div>
    <div class="content">
      <p>Dear ${data.ownerName},</p>
      <p>This is a reminder that a trademark renewal deadline is approaching. Please review the details below and take action to maintain your registration.</p>

      <div class="mark-display">
        <h2>${data.mark}</h2>
        <p>${getMarkTypeDisplay(data.markType)} | Registration #${data.registrationNumber}</p>
      </div>

      <div class="deadline-box">
        <h3>Renewal Deadline</h3>
        <div class="deadline-date">${formattedDate}</div>
        <p><strong>${data.daysUntilDue} days remaining</strong></p>
      </div>

      <table class="details-table">
        <tr>
          <th>Registration Number</th>
          <td>${data.registrationNumber}</td>
        </tr>
        <tr>
          <th>Jurisdiction</th>
          <td>${data.jurisdiction}</td>
        </tr>
        <tr>
          <th>Classes</th>
          <td>
            <ul class="classes-list">
              ${data.classes.map(c => `<li>Class ${c}</li>`).join('')}
            </ul>
          </td>
        </tr>
        <tr>
          <th>Estimated Fee</th>
          <td>${formattedFee}</td>
        </tr>
      </table>

      ${requirementsHtml.length > 0 ? `
      <div class="requirements-box">
        <h4>Required Documents</h4>
        <ul>
          ${requirementsHtml.join('')}
        </ul>
      </div>
      ` : ''}

      <div style="text-align: center;">
        <a href="${data.actionUrl}" class="action-button">Initiate Renewal Process</a>
      </div>

      <p><strong>Important:</strong> Failure to renew the trademark by the deadline may result in cancellation of the registration. Some jurisdictions offer a grace period with late fees, but this varies by region.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from the Intellectual Property Management System.</p>
      <p>Trademark ID: ${data.trademarkId}</p>
      <p><a href="${data.actionUrl}">Manage your IP portfolio</a></p>
    </div>
  </div>
</body>
</html>
`.trim();
}

/**
 * Generate plain text email content.
 */
function generateText(data: TrademarkRenewalTemplateData): string {
  const formattedDate = formatDate(data.dueDate);
  const formattedFee = data.renewalFee && data.currency
    ? formatCurrency(data.renewalFee, data.currency)
    : 'Contact registry for fee schedule';

  const requirements = [];
  if (data.declarationRequired) {
    requirements.push('- Declaration of Use (Affidavit)');
  }
  if (data.specimenRequired) {
    requirements.push('- Specimens showing current use in commerce');
  }

  return `
TRADEMARK RENEWAL REMINDER
===========================

Dear ${data.ownerName},

This is a reminder that a trademark renewal deadline is approaching. Please review the details below and take action to maintain your registration.

TRADEMARK: ${data.mark}
Registration Number: ${data.registrationNumber}
Mark Type: ${getMarkTypeDisplay(data.markType)}

RENEWAL DEADLINE: ${formattedDate}
Days Remaining: ${data.daysUntilDue}

TRADEMARK DETAILS
-----------------
Jurisdiction: ${data.jurisdiction}
Classes: ${data.classes.map(c => `Class ${c}`).join(', ')}
Estimated Fee: ${formattedFee}

${requirements.length > 0 ? `
REQUIRED DOCUMENTS
------------------
${requirements.join('\n')}
` : ''}
ACTION REQUIRED
---------------
Please visit the following link to initiate the renewal process:
${data.actionUrl}

IMPORTANT: Failure to renew the trademark by the deadline may result in cancellation of the registration. Some jurisdictions offer a grace period with late fees, but this varies by region.

---
This is an automated notification from the Intellectual Property Management System.
Trademark ID: ${data.trademarkId}
`.trim();
}

/**
 * Generate trademark renewal reminder email.
 */
export function generateTrademarkRenewalEmail(data: TrademarkRenewalTemplateData): EmailContent {
  return {
    subject: getSubject(data),
    html: generateHtml(data),
    text: generateText(data),
  };
}
