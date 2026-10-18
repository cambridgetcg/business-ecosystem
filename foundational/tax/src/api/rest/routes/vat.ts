/**
 * VAT REST Routes
 *
 * Endpoints for managing VAT returns (MTD compliant).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  UKTaxRegistrationRepository,
  VATReturnRepository,
} from '../../../infrastructure/persistence/repositories/index.js';
import type { EventPublisher } from '../../../infrastructure/messaging/index.js';
import { TaxEventTypes } from '../../../infrastructure/messaging/events.js';
import {
  CreateVATReturnInputSchema,
  VATTransactionSchema,
  MTD_VAT_DECLARATION,
} from '../../../domain/vat/models/return.js';
import {
  calculateVATReturn,
  calculateFlatRateVATReturn,
  getVATLiabilitySummary,
  validateVATBoxes,
} from '../../../domain/vat/services/calculator.js';
import type { VATSubmissionService } from '../../../infrastructure/hmrc/index.js';
import Decimal from 'decimal.js';

interface RouteContext {
  vatReturnRepository: VATReturnRepository;
  registrationRepository: UKTaxRegistrationRepository;
  eventPublisher?: EventPublisher;
  vatSubmissionService?: VATSubmissionService;
}

export async function vatRoutes(
  fastify: FastifyInstance,
  context: RouteContext
): Promise<void> {
  const { vatReturnRepository, registrationRepository, eventPublisher, vatSubmissionService } = context;

  // GET /returns - List VAT returns
  fastify.get(
    '/returns',
    {
      schema: {
        description: 'List VAT returns',
        tags: ['VAT'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            entityId: { type: 'string', format: 'uuid' },
            registrationId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['draft', 'calculated', 'submitted', 'acknowledged', 'error', 'amended'] },
            periodKey: { type: 'string' },
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
      const result = await vatReturnRepository.findMany(
        {
          tenantId: query.tenantId as string | undefined,
          entityId: query.entityId as string | undefined,
          registrationId: query.registrationId as string | undefined,
          status: query.status as any,
          periodKey: query.periodKey as string | undefined,
        },
        {
          limit: (query.limit as number) || 20,
          offset: (query.offset as number) || 0,
        }
      );
      return reply.send(result);
    }
  );

  // GET /returns/:id - Get return by ID
  fastify.get(
    '/returns/:id',
    {
      schema: {
        description: 'Get VAT return by ID',
        tags: ['VAT'],
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
      const vatReturn = await vatReturnRepository.findById(request.params.id);
      if (!vatReturn) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'VAT return not found',
        });
      }
      return reply.send(vatReturn);
    }
  );

  // POST /returns - Create VAT return
  fastify.post(
    '/returns',
    {
      schema: {
        description: 'Create VAT return',
        tags: ['VAT'],
        body: {
          type: 'object',
          required: ['tenantId', 'entityId', 'registrationId', 'periodStart', 'periodEnd'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            entityId: { type: 'string', format: 'uuid' },
            registrationId: { type: 'string', format: 'uuid' },
            periodStart: { type: 'string', format: 'date-time' },
            periodEnd: { type: 'string', format: 'date-time' },
            periodKey: { type: 'string', maxLength: 10 },
            flatRateScheme: { type: 'boolean', default: false },
            flatRatePercentage: { type: 'string' },
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

      // Verify registration exists and is VAT registered
      const registration = await registrationRepository.findById(body.registrationId as string);
      if (!registration) {
        return reply.status(400).send({
          error: 'INVALID_REGISTRATION',
          message: 'UK tax registration not found',
        });
      }
      if (!registration.vatRegistered) {
        return reply.status(400).send({
          error: 'NOT_VAT_REGISTERED',
          message: 'Entity is not registered for VAT',
        });
      }

      const input = CreateVATReturnInputSchema.parse({
        tenantId: body.tenantId,
        entityId: body.entityId,
        registrationId: body.registrationId,
        periodStart: new Date(body.periodStart as string),
        periodEnd: new Date(body.periodEnd as string),
        periodKey: body.periodKey,
        flatRateScheme: body.flatRateScheme || false,
        flatRatePercentage: body.flatRatePercentage,
        metadata: body.metadata,
      });

      const vatReturn = await vatReturnRepository.create(input);

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.VAT_RETURN_CREATED, vatReturn.id, {
          returnId: vatReturn.id,
          tenantId: vatReturn.tenantId,
          entityId: vatReturn.entityId,
          periodKey: vatReturn.periodKey,
          periodStart: vatReturn.periodStart.toISOString(),
          periodEnd: vatReturn.periodEnd.toISOString(),
          submissionDeadline: vatReturn.submissionDeadline.toISOString(),
        });
      }

      return reply.status(201).send(vatReturn);
    }
  );

  // POST /returns/:id/calculate - Calculate VAT from transactions
  fastify.post(
    '/returns/:id/calculate',
    {
      schema: {
        description: 'Calculate VAT return from transactions',
        tags: ['VAT'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['transactions'],
          properties: {
            transactions: {
              type: 'array',
              items: {
                type: 'object',
                required: ['type', 'netAmount', 'vatAmount', 'rateType'],
                properties: {
                  type: { type: 'string', enum: ['sale', 'purchase', 'eu_acquisition', 'eu_supply'] },
                  netAmount: { type: 'string' },
                  vatAmount: { type: 'string' },
                  rateType: { type: 'string', enum: ['standard', 'reduced', 'zero', 'exempt', 'outside_scope'] },
                  isEUSupply: { type: 'boolean', default: false },
                  isEUAcquisition: { type: 'boolean', default: false },
                  isReverseCharge: { type: 'boolean', default: false },
                },
              },
            },
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
      const existingReturn = await vatReturnRepository.findById(request.params.id);
      if (!existingReturn) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'VAT return not found',
        });
      }

      const body = request.body as Record<string, unknown>;
      const transactions = (body.transactions as unknown[]).map(t =>
        VATTransactionSchema.parse(t)
      );

      // Calculate VAT boxes
      const boxes = calculateVATReturn(transactions);

      // Update return with calculated boxes
      const vatReturn = await vatReturnRepository.updateBoxes(request.params.id, boxes);

      // Get summary
      const summary = getVATLiabilitySummary(boxes);

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.VAT_RETURN_CALCULATED, vatReturn.id, {
          returnId: vatReturn.id,
          tenantId: vatReturn.tenantId,
          entityId: vatReturn.entityId,
          periodKey: vatReturn.periodKey,
          box1: boxes.box1,
          box2: boxes.box2,
          box3: boxes.box3,
          box4: boxes.box4,
          box5: boxes.box5,
          direction: summary.direction,
        });
      }

      return reply.send({
        vatReturn,
        boxes,
        summary,
      });
    }
  );

  // POST /returns/:id/calculate-flat-rate - Calculate VAT using Flat Rate Scheme
  fastify.post(
    '/returns/:id/calculate-flat-rate',
    {
      schema: {
        description: 'Calculate VAT return using Flat Rate Scheme',
        tags: ['VAT'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['vatInclusiveTurnover', 'flatRatePercentage'],
          properties: {
            flatRatePercentage: { type: 'number' },
            vatInclusiveTurnover: { type: 'string' },
            capitalAssetVAT: { type: 'string', default: '0' },
            euSupplies: { type: 'string', default: '0' },
            euAcquisitions: { type: 'string', default: '0' },
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
      const existingReturn = await vatReturnRepository.findById(request.params.id);
      if (!existingReturn) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'VAT return not found',
        });
      }

      const body = request.body as Record<string, unknown>;

      // Calculate using Flat Rate Scheme
      const boxes = calculateFlatRateVATReturn(
        body.flatRatePercentage as number,
        body.vatInclusiveTurnover as string,
        body.capitalAssetVAT as string || '0',
        body.euSupplies as string || '0',
        body.euAcquisitions as string || '0'
      );

      // Calculate flat rate VAT for record keeping
      const flatRateVAT = new Decimal(body.vatInclusiveTurnover as string)
        .mul(body.flatRatePercentage as number)
        .div(100)
        .toFixed(2);

      // Update return with calculated boxes
      const vatReturn = await vatReturnRepository.updateBoxes(
        request.params.id,
        boxes,
        {
          turnover: body.vatInclusiveTurnover as string,
          vat: flatRateVAT,
        }
      );

      const summary = getVATLiabilitySummary(boxes);

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.VAT_RETURN_CALCULATED, vatReturn.id, {
          returnId: vatReturn.id,
          tenantId: vatReturn.tenantId,
          entityId: vatReturn.entityId,
          periodKey: vatReturn.periodKey,
          box1: boxes.box1,
          box2: boxes.box2,
          box3: boxes.box3,
          box4: boxes.box4,
          box5: boxes.box5,
          direction: summary.direction,
        });
      }

      return reply.send({
        vatReturn,
        boxes,
        summary,
        flatRateDetails: {
          percentage: body.flatRatePercentage,
          turnover: body.vatInclusiveTurnover,
          vat: flatRateVAT,
        },
      });
    }
  );

  // POST /returns/:id/accept-declaration - Accept MTD declaration
  fastify.post(
    '/returns/:id/accept-declaration',
    {
      schema: {
        description: 'Accept MTD VAT declaration',
        tags: ['VAT'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['acceptedBy'],
          properties: {
            acceptedBy: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              vatReturn: { type: 'object' },
              declaration: { type: 'string' },
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
      const existingReturn = await vatReturnRepository.findById(request.params.id);
      if (!existingReturn) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'VAT return not found',
        });
      }

      // Must be calculated before accepting declaration
      if (existingReturn.status === 'draft') {
        return reply.status(400).send({
          error: 'INVALID_STATE',
          message: 'VAT return must be calculated before accepting declaration',
        });
      }

      const body = request.body as Record<string, unknown>;
      const vatReturn = await vatReturnRepository.acceptDeclaration(
        request.params.id,
        body.acceptedBy as string
      );

      return reply.send({
        vatReturn,
        declaration: MTD_VAT_DECLARATION,
      });
    }
  );

  // POST /returns/:id/submit - Submit to HMRC
  fastify.post(
    '/returns/:id/submit',
    {
      schema: {
        description: 'Submit VAT return to HMRC (MTD)',
        tags: ['VAT'],
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
            agentReferenceNumber: { type: 'string' },
            governmentGatewayId: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object' },
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
      const existingReturn = await vatReturnRepository.findById(request.params.id);
      if (!existingReturn) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'VAT return not found',
        });
      }

      // Must have accepted declaration
      if (!existingReturn.declarationAccepted) {
        return reply.status(400).send({
          error: 'DECLARATION_NOT_ACCEPTED',
          message: 'Declaration must be accepted before submitting',
        });
      }

      // Validate boxes
      const validation = validateVATBoxes({
        box1: existingReturn.box1,
        box2: existingReturn.box2,
        box3: existingReturn.box3,
        box4: existingReturn.box4,
        box5: existingReturn.box5,
        box6: existingReturn.box6,
        box7: existingReturn.box7,
        box8: existingReturn.box8,
        box9: existingReturn.box9,
      });

      if (!validation.valid) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: validation.errors.join('; '),
        });
      }

      // Get registration to find VRN
      const registration = await registrationRepository.findById(existingReturn.registrationId);
      if (!registration?.vatNumber) {
        return reply.status(400).send({
          error: 'MISSING_VRN',
          message: 'VAT registration number (VRN) not found',
        });
      }

      let submissionResult: {
        receiptId: string;
        formBundleNumber: string;
        paymentIndicator: string;
        processingDate?: string;
        correlationId?: string;
      };

      // Use real HMRC API if configured, otherwise use mock
      if (vatSubmissionService) {
        const result = await vatSubmissionService.submitReturn(
          existingReturn.entityId,
          registration.vatNumber,
          existingReturn as any
        );

        if (!result.success) {
          return reply.status(400).send({
            error: result.error?.code || 'SUBMISSION_FAILED',
            message: result.error?.message || 'VAT return submission failed',
            details: result.error?.errors,
          });
        }

        submissionResult = {
          receiptId: result.receiptId || `HMRC-${Date.now()}`,
          formBundleNumber: result.formBundleNumber || `FB-${Date.now()}`,
          paymentIndicator: result.paymentIndicator || (new Decimal(existingReturn.box5).gte(0) ? 'DEBIT' : 'CREDIT'),
          processingDate: result.processingDate,
          correlationId: result.correlationId,
        };
      } else {
        // Mock submission for development/testing
        submissionResult = {
          receiptId: `HMRC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          formBundleNumber: `FB-${Date.now()}`,
          paymentIndicator: new Decimal(existingReturn.box5).gte(0) ? 'DEBIT' : 'CREDIT',
        };
      }

      const vatReturn = await vatReturnRepository.markAsSubmitted(request.params.id, {
        receiptId: submissionResult.receiptId,
        formBundleNumber: submissionResult.formBundleNumber,
        paymentIndicator: submissionResult.paymentIndicator,
      });

      const summary = getVATLiabilitySummary({
        box1: vatReturn.box1,
        box2: vatReturn.box2,
        box3: vatReturn.box3,
        box4: vatReturn.box4,
        box5: vatReturn.box5,
        box6: vatReturn.box6,
        box7: vatReturn.box7,
        box8: vatReturn.box8,
        box9: vatReturn.box9,
      });

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.VAT_RETURN_SUBMITTED, vatReturn.id, {
          returnId: vatReturn.id,
          tenantId: vatReturn.tenantId,
          entityId: vatReturn.entityId,
          periodKey: vatReturn.periodKey,
          submittedAt: vatReturn.submittedAt!.toISOString(),
          mtdReceiptId: vatReturn.mtdReceiptId!,
          netVAT: summary.netVAT,
        });
      }

      return reply.send({
        vatReturn,
        mtdReceipt: {
          receiptId: vatReturn.mtdReceiptId,
          formBundleNumber: vatReturn.mtdFormBundleNumber,
          paymentIndicator: vatReturn.mtdPaymentIndicator,
          processingDate: vatReturn.submittedAt,
          correlationId: submissionResult.correlationId,
        },
        summary,
        mode: vatSubmissionService ? 'live' : 'mock',
      });
    }
  );

  // DELETE /returns/:id - Delete return
  fastify.delete(
    '/returns/:id',
    {
      schema: {
        description: 'Delete VAT return (soft delete)',
        tags: ['VAT'],
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
      await vatReturnRepository.delete(request.params.id);
      return reply.status(204).send();
    }
  );
}
