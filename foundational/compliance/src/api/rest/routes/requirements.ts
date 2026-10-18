/**
 * Regulatory Requirements API Routes
 *
 * REST endpoints for managing regulatory requirements.
 *
 * @module api/rest/routes/requirements
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ComplianceService } from '../../../application/services/compliance-service.js';
import type { Database } from '../../../infrastructure/persistence/index.js';
import {
  type RegulatoryRequirement,
  RegulatorTypeSchema,
  RequirementCategorySchema,
  JurisdictionSchema,
  FrequencySchema,
} from '../../../domain/entities/regulatory-requirement.js';

// =============================================================================
// REQUEST SCHEMAS
// =============================================================================

const createRequirementSchema = z.object({
  regulator: RegulatorTypeSchema,
  regulationName: z.string().min(1).max(500),
  regulationReference: z.string().optional(),
  jurisdiction: JurisdictionSchema,
  category: RequirementCategorySchema,
  subCategory: z.string().optional(),
  description: z.string().min(1),
  frequency: FrequencySchema,
  deadlineRule: z.string().optional(),
  gracePeriodDays: z.number().int().min(0).optional(),
  penaltyDescription: z.string().optional(),
  maxPenaltyAmount: z.number().positive().optional(),
  effectiveDate: z.string().datetime(),
  sunsetDate: z.string().datetime().optional(),
  guidanceUrl: z.string().url().optional(),
  formReference: z.string().optional(),
  applicableEntityTypes: z.array(z.string()).optional(),
  thresholds: z.record(z.unknown()).optional(),
  exemptions: z.array(z.string()).optional(),
});

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export async function requirementRoutes(
  fastify: FastifyInstance,
  options: { db: Database }
) {
  const service = new ComplianceService(options.db);

  // ---------------------------------------------------------------------------
  // POST /requirements - Create new regulatory requirement
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof createRequirementSchema>;
  }>('/requirements', {
    schema: {
      body: createRequirementSchema,
    },
  }, async (request, reply) => {
    try {
      const tenantId = request.headers['x-tenant-id'] as string | undefined;

      const requirement = await service.createRequirement({
        tenantId,
        regulator: request.body.regulator,
        regulationName: request.body.regulationName,
        regulationReference: request.body.regulationReference,
        jurisdiction: request.body.jurisdiction,
        category: request.body.category,
        subCategory: request.body.subCategory,
        description: request.body.description,
        frequency: request.body.frequency,
        deadlineRule: request.body.deadlineRule,
        gracePeriodDays: request.body.gracePeriodDays,
        penaltyDescription: request.body.penaltyDescription,
        maxPenaltyAmount: request.body.maxPenaltyAmount,
        effectiveDate: new Date(request.body.effectiveDate),
        sunsetDate: request.body.sunsetDate ? new Date(request.body.sunsetDate) : undefined,
        guidanceUrl: request.body.guidanceUrl,
        formReference: request.body.formReference,
        applicableEntityTypes: request.body.applicableEntityTypes,
        thresholds: request.body.thresholds,
        exemptions: request.body.exemptions,
      });

      return reply.status(201).send(requirement);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /requirements - List active requirements
  // ---------------------------------------------------------------------------
  fastify.get('/requirements', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string | undefined;

    const requirements = await service.getActiveRequirements(tenantId);

    return reply.send({
      data: requirements,
      total: requirements.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /requirements/:id - Get single requirement
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { id: string };
  }>('/requirements/:id', async (request, reply) => {
    const requirement = await service.getRequirement(request.params.id);

    if (!requirement) {
      return reply.status(404).send({ error: 'Requirement not found' });
    }

    return reply.send(requirement);
  });

  // ---------------------------------------------------------------------------
  // GET /requirements/by-regulator/:regulator - Get requirements by regulator
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { regulator: string };
  }>('/requirements/by-regulator/:regulator', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string | undefined;
    const allRequirements = await service.getActiveRequirements(tenantId);

    const filtered = allRequirements.filter(
      r => r.regulator === request.params.regulator
    );

    return reply.send({
      data: filtered,
      total: filtered.length,
      regulator: request.params.regulator,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /requirements/by-category/:category - Get requirements by category
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { category: string };
  }>('/requirements/by-category/:category', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string | undefined;
    const allRequirements = await service.getActiveRequirements(tenantId);

    const filtered = allRequirements.filter(
      r => r.category === request.params.category
    );

    return reply.send({
      data: filtered,
      total: filtered.length,
      category: request.params.category,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /regulators - Get list of regulators
  // ---------------------------------------------------------------------------
  fastify.get('/regulators', async (request, reply) => {
    const regulators = [
      { code: 'hmrc', name: 'HM Revenue & Customs' },
      { code: 'companies_house', name: 'Companies House' },
      { code: 'fca', name: 'Financial Conduct Authority' },
      { code: 'pra', name: 'Prudential Regulation Authority' },
      { code: 'ico', name: 'Information Commissioner\'s Office' },
      { code: 'hse', name: 'Health and Safety Executive' },
      { code: 'cma', name: 'Competition and Markets Authority' },
      { code: 'pensions_regulator', name: 'The Pensions Regulator' },
      { code: 'eu_commission', name: 'European Commission' },
      { code: 'sec', name: 'Securities and Exchange Commission' },
      { code: 'irs', name: 'Internal Revenue Service' },
      { code: 'fincen', name: 'Financial Crimes Enforcement Network' },
      { code: 'ofac', name: 'Office of Foreign Assets Control' },
      { code: 'fatf', name: 'Financial Action Task Force' },
      { code: 'state_ag', name: 'State Attorney General' },
      { code: 'state_sos', name: 'Secretary of State' },
      { code: 'other', name: 'Other' },
    ];

    return reply.send({ data: regulators });
  });

  // ---------------------------------------------------------------------------
  // GET /categories - Get list of compliance categories
  // ---------------------------------------------------------------------------
  fastify.get('/categories', async (request, reply) => {
    const categories = [
      { code: 'corporation_tax', name: 'Corporation Tax' },
      { code: 'vat', name: 'VAT' },
      { code: 'paye', name: 'PAYE' },
      { code: 'national_insurance', name: 'National Insurance' },
      { code: 'capital_gains', name: 'Capital Gains' },
      { code: 'corporate_governance', name: 'Corporate Governance' },
      { code: 'annual_filing', name: 'Annual Filing' },
      { code: 'psc_register', name: 'PSC Register' },
      { code: 'statutory_registers', name: 'Statutory Registers' },
      { code: 'gdpr', name: 'GDPR' },
      { code: 'data_protection', name: 'Data Protection' },
      { code: 'aml_kyc', name: 'AML/KYC' },
      { code: 'sanctions', name: 'Sanctions' },
      { code: 'employment', name: 'Employment' },
      { code: 'health_safety', name: 'Health & Safety' },
      { code: 'environmental', name: 'Environmental' },
      { code: 'financial_reporting', name: 'Financial Reporting' },
      { code: 'audit', name: 'Audit' },
      { code: 'insurance', name: 'Insurance' },
      { code: 'consumer_protection', name: 'Consumer Protection' },
      { code: 'competition', name: 'Competition' },
      { code: 'pensions', name: 'Pensions' },
      { code: 'other', name: 'Other' },
    ];

    return reply.send({ data: categories });
  });
}
