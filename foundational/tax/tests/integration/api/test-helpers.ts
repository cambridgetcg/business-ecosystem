/**
 * Integration Test Helpers
 *
 * Utilities for testing API endpoints with mocked repositories.
 */

import Fastify, { FastifyInstance } from 'fastify';
import { vi } from 'vitest';

// Mock repository factories
export function createMockRegistrationRepository() {
  const storage = new Map<string, any>();

  return {
    findById: vi.fn(async (id: string) => storage.get(id) ?? null),
    findMany: vi.fn(async (filters?: any, pagination?: any) => ({
      data: Array.from(storage.values()),
      total: storage.size,
      limit: pagination?.limit ?? 20,
      offset: pagination?.offset ?? 0,
    })),
    create: vi.fn(async (input: any, createdBy?: string) => {
      const id = crypto.randomUUID();
      const now = new Date();
      const registration = {
        id,
        ...input,
        vatRegistered: false,
        payeRegistered: false,
        corporationTaxRegistered: false,
        mtdVatEnabled: false,
        mtdVatMandated: false,
        vatThresholdExceeded: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
        deletedAt: null,
      };
      storage.set(id, registration);
      return registration;
    }),
    update: vi.fn(async (id: string, input: any) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('Registration not found: ' + id);
      const updated = { ...existing, ...input, updatedAt: new Date() };
      storage.set(id, updated);
      return updated;
    }),
    registerForVAT: vi.fn(async (id: string, vatDetails: any) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('Registration not found: ' + id);
      const updated = {
        ...existing,
        ...vatDetails,
        vatRegistered: true,
        vatStatus: 'active',
        updatedAt: new Date(),
      };
      storage.set(id, updated);
      return updated;
    }),
    registerForPAYE: vi.fn(async (id: string, payeDetails: any) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('Registration not found: ' + id);
      const updated = {
        ...existing,
        ...payeDetails,
        payeRegistered: true,
        payeStatus: 'active',
        updatedAt: new Date(),
      };
      storage.set(id, updated);
      return updated;
    }),
    delete: vi.fn(async (id: string) => {
      const existing = storage.get(id);
      if (existing) {
        storage.set(id, { ...existing, deletedAt: new Date() });
      }
    }),
    _storage: storage,
    _clear: () => storage.clear(),
  };
}

export function createMockCorporationTaxRepository() {
  const storage = new Map<string, any>();

  return {
    findById: vi.fn(async (id: string) => storage.get(id) ?? null),
    findMany: vi.fn(async (filters?: any, pagination?: any) => ({
      data: Array.from(storage.values()),
      total: storage.size,
      limit: pagination?.limit ?? 20,
      offset: pagination?.offset ?? 0,
    })),
    create: vi.fn(async (input: any, createdBy?: string) => {
      const id = crypto.randomUUID();
      const now = new Date();
      const period = {
        id,
        ...input,
        status: 'draft',
        tradingProfits: '0',
        investmentIncome: '0',
        propertyIncome: '0',
        otherIncome: '0',
        chargeableGains: '0',
        corporationTaxLiability: '0',
        taxDue: '0',
        taxPaid: '0',
        taxOutstanding: '0',
        effectiveRate: '0',
        filingDeadline: new Date(input.periodEnd.getTime() + 365 * 24 * 60 * 60 * 1000),
        paymentDeadline: new Date(input.periodEnd.getTime() + 274 * 24 * 60 * 60 * 1000),
        financialYear: `FY${input.periodEnd.getFullYear()}`,
        createdAt: now,
        updatedAt: now,
        version: 1,
        deletedAt: null,
      };
      storage.set(id, period);
      return period;
    }),
    updateCalculation: vi.fn(async (id: string, input: any) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('CT period not found: ' + id);
      const updated = {
        ...existing,
        ...input,
        status: 'calculated',
        calculatedAt: new Date(),
        updatedAt: new Date(),
      };
      storage.set(id, updated);
      return updated;
    }),
    markAsFiled: vi.fn(async (id: string, hmrcSubmissionId: string, hmrcReceiptNumber: string) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('CT period not found: ' + id);
      const updated = {
        ...existing,
        status: 'filed',
        hmrcSubmissionId,
        hmrcReceiptNumber,
        filedAt: new Date(),
        updatedAt: new Date(),
      };
      storage.set(id, updated);
      return updated;
    }),
    recordPayment: vi.fn(async (id: string, amount: string) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('CT period not found: ' + id);
      const updated = {
        ...existing,
        status: 'paid',
        taxPaid: amount,
        taxOutstanding: '0',
        paidAt: new Date(),
        updatedAt: new Date(),
      };
      storage.set(id, updated);
      return updated;
    }),
    delete: vi.fn(async (id: string) => {
      const existing = storage.get(id);
      if (existing) {
        storage.set(id, { ...existing, deletedAt: new Date() });
      }
    }),
    _storage: storage,
    _clear: () => storage.clear(),
  };
}

export function createMockVATReturnRepository() {
  const storage = new Map<string, any>();

  return {
    findById: vi.fn(async (id: string) => storage.get(id) ?? null),
    findMany: vi.fn(async (filters?: any, pagination?: any) => ({
      data: Array.from(storage.values()),
      total: storage.size,
      limit: pagination?.limit ?? 20,
      offset: pagination?.offset ?? 0,
    })),
    findByPeriodKey: vi.fn(async (registrationId: string, periodKey: string) => {
      return Array.from(storage.values()).find(
        r => r.registrationId === registrationId && r.periodKey === periodKey
      ) ?? null;
    }),
    create: vi.fn(async (input: any, createdBy?: string) => {
      const id = crypto.randomUUID();
      const now = new Date();
      const vatReturn = {
        id,
        ...input,
        status: 'draft',
        box1: '0',
        box2: '0',
        box3: '0',
        box4: '0',
        box5: '0',
        box6: '0',
        box7: '0',
        box8: '0',
        box9: '0',
        declarationAccepted: false,
        periodKey: `${input.periodEnd.getFullYear()}${(input.periodEnd.getMonth() + 1).toString().padStart(2, '0')}`,
        submissionDeadline: new Date(input.periodEnd.getTime() + 37 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
        version: 1,
        deletedAt: null,
      };
      storage.set(id, vatReturn);
      return vatReturn;
    }),
    updateBoxes: vi.fn(async (id: string, boxes: any, flatRateDetails?: any) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('VAT return not found: ' + id);
      const updated = {
        ...existing,
        ...boxes,
        status: 'calculated',
        updatedAt: new Date(),
      };
      storage.set(id, updated);
      return updated;
    }),
    acceptDeclaration: vi.fn(async (id: string, acceptedBy: string) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('VAT return not found: ' + id);
      const updated = {
        ...existing,
        declarationAccepted: true,
        declarationAcceptedBy: acceptedBy,
        declarationAcceptedAt: new Date(),
        updatedAt: new Date(),
      };
      storage.set(id, updated);
      return updated;
    }),
    markAsSubmitted: vi.fn(async (id: string, mtdDetails: any) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('VAT return not found: ' + id);
      const updated = {
        ...existing,
        status: 'submitted',
        submittedAt: new Date(),
        mtdReceiptId: mtdDetails.receiptId,
        updatedAt: new Date(),
      };
      storage.set(id, updated);
      return updated;
    }),
    delete: vi.fn(async (id: string) => {
      const existing = storage.get(id);
      if (existing) {
        storage.set(id, { ...existing, deletedAt: new Date() });
      }
    }),
    _storage: storage,
    _clear: () => storage.clear(),
  };
}

export function createMockPAYESubmissionRepository() {
  const storage = new Map<string, any>();

  return {
    findById: vi.fn(async (id: string) => storage.get(id) ?? null),
    findMany: vi.fn(async (filters?: any, pagination?: any) => ({
      data: Array.from(storage.values()).filter(
        s => !filters?.submissionType || s.submissionType === filters.submissionType
      ),
      total: storage.size,
      limit: pagination?.limit ?? 20,
      offset: pagination?.offset ?? 0,
    })),
    createFPS: vi.fn(async (input: any, createdBy?: string) => {
      const id = crypto.randomUUID();
      const now = new Date();
      const fps = {
        id,
        ...input,
        submissionType: 'fps',
        status: 'draft',
        employeeCount: input.employeePayments?.length ?? 0,
        totalPayInPeriod: '10000',
        totalTaxDeducted: '2000',
        totalEmployeeNI: '500',
        totalEmployerNI: '700',
        totalStudentLoan: '0',
        totalPostgraduateLoan: '0',
        createdAt: now,
        updatedAt: now,
        version: 1,
        deletedAt: null,
      };
      storage.set(id, fps);
      return fps;
    }),
    createEPS: vi.fn(async (input: any, createdBy?: string) => {
      const id = crypto.randomUUID();
      const now = new Date();
      const eps = {
        id,
        ...input,
        submissionType: 'eps',
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        version: 1,
        deletedAt: null,
      };
      storage.set(id, eps);
      return eps;
    }),
    markAsValidated: vi.fn(async (id: string) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('PAYE submission not found: ' + id);
      const updated = { ...existing, status: 'validated', updatedAt: new Date() };
      storage.set(id, updated);
      return updated;
    }),
    markAsSubmitted: vi.fn(async (id: string, hmrcCorrelationId: string) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('PAYE submission not found: ' + id);
      const updated = {
        ...existing,
        status: 'submitted',
        submittedAt: new Date(),
        hmrcCorrelationId,
        updatedAt: new Date(),
      };
      storage.set(id, updated);
      return updated;
    }),
    markAsAcknowledged: vi.fn(async (id: string, hmrcReceiptTimestamp: Date) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('PAYE submission not found: ' + id);
      const updated = {
        ...existing,
        status: 'acknowledged',
        hmrcReceiptTimestamp,
        updatedAt: new Date(),
      };
      storage.set(id, updated);
      return updated;
    }),
    markAsError: vi.fn(async (id: string, errors: any[]) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('PAYE submission not found: ' + id);
      const updated = { ...existing, status: 'error', hmrcErrors: errors, updatedAt: new Date() };
      storage.set(id, updated);
      return updated;
    }),
    delete: vi.fn(async (id: string) => {
      const existing = storage.get(id);
      if (existing) {
        storage.set(id, { ...existing, deletedAt: new Date() });
      }
    }),
    _storage: storage,
    _clear: () => storage.clear(),
  };
}

export function createMockEmployeeTaxRecordRepository() {
  const storage = new Map<string, any>();

  return {
    findById: vi.fn(async (id: string) => storage.get(id) ?? null),
    findByEmployeeId: vi.fn(async (employeeId: string, taxYear: string) => {
      return Array.from(storage.values()).find(
        r => r.employeeId === employeeId && r.taxYear === taxYear
      ) ?? null;
    }),
    findMany: vi.fn(async (filters?: any, pagination?: any) => ({
      data: Array.from(storage.values()),
      total: storage.size,
      limit: pagination?.limit ?? 20,
      offset: pagination?.offset ?? 0,
    })),
    create: vi.fn(async (input: any, createdBy?: string) => {
      const id = crypto.randomUUID();
      const now = new Date();
      const record = {
        id,
        ...input,
        taxYear: '2024-25',
        employmentStatus: 'active',
        grossPayYTD: '0',
        taxablePayYTD: '0',
        taxPaidYTD: '0',
        niablePayYTD: '0',
        employeeNIYTD: '0',
        employerNIYTD: '0',
        studentLoanYTD: '0',
        postgraduateLoanYTD: '0',
        benefitsInKindYTD: '0',
        benefitsTaxYTD: '0',
        smpYTD: '0',
        sppYTD: '0',
        sapYTD: '0',
        shppYTD: '0',
        sspYTD: '0',
        currentPeriodNumber: 1,
        periodsWorkedThisYear: 0,
        p60Issued: false,
        p45Issued: false,
        week1Month1Basis: false,
        irregularPaymentPattern: false,
        offPayrollWorker: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
        deletedAt: null,
      };
      storage.set(id, record);
      return record;
    }),
    update: vi.fn(async (id: string, input: any) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('Employee tax record not found: ' + id);
      const updated = { ...existing, ...input, updatedAt: new Date() };
      storage.set(id, updated);
      return updated;
    }),
    updateYTDFigures: vi.fn(async (id: string, ytdFigures: any) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('Employee tax record not found: ' + id);
      const updated = { ...existing, ...ytdFigures, updatedAt: new Date() };
      storage.set(id, updated);
      return updated;
    }),
    changeTaxCode: vi.fn(async (id: string, newTaxCode: string) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('Employee tax record not found: ' + id);
      const previousTaxCode = existing.taxCode;
      const updated = { ...existing, taxCode: newTaxCode, updatedAt: new Date() };
      storage.set(id, updated);
      return { record: updated, previousTaxCode };
    }),
    issueP45: vi.fn(async (id: string) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('Employee tax record not found: ' + id);
      const updated = {
        ...existing,
        p45Issued: true,
        p45IssuedAt: new Date(),
        employmentStatus: 'terminated',
        updatedAt: new Date(),
      };
      storage.set(id, updated);
      return updated;
    }),
    issueP60: vi.fn(async (id: string) => {
      const existing = storage.get(id);
      if (!existing) throw new Error('Employee tax record not found: ' + id);
      const updated = {
        ...existing,
        p60Issued: true,
        p60IssuedAt: new Date(),
        updatedAt: new Date(),
      };
      storage.set(id, updated);
      return updated;
    }),
    delete: vi.fn(async (id: string) => {
      const existing = storage.get(id);
      if (existing) {
        storage.set(id, { ...existing, deletedAt: new Date() });
      }
    }),
    _storage: storage,
    _clear: () => storage.clear(),
  };
}

export function createMockEventPublisher() {
  const events: Array<{ type: string; id: string; payload: any }> = [];

  return {
    publish: vi.fn(async (type: string, id: string, payload: any) => {
      events.push({ type, id, payload });
    }),
    _events: events,
    _clear: () => events.length = 0,
  };
}
