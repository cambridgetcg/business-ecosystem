/**
 * Portfolio Summary Report HTML Template
 *
 * Generates HTML for the portfolio summary report.
 *
 * @module application/services/report-templates
 */

import type { PortfolioSummaryReport, DeadlineEntry } from '../report-types.js';

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
  }).format(value / 100); // Values stored in cents
}

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
 * Get priority badge class.
 */
function getPriorityClass(priority: string): string {
  const classes: Record<string, string> = {
    critical: 'priority-critical',
    high: 'priority-high',
    medium: 'priority-medium',
    low: 'priority-low',
  };
  return classes[priority] ?? 'priority-medium';
}

/**
 * Get health score color class.
 */
function getHealthScoreClass(score: number): string {
  if (score >= 80) return 'health-excellent';
  if (score >= 60) return 'health-good';
  if (score >= 40) return 'health-fair';
  return 'health-poor';
}

/**
 * Render deadline entry row.
 */
function renderDeadlineRow(deadline: DeadlineEntry): string {
  return `
    <tr>
      <td>${formatDate(deadline.dueDate)}</td>
      <td>${deadline.assetTitle}</td>
      <td><span class="asset-type">${deadline.assetType}</span></td>
      <td>${deadline.deadlineType}</td>
      <td><span class="priority-badge ${getPriorityClass(deadline.priority)}">${deadline.priority}</span></td>
      <td>${deadline.amount ? formatCurrency(deadline.amount, deadline.currency ?? 'USD') : '-'}</td>
      <td>${deadline.jurisdiction ?? '-'}</td>
    </tr>
  `;
}

/**
 * Generate Portfolio Summary Report HTML.
 */
export function generatePortfolioSummaryHTML(report: PortfolioSummaryReport): string {
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
        background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
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
        color: #1e3a5f;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e2e8f0;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }

      .summary-card {
        background: #f8fafc;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
      }

      .summary-card .value {
        font-size: 32px;
        font-weight: 700;
        color: #1e3a5f;
        line-height: 1.2;
      }

      .summary-card .label {
        font-size: 14px;
        color: #64748b;
        margin-top: 4px;
      }

      .health-score {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        font-size: 24px;
        font-weight: 700;
        color: white;
      }

      .health-excellent { background: #10b981; }
      .health-good { background: #3b82f6; }
      .health-fair { background: #f59e0b; }
      .health-poor { background: #ef4444; }

      .highlights-list {
        list-style: none;
      }

      .highlights-list li {
        padding: 10px 16px;
        margin-bottom: 8px;
        background: #f0fdf4;
        border-left: 4px solid #10b981;
        border-radius: 0 4px 4px 0;
      }

      .alerts-list li {
        background: #fef2f2;
        border-left-color: #ef4444;
      }

      .asset-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
      }

      .asset-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        transition: box-shadow 0.2s;
      }

      .asset-card:hover {
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }

      .asset-card .type {
        font-size: 12px;
        text-transform: uppercase;
        color: #64748b;
        font-weight: 600;
      }

      .asset-card .count {
        font-size: 28px;
        font-weight: 700;
        color: #1e3a5f;
        margin: 8px 0;
      }

      .asset-card .activity {
        font-size: 12px;
        color: #64748b;
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

      .priority-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .priority-critical { background: #fef2f2; color: #dc2626; }
      .priority-high { background: #fff7ed; color: #ea580c; }
      .priority-medium { background: #fefce8; color: #ca8a04; }
      .priority-low { background: #f0fdf4; color: #16a34a; }

      .asset-type {
        display: inline-block;
        padding: 2px 8px;
        background: #e0e7ff;
        color: #4338ca;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }

      .compliance-meter {
        height: 8px;
        background: #e2e8f0;
        border-radius: 4px;
        overflow: hidden;
        margin-top: 8px;
      }

      .compliance-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s;
      }

      .status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
      }

      .status-item {
        text-align: center;
        padding: 16px;
        background: #f8fafc;
        border-radius: 8px;
      }

      .status-item .count {
        font-size: 24px;
        font-weight: 700;
        color: #1e3a5f;
      }

      .status-item .label {
        font-size: 12px;
        color: #64748b;
        text-transform: uppercase;
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

  const executiveSummary = report.executiveSummary;

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
      <!-- Executive Summary -->
      <section class="section">
        <h2 class="section-title">Executive Summary</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="value">${executiveSummary.totalAssets}</div>
            <div class="label">Total IP Assets</div>
          </div>
          <div class="summary-card">
            <div class="value">${executiveSummary.totalActiveAssets}</div>
            <div class="label">Active Assets</div>
          </div>
          <div class="summary-card">
            <div class="health-score ${getHealthScoreClass(executiveSummary.portfolioHealthScore)}">
              ${executiveSummary.portfolioHealthScore}%
            </div>
            <div class="label">Portfolio Health</div>
          </div>
        </div>

        ${executiveSummary.keyHighlights.length > 0 ? `
          <h3 style="font-size: 16px; margin-bottom: 12px; color: #1e3a5f;">Key Highlights</h3>
          <ul class="highlights-list">
            ${executiveSummary.keyHighlights.map(h => `<li>${h}</li>`).join('')}
          </ul>
        ` : ''}

        ${executiveSummary.criticalAlerts.length > 0 ? `
          <h3 style="font-size: 16px; margin: 20px 0 12px; color: #dc2626;">Critical Alerts</h3>
          <ul class="highlights-list alerts-list">
            ${executiveSummary.criticalAlerts.map(a => `<li>${a}</li>`).join('')}
          </ul>
        ` : ''}
      </section>

      <!-- Asset Inventory -->
      <section class="section">
        <h2 class="section-title">IP Asset Inventory</h2>
        <div class="asset-grid">
          ${report.assetInventory.map(asset => `
            <div class="asset-card">
              <div class="type">${asset.type}</div>
              <div class="count">${asset.total}</div>
              <div class="activity">
                +${asset.recentActivity.added} added, ${asset.recentActivity.modified} modified (${asset.recentActivity.period})
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Status Breakdown -->
      <section class="section">
        <h2 class="section-title">Asset Status Breakdown</h2>
        <div class="status-grid">
          <div class="status-item">
            <div class="count" style="color: #10b981;">${report.statusBreakdown.active}</div>
            <div class="label">Active</div>
          </div>
          <div class="status-item">
            <div class="count" style="color: #3b82f6;">${report.statusBreakdown.pending}</div>
            <div class="label">Pending</div>
          </div>
          <div class="status-item">
            <div class="count" style="color: #f59e0b;">${report.statusBreakdown.expired}</div>
            <div class="label">Expired</div>
          </div>
          <div class="status-item">
            <div class="count" style="color: #64748b;">${report.statusBreakdown.abandoned}</div>
            <div class="label">Abandoned</div>
          </div>
          <div class="status-item">
            <div class="count" style="color: #94a3b8;">${report.statusBreakdown.other}</div>
            <div class="label">Other</div>
          </div>
        </div>
      </section>

      <!-- Deadline Calendar -->
      <section class="section">
        <h2 class="section-title">Upcoming Deadlines (90 Days)</h2>
        <div class="summary-grid" style="margin-bottom: 20px;">
          <div class="summary-card">
            <div class="value">${report.deadlineCalendar.totalUpcoming}</div>
            <div class="label">Total Upcoming</div>
          </div>
          <div class="summary-card">
            <div class="value" style="color: #dc2626;">${report.deadlineCalendar.overdueItems.length}</div>
            <div class="label">Overdue</div>
          </div>
        </div>

        ${report.deadlineCalendar.overdueItems.length > 0 ? `
          <h3 style="font-size: 16px; margin-bottom: 12px; color: #dc2626;">Overdue Items</h3>
          <table>
            <thead>
              <tr>
                <th>Due Date</th>
                <th>Asset</th>
                <th>Type</th>
                <th>Deadline</th>
                <th>Priority</th>
                <th>Amount</th>
                <th>Jurisdiction</th>
              </tr>
            </thead>
            <tbody>
              ${report.deadlineCalendar.overdueItems.map(d => renderDeadlineRow(d)).join('')}
            </tbody>
          </table>
        ` : ''}

        ${report.deadlineCalendar.byWeek.slice(0, 4).map(week => `
          <h3 style="font-size: 14px; margin: 20px 0 12px; color: #64748b;">
            ${formatDate(week.weekStart)} - ${formatDate(week.weekEnd)} (${week.deadlines.length} deadlines)
          </h3>
          ${week.deadlines.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Due Date</th>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Deadline</th>
                  <th>Priority</th>
                  <th>Amount</th>
                  <th>Jurisdiction</th>
                </tr>
              </thead>
              <tbody>
                ${week.deadlines.map(d => renderDeadlineRow(d)).join('')}
              </tbody>
            </table>
          ` : '<p style="color: #64748b; font-style: italic;">No deadlines this week</p>'}
        `).join('')}
      </section>

      <!-- Compliance Status -->
      <section class="section">
        <h2 class="section-title">Compliance Status</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="value ${getHealthScoreClass(report.complianceStatus.complianceScore)}">
              ${report.complianceStatus.complianceScore}%
            </div>
            <div class="label">Compliance Score</div>
          </div>
          <div class="summary-card">
            <div class="value" style="color: ${report.complianceStatus.overdueItems > 0 ? '#dc2626' : '#10b981'};">
              ${report.complianceStatus.overdueItems}
            </div>
            <div class="label">Overdue Items</div>
          </div>
          <div class="summary-card">
            <div class="value" style="color: #f59e0b;">${report.complianceStatus.upcomingCritical}</div>
            <div class="label">Upcoming Critical</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">${report.complianceStatus.maintenanceFeesUpToDate ? '✓' : '✗'}</span>
              <span>Maintenance Fees ${report.complianceStatus.maintenanceFeesUpToDate ? 'Up to Date' : 'Require Attention'}</span>
            </div>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">${report.complianceStatus.renewalsUpToDate ? '✓' : '✗'}</span>
              <span>Renewals ${report.complianceStatus.renewalsUpToDate ? 'Up to Date' : 'Require Attention'}</span>
            </div>
          </div>
        </div>

        ${report.complianceStatus.issues.length > 0 ? `
          <h3 style="font-size: 16px; margin: 20px 0 12px; color: #1e3a5f;">Compliance Issues</h3>
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Category</th>
                <th>Description</th>
                <th>Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              ${report.complianceStatus.issues.map(issue => `
                <tr>
                  <td><span class="priority-badge priority-${issue.severity}">${issue.severity}</span></td>
                  <td>${issue.category}</td>
                  <td>${issue.description}</td>
                  <td>${issue.recommendedAction}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </section>

      <!-- Valuation Summary -->
      <section class="section">
        <h2 class="section-title">Valuation Summary</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="value">${formatCurrency(report.valuationSummary.totalApprovedValue, report.valuationSummary.currency)}</div>
            <div class="label">Total Approved Value</div>
          </div>
          <div class="summary-card">
            <div class="value">${formatCurrency(report.valuationSummary.totalPendingValue, report.valuationSummary.currency)}</div>
            <div class="label">Pending Valuations</div>
          </div>
          <div class="summary-card">
            <div class="value">${report.valuationSummary.valuationCount}</div>
            <div class="label">Total Valuations</div>
          </div>
        </div>

        ${report.valuationSummary.recentValuations.length > 0 ? `
          <h3 style="font-size: 16px; margin: 20px 0 12px; color: #1e3a5f;">Recent Valuations</h3>
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Title</th>
                <th>Status</th>
                <th>Methodology</th>
                <th>Value</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${report.valuationSummary.recentValuations.map(v => `
                <tr>
                  <td>${v.valuationNumber}</td>
                  <td>${v.title}</td>
                  <td>${v.status}</td>
                  <td>${v.methodology}</td>
                  <td>${v.selectedValue ? formatCurrency(v.selectedValue, v.currency) : '-'}</td>
                  <td>${formatDate(v.valuationDate)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </section>

      <!-- Enforcement Summary -->
      <section class="section">
        <h2 class="section-title">Enforcement Summary</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="value">${report.enforcementSummary.activeMatterCount}</div>
            <div class="label">Active Matters</div>
          </div>
          <div class="summary-card">
            <div class="value">${formatCurrency(report.enforcementSummary.totalEstimatedDamages, 'USD')}</div>
            <div class="label">Estimated Damages</div>
          </div>
          <div class="summary-card">
            <div class="value">${formatCurrency(report.enforcementSummary.totalActualCosts, 'USD')}</div>
            <div class="label">Actual Costs</div>
          </div>
        </div>

        ${report.enforcementSummary.recentMatters.length > 0 ? `
          <h3 style="font-size: 16px; margin: 20px 0 12px; color: #1e3a5f;">Recent Enforcement Matters</h3>
          <table>
            <thead>
              <tr>
                <th>Matter</th>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Est. Damages</th>
                <th>Detected</th>
              </tr>
            </thead>
            <tbody>
              ${report.enforcementSummary.recentMatters.map(m => `
                <tr>
                  <td>${m.matterNumber ?? '-'}</td>
                  <td>${m.title}</td>
                  <td>${m.type}</td>
                  <td>${m.status}</td>
                  <td><span class="priority-badge priority-${m.priority}">${m.priority}</span></td>
                  <td>${m.estimatedDamages ? formatCurrency(m.estimatedDamages, 'USD') : '-'}</td>
                  <td>${formatDate(m.detectedDate)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </section>
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

export default generatePortfolioSummaryHTML;
