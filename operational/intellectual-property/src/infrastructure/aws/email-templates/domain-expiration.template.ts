/**
 * Domain Expiration Email Template
 *
 * Template for domain name expiration reminders.
 * Supports auto-renewal status and linked trademark alerts.
 *
 * @module infrastructure/aws/email-templates
 */

export interface DomainExpirationTemplateData {
  domainId: string;
  domainName: string;
  expirationDate: Date;
  daysUntilExpiration: number;
  registrar: string;
  registrarUrl?: string;
  autoRenewEnabled: boolean;
  linkedTrademarks?: Array<{
    mark: string;
    registrationNumber: string;
  }>;
  ownerName: string;
  actionUrl: string;
  renewalFee?: number;
  currency?: string;
  privacyProtection?: boolean;
  sslCertificate?: boolean;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Generate subject line based on urgency.
 */
function getSubject(data: DomainExpirationTemplateData): string {
  if (data.daysUntilExpiration <= 7) {
    return `CRITICAL: Domain Expiring in ${data.daysUntilExpiration} Days - ${data.domainName}`;
  }
  if (data.daysUntilExpiration <= 30) {
    return `URGENT: Domain Expiring Soon - ${data.domainName}`;
  }
  return `Reminder: Domain Renewal Due - ${data.domainName}`;
}

/**
 * Get priority badge color.
 */
function getPriorityBadge(daysUntilExpiration: number): { color: string; text: string } {
  if (daysUntilExpiration <= 7) {
    return { color: '#dc3545', text: 'CRITICAL' };
  }
  if (daysUntilExpiration <= 30) {
    return { color: '#fd7e14', text: 'HIGH PRIORITY' };
  }
  if (daysUntilExpiration <= 60) {
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
function generateHtml(data: DomainExpirationTemplateData): string {
  const badge = getPriorityBadge(data.daysUntilExpiration);
  const formattedDate = formatDate(data.expirationDate);
  const formattedFee = data.renewalFee && data.currency
    ? formatCurrency(data.renewalFee, data.currency)
    : 'Contact registrar for pricing';

  const autoRenewStatus = data.autoRenewEnabled
    ? '<span style="color: #28a745; font-weight: 600;">Enabled</span>'
    : '<span style="color: #dc3545; font-weight: 600;">Disabled</span>';

  const trademarkWarningHtml = data.linkedTrademarks && data.linkedTrademarks.length > 0 ? `
    <div class="warning-box">
      <h4>Brand Protection Alert</h4>
      <p>This domain is linked to the following trademark(s). Losing this domain could impact your brand protection:</p>
      <ul>
        ${data.linkedTrademarks.map(tm => `<li><strong>${tm.mark}</strong> (Reg. #${tm.registrationNumber})</li>`).join('')}
      </ul>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Domain Expiration Reminder</title>
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
      background: linear-gradient(135deg, #0d6efd 0%, #0dcaf0 100%);
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
    .domain-display {
      background: #f8f9fa;
      border: 2px solid #0d6efd;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      text-align: center;
    }
    .domain-display h2 {
      margin: 0;
      font-size: 28px;
      color: #0d6efd;
      word-break: break-all;
    }
    .domain-display p {
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
    .status-indicators {
      display: flex;
      gap: 15px;
      margin: 20px 0;
    }
    .status-item {
      flex: 1;
      text-align: center;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
    }
    .status-item .icon {
      font-size: 24px;
      margin-bottom: 8px;
    }
    .status-item .label {
      font-size: 12px;
      color: #6c757d;
    }
    .status-item .value {
      font-weight: 600;
      color: #212529;
    }
    .warning-box {
      background: #fff3cd;
      border: 1px solid #ffeeba;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .warning-box h4 {
      margin: 0 0 10px;
      color: #856404;
    }
    .warning-box p {
      margin: 0 0 10px;
      color: #856404;
    }
    .warning-box ul {
      margin: 0;
      padding-left: 20px;
      color: #856404;
    }
    .action-button {
      display: inline-block;
      background: linear-gradient(135deg, #0d6efd 0%, #0dcaf0 100%);
      color: #ffffff;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
    }
    .secondary-button {
      display: inline-block;
      background: #ffffff;
      color: #0d6efd;
      border: 2px solid #0d6efd;
      padding: 12px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      margin: 10px;
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
      color: #0d6efd;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Domain Expiration Reminder</h1>
      <p>Intellectual Property Management System</p>
      <span class="priority-badge">${badge.text}</span>
    </div>
    <div class="content">
      <p>Dear ${data.ownerName},</p>
      <p>This is a reminder that a domain name registration is expiring soon. Please review the details below and take action to maintain your domain.</p>

      <div class="domain-display">
        <h2>${data.domainName}</h2>
        <p>Registrar: ${data.registrar}</p>
      </div>

      <div class="deadline-box">
        <h3>Expiration Date</h3>
        <div class="deadline-date">${formattedDate}</div>
        <p><strong>${data.daysUntilExpiration} days remaining</strong></p>
      </div>

      <div class="status-indicators">
        <div class="status-item">
          <div class="label">Auto-Renew</div>
          <div class="value">${autoRenewStatus}</div>
        </div>
        <div class="status-item">
          <div class="label">Privacy</div>
          <div class="value">${data.privacyProtection ? '<span style="color: #28a745;">Active</span>' : '<span style="color: #6c757d;">Inactive</span>'}</div>
        </div>
        <div class="status-item">
          <div class="label">SSL</div>
          <div class="value">${data.sslCertificate ? '<span style="color: #28a745;">Active</span>' : '<span style="color: #6c757d;">None</span>'}</div>
        </div>
      </div>

      <table class="details-table">
        <tr>
          <th>Domain Name</th>
          <td>${data.domainName}</td>
        </tr>
        <tr>
          <th>Registrar</th>
          <td>${data.registrar}</td>
        </tr>
        <tr>
          <th>Renewal Fee</th>
          <td>${formattedFee}</td>
        </tr>
      </table>

      ${trademarkWarningHtml}

      <div style="text-align: center;">
        <a href="${data.actionUrl}" class="action-button">Renew Domain Now</a>
        ${data.registrarUrl ? `<br><a href="${data.registrarUrl}" class="secondary-button">Go to Registrar</a>` : ''}
      </div>

      <p><strong>Important:</strong> If this domain expires without renewal, it may enter a redemption period with additional fees, or be released for registration by others. For brand-critical domains, immediate action is recommended.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from the Intellectual Property Management System.</p>
      <p>Domain ID: ${data.domainId}</p>
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
function generateText(data: DomainExpirationTemplateData): string {
  const formattedDate = formatDate(data.expirationDate);
  const formattedFee = data.renewalFee && data.currency
    ? formatCurrency(data.renewalFee, data.currency)
    : 'Contact registrar for pricing';

  const linkedTrademarkText = data.linkedTrademarks && data.linkedTrademarks.length > 0
    ? `
BRAND PROTECTION ALERT
----------------------
This domain is linked to the following trademark(s):
${data.linkedTrademarks.map(tm => `- ${tm.mark} (Reg. #${tm.registrationNumber})`).join('\n')}
Losing this domain could impact your brand protection.
`
    : '';

  return `
DOMAIN EXPIRATION REMINDER
===========================

Dear ${data.ownerName},

This is a reminder that a domain name registration is expiring soon. Please review the details below and take action to maintain your domain.

DOMAIN: ${data.domainName}

EXPIRATION DATE: ${formattedDate}
Days Remaining: ${data.daysUntilExpiration}

DOMAIN DETAILS
--------------
Registrar: ${data.registrar}
Auto-Renew: ${data.autoRenewEnabled ? 'Enabled' : 'Disabled'}
Privacy Protection: ${data.privacyProtection ? 'Active' : 'Inactive'}
SSL Certificate: ${data.sslCertificate ? 'Active' : 'None'}
Renewal Fee: ${formattedFee}
${linkedTrademarkText}
ACTION REQUIRED
---------------
Please visit the following link to renew your domain:
${data.actionUrl}

${data.registrarUrl ? `Or go directly to your registrar:\n${data.registrarUrl}` : ''}

IMPORTANT: If this domain expires without renewal, it may enter a redemption period with additional fees, or be released for registration by others. For brand-critical domains, immediate action is recommended.

---
This is an automated notification from the Intellectual Property Management System.
Domain ID: ${data.domainId}
`.trim();
}

/**
 * Generate domain expiration reminder email.
 */
export function generateDomainExpirationEmail(data: DomainExpirationTemplateData): EmailContent {
  return {
    subject: getSubject(data),
    html: generateHtml(data),
    text: generateText(data),
  };
}
