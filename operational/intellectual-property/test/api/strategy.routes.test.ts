/**
 * Strategy Routes API Tests
 *
 * Tests for IP Strategy REST API endpoints: Valuations, FTO Analyses, Due Diligence Reports.
 *
 * @module test/api
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import supertest from 'supertest';
import { randomUUID } from 'crypto';
import { strategyRoutes } from '../../src/api/rest/routes/strategy.routes.js';

// ============================================================================
// MOCK REPOSITORIES
// ============================================================================

const mockValuationRepo = {
  save: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(),
  findByNumber: vi.fn(),
  search: vi.fn(),
  findByAsset: vi.fn(),
  delete: vi.fn().mockResolvedValue(undefined),
  generateNumber: vi.fn().mockResolvedValue('VAL-2026-0001'),
};

const mockFTORepo = {
  save: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(),
  findByNumber: vi.fn(),
  search: vi.fn(),
  findAtRisk: vi.fn(),
  delete: vi.fn().mockResolvedValue(undefined),
  generateNumber: vi.fn().mockResolvedValue('FTO-2026-0001'),
};

const mockDDRepo = {
  save: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(),
  findByNumber: vi.fn(),
  search: vi.fn(),
  findInProgress: vi.fn(),
  delete: vi.fn().mockResolvedValue(undefined),
  generateNumber: vi.fn().mockResolvedValue('DD-2026-0001'),
};

// Mock the repository module
vi.mock('../../src/infrastructure/persistence/strategy.repository.js', () => ({
  IPValuationRepository: vi.fn().mockImplementation(() => mockValuationRepo),
  FTOAnalysisRepository: vi.fn().mockImplementation(() => mockFTORepo),
  DueDiligenceRepository: vi.fn().mockImplementation(() => mockDDRepo),
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockValuation(overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  const now = new Date();
  return {
    id,
    valuationNumber: 'VAL-2026-0001',
    title: 'Test Valuation',
    status: 'draft',
    purpose: 'financial_reporting',
    methodology: 'income',
    ipAssets: [{ type: 'patent', id: randomUUID(), name: 'Test Patent', weight: 1 }],
    valuationDate: now,
    effectiveDate: now,
    expirationDate: undefined,
    lowValue: undefined,
    midValue: undefined,
    highValue: undefined,
    selectedValue: undefined,
    currency: 'USD',
    assumptions: [],
    discountRate: undefined,
    royaltyRate: undefined,
    projectionYears: undefined,
    terminalGrowthRate: undefined,
    comparableTransactions: [],
    sensitivities: [],
    conclusionSummary: undefined,
    limitations: undefined,
    preparedBy: randomUUID(),
    reviewedBy: undefined,
    approvedBy: undefined,
    approvedDate: undefined,
    externalAppraiser: undefined,
    appraisalReportRef: undefined,
    createdAt: now,
    updatedAt: now,
    version: 1,
    isExpired: () => false,
    getValueRangePercentage: () => undefined,
    setModelParameters: vi.fn(),
    setValueRange: vi.fn(),
    setConclusion: vi.fn(),
    startAnalysis: vi.fn(),
    submitForReview: vi.fn(),
    review: vi.fn(),
    approve: vi.fn(),
    ...overrides,
  };
}

function createMockFTOAnalysis(overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  const now = new Date();
  return {
    id,
    analysisNumber: 'FTO-2026-0001',
    title: 'Test FTO Analysis',
    status: 'initiated',
    overallRisk: undefined,
    productName: 'Test Product',
    productDescription: 'A test product description',
    technicalSpecification: undefined,
    targetMarkets: ['US', 'EU'],
    launchDate: undefined,
    jurisdictions: ['US'],
    patentClassifications: [],
    searchStrategy: undefined,
    initiatedDate: now,
    searchCompletedDate: undefined,
    analysisCompletedDate: undefined,
    reviewCompletedDate: undefined,
    patentsSearched: 0,
    patentsReviewed: 0,
    potentialIssuesCount: 0,
    findings: [],
    recommendation: undefined,
    recommendedActions: [],
    assignedTo: randomUUID(),
    reviewedBy: undefined,
    approvedBy: undefined,
    outsideCounselId: undefined,
    outsideCounselOpinionRef: undefined,
    createdAt: now,
    updatedAt: now,
    version: 1,
    getBlockingFindings: () => [],
    isLaunchAtRisk: () => false,
    updateSearchStats: vi.fn(),
    completeSearch: vi.fn(),
    startAnalysis: vi.fn(),
    addFinding: vi.fn().mockReturnValue(randomUUID()),
    completeAnalysis: vi.fn(),
    review: vi.fn(),
    ...overrides,
  };
}

function createMockDDReport(overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  const now = new Date();
  return {
    id,
    reportNumber: 'DD-2026-0001',
    title: 'Test Due Diligence Report',
    status: 'initiated',
    ddType: 'acquisition',
    targetEntityName: 'Target Corp',
    targetEntityId: undefined,
    transactionValue: 10000000,
    transactionCurrency: 'USD',
    initiatedDate: now,
    documentRequestDate: undefined,
    documentsReceivedDate: undefined,
    analysisStartDate: undefined,
    draftReportDate: undefined,
    finalReportDate: undefined,
    dealCloseDate: undefined,
    ipTypesInScope: ['patents', 'trademarks'],
    jurisdictionsInScope: ['US'],
    materialsReviewed: [],
    patentCount: 0,
    trademarkCount: 0,
    copyrightCount: 0,
    tradeSecretCount: 0,
    licenseCount: 0,
    statedPortfolioValue: undefined,
    assessedPortfolioValue: undefined,
    valuationGapNotes: undefined,
    findings: [],
    overallRiskRating: undefined,
    executiveSummary: undefined,
    keyFindings: undefined,
    recommendations: undefined,
    dealBreakerIssues: [],
    leadAnalyst: randomUUID(),
    teamMembers: [],
    outsideCounselId: undefined,
    reviewedBy: undefined,
    approvedBy: undefined,
    approvedDate: undefined,
    createdAt: now,
    updatedAt: now,
    version: 1,
    getTotalAssetCount: () => 0,
    getValuationGapPercentage: () => undefined,
    getCriticalFindings: () => [],
    hasDealBreakers: () => false,
    getDaysUntilClose: () => undefined,
    sendDocumentRequest: vi.fn(),
    documentsReceived: vi.fn(),
    startAnalysis: vi.fn(),
    addFinding: vi.fn().mockReturnValue(randomUUID()),
    updatePortfolioCounts: vi.fn(),
    setValuation: vi.fn(),
    submitDraftReport: vi.fn(),
    review: vi.fn(),
    terminate: vi.fn(),
    ...overrides,
  };
}

// ============================================================================
// TEST APP BUILDER
// ============================================================================

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Add error handler for Zod validation errors
  app.setErrorHandler((error, _request, reply) => {
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error.issues,
      });
    }
    // Re-throw other errors
    return reply.status(500).send({ error: error.message });
  });

  // Decorate with mock db (required by routes)
  app.decorate('db', {});

  // Register strategy routes
  await app.register(strategyRoutes, { prefix: '/api/v1/strategy' });

  await app.ready();
  return app;
}

// ============================================================================
// TESTS
// ============================================================================

describe.sequential('Strategy Routes API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock implementations to default (return null/empty)
    mockValuationRepo.findById.mockReset().mockResolvedValue(null);
    mockFTORepo.findById.mockReset().mockResolvedValue(null);
    mockDDRepo.findById.mockReset().mockResolvedValue(null);
    mockValuationRepo.search.mockReset().mockResolvedValue({ valuations: [], total: 0 });
    mockFTORepo.search.mockReset().mockResolvedValue({ analyses: [], total: 0 });
    mockDDRepo.search.mockReset().mockResolvedValue({ reports: [], total: 0 });
    mockFTORepo.findAtRisk.mockReset().mockResolvedValue([]);
    mockDDRepo.findInProgress.mockReset().mockResolvedValue([]);
  });

  // ==========================================================================
  // VALUATION ROUTES
  // ==========================================================================

  describe('Valuations', () => {
    describe('POST /api/v1/strategy/valuations', () => {
      it('should create a valuation and return 201', async () => {
        const payload = {
          title: 'Patent Portfolio Valuation',
          purpose: 'financial_reporting',
          methodology: 'income',
          ipAssets: [{ type: 'patent', id: randomUUID(), name: 'Test Patent' }],
          valuationDate: new Date().toISOString(),
          effectiveDate: new Date().toISOString(),
          currency: 'USD',
          preparedBy: randomUUID(),
        };

        const response = await supertest(app.server)
          .post('/api/v1/strategy/valuations')
          .send(payload)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('valuationNumber', 'VAL-2026-0001');
        expect(mockValuationRepo.save).toHaveBeenCalled();
      });

      it('should return 400 for missing required fields', async () => {
        const payload = {
          title: 'Incomplete Valuation',
          // Missing: purpose, methodology, ipAssets, valuationDate, effectiveDate, preparedBy
        };

        const response = await supertest(app.server)
          .post('/api/v1/strategy/valuations')
          .send(payload)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should return 400 for invalid purpose value', async () => {
        const payload = {
          title: 'Test Valuation',
          purpose: 'invalid_purpose',
          methodology: 'income',
          ipAssets: [{ type: 'patent', id: randomUUID(), name: 'Test' }],
          valuationDate: new Date().toISOString(),
          effectiveDate: new Date().toISOString(),
          preparedBy: randomUUID(),
        };

        const response = await supertest(app.server)
          .post('/api/v1/strategy/valuations')
          .send(payload)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should return 400 for empty ipAssets array', async () => {
        const payload = {
          title: 'Test Valuation',
          purpose: 'financial_reporting',
          methodology: 'income',
          ipAssets: [],
          valuationDate: new Date().toISOString(),
          effectiveDate: new Date().toISOString(),
          preparedBy: randomUUID(),
        };

        const response = await supertest(app.server)
          .post('/api/v1/strategy/valuations')
          .send(payload)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/v1/strategy/valuations/:id', () => {
      it('should return a valuation by ID', async () => {
        const mockValuation = createMockValuation();
        mockValuationRepo.findById.mockResolvedValueOnce(mockValuation);

        const response = await supertest(app.server)
          .get(`/api/v1/strategy/valuations/${mockValuation.id}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', mockValuation.id);
        expect(response.body).toHaveProperty('title', mockValuation.title);
        expect(response.body).toHaveProperty('status', 'draft');
      });

      it('should return 404 for non-existent valuation', async () => {
        mockValuationRepo.findById.mockResolvedValueOnce(null);

        const response = await supertest(app.server)
          .get(`/api/v1/strategy/valuations/${randomUUID()}`)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Valuation not found');
      });
    });

    describe('GET /api/v1/strategy/valuations', () => {
      it('should return a list of valuations', async () => {
        const mockValuations = [createMockValuation(), createMockValuation()];
        mockValuationRepo.search.mockResolvedValueOnce({
          valuations: mockValuations,
          total: 2,
        });

        const response = await supertest(app.server)
          .get('/api/v1/strategy/valuations')
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveLength(2);
        expect(response.body).toHaveProperty('total', 2);
        expect(response.body).toHaveProperty('limit', 50);
        expect(response.body).toHaveProperty('offset', 0);
      });

      it('should support pagination', async () => {
        mockValuationRepo.search.mockResolvedValueOnce({
          valuations: [createMockValuation()],
          total: 100,
        });

        const response = await supertest(app.server)
          .get('/api/v1/strategy/valuations?limit=10&offset=20')
          .expect(200);

        expect(response.body).toHaveProperty('limit', 10);
        expect(response.body).toHaveProperty('offset', 20);
        expect(mockValuationRepo.search).toHaveBeenCalledWith(
          expect.any(Object),
          10,
          20
        );
      });

      it('should support filtering by status', async () => {
        mockValuationRepo.search.mockResolvedValueOnce({
          valuations: [],
          total: 0,
        });

        await supertest(app.server)
          .get('/api/v1/strategy/valuations?status=approved')
          .expect(200);

        expect(mockValuationRepo.search).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'approved' }),
          50,
          0
        );
      });
    });

    describe('PATCH /api/v1/strategy/valuations/:id', () => {
      it('should update valuation model parameters', async () => {
        const mockValuation = createMockValuation();
        mockValuationRepo.findById.mockResolvedValueOnce(mockValuation);

        const response = await supertest(app.server)
          .patch(`/api/v1/strategy/valuations/${mockValuation.id}`)
          .send({
            discountRate: 1000,
            royaltyRate: 500,
          })
          .expect(200);

        expect(response.body).toHaveProperty('id', mockValuation.id);
        expect(mockValuation.setModelParameters).toHaveBeenCalledWith(
          expect.objectContaining({
            discountRate: 1000,
            royaltyRate: 500,
          }),
          undefined
        );
      });

      it('should return 404 for non-existent valuation', async () => {
        mockValuationRepo.findById.mockResolvedValueOnce(null);

        const response = await supertest(app.server)
          .patch(`/api/v1/strategy/valuations/${randomUUID()}`)
          .send({ title: 'Updated' })
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Valuation not found');
      });
    });

    describe('POST /api/v1/strategy/valuations/:id/start-analysis', () => {
      it('should start analysis on a valuation', async () => {
        const mockValuation = createMockValuation();
        mockValuationRepo.findById.mockResolvedValueOnce(mockValuation);

        const response = await supertest(app.server)
          .post(`/api/v1/strategy/valuations/${mockValuation.id}/start-analysis`)
          .expect(200);

        expect(response.body).toHaveProperty('id', mockValuation.id);
        expect(mockValuation.startAnalysis).toHaveBeenCalled();
      });

      it('should return 404 for non-existent valuation', async () => {
        mockValuationRepo.findById.mockResolvedValueOnce(null);

        const response = await supertest(app.server)
          .post(`/api/v1/strategy/valuations/${randomUUID()}/start-analysis`)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Valuation not found');
      });
    });

    describe('DELETE /api/v1/strategy/valuations/:id', () => {
      it('should delete a valuation and return 204', async () => {
        const id = randomUUID();

        await supertest(app.server)
          .delete(`/api/v1/strategy/valuations/${id}`)
          .expect(204);

        expect(mockValuationRepo.delete).toHaveBeenCalledWith(id);
      });
    });
  });

  // ==========================================================================
  // FTO ANALYSIS ROUTES
  // ==========================================================================

  describe('FTO Analyses', () => {
    describe('POST /api/v1/strategy/fto-analyses', () => {
      it('should create an FTO analysis and return 201', async () => {
        const payload = {
          title: 'Product Launch FTO',
          productName: 'Widget Pro',
          productDescription: 'Advanced widget for manufacturing',
          jurisdictions: ['US', 'EU'],
          assignedTo: randomUUID(),
        };

        const response = await supertest(app.server)
          .post('/api/v1/strategy/fto-analyses')
          .send(payload)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('analysisNumber', 'FTO-2026-0001');
        expect(mockFTORepo.save).toHaveBeenCalled();
      });

      it('should return 400 for missing required fields', async () => {
        const payload = {
          title: 'Incomplete FTO',
          // Missing: productName, productDescription, jurisdictions, assignedTo
        };

        const response = await supertest(app.server)
          .post('/api/v1/strategy/fto-analyses')
          .send(payload)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should return 400 for empty jurisdictions array', async () => {
        const payload = {
          title: 'Test FTO',
          productName: 'Widget',
          productDescription: 'A widget',
          jurisdictions: [],
          assignedTo: randomUUID(),
        };

        const response = await supertest(app.server)
          .post('/api/v1/strategy/fto-analyses')
          .send(payload)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/v1/strategy/fto-analyses/:id', () => {
      it('should return an FTO analysis by ID', async () => {
        const mockFTO = createMockFTOAnalysis();
        mockFTORepo.findById.mockResolvedValueOnce(mockFTO);

        const response = await supertest(app.server)
          .get(`/api/v1/strategy/fto-analyses/${mockFTO.id}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', mockFTO.id);
        expect(response.body).toHaveProperty('title', mockFTO.title);
        expect(response.body).toHaveProperty('status', 'initiated');
        expect(response.body).toHaveProperty('product');
        expect(response.body.product).toHaveProperty('name', 'Test Product');
      });

      it('should return 404 for non-existent FTO analysis', async () => {
        mockFTORepo.findById.mockResolvedValueOnce(null);

        const response = await supertest(app.server)
          .get(`/api/v1/strategy/fto-analyses/${randomUUID()}`)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'FTO Analysis not found');
      });
    });

    describe('GET /api/v1/strategy/fto-analyses', () => {
      it('should return a list of FTO analyses', async () => {
        const mockAnalyses = [createMockFTOAnalysis(), createMockFTOAnalysis()];
        mockFTORepo.search.mockResolvedValueOnce({
          analyses: mockAnalyses,
          total: 2,
        });

        const response = await supertest(app.server)
          .get('/api/v1/strategy/fto-analyses')
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveLength(2);
        expect(response.body).toHaveProperty('total', 2);
      });

      it('should support filtering by risk level', async () => {
        mockFTORepo.search.mockResolvedValueOnce({
          analyses: [],
          total: 0,
        });

        await supertest(app.server)
          .get('/api/v1/strategy/fto-analyses?overallRisk=high')
          .expect(200);

        expect(mockFTORepo.search).toHaveBeenCalledWith(
          expect.objectContaining({ overallRisk: 'high' }),
          50,
          0
        );
      });
    });

    describe('GET /api/v1/strategy/fto-analyses/at-risk', () => {
      it('should return at-risk FTO analyses', async () => {
        const mockAnalyses = [
          createMockFTOAnalysis({ overallRisk: 'high' }),
          createMockFTOAnalysis({ overallRisk: 'blocking' }),
        ];
        mockFTORepo.findAtRisk.mockResolvedValueOnce(mockAnalyses);

        const response = await supertest(app.server)
          .get('/api/v1/strategy/fto-analyses/at-risk')
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveLength(2);
        expect(response.body).toHaveProperty('total', 2);
      });
    });

    describe('POST /api/v1/strategy/fto-analyses/:id/complete-search', () => {
      it('should complete the search phase', async () => {
        const mockFTO = createMockFTOAnalysis();
        mockFTORepo.findById.mockResolvedValueOnce(mockFTO);

        const response = await supertest(app.server)
          .post(`/api/v1/strategy/fto-analyses/${mockFTO.id}/complete-search`)
          .send({ patentsSearched: 150, patentsReviewed: 75 })
          .expect(200);

        expect(response.body).toHaveProperty('id', mockFTO.id);
        expect(mockFTO.updateSearchStats).toHaveBeenCalledWith(
          { patentsSearched: 150, patentsReviewed: 75 },
          undefined
        );
        expect(mockFTO.completeSearch).toHaveBeenCalled();
      });

      it('should return 404 for non-existent FTO analysis', async () => {
        mockFTORepo.findById.mockResolvedValueOnce(null);

        const response = await supertest(app.server)
          .post(`/api/v1/strategy/fto-analyses/${randomUUID()}/complete-search`)
          .send({ patentsSearched: 100, patentsReviewed: 50 })
          .expect(404);

        expect(response.body).toHaveProperty('error', 'FTO Analysis not found');
      });
    });

    describe('POST /api/v1/strategy/fto-analyses/:id/findings', () => {
      it('should add a finding to the FTO analysis', async () => {
        const mockFTO = createMockFTOAnalysis();
        mockFTORepo.findById.mockResolvedValueOnce(mockFTO);

        const payload = {
          patentNumber: 'US10,123,456',
          patentTitle: 'Widget Manufacturing Method',
          jurisdiction: 'US',
          findingType: 'potential_issue',
          riskLevel: 'moderate',
          analysisNotes: 'Claim 1 may overlap with our design',
        };

        const response = await supertest(app.server)
          .post(`/api/v1/strategy/fto-analyses/${mockFTO.id}/findings`)
          .send(payload)
          .expect(201);

        expect(response.body).toHaveProperty('findingId');
        expect(mockFTO.addFinding).toHaveBeenCalled();
      });

      it('should return 400 for invalid finding type', async () => {
        const mockFTO = createMockFTOAnalysis();
        mockFTORepo.findById.mockResolvedValueOnce(mockFTO);

        const payload = {
          patentNumber: 'US10,123,456',
          patentTitle: 'Widget Method',
          jurisdiction: 'US',
          findingType: 'invalid_type',
          riskLevel: 'moderate',
          analysisNotes: 'Test',
        };

        const response = await supertest(app.server)
          .post(`/api/v1/strategy/fto-analyses/${mockFTO.id}/findings`)
          .send(payload)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('DELETE /api/v1/strategy/fto-analyses/:id', () => {
      it('should delete an FTO analysis and return 204', async () => {
        const id = randomUUID();

        await supertest(app.server)
          .delete(`/api/v1/strategy/fto-analyses/${id}`)
          .expect(204);

        expect(mockFTORepo.delete).toHaveBeenCalledWith(id);
      });
    });
  });

  // ==========================================================================
  // DUE DILIGENCE ROUTES
  // ==========================================================================

  describe('Due Diligence', () => {
    describe('POST /api/v1/strategy/due-diligence', () => {
      it('should create a due diligence report and return 201', async () => {
        const payload = {
          title: 'Target Corp IP Due Diligence',
          ddType: 'acquisition',
          targetEntityName: 'Target Corporation',
          ipTypesInScope: ['patents', 'trademarks'],
          leadAnalyst: randomUUID(),
        };

        const response = await supertest(app.server)
          .post('/api/v1/strategy/due-diligence')
          .send(payload)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('reportNumber', 'DD-2026-0001');
        expect(mockDDRepo.save).toHaveBeenCalled();
      });

      it('should return 400 for missing required fields', async () => {
        const payload = {
          title: 'Incomplete DD',
          // Missing: ddType, targetEntityName, ipTypesInScope, leadAnalyst
        };

        const response = await supertest(app.server)
          .post('/api/v1/strategy/due-diligence')
          .send(payload)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should return 400 for invalid ddType', async () => {
        const payload = {
          title: 'Test DD',
          ddType: 'invalid_type',
          targetEntityName: 'Target Corp',
          ipTypesInScope: ['patents'],
          leadAnalyst: randomUUID(),
        };

        const response = await supertest(app.server)
          .post('/api/v1/strategy/due-diligence')
          .send(payload)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should return 400 for empty ipTypesInScope', async () => {
        const payload = {
          title: 'Test DD',
          ddType: 'acquisition',
          targetEntityName: 'Target Corp',
          ipTypesInScope: [],
          leadAnalyst: randomUUID(),
        };

        const response = await supertest(app.server)
          .post('/api/v1/strategy/due-diligence')
          .send(payload)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/v1/strategy/due-diligence/:id', () => {
      it('should return a DD report by ID', async () => {
        const mockDD = createMockDDReport();
        mockDDRepo.findById.mockResolvedValueOnce(mockDD);

        const response = await supertest(app.server)
          .get(`/api/v1/strategy/due-diligence/${mockDD.id}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', mockDD.id);
        expect(response.body).toHaveProperty('title', mockDD.title);
        expect(response.body).toHaveProperty('status', 'initiated');
        expect(response.body).toHaveProperty('target');
        expect(response.body.target).toHaveProperty('entityName', 'Target Corp');
      });

      it('should return 404 for non-existent DD report', async () => {
        mockDDRepo.findById.mockResolvedValueOnce(null);

        const response = await supertest(app.server)
          .get(`/api/v1/strategy/due-diligence/${randomUUID()}`)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Due Diligence Report not found');
      });
    });

    describe('GET /api/v1/strategy/due-diligence', () => {
      it('should return a list of DD reports', async () => {
        const mockReports = [createMockDDReport(), createMockDDReport()];
        mockDDRepo.search.mockResolvedValueOnce({
          reports: mockReports,
          total: 2,
        });

        const response = await supertest(app.server)
          .get('/api/v1/strategy/due-diligence')
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveLength(2);
        expect(response.body).toHaveProperty('total', 2);
      });

      it('should support filtering by ddType', async () => {
        mockDDRepo.search.mockResolvedValueOnce({
          reports: [],
          total: 0,
        });

        await supertest(app.server)
          .get('/api/v1/strategy/due-diligence?ddType=acquisition')
          .expect(200);

        expect(mockDDRepo.search).toHaveBeenCalledWith(
          expect.objectContaining({ ddType: 'acquisition' }),
          50,
          0
        );
      });
    });

    describe('GET /api/v1/strategy/due-diligence/in-progress', () => {
      it('should return in-progress DD reports', async () => {
        const mockReports = [
          createMockDDReport({ status: 'document_review' }),
          createMockDDReport({ status: 'analysis' }),
        ];
        mockDDRepo.findInProgress.mockResolvedValueOnce(mockReports);

        const response = await supertest(app.server)
          .get('/api/v1/strategy/due-diligence/in-progress')
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveLength(2);
        expect(response.body).toHaveProperty('total', 2);
      });
    });

    describe('POST /api/v1/strategy/due-diligence/:id/request-documents', () => {
      it('should send document request', async () => {
        const mockDD = createMockDDReport();
        mockDDRepo.findById.mockResolvedValueOnce(mockDD);

        const response = await supertest(app.server)
          .post(`/api/v1/strategy/due-diligence/${mockDD.id}/request-documents`)
          .expect(200);

        expect(response.body).toHaveProperty('id', mockDD.id);
        expect(mockDD.sendDocumentRequest).toHaveBeenCalled();
      });

      it('should return 404 for non-existent DD report', async () => {
        mockDDRepo.findById.mockResolvedValueOnce(null);

        const response = await supertest(app.server)
          .post(`/api/v1/strategy/due-diligence/${randomUUID()}/request-documents`)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Due Diligence Report not found');
      });
    });

    describe('POST /api/v1/strategy/due-diligence/:id/findings', () => {
      it('should add a finding to the DD report', async () => {
        const mockDD = createMockDDReport();
        mockDDRepo.findById.mockResolvedValueOnce(mockDD);

        const payload = {
          category: 'ownership',
          severity: 'major',
          title: 'Chain of Title Gap',
          description: 'Missing assignment from original inventor',
        };

        const response = await supertest(app.server)
          .post(`/api/v1/strategy/due-diligence/${mockDD.id}/findings`)
          .send(payload)
          .expect(201);

        expect(response.body).toHaveProperty('findingId');
        expect(mockDD.addFinding).toHaveBeenCalled();
      });

      it('should return 400 for invalid severity', async () => {
        const mockDD = createMockDDReport();
        mockDDRepo.findById.mockResolvedValueOnce(mockDD);

        const payload = {
          category: 'ownership',
          severity: 'invalid_severity',
          title: 'Test Finding',
          description: 'Test description',
        };

        const response = await supertest(app.server)
          .post(`/api/v1/strategy/due-diligence/${mockDD.id}/findings`)
          .send(payload)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('PATCH /api/v1/strategy/due-diligence/:id/portfolio', () => {
      it('should update portfolio counts', async () => {
        const mockDD = createMockDDReport();
        mockDDRepo.findById.mockResolvedValueOnce(mockDD);

        const response = await supertest(app.server)
          .patch(`/api/v1/strategy/due-diligence/${mockDD.id}/portfolio`)
          .send({
            patents: 25,
            trademarks: 10,
            copyrights: 5,
          })
          .expect(200);

        expect(response.body.id).toBe(mockDD.id);
        expect(mockDD.updatePortfolioCounts).toHaveBeenCalledWith(
          { patents: 25, trademarks: 10, copyrights: 5 },
          undefined
        );
      });

      it('should return 404 for non-existent DD report', async () => {
        mockDDRepo.findById.mockResolvedValueOnce(null);

        const response = await supertest(app.server)
          .patch(`/api/v1/strategy/due-diligence/${randomUUID()}/portfolio`)
          .send({ patents: 10 })
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Due Diligence Report not found');
      });
    });

    describe('PATCH /api/v1/strategy/due-diligence/:id/valuation', () => {
      it('should set valuation data', async () => {
        const mockDD = createMockDDReport();
        mockDDRepo.findById.mockResolvedValueOnce(mockDD);

        const response = await supertest(app.server)
          .patch(`/api/v1/strategy/due-diligence/${mockDD.id}/valuation`)
          .send({
            statedValue: 5000000,
            assessedValue: 4000000,
            gapNotes: 'Several patents near expiration',
          })
          .expect(200);

        expect(response.body.id).toBe(mockDD.id);
        expect(mockDD.setValuation).toHaveBeenCalledWith(
          {
            statedValue: 5000000,
            assessedValue: 4000000,
            gapNotes: 'Several patents near expiration',
          },
          undefined
        );
      });

      it('should return 404 for non-existent DD report', async () => {
        mockDDRepo.findById.mockResolvedValueOnce(null);

        const response = await supertest(app.server)
          .patch(`/api/v1/strategy/due-diligence/${randomUUID()}/valuation`)
          .send({ statedValue: 5000000, assessedValue: 4000000 })
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Due Diligence Report not found');
      });
    });

    describe('POST /api/v1/strategy/due-diligence/:id/terminate', () => {
      it('should terminate the DD report', async () => {
        const mockDD = createMockDDReport();
        mockDDRepo.findById.mockResolvedValueOnce(mockDD);

        const response = await supertest(app.server)
          .post(`/api/v1/strategy/due-diligence/${mockDD.id}/terminate`)
          .send({ reason: 'Deal cancelled by buyer' })
          .expect(200);

        expect(response.body.id).toBe(mockDD.id);
        expect(mockDD.terminate).toHaveBeenCalledWith(
          'Deal cancelled by buyer',
          undefined
        );
      });

      it('should return 404 for non-existent DD report', async () => {
        mockDDRepo.findById.mockResolvedValueOnce(null);

        const response = await supertest(app.server)
          .post(`/api/v1/strategy/due-diligence/${randomUUID()}/terminate`)
          .send({ reason: 'Deal cancelled' })
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Due Diligence Report not found');
      });
    });

    describe('DELETE /api/v1/strategy/due-diligence/:id', () => {
      it('should delete a DD report and return 204', async () => {
        const id = randomUUID();

        await supertest(app.server)
          .delete(`/api/v1/strategy/due-diligence/${id}`)
          .expect(204);

        expect(mockDDRepo.delete).toHaveBeenCalledWith(id);
      });
    });
  });

  // ==========================================================================
  // SCHEMA VALIDATION TESTS
  // ==========================================================================

  describe('Schema Validation', () => {
    describe('Valuation schemas', () => {
      it('should validate all purpose values', async () => {
        const validPurposes = [
          'financial_reporting', 'tax', 'litigation', 'licensing',
          'sale', 'financing', 'insurance', 'internal_planning', 'm_and_a'
        ];

        for (const purpose of validPurposes) {
          const payload = {
            title: 'Test',
            purpose,
            methodology: 'income',
            ipAssets: [{ type: 'patent', id: randomUUID(), name: 'Test' }],
            valuationDate: new Date().toISOString(),
            effectiveDate: new Date().toISOString(),
            preparedBy: randomUUID(),
          };

          const response = await supertest(app.server)
            .post('/api/v1/strategy/valuations')
            .send(payload);

          expect(response.status).toBe(201);
        }
      });

      it('should validate all methodology values', async () => {
        const validMethodologies = [
          'cost', 'market', 'income', 'relief_from_royalty',
          'excess_earnings', 'real_options', 'monte_carlo', 'comparable_transactions'
        ];

        for (const methodology of validMethodologies) {
          const payload = {
            title: 'Test',
            purpose: 'financial_reporting',
            methodology,
            ipAssets: [{ type: 'patent', id: randomUUID(), name: 'Test' }],
            valuationDate: new Date().toISOString(),
            effectiveDate: new Date().toISOString(),
            preparedBy: randomUUID(),
          };

          const response = await supertest(app.server)
            .post('/api/v1/strategy/valuations')
            .send(payload);

          expect(response.status).toBe(201);
        }
      });
    });

    describe('FTO schemas', () => {
      it('should validate all risk level values', async () => {
        const validRiskLevels = ['clear', 'low', 'moderate', 'high', 'blocking'];

        for (const riskLevel of validRiskLevels) {
          const mockFTO = createMockFTOAnalysis();
          mockFTORepo.findById.mockResolvedValueOnce(mockFTO);

          const payload = {
            patentNumber: 'US10,123,456',
            patentTitle: 'Test Patent',
            jurisdiction: 'US',
            findingType: 'clear',
            riskLevel,
            analysisNotes: 'Test notes',
          };

          const response = await supertest(app.server)
            .post(`/api/v1/strategy/fto-analyses/${mockFTO.id}/findings`)
            .send(payload);

          expect(response.status).toBe(201);
        }
      });

      it('should validate all finding type values', async () => {
        const validFindingTypes = [
          'clear', 'potential_issue', 'design_around_needed',
          'license_required', 'blocking', 'expired', 'narrow_claim'
        ];

        for (const findingType of validFindingTypes) {
          const mockFTO = createMockFTOAnalysis();
          mockFTORepo.findById.mockResolvedValueOnce(mockFTO);

          const payload = {
            patentNumber: 'US10,123,456',
            patentTitle: 'Test Patent',
            jurisdiction: 'US',
            findingType,
            riskLevel: 'moderate',
            analysisNotes: 'Test notes',
          };

          const response = await supertest(app.server)
            .post(`/api/v1/strategy/fto-analyses/${mockFTO.id}/findings`)
            .send(payload);

          expect(response.status).toBe(201);
        }
      });
    });

    describe('Due Diligence schemas', () => {
      it('should validate all ddType values', async () => {
        const validDDTypes = [
          'acquisition', 'divestiture', 'licensing_in', 'licensing_out',
          'investment', 'joint_venture', 'ipo', 'financing'
        ];

        for (const ddType of validDDTypes) {
          const payload = {
            title: 'Test DD',
            ddType,
            targetEntityName: 'Target Corp',
            ipTypesInScope: ['patents'],
            leadAnalyst: randomUUID(),
          };

          const response = await supertest(app.server)
            .post('/api/v1/strategy/due-diligence')
            .send(payload);

          expect(response.status).toBe(201);
        }
      });

      it('should validate all severity values for findings', async () => {
        const validSeverities = ['critical', 'major', 'moderate', 'minor', 'informational'];

        for (const severity of validSeverities) {
          const mockDD = createMockDDReport();
          mockDDRepo.findById.mockResolvedValueOnce(mockDD);

          const payload = {
            category: 'ownership',
            severity,
            title: 'Test Finding',
            description: 'Test description',
          };

          const response = await supertest(app.server)
            .post(`/api/v1/strategy/due-diligence/${mockDD.id}/findings`)
            .send(payload);

          expect(response.status).toBe(201);
        }
      });
    });
  });
});
