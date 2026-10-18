/**
 * UK Tax Service Domain Events
 *
 * Events published by the tax service for consumption by other ecosystem services.
 */

// =============================================================================
// Event Types
// =============================================================================

export const TaxEventTypes = {
  // Registration Events
  REGISTRATION_CREATED: 'tax.registration.created',
  REGISTRATION_UPDATED: 'tax.registration.updated',
  VAT_REGISTERED: 'tax.registration.vat_registered',
  VAT_DEREGISTERED: 'tax.registration.vat_deregistered',
  PAYE_REGISTERED: 'tax.registration.paye_registered',
  PAYE_DEREGISTERED: 'tax.registration.paye_deregistered',

  // Corporation Tax Events
  CT_PERIOD_CREATED: 'tax.corporation_tax.period_created',
  CT_PERIOD_CALCULATED: 'tax.corporation_tax.calculated',
  CT_PERIOD_FILED: 'tax.corporation_tax.filed',
  CT_PERIOD_PAID: 'tax.corporation_tax.paid',
  CT_PERIOD_OVERDUE: 'tax.corporation_tax.overdue',

  // VAT Return Events
  VAT_RETURN_CREATED: 'tax.vat_return.created',
  VAT_RETURN_CALCULATED: 'tax.vat_return.calculated',
  VAT_RETURN_SUBMITTED: 'tax.vat_return.submitted',
  VAT_RETURN_ACKNOWLEDGED: 'tax.vat_return.acknowledged',
  VAT_RETURN_ERROR: 'tax.vat_return.error',
  VAT_RETURN_DUE: 'tax.vat_return.due',

  // PAYE Events
  PAYE_FPS_CREATED: 'tax.paye.fps_created',
  PAYE_FPS_SUBMITTED: 'tax.paye.fps_submitted',
  PAYE_EPS_CREATED: 'tax.paye.eps_created',
  PAYE_EPS_SUBMITTED: 'tax.paye.eps_submitted',
  PAYE_SUBMISSION_ERROR: 'tax.paye.submission_error',

  // Employee Tax Events
  EMPLOYEE_TAX_RECORD_CREATED: 'tax.employee.record_created',
  EMPLOYEE_TAX_RECORD_UPDATED: 'tax.employee.record_updated',
  EMPLOYEE_TAX_CODE_CHANGED: 'tax.employee.tax_code_changed',
  EMPLOYEE_P45_ISSUED: 'tax.employee.p45_issued',
  EMPLOYEE_P60_ISSUED: 'tax.employee.p60_issued',
} as const;

export type TaxEventType = typeof TaxEventTypes[keyof typeof TaxEventTypes];

// =============================================================================
// Event Payloads
// =============================================================================

export interface RegistrationCreatedPayload {
  registrationId: string;
  tenantId: string;
  entityId: string;
  accountingPeriodEnd: string;
}

export interface VATRegisteredPayload {
  registrationId: string;
  tenantId: string;
  entityId: string;
  vatNumber: string;
  registrationDate: string;
  scheme: string;
  mtdEnabled: boolean;
}

export interface PAYERegisteredPayload {
  registrationId: string;
  tenantId: string;
  entityId: string;
  payeReference: string;
  accountsOfficeReference: string;
  registrationDate: string;
}

export interface CTPeriodCreatedPayload {
  periodId: string;
  tenantId: string;
  entityId: string;
  periodStart: string;
  periodEnd: string;
  financialYear: string;
  filingDeadline: string;
  paymentDeadline: string;
}

export interface CTPeriodCalculatedPayload {
  periodId: string;
  tenantId: string;
  entityId: string;
  profitsChargeableToCT: string;
  corporationTaxLiability: string;
  effectiveRate: string;
  rateApplied: 'small_profits' | 'marginal' | 'main';
  marginalRelief: string;
}

export interface CTPeriodFiledPayload {
  periodId: string;
  tenantId: string;
  entityId: string;
  filedAt: string;
  hmrcSubmissionId: string;
  hmrcReceiptNumber: string;
}

export interface CTPeriodPaidPayload {
  periodId: string;
  tenantId: string;
  entityId: string;
  taxDue: string;
  taxPaid: string;
  paidAt: string;
}

export interface VATReturnCreatedPayload {
  returnId: string;
  tenantId: string;
  entityId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  submissionDeadline: string;
}

export interface VATReturnCalculatedPayload {
  returnId: string;
  tenantId: string;
  entityId: string;
  periodKey: string;
  box1: string;
  box2: string;
  box3: string;
  box4: string;
  box5: string;
  direction: 'pay' | 'reclaim' | 'nil';
}

export interface VATReturnSubmittedPayload {
  returnId: string;
  tenantId: string;
  entityId: string;
  periodKey: string;
  submittedAt: string;
  mtdReceiptId: string;
  netVAT: string;
}

export interface PAYESubmissionCreatedPayload {
  submissionId: string;
  tenantId: string;
  entityId: string;
  submissionType: 'fps' | 'eps';
  taxYear: string;
  taxMonth: number;
  employeeCount?: number;
  totalPay?: string;
  totalTax?: string;
  totalNI?: string;
}

export interface PAYESubmissionSubmittedPayload {
  submissionId: string;
  tenantId: string;
  entityId: string;
  submissionType: 'fps' | 'eps';
  taxYear: string;
  taxMonth: number;
  submittedAt: string;
  hmrcCorrelationId: string;
}

export interface EmployeeTaxCodeChangedPayload {
  employeeId: string;
  tenantId: string;
  entityId: string;
  previousTaxCode: string;
  newTaxCode: string;
  effectiveDate: string;
}
