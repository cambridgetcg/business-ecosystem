/**
 * PAYE REST Routes
 *
 * Endpoints for managing PAYE submissions (FPS/EPS) and employee tax records.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  UKTaxRegistrationRepository,
  PAYESubmissionRepository,
  EmployeeTaxRecordRepository,
} from '../../../infrastructure/persistence/repositories/index.js';
import type { EventPublisher } from '../../../infrastructure/messaging/index.js';
import { TaxEventTypes } from '../../../infrastructure/messaging/events.js';
import {
  CreateFPSInputSchema,
  CreateEPSInputSchema,
  getFPSDeadline,
  getEPSDeadline,
} from '../../../domain/paye/models/submission.js';
import {
  CreateEmployeeTaxRecordInputSchema,
  UpdateEmployeeTaxRecordInputSchema,
} from '../../../domain/paye/models/employee.js';
import {
  calculatePayroll,
  calculatePeriodNI,
  calculatePAYE,
  calculateStudentLoan,
} from '../../../domain/paye/services/calculator.js';

interface RouteContext {
  payeSubmissionRepository: PAYESubmissionRepository;
  employeeTaxRecordRepository: EmployeeTaxRecordRepository;
  registrationRepository: UKTaxRegistrationRepository;
  eventPublisher?: EventPublisher;
}

export async function payeRoutes(
  fastify: FastifyInstance,
  context: RouteContext
): Promise<void> {
  const { payeSubmissionRepository, employeeTaxRecordRepository, registrationRepository, eventPublisher } = context;

  // ==========================================================================
  // FPS (Full Payment Submission) Endpoints
  // ==========================================================================

  // GET /fps - List FPS submissions
  fastify.get(
    '/fps',
    {
      schema: {
        description: 'List FPS submissions',
        tags: ['PAYE'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            entityId: { type: 'string', format: 'uuid' },
            registrationId: { type: 'string', format: 'uuid' },
            taxYear: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
            taxMonth: { type: 'integer', minimum: 1, maximum: 12 },
            status: { type: 'string', enum: ['draft', 'validated', 'submitted', 'acknowledged', 'error', 'superseded'] },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array' },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, unknown>;
      const result = await payeSubmissionRepository.findMany(
        {
          tenantId: query.tenantId as string | undefined,
          entityId: query.entityId as string | undefined,
          registrationId: query.registrationId as string | undefined,
          submissionType: 'fps',
          status: query.status as any,
          taxYear: query.taxYear as string | undefined,
          taxMonth: query.taxMonth as number | undefined,
        },
        {
          limit: (query.limit as number) || 20,
          offset: (query.offset as number) || 0,
        }
      );
      return reply.send(result);
    }
  );

  // GET /fps/:id - Get FPS by ID
  fastify.get(
    '/fps/:id',
    {
      schema: {
        description: 'Get FPS submission by ID',
        tags: ['PAYE'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const submission = await payeSubmissionRepository.findById(request.params.id);
      if (!submission || submission.submissionType !== 'fps') {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'FPS submission not found',
        });
      }
      return reply.send(submission);
    }
  );

  // POST /fps - Create new FPS
  fastify.post(
    '/fps',
    {
      schema: {
        description: 'Create FPS submission',
        tags: ['PAYE'],
        body: {
          type: 'object',
          required: ['tenantId', 'entityId', 'registrationId', 'taxYear', 'taxMonth', 'paymentDate', 'payFrequency', 'employeePayments'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            entityId: { type: 'string', format: 'uuid' },
            registrationId: { type: 'string', format: 'uuid' },
            taxYear: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
            taxMonth: { type: 'integer', minimum: 1, maximum: 12 },
            paymentDate: { type: 'string', format: 'date-time' },
            payFrequency: { type: 'string', enum: ['weekly', 'fortnightly', 'four_weekly', 'monthly'] },
            employeePayments: {
              type: 'array',
              items: {
                type: 'object',
                required: ['employeeId', 'grossPay', 'taxDeducted', 'employeeNI', 'employerNI'],
                properties: {
                  employeeId: { type: 'string', format: 'uuid' },
                  grossPay: { type: 'string' },
                  taxDeducted: { type: 'string' },
                  employeeNI: { type: 'string' },
                  employerNI: { type: 'string' },
                  studentLoan: { type: 'string' },
                  postgraduateLoan: { type: 'string' },
                },
              },
            },
            metadata: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object' },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;

      // Verify registration exists and has PAYE
      const registration = await registrationRepository.findById(body.registrationId as string);
      if (!registration) {
        return reply.status(400).send({
          error: 'INVALID_REGISTRATION',
          message: 'UK tax registration not found',
        });
      }
      if (!registration.payeRegistered) {
        return reply.status(400).send({
          error: 'PAYE_NOT_REGISTERED',
          message: 'PAYE registration required before submitting FPS',
        });
      }

      const input = CreateFPSInputSchema.parse({
        tenantId: body.tenantId,
        entityId: body.entityId,
        registrationId: body.registrationId,
        taxYear: body.taxYear,
        taxMonth: body.taxMonth,
        paymentDate: new Date(body.paymentDate as string),
        payFrequency: body.payFrequency,
        employeePayments: body.employeePayments,
        metadata: body.metadata,
      });

      const submission = await payeSubmissionRepository.createFPS(input);

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.PAYE_FPS_CREATED, submission.id, {
          submissionId: submission.id,
          tenantId: submission.tenantId,
          entityId: submission.entityId,
          submissionType: 'fps',
          taxYear: submission.taxYear,
          taxMonth: submission.taxMonth,
          employeeCount: (submission as any).employeeCount,
          totalPay: (submission as any).totalPayInPeriod,
          totalTax: (submission as any).totalTaxDeducted,
          totalNI: (submission as any).totalEmployeeNI,
        });
      }

      return reply.status(201).send(submission);
    }
  );

  // POST /fps/:id/submit - Submit FPS to HMRC
  fastify.post(
    '/fps/:id/submit',
    {
      schema: {
        description: 'Submit FPS to HMRC',
        tags: ['PAYE'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const submission = await payeSubmissionRepository.findById(request.params.id);
      if (!submission || submission.submissionType !== 'fps') {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'FPS submission not found',
        });
      }

      // In a real implementation, this would call the HMRC RTI API
      // For now, we simulate a successful submission
      const correlationId = `RTI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const updated = await payeSubmissionRepository.markAsSubmitted(
        request.params.id,
        correlationId
      );

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.PAYE_FPS_SUBMITTED, updated.id, {
          submissionId: updated.id,
          tenantId: updated.tenantId,
          entityId: updated.entityId,
          submissionType: 'fps',
          taxYear: updated.taxYear,
          taxMonth: updated.taxMonth,
          submittedAt: updated.submittedAt!.toISOString(),
          hmrcCorrelationId: correlationId,
        });
      }

      return reply.send(updated);
    }
  );

  // ==========================================================================
  // EPS (Employer Payment Summary) Endpoints
  // ==========================================================================

  // GET /eps - List EPS submissions
  fastify.get(
    '/eps',
    {
      schema: {
        description: 'List EPS submissions',
        tags: ['PAYE'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            entityId: { type: 'string', format: 'uuid' },
            registrationId: { type: 'string', format: 'uuid' },
            taxYear: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
            taxMonth: { type: 'integer', minimum: 1, maximum: 12 },
            status: { type: 'string', enum: ['draft', 'validated', 'submitted', 'acknowledged', 'error', 'superseded'] },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array' },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, unknown>;
      const result = await payeSubmissionRepository.findMany(
        {
          tenantId: query.tenantId as string | undefined,
          entityId: query.entityId as string | undefined,
          registrationId: query.registrationId as string | undefined,
          submissionType: 'eps',
          status: query.status as any,
          taxYear: query.taxYear as string | undefined,
          taxMonth: query.taxMonth as number | undefined,
        },
        {
          limit: (query.limit as number) || 20,
          offset: (query.offset as number) || 0,
        }
      );
      return reply.send(result);
    }
  );

  // GET /eps/:id - Get EPS by ID
  fastify.get(
    '/eps/:id',
    {
      schema: {
        description: 'Get EPS submission by ID',
        tags: ['PAYE'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const submission = await payeSubmissionRepository.findById(request.params.id);
      if (!submission || submission.submissionType !== 'eps') {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'EPS submission not found',
        });
      }
      return reply.send(submission);
    }
  );

  // POST /eps - Create new EPS
  fastify.post(
    '/eps',
    {
      schema: {
        description: 'Create EPS submission',
        tags: ['PAYE'],
        body: {
          type: 'object',
          required: ['tenantId', 'entityId', 'registrationId', 'taxYear', 'taxMonth'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            entityId: { type: 'string', format: 'uuid' },
            registrationId: { type: 'string', format: 'uuid' },
            taxYear: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
            taxMonth: { type: 'integer', minimum: 1, maximum: 12 },
            noPaymentForPeriod: { type: 'boolean', default: false },
            smpRecovered: { type: 'string' },
            sppRecovered: { type: 'string' },
            sapRecovered: { type: 'string' },
            shppRecovered: { type: 'string' },
            nicCompensation: { type: 'string' },
            cisDeductionsSuffered: { type: 'string' },
            employmentAllowanceClaim: { type: 'boolean', default: false },
            finalSubmissionForYear: { type: 'boolean', default: false },
            metadata: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object' },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;

      // Verify registration exists and has PAYE
      const registration = await registrationRepository.findById(body.registrationId as string);
      if (!registration) {
        return reply.status(400).send({
          error: 'INVALID_REGISTRATION',
          message: 'UK tax registration not found',
        });
      }
      if (!registration.payeRegistered) {
        return reply.status(400).send({
          error: 'PAYE_NOT_REGISTERED',
          message: 'PAYE registration required before submitting EPS',
        });
      }

      const input = CreateEPSInputSchema.parse({
        tenantId: body.tenantId,
        entityId: body.entityId,
        registrationId: body.registrationId,
        taxYear: body.taxYear,
        taxMonth: body.taxMonth,
        noPaymentForPeriod: body.noPaymentForPeriod,
        smpRecovered: body.smpRecovered,
        sppRecovered: body.sppRecovered,
        sapRecovered: body.sapRecovered,
        shppRecovered: body.shppRecovered,
        nicCompensation: body.nicCompensation,
        cisDeductionsSuffered: body.cisDeductionsSuffered,
        employmentAllowanceClaim: body.employmentAllowanceClaim,
        finalSubmissionForYear: body.finalSubmissionForYear,
        metadata: body.metadata,
      });

      const submission = await payeSubmissionRepository.createEPS(input);

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.PAYE_EPS_CREATED, submission.id, {
          submissionId: submission.id,
          tenantId: submission.tenantId,
          entityId: submission.entityId,
          submissionType: 'eps',
          taxYear: submission.taxYear,
          taxMonth: submission.taxMonth,
        });
      }

      return reply.status(201).send(submission);
    }
  );

  // POST /eps/:id/submit - Submit EPS to HMRC
  fastify.post(
    '/eps/:id/submit',
    {
      schema: {
        description: 'Submit EPS to HMRC',
        tags: ['PAYE'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const submission = await payeSubmissionRepository.findById(request.params.id);
      if (!submission || submission.submissionType !== 'eps') {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'EPS submission not found',
        });
      }

      // In a real implementation, this would call the HMRC RTI API
      const correlationId = `RTI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const updated = await payeSubmissionRepository.markAsSubmitted(
        request.params.id,
        correlationId
      );

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.PAYE_EPS_SUBMITTED, updated.id, {
          submissionId: updated.id,
          tenantId: updated.tenantId,
          entityId: updated.entityId,
          submissionType: 'eps',
          taxYear: updated.taxYear,
          taxMonth: updated.taxMonth,
          submittedAt: updated.submittedAt!.toISOString(),
          hmrcCorrelationId: correlationId,
        });
      }

      return reply.send(updated);
    }
  );

  // ==========================================================================
  // Employee Tax Record Endpoints
  // ==========================================================================

  // GET /employees - List employee tax records
  fastify.get(
    '/employees',
    {
      schema: {
        description: 'List employee tax records',
        tags: ['Employees'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            entityId: { type: 'string', format: 'uuid' },
            taxYear: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
            employmentStatus: { type: 'string', enum: ['active', 'on_leave', 'terminated', 'suspended'] },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array' },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, unknown>;
      const result = await employeeTaxRecordRepository.findMany(
        {
          tenantId: query.tenantId as string | undefined,
          entityId: query.entityId as string | undefined,
          taxYear: query.taxYear as string | undefined,
          employmentStatus: query.employmentStatus as any,
        },
        {
          limit: (query.limit as number) || 20,
          offset: (query.offset as number) || 0,
        }
      );
      return reply.send(result);
    }
  );

  // GET /employees/:id - Get employee tax record by ID
  fastify.get(
    '/employees/:id',
    {
      schema: {
        description: 'Get employee tax record by ID',
        tags: ['Employees'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const record = await employeeTaxRecordRepository.findById(request.params.id);
      if (!record) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Employee tax record not found',
        });
      }
      return reply.send(record);
    }
  );

  // POST /employees - Create employee tax record
  fastify.post(
    '/employees',
    {
      schema: {
        description: 'Create employee tax record',
        tags: ['Employees'],
        body: {
          type: 'object',
          required: ['tenantId', 'entityId', 'employeeId', 'startDate'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            entityId: { type: 'string', format: 'uuid' },
            employeeId: { type: 'string', format: 'uuid' },
            nationalInsuranceNumber: { type: 'string', pattern: '^[A-Z]{2}[0-9]{6}[A-Z]$' },
            taxCode: { type: 'string', default: '1257L' },
            niCategory: { type: 'string', enum: ['A', 'B', 'C', 'F', 'H', 'I', 'J', 'L', 'M', 'S', 'V', 'Z'], default: 'A' },
            isDirector: { type: 'boolean', default: false },
            directorNIMethod: { type: 'string', enum: ['annual', 'alternative'] },
            studentLoanPlan: { type: 'string', enum: ['plan1', 'plan2', 'plan4', 'plan5', 'postgrad'] },
            hasPostgraduateLoan: { type: 'boolean', default: false },
            payFrequency: { type: 'string', enum: ['weekly', 'fortnightly', 'four_weekly', 'monthly'], default: 'monthly' },
            payrollId: { type: 'string', maxLength: 35 },
            startDate: { type: 'string', format: 'date-time' },
            starterDeclaration: { type: 'string', enum: ['A', 'B', 'C'] },
            p45Details: {
              type: 'object',
              properties: {
                previousEmployer: { type: 'string' },
                taxCodeAtLeaving: { type: 'string' },
                lastPayDate: { type: 'string', format: 'date-time' },
                totalPayToDate: { type: 'string' },
                totalTaxToDate: { type: 'string' },
              },
            },
            metadata: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object' },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;

      const input = CreateEmployeeTaxRecordInputSchema.parse({
        tenantId: body.tenantId,
        entityId: body.entityId,
        employeeId: body.employeeId,
        nationalInsuranceNumber: body.nationalInsuranceNumber,
        taxCode: body.taxCode,
        niCategory: body.niCategory,
        isDirector: body.isDirector,
        directorNIMethod: body.directorNIMethod,
        studentLoanPlan: body.studentLoanPlan,
        hasPostgraduateLoan: body.hasPostgraduateLoan,
        payFrequency: body.payFrequency,
        payrollId: body.payrollId,
        startDate: new Date(body.startDate as string),
        starterDeclaration: body.starterDeclaration,
        p45Details: body.p45Details,
        metadata: body.metadata,
      });

      const record = await employeeTaxRecordRepository.create(input);

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.EMPLOYEE_TAX_RECORD_CREATED, record.id, {
          employeeId: record.employeeId,
          tenantId: record.tenantId,
          entityId: record.entityId,
          taxCode: record.taxCode,
          niCategory: record.niCategory,
        });
      }

      return reply.status(201).send(record);
    }
  );

  // PATCH /employees/:id - Update employee tax record
  fastify.patch(
    '/employees/:id',
    {
      schema: {
        description: 'Update employee tax record',
        tags: ['Employees'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            taxCode: { type: 'string' },
            niCategory: { type: 'string', enum: ['A', 'B', 'C', 'F', 'H', 'I', 'J', 'L', 'M', 'S', 'V', 'Z'] },
            studentLoanPlan: { type: 'string', enum: ['plan1', 'plan2', 'plan4', 'plan5', 'postgrad'], nullable: true },
            hasPostgraduateLoan: { type: 'boolean' },
            payFrequency: { type: 'string', enum: ['weekly', 'fortnightly', 'four_weekly', 'monthly'] },
            week1Month1Basis: { type: 'boolean' },
            irregularPaymentPattern: { type: 'boolean' },
            offPayrollWorker: { type: 'boolean' },
            leaveDate: { type: 'string', format: 'date-time' },
            metadata: { type: 'object' },
          },
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;

      const existing = await employeeTaxRecordRepository.findById(request.params.id);
      if (!existing) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Employee tax record not found',
        });
      }

      const input = UpdateEmployeeTaxRecordInputSchema.parse({
        taxCode: body.taxCode,
        niCategory: body.niCategory,
        studentLoanPlan: body.studentLoanPlan,
        hasPostgraduateLoan: body.hasPostgraduateLoan,
        payFrequency: body.payFrequency,
        week1Month1Basis: body.week1Month1Basis,
        irregularPaymentPattern: body.irregularPaymentPattern,
        offPayrollWorker: body.offPayrollWorker,
        leaveDate: body.leaveDate ? new Date(body.leaveDate as string) : undefined,
        metadata: body.metadata as Record<string, unknown> | undefined,
      });

      const record = await employeeTaxRecordRepository.update(request.params.id, input);

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.EMPLOYEE_TAX_RECORD_UPDATED, record.id, {
          employeeId: record.employeeId,
          tenantId: record.tenantId,
          entityId: record.entityId,
        });
      }

      return reply.send(record);
    }
  );

  // POST /employees/:id/tax-code - Change tax code
  fastify.post(
    '/employees/:id/tax-code',
    {
      schema: {
        description: 'Change employee tax code',
        tags: ['Employees'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['newTaxCode'],
          properties: {
            newTaxCode: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;

      try {
        const { record, previousTaxCode } = await employeeTaxRecordRepository.changeTaxCode(
          request.params.id,
          body.newTaxCode as string
        );

        if (eventPublisher) {
          await eventPublisher.publish(TaxEventTypes.EMPLOYEE_TAX_CODE_CHANGED, record.id, {
            employeeId: record.employeeId,
            tenantId: record.tenantId,
            entityId: record.entityId,
            previousTaxCode,
            newTaxCode: record.taxCode,
            effectiveDate: new Date().toISOString(),
          });
        }

        return reply.send({ record, previousTaxCode });
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Employee tax record not found',
          });
        }
        throw error;
      }
    }
  );

  // POST /employees/:id/p45 - Issue P45
  fastify.post(
    '/employees/:id/p45',
    {
      schema: {
        description: 'Issue P45 for employee',
        tags: ['Employees'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const record = await employeeTaxRecordRepository.issueP45(request.params.id);

        if (eventPublisher) {
          await eventPublisher.publish(TaxEventTypes.EMPLOYEE_P45_ISSUED, record.id, {
            employeeId: record.employeeId,
            tenantId: record.tenantId,
            entityId: record.entityId,
            taxYear: record.taxYear,
            grossPayYTD: record.grossPayYTD,
            taxPaidYTD: record.taxPaidYTD,
            issuedAt: record.p45IssuedAt!.toISOString(),
          });
        }

        return reply.send(record);
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Employee tax record not found',
          });
        }
        throw error;
      }
    }
  );

  // POST /employees/:id/p60 - Issue P60
  fastify.post(
    '/employees/:id/p60',
    {
      schema: {
        description: 'Issue P60 for employee',
        tags: ['Employees'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const record = await employeeTaxRecordRepository.issueP60(request.params.id);

        if (eventPublisher) {
          await eventPublisher.publish(TaxEventTypes.EMPLOYEE_P60_ISSUED, record.id, {
            employeeId: record.employeeId,
            tenantId: record.tenantId,
            entityId: record.entityId,
            taxYear: record.taxYear,
            grossPayYTD: record.grossPayYTD,
            taxPaidYTD: record.taxPaidYTD,
            employeeNIYTD: record.employeeNIYTD,
            issuedAt: record.p60IssuedAt!.toISOString(),
          });
        }

        return reply.send(record);
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Employee tax record not found',
          });
        }
        throw error;
      }
    }
  );

  // ==========================================================================
  // Calculation Endpoints
  // ==========================================================================

  // POST /calculate/ni - Calculate NI for a period
  fastify.post(
    '/calculate/ni',
    {
      schema: {
        description: 'Calculate National Insurance for a pay period',
        tags: ['PAYE'],
        body: {
          type: 'object',
          required: ['grossPay', 'payFrequency'],
          properties: {
            grossPay: { type: 'string' },
            payFrequency: { type: 'string', enum: ['weekly', 'fortnightly', 'four_weekly', 'monthly'] },
            niCategory: { type: 'string', enum: ['A', 'B', 'C', 'F', 'H', 'I', 'J', 'L', 'M', 'S', 'V', 'Z'], default: 'A' },
          },
        },
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;

      const result = calculatePeriodNI(
        body.grossPay as string,
        body.payFrequency as any,
        (body.niCategory as any) || 'A'
      );

      return reply.send(result);
    }
  );

  // POST /calculate/paye - Calculate PAYE for a period
  fastify.post(
    '/calculate/paye',
    {
      schema: {
        description: 'Calculate PAYE tax for a pay period',
        tags: ['PAYE'],
        body: {
          type: 'object',
          required: ['grossPay', 'taxCode', 'periodNumber'],
          properties: {
            grossPay: { type: 'string' },
            taxCode: { type: 'string' },
            periodNumber: { type: 'integer', minimum: 1, maximum: 52 },
            taxPaidToDate: { type: 'string', default: '0' },
            taxablePayToDate: { type: 'string', default: '0' },
            payFrequency: { type: 'string', enum: ['weekly', 'fortnightly', 'four_weekly', 'monthly'], default: 'monthly' },
            useWeek1Month1: { type: 'boolean', default: false },
          },
        },
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;

      const result = calculatePAYE(
        body.grossPay as string,
        body.taxCode as string,
        body.periodNumber as number,
        (body.taxPaidToDate as string) || '0',
        (body.taxablePayToDate as string) || '0',
        (body.payFrequency as any) || 'monthly',
        (body.useWeek1Month1 as boolean) || false
      );

      return reply.send(result);
    }
  );

  // POST /calculate/student-loan - Calculate student loan deductions
  fastify.post(
    '/calculate/student-loan',
    {
      schema: {
        description: 'Calculate student loan deductions for a pay period',
        tags: ['PAYE'],
        body: {
          type: 'object',
          required: ['grossPay', 'plans'],
          properties: {
            grossPay: { type: 'string' },
            plans: {
              type: 'array',
              items: { type: 'string', enum: ['plan1', 'plan2', 'plan4', 'plan5', 'postgrad'] },
            },
            payFrequency: { type: 'string', enum: ['weekly', 'fortnightly', 'four_weekly', 'monthly'], default: 'monthly' },
          },
        },
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;

      const result = calculateStudentLoan(
        body.grossPay as string,
        body.plans as any[],
        (body.payFrequency as any) || 'monthly'
      );

      return reply.send(result);
    }
  );
}
