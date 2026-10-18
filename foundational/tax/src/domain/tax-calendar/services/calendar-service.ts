/**
 * Tax Calendar Service
 *
 * Manages tax deadlines, generates calendar periods, and handles reminders.
 * Implements UK HMRC deadline rules for Corporation Tax, VAT, and PAYE.
 */

import { randomUUID } from 'crypto';
import type {
  TaxDeadline,
  TaxDeadlineType,
  DeadlineStatus,
  DeadlinePriority,
  TaxCalendarPeriod,
  CalendarMonth,
  DeadlineSummary,
  ReminderConfig,
} from '../models/calendar.js';

// =============================================================================
// UK Tax Deadline Rules
// =============================================================================

export const UKDeadlineRules = {
  // Corporation Tax
  CT_RETURN_MONTHS_AFTER_PERIOD_END: 12,
  CT_PAYMENT_MONTHS_AFTER_PERIOD_END: 9,
  CT_PAYMENT_DAYS_AFTER_PERIOD_END: 1, // 9 months + 1 day

  // VAT
  VAT_RETURN_DAYS_AFTER_QUARTER_END: 37, // 1 month + 7 days (MTD)
  VAT_PAYMENT_DAYS_AFTER_QUARTER_END: 37,

  // PAYE
  PAYE_FPS_DAYS_BEFORE_PAYMENT: 0, // On or before payday
  PAYE_MONTHLY_PAYMENT_DAY: 22, // 22nd of following month (19th if postal)
  PAYE_QUARTERLY_PAYMENT_DAY: 22, // For small employers

  // Annual filings
  ANNUAL_ACCOUNTS_MONTHS_AFTER_PERIOD_END: 9,
  P11D_FILING_MONTH: 7, // 6th July
  P11D_FILING_DAY: 6,
  P11D_CLASS1A_PAYMENT_MONTH: 7, // 22nd July
  P11D_CLASS1A_PAYMENT_DAY: 22,
  P60_ISSUE_MONTH: 5, // 31st May
  P60_ISSUE_DAY: 31,

  // Warning periods (days before deadline)
  WARNING_PERIOD_CRITICAL: 7,
  WARNING_PERIOD_HIGH: 14,
  WARNING_PERIOD_MEDIUM: 30,
} as const;

// =============================================================================
// Tax Calendar Service
// =============================================================================

export class TaxCalendarService {
  private deadlines: Map<string, TaxDeadline> = new Map();
  private periods: Map<string, TaxCalendarPeriod> = new Map();
  private reminderConfigs: Map<string, ReminderConfig> = new Map();

  /**
   * Generate a tax calendar period with all key dates
   */
  generateCalendarPeriod(input: {
    tenantId: string;
    entityId: string;
    accountingPeriodEnd: Date;
    vatQuarterEndMonth?: number;
  }): TaxCalendarPeriod {
    const { tenantId, entityId, accountingPeriodEnd, vatQuarterEndMonth } = input;
    const now = new Date();

    // Calculate tax year (UK tax year runs 6 April - 5 April)
    const yearEnd = accountingPeriodEnd.getMonth() >= 3
      ? accountingPeriodEnd.getFullYear()
      : accountingPeriodEnd.getFullYear() - 1;
    const taxYear = `${yearEnd}-${(yearEnd + 1).toString().slice(2)}`;

    // Period dates
    const periodEnd = new Date(accountingPeriodEnd);
    const periodStart = new Date(periodEnd);
    periodStart.setFullYear(periodStart.getFullYear() - 1);
    periodStart.setDate(periodStart.getDate() + 1);

    // Corporation Tax deadlines
    const ctFilingDeadline = this.addMonths(periodEnd, UKDeadlineRules.CT_RETURN_MONTHS_AFTER_PERIOD_END);
    const ctPaymentDeadline = this.addMonths(periodEnd, UKDeadlineRules.CT_PAYMENT_MONTHS_AFTER_PERIOD_END);
    ctPaymentDeadline.setDate(ctPaymentDeadline.getDate() + UKDeadlineRules.CT_PAYMENT_DAYS_AFTER_PERIOD_END);

    // VAT return dates (quarterly)
    const vatReturnDates = this.generateVATDates(periodStart, periodEnd, vatQuarterEndMonth);

    // PAYE monthly dates
    const payeMonthlyDates = this.generatePAYEDates(periodStart, periodEnd);

    // Annual deadlines
    const p11dFilingDeadline = new Date(periodEnd.getFullYear() + 1, UKDeadlineRules.P11D_FILING_MONTH - 1, UKDeadlineRules.P11D_FILING_DAY);
    const annualAccountsDeadline = this.addMonths(periodEnd, UKDeadlineRules.ANNUAL_ACCOUNTS_MONTHS_AFTER_PERIOD_END);

    const period: TaxCalendarPeriod = {
      id: randomUUID(),
      tenantId,
      entityId,
      taxYear,
      periodStart,
      periodEnd,
      accountingPeriodEnd: periodEnd,
      vatQuarterEndMonth,
      corporationTaxFilingDeadline: ctFilingDeadline,
      corporationTaxPaymentDeadline: ctPaymentDeadline,
      vatReturnDates,
      payeMonthlyDates,
      p11dFilingDeadline,
      annualAccountsDeadline,
      deadlinesGenerated: false,
      createdAt: now,
      updatedAt: now,
    };

    const key = `${entityId}:${taxYear}`;
    this.periods.set(key, period);
    return period;
  }

  /**
   * Generate all deadlines for a calendar period
   */
  generateDeadlines(periodId: string): TaxDeadline[] {
    const period = Array.from(this.periods.values()).find(p => p.id === periodId);
    if (!period) {
      throw new Error(`Period not found: ${periodId}`);
    }

    const now = new Date();
    const deadlines: TaxDeadline[] = [];

    // Corporation Tax Filing
    deadlines.push(this.createDeadline({
      tenantId: period.tenantId,
      entityId: period.entityId,
      type: 'ct_return_filing',
      title: `Corporation Tax Return - ${period.taxYear}`,
      description: `File CT600 return for accounting period ending ${period.periodEnd.toISOString().split('T')[0]}`,
      taxType: 'corporation_tax',
      taxPeriod: period.taxYear,
      dueDate: period.corporationTaxFilingDeadline,
    }));

    // Corporation Tax Payment
    deadlines.push(this.createDeadline({
      tenantId: period.tenantId,
      entityId: period.entityId,
      type: 'ct_payment',
      title: `Corporation Tax Payment - ${period.taxYear}`,
      description: `Pay Corporation Tax for accounting period ending ${period.periodEnd.toISOString().split('T')[0]}`,
      taxType: 'corporation_tax',
      taxPeriod: period.taxYear,
      dueDate: period.corporationTaxPaymentDeadline,
    }));

    // VAT Returns
    period.vatReturnDates.forEach((vatDate, index) => {
      const quarterNum = index + 1;
      deadlines.push(this.createDeadline({
        tenantId: period.tenantId,
        entityId: period.entityId,
        type: 'vat_return_filing',
        title: `VAT Return Q${quarterNum} - ${period.taxYear}`,
        description: `Submit VAT return for quarter ${quarterNum}`,
        taxType: 'vat',
        taxPeriod: `Q${quarterNum} ${period.taxYear}`,
        dueDate: vatDate,
      }));
    });

    // PAYE Monthly
    period.payeMonthlyDates.forEach((payeDate, index) => {
      const monthNum = index + 1;
      deadlines.push(this.createDeadline({
        tenantId: period.tenantId,
        entityId: period.entityId,
        type: 'paye_payment',
        title: `PAYE Payment - Month ${monthNum}`,
        description: `Pay PAYE/NI for month ${monthNum}`,
        taxType: 'paye',
        taxPeriod: `Month ${monthNum} ${period.taxYear}`,
        dueDate: payeDate,
      }));
    });

    // P11D Filing
    deadlines.push(this.createDeadline({
      tenantId: period.tenantId,
      entityId: period.entityId,
      type: 'paye_p11d_filing',
      title: `P11D Filing - ${period.taxYear}`,
      description: 'Submit P11D forms for employee benefits in kind',
      taxType: 'paye',
      taxPeriod: period.taxYear,
      dueDate: period.p11dFilingDeadline,
    }));

    // P11D Class 1A NI Payment
    const class1aPaymentDate = new Date(period.periodEnd.getFullYear() + 1, UKDeadlineRules.P11D_CLASS1A_PAYMENT_MONTH - 1, UKDeadlineRules.P11D_CLASS1A_PAYMENT_DAY);
    deadlines.push(this.createDeadline({
      tenantId: period.tenantId,
      entityId: period.entityId,
      type: 'paye_p11d_class1a_payment',
      title: `P11D Class 1A NI Payment - ${period.taxYear}`,
      description: 'Pay Class 1A National Insurance on benefits in kind',
      taxType: 'paye',
      taxPeriod: period.taxYear,
      dueDate: class1aPaymentDate,
    }));

    // Annual Accounts
    deadlines.push(this.createDeadline({
      tenantId: period.tenantId,
      entityId: period.entityId,
      type: 'annual_accounts_filing',
      title: `Annual Accounts Filing - ${period.taxYear}`,
      description: 'File annual accounts with Companies House',
      taxType: 'accounts',
      taxPeriod: period.taxYear,
      dueDate: period.annualAccountsDeadline,
    }));

    // Mark period as having deadlines generated
    period.deadlinesGenerated = true;
    period.generatedAt = now;
    period.updatedAt = now;

    // Store all deadlines
    deadlines.forEach(d => this.deadlines.set(d.id, d));

    return deadlines;
  }

  /**
   * Create a single deadline
   */
  private createDeadline(input: {
    tenantId: string;
    entityId: string;
    type: TaxDeadlineType;
    title: string;
    description: string;
    taxType: 'corporation_tax' | 'vat' | 'paye' | 'accounts' | 'other';
    taxPeriod: string;
    dueDate: Date;
  }): TaxDeadline {
    const now = new Date();
    const warningDate = new Date(input.dueDate);
    warningDate.setDate(warningDate.getDate() - UKDeadlineRules.WARNING_PERIOD_MEDIUM);

    return {
      id: randomUUID(),
      tenantId: input.tenantId,
      entityId: input.entityId,
      type: input.type,
      title: input.title,
      description: input.description,
      taxType: input.taxType,
      taxPeriod: input.taxPeriod,
      dueDate: input.dueDate,
      originalDueDate: input.dueDate,
      warningDate,
      status: this.calculateStatus(input.dueDate, now),
      priority: this.calculatePriority(input.dueDate, now),
      remindersSent: [],
      isRecurring: false,
      penaltyAmount: '0',
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Calculate deadline status based on dates
   */
  private calculateStatus(dueDate: Date, now: Date): DeadlineStatus {
    const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      return 'overdue';
    } else if (daysUntilDue <= UKDeadlineRules.WARNING_PERIOD_CRITICAL) {
      return 'due_soon';
    } else {
      return 'upcoming';
    }
  }

  /**
   * Calculate deadline priority based on dates
   */
  private calculatePriority(dueDate: Date, now: Date): DeadlinePriority {
    const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      return 'critical';
    } else if (daysUntilDue <= UKDeadlineRules.WARNING_PERIOD_CRITICAL) {
      return 'critical';
    } else if (daysUntilDue <= UKDeadlineRules.WARNING_PERIOD_HIGH) {
      return 'high';
    } else if (daysUntilDue <= UKDeadlineRules.WARNING_PERIOD_MEDIUM) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Generate VAT quarterly dates
   */
  private generateVATDates(periodStart: Date, periodEnd: Date, quarterEndMonth?: number): Date[] {
    const dates: Date[] = [];
    const baseMonth = quarterEndMonth || periodEnd.getMonth() + 1;

    // Generate 4 quarterly deadlines
    for (let i = 0; i < 4; i++) {
      const quarterEnd = new Date(periodStart);
      quarterEnd.setMonth(baseMonth - 1 + (i * 3));

      // Find end of quarter month
      quarterEnd.setMonth(quarterEnd.getMonth() + 1);
      quarterEnd.setDate(0); // Last day of previous month

      // Add 37 days for MTD deadline
      const deadline = new Date(quarterEnd);
      deadline.setDate(deadline.getDate() + UKDeadlineRules.VAT_RETURN_DAYS_AFTER_QUARTER_END);
      dates.push(deadline);
    }

    return dates;
  }

  /**
   * Generate PAYE monthly payment dates
   */
  private generatePAYEDates(periodStart: Date, periodEnd: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(periodStart);

    // Generate 12 monthly deadlines
    for (let i = 0; i < 12; i++) {
      const deadline = new Date(current);
      deadline.setMonth(deadline.getMonth() + 1);
      deadline.setDate(UKDeadlineRules.PAYE_MONTHLY_PAYMENT_DAY);
      dates.push(deadline);
      current.setMonth(current.getMonth() + 1);
    }

    return dates;
  }

  /**
   * Helper to add months to a date
   */
  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  /**
   * Get deadlines for an entity
   */
  getDeadlines(entityId: string, options?: {
    status?: DeadlineStatus;
    taxType?: string;
    fromDate?: Date;
    toDate?: Date;
  }): TaxDeadline[] {
    let deadlines = Array.from(this.deadlines.values())
      .filter(d => d.entityId === entityId);

    if (options?.status) {
      deadlines = deadlines.filter(d => d.status === options.status);
    }

    if (options?.taxType) {
      deadlines = deadlines.filter(d => d.taxType === options.taxType);
    }

    if (options?.fromDate) {
      deadlines = deadlines.filter(d => d.dueDate >= options.fromDate!);
    }

    if (options?.toDate) {
      deadlines = deadlines.filter(d => d.dueDate <= options.toDate!);
    }

    return deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Get calendar view for a month
   */
  getCalendarMonth(entityId: string, year: number, month: number): CalendarMonth {
    const deadlines = this.getDeadlines(entityId, {
      fromDate: new Date(year, month - 1, 1),
      toDate: new Date(year, month, 0),
    });

    return {
      year,
      month,
      deadlines,
    };
  }

  /**
   * Get deadline summary for an entity
   */
  getDeadlineSummary(entityId: string): DeadlineSummary {
    const deadlines = this.getDeadlines(entityId);

    let totalEstimated = 0;
    const summary: DeadlineSummary = {
      upcoming: 0,
      dueSoon: 0,
      overdue: 0,
      completed: 0,
      totalEstimatedAmount: '0.00',
    };

    for (const deadline of deadlines) {
      switch (deadline.status) {
        case 'upcoming':
          summary.upcoming++;
          break;
        case 'due_soon':
          summary.dueSoon++;
          break;
        case 'overdue':
          summary.overdue++;
          break;
        case 'completed':
          summary.completed++;
          break;
      }

      if (deadline.estimatedAmount) {
        totalEstimated += parseFloat(deadline.estimatedAmount);
      }
    }

    summary.totalEstimatedAmount = totalEstimated.toFixed(2);
    return summary;
  }

  /**
   * Mark a deadline as completed
   */
  completeDeadline(deadlineId: string, input: {
    completedBy: string;
    completionNotes?: string;
    hmrcReceiptNumber?: string;
    actualAmount?: string;
  }): TaxDeadline {
    const deadline = this.deadlines.get(deadlineId);
    if (!deadline) {
      throw new Error(`Deadline not found: ${deadlineId}`);
    }

    const now = new Date();
    deadline.status = 'completed';
    deadline.completedDate = now;
    deadline.completedBy = input.completedBy;
    deadline.completionNotes = input.completionNotes;
    deadline.hmrcReceiptNumber = input.hmrcReceiptNumber;
    deadline.actualAmount = input.actualAmount;
    deadline.updatedAt = now;

    return deadline;
  }

  /**
   * Request an extension for a deadline
   */
  requestExtension(deadlineId: string, extensionDate: Date, reason: string): TaxDeadline {
    const deadline = this.deadlines.get(deadlineId);
    if (!deadline) {
      throw new Error(`Deadline not found: ${deadlineId}`);
    }

    const now = new Date();
    deadline.status = 'extended';
    deadline.extensionDate = extensionDate;
    deadline.notes = `Extension requested: ${reason}`;
    deadline.updatedAt = now;

    return deadline;
  }

  /**
   * Update deadline statuses (run periodically)
   */
  refreshDeadlineStatuses(): { updated: number; overdue: TaxDeadline[] } {
    const now = new Date();
    let updated = 0;
    const overdue: TaxDeadline[] = [];

    for (const [id, deadline] of this.deadlines) {
      if (deadline.status === 'completed' || deadline.status === 'extended' || deadline.status === 'not_required') {
        continue;
      }

      const newStatus = this.calculateStatus(deadline.dueDate, now);
      const newPriority = this.calculatePriority(deadline.dueDate, now);

      if (deadline.status !== newStatus || deadline.priority !== newPriority) {
        deadline.status = newStatus;
        deadline.priority = newPriority;
        deadline.updatedAt = now;
        updated++;

        if (newStatus === 'overdue') {
          overdue.push(deadline);
        }
      }
    }

    return { updated, overdue };
  }

  /**
   * Get deadlines needing reminders
   */
  getDeadlinesNeedingReminders(tenantId: string): TaxDeadline[] {
    const now = new Date();
    const config = this.reminderConfigs.get(tenantId);

    if (!config || !config.enabled) {
      return [];
    }

    const needingReminders: TaxDeadline[] = [];

    for (const deadline of this.deadlines.values()) {
      if (deadline.tenantId !== tenantId) continue;
      if (deadline.status === 'completed' || deadline.status === 'not_required') continue;
      if (!config.deadlineTypes.includes(deadline.type)) continue;

      const daysUntilDue = Math.floor((deadline.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check if we should send a reminder
      for (const reminderDay of config.reminderDays) {
        if (daysUntilDue === reminderDay) {
          // Check if we already sent this reminder
          const alreadySent = deadline.remindersSent.some(r =>
            Math.floor((deadline.dueDate.getTime() - r.sentAt.getTime()) / (1000 * 60 * 60 * 24)) === reminderDay
          );

          if (!alreadySent) {
            needingReminders.push(deadline);
            break;
          }
        }
      }
    }

    return needingReminders;
  }

  /**
   * Record that a reminder was sent
   */
  recordReminderSent(deadlineId: string, type: 'email' | 'notification' | 'sms', recipient: string): void {
    const deadline = this.deadlines.get(deadlineId);
    if (!deadline) {
      throw new Error(`Deadline not found: ${deadlineId}`);
    }

    deadline.remindersSent.push({
      sentAt: new Date(),
      type,
      recipient,
    });
    deadline.updatedAt = new Date();
  }

  /**
   * Set reminder configuration for a tenant
   */
  setReminderConfig(config: ReminderConfig): void {
    this.reminderConfigs.set(config.tenantId, config);
  }

  /**
   * Get a specific deadline by ID
   */
  getDeadlineById(deadlineId: string): TaxDeadline | undefined {
    return this.deadlines.get(deadlineId);
  }

  /**
   * Get a specific period by ID
   */
  getPeriodById(periodId: string): TaxCalendarPeriod | undefined {
    return Array.from(this.periods.values()).find(p => p.id === periodId);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createTaxCalendarService(): TaxCalendarService {
  return new TaxCalendarService();
}
