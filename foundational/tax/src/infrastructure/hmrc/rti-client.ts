/**
 * HMRC RTI (Real Time Information) API Client
 *
 * Client for submitting PAYE information to HMRC via the RTI system.
 * Supports FPS (Full Payment Submission) and EPS (Employer Payment Summary).
 *
 * Reference: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/paye-des-stub
 * RTI Technical Pack: https://www.gov.uk/government/collections/real-time-information-online-internet-submissions
 */

import { z } from 'zod';
import {
  HMRCOAuthClient,
  type HMRCTokenSet,
  type HMRCTokenStore,
  HMRCAuthError,
} from './oauth-client.js';
import type { FraudPreventionHeaders } from './api-client.js';

// =============================================================================
// Configuration
// =============================================================================

export interface HMRCRTIClientConfig {
  oauthClient: HMRCOAuthClient;
  tokenStore: HMRCTokenStore;
  environment: 'sandbox' | 'production';
  fraudPreventionHeaders?: FraudPreventionHeaders;
}

// =============================================================================
// RTI Scopes
// =============================================================================

export const RTI_SCOPES = {
  READ: 'read:paye-for-employers',
  WRITE: 'write:paye-for-employers',
} as const;

// =============================================================================
// RTI Error Types
// =============================================================================

/**
 * RTI-specific error codes returned by HMRC
 */
export const RTIErrorCodes = {
  // Validation errors
  INVALID_PAYE_REF: '1001',
  INVALID_ACCOUNTS_OFFICE_REF: '1002',
  INVALID_TAX_YEAR: '1003',
  INVALID_NINO: '1004',
  INVALID_PERIOD: '1005',
  DUPLICATE_SUBMISSION: '1006',

  // Business logic errors
  SCHEME_NOT_ACTIVE: '2001',
  PERIOD_NOT_OPEN: '2002',
  LATE_SUBMISSION: '2003',
  EMPLOYEE_NOT_FOUND: '2004',

  // System errors
  HMRC_SERVICE_UNAVAILABLE: '5001',
  GATEWAY_TIMEOUT: '5002',
  RATE_LIMIT_EXCEEDED: '5003',
} as const;

export class HMRCRTIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly correlationId?: string,
    public readonly errors?: Array<{
      code: string;
      message: string;
      path?: string;
    }>
  ) {
    super(message);
    this.name = 'HMRCRTIError';
  }
}

// =============================================================================
// FPS Types (Full Payment Submission)
// =============================================================================

/**
 * Employee payment data for FPS submission
 */
export const FPSEmployeePaymentSchema = z.object({
  // Employee identifiers
  nationalInsuranceNumber: z.string().nullable(),
  employeePayrollId: z.string().max(35),
  title: z.string().optional(),
  forename: z.string(),
  middleName: z.string().optional(),
  surname: z.string(),
  dateOfBirth: z.date(),
  gender: z.enum(['M', 'F']),
  address: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    line3: z.string().optional(),
    line4: z.string().optional(),
    postcode: z.string(),
    country: z.string().default('UK'),
  }).optional(),

  // Employment details
  startDate: z.date(),
  leavingDate: z.date().nullable(),
  payFrequency: z.enum(['W1', 'W2', 'W4', 'M1', 'M3', 'MA', 'IO', 'IR']),
  // W1=Weekly, W2=Fortnightly, W4=Four-weekly, M1=Monthly, M3=Quarterly, MA=Annual, IO=One-off, IR=Irregular

  taxCode: z.string(),
  taxBasis: z.enum(['cumulative', 'week1_month1']).default('cumulative'),
  niCategory: z.string().length(1),

  // Period values
  taxablePayInPeriod: z.string(),
  taxDeductedInPeriod: z.string(),
  studentLoanDeductedInPeriod: z.string().default('0'),
  postgraduateLoanDeductedInPeriod: z.string().default('0'),

  // NI values in period
  niablePayInPeriod: z.string(),
  employeeNIInPeriod: z.string(),
  employerNIInPeriod: z.string(),

  // Year-to-date values
  taxablePayYTD: z.string(),
  taxDeductedYTD: z.string(),
  studentLoanYTD: z.string().default('0'),
  postgraduateLoanYTD: z.string().default('0'),
  employeeNIYTD: z.string(),
  employerNIYTD: z.string(),

  // Statutory payments in period
  smpInPeriod: z.string().nullable(),
  sppInPeriod: z.string().nullable(),
  sapInPeriod: z.string().nullable(),
  shppInPeriod: z.string().nullable(),
  sspInPeriod: z.string().nullable(),

  // Flags
  isDirector: z.boolean().default(false),
  directorNIMethod: z.enum(['annual', 'alternative']).nullable(),
  isOffPayrollWorker: z.boolean().default(false),
  irregularPayment: z.boolean().default(false),
  paymentAfterLeaving: z.boolean().default(false),

  // Starter/Leaver info
  starterDeclaration: z.enum(['A', 'B', 'C']).nullable(),
  hasP45: z.boolean().default(false),
  p45TaxCodeAtLeaving: z.string().nullable(),
  p45TotalPayToDate: z.string().nullable(),
  p45TotalTaxToDate: z.string().nullable(),
});

export type FPSEmployeePayment = z.infer<typeof FPSEmployeePaymentSchema>;

/**
 * FPS submission request
 */
export const FPSSubmissionRequestSchema = z.object({
  // Employer identifiers
  payeReference: z.string(), // Format: 123/ABC123
  accountsOfficeReference: z.string(), // Format: 123PA12345678

  // Period
  taxYear: z.string(), // Format: 24-25
  relatedTaxYear: z.string().optional(), // For late reporting
  periodNumber: z.number().int().min(1).max(12),
  paymentDate: z.date(),

  // Submission metadata
  isLateReporting: z.boolean().default(false),
  lateReportingReason: z.string().optional(),
  isTestSubmission: z.boolean().default(false),

  // Employee payments
  employees: z.array(FPSEmployeePaymentSchema).min(1),

  // Flags
  noPaymentForPeriod: z.boolean().default(false),
  periodOfInactivity: z.object({
    from: z.date(),
    to: z.date(),
  }).nullable(),
  finalSubmissionForYear: z.boolean().default(false),
});

export type FPSSubmissionRequest = z.infer<typeof FPSSubmissionRequestSchema>;

/**
 * FPS submission response from HMRC
 */
export interface FPSSubmissionResponse {
  success: boolean;
  correlationId: string;
  receiptTimestamp: string;
  receiptId?: string;
  processingDate?: string;
  warnings?: Array<{
    code: string;
    message: string;
    employeePayrollId?: string;
  }>;
}

// =============================================================================
// EPS Types (Employer Payment Summary)
// =============================================================================

/**
 * EPS submission request
 */
export const EPSSubmissionRequestSchema = z.object({
  // Employer identifiers
  payeReference: z.string(),
  accountsOfficeReference: z.string(),

  // Period
  taxYear: z.string(), // Format: 24-25
  taxMonth: z.number().int().min(1).max(12), // 1-12

  // Recovery amounts
  smpRecovered: z.string().nullable(),
  sppRecovered: z.string().nullable(),
  sapRecovered: z.string().nullable(),
  shppRecovered: z.string().nullable(),
  nicCompensation: z.string().nullable(),

  // CIS
  cisDeductionsSuffered: z.string().nullable(),

  // Flags
  noPaymentForPeriod: z.boolean().default(false),
  periodOfInactivity: z.object({
    from: z.date(),
    to: z.date(),
  }).nullable(),

  // Employment Allowance (annual claim)
  employmentAllowanceClaim: z.boolean().default(false),
  employmentAllowanceIndicator: z.boolean().default(false),

  // Apprenticeship Levy
  apprenticeshipLevyDue: z.string().nullable(),

  // Final submission
  finalSubmissionForYear: z.boolean().default(false),
  dateSchemesClosed: z.date().nullable(),
  schemeCeasedDate: z.date().nullable(),

  // De minimis state aid declaration (for Employment Allowance)
  deMinimisStateAidEligible: z.boolean().default(true),

  // Test submission
  isTestSubmission: z.boolean().default(false),
});

export type EPSSubmissionRequest = z.infer<typeof EPSSubmissionRequestSchema>;

/**
 * EPS submission response from HMRC
 */
export interface EPSSubmissionResponse {
  success: boolean;
  correlationId: string;
  receiptTimestamp: string;
  receiptId?: string;
  processingDate?: string;
  warnings?: Array<{
    code: string;
    message: string;
  }>;
}

// =============================================================================
// RTI API Response Wrapper
// =============================================================================

export interface RTIApiResponse<T> {
  data: T;
  headers: {
    correlationId?: string;
    receiptId?: string;
    receiptTimestamp?: string;
  };
}

// =============================================================================
// XML Builders (Internal)
// =============================================================================

/**
 * Build RTI XML namespace declarations
 */
function buildXMLNamespaces(): string {
  return `xmlns:rti="http://www.govtalk.gov.uk/taxation/PAYE/RTI/FullPaymentSubmission/17-18/1"
xmlns:dsig="http://www.w3.org/2000/09/xmldsig#"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`;
}

/**
 * Format date for RTI XML (YYYY-MM-DD)
 */
function formatRTIDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format money for RTI XML (2 decimal places, no currency symbol)
 */
function formatRTIMoney(amount: string): string {
  const num = parseFloat(amount);
  return num.toFixed(2);
}

/**
 * Build employee XML for FPS
 */
function buildEmployeeXML(employee: FPSEmployeePayment): string {
  const lines: string[] = [];

  lines.push('    <Employee>');

  // Employee ID
  lines.push('      <EmployeeID>');
  if (employee.nationalInsuranceNumber) {
    lines.push(`        <NINO>${employee.nationalInsuranceNumber}</NINO>`);
  }
  lines.push(`        <WorksPayrollID>${escapeXML(employee.employeePayrollId)}</WorksPayrollID>`);
  lines.push('      </EmployeeID>');

  // Name
  lines.push('      <Name>');
  if (employee.title) {
    lines.push(`        <Ttl>${escapeXML(employee.title)}</Ttl>`);
  }
  lines.push(`        <Fore>${escapeXML(employee.forename)}</Fore>`);
  if (employee.middleName) {
    lines.push(`        <Initials>${escapeXML(employee.middleName.charAt(0))}</Initials>`);
  }
  lines.push(`        <Sur>${escapeXML(employee.surname)}</Sur>`);
  lines.push('      </Name>');

  // Birth date and gender
  lines.push(`      <BirthDate>${formatRTIDate(employee.dateOfBirth)}</BirthDate>`);
  lines.push(`      <Gender>${employee.gender}</Gender>`);

  // Address (if provided)
  if (employee.address) {
    lines.push('      <Address>');
    lines.push(`        <Line>${escapeXML(employee.address.line1)}</Line>`);
    if (employee.address.line2) {
      lines.push(`        <Line>${escapeXML(employee.address.line2)}</Line>`);
    }
    if (employee.address.line3) {
      lines.push(`        <Line>${escapeXML(employee.address.line3)}</Line>`);
    }
    if (employee.address.postcode) {
      lines.push(`        <Postcode>${employee.address.postcode}</Postcode>`);
    }
    lines.push('      </Address>');
  }

  // Employment
  lines.push('      <Employment>');
  lines.push(`        <PayFreq>${employee.payFrequency}</PayFreq>`);
  lines.push(`        <StartDate>${formatRTIDate(employee.startDate)}</StartDate>`);
  if (employee.leavingDate) {
    lines.push(`        <LeavingDate>${formatRTIDate(employee.leavingDate)}</LeavingDate>`);
  }

  // Director info
  if (employee.isDirector) {
    lines.push('        <DirectorsNIC>');
    lines.push(`          <NIMethod>${employee.directorNIMethod === 'annual' ? 'AN' : 'AL'}</NIMethod>`);
    lines.push('        </DirectorsNIC>');
  }

  // Off-payroll worker
  if (employee.isOffPayrollWorker) {
    lines.push('        <OffPayrollWorker>yes</OffPayrollWorker>');
  }

  // Starter declaration
  if (employee.starterDeclaration) {
    lines.push('        <Starter>');
    lines.push(`          <StartDec>${employee.starterDeclaration}</StartDec>`);
    if (employee.hasP45 && employee.p45TotalPayToDate && employee.p45TotalTaxToDate) {
      lines.push('          <PreviousEmploymentDetails>');
      lines.push(`            <TotalPayToDate>${formatRTIMoney(employee.p45TotalPayToDate)}</TotalPayToDate>`);
      lines.push(`            <TotalTaxToDate>${formatRTIMoney(employee.p45TotalTaxToDate)}</TotalTaxToDate>`);
      lines.push('          </PreviousEmploymentDetails>');
    }
    lines.push('        </Starter>');
  }

  // Pay and tax
  lines.push('        <Payment>');
  lines.push(`          <TaxablePay>${formatRTIMoney(employee.taxablePayInPeriod)}</TaxablePay>`);
  lines.push(`          <TaxDeducted>${formatRTIMoney(employee.taxDeductedInPeriod)}</TaxDeducted>`);

  // Student loans
  const studentLoan = parseFloat(employee.studentLoanDeductedInPeriod);
  if (studentLoan > 0) {
    lines.push(`          <StudentLoanDeductions>${formatRTIMoney(employee.studentLoanDeductedInPeriod)}</StudentLoanDeductions>`);
  }
  const pgLoan = parseFloat(employee.postgraduateLoanDeductedInPeriod);
  if (pgLoan > 0) {
    lines.push(`          <PostgradLoanDeductions>${formatRTIMoney(employee.postgraduateLoanDeductedInPeriod)}</PostgradLoanDeductions>`);
  }

  // Statutory payments
  if (employee.smpInPeriod && parseFloat(employee.smpInPeriod) > 0) {
    lines.push(`          <SMP>${formatRTIMoney(employee.smpInPeriod)}</SMP>`);
  }
  if (employee.sppInPeriod && parseFloat(employee.sppInPeriod) > 0) {
    lines.push(`          <SPP>${formatRTIMoney(employee.sppInPeriod)}</SPP>`);
  }
  if (employee.sapInPeriod && parseFloat(employee.sapInPeriod) > 0) {
    lines.push(`          <SAP>${formatRTIMoney(employee.sapInPeriod)}</SAP>`);
  }
  if (employee.shppInPeriod && parseFloat(employee.shppInPeriod) > 0) {
    lines.push(`          <ShPP>${formatRTIMoney(employee.shppInPeriod)}</ShPP>`);
  }
  if (employee.sspInPeriod && parseFloat(employee.sspInPeriod) > 0) {
    lines.push(`          <SSP>${formatRTIMoney(employee.sspInPeriod)}</SSP>`);
  }

  // Payment flags
  if (employee.irregularPayment) {
    lines.push('          <IrregularPayment>yes</IrregularPayment>');
  }
  if (employee.paymentAfterLeaving) {
    lines.push('          <PaymentAfterLeaving>yes</PaymentAfterLeaving>');
  }

  lines.push('        </Payment>');

  // Tax code and NI category
  lines.push('        <PAYECode>');
  lines.push(`          <TaxCode>${employee.taxCode}</TaxCode>`);
  lines.push(`          <TaxBasis>${employee.taxBasis === 'week1_month1' ? 'W1M1' : ''}</TaxBasis>`);
  lines.push('        </PAYECode>');

  // NI
  lines.push('        <NationalInsurance>');
  lines.push(`          <NICategory>${employee.niCategory}</NICategory>`);
  lines.push(`          <NIablePayInPd>${formatRTIMoney(employee.niablePayInPeriod)}</NIablePayInPd>`);
  lines.push(`          <EmpeeContribnsInPd>${formatRTIMoney(employee.employeeNIInPeriod)}</EmpeeContribnsInPd>`);
  lines.push(`          <EmprContribnsInPd>${formatRTIMoney(employee.employerNIInPeriod)}</EmprContribnsInPd>`);
  lines.push(`          <EmpeeContribnsYTD>${formatRTIMoney(employee.employeeNIYTD)}</EmpeeContribnsYTD>`);
  lines.push(`          <EmprContribnsYTD>${formatRTIMoney(employee.employerNIYTD)}</EmprContribnsYTD>`);
  lines.push('        </NationalInsurance>');

  // Year-to-date
  lines.push('        <YearToDate>');
  lines.push(`          <TaxablePayYTD>${formatRTIMoney(employee.taxablePayYTD)}</TaxablePayYTD>`);
  lines.push(`          <TaxDeductedYTD>${formatRTIMoney(employee.taxDeductedYTD)}</TaxDeductedYTD>`);
  const studentLoanYTD = parseFloat(employee.studentLoanYTD);
  if (studentLoanYTD > 0) {
    lines.push(`          <StudentLoanYTD>${formatRTIMoney(employee.studentLoanYTD)}</StudentLoanYTD>`);
  }
  const pgLoanYTD = parseFloat(employee.postgraduateLoanYTD);
  if (pgLoanYTD > 0) {
    lines.push(`          <PostgradLoanYTD>${formatRTIMoney(employee.postgraduateLoanYTD)}</PostgradLoanYTD>`);
  }
  lines.push('        </YearToDate>');

  lines.push('      </Employment>');
  lines.push('    </Employee>');

  return lines.join('\n');
}

/**
 * Build FPS XML document
 */
function buildFPSXML(request: FPSSubmissionRequest): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<FullPaymentSubmission ${buildXMLNamespaces()}>`);

  // Header
  lines.push('  <IRheader>');
  lines.push(`    <Keys>`);
  lines.push(`      <Key Type="PAYE">${escapeXML(request.payeReference)}</Key>`);
  lines.push(`      <Key Type="AORef">${escapeXML(request.accountsOfficeReference)}</Key>`);
  lines.push(`    </Keys>`);
  lines.push(`    <Period>M${request.periodNumber.toString().padStart(2, '0')}</Period>`);
  lines.push(`    <TaxYear>${request.taxYear}</TaxYear>`);
  if (request.isTestSubmission) {
    lines.push('    <TestInLive>1</TestInLive>');
  }
  lines.push('  </IRheader>');

  // Late reporting
  if (request.isLateReporting && request.lateReportingReason) {
    lines.push('  <LateReason>');
    lines.push(`    <Reason>${escapeXML(request.lateReportingReason)}</Reason>`);
    lines.push('  </LateReason>');
  }

  // Employer
  lines.push('  <Employer>');
  lines.push(`    <EMPAORef>${escapeXML(request.accountsOfficeReference)}</EMPAORef>`);
  lines.push(`    <PaymentDate>${formatRTIDate(request.paymentDate)}</PaymentDate>`);

  // Final submission
  if (request.finalSubmissionForYear) {
    lines.push('    <FinalSubmission>');
    lines.push('      <ForYear>yes</ForYear>');
    lines.push('    </FinalSubmission>');
  }

  // No payment for period
  if (request.noPaymentForPeriod) {
    lines.push('    <NoPaymentForPeriod>yes</NoPaymentForPeriod>');
  }

  // Period of inactivity
  if (request.periodOfInactivity) {
    lines.push('    <EmploymentAllowance>');
    lines.push(`      <NoActivityFrom>${formatRTIDate(request.periodOfInactivity.from)}</NoActivityFrom>`);
    lines.push(`      <NoActivityTo>${formatRTIDate(request.periodOfInactivity.to)}</NoActivityTo>`);
    lines.push('    </EmploymentAllowance>');
  }

  lines.push('  </Employer>');

  // Employees
  for (const employee of request.employees) {
    lines.push(buildEmployeeXML(employee));
  }

  lines.push('</FullPaymentSubmission>');

  return lines.join('\n');
}

/**
 * Build EPS XML document
 */
function buildEPSXML(request: EPSSubmissionRequest): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<EmployerPaymentSummary xmlns="http://www.govtalk.gov.uk/taxation/PAYE/RTI/EmployerPaymentSummary/17-18/1">');

  // Header
  lines.push('  <IRheader>');
  lines.push(`    <Keys>`);
  lines.push(`      <Key Type="PAYE">${escapeXML(request.payeReference)}</Key>`);
  lines.push(`      <Key Type="AORef">${escapeXML(request.accountsOfficeReference)}</Key>`);
  lines.push(`    </Keys>`);
  lines.push(`    <Period>M${request.taxMonth.toString().padStart(2, '0')}</Period>`);
  lines.push(`    <TaxYear>${request.taxYear}</TaxYear>`);
  if (request.isTestSubmission) {
    lines.push('    <TestInLive>1</TestInLive>');
  }
  lines.push('  </IRheader>');

  // Employer
  lines.push('  <Employer>');
  lines.push(`    <EMPAORef>${escapeXML(request.accountsOfficeReference)}</EMPAORef>`);

  // No payment for period
  if (request.noPaymentForPeriod) {
    lines.push('    <NoPaymentForPeriod>');
    lines.push('      <NoPayment>yes</NoPayment>');
    if (request.periodOfInactivity) {
      lines.push(`      <NoActivityFrom>${formatRTIDate(request.periodOfInactivity.from)}</NoActivityFrom>`);
      lines.push(`      <NoActivityTo>${formatRTIDate(request.periodOfInactivity.to)}</NoActivityTo>`);
    }
    lines.push('    </NoPaymentForPeriod>');
  }

  // Recovery amounts
  const hasRecoveries = request.smpRecovered || request.sppRecovered ||
    request.sapRecovered || request.shppRecovered || request.nicCompensation;

  if (hasRecoveries) {
    lines.push('    <RecoverableAmountsYTD>');
    if (request.smpRecovered && parseFloat(request.smpRecovered) > 0) {
      lines.push(`      <SMPRecovered>${formatRTIMoney(request.smpRecovered)}</SMPRecovered>`);
    }
    if (request.sppRecovered && parseFloat(request.sppRecovered) > 0) {
      lines.push(`      <SPPRecovered>${formatRTIMoney(request.sppRecovered)}</SPPRecovered>`);
    }
    if (request.sapRecovered && parseFloat(request.sapRecovered) > 0) {
      lines.push(`      <SAPRecovered>${formatRTIMoney(request.sapRecovered)}</SAPRecovered>`);
    }
    if (request.shppRecovered && parseFloat(request.shppRecovered) > 0) {
      lines.push(`      <ShPPRecovered>${formatRTIMoney(request.shppRecovered)}</ShPPRecovered>`);
    }
    if (request.nicCompensation && parseFloat(request.nicCompensation) > 0) {
      lines.push(`      <NICCompensationOnSMP>${formatRTIMoney(request.nicCompensation)}</NICCompensationOnSMP>`);
    }
    lines.push('    </RecoverableAmountsYTD>');
  }

  // CIS deductions
  if (request.cisDeductionsSuffered && parseFloat(request.cisDeductionsSuffered) > 0) {
    lines.push(`    <CISDeductionsSuffered>${formatRTIMoney(request.cisDeductionsSuffered)}</CISDeductionsSuffered>`);
  }

  // Employment Allowance
  if (request.employmentAllowanceClaim) {
    lines.push('    <EmploymentAllowance>');
    lines.push(`      <EAIndicator>${request.employmentAllowanceIndicator ? 'yes' : 'no'}</EAIndicator>`);
    lines.push(`      <DeMinimisStateAid>${request.deMinimisStateAidEligible ? 'yes' : 'no'}</DeMinimisStateAid>`);
    lines.push('    </EmploymentAllowance>');
  }

  // Apprenticeship Levy
  if (request.apprenticeshipLevyDue && parseFloat(request.apprenticeshipLevyDue) > 0) {
    lines.push(`    <ApprenticeshipLevyDue>${formatRTIMoney(request.apprenticeshipLevyDue)}</ApprenticeshipLevyDue>`);
  }

  // Final submission
  if (request.finalSubmissionForYear) {
    lines.push('    <FinalSubmission>');
    lines.push('      <ForYear>yes</ForYear>');
    if (request.dateSchemesClosed) {
      lines.push(`      <DateSchemesClosed>${formatRTIDate(request.dateSchemesClosed)}</DateSchemesClosed>`);
    }
    if (request.schemeCeasedDate) {
      lines.push(`      <SchemeCeased>${formatRTIDate(request.schemeCeasedDate)}</SchemeCeased>`);
    }
    lines.push('    </FinalSubmission>');
  }

  lines.push('  </Employer>');
  lines.push('</EmployerPaymentSummary>');

  return lines.join('\n');
}

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// =============================================================================
// XML Response Parsing
// =============================================================================

/**
 * Parse HMRC RTI response (simplified XML parsing)
 * Note: In production, use a proper XML parser like fast-xml-parser
 */
function parseRTIResponse(xml: string): {
  success: boolean;
  correlationId?: string;
  receiptTimestamp?: string;
  receiptId?: string;
  errors?: Array<{ code: string; message: string; path?: string }>;
  warnings?: Array<{ code: string; message: string }>;
} {
  // Extract correlation ID
  const correlationIdMatch = xml.match(/<CorrelationId>([^<]+)<\/CorrelationId>/);
  const receiptTimestampMatch = xml.match(/<ReceiptTimestamp>([^<]+)<\/ReceiptTimestamp>/);
  const receiptIdMatch = xml.match(/<ReceiptID>([^<]+)<\/ReceiptID>/);

  // Check for success acknowledgment
  const hasAcknowledgment = xml.includes('<Acknowledgment>') || xml.includes('<SuccessResponse>');

  // Extract errors
  const errors: Array<{ code: string; message: string; path?: string }> = [];
  const errorRegex = /<Error[^>]*>[\s\S]*?<Code>([^<]+)<\/Code>[\s\S]*?<Message>([^<]+)<\/Message>[\s\S]*?<\/Error>/gi;
  let errorMatch: RegExpExecArray | null;
  while ((errorMatch = errorRegex.exec(xml)) !== null) {
    errors.push({ code: errorMatch[1], message: errorMatch[2] });
  }

  // Extract warnings
  const warnings: Array<{ code: string; message: string }> = [];
  const warningRegex = /<Warning[^>]*>[\s\S]*?<Code>([^<]+)<\/Code>[\s\S]*?<Message>([^<]+)<\/Message>[\s\S]*?<\/Warning>/gi;
  let warningMatch: RegExpExecArray | null;
  while ((warningMatch = warningRegex.exec(xml)) !== null) {
    warnings.push({ code: warningMatch[1], message: warningMatch[2] });
  }

  return {
    success: hasAcknowledgment && errors.length === 0,
    correlationId: correlationIdMatch?.[1],
    receiptTimestamp: receiptTimestampMatch?.[1],
    receiptId: receiptIdMatch?.[1],
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// =============================================================================
// RTI Client
// =============================================================================

export class HMRCRTIClient {
  private readonly baseUrl: string;
  private readonly config: HMRCRTIClientConfig;

  constructor(config: HMRCRTIClientConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.service.hmrc.gov.uk'
      : 'https://test-api.service.hmrc.gov.uk';
  }

  // ===========================================================================
  // FPS Methods
  // ===========================================================================

  /**
   * Submit Full Payment Submission (FPS)
   * FPS must be submitted on or before payday
   */
  async submitFPS(
    entityId: string,
    request: FPSSubmissionRequest
  ): Promise<RTIApiResponse<FPSSubmissionResponse>> {
    // Validate request
    FPSSubmissionRequestSchema.parse(request);

    // Build XML payload
    const xmlPayload = buildFPSXML(request);

    return this.submitRTI<FPSSubmissionResponse>(
      entityId,
      '/organisations/paye/fps',
      xmlPayload,
      'FPS'
    );
  }

  /**
   * Validate FPS before submission (dry run)
   */
  async validateFPS(
    entityId: string,
    request: FPSSubmissionRequest
  ): Promise<{
    valid: boolean;
    errors: Array<{ code: string; message: string; path?: string }>;
    warnings: Array<{ code: string; message: string }>;
  }> {
    // Validate schema
    const validation = FPSSubmissionRequestSchema.safeParse(request);

    if (!validation.success) {
      return {
        valid: false,
        errors: validation.error.issues.map(issue => ({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: issue.message,
          path: issue.path.join('.'),
        })),
        warnings: [],
      };
    }

    // Additional business validation
    const errors: Array<{ code: string; message: string; path?: string }> = [];
    const warnings: Array<{ code: string; message: string }> = [];

    // Check payment date is not in the future (by more than 7 days)
    const maxFutureDate = new Date();
    maxFutureDate.setDate(maxFutureDate.getDate() + 7);
    if (request.paymentDate > maxFutureDate) {
      warnings.push({
        code: 'FUTURE_PAYMENT_DATE',
        message: 'Payment date is more than 7 days in the future',
      });
    }

    // Check for employees without NINO
    for (let i = 0; i < request.employees.length; i++) {
      const employee = request.employees[i];
      if (!employee.nationalInsuranceNumber && !employee.starterDeclaration) {
        warnings.push({
          code: 'MISSING_NINO',
          message: `Employee ${employee.employeePayrollId} has no NINO and no starter declaration`,
        });
      }
    }

    // Check tax year format
    if (!/^\d{2}-\d{2}$/.test(request.taxYear)) {
      errors.push({
        code: 'INVALID_TAX_YEAR_FORMAT',
        message: 'Tax year must be in format YY-YY (e.g., 24-25)',
        path: 'taxYear',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ===========================================================================
  // EPS Methods
  // ===========================================================================

  /**
   * Submit Employer Payment Summary (EPS)
   * EPS must be submitted by 19th of the following month
   */
  async submitEPS(
    entityId: string,
    request: EPSSubmissionRequest
  ): Promise<RTIApiResponse<EPSSubmissionResponse>> {
    // Validate request
    EPSSubmissionRequestSchema.parse(request);

    // Build XML payload
    const xmlPayload = buildEPSXML(request);

    return this.submitRTI<EPSSubmissionResponse>(
      entityId,
      '/organisations/paye/eps',
      xmlPayload,
      'EPS'
    );
  }

  /**
   * Validate EPS before submission (dry run)
   */
  async validateEPS(
    entityId: string,
    request: EPSSubmissionRequest
  ): Promise<{
    valid: boolean;
    errors: Array<{ code: string; message: string; path?: string }>;
    warnings: Array<{ code: string; message: string }>;
  }> {
    // Validate schema
    const validation = EPSSubmissionRequestSchema.safeParse(request);

    if (!validation.success) {
      return {
        valid: false,
        errors: validation.error.issues.map(issue => ({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: issue.message,
          path: issue.path.join('.'),
        })),
        warnings: [],
      };
    }

    const errors: Array<{ code: string; message: string; path?: string }> = [];
    const warnings: Array<{ code: string; message: string }> = [];

    // Check tax year format
    if (!/^\d{2}-\d{2}$/.test(request.taxYear)) {
      errors.push({
        code: 'INVALID_TAX_YEAR_FORMAT',
        message: 'Tax year must be in format YY-YY (e.g., 24-25)',
        path: 'taxYear',
      });
    }

    // Warn if claiming Employment Allowance without de minimis declaration
    if (request.employmentAllowanceClaim && !request.deMinimisStateAidEligible) {
      warnings.push({
        code: 'EA_STATE_AID_WARNING',
        message: 'Employment Allowance claim may require de minimis State Aid eligibility',
      });
    }

    // Check final submission has required fields
    if (request.finalSubmissionForYear && !request.dateSchemesClosed && !request.schemeCeasedDate) {
      warnings.push({
        code: 'FINAL_SUBMISSION_MISSING_DATES',
        message: 'Final submission usually requires scheme closed or ceased dates',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ===========================================================================
  // Submission Status Methods
  // ===========================================================================

  /**
   * Get submission status for a previously submitted FPS/EPS
   */
  async getSubmissionStatus(
    entityId: string,
    payeReference: string,
    submissionType: 'fps' | 'eps',
    correlationId: string
  ): Promise<RTIApiResponse<{
    status: 'pending' | 'accepted' | 'rejected';
    processingDate?: string;
    errors?: Array<{ code: string; message: string }>;
  }>> {
    const path = `/organisations/paye/${submissionType}/status?correlationId=${encodeURIComponent(correlationId)}`;

    return this.request<{
      status: 'pending' | 'accepted' | 'rejected';
      processingDate?: string;
      errors?: Array<{ code: string; message: string }>;
    }>(entityId, 'GET', path);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Submit RTI message to HMRC
   */
  private async submitRTI<T extends FPSSubmissionResponse | EPSSubmissionResponse>(
    entityId: string,
    path: string,
    xmlPayload: string,
    submissionType: 'FPS' | 'EPS'
  ): Promise<RTIApiResponse<T>> {
    // Get valid token
    let tokenSet = await this.config.tokenStore.getToken(entityId, RTI_SCOPES.WRITE);
    if (!tokenSet) {
      throw new HMRCAuthError(
        'No HMRC RTI authorization found. User must authorize first.',
        'not_authorized'
      );
    }

    // Refresh if expired
    if (this.config.oauthClient.isTokenExpired(tokenSet)) {
      tokenSet = await this.config.oauthClient.refreshToken(tokenSet.refreshToken);
      await this.config.tokenStore.saveToken(entityId, RTI_SCOPES.WRITE, tokenSet);
    }

    // Build headers
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${tokenSet.accessToken}`,
      'Accept': 'application/xml',
      'Content-Type': 'application/xml',
    };

    // Add fraud prevention headers if configured
    if (this.config.fraudPreventionHeaders) {
      this.addFraudPreventionHeaders(headers);
    }

    // Make request
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: xmlPayload,
    });

    // Parse response headers
    const responseHeaders = {
      correlationId: response.headers.get('X-Correlation-Id') ?? undefined,
      receiptId: response.headers.get('Receipt-ID') ?? undefined,
      receiptTimestamp: response.headers.get('Receipt-Timestamp') ?? undefined,
    };

    const responseText = await response.text();

    // Handle HTTP errors
    if (!response.ok) {
      const parsed = parseRTIResponse(responseText);
      throw new HMRCRTIError(
        parsed.errors?.[0]?.message || `HMRC RTI ${submissionType} submission failed`,
        parsed.errors?.[0]?.code || 'RTI_SUBMISSION_FAILED',
        response.status,
        responseHeaders.correlationId,
        parsed.errors
      );
    }

    // Parse successful response
    const parsed = parseRTIResponse(responseText);

    if (!parsed.success) {
      throw new HMRCRTIError(
        parsed.errors?.[0]?.message || `HMRC RTI ${submissionType} submission rejected`,
        parsed.errors?.[0]?.code || 'RTI_SUBMISSION_REJECTED',
        response.status,
        responseHeaders.correlationId,
        parsed.errors
      );
    }

    const data: T = {
      success: true,
      correlationId: parsed.correlationId || responseHeaders.correlationId || '',
      receiptTimestamp: parsed.receiptTimestamp || responseHeaders.receiptTimestamp || new Date().toISOString(),
      receiptId: parsed.receiptId || responseHeaders.receiptId,
      warnings: parsed.warnings,
    } as T;

    return { data, headers: responseHeaders };
  }

  /**
   * Make a general RTI request (for status checks, etc.)
   */
  private async request<T>(
    entityId: string,
    method: string,
    path: string
  ): Promise<RTIApiResponse<T>> {
    // Get valid token
    let tokenSet = await this.config.tokenStore.getToken(entityId, RTI_SCOPES.READ);
    if (!tokenSet) {
      throw new HMRCAuthError(
        'No HMRC RTI authorization found. User must authorize first.',
        'not_authorized'
      );
    }

    // Refresh if expired
    if (this.config.oauthClient.isTokenExpired(tokenSet)) {
      tokenSet = await this.config.oauthClient.refreshToken(tokenSet.refreshToken);
      await this.config.tokenStore.saveToken(entityId, RTI_SCOPES.READ, tokenSet);
    }

    // Build headers
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${tokenSet.accessToken}`,
      'Accept': 'application/json',
    };

    // Add fraud prevention headers if configured
    if (this.config.fraudPreventionHeaders) {
      this.addFraudPreventionHeaders(headers);
    }

    // Make request
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
    });

    // Parse response headers
    const responseHeaders = {
      correlationId: response.headers.get('X-Correlation-Id') ?? undefined,
      receiptId: response.headers.get('Receipt-ID') ?? undefined,
      receiptTimestamp: response.headers.get('Receipt-Timestamp') ?? undefined,
    };

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new HMRCRTIError(
        errorBody.message || `HMRC RTI API error: ${response.status}`,
        errorBody.code || 'RTI_API_ERROR',
        response.status,
        responseHeaders.correlationId,
        errorBody.errors
      );
    }

    const data = await response.json() as T;
    return { data, headers: responseHeaders };
  }

  /**
   * Add fraud prevention headers to request
   */
  private addFraudPreventionHeaders(headers: Record<string, string>): void {
    const fp = this.config.fraudPreventionHeaders;
    if (!fp) return;

    headers['Gov-Client-Connection-Method'] = fp.govClientConnectionMethod;

    if (fp.govClientPublicIp) {
      headers['Gov-Client-Public-IP'] = fp.govClientPublicIp;
    }
    if (fp.govClientPublicPort) {
      headers['Gov-Client-Public-Port'] = fp.govClientPublicPort;
    }
    if (fp.govClientDeviceId) {
      headers['Gov-Client-Device-ID'] = fp.govClientDeviceId;
    }
    if (fp.govClientUserId) {
      headers['Gov-Client-User-IDs'] = fp.govClientUserId;
    }
    if (fp.govClientTimezone) {
      headers['Gov-Client-Timezone'] = fp.govClientTimezone;
    }
    if (fp.govClientLocalIps) {
      headers['Gov-Client-Local-IPs'] = fp.govClientLocalIps;
    }
    if (fp.govVendorVersion) {
      headers['Gov-Vendor-Version'] = fp.govVendorVersion;
    }
    if (fp.govVendorProductName) {
      headers['Gov-Vendor-Product-Name'] = fp.govVendorProductName;
    }
    if (fp.govVendorLicenseIds) {
      headers['Gov-Vendor-License-IDs'] = fp.govVendorLicenseIds;
    }
    if (fp.govVendorPublicIp) {
      headers['Gov-Vendor-Public-IP'] = fp.govVendorPublicIp;
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export interface HMRCRTIClientDependencies {
  oauthClient: HMRCOAuthClient;
  tokenStore: HMRCTokenStore;
  environment: 'sandbox' | 'production';
  fraudPreventionHeaders?: FraudPreventionHeaders;
}

export function createHMRCRTIClient(deps: HMRCRTIClientDependencies): HMRCRTIClient {
  return new HMRCRTIClient(deps);
}
