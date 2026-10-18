/**
 * Critical Alert Email Template
 *
 * Template for critical IP alerts requiring immediate attention:
 * - Trademark oppositions
 * - Domain disputes (UDRP)
 * - Trade secret compromises
 * - Patent infringement notices
 *
 * @module infrastructure/aws/email-templates
 */

export type CriticalAlertType =
  | 'trademark_opposition'
  | 'domain_dispute'
  | 'trade_secret_compromise'
  | 'patent_infringement'
  | 'license_breach'
  | 'deadline_missed';

export interface CriticalAlertTemplateData {
  alertId: string;
  alertType: CriticalAlertType;
  assetId: string;
  assetName: string;
  title: string;
  description: string;
  filedDate?: Date;
  responseDeadline?: Date;
  daysToRespond?: number;
  opposingParty?: string;
  jurisdiction?: string;
  caseNumber?: string;
  legalCounsel?: {
    name: string;
    email: string;
    phone?: string;
  };
  ownerName: string;
  actionUrl: string;
  additionalDetails?: Record<string, string>;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Get alert configuration based on type.
 */
function getAlertConfig(alertType: CriticalAlertType): {
  headerColor: string;
  icon: string;
  typeLabel: string;
} {
  const configs: Record<CriticalAlertType, { headerColor: string; icon: string; typeLabel: string }> = {
    trademark_opposition: {
      headerColor: '#dc3545',
      icon: 'shield-exclamation',
      typeLabel: 'Trademark Opposition Filed',
    },
    domain_dispute: {
      headerColor: '#dc3545',
      icon: 'globe-warning',
      typeLabel: 'Domain Dispute (UDRP)',
    },
    trade_secret_compromise: {
      headerColor: '#7c3aed',
      icon: 'lock-open',
      typeLabel: 'Trade Secret Compromise',
    },
    patent_infringement: {
      headerColor: '#d97706',
      icon: 'document-warning',
      typeLabel: 'Patent Infringement Notice',
    },
    license_breach: {
      headerColor: '#dc2626',
      icon: 'contract-break',
      typeLabel: 'License Breach Alert',
    },
    deadline_missed: {
      headerColor: '#991b1b',
      icon: 'clock-warning',
      typeLabel: 'Critical Deadline Missed',
    },
  };
  return configs[alertType];
}

/**
 * Generate subject line.
 */
function getSubject(data: CriticalAlertTemplateData): string {
  const config = getAlertConfig(data.alertType);
  return `URGENT ACTION REQUIRED: ${config.typeLabel} - ${data.assetName}`;
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
function generateHtml(data: CriticalAlertTemplateData): string {
  const config = getAlertConfig(data.alertType);
  const formattedFiledDate = data.filedDate ? formatDate(data.filedDate) : 'Not specified';
  const formattedDeadline = data.responseDeadline ? formatDate(data.responseDeadline) : 'Contact legal counsel';

  const additionalDetailsHtml = data.additionalDetails
    ? Object.entries(data.additionalDetails)
        .map(([key, value]) => `
          <tr>
            <th>${key}</th>
            <td>${value}</td>
          </tr>
        `)
        .join('')
    : '';

  const legalCounselHtml = data.legalCounsel ? `
    <div class="counsel-box">
      <h4>Legal Counsel Contact</h4>
      <p><strong>${data.legalCounsel.name}</strong></p>
      <p>Email: <a href="mailto:${data.legalCounsel.email}">${data.legalCounsel.email}</a></p>
      ${data.legalCounsel.phone ? `<p>Phone: ${data.legalCounsel.phone}</p>` : ''}
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Critical IP Alert</title>
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
      background: linear-gradient(135deg, ${config.headerColor} 0%, #7f1d1d 100%);
      color: #ffffff;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .header .alert-type {
      margin: 15px 0 0;
      font-size: 28px;
      font-weight: 700;
    }
    .urgent-banner {
      background: #fef2f2;
      border: 2px solid ${config.headerColor};
      color: ${config.headerColor};
      padding: 15px;
      text-align: center;
      font-weight: 700;
      font-size: 16px;
      letter-spacing: 1px;
    }
    .content {
      padding: 30px;
    }
    .asset-display {
      background: #f8f9fa;
      border-left: 4px solid ${config.headerColor};
      padding: 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .asset-display h2 {
      margin: 0;
      font-size: 24px;
      color: #1a365d;
    }
    .asset-display p {
      margin: 10px 0 0;
      color: #6c757d;
    }
    .deadline-critical {
      background: ${config.headerColor};
      color: #ffffff;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      text-align: center;
    }
    .deadline-critical h3 {
      margin: 0 0 10px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.9;
    }
    .deadline-critical .date {
      font-size: 28px;
      font-weight: 700;
      margin: 10px 0;
    }
    .deadline-critical .days {
      font-size: 18px;
      font-weight: 600;
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
    .description-box {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .description-box h4 {
      margin: 0 0 10px;
      color: #1a365d;
    }
    .description-box p {
      margin: 0;
      color: #495057;
    }
    .counsel-box {
      background: #e7f5ff;
      border: 1px solid #74c0fc;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .counsel-box h4 {
      margin: 0 0 10px;
      color: #1864ab;
    }
    .counsel-box p {
      margin: 5px 0;
      color: #1864ab;
    }
    .counsel-box a {
      color: #1864ab;
    }
    .action-steps {
      background: #fff3cd;
      border: 1px solid #ffeeba;
      padding: 20px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .action-steps h4 {
      margin: 0 0 15px;
      color: #856404;
    }
    .action-steps ol {
      margin: 0;
      padding-left: 20px;
      color: #856404;
    }
    .action-steps li {
      margin: 8px 0;
    }
    .action-button {
      display: inline-block;
      background: ${config.headerColor};
      color: #ffffff;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 700;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 1px;
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
      color: ${config.headerColor};
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Critical IP Alert</h1>
      <div class="alert-type">${config.typeLabel}</div>
    </div>
    <div class="urgent-banner">
      IMMEDIATE ACTION REQUIRED
    </div>
    <div class="content">
      <p>Dear ${data.ownerName},</p>
      <p>This is an urgent notification requiring your immediate attention. A critical intellectual property matter has been identified that requires prompt action to protect your rights.</p>

      <div class="asset-display">
        <h2>${data.title}</h2>
        <p>Asset: ${data.assetName}</p>
        ${data.caseNumber ? `<p>Case/Reference: ${data.caseNumber}</p>` : ''}
      </div>

      ${data.responseDeadline ? `
      <div class="deadline-critical">
        <h3>Response Deadline</h3>
        <div class="date">${formattedDeadline}</div>
        ${data.daysToRespond !== undefined ? `<div class="days">${data.daysToRespond} days remaining to respond</div>` : ''}
      </div>
      ` : ''}

      <div class="description-box">
        <h4>Details</h4>
        <p>${data.description}</p>
      </div>

      <table class="details-table">
        ${data.opposingParty ? `
        <tr>
          <th>Opposing Party</th>
          <td><strong>${data.opposingParty}</strong></td>
        </tr>
        ` : ''}
        ${data.filedDate ? `
        <tr>
          <th>Filed Date</th>
          <td>${formattedFiledDate}</td>
        </tr>
        ` : ''}
        ${data.jurisdiction ? `
        <tr>
          <th>Jurisdiction</th>
          <td>${data.jurisdiction}</td>
        </tr>
        ` : ''}
        ${additionalDetailsHtml}
      </table>

      ${legalCounselHtml}

      <div class="action-steps">
        <h4>Recommended Immediate Actions</h4>
        <ol>
          <li>Review all documentation related to this matter</li>
          <li>Contact legal counsel immediately if not already engaged</li>
          <li>Preserve all evidence and relevant communications</li>
          <li>Prepare response strategy within deadline requirements</li>
          <li>Document all actions taken with timestamps</li>
        </ol>
      </div>

      <div style="text-align: center;">
        <a href="${data.actionUrl}" class="action-button">View Full Details & Take Action</a>
      </div>

      <p style="color: ${config.headerColor}; font-weight: 600;"><strong>WARNING:</strong> Failure to respond by the deadline may result in loss of rights, default judgment, or other adverse consequences. Time-sensitive action is required.</p>
    </div>
    <div class="footer">
      <p>This is an automated critical alert from the Intellectual Property Management System.</p>
      <p>Alert ID: ${data.alertId}</p>
      <p><a href="${data.actionUrl}">Access IP Management Portal</a></p>
    </div>
  </div>
</body>
</html>
`.trim();
}

/**
 * Generate plain text email content.
 */
function generateText(data: CriticalAlertTemplateData): string {
  const config = getAlertConfig(data.alertType);
  const formattedFiledDate = data.filedDate ? formatDate(data.filedDate) : 'Not specified';
  const formattedDeadline = data.responseDeadline ? formatDate(data.responseDeadline) : 'Contact legal counsel';

  const additionalDetailsText = data.additionalDetails
    ? Object.entries(data.additionalDetails)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
    : '';

  const legalCounselText = data.legalCounsel
    ? `
LEGAL COUNSEL CONTACT
---------------------
${data.legalCounsel.name}
Email: ${data.legalCounsel.email}
${data.legalCounsel.phone ? `Phone: ${data.legalCounsel.phone}` : ''}
`
    : '';

  return `
*************************************************************
CRITICAL IP ALERT - IMMEDIATE ACTION REQUIRED
*************************************************************

${config.typeLabel.toUpperCase()}

Dear ${data.ownerName},

This is an urgent notification requiring your immediate attention. A critical intellectual property matter has been identified that requires prompt action to protect your rights.

MATTER DETAILS
==============
${data.title}

Asset: ${data.assetName}
${data.caseNumber ? `Case/Reference: ${data.caseNumber}` : ''}

${data.responseDeadline ? `
RESPONSE DEADLINE: ${formattedDeadline}
${data.daysToRespond !== undefined ? `Days Remaining: ${data.daysToRespond}` : ''}
` : ''}

DESCRIPTION
-----------
${data.description}

${data.opposingParty ? `Opposing Party: ${data.opposingParty}` : ''}
${data.filedDate ? `Filed Date: ${formattedFiledDate}` : ''}
${data.jurisdiction ? `Jurisdiction: ${data.jurisdiction}` : ''}
${additionalDetailsText}
${legalCounselText}
RECOMMENDED IMMEDIATE ACTIONS
-----------------------------
1. Review all documentation related to this matter
2. Contact legal counsel immediately if not already engaged
3. Preserve all evidence and relevant communications
4. Prepare response strategy within deadline requirements
5. Document all actions taken with timestamps

ACTION REQUIRED
---------------
View full details and take action at:
${data.actionUrl}

*************************************************************
WARNING: Failure to respond by the deadline may result in
loss of rights, default judgment, or other adverse consequences.
Time-sensitive action is required.
*************************************************************

---
This is an automated critical alert from the Intellectual Property Management System.
Alert ID: ${data.alertId}
`.trim();
}

/**
 * Generate critical alert email.
 */
export function generateCriticalAlertEmail(data: CriticalAlertTemplateData): EmailContent {
  return {
    subject: getSubject(data),
    html: generateHtml(data),
    text: generateText(data),
  };
}
