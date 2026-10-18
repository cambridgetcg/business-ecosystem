/**
 * Companies House Filing Service
 *
 * Handles submission of filings to Companies House including:
 * - Confirmation Statements (CS01)
 * - Director Appointments (AP01) and Terminations (TM01)
 * - PSC Notifications (PSC01-PSC09)
 * - Filing status tracking
 *
 * Note: Companies House requires separate API access for filing submissions.
 * This service handles the filing workflow and status tracking.
 *
 * @see https://developer.company-information.service.gov.uk/
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import {
  CompaniesHouseClient,
  getCompaniesHouseClient,
  CompaniesHouseApiError,
  type CompanyProfile,
  type Officer,
} from './api-client.js';

// =============================================================================
// Filing Types
// =============================================================================

export const FilingTypeSchema = z.enum([
  // Confirmation Statement
  'CS01', // Confirmation statement

  // Director Forms
  'AP01', // Appointment of director
  'AP02', // Appointment of corporate director
  'AP03', // Appointment of corporate secretary
  'AP04', // Appointment of secretary
  'CH01', // Change of director details
  'CH02', // Change of corporate director details
  'CH03', // Change of secretary details
  'CH04', // Change of corporate secretary details
  'TM01', // Termination of director
  'TM02', // Termination of secretary

  // PSC Forms
  'PSC01', // Individual PSC notification
  'PSC02', // RLE (Relevant Legal Entity) notification
  'PSC03', // PSC statement (no PSCs)
  'PSC04', // Change to PSC details
  'PSC05', // PSC ceases to be registrable
  'PSC06', // PSC statement withdrawal
  'PSC07', // Change to RLE details
  'PSC08', // RLE ceases to be registrable
  'PSC09', // Update of PSC statement

  // Address Forms
  'AD01', // Change of registered office address
  'AD02', // Change of SAIL (Single Alternative Inspection Location)
  'AD03', // Change of accounting reference date

  // Annual Accounts
  'AA01', // Full accounts
  'AA02', // Abbreviated accounts

  // Share Capital
  'SH01', // Return of allotment of shares
  'SH02', // Notice of consolidation/sub-division
  'SH03', // Notice of redemption of shares
  'SH06', // Notice of cancellation of shares

  // Charges
  'MR01', // Registration of charge
  'MR02', // Statement of satisfaction
  'MR04', // Particulars of charge
]);

export type FilingType = z.infer<typeof FilingTypeSchema>;

export const FilingStatusSchema = z.enum([
  'draft',
  'pending_submission',
  'submitted',
  'processing',
  'accepted',
  'rejected',
  'requires_action',
  'cancelled',
]);

export type FilingStatus = z.infer<typeof FilingStatusSchema>;

// =============================================================================
// Filing Data Schemas
// =============================================================================

export const AddressSchema = z.object({
  premises: z.string().max(200).optional(),
  addressLine1: z.string().max(50),
  addressLine2: z.string().max(50).optional(),
  locality: z.string().max(50).optional(),
  region: z.string().max(50).optional(),
  postalCode: z.string().max(15).optional(),
  country: z.string().max(50).optional(),
});

export type Address = z.infer<typeof AddressSchema>;

export const DirectorAppointmentDataSchema = z.object({
  filingType: z.literal('AP01'),
  director: z.object({
    title: z.string().max(50).optional(),
    forename: z.string().max(50),
    otherForenames: z.string().max(50).optional(),
    surname: z.string().max(160),
    dateOfBirth: z.date(),
    nationality: z.string().max(50),
    occupation: z.string().max(100).optional(),
    countryOfResidence: z.string().max(50),
    serviceAddress: AddressSchema,
    residentialAddress: AddressSchema.optional(),
    appointmentDate: z.date(),
    consentToAct: z.boolean(),
  }),
});

export type DirectorAppointmentData = z.infer<typeof DirectorAppointmentDataSchema>;

export const DirectorTerminationDataSchema = z.object({
  filingType: z.literal('TM01'),
  director: z.object({
    forename: z.string().max(50),
    surname: z.string().max(160),
    dateOfBirth: z.date(),
    terminationDate: z.date(),
  }),
});

export type DirectorTerminationData = z.infer<typeof DirectorTerminationDataSchema>;

export const DirectorChangeDataSchema = z.object({
  filingType: z.literal('CH01'),
  director: z.object({
    forename: z.string().max(50),
    surname: z.string().max(160),
    dateOfBirth: z.date(),
    changes: z.object({
      serviceAddress: AddressSchema.optional(),
      residentialAddress: AddressSchema.optional(),
      occupation: z.string().max(100).optional(),
      nationality: z.string().max(50).optional(),
      countryOfResidence: z.string().max(50).optional(),
    }),
    changeDate: z.date(),
  }),
});

export type DirectorChangeData = z.infer<typeof DirectorChangeDataSchema>;

export const ConfirmationStatementDataSchema = z.object({
  filingType: z.literal('CS01'),
  confirmationStatementDate: z.date(),
  reviewPeriodStartDate: z.date().optional(),
  sicCodes: z.array(z.string().length(5)).optional(),
  statementOfCapital: z.object({
    currency: z.string().default('GBP'),
    totalNumberOfShares: z.number().int(),
    totalAggregateNominalValue: z.number(),
    shareClasses: z.array(z.object({
      className: z.string(),
      numberOfShares: z.number().int(),
      aggregateNominalValue: z.number(),
      prescribedParticulars: z.string().optional(),
    })).optional(),
  }).optional(),
  shareholderChanges: z.boolean().default(false),
  officerChanges: z.boolean().default(false),
  pscChanges: z.boolean().default(false),
  registeredOfficeChanges: z.boolean().default(false),
  tradingStatusStatement: z.boolean().default(false), // True if company has not traded
});

export type ConfirmationStatementData = z.infer<typeof ConfirmationStatementDataSchema>;

export const PSCNotificationDataSchema = z.object({
  filingType: z.enum(['PSC01', 'PSC02', 'PSC04', 'PSC05']),
  psc: z.object({
    // For individual PSC (PSC01)
    title: z.string().max(50).optional(),
    forename: z.string().max(50).optional(),
    otherForenames: z.string().max(50).optional(),
    surname: z.string().max(160).optional(),

    // For corporate PSC (PSC02)
    corporateName: z.string().max(160).optional(),
    registrationNumber: z.string().max(50).optional(),
    placeOfRegistration: z.string().max(160).optional(),
    legalForm: z.string().max(160).optional(),
    lawGoverned: z.string().max(160).optional(),

    // Common fields
    dateOfBirth: z.date().optional(), // Individual only
    nationality: z.string().max(50).optional(), // Individual only
    countryOfResidence: z.string().max(50).optional(), // Individual only
    serviceAddress: AddressSchema.optional(),

    // Nature of control
    naturesOfControl: z.array(z.string()),
    notificationDate: z.date(),
    ceasedDate: z.date().optional(), // For PSC05
  }),
});

export type PSCNotificationData = z.infer<typeof PSCNotificationDataSchema>;

export const RegisteredOfficeChangeDataSchema = z.object({
  filingType: z.literal('AD01'),
  newAddress: AddressSchema,
  changeDate: z.date(),
});

export type RegisteredOfficeChangeData = z.infer<typeof RegisteredOfficeChangeDataSchema>;

export const FilingDataSchema = z.discriminatedUnion('filingType', [
  DirectorAppointmentDataSchema,
  DirectorTerminationDataSchema,
  DirectorChangeDataSchema,
  ConfirmationStatementDataSchema,
  PSCNotificationDataSchema,
  RegisteredOfficeChangeDataSchema,
]);

export type FilingData = z.infer<typeof FilingDataSchema>;

// =============================================================================
// Filing Record
// =============================================================================

export interface FilingRecord {
  id: string;
  companyNumber: string;
  filingType: FilingType;
  status: FilingStatus;
  data: FilingData;
  submissionReference?: string;
  confirmationNumber?: string;
  submittedAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  rejectionReasons?: string[];
  fee?: number;
  feePaidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  notes?: string;
}

// =============================================================================
// Filing Service
// =============================================================================

export interface FilingServiceConfig {
  client?: CompaniesHouseClient;
}

export interface FilingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FilingSubmissionResult {
  success: boolean;
  filingId: string;
  submissionReference?: string;
  status: FilingStatus;
  errors?: string[];
  fee?: number;
}

export class CompaniesHouseFilingService {
  private readonly client: CompaniesHouseClient;
  private readonly filings: Map<string, FilingRecord> = new Map();

  constructor(config: FilingServiceConfig = {}) {
    this.client = config.client ?? getCompaniesHouseClient();
  }

  // ===========================================================================
  // Filing Creation
  // ===========================================================================

  /**
   * Create a new filing draft
   */
  async createFiling(
    companyNumber: string,
    data: FilingData,
    options: { createdBy?: string; notes?: string } = {}
  ): Promise<FilingRecord> {
    // Validate company exists
    const company = await this.client.getCompanyProfile(companyNumber);
    if (!company) {
      throw new Error(`Company ${companyNumber} not found`);
    }

    const filing: FilingRecord = {
      id: randomUUID(),
      companyNumber,
      filingType: data.filingType as FilingType,
      status: 'draft',
      data,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: options.createdBy,
      notes: options.notes,
      fee: this.calculateFee(data.filingType as FilingType),
    };

    this.filings.set(filing.id, filing);
    return filing;
  }

  /**
   * Create a Confirmation Statement filing
   */
  async createConfirmationStatement(
    companyNumber: string,
    data: Omit<ConfirmationStatementData, 'filingType'>,
    options: { createdBy?: string } = {}
  ): Promise<FilingRecord> {
    return this.createFiling(
      companyNumber,
      { ...data, filingType: 'CS01' as const },
      options
    );
  }

  /**
   * Create a Director Appointment filing (AP01)
   */
  async createDirectorAppointment(
    companyNumber: string,
    data: Omit<DirectorAppointmentData, 'filingType'>,
    options: { createdBy?: string } = {}
  ): Promise<FilingRecord> {
    return this.createFiling(
      companyNumber,
      { ...data, filingType: 'AP01' as const },
      options
    );
  }

  /**
   * Create a Director Termination filing (TM01)
   */
  async createDirectorTermination(
    companyNumber: string,
    data: Omit<DirectorTerminationData, 'filingType'>,
    options: { createdBy?: string } = {}
  ): Promise<FilingRecord> {
    return this.createFiling(
      companyNumber,
      { ...data, filingType: 'TM01' as const },
      options
    );
  }

  /**
   * Create a Director Change filing (CH01)
   */
  async createDirectorChange(
    companyNumber: string,
    data: Omit<DirectorChangeData, 'filingType'>,
    options: { createdBy?: string } = {}
  ): Promise<FilingRecord> {
    return this.createFiling(
      companyNumber,
      { ...data, filingType: 'CH01' as const },
      options
    );
  }

  /**
   * Create a PSC Notification filing
   */
  async createPSCNotification(
    companyNumber: string,
    data: Omit<PSCNotificationData, 'filingType'> & { filingType: 'PSC01' | 'PSC02' | 'PSC04' | 'PSC05' },
    options: { createdBy?: string } = {}
  ): Promise<FilingRecord> {
    return this.createFiling(companyNumber, data, options);
  }

  /**
   * Create a Registered Office Change filing (AD01)
   */
  async createRegisteredOfficeChange(
    companyNumber: string,
    data: Omit<RegisteredOfficeChangeData, 'filingType'>,
    options: { createdBy?: string } = {}
  ): Promise<FilingRecord> {
    return this.createFiling(
      companyNumber,
      { ...data, filingType: 'AD01' as const },
      options
    );
  }

  // ===========================================================================
  // Filing Validation
  // ===========================================================================

  /**
   * Validate a filing before submission
   */
  async validateFiling(filingId: string): Promise<FilingValidationResult> {
    const filing = this.filings.get(filingId);
    if (!filing) {
      return { valid: false, errors: ['Filing not found'], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate company exists and is active
    try {
      const company = await this.client.getCompanyProfile(filing.companyNumber);
      if (company.company_status !== 'active') {
        warnings.push(`Company status is ${company.company_status}`);
      }
    } catch (error) {
      if (error instanceof CompaniesHouseApiError && error.statusCode === 404) {
        errors.push('Company not found');
      } else {
        errors.push('Failed to verify company');
      }
    }

    // Type-specific validation
    switch (filing.filingType) {
      case 'AP01':
        this.validateDirectorAppointment(filing.data as DirectorAppointmentData, errors, warnings);
        break;
      case 'TM01':
        await this.validateDirectorTermination(filing, errors, warnings);
        break;
      case 'CS01':
        await this.validateConfirmationStatement(filing, errors, warnings);
        break;
      case 'PSC01':
      case 'PSC02':
      case 'PSC04':
      case 'PSC05':
        this.validatePSCNotification(filing.data as PSCNotificationData, errors, warnings);
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateDirectorAppointment(
    data: DirectorAppointmentData,
    errors: string[],
    warnings: string[]
  ): void {
    const { director } = data;

    // Check age (must be 16 or over)
    const age = this.calculateAge(director.dateOfBirth);
    if (age < 16) {
      errors.push('Director must be at least 16 years old');
    }

    // Check appointment date is not in the future
    if (director.appointmentDate > new Date()) {
      errors.push('Appointment date cannot be in the future');
    }

    // Check consent
    if (!director.consentToAct) {
      errors.push('Director must consent to act');
    }

    // Warn if appointment date is more than 14 days ago
    const daysSinceAppointment = Math.floor(
      (Date.now() - director.appointmentDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceAppointment > 14) {
      warnings.push('Appointment was more than 14 days ago - filing may be late');
    }
  }

  private async validateDirectorTermination(
    filing: FilingRecord,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    const data = filing.data as DirectorTerminationData;

    // Verify director exists
    try {
      const officers = await this.client.getOfficers(filing.companyNumber);
      const matchingDirector = officers.items.find(
        (o) =>
          o.name.toLowerCase().includes(data.director.surname.toLowerCase()) &&
          !o.resigned_on
      );

      if (!matchingDirector) {
        errors.push('No matching active director found');
      }
    } catch {
      warnings.push('Could not verify director exists');
    }

    // Check termination date
    if (data.director.terminationDate > new Date()) {
      errors.push('Termination date cannot be in the future');
    }
  }

  private async validateConfirmationStatement(
    filing: FilingRecord,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    const data = filing.data as ConfirmationStatementData;

    // Check confirmation date is within review period
    const company = await this.client.getCompanyProfile(filing.companyNumber);
    if (company.confirmation_statement?.next_due) {
      const nextDue = new Date(company.confirmation_statement.next_due);
      if (data.confirmationStatementDate > nextDue) {
        warnings.push('Confirmation statement date is after the due date');
      }
    }

    // Check SIC codes if provided
    if (data.sicCodes && data.sicCodes.length === 0) {
      warnings.push('No SIC codes provided');
    }
  }

  private validatePSCNotification(
    data: PSCNotificationData,
    errors: string[],
    warnings: string[]
  ): void {
    const { psc } = data;

    // Must have at least one nature of control
    if (!psc.naturesOfControl || psc.naturesOfControl.length === 0) {
      errors.push('At least one nature of control must be specified');
    }

    // Individual PSC requires certain fields
    if (data.filingType === 'PSC01') {
      if (!psc.forename || !psc.surname) {
        errors.push('Individual PSC requires forename and surname');
      }
      if (!psc.dateOfBirth) {
        errors.push('Individual PSC requires date of birth');
      }
      if (!psc.nationality) {
        errors.push('Individual PSC requires nationality');
      }
    }

    // Corporate PSC requires certain fields
    if (data.filingType === 'PSC02') {
      if (!psc.corporateName) {
        errors.push('Corporate PSC requires corporate name');
      }
    }

    // Notification date validation
    if (psc.notificationDate > new Date()) {
      errors.push('Notification date cannot be in the future');
    }
  }

  // ===========================================================================
  // Filing Submission
  // ===========================================================================

  /**
   * Submit a filing to Companies House
   *
   * Note: In production, this would integrate with Companies House filing API.
   * This implementation tracks the submission and generates a reference number.
   */
  async submitFiling(filingId: string): Promise<FilingSubmissionResult> {
    const filing = this.filings.get(filingId);
    if (!filing) {
      return {
        success: false,
        filingId,
        status: 'rejected',
        errors: ['Filing not found'],
      };
    }

    // Validate before submission
    const validation = await this.validateFiling(filingId);
    if (!validation.valid) {
      return {
        success: false,
        filingId,
        status: 'rejected',
        errors: validation.errors,
      };
    }

    // Generate submission reference
    const submissionReference = this.generateSubmissionReference(filing);

    // Update filing status
    filing.status = 'submitted';
    filing.submissionReference = submissionReference;
    filing.submittedAt = new Date();
    filing.updatedAt = new Date();

    this.filings.set(filingId, filing);

    return {
      success: true,
      filingId,
      submissionReference,
      status: 'submitted',
      fee: filing.fee,
    };
  }

  /**
   * Check filing status with Companies House
   *
   * Note: In production, this would poll Companies House for actual status.
   */
  async checkFilingStatus(filingId: string): Promise<FilingRecord | null> {
    const filing = this.filings.get(filingId);
    if (!filing) {
      return null;
    }

    // In production, would check status with Companies House API
    // For now, return current local status

    return filing;
  }

  /**
   * Update filing status (e.g., when receiving webhook from Companies House)
   */
  async updateFilingStatus(
    filingId: string,
    status: FilingStatus,
    details?: {
      confirmationNumber?: string;
      rejectionReasons?: string[];
    }
  ): Promise<FilingRecord | null> {
    const filing = this.filings.get(filingId);
    if (!filing) {
      return null;
    }

    filing.status = status;
    filing.updatedAt = new Date();

    if (status === 'accepted') {
      filing.acceptedAt = new Date();
      filing.confirmationNumber = details?.confirmationNumber;
    } else if (status === 'rejected') {
      filing.rejectedAt = new Date();
      filing.rejectionReasons = details?.rejectionReasons;
    }

    this.filings.set(filingId, filing);
    return filing;
  }

  // ===========================================================================
  // Filing Retrieval
  // ===========================================================================

  /**
   * Get filing by ID
   */
  getFiling(filingId: string): FilingRecord | undefined {
    return this.filings.get(filingId);
  }

  /**
   * Get filings for a company
   */
  getFilingsForCompany(
    companyNumber: string,
    options: {
      status?: FilingStatus;
      filingType?: FilingType;
    } = {}
  ): FilingRecord[] {
    return Array.from(this.filings.values()).filter((filing) => {
      if (filing.companyNumber !== companyNumber) return false;
      if (options.status && filing.status !== options.status) return false;
      if (options.filingType && filing.filingType !== options.filingType) return false;
      return true;
    });
  }

  /**
   * Get pending filings
   */
  getPendingFilings(companyNumber?: string): FilingRecord[] {
    return Array.from(this.filings.values()).filter((filing) => {
      if (companyNumber && filing.companyNumber !== companyNumber) return false;
      return ['draft', 'pending_submission', 'submitted', 'processing'].includes(filing.status);
    });
  }

  // ===========================================================================
  // Confirmation Statement Helpers
  // ===========================================================================

  /**
   * Get confirmation statement due dates for a company
   */
  async getConfirmationStatementDates(companyNumber: string): Promise<{
    lastMadeUpTo?: Date;
    nextDue?: Date;
    nextMadeUpTo?: Date;
    overdue: boolean;
  }> {
    const company = await this.client.getCompanyProfile(companyNumber);
    const cs = company.confirmation_statement;

    return {
      lastMadeUpTo: cs?.last_made_up_to ? new Date(cs.last_made_up_to) : undefined,
      nextDue: cs?.next_due ? new Date(cs.next_due) : undefined,
      nextMadeUpTo: cs?.next_made_up_to ? new Date(cs.next_made_up_to) : undefined,
      overdue: cs?.overdue ?? false,
    };
  }

  /**
   * Prepare confirmation statement data from current company profile
   */
  async prepareConfirmationStatement(
    companyNumber: string
  ): Promise<Omit<ConfirmationStatementData, 'filingType'>> {
    const company = await this.client.getCompanyProfile(companyNumber);
    const dates = await this.getConfirmationStatementDates(companyNumber);

    return {
      confirmationStatementDate: dates.nextMadeUpTo ?? new Date(),
      reviewPeriodStartDate: dates.lastMadeUpTo,
      sicCodes: company.sic_codes,
      shareholderChanges: false,
      officerChanges: false,
      pscChanges: false,
      registeredOfficeChanges: false,
      tradingStatusStatement: false,
    };
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Calculate filing fee
   */
  private calculateFee(filingType: FilingType): number {
    // Standard Companies House fees (as of 2024)
    const fees: Partial<Record<FilingType, number>> = {
      CS01: 13, // Confirmation statement
      AP01: 0, // Director appointment - free
      TM01: 0, // Director termination - free
      CH01: 0, // Director change - free
      PSC01: 0, // PSC notification - free
      PSC02: 0, // RLE notification - free
      AD01: 0, // Registered office change - free
      SH01: 0, // Return of allotment - free
      AA01: 0, // Accounts - free (if on time)
    };

    return fees[filingType] ?? 0;
  }

  /**
   * Generate submission reference
   */
  private generateSubmissionReference(filing: FilingRecord): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `EG-${filing.companyNumber}-${date}-${random}`;
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
      age--;
    }
    return age;
  }
}

// =============================================================================
// Factory
// =============================================================================

let serviceInstance: CompaniesHouseFilingService | null = null;

/**
 * Get singleton instance of filing service
 */
export function getFilingService(config?: FilingServiceConfig): CompaniesHouseFilingService {
  if (!serviceInstance || config) {
    serviceInstance = new CompaniesHouseFilingService(config);
  }
  return serviceInstance;
}

/**
 * Create a new filing service instance
 */
export function createFilingService(config?: FilingServiceConfig): CompaniesHouseFilingService {
  return new CompaniesHouseFilingService(config);
}
