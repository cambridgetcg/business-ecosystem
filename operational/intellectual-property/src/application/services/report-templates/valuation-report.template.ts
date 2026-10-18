/**
 * Valuation Report HTML Template
 *
 * Generates HTML for IP valuation summary reports.
 *
 * @module application/services/report-templates
 */

import type { ValuationReport, ValuationDetailEntry } from '../report-types.js';

/**
 * Format date string.
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format currency value (values in cents).
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
    draft: 'status-draft',
    in_progress: 'status-progress',
    review: 'status-review',
    approved: 'status-approved',
    superseded: 'status-superseded',
    archived: 'status-archived',
  };
  return classes[status] ?? 'status-draft';
}

/**
 * Render valuation entry row.
 */
function renderValuationRow(v: ValuationDetailEntry): string {
  return `
    <tr class="${v.isExpired ? 'expired-row' : ''}">
      <td>${v.valuationNumber ?? '-'}</td>
      <td>${v.title}</td>
      <td><span class="status-badge ${getStatusClass(v.status)}">${v.status.replace('_', ' ')}</span></td>
      <td>${v.purpose.replace('_', ' ')}</td>
      <td><span class="methodology">${v.methodology.replace(/_/g, ' ')}</span></td>
      <td class="value-cell">
        ${v.value.selected ? formatCurrency(v.value.selected, v.value.currency) : '-'}
        ${v.value.low && v.value.high ? `
          <div class="value-range">
            ${formatCurrency(v.value.low, v.value.currency)} - ${formatCurrency(v.value.high, v.value.currency)}
          </div>
        ` : ''}
      </td>
      <td>${formatDate(v.valuationDate)}</td>
      <td>${v.assets.length}</td>
      <td>${v.isExpired ? '<span class="expired-badge">Expired</span>' : formatDate(v.expirationDate)}</td>
    </tr>
  `;
}

/**
 * Generate Valuation Report HTML.
 */
export function generateValuationReportHTML(report: ValuationReport): string {
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
        background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
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
        color: #0891b2;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e2e8f0;
      }

      .portfolio-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }

      .summary-card {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border-radius: 12px;
        padding: 24px;
        text-align: center;
        border: 1px solid #e2e8f0;
      }

      .summary-card.primary {
        background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
        color: white;
        border: none;
      }

      .summary-card .value {
        font-size: 28px;
        font-weight: 700;
        color: #1e3a5f;
        line-height: 1.2;
      }

      .summary-card.primary .value {
        color: white;
        font-size: 32px;
      }

      .summary-card .label {
        font-size: 13px;
        color: #64748b;
        margin-top: 8px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .summary-card.primary .label {
        color: rgba(255,255,255,0.9);
      }

      .summary-card .sub-value {
        font-size: 14px;
        color: #94a3b8;
        margin-top: 4px;
      }

      .summary-card.primary .sub-value {
        color: rgba(255,255,255,0.7);
      }

      .methodology-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
      }

      .methodology-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 20px;
      }

      .methodology-card h3 {
        font-size: 14px;
        color: #0891b2;
        margin-bottom: 16px;
        text-transform: capitalize;
      }

      .methodology-stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .methodology-stat {
        text-align: center;
        padding: 12px;
        background: #f8fafc;
        border-radius: 6px;
      }

      .methodology-stat .value {
        font-size: 18px;
        font-weight: 700;
        color: #1e3a5f;
      }

      .methodology-stat .label {
        font-size: 11px;
        color: #64748b;
        margin-top: 4px;
        text-transform: uppercase;
      }

      .purpose-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }

      .purpose-card {
        background: #f8fafc;
        border-radius: 8px;
        padding: 16px;
        text-align: center;
      }

      .purpose-card .purpose-name {
        font-size: 12px;
        color: #64748b;
        text-transform: uppercase;
        margin-bottom: 8px;
      }

      .purpose-card .count {
        font-size: 24px;
        font-weight: 700;
        color: #1e3a5f;
      }

      .purpose-card .total-value {
        font-size: 14px;
        color: #0891b2;
        font-weight: 600;
        margin-top: 4px;
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

      tr.expired-row {
        background: #fef2f2;
      }

      .value-cell {
        font-weight: 600;
        color: #1e3a5f;
      }

      .value-range {
        font-size: 11px;
        color: #64748b;
        font-weight: 400;
        margin-top: 2px;
      }

      .status-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
      }

      .status-draft { background: #f1f5f9; color: #475569; }
      .status-progress { background: #dbeafe; color: #1d4ed8; }
      .status-review { background: #fef3c7; color: #92400e; }
      .status-approved { background: #d1fae5; color: #065f46; }
      .status-superseded { background: #e0e7ff; color: #3730a3; }
      .status-archived { background: #f1f5f9; color: #64748b; }

      .methodology {
        display: inline-block;
        padding: 2px 8px;
        background: #ecfdf5;
        color: #047857;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        text-transform: capitalize;
      }

      .expired-badge {
        display: inline-block;
        padding: 2px 8px;
        background: #fef2f2;
        color: #dc2626;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
      }

      .alert-section {
        background: #fef3c7;
        border: 1px solid #fcd34d;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
      }

      .alert-section h3 {
        color: #92400e;
        margin-bottom: 12px;
      }

      .chart-placeholder {
        background: #f8fafc;
        border-radius: 8px;
        padding: 40px;
        text-align: center;
        color: #64748b;
        border: 2px dashed #e2e8f0;
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

  const summary = report.portfolioSummary;

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
      <!-- Portfolio Summary -->
      <section class="section">
        <h2 class="section-title">Portfolio Valuation Summary</h2>
        <div class="portfolio-summary">
          <div class="summary-card primary">
            <div class="value">${formatCurrency(summary.totalApprovedValue, summary.currency)}</div>
            <div class="label">Total Approved Value</div>
          </div>
          <div class="summary-card">
            <div class="value">${formatCurrency(summary.totalDraftValue, summary.currency)}</div>
            <div class="label">Draft Valuations</div>
          </div>
          <div class="summary-card">
            <div class="value">${formatCurrency(summary.totalPendingValue, summary.currency)}</div>
            <div class="label">Pending Review</div>
          </div>
          <div class="summary-card">
            <div class="value">${summary.valuationCount}</div>
            <div class="label">Total Valuations</div>
            <div class="sub-value">${summary.expiredValuationCount} expired</div>
          </div>
          <div class="summary-card">
            <div class="value">${formatCurrency(summary.averageValuePerAsset, summary.currency)}</div>
            <div class="label">Avg Value / Asset</div>
          </div>
        </div>
      </section>

      <!-- Expired Valuations Alert -->
      ${report.expiredValuations.length > 0 ? `
        <section class="section">
          <div class="alert-section">
            <h3>Expired Valuations Requiring Refresh (${report.expiredValuations.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Title</th>
                  <th>Purpose</th>
                  <th>Methodology</th>
                  <th>Value</th>
                  <th>Expiration Date</th>
                </tr>
              </thead>
              <tbody>
                ${report.expiredValuations.slice(0, 10).map(v => `
                  <tr>
                    <td>${v.valuationNumber ?? '-'}</td>
                    <td>${v.title}</td>
                    <td>${v.purpose.replace('_', ' ')}</td>
                    <td>${v.methodology.replace(/_/g, ' ')}</td>
                    <td>${v.value.selected ? formatCurrency(v.value.selected, v.value.currency) : '-'}</td>
                    <td style="color: #dc2626; font-weight: 600;">${formatDate(v.expirationDate)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      ` : ''}

      <!-- By Methodology -->
      <section class="section">
        <h2 class="section-title">Valuations by Methodology</h2>
        <div class="methodology-grid">
          ${report.byMethodology.map(m => `
            <div class="methodology-card">
              <h3>${m.methodology.replace(/_/g, ' ')}</h3>
              <div class="methodology-stats">
                <div class="methodology-stat">
                  <div class="value">${m.valuationCount}</div>
                  <div class="label">Count</div>
                </div>
                <div class="methodology-stat">
                  <div class="value">${formatCurrency(m.totalValue, summary.currency)}</div>
                  <div class="label">Total Value</div>
                </div>
                <div class="methodology-stat">
                  <div class="value">${formatCurrency(m.averageValue, summary.currency)}</div>
                  <div class="label">Average</div>
                </div>
                <div class="methodology-stat">
                  <div class="value">${formatCurrency(m.minValue, summary.currency)} - ${formatCurrency(m.maxValue, summary.currency)}</div>
                  <div class="label">Range</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- By Purpose -->
      <section class="section">
        <h2 class="section-title">Valuations by Purpose</h2>
        <div class="purpose-grid">
          ${Object.entries(report.byPurpose).map(([purpose, data]) => `
            <div class="purpose-card">
              <div class="purpose-name">${purpose.replace(/_/g, ' ')}</div>
              <div class="count">${data.count}</div>
              <div class="total-value">${formatCurrency(data.totalValue, summary.currency)}</div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- By Status -->
      <section class="section">
        <h2 class="section-title">Valuations by Status</h2>
        <div class="purpose-grid">
          ${Object.entries(report.byStatus).map(([status, data]) => `
            <div class="purpose-card">
              <div class="purpose-name">${status.replace(/_/g, ' ')}</div>
              <div class="count">${data.count}</div>
              <div class="total-value">${formatCurrency(data.totalValue, summary.currency)}</div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Recent Valuations -->
      ${report.recentValuations.length > 0 ? `
        <section class="section">
          <h2 class="section-title">Recent Valuations</h2>
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Title</th>
                <th>Status</th>
                <th>Purpose</th>
                <th>Methodology</th>
                <th>Value</th>
                <th>Date</th>
                <th>Assets</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              ${report.recentValuations.map(v => renderValuationRow(v)).join('')}
            </tbody>
          </table>
        </section>
      ` : ''}

      <!-- All Valuations -->
      <section class="section">
        <h2 class="section-title">All Valuations (${report.allValuations.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Title</th>
              <th>Status</th>
              <th>Purpose</th>
              <th>Methodology</th>
              <th>Value</th>
              <th>Date</th>
              <th>Assets</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            ${report.allValuations.slice(0, 50).map(v => renderValuationRow(v)).join('')}
          </tbody>
        </table>
        ${report.allValuations.length > 50 ? `
          <p style="text-align: center; color: #64748b; margin-top: 16px;">
            Showing first 50 of ${report.allValuations.length} valuations. Export to see all.
          </p>
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

export default generateValuationReportHTML;
