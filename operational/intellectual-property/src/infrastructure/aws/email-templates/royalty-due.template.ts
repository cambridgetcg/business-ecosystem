/**
 * License Royalty Due Email Template
 *
 * Template for license royalty payment reminders.
 * Supports various royalty structures and payment schedules.
 *
 * @module infrastructure/aws/email-templates
 */

export type RoyaltyType = 'fixed' | 'percentage' | 'tiered' | 'minimum_guarantee' | 'hybrid';

export interface RoyaltyDueTemplateData {
  licenseId: string;
  licenseeName: string;
  licenseeContactEmail?: string;
  licensedAssets: Array<{
    type: 'patent' | 'trademark' | 'trade_secret' | 'copyright';
    name: string;
    identifier: string;
  }>;
  royaltyType: RoyaltyType;
  dueDate: Date;
  daysUntilDue: number;
  amount: number;
  currency: string;
  paymentPeriod: string;
  accountingReference?: string;
  isOverdue?: boolean;
  overdueAmount?: number;
  ownerName: string;
  actionUrl: string;
  paymentInstructions?: string;
  auditRights?: boolean;
  reportingRequired?: boolean;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Generate subject line based on urgency.
 */
function getSubject(data: RoyaltyDueTemplateData): string {
  if (data.isOverdue) {
    return `OVERDUE: License Royalty Payment - ${data.licenseeName}`;
  }
  if (data.daysUntilDue <= 7) {
    return `URGENT: Royalty Due in ${data.daysUntilDue} Days - ${data.licenseeName}`;
  }
  if (data.daysUntilDue <= 30) {
    return `Action Required: Royalty Payment Due Soon - ${data.licenseeName}`;
  }
  return `Reminder: Royalty Payment Approaching - ${data.licenseeName}`;
}

/**
 * Get priority badge color.
 */
function getPriorityBadge(daysUntilDue: number, isOverdue?: boolean): { color: string; text: string } {
  if (isOverdue) {
    return { color: '#dc3545', text: 'OVERDUE' };
  }
  if (daysUntilDue <= 7) {
    return { color: '#fd7e14', text: 'DUE SOON' };
  }
  if (daysUntilDue <= 30) {
    return { color: '#ffc107', text: 'UPCOMING' };
  }
  return { color: '#17a2b8', text: 'ADVANCE NOTICE' };
}

/**
 * Get royalty type display name.
 */
function getRoyaltyTypeDisplay(royaltyType: RoyaltyType): string {
  const types: Record<RoyaltyType, string> = {
    fixed: 'Fixed Fee',
    percentage: 'Percentage of Sales',
    tiered: 'Tiered Structure',
    minimum_guarantee: 'Minimum Guarantee',
    hybrid: 'Hybrid (Fixed + Percentage)',
  };
  return types[royaltyType];
}

/**
 * Get asset type icon.
 */
function getAssetTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    patent: 'Patent',
    trademark: 'Trademark',
    trade_secret: 'Trade Secret',
    copyright: 'Copyright',
  };
  return labels[type] || type;
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
 * Generate HTML email content.
 */
function generateHtml(data: RoyaltyDueTemplateData): string {
  const badge = getPriorityBadge(data.daysUntilDue, data.isOverdue);
  const formattedDate = formatDate(data.dueDate);
  const formattedAmount = formatCurrency(data.amount, data.currency);
  const formattedOverdue = data.overdueAmount
    ? formatCurrency(data.overdueAmount, data.currency)
    : null;

  const overdueWarningHtml = data.isOverdue ? `
    <div class="overdue-warning">
      <h4>PAYMENT OVERDUE</h4>
      <p>This royalty payment is past due. ${formattedOverdue ? `Outstanding balance: <strong>${formattedOverdue}</strong>` : ''}</p>
      <p>Please remit payment immediately to avoid potential license termination or legal action.</p>
    </div>
  ` : '';

  const requirementsHtml = (data.reportingRequired || data.auditRights) ? `
    <div class="requirements-box">
      <h4>License Requirements</h4>
      <ul>
        ${data.reportingRequired ? '<li>Sales/usage report required with payment</li>' : ''}
        ${data.auditRights ? '<li>Licensor reserves audit rights per license agreement</li>' : ''}
      </ul>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>License Royalty Reminder</title>
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
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
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
    .overdue-warning {
      background: #fef2f2;
      border: 2px solid #dc3545;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .overdue-warning h4 {
      margin: 0 0 10px;
      color: #dc3545;
      font-size: 16px;
      letter-spacing: 1px;
    }
    .overdue-warning p {
      margin: 5px 0;
      color: #991b1b;
    }
    .licensee-display {
      background: #f8f9fa;
      border-left: 4px solid #059669;
      padding: 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .licensee-display h2 {
      margin: 0;
      font-size: 24px;
      color: #1a365d;
    }
    .licensee-display p {
      margin: 10px 0 0;
      color: #6c757d;
    }
    .amount-display {
      background: ${data.isOverdue ? '#fef2f2' : '#f0fdf4'};
      border: 2px solid ${data.isOverdue ? '#dc3545' : '#059669'};
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      text-align: center;
    }
    .amount-display h3 {
      margin: 0;
      font-size: 14px;
      color: #6c757d;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .amount-display .amount {
      font-size: 36px;
      font-weight: 700;
      color: ${data.isOverdue ? '#dc3545' : '#059669'};
      margin: 10px 0;
    }
    .amount-display .period {
      font-size: 14px;
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
      font-size: 20px;
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
    .assets-section {
      margin: 20px 0;
    }
    .assets-section h4 {
      margin: 0 0 15px;
      color: #1a365d;
    }
    .asset-item {
      display: flex;
      align-items: center;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 6px;
      margin: 8px 0;
    }
    .asset-type {
      background: #059669;
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 12px;
    }
    .asset-details {
      flex: 1;
    }
    .asset-name {
      font-weight: 600;
      color: #212529;
    }
    .asset-id {
      font-size: 12px;
      color: #6c757d;
    }
    .requirements-box {
      background: #e7f5ff;
      border: 1px solid #74c0fc;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .requirements-box h4 {
      margin: 0 0 10px;
      color: #1864ab;
    }
    .requirements-box ul {
      margin: 0;
      padding-left: 20px;
      color: #1864ab;
    }
    .instructions {
      background: #fff3cd;
      border: 1px solid #ffeeba;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .instructions h4 {
      margin: 0 0 10px;
      color: #856404;
    }
    .instructions p {
      margin: 0;
      color: #856404;
      white-space: pre-wrap;
    }
    .action-button {
      display: inline-block;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
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
      color: #059669;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>License Royalty ${data.isOverdue ? 'Overdue' : 'Reminder'}</h1>
      <p>Intellectual Property Management System</p>
      <span class="priority-badge">${badge.text}</span>
    </div>
    <div class="content">
      <p>Dear ${data.ownerName},</p>
      <p>This is a ${data.isOverdue ? 'notice that a' : 'reminder that a'} license royalty payment is ${data.isOverdue ? 'overdue' : 'approaching'}. Please review the details below.</p>

      ${overdueWarningHtml}

      <div class="licensee-display">
        <h2>${data.licenseeName}</h2>
        <p>License ID: ${data.licenseId}</p>
        ${data.licenseeContactEmail ? `<p>Contact: ${data.licenseeContactEmail}</p>` : ''}
      </div>

      <div class="amount-display">
        <h3>Amount Due</h3>
        <div class="amount">${formattedAmount}</div>
        <div class="period">${data.paymentPeriod}</div>
      </div>

      <div class="deadline-box">
        <h3>Payment Due Date</h3>
        <div class="deadline-date">${formattedDate}</div>
        <p><strong>${data.isOverdue ? 'OVERDUE' : `${data.daysUntilDue} days remaining`}</strong></p>
      </div>

      <table class="details-table">
        <tr>
          <th>Royalty Structure</th>
          <td>${getRoyaltyTypeDisplay(data.royaltyType)}</td>
        </tr>
        ${data.accountingReference ? `
        <tr>
          <th>Accounting Reference</th>
          <td>${data.accountingReference}</td>
        </tr>
        ` : ''}
      </table>

      <div class="assets-section">
        <h4>Licensed Assets</h4>
        ${data.licensedAssets.map(asset => `
          <div class="asset-item">
            <span class="asset-type">${getAssetTypeLabel(asset.type)}</span>
            <div class="asset-details">
              <div class="asset-name">${asset.name}</div>
              <div class="asset-id">${asset.identifier}</div>
            </div>
          </div>
        `).join('')}
      </div>

      ${requirementsHtml}

      ${data.paymentInstructions ? `
      <div class="instructions">
        <h4>Payment Instructions</h4>
        <p>${data.paymentInstructions}</p>
      </div>
      ` : ''}

      <div style="text-align: center;">
        <a href="${data.actionUrl}" class="action-button">${data.isOverdue ? 'Process Payment Now' : 'View License & Track Payment'}</a>
      </div>

      <p><strong>Note:</strong> Please ensure payment is received by the due date to maintain good standing and avoid potential late fees or license complications.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from the Intellectual Property Management System.</p>
      <p>License ID: ${data.licenseId}</p>
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
function generateText(data: RoyaltyDueTemplateData): string {
  const formattedDate = formatDate(data.dueDate);
  const formattedAmount = formatCurrency(data.amount, data.currency);
  const formattedOverdue = data.overdueAmount
    ? formatCurrency(data.overdueAmount, data.currency)
    : null;

  const overdueText = data.isOverdue ? `
*************************************************************
PAYMENT OVERDUE
*************************************************************
This royalty payment is past due.${formattedOverdue ? ` Outstanding balance: ${formattedOverdue}` : ''}
Please remit payment immediately to avoid potential license
termination or legal action.
*************************************************************
` : '';

  const requirementsText = (data.reportingRequired || data.auditRights) ? `
LICENSE REQUIREMENTS
--------------------
${data.reportingRequired ? '- Sales/usage report required with payment\n' : ''}${data.auditRights ? '- Licensor reserves audit rights per license agreement\n' : ''}
` : '';

  return `
LICENSE ROYALTY ${data.isOverdue ? 'OVERDUE NOTICE' : 'REMINDER'}
===============================

Dear ${data.ownerName},

This is a ${data.isOverdue ? 'notice that a' : 'reminder that a'} license royalty payment is ${data.isOverdue ? 'overdue' : 'approaching'}. Please review the details below.
${overdueText}
LICENSEE: ${data.licenseeName}
License ID: ${data.licenseId}
${data.licenseeContactEmail ? `Contact: ${data.licenseeContactEmail}` : ''}

PAYMENT DETAILS
---------------
Amount Due: ${formattedAmount}
Payment Period: ${data.paymentPeriod}
Due Date: ${formattedDate}
Status: ${data.isOverdue ? 'OVERDUE' : `${data.daysUntilDue} days remaining`}
Royalty Structure: ${getRoyaltyTypeDisplay(data.royaltyType)}
${data.accountingReference ? `Accounting Reference: ${data.accountingReference}` : ''}

LICENSED ASSETS
---------------
${data.licensedAssets.map(asset => `- ${getAssetTypeLabel(asset.type)}: ${asset.name} (${asset.identifier})`).join('\n')}
${requirementsText}
${data.paymentInstructions ? `
PAYMENT INSTRUCTIONS
--------------------
${data.paymentInstructions}
` : ''}
ACTION REQUIRED
---------------
View license details and track payment at:
${data.actionUrl}

Note: Please ensure payment is received by the due date to maintain good standing and avoid potential late fees or license complications.

---
This is an automated notification from the Intellectual Property Management System.
License ID: ${data.licenseId}
`.trim();
}

/**
 * Generate royalty due reminder email.
 */
export function generateRoyaltyDueEmail(data: RoyaltyDueTemplateData): EmailContent {
  return {
    subject: getSubject(data),
    html: generateHtml(data),
    text: generateText(data),
  };
}
