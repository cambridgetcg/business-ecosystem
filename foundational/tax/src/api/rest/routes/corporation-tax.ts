/**
 * Corporation Tax REST Routes
 *
 * Endpoints for managing Corporation Tax periods and calculations.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  UKTaxRegistrationRepository,
  CorporationTaxRepository,
} from '../../../infrastructure/persistence/repositories/index.js';
import type { EventPublisher } from '../../../infrastructure/messaging/index.js';
import { TaxEventTypes } from '../../../infrastructure/messaging/events.js';
import {
  CreateCTPeriodInputSchema,
  CTProfitInputSchema,
  isValidCTPeriod,
} from '../../../domain/corporation-tax/models/period.js';
import { calculateCTPeriod } from '../../../domain/corporation-tax/services/calculator.js';
import { CT600PreparationService } from '../../../domain/corporation-tax/services/ct600-service.js';

interface RouteContext {
  corporationTaxRepository: CorporationTaxRepository;
  registrationRepository: UKTaxRegistrationRepository;
  eventPublisher?: EventPublisher;
}

export async function corporationTaxRoutes(
  fastify: FastifyInstance,
  context: RouteContext
): Promise<void> {
  const { corporationTaxRepository, registrationRepository, eventPublisher } = context;

  // GET /periods - List CT periods
  fastify.get(
    '/periods',
    {
      schema: {
        description: 'List Corporation Tax periods',
        tags: ['Corporation Tax'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            entityId: { type: 'string', format: 'uuid' },
            registrationId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['draft', 'calculated', 'filed', 'amended', 'paid', 'overdue'] },
            financialYear: { type: 'string', pattern: '^FY\\d{4}$' },
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
      const result = await corporationTaxRepository.findMany(
        {
          tenantId: query.tenantId as string | undefined,
          entityId: query.entityId as string | undefined,
          registrationId: query.registrationId as string | undefined,
          status: query.status as any,
          financialYear: query.financialYear as string | undefined,
        },
        {
          limit: (query.limit as number) || 20,
          offset: (query.offset as number) || 0,
        }
      );
      return reply.send(result);
    }
  );

  // GET /periods/:id - Get period by ID
  fastify.get(
    '/periods/:id',
    {
      schema: {
        description: 'Get Corporation Tax period by ID',
        tags: ['Corporation Tax'],
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
      const period = await corporationTaxRepository.findById(request.params.id);
      if (!period) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Corporation Tax period not found',
        });
      }
      return reply.send(period);
    }
  );

  // POST /periods - Create new period
  fastify.post(
    '/periods',
    {
      schema: {
        description: 'Create Corporation Tax period',
        tags: ['Corporation Tax'],
        body: {
          type: 'object',
          required: ['tenantId', 'entityId', 'registrationId', 'periodStart', 'periodEnd'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            entityId: { type: 'string', format: 'uuid' },
            registrationId: { type: 'string', format: 'uuid' },
            periodStart: { type: 'string', format: 'date-time' },
            periodEnd: { type: 'string', format: 'date-time' },
            associatedCompaniesCount: { type: 'integer', minimum: 0, default: 0 },
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
      const periodStart = new Date(body.periodStart as string);
      const periodEnd = new Date(body.periodEnd as string);

      // Validate period
      if (!isValidCTPeriod(periodStart, periodEnd)) {
        return reply.status(400).send({
          error: 'INVALID_PERIOD',
          message: 'Corporation Tax period cannot exceed 12 months',
        });
      }

      // Verify registration exists
      const registration = await registrationRepository.findById(body.registrationId as string);
      if (!registration) {
        return reply.status(400).send({
          error: 'INVALID_REGISTRATION',
          message: 'UK tax registration not found',
        });
      }

      const input = CreateCTPeriodInputSchema.parse({
        tenantId: body.tenantId,
        entityId: body.entityId,
        registrationId: body.registrationId,
        periodStart,
        periodEnd,
        associatedCompaniesCount: body.associatedCompaniesCount || 0,
        metadata: body.metadata,
      });

      const period = await corporationTaxRepository.create(input);

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.CT_PERIOD_CREATED, period.id, {
          periodId: period.id,
          tenantId: period.tenantId,
          entityId: period.entityId,
          periodStart: period.periodStart.toISOString(),
          periodEnd: period.periodEnd.toISOString(),
          financialYear: period.financialYear,
          filingDeadline: period.filingDeadline.toISOString(),
          paymentDeadline: period.paymentDeadline.toISOString(),
        });
      }

      return reply.status(201).send(period);
    }
  );

  // POST /periods/:id/calculate - Calculate CT liability
  fastify.post(
    '/periods/:id/calculate',
    {
      schema: {
        description: 'Calculate Corporation Tax liability for period',
        tags: ['Corporation Tax'],
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
            tradingProfits: { type: 'string', default: '0' },
            tradingLossesBroughtForward: { type: 'string', default: '0' },
            tradingLossesCarriedBack: { type: 'string', default: '0' },
            investmentIncome: { type: 'string', default: '0' },
            propertyIncome: { type: 'string', default: '0' },
            otherIncome: { type: 'string', default: '0' },
            chargeableGains: { type: 'string', default: '0' },
            capitalLossesBroughtForward: { type: 'string', default: '0' },
            tradingLossesRelief: { type: 'string', default: '0' },
            groupRelief: { type: 'string', default: '0' },
            managementExpenses: { type: 'string', default: '0' },
            qualifyingCharitableDonations: { type: 'string', default: '0' },
            rdTaxCredits: { type: 'string' },
            foreignTaxCredit: { type: 'string' },
            otherCredits: { type: 'string' },
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
      // Get existing period
      const existingPeriod = await corporationTaxRepository.findById(request.params.id);
      if (!existingPeriod) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Corporation Tax period not found',
        });
      }

      const body = request.body as Record<string, unknown>;
      const profitInput = CTProfitInputSchema.parse({
        periodId: request.params.id,
        tradingProfits: body.tradingProfits || '0',
        tradingLossesBroughtForward: body.tradingLossesBroughtForward || '0',
        tradingLossesCarriedBack: body.tradingLossesCarriedBack || '0',
        investmentIncome: body.investmentIncome || '0',
        propertyIncome: body.propertyIncome || '0',
        otherIncome: body.otherIncome || '0',
        chargeableGains: body.chargeableGains || '0',
        capitalLossesBroughtForward: body.capitalLossesBroughtForward || '0',
        tradingLossesRelief: body.tradingLossesRelief || '0',
        groupRelief: body.groupRelief || '0',
        managementExpenses: body.managementExpenses || '0',
        qualifyingCharitableDonations: body.qualifyingCharitableDonations || '0',
        rdTaxCredits: body.rdTaxCredits as string | undefined,
        foreignTaxCredit: body.foreignTaxCredit as string | undefined,
        otherCredits: body.otherCredits as string | undefined,
      });

      // Calculate CT
      const result = calculateCTPeriod(profitInput, existingPeriod.associatedCompaniesCount);

      // Update period with calculation results
      const period = await corporationTaxRepository.updateCalculation(request.params.id, {
        tradingProfits: profitInput.tradingProfits,
        investmentIncome: profitInput.investmentIncome,
        propertyIncome: profitInput.propertyIncome,
        otherIncome: profitInput.otherIncome,
        chargeableGains: profitInput.chargeableGains,
        tradingLossesRelief: profitInput.tradingLossesRelief,
        groupRelief: profitInput.groupRelief,
        managementExpenses: profitInput.managementExpenses,
        qualifyingCharitableDonations: profitInput.qualifyingCharitableDonations,
        totalProfitsBeforeDeductions: result.totalProfitsBeforeDeductions,
        profitsChargeableToCT: result.profitsChargeableToCT,
        smallProfitsRateAmount: result.smallProfitsRateAmount,
        mainRateAmount: result.mainRateAmount,
        marginalReliefAmount: result.marginalReliefAmount,
        effectiveRate: result.effectiveRate,
        corporationTaxLiability: result.corporationTaxLiability,
        taxDue: result.taxDue,
        rdTaxCredits: profitInput.rdTaxCredits,
        foreignTaxCredit: profitInput.foreignTaxCredit,
        otherCredits: profitInput.otherCredits,
      });

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.CT_PERIOD_CALCULATED, period.id, {
          periodId: period.id,
          tenantId: period.tenantId,
          entityId: period.entityId,
          profitsChargeableToCT: result.profitsChargeableToCT,
          corporationTaxLiability: result.corporationTaxLiability,
          effectiveRate: result.effectiveRate,
          rateApplied: result.rateApplied,
          marginalRelief: result.marginalReliefAmount,
        });
      }

      return reply.send({
        period,
        calculation: result,
      });
    }
  );

  // POST /periods/:id/file - Mark as filed
  fastify.post(
    '/periods/:id/file',
    {
      schema: {
        description: 'Mark Corporation Tax period as filed',
        tags: ['Corporation Tax'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['hmrcSubmissionId', 'hmrcReceiptNumber'],
          properties: {
            hmrcSubmissionId: { type: 'string', maxLength: 100 },
            hmrcReceiptNumber: { type: 'string', maxLength: 100 },
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
        const period = await corporationTaxRepository.markAsFiled(
          request.params.id,
          body.hmrcSubmissionId as string,
          body.hmrcReceiptNumber as string
        );

        if (eventPublisher) {
          await eventPublisher.publish(TaxEventTypes.CT_PERIOD_FILED, period.id, {
            periodId: period.id,
            tenantId: period.tenantId,
            entityId: period.entityId,
            filedAt: period.filedAt!.toISOString(),
            hmrcSubmissionId: period.hmrcSubmissionId!,
            hmrcReceiptNumber: period.hmrcReceiptNumber!,
          });
        }

        return reply.send(period);
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Corporation Tax period not found',
          });
        }
        throw error;
      }
    }
  );

  // POST /periods/:id/pay - Record payment
  fastify.post(
    '/periods/:id/pay',
    {
      schema: {
        description: 'Record Corporation Tax payment',
        tags: ['Corporation Tax'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['amount'],
          properties: {
            amount: { type: 'string' },
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
        const period = await corporationTaxRepository.recordPayment(
          request.params.id,
          body.amount as string
        );

        if (period.status === 'paid' && eventPublisher) {
          await eventPublisher.publish(TaxEventTypes.CT_PERIOD_PAID, period.id, {
            periodId: period.id,
            tenantId: period.tenantId,
            entityId: period.entityId,
            taxDue: period.taxDue,
            taxPaid: period.taxPaid,
            paidAt: period.paidAt!.toISOString(),
          });
        }

        return reply.send(period);
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Corporation Tax period not found',
          });
        }
        throw error;
      }
    }
  );

  // POST /periods/:id/ct600 - Prepare CT600 return data
  fastify.post(
    '/periods/:id/ct600',
    {
      schema: {
        description: 'Prepare CT600 return data for HMRC filing',
        tags: ['Corporation Tax'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['companyInfo', 'declarant'],
          properties: {
            companyInfo: {
              type: 'object',
              required: ['companyName', 'utr', 'registeredOffice'],
              properties: {
                companyName: { type: 'string', maxLength: 160 },
                utr: { type: 'string', minLength: 10, maxLength: 10 },
                registrationNumber: { type: 'string', maxLength: 10 },
                registeredOffice: { type: 'string', maxLength: 500 },
                tradingName: { type: 'string', maxLength: 160 },
                taxReference: { type: 'string', maxLength: 20 },
              },
            },
            declarant: {
              type: 'object',
              required: ['name', 'status'],
              properties: {
                name: { type: 'string', maxLength: 100 },
                status: {
                  type: 'string',
                  enum: ['director', 'company_secretary', 'agent', 'liquidator', 'administrator'],
                },
              },
            },
            includeComputations: { type: 'boolean', default: true },
            includeAccounts: { type: 'boolean', default: false },
            supplementaryPages: {
              type: 'object',
              properties: {
                ct600c: {
                  type: 'object',
                  properties: {
                    groupReliefSurrendered: { type: 'string' },
                    consortiumRelief: { type: 'boolean' },
                  },
                },
                ct600j: {
                  type: 'object',
                  properties: {
                    smeScheme: { type: 'boolean' },
                    rdecScheme: { type: 'boolean' },
                    qualifyingRDExpenditure: { type: 'string' },
                  },
                },
                ct600l: {
                  type: 'object',
                  properties: {
                    lossesArisingInPeriod: { type: 'string' },
                    lossesCarriedForward: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ct600: { type: 'object' },
              validation: {
                type: 'object',
                properties: {
                  valid: { type: 'boolean' },
                  errors: { type: 'array' },
                  warnings: { type: 'array' },
                },
              },
              computations: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
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
      const period = await corporationTaxRepository.findById(request.params.id);
      if (!period) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Corporation Tax period not found',
        });
      }

      if (period.status === 'draft') {
        return reply.status(400).send({
          error: 'INVALID_STATE',
          message: 'Period must be calculated before preparing CT600',
        });
      }

      const body = request.body as Record<string, unknown>;
      const ct600Service = new CT600PreparationService();

      try {
        const ct600 = ct600Service.prepareCT600({
          period,
          companyInfo: body.companyInfo as any,
          declarant: body.declarant as any,
          supplementaryPages: body.supplementaryPages as any,
          includeComputations: body.includeComputations as boolean ?? true,
          includeAccounts: body.includeAccounts as boolean ?? false,
        });

        const validation = ct600Service.validateCT600(ct600);
        const computations = body.includeComputations !== false
          ? ct600Service.generateComputations(ct600)
          : undefined;

        return reply.send({
          ct600,
          validation,
          computations,
        });
      } catch (error: any) {
        return reply.status(400).send({
          error: 'PREPARATION_ERROR',
          message: error.message || 'Failed to prepare CT600',
        });
      }
    }
  );

  // DELETE /periods/:id - Delete period
  fastify.delete(
    '/periods/:id',
    {
      schema: {
        description: 'Delete Corporation Tax period (soft delete)',
        tags: ['Corporation Tax'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await corporationTaxRepository.delete(request.params.id);
      return reply.status(204).send();
    }
  );
}
