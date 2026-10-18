/**
 * Compliance Report HTML Template
 *
 * Generates HTML for compliance status reports.
 *
 * @module application/services/report-templates
 */

import type { ComplianceReport, ComplianceItem } from '../report-types.js';

/**
 * Format date string.
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format currency value.
 */
function formatCurrency(value: number | undefined, currency: string): string {
  if (value === undefined || value === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

/**
 * Get status badge class.
 */
function getStatusClass(status: string): string {
  const classes: Record<string, string> = {
    compliant: 'status-compliant',
    non_compliant: 'status-noncompliant',
    pending: 'status-pending',
    waived: 'status-waived',
  };
  return classes[status] ?? 'status-pending';
}

/**
 * Get compliance score color.
 */
function getScoreColor(score: number): string {
  if (score >= 90) return '#10b981';
  if (score >= 70) return '#3b82f6';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

/**
 * Render compliance item row.
 */
function renderComplianceRow(item: ComplianceItem): string {
  return `
    <tr>
      <td>${item.assetTitle}</td>
      <td><span class="asset-type">${item.assetType}</span></td>
      <td>${item.requirementType}</td>
      <td>${formatDate(item.dueDate)}</td>
      <td><span class="status-badge ${getStatusClass(item.status)}">${item.status.replace('_', ' ')}</span></td>
      <td>${item.jurisdiction}</td>
      <td>${item.amount ? formatCurrency(item.amount, item.currency ?? 'USD') : '-'}</td>
      <td>${item.responsibleParty ?? '-'}</td>
    </tr>
  `;
}

/**
 * Generate Compliance Report HTML.
 */
export function generateComplianceReportHTML(report: ComplianceReport): string {
  const styles = `
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #1a1a1a;
        background: #f5f5f5;
        padding: 20px;
      }

      .report-container {
        max-width: 1200px;
        margin: 0 auto;
        background: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        border-radius: 8px;
        overflow: hidden;
      }

      .report-header {
        background: linear-gradient(135deg, #059669 0%, #10b981 100%);
        color: white;
        padding: 40px;
      }

      .report-header h1 {
        font-size: 28px;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .report-meta {
        font-size: 14px;
        opacity: 0.9;
      }

      .report-body {
        padding: 40px;
      }

      .section {
        margin-bottom: 40px;
      }

      .section-title {
        font-size: 20px;
        font-weight: 600;
        color: #059669;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e2e8f0;
      }

      .score-display {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 40px;
        padding: 40px;
        background: #f8fafc;
        border-radius: 12px;
        margin-bottom: 30px;
      }

      .score-circle {
        width: 150px;
        height: 150px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 42px;
        font-weight: 700;
        color: white;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      }

      .score-details {
        flex: 1;
      }

      .score-breakdown {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      .score-item {
        text-align: center;
        padding: 16px;
        background: white;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
      }

      .score-item .value {
        font-size: 28px;
        font-weight: 700;
        color: #1e3a5f;
      }

      .score-item .label {
        font-size: 12px;
        color: #64748b;
        text-transform: uppercase;
      }

      .category-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 16px;
      }

      .category-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 20px;
      }

      .category-card h3 {
        font-size: 14px;
        color: #64748b;
        margin-bottom: 16px;
        text-transform: uppercase;
      }

      .progress-bar {
        height: 8px;
        background: #e2e8f0;
        border-radius: 4px;
        overflow: hidden;
        margin: 8px 0;
      }

      .progress-fill {
        height: 100%;
        border-radius: 4px;
        background: #10b981;
      }

      .category-stats {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #64748b;
        margin-top: 12px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }

      th, td {
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
      }

      th {
        background: #f8fafc;
        font-weight: 600;
        color: #475569;
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 0.05em;
      }

      tr:hover {
        background: #f8fafc;
      }

      .status-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
      }

      .status-compliant { background: #d1fae5; color: #065f46; }
      .status-noncompliant { background: #fee2e2; color: #991b1b; }
      .status-pending { background: #fef3c7; color: #92400e; }
      .status-waived { background: #e0e7ff; color: #3730a3; }

      .asset-type {
        display: inline-block;
        padding: 2px 8px;
        background: #e0e7ff;
        color: #4338ca;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }

      .alert-section {
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
      }

      .alert-section h3 {
        color: #991b1b;
        margin-bottom: 12px;
      }

      .trend-chart {
        padding: 20px;
        background: #f8fafc;
        border-radius: 8px;
        text-align: center;
        color: #64748b;
      }

      .report-footer {
        padding: 20px 40px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        font-size: 12px;
        color: #64748b;
        text-align: center;
      }

      @media print {
        body {
          background: white;
          padding: 0;
        }
        .report-container {
          box-shadow: none;
        }
        .section {
          page-break-inside: avoid;
        }
      }
    </style>
  `;

  const overall = report.overallCompliance;
  const scoreColor = getScoreColor(overall.score);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  ${styles}
</head>
<body>
  <div class="report-container">
    <header class="report-header">
      <h1>${report.title}</h1>
      <div class="report-meta">
        Generated: ${formatDate(report.generatedAt)} | As of: ${formatDate(report.asOfDate)} | Report ID: ${report.reportId}
      </div>
    </header>

    <main class="report-body">
      <!-- Compliance Score -->
      <section class="section">
        <h2 class="section-title">Overall Compliance</h2>
        <div class="score-display">
          <div class="score-circle" style="background: ${scoreColor};">
            ${overall.score}%
          </div>
          <div class="score-details">
            <div class="score-breakdown">
              <div class="score-item">
                <div class="value" style="color: #10b981;">${overall.compliantCount}</div>
                <div class="label">Compliant</div>
              </div>
              <div class="score-item">
                <div class="value" style="color: #ef4444;">${overall.nonCompliantCount}</div>
                <div class="label">Non-Compliant</div>
              </div>
              <div class="score-item">
                <div class="value" style="color: #f59e0b;">${overall.pendingCount}</div>
                <div class="label">Pending</div>
              </div>
              <div class="score-item">
                <div class="value" style="color: #6366f1;">${overall.waivedCount}</div>
                <div class="label">Waived</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Critical Issues -->
      ${report.criticalIssues.length > 0 ? `
        <section class="section">
          <div class="alert-section">
            <h3>Critical Issues Requiring Immediate Attention</h3>
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Requirement</th>
                  <th>Due Date</th>
                  <th>Jurisdiction</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${report.criticalIssues.map(item => `
                  <tr>
                    <td>${item.assetTitle}</td>
                    <td><span class="asset-type">${item.assetType}</span></td>
                    <td>${item.requirementType}</td>
                    <td style="color: #ef4444; font-weight: 600;">${formatDate(item.dueDate)}</td>
                    <td>${item.jurisdiction}</td>
                    <td>${item.amount ? formatCurrency(item.amount, item.currency ?? 'USD') : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      ` : ''}

      <!-- Compliance by Category -->
      <section class="section">
        <h2 class="section-title">Compliance by Category</h2>
        <div class="category-grid">
          ${Object.entries(report.byCategory).map(([category, data]) => {
            const complianceRate = data.total > 0 ? Math.round((data.compliant / data.total) * 100) : 0;
            return `
              <div class="category-card">
                <h3>${category}</h3>
                <div style="font-size: 24px; font-weight: 700; color: ${getScoreColor(complianceRate)};">
                  ${complianceRate}%
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${complianceRate}%; background: ${getScoreColor(complianceRate)};"></div>
                </div>
                <div class="category-stats">
                  <span>${data.compliant} compliant</span>
                  <span>${data.nonCompliant} issues</span>
                  <span>${data.pending} pending</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- Compliance by Jurisdiction -->
      <section class="section">
        <h2 class="section-title">Compliance by Jurisdiction</h2>
        <div class="category-grid">
          ${Object.entries(report.byJurisdiction).map(([jurisdiction, data]) => {
            const complianceRate = data.total > 0 ? Math.round((data.compliant / data.total) * 100) : 0;
            return `
              <div class="category-card">
                <h3>${jurisdiction}</h3>
                <div style="font-size: 24px; font-weight: 700; color: ${getScoreColor(complianceRate)};">
                  ${complianceRate}%
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${complianceRate}%; background: ${getScoreColor(complianceRate)};"></div>
                </div>
                <div class="category-stats">
                  <span>${data.compliant} compliant</span>
                  <span>${data.nonCompliant} issues</span>
                  <span>${data.pending} pending</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- Upcoming Deadlines -->
      ${report.upcomingDeadlines.length > 0 ? `
        <section class="section">
          <h2 class="section-title">Upcoming Compliance Deadlines</h2>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Requirement</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Jurisdiction</th>
                <th>Amount</th>
                <th>Responsible</th>
              </tr>
            </thead>
            <tbody>
              ${report.upcomingDeadlines.map(item => renderComplianceRow(item)).join('')}
            </tbody>
          </table>
        </section>
      ` : ''}

      <!-- Historical Trend -->
      ${report.trend.length > 0 ? `
        <section class="section">
          <h2 class="section-title">Compliance Trend</h2>
          <div class="trend-chart">
            <p>Historical compliance trend data available for ${report.trend.length} data points.</p>
            <p>Latest score: ${report.trend[report.trend.length - 1]?.complianceScore ?? 'N/A'}%</p>
          </div>
        </section>
      ` : ''}

      <!-- All Compliance Items -->
      ${report.items.length > 0 ? `
        <section class="section">
          <h2 class="section-title">All Compliance Items (${report.items.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Requirement</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Jurisdiction</th>
                <th>Amount</th>
                <th>Responsible</th>
              </tr>
            </thead>
            <tbody>
              ${report.items.slice(0, 50).map(item => renderComplianceRow(item)).join('')}
            </tbody>
          </table>
          ${report.items.length > 50 ? `
            <p style="text-align: center; color: #64748b; margin-top: 16px;">
              Showing first 50 of ${report.items.length} items. Export to see all items.
            </p>
          ` : ''}
        </section>
      ` : ''}
    </main>

    <footer class="report-footer">
      This report was generated automatically by the IP Portfolio Management System.
      Report ID: ${report.reportId} | Generated: ${new Date(report.generatedAt).toISOString()}
    </footer>
  </div>
</body>
</html>
  `.trim();
}

export default generateComplianceReportHTML;
