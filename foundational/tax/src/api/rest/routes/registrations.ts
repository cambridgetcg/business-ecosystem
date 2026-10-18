/**
 * UK Tax Registration REST Routes
 *
 * Endpoints for managing tax registrations with HMRC.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { UKTaxRegistrationRepository } from '../../../infrastructure/persistence/repositories/index.js';
import type { EventPublisher } from '../../../infrastructure/messaging/index.js';
import { TaxEventTypes } from '../../../infrastructure/messaging/events.js';
import {
  CreateUKTaxRegistrationInputSchema,
  UpdateUKTaxRegistrationInputSchema,
  RegisterForVATInputSchema,
  RegisterForPAYEInputSchema,
} from '../../../domain/uk-registration/index.js';

interface RouteContext {
  registrationRepository: UKTaxRegistrationRepository;
  eventPublisher?: EventPublisher;
}

export async function registrationRoutes(
  fastify: FastifyInstance,
  context: RouteContext
): Promise<void> {
  const { registrationRepository, eventPublisher } = context;

  // GET / - List registrations
  fastify.get(
    '/',
    {
      schema: {
        description: 'List UK tax registrations',
        tags: ['Registrations'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            entityId: { type: 'string', format: 'uuid' },
            vatRegistered: { type: 'boolean' },
            payeRegistered: { type: 'boolean' },
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
      const result = await registrationRepository.findMany(
        {
          tenantId: query.tenantId as string | undefined,
          entityId: query.entityId as string | undefined,
          vatRegistered: query.vatRegistered as boolean | undefined,
          payeRegistered: query.payeRegistered as boolean | undefined,
        },
        {
          limit: (query.limit as number) || 20,
          offset: (query.offset as number) || 0,
        }
      );
      return reply.send(result);
    }
  );

  // GET /:id - Get registration by ID
  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get UK tax registration by ID',
        tags: ['Registrations'],
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
      const registration = await registrationRepository.findById(request.params.id);
      if (!registration) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'UK tax registration not found',
        });
      }
      return reply.send(registration);
    }
  );

  // GET /entity/:entityId - Get registration by entity ID
  fastify.get(
    '/entity/:entityId',
    {
      schema: {
        description: 'Get UK tax registration by entity ID',
        tags: ['Registrations'],
        params: {
          type: 'object',
          properties: {
            entityId: { type: 'string', format: 'uuid' },
          },
          required: ['entityId'],
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
    async (request: FastifyRequest<{ Params: { entityId: string } }>, reply: FastifyReply) => {
      const registration = await registrationRepository.findByEntityId(request.params.entityId);
      if (!registration) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'UK tax registration not found for entity',
        });
      }
      return reply.send(registration);
    }
  );

  // POST / - Create registration
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create UK tax registration',
        tags: ['Registrations'],
        body: {
          type: 'object',
          required: ['tenantId', 'entityId', 'accountingPeriodEnd'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            entityId: { type: 'string', format: 'uuid' },
            companyUTR: { type: 'string', pattern: '^\\d{10}$' },
            corporationTaxReference: { type: 'string', maxLength: 20 },
            accountingPeriodEnd: { type: 'string', format: 'date-time' },
            taxCorrespondenceEmail: { type: 'string', format: 'email' },
            taxCorrespondencePhone: { type: 'string', maxLength: 20 },
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
      const input = CreateUKTaxRegistrationInputSchema.parse({
        ...body,
        accountingPeriodEnd: new Date(body.accountingPeriodEnd as string),
      });

      const registration = await registrationRepository.create(input);

      if (eventPublisher) {
        await eventPublisher.publish(TaxEventTypes.REGISTRATION_CREATED, registration.id, {
          registrationId: registration.id,
          tenantId: registration.tenantId,
          entityId: registration.entityId,
          accountingPeriodEnd: registration.accountingPeriodEnd.toISOString(),
        });
      }

      return reply.status(201).send(registration);
    }
  );

  // PATCH /:id - Update registration
  fastify.patch(
    '/:id',
    {
      schema: {
        description: 'Update UK tax registration',
        tags: ['Registrations'],
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
            companyUTR: { type: 'string', pattern: '^\\d{10}$' },
            corporationTaxReference: { type: 'string', maxLength: 20 },
            accountingPeriodEnd: { type: 'string', format: 'date-time' },
            taxCorrespondenceEmail: { type: 'string', format: 'email', nullable: true },
            taxCorrespondencePhone: { type: 'string', maxLength: 20, nullable: true },
            annualTurnover: { type: 'string', nullable: true },
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
      try {
        const body = request.body as Record<string, unknown>;
        const input = UpdateUKTaxRegistrationInputSchema.parse({
          ...body,
          accountingPeriodEnd: body.accountingPeriodEnd ? new Date(body.accountingPeriodEnd as string) : undefined,
        });

        const registration = await registrationRepository.update(request.params.id, input);

        if (eventPublisher) {
          await eventPublisher.publish(TaxEventTypes.REGISTRATION_UPDATED, registration.id, {
            registrationId: registration.id,
            tenantId: registration.tenantId,
            entityId: registration.entityId,
          });
        }

        return reply.send(registration);
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'UK tax registration not found',
          });
        }
        throw error;
      }
    }
  );

  // POST /:id/vat/register - Register for VAT
  fastify.post(
    '/:id/vat/register',
    {
      schema: {
        description: 'Register entity for VAT',
        tags: ['Registrations'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['vatNumber', 'registrationDate', 'vatQuarterEnd'],
          properties: {
            vatNumber: { type: 'string', pattern: '^GB(\\d{9}|\\d{12})$' },
            registrationDate: { type: 'string', format: 'date-time' },
            scheme: { type: 'string', enum: ['standard', 'flat_rate', 'cash_accounting', 'annual_accounting'], default: 'standard' },
            flatRatePercentage: { type: 'string' },
            vatQuarterEnd: { type: 'string', enum: ['march', 'april', 'may'] },
            mtdEnabled: { type: 'boolean', default: true },
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
      try {
        const body = request.body as Record<string, unknown>;
        const input = RegisterForVATInputSchema.parse({
          registrationId: request.params.id,
          vatNumber: body.vatNumber,
          registrationDate: new Date(body.registrationDate as string),
          scheme: body.scheme || 'standard',
          flatRatePercentage: body.flatRatePercentage,
          vatQuarterEnd: body.vatQuarterEnd,
          mtdEnabled: body.mtdEnabled ?? true,
        });

        const registration = await registrationRepository.registerForVAT(input);

        if (eventPublisher) {
          await eventPublisher.publish(TaxEventTypes.VAT_REGISTERED, registration.id, {
            registrationId: registration.id,
            tenantId: registration.tenantId,
            entityId: registration.entityId,
            vatNumber: registration.vatNumber!,
            registrationDate: registration.vatRegistrationDate!.toISOString(),
            scheme: registration.vatScheme!,
            mtdEnabled: registration.mtdVatEnabled,
          });
        }

        return reply.send(registration);
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'UK tax registration not found',
          });
        }
        throw error;
      }
    }
  );

  // POST /:id/paye/register - Register for PAYE
  fastify.post(
    '/:id/paye/register',
    {
      schema: {
        description: 'Register entity for PAYE',
        tags: ['Registrations'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['payeReference', 'accountsOfficeReference', 'registrationDate'],
          properties: {
            payeReference: { type: 'string', pattern: '^\\d{3}/[A-Z0-9]+$' },
            accountsOfficeReference: { type: 'string', pattern: '^\\d{3}P[A-Z]\\d{8}$' },
            registrationDate: { type: 'string', format: 'date-time' },
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
      try {
        const body = request.body as Record<string, unknown>;
        const input = RegisterForPAYEInputSchema.parse({
          registrationId: request.params.id,
          payeReference: body.payeReference,
          accountsOfficeReference: body.accountsOfficeReference,
          registrationDate: new Date(body.registrationDate as string),
        });

        const registration = await registrationRepository.registerForPAYE(input);

        if (eventPublisher) {
          await eventPublisher.publish(TaxEventTypes.PAYE_REGISTERED, registration.id, {
            registrationId: registration.id,
            tenantId: registration.tenantId,
            entityId: registration.entityId,
            payeReference: registration.payeReference!,
            accountsOfficeReference: registration.accountsOfficeReference!,
            registrationDate: registration.payeRegistrationDate!.toISOString(),
          });
        }

        return reply.send(registration);
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'UK tax registration not found',
          });
        }
        throw error;
      }
    }
  );

  // DELETE /:id - Delete registration
  fastify.delete(
    '/:id',
    {
      schema: {
        description: 'Delete UK tax registration (soft delete)',
        tags: ['Registrations'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          204: { type: 'null' },
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
      const exists = await registrationRepository.exists(request.params.id);
      if (!exists) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'UK tax registration not found',
        });
      }
      await registrationRepository.delete(request.params.id);
      return reply.status(204).send();
    }
  );
}
