/**
 * PAYE API Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { payeRoutes } from '../../../src/api/rest/routes/paye.js';
import {
  createMockRegistrationRepository,
  createMockPAYESubmissionRepository,
  createMockEmployeeTaxRecordRepository,
  createMockEventPublisher,
} from './test-helpers.js';

describe('PAYE API', () => {
  let app: FastifyInstance;
  let mockRegistrationRepository: ReturnType<typeof createMockRegistrationRepository>;
  let mockPAYESubmissionRepository: ReturnType<typeof createMockPAYESubmissionRepository>;
  let mockEmployeeTaxRecordRepository: ReturnType<typeof createMockEmployeeTaxRecordRepository>;
  let mockEventPublisher: ReturnType<typeof createMockEventPublisher>;
  let testRegistrationId: string;

  beforeEach(async () => {
    mockRegistrationRepository = createMockRegistrationRepository();
    mockPAYESubmissionRepository = createMockPAYESubmissionRepository();
    mockEmployeeTaxRecordRepository = createMockEmployeeTaxRecordRepository();
    mockEventPublisher = createMockEventPublisher();

    // Create a PAYE-registered entity
    const registration = await mockRegistrationRepository.create({
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      entityId: '550e8400-e29b-41d4-a716-446655440001',
      accountingPeriodEnd: new Date('2024-03-31'),
    });
    await mockRegistrationRepository.registerForPAYE(registration.id, {
      payeReference: '123/ABC123',
      accountsOfficeReference: '123PA00123456',
      payeRegistrationDate: new Date(),
    });
    testRegistrationId = registration.id;

    app = Fastify();
    await app.register(
      async (instance) => {
        await payeRoutes(instance, {
          payeSubmissionRepository: mockPAYESubmissionRepository as any,
          employeeTaxRecordRepository: mockEmployeeTaxRecordRepository as any,
          registrationRepository: mockRegistrationRepository as any,
          eventPublisher: mockEventPublisher as any,
        });
      },
      { prefix: '/api/v1/tax/paye' }
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    mockRegistrationRepository._clear();
    mockPAYESubmissionRepository._clear();
    mockEmployeeTaxRecordRepository._clear();
    mockEventPublisher._clear();
  });

  describe('FPS Endpoints', () => {
    describe('POST /api/v1/tax/paye/fps', () => {
      it('should create an FPS submission', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/fps',
          payload: {
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            entityId: '550e8400-e29b-41d4-a716-446655440001',
            registrationId: testRegistrationId,
            taxYear: '2024-25',
            taxMonth: 1,
            paymentDate: '2024-04-30T00:00:00.000Z',
            payFrequency: 'monthly',
            employeePayments: [
              {
                employeeId: '550e8400-e29b-41d4-a716-446655440010',
                grossPay: '5000.00',
                taxDeducted: '800.00',
                employeeNI: '250.00',
                employerNI: '350.00',
              },
            ],
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.id).toBeDefined();
        expect(body.submissionType).toBe('fps');
        expect(body.taxYear).toBe('2024-25');
        expect(body.taxMonth).toBe(1);
        expect(body.status).toBe('draft');
        expect(mockEventPublisher.publish).toHaveBeenCalled();
      });

      it('should reject FPS for non-PAYE registered entity', async () => {
        // Create entity without PAYE registration
        const nonPayeRegistration = await mockRegistrationRepository.create({
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          entityId: '550e8400-e29b-41d4-a716-446655440002',
          accountingPeriodEnd: new Date('2024-03-31'),
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/fps',
          payload: {
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            entityId: '550e8400-e29b-41d4-a716-446655440002',
            registrationId: nonPayeRegistration.id,
            taxYear: '2024-25',
            taxMonth: 1,
            paymentDate: '2024-04-30T00:00:00.000Z',
            payFrequency: 'monthly',
            employeePayments: [
              {
                employeeId: '550e8400-e29b-41d4-a716-446655440010',
                grossPay: '5000.00',
                taxDeducted: '800.00',
                employeeNI: '250.00',
                employerNI: '350.00',
              },
            ],
          },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('PAYE_NOT_REGISTERED');
      });
    });

    describe('GET /api/v1/tax/paye/fps', () => {
      it('should list FPS submissions', async () => {
        // Create an FPS first
        await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/fps',
          payload: {
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            entityId: '550e8400-e29b-41d4-a716-446655440001',
            registrationId: testRegistrationId,
            taxYear: '2024-25',
            taxMonth: 1,
            paymentDate: '2024-04-30T00:00:00.000Z',
            payFrequency: 'monthly',
            employeePayments: [
              {
                employeeId: '550e8400-e29b-41d4-a716-446655440010',
                grossPay: '5000.00',
                taxDeducted: '800.00',
                employeeNI: '250.00',
                employerNI: '350.00',
              },
            ],
          },
        });

        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/tax/paye/fps',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.data).toBeDefined();
        expect(Array.isArray(body.data)).toBe(true);
      });
    });

    describe('POST /api/v1/tax/paye/fps/:id/submit', () => {
      it('should submit FPS to HMRC', async () => {
        // Create an FPS first
        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/fps',
          payload: {
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            entityId: '550e8400-e29b-41d4-a716-446655440001',
            registrationId: testRegistrationId,
            taxYear: '2024-25',
            taxMonth: 1,
            paymentDate: '2024-04-30T00:00:00.000Z',
            payFrequency: 'monthly',
            employeePayments: [
              {
                employeeId: '550e8400-e29b-41d4-a716-446655440010',
                grossPay: '5000.00',
                taxDeducted: '800.00',
                employeeNI: '250.00',
                employerNI: '350.00',
              },
            ],
          },
        });
        const created = JSON.parse(createResponse.body);

        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/tax/paye/fps/${created.id}/submit`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe('submitted');
        expect(body.hmrcCorrelationId).toBeDefined();
        expect(body.submittedAt).toBeDefined();
      });
    });
  });

  describe('EPS Endpoints', () => {
    describe('POST /api/v1/tax/paye/eps', () => {
      it('should create an EPS submission', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/eps',
          payload: {
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            entityId: '550e8400-e29b-41d4-a716-446655440001',
            registrationId: testRegistrationId,
            taxYear: '2024-25',
            taxMonth: 1,
            noPaymentForPeriod: false,
            smpRecovered: '500.00',
            employmentAllowanceClaim: true,
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.id).toBeDefined();
        expect(body.submissionType).toBe('eps');
        expect(body.taxYear).toBe('2024-25');
        expect(body.status).toBe('draft');
      });

      it('should create EPS for no payment period', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/eps',
          payload: {
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            entityId: '550e8400-e29b-41d4-a716-446655440001',
            registrationId: testRegistrationId,
            taxYear: '2024-25',
            taxMonth: 1,
            noPaymentForPeriod: true,
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.noPaymentForPeriod).toBe(true);
      });
    });
  });

  describe('Employee Tax Record Endpoints', () => {
    describe('POST /api/v1/tax/paye/employees', () => {
      it('should create an employee tax record', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/employees',
          payload: {
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            entityId: '550e8400-e29b-41d4-a716-446655440001',
            employeeId: '550e8400-e29b-41d4-a716-446655440010',
            nationalInsuranceNumber: 'AB123456C',
            taxCode: '1257L',
            niCategory: 'A',
            payFrequency: 'monthly',
            startDate: '2024-01-01T00:00:00.000Z',
            starterDeclaration: 'A',
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.id).toBeDefined();
        expect(body.taxCode).toBe('1257L');
        expect(body.niCategory).toBe('A');
        expect(body.employmentStatus).toBe('active');
        expect(mockEventPublisher.publish).toHaveBeenCalled();
      });

      it('should create employee with student loan', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/employees',
          payload: {
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            entityId: '550e8400-e29b-41d4-a716-446655440001',
            employeeId: '550e8400-e29b-41d4-a716-446655440011',
            nationalInsuranceNumber: 'CD456789E',
            taxCode: '1257L',
            niCategory: 'A',
            studentLoanPlan: 'plan2',
            hasPostgraduateLoan: true,
            payFrequency: 'monthly',
            startDate: '2024-01-01T00:00:00.000Z',
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.studentLoanPlan).toBe('plan2');
        expect(body.hasPostgraduateLoan).toBe(true);
      });
    });

    describe('POST /api/v1/tax/paye/employees/:id/tax-code', () => {
      it('should change employee tax code', async () => {
        // Create employee first
        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/employees',
          payload: {
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            entityId: '550e8400-e29b-41d4-a716-446655440001',
            employeeId: '550e8400-e29b-41d4-a716-446655440010',
            taxCode: '1257L',
            niCategory: 'A',
            startDate: '2024-01-01T00:00:00.000Z',
          },
        });
        const created = JSON.parse(createResponse.body);

        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/tax/paye/employees/${created.id}/tax-code`,
          payload: {
            newTaxCode: 'BR',
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.record.taxCode).toBe('BR');
        expect(body.previousTaxCode).toBe('1257L');
      });
    });

    describe('POST /api/v1/tax/paye/employees/:id/p45', () => {
      it('should issue P45', async () => {
        // Create employee first
        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/employees',
          payload: {
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            entityId: '550e8400-e29b-41d4-a716-446655440001',
            employeeId: '550e8400-e29b-41d4-a716-446655440010',
            taxCode: '1257L',
            niCategory: 'A',
            startDate: '2024-01-01T00:00:00.000Z',
          },
        });
        const created = JSON.parse(createResponse.body);

        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/tax/paye/employees/${created.id}/p45`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.p45Issued).toBe(true);
        expect(body.p45IssuedAt).toBeDefined();
        expect(body.employmentStatus).toBe('terminated');
      });
    });

    describe('POST /api/v1/tax/paye/employees/:id/p60', () => {
      it('should issue P60', async () => {
        // Create employee first
        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/employees',
          payload: {
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            entityId: '550e8400-e29b-41d4-a716-446655440001',
            employeeId: '550e8400-e29b-41d4-a716-446655440010',
            taxCode: '1257L',
            niCategory: 'A',
            startDate: '2024-01-01T00:00:00.000Z',
          },
        });
        const created = JSON.parse(createResponse.body);

        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/tax/paye/employees/${created.id}/p60`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.p60Issued).toBe(true);
        expect(body.p60IssuedAt).toBeDefined();
      });
    });
  });

  describe('Calculation Endpoints', () => {
    describe('POST /api/v1/tax/paye/calculate/ni', () => {
      it('should calculate NI for monthly pay', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/calculate/ni',
          payload: {
            grossPay: '4000',
            payFrequency: 'monthly',
            niCategory: 'A',
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.employeeNI).toBeDefined();
        expect(body.employerNI).toBeDefined();
        expect(body.niablePay).toBe('4000');
        expect(parseFloat(body.employeeNI)).toBeGreaterThan(0);
        expect(parseFloat(body.employerNI)).toBeGreaterThan(0);
      });

      it('should calculate NI for different categories', async () => {
        // Category C - over state pension age (no employee NI)
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/calculate/ni',
          payload: {
            grossPay: '4000',
            payFrequency: 'monthly',
            niCategory: 'C',
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.employeeNI).toBe('0.00');
        expect(parseFloat(body.employerNI)).toBeGreaterThan(0);
      });
    });

    describe('POST /api/v1/tax/paye/calculate/paye', () => {
      it('should calculate PAYE tax', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/calculate/paye',
          payload: {
            grossPay: '4000',
            taxCode: '1257L',
            periodNumber: 1,
            payFrequency: 'monthly',
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.grossPay).toBe('4000.00');
        expect(body.taxablePay).toBeDefined();
        expect(body.taxDeducted).toBeDefined();
        expect(body.breakdown).toBeDefined();
      });

      it('should handle BR tax code', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/calculate/paye',
          payload: {
            grossPay: '4000',
            taxCode: 'BR',
            periodNumber: 1,
            payFrequency: 'monthly',
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        // BR = 20% on all earnings
        expect(parseFloat(body.taxDeducted)).toBeCloseTo(800, 0);
      });

      it('should handle NT tax code (no tax)', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/calculate/paye',
          payload: {
            grossPay: '4000',
            taxCode: 'NT',
            periodNumber: 1,
            payFrequency: 'monthly',
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.taxDeducted).toBe('0.00');
      });
    });

    describe('POST /api/v1/tax/paye/calculate/student-loan', () => {
      it('should calculate student loan deductions', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/calculate/student-loan',
          payload: {
            grossPay: '4000',
            plans: ['plan2'],
            payFrequency: 'monthly',
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.plan2).toBeDefined();
        expect(body.total).toBeDefined();
        expect(parseFloat(body.plan2)).toBeGreaterThanOrEqual(0);
      });

      it('should calculate multiple loan plans', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tax/paye/calculate/student-loan',
          payload: {
            grossPay: '5000',
            plans: ['plan2', 'postgrad'],
            payFrequency: 'monthly',
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.plan2).toBeDefined();
        expect(body.postgrad).toBeDefined();
        expect(parseFloat(body.total)).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
