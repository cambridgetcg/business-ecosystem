/**
 * Strategy Domain Routes
 *
 * REST API for IP Strategy: Valuations, FTO Analyses, Due Diligence Reports.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  IPValuation,
  type ValuationStatus,
  type ValuationMethodology,
  type ValuationPurpose,
} from '../../../domain/entities/ip-valuation.entity.js';
import {
  FTOAnalysis,
  type FTOStatus,
  type FTORiskLevel,
} from '../../../domain/entities/fto-analysis.entity.js';
import {
  DueDiligenceReport,
  type DDStatus,
  type DDType,
} from '../../../domain/entities/due-diligence-report.entity.js';
import {
  IPValuationRepository,
  FTOAnalysisRepository,
  DueDiligenceRepository,
} from '../../../infrastructure/persistence/strategy.repository.js';

// ============================================================================
// SCHEMAS
// ============================================================================

// IP Valuation Schemas
const ValuationStatusSchema = z.enum(['draft', 'in_progress', 'review', 'approved', 'superseded', 'archived']);
const ValuationMethodologySchema = z.enum([
  'cost', 'market', 'income', 'relief_from_royalty', 'excess_earnings',
  'real_options', 'monte_carlo', 'comparable_transactions'
]);
const ValuationPurposeSchema = z.enum([
  'financial_reporting', 'tax', 'litigation', 'licensing', 'sale',
  'financing', 'insurance', 'internal_planning', 'm_and_a'
]);

const IPAssetRefSchema = z.object({
  type: z.string(),
  id: z.string().uuid(),
  name: z.string(),
  weight: z.number().optional(),
});

const CreateValuationSchema = z.object({
  title: z.string().min(1).max(500),
  purpose: ValuationPurposeSchema,
  methodology: ValuationMethodologySchema,
  ipAssets: z.array(IPAssetRefSchema).min(1),
  valuationDate: z.string().datetime(),
  effectiveDate: z.string().datetime(),
  currency: z.string().length(3).default('USD'),
  preparedBy: z.string().uuid(),
});

const UpdateValuationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  discountRate: z.number().int().optional(),
  royaltyRate: z.number().int().optional(),
  projectionYears: z.number().int().positive().optional(),
  terminalGrowthRate: z.number().int().optional(),
  lowValue: z.number().int().optional(),
  midValue: z.number().int().optional(),
  highValue: z.number().int().optional(),
  selectedValue: z.number().int().optional(),
  conclusionSummary: z.string().optional(),
  limitations: z.string().optional(),
});

// FTO Analysis Schemas
const FTOStatusSchema = z.enum([
  'initiated', 'search_complete', 'analysis_in_progress', 'review', 'complete', 'updated', 'superseded'
]);
const FTORiskLevelSchema = z.enum(['clear', 'low', 'moderate', 'high', 'blocking']);
const FTOFindingTypeSchema = z.enum([
  'clear', 'potential_issue', 'design_around_needed', 'license_required', 'blocking', 'expired', 'narrow_claim'
]);

const CreateFTOAnalysisSchema = z.object({
  title: z.string().min(1).max(500),
  productName: z.string().min(1),
  productDescription: z.string().min(1),
  technicalSpecification: z.string().optional(),
  targetMarkets: z.array(z.string()).default([]),
  launchDate: z.string().datetime().optional(),
  jurisdictions: z.array(z.string()).min(1),
  patentClassifications: z.array(z.string()).optional(),
  searchStrategy: z.string().optional(),
  assignedTo: z.string().uuid(),
});

const FTOFindingSchema = z.object({
  patentNumber: z.string(),
  patentTitle: z.string(),
  patentHolder: z.string().optional(),
  patentExpiration: z.string().datetime().optional(),
  jurisdiction: z.string(),
  findingType: FTOFindingTypeSchema,
  riskLevel: FTORiskLevelSchema,
  claimsAtIssue: z.array(z.number()).default([]),
  analysisNotes: z.string(),
  overlapDescription: z.string().optional(),
  differentiatingFeatures: z.string().optional(),
  designAroundOption: z.string().optional(),
  designAroundFeasibility: z.string().optional(),
  designAroundCost: z.number().int().optional(),
  licensingOption: z.boolean().default(false),
  estimatedLicenseCost: z.number().int().optional(),
  invalidityArguments: z.string().optional(),
  priorArtReferences: z.array(z.string()).default([]),
  recommendation: z.string().optional(),
});

// Due Diligence Schemas
const DDStatusSchema = z.enum([
  'initiated', 'document_review', 'analysis', 'findings_review', 'complete', 'terminated'
]);
const DDTypeSchema = z.enum([
  'acquisition', 'divestiture', 'licensing_in', 'licensing_out',
  'investment', 'joint_venture', 'ipo', 'financing'
]);
const DDFindingSeveritySchema = z.enum(['critical', 'major', 'moderate', 'minor', 'informational']);

const CreateDDReportSchema = z.object({
  title: z.string().min(1).max(500),
  ddType: DDTypeSchema,
  targetEntityName: z.string().min(1),
  targetEntityId: z.string().uuid().optional(),
  transactionValue: z.number().int().optional(),
  transactionCurrency: z.string().length(3).default('USD'),
  ipTypesInScope: z.array(z.string()).min(1),
  jurisdictionsInScope: z.array(z.string()).default([]),
  dealCloseDate: z.string().datetime().optional(),
  leadAnalyst: z.string().uuid(),
  teamMembers: z.array(z.string().uuid()).default([]),
});

const DDFindingSchema = z.object({
  category: z.string(),
  severity: DDFindingSeveritySchema,
  title: z.string(),
  description: z.string(),
  affectedAssets: z.array(z.object({
    type: z.string(),
    id: z.string(),
    name: z.string(),
  })).default([]),
  financialImpact: z.number().int().optional(),
  impactDescription: z.string().optional(),
  mitigationOptions: z.array(z.object({
    option: z.string(),
    cost: z.number().optional(),
    timeframe: z.string().optional(),
    feasibility: z.string(),
  })).default([]),
  recommendedAction: z.string().optional(),
  suggestedRepresentations: z.string().optional(),
  suggestedIndemnities: z.string().optional(),
  escrowRecommendation: z.string().optional(),
  priceAdjustmentRecommendation: z.number().int().optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function strategyRoutes(fastify: FastifyInstance): Promise<void> {
  const valuationRepo = new IPValuationRepository(fastify.db);
  const ftoRepo = new FTOAnalysisRepository(fastify.db);
  const ddRepo = new DueDiligenceRepository(fastify.db);

  // ============================================================================
  // IP VALUATION ROUTES
  // ============================================================================

  // Create Valuation
  fastify.post('/valuations', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = CreateValuationSchema.parse(request.body);

    const valuation = IPValuation.create({
      ...input,
      valuationDate: new Date(input.valuationDate),
      effectiveDate: new Date(input.effectiveDate),
    });

    const valuationNumber = await valuationRepo.generateNumber();
    valuation.assignNumber(valuationNumber, request.user?.id);

    await valuationRepo.save(valuation);

    return reply.status(201).send({
      id: valuation.id,
      valuationNumber: valuation.valuationNumber,
    });
  });

  // Get Valuation
  fastify.get('/valuations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const valuation = await valuationRepo.findById(id);
    if (valuation === null) {
      return reply.status(404).send({ error: 'Valuation not found' });
    }

    return reply.send(serializeValuation(valuation));
  });

  // Search Valuations
  fastify.get('/valuations', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;

    const { valuations, total } = await valuationRepo.search({
      status: query.status as ValuationStatus | undefined,
      purpose: query.purpose as ValuationPurpose | undefined,
      methodology: query.methodology as ValuationMethodology | undefined,
      preparedBy: query.preparedBy,
      approvedBy: query.approvedBy,
      valuationDateFrom: query.valuationDateFrom ? new Date(query.valuationDateFrom) : undefined,
      valuationDateTo: query.valuationDateTo ? new Date(query.valuationDateTo) : undefined,
      minValue: query.minValue ? parseInt(query.minValue, 10) : undefined,
      maxValue: query.maxValue ? parseInt(query.maxValue, 10) : undefined,
      searchTerm: query.q,
    }, parseInt(query.limit || '50', 10), parseInt(query.offset || '0', 10));

    return reply.send({
      data: valuations.map(serializeValuation),
      total,
      limit: parseInt(query.limit || '50', 10),
      offset: parseInt(query.offset || '0', 10),
    });
  });

  // Update Valuation
  fastify.patch('/valuations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const input = UpdateValuationSchema.parse(request.body);

    const valuation = await valuationRepo.findById(id);
    if (valuation === null) {
      return reply.status(404).send({ error: 'Valuation not found' });
    }

    if (input.discountRate !== undefined || input.royaltyRate !== undefined ||
        input.projectionYears !== undefined || input.terminalGrowthRate !== undefined) {
      valuation.setModelParameters({
        discountRate: input.discountRate,
        royaltyRate: input.royaltyRate,
        projectionYears: input.projectionYears,
        terminalGrowthRate: input.terminalGrowthRate,
      }, request.user?.id);
    }

    if (input.lowValue !== undefined && input.midValue !== undefined &&
        input.highValue !== undefined && input.selectedValue !== undefined) {
      valuation.setValueRange({
        lowValue: input.lowValue,
        midValue: input.midValue,
        highValue: input.highValue,
        selectedValue: input.selectedValue,
      }, request.user?.id);
    }

    if (input.conclusionSummary !== undefined) {
      valuation.setConclusion({
        summary: input.conclusionSummary,
        limitations: input.limitations,
      }, request.user?.id);
    }

    await valuationRepo.save(valuation);

    return reply.send(serializeValuation(valuation));
  });

  // Start Analysis
  fastify.post('/valuations/:id/start-analysis', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const valuation = await valuationRepo.findById(id);
    if (valuation === null) {
      return reply.status(404).send({ error: 'Valuation not found' });
    }

    valuation.startAnalysis(request.user?.id);
    await valuationRepo.save(valuation);

    return reply.send(serializeValuation(valuation));
  });

  // Submit for Review
  fastify.post('/valuations/:id/submit', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const valuation = await valuationRepo.findById(id);
    if (valuation === null) {
      return reply.status(404).send({ error: 'Valuation not found' });
    }

    valuation.submitForReview(request.user?.id);
    await valuationRepo.save(valuation);

    return reply.send(serializeValuation(valuation));
  });

  // Review Valuation
  fastify.post('/valuations/:id/review', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { decision, notes } = (request.body as { decision: 'return' | 'forward'; notes?: string });

    const valuation = await valuationRepo.findById(id);
    if (valuation === null) {
      return reply.status(404).send({ error: 'Valuation not found' });
    }

    valuation.review(request.user?.id ?? 'system', decision, notes, request.user?.id);
    await valuationRepo.save(valuation);

    return reply.send(serializeValuation(valuation));
  });

  // Approve Valuation
  fastify.post('/valuations/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { expirationDate } = (request.body as { expirationDate?: string });

    const valuation = await valuationRepo.findById(id);
    if (valuation === null) {
      return reply.status(404).send({ error: 'Valuation not found' });
    }

    valuation.approve(
      request.user?.id ?? 'system',
      expirationDate ? new Date(expirationDate) : undefined,
      request.user?.id
    );
    await valuationRepo.save(valuation);

    return reply.send(serializeValuation(valuation));
  });

  // Delete Valuation
  fastify.delete('/valuations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await valuationRepo.delete(id);
    return reply.status(204).send();
  });

  // ============================================================================
  // FTO ANALYSIS ROUTES
  // ============================================================================

  // Create FTO Analysis
  fastify.post('/fto-analyses', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = CreateFTOAnalysisSchema.parse(request.body);

    const analysis = FTOAnalysis.create({
      ...input,
      launchDate: input.launchDate ? new Date(input.launchDate) : undefined,
    });

    const analysisNumber = await ftoRepo.generateNumber();
    analysis.assignNumber(analysisNumber, request.user?.id);

    await ftoRepo.save(analysis);

    return reply.status(201).send({
      id: analysis.id,
      analysisNumber: analysis.analysisNumber,
    });
  });

  // Get FTO Analysis
  fastify.get('/fto-analyses/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const analysis = await ftoRepo.findById(id);
    if (analysis === null) {
      return reply.status(404).send({ error: 'FTO Analysis not found' });
    }

    return reply.send(serializeFTOAnalysis(analysis));
  });

  // Search FTO Analyses
  fastify.get('/fto-analyses', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;

    const { analyses, total } = await ftoRepo.search({
      status: query.status as FTOStatus | undefined,
      overallRisk: query.overallRisk as FTORiskLevel | undefined,
      assignedTo: query.assignedTo,
      jurisdiction: query.jurisdiction,
      searchTerm: query.q,
      initiatedDateFrom: query.initiatedDateFrom ? new Date(query.initiatedDateFrom) : undefined,
      initiatedDateTo: query.initiatedDateTo ? new Date(query.initiatedDateTo) : undefined,
    }, parseInt(query.limit || '50', 10), parseInt(query.offset || '0', 10));

    return reply.send({
      data: analyses.map(serializeFTOAnalysis),
      total,
      limit: parseInt(query.limit || '50', 10),
      offset: parseInt(query.offset || '0', 10),
    });
  });

  // Get At-Risk FTO Analyses
  fastify.get('/fto-analyses/at-risk', async (request: FastifyRequest, reply: FastifyReply) => {
    const analyses = await ftoRepo.findAtRisk();
    return reply.send({
      data: analyses.map(serializeFTOAnalysis),
      total: analyses.length,
    });
  });

  // Complete Search Phase
  fastify.post('/fto-analyses/:id/complete-search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { patentsSearched, patentsReviewed } = (request.body as { patentsSearched: number; patentsReviewed: number });

    const analysis = await ftoRepo.findById(id);
    if (analysis === null) {
      return reply.status(404).send({ error: 'FTO Analysis not found' });
    }

    analysis.updateSearchStats({ patentsSearched, patentsReviewed }, request.user?.id);
    analysis.completeSearch(request.user?.id);
    await ftoRepo.save(analysis);

    return reply.send(serializeFTOAnalysis(analysis));
  });

  // Start Analysis Phase
  fastify.post('/fto-analyses/:id/start-analysis', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const analysis = await ftoRepo.findById(id);
    if (analysis === null) {
      return reply.status(404).send({ error: 'FTO Analysis not found' });
    }

    analysis.startAnalysis(request.user?.id);
    await ftoRepo.save(analysis);

    return reply.send(serializeFTOAnalysis(analysis));
  });

  // Add Finding
  fastify.post('/fto-analyses/:id/findings', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const input = FTOFindingSchema.parse(request.body);

    const analysis = await ftoRepo.findById(id);
    if (analysis === null) {
      return reply.status(404).send({ error: 'FTO Analysis not found' });
    }

    const findingId = analysis.addFinding({
      ...input,
      patentExpiration: input.patentExpiration ? new Date(input.patentExpiration) : undefined,
    }, request.user?.id);

    await ftoRepo.save(analysis);

    return reply.status(201).send({ findingId });
  });

  // Complete Analysis
  fastify.post('/fto-analyses/:id/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { overallRisk, recommendation } = (request.body as {
      overallRisk: FTORiskLevel;
      recommendation: string;
    });

    const analysis = await ftoRepo.findById(id);
    if (analysis === null) {
      return reply.status(404).send({ error: 'FTO Analysis not found' });
    }

    analysis.completeAnalysis(overallRisk, recommendation, request.user?.id);
    await ftoRepo.save(analysis);

    return reply.send(serializeFTOAnalysis(analysis));
  });

  // Review FTO Analysis
  fastify.post('/fto-analyses/:id/review', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { decision } = (request.body as { decision: 'return' | 'approve' });

    const analysis = await ftoRepo.findById(id);
    if (analysis === null) {
      return reply.status(404).send({ error: 'FTO Analysis not found' });
    }

    analysis.review(request.user?.id ?? 'system', decision, request.user?.id);
    await ftoRepo.save(analysis);

    return reply.send(serializeFTOAnalysis(analysis));
  });

  // Delete FTO Analysis
  fastify.delete('/fto-analyses/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await ftoRepo.delete(id);
    return reply.status(204).send();
  });

  // ============================================================================
  // DUE DILIGENCE ROUTES
  // ============================================================================

  // Create DD Report
  fastify.post('/due-diligence', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = CreateDDReportSchema.parse(request.body);

    const report = DueDiligenceReport.create({
      ...input,
      dealCloseDate: input.dealCloseDate ? new Date(input.dealCloseDate) : undefined,
    });

    const reportNumber = await ddRepo.generateNumber();
    report.assignNumber(reportNumber, request.user?.id);

    await ddRepo.save(report);

    return reply.status(201).send({
      id: report.id,
      reportNumber: report.reportNumber,
    });
  });

  // Get DD Report
  fastify.get('/due-diligence/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const report = await ddRepo.findById(id);
    if (report === null) {
      return reply.status(404).send({ error: 'Due Diligence Report not found' });
    }

    return reply.send(serializeDDReport(report));
  });

  // Search DD Reports
  fastify.get('/due-diligence', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;

    const { reports, total } = await ddRepo.search({
      status: query.status as DDStatus | undefined,
      ddType: query.ddType as DDType | undefined,
      leadAnalyst: query.leadAnalyst,
      targetEntityName: query.targetEntityName,
      searchTerm: query.q,
      initiatedDateFrom: query.initiatedDateFrom ? new Date(query.initiatedDateFrom) : undefined,
      initiatedDateTo: query.initiatedDateTo ? new Date(query.initiatedDateTo) : undefined,
      hasDealBreakers: query.hasDealBreakers === 'true',
    }, parseInt(query.limit || '50', 10), parseInt(query.offset || '0', 10));

    return reply.send({
      data: reports.map(serializeDDReport),
      total,
      limit: parseInt(query.limit || '50', 10),
      offset: parseInt(query.offset || '0', 10),
    });
  });

  // Get In-Progress DD Reports
  fastify.get('/due-diligence/in-progress', async (request: FastifyRequest, reply: FastifyReply) => {
    const reports = await ddRepo.findInProgress();
    return reply.send({
      data: reports.map(serializeDDReport),
      total: reports.length,
    });
  });

  // Send Document Request
  fastify.post('/due-diligence/:id/request-documents', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const report = await ddRepo.findById(id);
    if (report === null) {
      return reply.status(404).send({ error: 'Due Diligence Report not found' });
    }

    report.sendDocumentRequest(request.user?.id);
    await ddRepo.save(report);

    return reply.send(serializeDDReport(report));
  });

  // Documents Received
  fastify.post('/due-diligence/:id/documents-received', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const report = await ddRepo.findById(id);
    if (report === null) {
      return reply.status(404).send({ error: 'Due Diligence Report not found' });
    }

    report.documentsReceived(request.user?.id);
    await ddRepo.save(report);

    return reply.send(serializeDDReport(report));
  });

  // Start Analysis
  fastify.post('/due-diligence/:id/start-analysis', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const report = await ddRepo.findById(id);
    if (report === null) {
      return reply.status(404).send({ error: 'Due Diligence Report not found' });
    }

    report.startAnalysis(request.user?.id);
    await ddRepo.save(report);

    return reply.send(serializeDDReport(report));
  });

  // Add Finding
  fastify.post('/due-diligence/:id/findings', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const input = DDFindingSchema.parse(request.body);

    const report = await ddRepo.findById(id);
    if (report === null) {
      return reply.status(404).send({ error: 'Due Diligence Report not found' });
    }

    const findingId = report.addFinding(input, request.user?.id);
    await ddRepo.save(report);

    return reply.status(201).send({ findingId });
  });

  // Update Portfolio Counts
  fastify.patch('/due-diligence/:id/portfolio', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const counts = (request.body as {
      patents?: number;
      trademarks?: number;
      copyrights?: number;
      tradeSecrets?: number;
      licenses?: number;
    });

    const report = await ddRepo.findById(id);
    if (report === null) {
      return reply.status(404).send({ error: 'Due Diligence Report not found' });
    }

    report.updatePortfolioCounts(counts, request.user?.id);
    await ddRepo.save(report);

    return reply.send(serializeDDReport(report));
  });

  // Set Valuation
  fastify.patch('/due-diligence/:id/valuation', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const valuation = (request.body as {
      statedValue: number;
      assessedValue: number;
      gapNotes?: string;
    });

    const report = await ddRepo.findById(id);
    if (report === null) {
      return reply.status(404).send({ error: 'Due Diligence Report not found' });
    }

    report.setValuation(valuation, request.user?.id);
    await ddRepo.save(report);

    return reply.send(serializeDDReport(report));
  });

  // Submit Draft Report
  fastify.post('/due-diligence/:id/submit-draft', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const summary = (request.body as {
      executiveSummary: string;
      keyFindings: string;
      recommendations: string;
    });

    const report = await ddRepo.findById(id);
    if (report === null) {
      return reply.status(404).send({ error: 'Due Diligence Report not found' });
    }

    report.submitDraftReport(summary, request.user?.id);
    await ddRepo.save(report);

    return reply.send(serializeDDReport(report));
  });

  // Review DD Report
  fastify.post('/due-diligence/:id/review', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { decision } = (request.body as { decision: 'return' | 'approve' });

    const report = await ddRepo.findById(id);
    if (report === null) {
      return reply.status(404).send({ error: 'Due Diligence Report not found' });
    }

    report.review(request.user?.id ?? 'system', decision, request.user?.id);
    await ddRepo.save(report);

    return reply.send(serializeDDReport(report));
  });

  // Terminate DD
  fastify.post('/due-diligence/:id/terminate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { reason } = (request.body as { reason: string });

    const report = await ddRepo.findById(id);
    if (report === null) {
      return reply.status(404).send({ error: 'Due Diligence Report not found' });
    }

    report.terminate(reason, request.user?.id);
    await ddRepo.save(report);

    return reply.send(serializeDDReport(report));
  });

  // Delete DD Report
  fastify.delete('/due-diligence/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await ddRepo.delete(id);
    return reply.status(204).send();
  });
}

// ============================================================================
// SERIALIZERS
// ============================================================================

function serializeValuation(v: IPValuation) {
  return {
    id: v.id,
    valuationNumber: v.valuationNumber,
    title: v.title,
    status: v.status,
    purpose: v.purpose,
    methodology: v.methodology,
    ipAssets: v.ipAssets,
    valuationDate: v.valuationDate.toISOString(),
    effectiveDate: v.effectiveDate.toISOString(),
    expirationDate: v.expirationDate?.toISOString(),
    value: {
      low: v.lowValue,
      mid: v.midValue,
      high: v.highValue,
      selected: v.selectedValue,
      currency: v.currency,
    },
    modelParameters: {
      discountRate: v.discountRate,
      royaltyRate: v.royaltyRate,
      projectionYears: v.projectionYears,
      terminalGrowthRate: v.terminalGrowthRate,
    },
    assumptions: v.assumptions,
    comparableTransactions: v.comparableTransactions,
    sensitivities: v.sensitivities,
    conclusionSummary: v.conclusionSummary,
    limitations: v.limitations,
    workflow: {
      preparedBy: v.preparedBy,
      reviewedBy: v.reviewedBy,
      approvedBy: v.approvedBy,
      approvedDate: v.approvedDate?.toISOString(),
    },
    externalAppraiser: v.externalAppraiser,
    appraisalReportRef: v.appraisalReportRef,
    isExpired: v.isExpired(),
    valueRangePercentage: v.getValueRangePercentage(),
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    version: v.version,
  };
}

function serializeFTOAnalysis(a: FTOAnalysis) {
  return {
    id: a.id,
    analysisNumber: a.analysisNumber,
    title: a.title,
    status: a.status,
    overallRisk: a.overallRisk,
    product: {
      name: a.productName,
      description: a.productDescription,
      technicalSpecification: a.technicalSpecification,
      targetMarkets: a.targetMarkets,
      launchDate: a.launchDate?.toISOString(),
    },
    scope: {
      jurisdictions: a.jurisdictions,
      patentClassifications: a.patentClassifications,
      searchStrategy: a.searchStrategy,
    },
    timeline: {
      initiatedDate: a.initiatedDate.toISOString(),
      searchCompletedDate: a.searchCompletedDate?.toISOString(),
      analysisCompletedDate: a.analysisCompletedDate?.toISOString(),
      reviewCompletedDate: a.reviewCompletedDate?.toISOString(),
    },
    stats: {
      patentsSearched: a.patentsSearched,
      patentsReviewed: a.patentsReviewed,
      potentialIssuesCount: a.potentialIssuesCount,
      blockingFindingsCount: a.getBlockingFindings().length,
    },
    findings: a.findings,
    recommendation: a.recommendation,
    recommendedActions: a.recommendedActions,
    workflow: {
      assignedTo: a.assignedTo,
      reviewedBy: a.reviewedBy,
      approvedBy: a.approvedBy,
      outsideCounselId: a.outsideCounselId,
      outsideCounselOpinionRef: a.outsideCounselOpinionRef,
    },
    isLaunchAtRisk: a.isLaunchAtRisk(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    version: a.version,
  };
}

function serializeDDReport(r: DueDiligenceReport) {
  return {
    id: r.id,
    reportNumber: r.reportNumber,
    title: r.title,
    status: r.status,
    ddType: r.ddType,
    target: {
      entityName: r.targetEntityName,
      entityId: r.targetEntityId,
      transactionValue: r.transactionValue,
      transactionCurrency: r.transactionCurrency,
    },
    timeline: {
      initiatedDate: r.initiatedDate.toISOString(),
      documentRequestDate: r.documentRequestDate?.toISOString(),
      documentsReceivedDate: r.documentsReceivedDate?.toISOString(),
      analysisStartDate: r.analysisStartDate?.toISOString(),
      draftReportDate: r.draftReportDate?.toISOString(),
      finalReportDate: r.finalReportDate?.toISOString(),
      dealCloseDate: r.dealCloseDate?.toISOString(),
      daysUntilClose: r.getDaysUntilClose(),
    },
    scope: {
      ipTypesInScope: r.ipTypesInScope,
      jurisdictionsInScope: r.jurisdictionsInScope,
      materialsReviewed: r.materialsReviewed,
    },
    portfolio: {
      patentCount: r.patentCount,
      trademarkCount: r.trademarkCount,
      copyrightCount: r.copyrightCount,
      tradeSecretCount: r.tradeSecretCount,
      licenseCount: r.licenseCount,
      totalAssetCount: r.getTotalAssetCount(),
    },
    valuation: {
      statedValue: r.statedPortfolioValue,
      assessedValue: r.assessedPortfolioValue,
      gapNotes: r.valuationGapNotes,
      gapPercentage: r.getValuationGapPercentage(),
    },
    findings: r.findings,
    criticalFindings: r.getCriticalFindings(),
    overallRiskRating: r.overallRiskRating,
    executiveSummary: r.executiveSummary,
    keyFindings: r.keyFindings,
    recommendations: r.recommendations,
    dealBreakerIssues: r.dealBreakerIssues,
    hasDealBreakers: r.hasDealBreakers(),
    team: {
      leadAnalyst: r.leadAnalyst,
      teamMembers: r.teamMembers,
      outsideCounselId: r.outsideCounselId,
    },
    workflow: {
      reviewedBy: r.reviewedBy,
      approvedBy: r.approvedBy,
      approvedDate: r.approvedDate?.toISOString(),
    },
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    version: r.version,
  };
}

export default strategyRoutes;
