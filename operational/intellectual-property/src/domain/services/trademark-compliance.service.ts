/**
 * Trademark Compliance Service
 *
 * Domain service for US trademark compliance requirements:
 * - Section 8: Declaration of Use (between 5th and 6th year, then every 10 years)
 * - Section 9: Renewal (every 10 years)
 * - Section 15: Incontestability (after 5 years of continuous use)
 * - Madrid Protocol: International registration management
 *
 * @module domain/services
 */

/**
 * Section 8 Declaration of Use filing record.
 */
export interface Section8Filing {
  id: string;
  trademarkId: string;
  filingDate: Date;
  filingWindow: '5-6_year' | '9-10_year' | '19-20_year';
  declarationType: 'use' | 'excusable_nonuse';
  specimensProvided: boolean;
  classesIncluded: number[];
  classesDeleted: number[];
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  dueDate: Date;
  acceptanceDate?: Date;
  rejectionReason?: string;
  notes?: string;
}

/**
 * Section 9 Renewal filing record.
 */
export interface Section9Filing {
  id: string;
  trademarkId: string;
  filingDate: Date;
  renewalPeriod: '1st_renewal' | '2nd_renewal' | '3rd_renewal' | 'subsequent';
  combinedWith8: boolean;
  classesIncluded: number[];
  classesDeleted: number[];
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  dueDate: Date;
  newExpirationDate?: Date;
  acceptanceDate?: Date;
  fee: number;
  notes?: string;
}

/**
 * Section 15 Incontestability filing record.
 */
export interface Section15Filing {
  id: string;
  trademarkId: string;
  filingDate: Date;
  continuousUseSince: Date;
  classesIncluded: number[];
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  acceptanceDate?: Date;
  incontestabilityDate?: Date;
  notes?: string;
}

/**
 * Madrid Protocol international registration.
 */
export interface MadridDesignation {
  id: string;
  trademarkId: string;
  internationalRegistrationNumber: string;
  basicApplicationNumber: string;
  filingDate: Date;
  designatedCountries: MadridCountryDesignation[];
  status: 'pending' | 'registered' | 'refused' | 'cancelled' | 'expired';
  expirationDate: Date;
  centralAttackPeriod: Date; // 5 years from international registration
  notes?: string;
}

/**
 * Country designation under Madrid Protocol.
 */
export interface MadridCountryDesignation {
  countryCode: string;
  designationDate: Date;
  status: 'pending' | 'protected' | 'refused' | 'withdrawn';
  protectionDate?: Date;
  refusalDate?: Date;
  refusalReason?: string;
  responseDeadline?: Date;
  classesProtected: number[];
}

/**
 * Filing deadline with calculated dates.
 */
export interface ComplianceDeadline {
  type: 'section_8' | 'section_9' | 'section_15' | 'madrid_renewal' | 'madrid_response';
  trademarkId: string;
  windowOpens: Date;
  dueDate: Date;
  graceDeadline: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  filingWindow: string;
  estimatedFee: number;
  currency: string;
  notes?: string;
}

/**
 * US Trademark fee schedule (2024 rates).
 */
export const US_TRADEMARK_FEES = {
  SECTION_8: {
    perClass: 225, // TEAS Plus
    perClassPaper: 625,
    gracePeriodSurcharge: 100,
  },
  SECTION_9: {
    perClass: 300, // TEAS Plus
    perClassPaper: 500,
    gracePeriodSurcharge: 100,
  },
  SECTION_8_9_COMBINED: {
    perClass: 525, // 225 + 300
    gracePeriodSurcharge: 200,
  },
  SECTION_15: {
    perClass: 200,
  },
  MADRID: {
    baseDesignation: 653, // CHF - converted to USD approximately
    perClassDesignation: 100,
    renewal: 653,
  },
};

/**
 * Trademark Compliance Service
 *
 * Calculates deadlines and manages compliance filings.
 */
export class TrademarkComplianceService {
  /**
   * Calculate Section 8 deadlines for a US trademark.
   *
   * Section 8 must be filed:
   * - Between 5th and 6th anniversary of registration
   * - Then combined with Section 9 every 10 years
   */
  calculateSection8Deadlines(
    registrationDate: Date,
    currentSection8Filings: Section8Filing[] = []
  ): ComplianceDeadline[] {
    const deadlines: ComplianceDeadline[] = [];

    // First Section 8: Years 5-6
    if (!currentSection8Filings.some(f => f.filingWindow === '5-6_year' && f.status === 'accepted')) {
      const windowOpens = this.addYears(registrationDate, 5);
      const dueDate = this.addYears(registrationDate, 6);
      const graceDeadline = this.addMonths(dueDate, 6);

      deadlines.push({
        type: 'section_8',
        trademarkId: '',
        windowOpens,
        dueDate,
        graceDeadline,
        priority: this.calculatePriority(dueDate),
        filingWindow: '5-6 Year',
        estimatedFee: US_TRADEMARK_FEES.SECTION_8.perClass,
        currency: 'USD',
        notes: 'First Section 8 Declaration of Use. Must file between 5th and 6th year of registration.',
      });
    }

    // Subsequent Section 8 (combined with Section 9) at years 9-10, 19-20, etc.
    const yearsToCheck = [9, 19, 29, 39];
    for (const year of yearsToCheck) {
      const windowKey = `${year}-${year + 1}_year` as Section8Filing['filingWindow'];
      if (!currentSection8Filings.some(f => f.filingWindow === windowKey && f.status === 'accepted')) {
        const windowOpens = this.addYears(registrationDate, year);
        const dueDate = this.addYears(registrationDate, year + 1);
        const graceDeadline = this.addMonths(dueDate, 6);

        if (windowOpens <= new Date()) continue; // Skip past deadlines

        deadlines.push({
          type: 'section_8',
          trademarkId: '',
          windowOpens,
          dueDate,
          graceDeadline,
          priority: this.calculatePriority(dueDate),
          filingWindow: `${year}-${year + 1} Year`,
          estimatedFee: US_TRADEMARK_FEES.SECTION_8_9_COMBINED.perClass,
          currency: 'USD',
          notes: `Section 8 combined with Section 9 renewal at ${year + 1} year mark.`,
        });

        break; // Only show next upcoming deadline
      }
    }

    return deadlines;
  }

  /**
   * Calculate Section 9 renewal deadlines.
   *
   * Section 9 must be filed every 10 years.
   */
  calculateSection9Deadlines(
    registrationDate: Date,
    currentSection9Filings: Section9Filing[] = []
  ): ComplianceDeadline[] {
    const deadlines: ComplianceDeadline[] = [];

    // Section 9 renewals at years 9-10, 19-20, 29-30, etc.
    const periods: Array<{ year: number; period: Section9Filing['renewalPeriod'] }> = [
      { year: 9, period: '1st_renewal' },
      { year: 19, period: '2nd_renewal' },
      { year: 29, period: '3rd_renewal' },
      { year: 39, period: 'subsequent' },
    ];

    for (const { year, period } of periods) {
      if (!currentSection9Filings.some(f => f.renewalPeriod === period && f.status === 'accepted')) {
        const windowOpens = this.addYears(registrationDate, year);
        const dueDate = this.addYears(registrationDate, year + 1);
        const graceDeadline = this.addMonths(dueDate, 6);

        if (windowOpens <= new Date()) continue;

        deadlines.push({
          type: 'section_9',
          trademarkId: '',
          windowOpens,
          dueDate,
          graceDeadline,
          priority: this.calculatePriority(dueDate),
          filingWindow: `${year}-${year + 1} Year Renewal`,
          estimatedFee: US_TRADEMARK_FEES.SECTION_9.perClass,
          currency: 'USD',
          notes: `Section 9 Renewal (${period}). File combined Section 8 & 9 for efficiency.`,
        });

        break;
      }
    }

    return deadlines;
  }

  /**
   * Calculate Section 15 incontestability eligibility.
   *
   * Can be filed after 5 years of continuous use with no challenges.
   */
  calculateSection15Eligibility(
    registrationDate: Date,
    continuousUseSince?: Date,
    existingFiling?: Section15Filing
  ): ComplianceDeadline | null {
    if (existingFiling?.status === 'accepted') {
      return null; // Already incontestable
    }

    const eligibilityDate = this.addYears(registrationDate, 5);
    const now = new Date();

    if (now < eligibilityDate) {
      return {
        type: 'section_15',
        trademarkId: '',
        windowOpens: eligibilityDate,
        dueDate: eligibilityDate, // No hard deadline, but recommended
        graceDeadline: this.addYears(registrationDate, 6), // File with Section 8
        priority: 'low',
        filingWindow: 'After 5 years of registration',
        estimatedFee: US_TRADEMARK_FEES.SECTION_15.perClass,
        currency: 'USD',
        notes: 'Section 15 Incontestability. Recommended to file with Section 8 declaration.',
      };
    }

    // Already eligible, recommend filing
    return {
      type: 'section_15',
      trademarkId: '',
      windowOpens: eligibilityDate,
      dueDate: now, // File ASAP
      graceDeadline: this.addYears(now, 1),
      priority: 'medium',
      filingWindow: 'Eligible now',
      estimatedFee: US_TRADEMARK_FEES.SECTION_15.perClass,
      currency: 'USD',
      notes: 'Trademark is eligible for incontestability. Recommend filing to strengthen protection.',
    };
  }

  /**
   * Calculate Madrid Protocol deadlines.
   */
  calculateMadridDeadlines(designation: MadridDesignation): ComplianceDeadline[] {
    const deadlines: ComplianceDeadline[] = [];

    // Central attack period (5 years from international registration)
    if (designation.centralAttackPeriod > new Date()) {
      deadlines.push({
        type: 'madrid_response',
        trademarkId: designation.trademarkId,
        windowOpens: designation.filingDate,
        dueDate: designation.centralAttackPeriod,
        graceDeadline: designation.centralAttackPeriod,
        priority: this.calculatePriority(designation.centralAttackPeriod),
        filingWindow: 'Central Attack Period',
        estimatedFee: 0,
        currency: 'CHF',
        notes: 'Dependency period: If US basic registration is cancelled, Madrid registration may be affected.',
      });
    }

    // Madrid renewal (every 10 years)
    const renewalDue = designation.expirationDate;
    const renewalWindowOpens = this.addMonths(renewalDue, -6);

    deadlines.push({
      type: 'madrid_renewal',
      trademarkId: designation.trademarkId,
      windowOpens: renewalWindowOpens,
      dueDate: renewalDue,
      graceDeadline: this.addMonths(renewalDue, 6),
      priority: this.calculatePriority(renewalDue),
      filingWindow: 'International Renewal',
      estimatedFee: US_TRADEMARK_FEES.MADRID.renewal * designation.designatedCountries.length,
      currency: 'CHF',
      notes: 'Madrid Protocol renewal. Renews protection in all designated countries.',
    });

    // Country-specific response deadlines
    for (const country of designation.designatedCountries) {
      if (country.status === 'pending' && country.responseDeadline) {
        deadlines.push({
          type: 'madrid_response',
          trademarkId: designation.trademarkId,
          windowOpens: country.designationDate,
          dueDate: country.responseDeadline,
          graceDeadline: country.responseDeadline,
          priority: 'critical',
          filingWindow: `${country.countryCode} Office Action`,
          estimatedFee: 500, // Varies by country
          currency: 'USD',
          notes: `Response required for ${country.countryCode} designation. Local counsel may be required.`,
        });
      }
    }

    return deadlines;
  }

  /**
   * Create a Section 8 filing record.
   */
  createSection8Filing(
    trademarkId: string,
    registrationDate: Date,
    classesIncluded: number[],
    options?: {
      declarationType?: 'use' | 'excusable_nonuse';
      classesDeleted?: number[];
      specimensProvided?: boolean;
    }
  ): Section8Filing {
    const yearsFromRegistration = this.yearsBetween(registrationDate, new Date());
    let filingWindow: Section8Filing['filingWindow'];

    if (yearsFromRegistration >= 5 && yearsFromRegistration < 7) {
      filingWindow = '5-6_year';
    } else if (yearsFromRegistration >= 9 && yearsFromRegistration < 11) {
      filingWindow = '9-10_year';
    } else if (yearsFromRegistration >= 19 && yearsFromRegistration < 21) {
      filingWindow = '19-20_year';
    } else {
      throw new Error(`Invalid filing window: ${yearsFromRegistration} years from registration`);
    }

    return {
      id: crypto.randomUUID(),
      trademarkId,
      filingDate: new Date(),
      filingWindow,
      declarationType: options?.declarationType ?? 'use',
      specimensProvided: options?.specimensProvided ?? true,
      classesIncluded,
      classesDeleted: options?.classesDeleted ?? [],
      status: 'pending',
      dueDate: this.calculateDueDate(registrationDate, filingWindow),
    };
  }

  /**
   * Create a Madrid Protocol designation.
   */
  createMadridDesignation(
    trademarkId: string,
    basicApplicationNumber: string,
    countries: string[],
    classesPerCountry: Map<string, number[]>
  ): MadridDesignation {
    const filingDate = new Date();

    return {
      id: crypto.randomUUID(),
      trademarkId,
      internationalRegistrationNumber: '', // Assigned by WIPO
      basicApplicationNumber,
      filingDate,
      designatedCountries: countries.map(countryCode => ({
        countryCode,
        designationDate: filingDate,
        status: 'pending' as const,
        classesProtected: classesPerCountry.get(countryCode) ?? [],
      })),
      status: 'pending',
      expirationDate: this.addYears(filingDate, 10),
      centralAttackPeriod: this.addYears(filingDate, 5),
    };
  }

  /**
   * Get all compliance deadlines for a trademark.
   */
  getAllDeadlines(
    trademarkId: string,
    registrationDate: Date,
    jurisdiction: string,
    section8Filings: Section8Filing[] = [],
    section9Filings: Section9Filing[] = [],
    section15Filing?: Section15Filing,
    madridDesignation?: MadridDesignation
  ): ComplianceDeadline[] {
    const deadlines: ComplianceDeadline[] = [];

    if (jurisdiction === 'US') {
      deadlines.push(...this.calculateSection8Deadlines(registrationDate, section8Filings));
      deadlines.push(...this.calculateSection9Deadlines(registrationDate, section9Filings));

      const section15 = this.calculateSection15Eligibility(
        registrationDate,
        undefined,
        section15Filing
      );
      if (section15) {
        deadlines.push(section15);
      }
    }

    if (madridDesignation) {
      deadlines.push(...this.calculateMadridDeadlines(madridDesignation));
    }

    // Set trademark ID on all deadlines
    return deadlines.map(d => ({ ...d, trademarkId }));
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  private yearsBetween(start: Date, end: Date): number {
    return (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  }

  private calculateDueDate(registrationDate: Date, filingWindow: Section8Filing['filingWindow']): Date {
    switch (filingWindow) {
      case '5-6_year':
        return this.addYears(registrationDate, 6);
      case '9-10_year':
        return this.addYears(registrationDate, 10);
      case '19-20_year':
        return this.addYears(registrationDate, 20);
      default:
        throw new Error(`Unknown filing window: ${filingWindow}`);
    }
  }

  private calculatePriority(dueDate: Date): ComplianceDeadline['priority'] {
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    if (daysUntilDue <= 30) return 'critical';
    if (daysUntilDue <= 90) return 'high';
    if (daysUntilDue <= 180) return 'medium';
    return 'low';
  }
}

// Singleton instance
export const trademarkComplianceService = new TrademarkComplianceService();
