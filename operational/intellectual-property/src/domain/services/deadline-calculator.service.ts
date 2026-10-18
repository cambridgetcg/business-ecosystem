/**
 * Deadline Calculator Domain Service
 *
 * Pure domain logic for calculating IP deadlines.
 * No external dependencies - just business rules.
 *
 * @module domain/services
 */

/**
 * Deadline calculation result.
 */
export interface CalculatedDeadline {
  deadlineType: string;
  title: string;
  description: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  amount?: number | undefined;
  currency?: string | undefined;
  jurisdiction?: string | undefined;
}

/**
 * Patent maintenance fee windows for US patents.
 */
export const US_MAINTENANCE_WINDOWS = {
  FIRST: { years: 3.5, label: '3.5 Year', graceMonths: 6 },
  SECOND: { years: 7.5, label: '7.5 Year', graceMonths: 6 },
  THIRD: { years: 11.5, label: '11.5 Year', graceMonths: 6 },
} as const;

/**
 * US Maintenance fee amounts (2024 rates, large entity).
 */
export const US_MAINTENANCE_FEES = {
  FIRST: { amount: 2000, currency: 'USD' },
  SECOND: { amount: 3760, currency: 'USD' },
  THIRD: { amount: 7700, currency: 'USD' },
} as const;

/**
 * Trademark renewal periods by jurisdiction.
 */
export const TRADEMARK_RENEWAL_PERIODS: Record<string, { years: number; graceMonths: number }> = {
  US: { years: 10, graceMonths: 6 },
  EU: { years: 10, graceMonths: 6 },
  UK: { years: 10, graceMonths: 6 },
  CN: { years: 10, graceMonths: 6 },
  JP: { years: 10, graceMonths: 6 },
  DEFAULT: { years: 10, graceMonths: 6 },
};

/**
 * US Trademark Section 8 & 9 deadlines.
 */
export const US_TRADEMARK_MAINTENANCE = {
  SECTION_8: { yearsAfterRegistration: 5, yearsAfterRenewal: 10, graceMonths: 6 },
  SECTION_9: { years: 10, graceMonths: 6 },
  SECTION_15: { windowStart: 5, windowEnd: 6 }, // Incontestability window
} as const;

/**
 * Deadline Calculator
 *
 * Calculates deadlines based on IP events and business rules.
 */
export class DeadlineCalculator {
  /**
   * Calculate patent maintenance fee deadlines from grant date.
   */
  calculatePatentMaintenanceDeadlines(
    grantDate: Date,
    jurisdiction: string,
    entitySize: 'micro' | 'small' | 'large' = 'large'
  ): CalculatedDeadline[] {
    if (jurisdiction !== 'US') {
      // Non-US patents have different rules - return empty for now
      return [];
    }

    const deadlines: CalculatedDeadline[] = [];
    const feeMultiplier = entitySize === 'micro' ? 0.25 : entitySize === 'small' ? 0.5 : 1;

    // First window (3.5 years)
    const firstDue = this.addYears(grantDate, US_MAINTENANCE_WINDOWS.FIRST.years);
    deadlines.push({
      deadlineType: 'patent_maintenance_fee',
      title: `${US_MAINTENANCE_WINDOWS.FIRST.label} Maintenance Fee Due`,
      description: `US patent maintenance fee for the ${US_MAINTENANCE_WINDOWS.FIRST.label} window. Grace period of ${US_MAINTENANCE_WINDOWS.FIRST.graceMonths} months available with surcharge.`,
      dueDate: firstDue,
      priority: 'high',
      amount: US_MAINTENANCE_FEES.FIRST.amount * feeMultiplier,
      currency: US_MAINTENANCE_FEES.FIRST.currency,
      jurisdiction: 'US',
    });

    // Second window (7.5 years)
    const secondDue = this.addYears(grantDate, US_MAINTENANCE_WINDOWS.SECOND.years);
    deadlines.push({
      deadlineType: 'patent_maintenance_fee',
      title: `${US_MAINTENANCE_WINDOWS.SECOND.label} Maintenance Fee Due`,
      description: `US patent maintenance fee for the ${US_MAINTENANCE_WINDOWS.SECOND.label} window. Grace period of ${US_MAINTENANCE_WINDOWS.SECOND.graceMonths} months available with surcharge.`,
      dueDate: secondDue,
      priority: 'high',
      amount: US_MAINTENANCE_FEES.SECOND.amount * feeMultiplier,
      currency: US_MAINTENANCE_FEES.SECOND.currency,
      jurisdiction: 'US',
    });

    // Third window (11.5 years)
    const thirdDue = this.addYears(grantDate, US_MAINTENANCE_WINDOWS.THIRD.years);
    deadlines.push({
      deadlineType: 'patent_maintenance_fee',
      title: `${US_MAINTENANCE_WINDOWS.THIRD.label} Maintenance Fee Due`,
      description: `US patent maintenance fee for the ${US_MAINTENANCE_WINDOWS.THIRD.label} window. Grace period of ${US_MAINTENANCE_WINDOWS.THIRD.graceMonths} months available with surcharge.`,
      dueDate: thirdDue,
      priority: 'high',
      amount: US_MAINTENANCE_FEES.THIRD.amount * feeMultiplier,
      currency: US_MAINTENANCE_FEES.THIRD.currency,
      jurisdiction: 'US',
    });

    return deadlines;
  }

  /**
   * Calculate trademark maintenance deadlines from registration date.
   */
  calculateTrademarkMaintenanceDeadlines(
    registrationDate: Date,
    jurisdiction: string
  ): CalculatedDeadline[] {
    const deadlines: CalculatedDeadline[] = [];

    if (jurisdiction === 'US') {
      // Section 8 Declaration of Use (between 5th and 6th year)
      const section8Due = this.addYears(registrationDate, US_TRADEMARK_MAINTENANCE.SECTION_8.yearsAfterRegistration);
      deadlines.push({
        deadlineType: 'trademark_section_8',
        title: 'Section 8 Declaration of Use Due',
        description: 'File declaration of continued use between 5th and 6th year anniversary of registration. Failure to file results in cancellation.',
        dueDate: section8Due,
        priority: 'critical',
        jurisdiction: 'US',
      });

      // Section 15 Incontestability (optional, between 5th and 6th year)
      const section15Due = this.addYears(registrationDate, US_TRADEMARK_MAINTENANCE.SECTION_15.windowStart);
      deadlines.push({
        deadlineType: 'trademark_section_15',
        title: 'Section 15 Incontestability Window Opens',
        description: 'Optional filing for incontestable status. Must be filed with Section 8 declaration.',
        dueDate: section15Due,
        priority: 'medium',
        jurisdiction: 'US',
      });

      // Section 9 Renewal (10 years)
      const section9Due = this.addYears(registrationDate, US_TRADEMARK_MAINTENANCE.SECTION_9.years);
      deadlines.push({
        deadlineType: 'trademark_section_9',
        title: 'Section 9 Renewal Due',
        description: 'Trademark renewal required every 10 years. Must be filed with Section 8 declaration.',
        dueDate: section9Due,
        priority: 'critical',
        jurisdiction: 'US',
      });
    } else {
      // Standard renewal for other jurisdictions
      const period = TRADEMARK_RENEWAL_PERIODS[jurisdiction] ?? TRADEMARK_RENEWAL_PERIODS['DEFAULT'];
      const renewalDue = this.addYears(registrationDate, period.years);
      deadlines.push({
        deadlineType: 'trademark_renewal',
        title: 'Trademark Renewal Due',
        description: `Trademark renewal required every ${period.years} years. Grace period of ${period.graceMonths} months available.`,
        dueDate: renewalDue,
        priority: 'high',
        jurisdiction,
      });
    }

    return deadlines;
  }

  /**
   * Calculate domain name expiration deadline.
   */
  calculateDomainExpirationDeadline(
    expirationDate: Date,
    domainName: string,
    registrar: string
  ): CalculatedDeadline {
    return {
      deadlineType: 'domain_expiration',
      title: `Domain Expiration: ${domainName}`,
      description: `Domain ${domainName} expires. Renew before expiration to avoid loss. Registrar: ${registrar}`,
      dueDate: expirationDate,
      priority: 'high',
    };
  }

  /**
   * Calculate license royalty payment deadline.
   */
  calculateLicenseRoyaltyDeadline(
    dueDate: Date,
    licenseeName: string,
    amount: number,
    currency: string
  ): CalculatedDeadline {
    return {
      deadlineType: 'license_royalty',
      title: `Royalty Payment Due: ${licenseeName}`,
      description: `License royalty payment due from ${licenseeName}.`,
      dueDate,
      priority: 'medium',
      amount,
      currency,
    };
  }

  /**
   * Calculate response deadline for trademark opposition.
   */
  calculateOppositionResponseDeadline(
    filingDate: Date,
    jurisdiction: string
  ): CalculatedDeadline {
    // US TTAB gives 40 days to respond
    const daysToRespond = jurisdiction === 'US' ? 40 : 30;
    const responseDate = this.addDays(filingDate, daysToRespond);

    return {
      deadlineType: 'opposition_response',
      title: 'Opposition Response Deadline',
      description: `Response to trademark opposition must be filed within ${daysToRespond} days.`,
      dueDate: responseDate,
      priority: 'critical',
      jurisdiction,
    };
  }

  /**
   * Calculate response deadline for UDRP domain dispute.
   */
  calculateUDRPResponseDeadline(filingDate: Date): CalculatedDeadline {
    // UDRP gives 20 days to respond
    const responseDate = this.addDays(filingDate, 20);

    return {
      deadlineType: 'udrp_response',
      title: 'UDRP Response Deadline',
      description: 'Response to UDRP complaint must be filed within 20 days. Failure to respond typically results in transfer.',
      dueDate: responseDate,
      priority: 'critical',
    };
  }

  /**
   * Calculate reminder dates for a deadline.
   */
  calculateReminderDates(
    dueDate: Date,
    reminderDays: number[] = [90, 60, 30, 14, 7, 3, 1]
  ): Date[] {
    const now = new Date();
    return reminderDays
      .map(days => this.subtractDays(dueDate, days))
      .filter(date => date > now)
      .sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Determine priority based on days until deadline.
   */
  calculatePriorityFromDaysRemaining(daysRemaining: number): 'low' | 'medium' | 'high' | 'critical' {
    if (daysRemaining <= 7) return 'critical';
    if (daysRemaining <= 30) return 'high';
    if (daysRemaining <= 90) return 'medium';
    return 'low';
  }

  /**
   * Check if deadline is overdue.
   */
  isOverdue(dueDate: Date): boolean {
    return dueDate < new Date();
  }

  /**
   * Calculate days until deadline.
   */
  daysUntilDeadline(dueDate: Date): number {
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Add years to a date.
   */
  private addYears(date: Date, years: number): Date {
    const result = new Date(date);
    const wholeYears = Math.floor(years);
    const fractionalMonths = (years - wholeYears) * 12;

    result.setFullYear(result.getFullYear() + wholeYears);
    result.setMonth(result.getMonth() + Math.round(fractionalMonths));
    return result;
  }

  /**
   * Add days to a date.
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Subtract days from a date.
   */
  private subtractDays(date: Date, days: number): Date {
    return this.addDays(date, -days);
  }
}

// Singleton instance
export const deadlineCalculator = new DeadlineCalculator();
