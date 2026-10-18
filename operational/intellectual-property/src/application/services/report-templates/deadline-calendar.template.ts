/**
 * Deadline Calendar Report HTML Template
 *
 * Generates HTML for deadline calendar reports.
 *
 * @module application/services/report-templates
 */

import type { DeadlineCalendarReport, DeadlineEntry, CalendarMonth } from '../report-types.js';

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
      <td>${deadline.description ?? '-'}</td>
    </tr>
  `;
}

/**
 * Render calendar month view.
 */
function renderCalendarMonth(month: CalendarMonth): string {
  // Build calendar grid
  const firstDay = new Date(month.year, month.month - 1, 1);
  const startingDay = firstDay.getDay();
  const daysInMonth = new Date(month.year, month.month, 0).getDate();

  const daysByDate = new Map(month.days.map(d => [new Date(d.date).getDate(), d]));

  let calendarHTML = '<div class="calendar-grid">';

  // Day headers
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (const day of dayNames) {
    calendarHTML += `<div class="calendar-header">${day}</div>`;
  }

  // Empty cells before first day
  for (let i = 0; i < startingDay; i++) {
    calendarHTML += '<div class="calendar-day empty"></div>';
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayData = daysByDate.get(day);
    const deadlines = dayData?.deadlines ?? [];
    const hasDeadlines = deadlines.length > 0;
    const hasCritical = deadlines.some(d => d.priority === 'critical');
    const hasHigh = deadlines.some(d => d.priority === 'high');

    let dayClass = 'calendar-day';
    if (dayData?.isWeekend) dayClass += ' weekend';
    if (hasCritical) dayClass += ' has-critical';
    else if (hasHigh) dayClass += ' has-high';
    else if (hasDeadlines) dayClass += ' has-deadlines';

    calendarHTML += `
      <div class="${dayClass}">
        <div class="day-number">${day}</div>
        ${hasDeadlines ? `
          <div class="deadline-count">${deadlines.length}</div>
          <div class="deadline-dots">
            ${deadlines.slice(0, 3).map(d => `<span class="dot ${getPriorityClass(d.priority)}"></span>`).join('')}
            ${deadlines.length > 3 ? '<span class="more">+</span>' : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  calendarHTML += '</div>';

  return `
    <div class="calendar-month">
      <div class="month-header">
        <h3>${month.monthName} ${month.year}</h3>
        <div class="month-stats">
          <span>${month.totalDeadlines} deadlines</span>
          ${month.criticalDeadlines > 0 ? `<span class="critical">${month.criticalDeadlines} critical</span>` : ''}
          ${month.highPriorityDeadlines > 0 ? `<span class="high">${month.highPriorityDeadlines} high</span>` : ''}
        </div>
      </div>
      ${calendarHTML}
    </div>
  `;
}

/**
 * Generate Deadline Calendar Report HTML.
 */
export function generateDeadlineCalendarHTML(report: DeadlineCalendarReport): string {
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
        background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
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
        color: #7c3aed;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e2e8f0;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 16px;
        margin-bottom: 30px;
      }

      .stat-card {
        background: #f8fafc;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
      }

      .stat-card .value {
        font-size: 28px;
        font-weight: 700;
        color: #1e3a5f;
        line-height: 1.2;
      }

      .stat-card .value.critical { color: #dc2626; }
      .stat-card .value.high { color: #ea580c; }
      .stat-card .value.overdue { color: #dc2626; }

      .stat-card .label {
        font-size: 12px;
        color: #64748b;
        margin-top: 4px;
        text-transform: uppercase;
      }

      .calendar-month {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 24px;
        overflow: hidden;
      }

      .month-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }

      .month-header h3 {
        font-size: 18px;
        font-weight: 600;
        color: #1e3a5f;
      }

      .month-stats {
        display: flex;
        gap: 16px;
        font-size: 13px;
        color: #64748b;
      }

      .month-stats .critical { color: #dc2626; font-weight: 600; }
      .month-stats .high { color: #ea580c; font-weight: 600; }

      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        padding: 16px;
      }

      .calendar-header {
        text-align: center;
        font-size: 12px;
        font-weight: 600;
        color: #64748b;
        padding: 8px;
        text-transform: uppercase;
      }

      .calendar-day {
        min-height: 80px;
        padding: 8px;
        border: 1px solid #f1f5f9;
        position: relative;
      }

      .calendar-day.empty {
        background: #fafafa;
      }

      .calendar-day.weekend {
        background: #fafafa;
      }

      .calendar-day.has-deadlines {
        background: #f0fdf4;
        border-color: #bbf7d0;
      }

      .calendar-day.has-high {
        background: #fff7ed;
        border-color: #fed7aa;
      }

      .calendar-day.has-critical {
        background: #fef2f2;
        border-color: #fecaca;
      }

      .day-number {
        font-size: 14px;
        font-weight: 600;
        color: #475569;
      }

      .deadline-count {
        position: absolute;
        top: 8px;
        right: 8px;
        background: #7c3aed;
        color: white;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        font-size: 11px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .deadline-dots {
        display: flex;
        gap: 4px;
        margin-top: 8px;
        flex-wrap: wrap;
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .dot.priority-critical { background: #dc2626; }
      .dot.priority-high { background: #ea580c; }
      .dot.priority-medium { background: #ca8a04; }
      .dot.priority-low { background: #16a34a; }

      .more {
        font-size: 10px;
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

      .overdue-section {
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
      }

      .overdue-section h3 {
        color: #991b1b;
        margin-bottom: 12px;
      }

      .breakdown-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
      }

      .breakdown-card {
        background: #f8fafc;
        border-radius: 8px;
        padding: 16px;
      }

      .breakdown-card h4 {
        font-size: 12px;
        color: #64748b;
        text-transform: uppercase;
        margin-bottom: 12px;
      }

      .breakdown-item {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        font-size: 14px;
      }

      .breakdown-item .label { color: #475569; }
      .breakdown-item .value { font-weight: 600; color: #1e3a5f; }

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
        .calendar-month {
          page-break-inside: avoid;
        }
      }
    </style>
  `;

  const stats = report.statistics;

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
        Period: ${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)} |
        Generated: ${formatDate(report.generatedAt)} |
        Report ID: ${report.reportId}
      </div>
    </header>

    <main class="report-body">
      <!-- Statistics Summary -->
      <section class="section">
        <h2 class="section-title">Deadline Statistics</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="value">${stats.totalUpcoming}</div>
            <div class="label">Upcoming</div>
          </div>
          <div class="stat-card">
            <div class="value overdue">${stats.totalOverdue}</div>
            <div class="label">Overdue</div>
          </div>
          <div class="stat-card">
            <div class="value critical">${stats.byPriority.critical ?? 0}</div>
            <div class="label">Critical</div>
          </div>
          <div class="stat-card">
            <div class="value high">${stats.byPriority.high ?? 0}</div>
            <div class="label">High Priority</div>
          </div>
          <div class="stat-card">
            <div class="value">${formatCurrency(stats.totalAmount, stats.currency)}</div>
            <div class="label">Total Amount</div>
          </div>
        </div>

        <div class="breakdown-grid">
          <div class="breakdown-card">
            <h4>By Asset Type</h4>
            ${Object.entries(stats.byAssetType).map(([type, count]) => `
              <div class="breakdown-item">
                <span class="label">${type}</span>
                <span class="value">${count}</span>
              </div>
            `).join('')}
          </div>
          <div class="breakdown-card">
            <h4>By Deadline Type</h4>
            ${Object.entries(stats.byDeadlineType).slice(0, 6).map(([type, count]) => `
              <div class="breakdown-item">
                <span class="label">${type}</span>
                <span class="value">${count}</span>
              </div>
            `).join('')}
          </div>
          <div class="breakdown-card">
            <h4>By Priority</h4>
            ${Object.entries(stats.byPriority).map(([priority, count]) => `
              <div class="breakdown-item">
                <span class="label">${priority}</span>
                <span class="value">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- Overdue Deadlines -->
      ${report.overdueDeadlines.length > 0 ? `
        <section class="section">
          <div class="overdue-section">
            <h3>Overdue Deadlines (${report.overdueDeadlines.length})</h3>
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
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                ${report.overdueDeadlines.map(d => renderDeadlineRow(d)).join('')}
              </tbody>
            </table>
          </div>
        </section>
      ` : ''}

      <!-- Critical Deadlines -->
      ${report.criticalDeadlines.length > 0 ? `
        <section class="section">
          <h2 class="section-title">Critical & High Priority Deadlines</h2>
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
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${report.criticalDeadlines.map(d => renderDeadlineRow(d)).join('')}
            </tbody>
          </table>
        </section>
      ` : ''}

      <!-- Calendar View -->
      <section class="section">
        <h2 class="section-title">Calendar View</h2>
        ${report.months.map(month => renderCalendarMonth(month)).join('')}
      </section>

      <!-- All Deadlines -->
      <section class="section">
        <h2 class="section-title">All Deadlines (${report.allDeadlines.length})</h2>
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
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${report.allDeadlines.slice(0, 100).map(d => renderDeadlineRow(d)).join('')}
          </tbody>
        </table>
        ${report.allDeadlines.length > 100 ? `
          <p style="text-align: center; color: #64748b; margin-top: 16px;">
            Showing first 100 of ${report.allDeadlines.length} deadlines. Export to see all.
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

export default generateDeadlineCalendarHTML;
