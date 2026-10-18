/**
 * Patent Maintenance Fee Email Template
 *
 * Template for patent maintenance fee deadline reminders.
 * Supports multiple languages and jurisdictions.
 *
 * @module infrastructure/aws/email-templates
 */

export interface MaintenanceFeeTemplateData {
  patentId: string;
  patentNumber: string;
  title: string;
  feeWindow: string;
  dueDate: Date;
  amount: number;
  currency: string;
  jurisdiction: string;
  daysUntilDue: number;
  ownerName: string;
  actionUrl: string;
  paymentInstructions?: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Generate subject line based on urgency.
 */
function getSubject(data: MaintenanceFeeTemplateData): string {
  if (data.daysUntilDue <= 7) {
    return `URGENT: Patent Maintenance Fee Due in ${data.daysUntilDue} Days - ${data.patentNumber}`;
  }
  if (data.daysUntilDue <= 30) {
    return `Action Required: Patent Maintenance Fee Due Soon - ${data.patentNumber}`;
  }
  return `Reminder: Patent Maintenance Fee Due - ${data.patentNumber}`;
}

/**
 * Get priority badge color.
 */
function getPriorityBadge(daysUntilDue: number): { color: string; text: string } {
  if (daysUntilDue <= 7) {
    return { color: '#dc3545', text: 'CRITICAL' };
  }
  if (daysUntilDue <= 30) {
    return { color: '#fd7e14', text: 'HIGH PRIORITY' };
  }
  if (daysUntilDue <= 90) {
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
 * Generate HTML email content.
 */
function generateHtml(data: MaintenanceFeeTemplateData): string {
  const badge = getPriorityBadge(data.daysUntilDue);
  const formattedAmount = formatCurrency(data.amount, data.currency);
  const formattedDate = formatDate(data.dueDate);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Patent Maintenance Fee Reminder</title>
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
      background: linear-gradient(135deg, #1a365d 0%, #2d5a9b 100%);
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
    .amount-highlight {
      font-size: 18px;
      font-weight: 700;
      color: #1a365d;
    }
    .action-button {
      display: inline-block;
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      color: #ffffff;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
    }
    .action-button:hover {
      opacity: 0.9;
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
      color: #1a365d;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Patent Maintenance Fee Reminder</h1>
      <p>Intellectual Property Management System</p>
      <span class="priority-badge">${badge.text}</span>
    </div>
    <div class="content">
      <p>Dear ${data.ownerName},</p>
      <p>This is a reminder that a patent maintenance fee is due. Please review the details below and take action before the deadline.</p>

      <div class="deadline-box">
        <h3>Payment Deadline</h3>
        <div class="deadline-date">${formattedDate}</div>
        <p><strong>${data.daysUntilDue} days remaining</strong></p>
      </div>

      <table class="details-table">
        <tr>
          <th>Patent Number</th>
          <td>${data.patentNumber}</td>
        </tr>
        <tr>
          <th>Title</th>
          <td>${data.title}</td>
        </tr>
        <tr>
          <th>Fee Window</th>
          <td>${data.feeWindow}</td>
        </tr>
        <tr>
          <th>Jurisdiction</th>
          <td>${data.jurisdiction}</td>
        </tr>
        <tr>
          <th>Amount Due</th>
          <td><span class="amount-highlight">${formattedAmount}</span></td>
        </tr>
      </table>

      <div style="text-align: center;">
        <a href="${data.actionUrl}" class="action-button">View Patent Details & Pay</a>
      </div>

      ${data.paymentInstructions ? `
      <div class="instructions">
        <h4>Payment Instructions</h4>
        <p>${data.paymentInstructions}</p>
      </div>
      ` : ''}

      <p><strong>Important:</strong> Failure to pay the maintenance fee by the deadline may result in the patent lapsing or additional late fees. If you have any questions, please contact your IP administrator.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from the Intellectual Property Management System.</p>
      <p>Patent ID: ${data.patentId}</p>
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
function generateText(data: MaintenanceFeeTemplateData): string {
  const formattedAmount = formatCurrency(data.amount, data.currency);
  const formattedDate = formatDate(data.dueDate);

  return `
PATENT MAINTENANCE FEE REMINDER
================================

Dear ${data.ownerName},

This is a reminder that a patent maintenance fee is due. Please review the details below and take action before the deadline.

PAYMENT DEADLINE: ${formattedDate}
Days Remaining: ${data.daysUntilDue}

PATENT DETAILS
--------------
Patent Number: ${data.patentNumber}
Title: ${data.title}
Fee Window: ${data.feeWindow}
Jurisdiction: ${data.jurisdiction}
Amount Due: ${formattedAmount}

ACTION REQUIRED
---------------
Please visit the following link to view patent details and make payment:
${data.actionUrl}

${data.paymentInstructions ? `
PAYMENT INSTRUCTIONS
--------------------
${data.paymentInstructions}
` : ''}
IMPORTANT: Failure to pay the maintenance fee by the deadline may result in the patent lapsing or additional late fees. If you have any questions, please contact your IP administrator.

---
This is an automated notification from the Intellectual Property Management System.
Patent ID: ${data.patentId}
`.trim();
}

/**
 * Generate maintenance fee reminder email.
 */
export function generateMaintenanceFeeEmail(data: MaintenanceFeeTemplateData): EmailContent {
  return {
    subject: getSubject(data),
    html: generateHtml(data),
    text: generateText(data),
  };
}
