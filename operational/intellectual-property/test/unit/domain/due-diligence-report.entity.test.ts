/**
 * Due Diligence Report Entity Unit Tests
 *
 * Tests for the DueDiligenceReport domain entity.
 *
 * @module test/unit/domain
 */

import { describe, it, expect } from 'vitest';
import { DueDiligenceReport } from '../../../src/domain/entities/due-diligence-report.entity.js';

describe('DueDiligenceReport Entity', () => {
  const createTestReport = () => DueDiligenceReport.create({
    title: 'IP Portfolio Due Diligence - Acme Corp Acquisition',
    ddType: 'acquisition',
    targetEntityName: 'Acme Corporation',
    targetEntityId: 'entity-acme-123',
    transactionValue: 50000000,
    transactionCurrency: 'USD',
    ipTypesInScope: ['patents', 'trademarks', 'trade_secrets'],
    jurisdictionsInScope: ['US', 'EP', 'CN'],
    dealCloseDate: new Date('2024-06-30'),
    leadAnalyst: 'analyst-001',
    teamMembers: ['analyst-002', 'analyst-003'],
  });

  const createTestFinding = (overrides = {}) => ({
    category: 'ownership',
    severity: 'major' as const,
    title: 'Incomplete Patent Assignment Chain',
    description: 'Patent US10,123,456 has a gap in the assignment chain from the original inventor.',
    affectedAssets: [{ type: 'patent', id: 'pat-123', name: 'US10,123,456' }],
    financialImpact: 500000,
    impactDescription: 'May require corrective assignment or could affect enforceability.',
    mitigationOptions: [
      { option: 'Obtain corrective assignment', cost: 15000, timeframe: '2-4 weeks', feasibility: 'high' },
      { option: 'Title insurance', cost: 50000, feasibility: 'medium' },
    ],
    recommendedAction: 'Obtain corrective assignment from inventor prior to close.',
    suggestedRepresentations: 'Seller represents clear chain of title to all patents.',
    suggestedIndemnities: 'Seller shall indemnify for any title defects.',
    escrowRecommendation: 'Hold $500,000 in escrow for 12 months.',
    priceAdjustmentRecommendation: undefined,
    ...overrides,
  });

  describe('create', () => {
    it('should create a report with initiated status', () => {
      const report = createTestReport();

      expect(report.status).toBe('initiated');
      expect(report.title).toBe('IP Portfolio Due Diligence - Acme Corp Acquisition');
      expect(report.ddType).toBe('acquisition');
    });

    it('should generate a unique ID', () => {
      const report1 = createTestReport();
      const report2 = createTestReport();

      expect(report1.id).toBeDefined();
      expect(report2.id).toBeDefined();
      expect(report1.id).not.toBe(report2.id);
    });

    it('should have correct initial properties', () => {
      const report = createTestReport();

      expect(report.targetEntityName).toBe('Acme Corporation');
      expect(report.targetEntityId).toBe('entity-acme-123');
      expect(report.transactionValue).toBe(50000000);
      expect(report.transactionCurrency).toBe('USD');
      expect(report.leadAnalyst).toBe('analyst-001');
    });

    it('should have correct initial team members', () => {
      const report = createTestReport();

      expect(report.teamMembers).toHaveLength(2);
      expect(report.teamMembers).toContain('analyst-002');
      expect(report.teamMembers).toContain('analyst-003');
    });

    it('should have correct IP types in scope', () => {
      const report = createTestReport();

      expect(report.ipTypesInScope).toHaveLength(3);
      expect(report.ipTypesInScope).toContain('patents');
      expect(report.ipTypesInScope).toContain('trademarks');
    });

    it('should have correct jurisdictions in scope', () => {
      const report = createTestReport();

      expect(report.jurisdictionsInScope).toHaveLength(3);
      expect(report.jurisdictionsInScope).toContain('US');
      expect(report.jurisdictionsInScope).toContain('EP');
    });

    it('should emit DDReport.Initiated domain event', () => {
      const report = createTestReport();

      const events = report.domainEvents;
      const initiatedEvent = events.find(e => e.type === 'DDReport.Initiated');

      expect(initiatedEvent).toBeDefined();
      expect(initiatedEvent?.payload).toMatchObject({
        targetEntityName: 'Acme Corporation',
        ddType: 'acquisition',
        transactionValue: 50000000,
      });
    });

    it('should default currency to USD if not provided', () => {
      const report = DueDiligenceReport.create({
        title: 'Simple DD Report',
        ddType: 'licensing_in',
        targetEntityName: 'Target Inc',
        ipTypesInScope: ['patents'],
        jurisdictionsInScope: ['US'],
        leadAnalyst: 'analyst-001',
      });

      expect(report.transactionCurrency).toBe('USD');
    });

    it('should throw if no IP types in scope', () => {
      expect(() => DueDiligenceReport.create({
        title: 'Invalid Report',
        ddType: 'acquisition',
        targetEntityName: 'Target Inc',
        ipTypesInScope: [],
        jurisdictionsInScope: ['US'],
        leadAnalyst: 'analyst-001',
      })).toThrow('Due diligence must specify at least one IP type in scope');
    });

    it('should initialize with zero portfolio counts', () => {
      const report = createTestReport();

      expect(report.patentCount).toBe(0);
      expect(report.trademarkCount).toBe(0);
      expect(report.copyrightCount).toBe(0);
      expect(report.tradeSecretCount).toBe(0);
      expect(report.licenseCount).toBe(0);
    });

    it('should initialize with empty findings and materials', () => {
      const report = createTestReport();

      expect(report.findings).toHaveLength(0);
      expect(report.materialsReviewed).toHaveLength(0);
      expect(report.dealBreakerIssues).toHaveLength(0);
    });
  });

  describe('assignNumber', () => {
    it('should assign a report number', () => {
      const report = createTestReport();

      report.assignNumber('DD-2024-001', 'user-1');

      expect(report.reportNumber).toBe('DD-2024-001');
    });

    it('should throw if report number already assigned', () => {
      const report = createTestReport();
      report.assignNumber('DD-2024-001', 'user-1');

      expect(() => report.assignNumber('DD-2024-002', 'user-1'))
        .toThrow('Report number already assigned');
    });
  });

  describe('sendDocumentRequest', () => {
    it('should set document request date', () => {
      const report = createTestReport();

      report.sendDocumentRequest('user-1');

      expect(report.documentRequestDate).toBeDefined();
    });

    it('should throw if not in initiated status', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');

      expect(() => report.sendDocumentRequest('user-1'))
        .toThrow('Can only send document request from initiated status');
    });
  });

  describe('documentsReceived', () => {
    it('should transition to document_review status', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');

      report.documentsReceived('user-1');

      expect(report.status).toBe('document_review');
      expect(report.documentsReceivedDate).toBeDefined();
    });

    it('should throw if document request not sent', () => {
      const report = createTestReport();

      expect(() => report.documentsReceived('user-1'))
        .toThrow('Must send document request first');
    });
  });

  describe('addMaterialReviewed', () => {
    it('should add material during document review', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');

      report.addMaterialReviewed({
        category: 'patents',
        documentName: 'Patent Portfolio Schedule.xlsx',
        receivedDate: '2024-02-15',
        reviewer: 'analyst-002',
      }, 'user-1');

      expect(report.materialsReviewed).toHaveLength(1);
      expect(report.materialsReviewed[0].documentName).toBe('Patent Portfolio Schedule.xlsx');
    });

    it('should throw if not in document_review or analysis status', () => {
      const report = createTestReport();

      expect(() => report.addMaterialReviewed({
        category: 'patents',
        documentName: 'Test.xlsx',
        receivedDate: '2024-02-15',
        reviewer: 'analyst-001',
      }, 'user-1')).toThrow('Can only add materials during document review or analysis');
    });
  });

  describe('updatePortfolioCounts', () => {
    it('should update patent count', () => {
      const report = createTestReport();

      report.updatePortfolioCounts({ patents: 150 }, 'user-1');

      expect(report.patentCount).toBe(150);
    });

    it('should update multiple counts at once', () => {
      const report = createTestReport();

      report.updatePortfolioCounts({
        patents: 150,
        trademarks: 75,
        copyrights: 20,
        tradeSecrets: 10,
        licenses: 25,
      }, 'user-1');

      expect(report.patentCount).toBe(150);
      expect(report.trademarkCount).toBe(75);
      expect(report.copyrightCount).toBe(20);
      expect(report.tradeSecretCount).toBe(10);
      expect(report.licenseCount).toBe(25);
    });

    it('should only update specified counts', () => {
      const report = createTestReport();
      report.updatePortfolioCounts({ patents: 100 }, 'user-1');

      report.updatePortfolioCounts({ trademarks: 50 }, 'user-1');

      expect(report.patentCount).toBe(100);
      expect(report.trademarkCount).toBe(50);
    });
  });

  describe('setValuation', () => {
    it('should set valuation comparison', () => {
      const report = createTestReport();

      report.setValuation({
        statedValue: 25000000,
        assessedValue: 18000000,
        gapNotes: 'Several patents nearing expiration not reflected in stated value.',
      }, 'user-1');

      expect(report.statedPortfolioValue).toBe(25000000);
      expect(report.assessedPortfolioValue).toBe(18000000);
      expect(report.valuationGapNotes).toBe('Several patents nearing expiration not reflected in stated value.');
    });

    it('should allow valuation without gap notes', () => {
      const report = createTestReport();

      report.setValuation({
        statedValue: 10000000,
        assessedValue: 10000000,
      }, 'user-1');

      expect(report.statedPortfolioValue).toBe(10000000);
      expect(report.assessedPortfolioValue).toBe(10000000);
      expect(report.valuationGapNotes).toBeUndefined();
    });
  });

  describe('startAnalysis', () => {
    it('should transition from document_review to analysis', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');

      report.startAnalysis('user-1');

      expect(report.status).toBe('analysis');
      expect(report.analysisStartDate).toBeDefined();
    });

    it('should throw if not in document_review status', () => {
      const report = createTestReport();

      expect(() => report.startAnalysis('user-1'))
        .toThrow('Can only start analysis from document_review status');
    });
  });

  describe('addFinding', () => {
    const setupReportForAnalysis = () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');
      return report;
    };

    it('should add a finding and return finding ID', () => {
      const report = setupReportForAnalysis();

      const findingId = report.addFinding(createTestFinding(), 'user-1');

      expect(findingId).toBeDefined();
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0].title).toBe('Incomplete Patent Assignment Chain');
    });

    it('should set finding as unresolved by default', () => {
      const report = setupReportForAnalysis();

      report.addFinding(createTestFinding(), 'user-1');

      expect(report.findings[0].resolved).toBe(false);
      expect(report.findings[0].resolutionNotes).toBeUndefined();
    });

    it('should emit DDReport.FindingAdded event', () => {
      const report = setupReportForAnalysis();
      report.pullDomainEvents(); // Clear previous events

      report.addFinding(createTestFinding(), 'user-1');

      const events = report.domainEvents;
      const findingEvent = events.find(e => e.type === 'DDReport.FindingAdded');

      expect(findingEvent).toBeDefined();
      expect(findingEvent?.payload).toMatchObject({
        category: 'ownership',
        severity: 'major',
        title: 'Incomplete Patent Assignment Chain',
      });
    });

    it('should update overall risk rating based on finding severity', () => {
      const report = setupReportForAnalysis();

      report.addFinding(createTestFinding({ severity: 'minor' }), 'user-1');

      expect(report.overallRiskRating).toBe('minor');
    });

    it('should set highest severity as overall risk rating', () => {
      const report = setupReportForAnalysis();

      report.addFinding(createTestFinding({ severity: 'minor' }), 'user-1');
      report.addFinding(createTestFinding({ severity: 'major', title: 'Major Issue' }), 'user-1');
      report.addFinding(createTestFinding({ severity: 'moderate', title: 'Moderate Issue' }), 'user-1');

      expect(report.overallRiskRating).toBe('major');
    });

    it('should automatically add deal breaker for critical findings', () => {
      const report = setupReportForAnalysis();

      report.addFinding(createTestFinding({
        severity: 'critical',
        title: 'Critical IP Ownership Dispute',
      }), 'user-1');

      expect(report.dealBreakerIssues).toContain('Critical IP Ownership Dispute');
      expect(report.hasDealBreakers()).toBe(true);
    });

    it('should emit DDReport.DealBreakerIdentified for critical findings', () => {
      const report = setupReportForAnalysis();
      report.assignNumber('DD-2024-001', 'user-1');
      report.pullDomainEvents(); // Clear previous events

      report.addFinding(createTestFinding({
        severity: 'critical',
        title: 'Unresolved Patent Litigation',
      }), 'user-1');

      const events = report.domainEvents;
      const dealBreakerEvent = events.find(e => e.type === 'DDReport.DealBreakerIdentified');

      expect(dealBreakerEvent).toBeDefined();
      expect(dealBreakerEvent?.payload).toMatchObject({
        issue: 'Unresolved Patent Litigation',
        targetEntityName: 'Acme Corporation',
      });
    });

    it('should throw if not in analysis or findings_review status', () => {
      const report = createTestReport();

      expect(() => report.addFinding(createTestFinding(), 'user-1'))
        .toThrow('Can only add findings during analysis or review');
    });
  });

  describe('updateFinding', () => {
    it('should update finding properties', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');
      const findingId = report.addFinding(createTestFinding(), 'user-1');

      report.updateFinding(findingId, {
        severity: 'moderate',
        financialImpact: 250000,
      }, 'user-1');

      const finding = report.findings.find(f => f.id === findingId);
      expect(finding?.severity).toBe('moderate');
      expect(finding?.financialImpact).toBe(250000);
    });

    it('should recalculate overall risk after update', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');
      const findingId = report.addFinding(createTestFinding({ severity: 'major' }), 'user-1');

      report.updateFinding(findingId, { severity: 'minor' }, 'user-1');

      expect(report.overallRiskRating).toBe('minor');
    });

    it('should throw if finding not found', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');

      expect(() => report.updateFinding('non-existent-id', { severity: 'minor' }, 'user-1'))
        .toThrow('Finding non-existent-id not found');
    });
  });

  describe('resolveFinding', () => {
    it('should mark finding as resolved', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');
      const findingId = report.addFinding(createTestFinding(), 'user-1');

      report.resolveFinding(findingId, 'Corrective assignment obtained from inventor.', 'user-1');

      const finding = report.findings.find(f => f.id === findingId);
      expect(finding?.resolved).toBe(true);
      expect(finding?.resolutionNotes).toBe('Corrective assignment obtained from inventor.');
    });

    it('should recalculate overall risk after resolution', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');
      const findingId = report.addFinding(createTestFinding({ severity: 'major' }), 'user-1');

      report.resolveFinding(findingId, 'Resolved.', 'user-1');

      expect(report.overallRiskRating).toBeUndefined();
    });

    it('should throw if finding not found', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');

      expect(() => report.resolveFinding('non-existent-id', 'Notes', 'user-1'))
        .toThrow('Finding non-existent-id not found');
    });
  });

  describe('addDealBreaker', () => {
    it('should add a deal breaker issue', () => {
      const report = createTestReport();

      report.addDealBreaker('Pending patent infringement lawsuit', 'user-1');

      expect(report.dealBreakerIssues).toContain('Pending patent infringement lawsuit');
    });

    it('should not add duplicate deal breaker', () => {
      const report = createTestReport();

      report.addDealBreaker('Pending lawsuit', 'user-1');
      report.addDealBreaker('Pending lawsuit', 'user-1');

      expect(report.dealBreakerIssues.filter(i => i === 'Pending lawsuit')).toHaveLength(1);
    });

    it('should emit DDReport.DealBreakerIdentified event', () => {
      const report = createTestReport();
      report.pullDomainEvents(); // Clear previous events

      report.addDealBreaker('Critical ownership dispute', 'user-1');

      const events = report.domainEvents;
      const dealBreakerEvent = events.find(e => e.type === 'DDReport.DealBreakerIdentified');

      expect(dealBreakerEvent).toBeDefined();
      expect(dealBreakerEvent?.payload).toMatchObject({
        issue: 'Critical ownership dispute',
        targetEntityName: 'Acme Corporation',
      });
    });
  });

  describe('submitDraftReport', () => {
    it('should transition from analysis to findings_review', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');

      report.submitDraftReport({
        executiveSummary: 'The target IP portfolio contains 150 patents with moderate risk.',
        keyFindings: '1. Assignment chain gap on 3 patents. 2. Pending reexamination on key patent.',
        recommendations: 'Proceed with transaction with price adjustment of $500,000.',
      }, 'user-1');

      expect(report.status).toBe('findings_review');
      expect(report.draftReportDate).toBeDefined();
      expect(report.executiveSummary).toBe('The target IP portfolio contains 150 patents with moderate risk.');
    });

    it('should throw if not in analysis status', () => {
      const report = createTestReport();

      expect(() => report.submitDraftReport({
        executiveSummary: 'Summary',
        keyFindings: 'Findings',
        recommendations: 'Recommendations',
      }, 'user-1')).toThrow('Can only submit draft from analysis status');
    });
  });

  describe('review', () => {
    const setupReportForReview = () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');
      report.submitDraftReport({
        executiveSummary: 'Summary',
        keyFindings: 'Findings',
        recommendations: 'Recommendations',
      }, 'user-1');
      return report;
    };

    it('should return report to analysis when decision is return', () => {
      const report = setupReportForReview();

      report.review('reviewer-001', 'return', 'user-1');

      expect(report.status).toBe('analysis');
      expect(report.reviewedBy).toBe('reviewer-001');
    });

    it('should complete report when decision is approve', () => {
      const report = setupReportForReview();

      report.review('reviewer-001', 'approve', 'user-1');

      expect(report.status).toBe('complete');
      expect(report.finalReportDate).toBeDefined();
      expect(report.approvedBy).toBe('reviewer-001');
      expect(report.approvedDate).toBeDefined();
    });

    it('should emit DDReport.Completed event on approval', () => {
      const report = setupReportForReview();
      report.assignNumber('DD-2024-001', 'user-1');
      report.addFinding(createTestFinding({ severity: 'moderate' }), 'user-1');
      report.pullDomainEvents(); // Clear previous events

      report.review('reviewer-001', 'approve', 'user-1');

      const events = report.domainEvents;
      const completedEvent = events.find(e => e.type === 'DDReport.Completed');

      expect(completedEvent).toBeDefined();
      expect(completedEvent?.payload).toMatchObject({
        reportNumber: 'DD-2024-001',
        targetEntityName: 'Acme Corporation',
        ddType: 'acquisition',
        findingsCount: 1,
      });
    });

    it('should throw if not in findings_review status', () => {
      const report = createTestReport();

      expect(() => report.review('reviewer-001', 'approve', 'user-1'))
        .toThrow('Can only review from findings_review status');
    });
  });

  describe('terminate', () => {
    it('should transition to terminated status', () => {
      const report = createTestReport();

      report.terminate('Deal fell through due to price disagreement', 'user-1');

      expect(report.status).toBe('terminated');
      expect(report.recommendations).toBe('TERMINATED: Deal fell through due to price disagreement');
    });

    it('should throw if already complete', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');
      report.submitDraftReport({
        executiveSummary: 'Summary',
        keyFindings: 'Findings',
        recommendations: 'Recommendations',
      }, 'user-1');
      report.review('reviewer-001', 'approve', 'user-1');

      expect(() => report.terminate('Changed mind', 'user-1'))
        .toThrow('Cannot terminate a completed or already terminated report');
    });

    it('should throw if already terminated', () => {
      const report = createTestReport();
      report.terminate('First termination', 'user-1');

      expect(() => report.terminate('Second termination', 'user-1'))
        .toThrow('Cannot terminate a completed or already terminated report');
    });
  });

  describe('addTeamMember', () => {
    it('should add a team member', () => {
      const report = createTestReport();

      report.addTeamMember('analyst-004', 'user-1');

      expect(report.teamMembers).toContain('analyst-004');
    });

    it('should not add duplicate team member', () => {
      const report = createTestReport();

      report.addTeamMember('analyst-002', 'user-1');

      expect(report.teamMembers.filter(m => m === 'analyst-002')).toHaveLength(1);
    });
  });

  describe('assignOutsideCounsel', () => {
    it('should assign outside counsel', () => {
      const report = createTestReport();

      report.assignOutsideCounsel('counsel-firm-001', 'user-1');

      expect(report.outsideCounselId).toBe('counsel-firm-001');
    });
  });

  describe('getTotalAssetCount', () => {
    it('should return sum of all IP asset counts', () => {
      const report = createTestReport();
      report.updatePortfolioCounts({
        patents: 100,
        trademarks: 50,
        copyrights: 25,
        tradeSecrets: 10,
        licenses: 15,
      }, 'user-1');

      expect(report.getTotalAssetCount()).toBe(200);
    });

    it('should return zero when no counts set', () => {
      const report = createTestReport();

      expect(report.getTotalAssetCount()).toBe(0);
    });
  });

  describe('getValuationGapPercentage', () => {
    it('should calculate positive gap percentage when stated > assessed', () => {
      const report = createTestReport();
      report.setValuation({
        statedValue: 10000000,
        assessedValue: 8000000,
      }, 'user-1');

      expect(report.getValuationGapPercentage()).toBe(20);
    });

    it('should calculate negative gap percentage when stated < assessed', () => {
      const report = createTestReport();
      report.setValuation({
        statedValue: 8000000,
        assessedValue: 10000000,
      }, 'user-1');

      expect(report.getValuationGapPercentage()).toBe(-25);
    });

    it('should return zero when values are equal', () => {
      const report = createTestReport();
      report.setValuation({
        statedValue: 10000000,
        assessedValue: 10000000,
      }, 'user-1');

      expect(report.getValuationGapPercentage()).toBe(0);
    });

    it('should return undefined when stated value is not set', () => {
      const report = createTestReport();

      expect(report.getValuationGapPercentage()).toBeUndefined();
    });

    it('should return undefined when stated value is zero', () => {
      const report = createTestReport();
      report.setValuation({
        statedValue: 0,
        assessedValue: 5000000,
      }, 'user-1');

      expect(report.getValuationGapPercentage()).toBeUndefined();
    });
  });

  describe('getCriticalFindings', () => {
    it('should return only unresolved critical findings', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');

      const criticalId = report.addFinding(createTestFinding({ severity: 'critical', title: 'Critical Issue' }), 'user-1');
      report.addFinding(createTestFinding({ severity: 'major', title: 'Major Issue' }), 'user-1');
      report.addFinding(createTestFinding({ severity: 'critical', title: 'Another Critical' }), 'user-1');
      report.resolveFinding(criticalId, 'Resolved', 'user-1');

      const criticalFindings = report.getCriticalFindings();

      expect(criticalFindings).toHaveLength(1);
      expect(criticalFindings[0].title).toBe('Another Critical');
    });

    it('should return empty array when no critical findings', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');
      report.addFinding(createTestFinding({ severity: 'minor' }), 'user-1');

      expect(report.getCriticalFindings()).toHaveLength(0);
    });
  });

  describe('hasDealBreakers', () => {
    it('should return true when deal breakers exist', () => {
      const report = createTestReport();
      report.addDealBreaker('Critical issue', 'user-1');

      expect(report.hasDealBreakers()).toBe(true);
    });

    it('should return false when no deal breakers', () => {
      const report = createTestReport();

      expect(report.hasDealBreakers()).toBe(false);
    });
  });

  describe('getDaysUntilClose', () => {
    it('should return positive days for future close date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const report = DueDiligenceReport.create({
        title: 'Test DD',
        ddType: 'acquisition',
        targetEntityName: 'Target Inc',
        ipTypesInScope: ['patents'],
        jurisdictionsInScope: ['US'],
        dealCloseDate: futureDate,
        leadAnalyst: 'analyst-001',
      });

      const daysUntilClose = report.getDaysUntilClose();
      expect(daysUntilClose).toBeGreaterThanOrEqual(29);
      expect(daysUntilClose).toBeLessThanOrEqual(31);
    });

    it('should return negative days for past close date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const report = DueDiligenceReport.create({
        title: 'Test DD',
        ddType: 'acquisition',
        targetEntityName: 'Target Inc',
        ipTypesInScope: ['patents'],
        jurisdictionsInScope: ['US'],
        dealCloseDate: pastDate,
        leadAnalyst: 'analyst-001',
      });

      expect(report.getDaysUntilClose()).toBeLessThan(0);
    });

    it('should return undefined when no close date set', () => {
      const report = DueDiligenceReport.create({
        title: 'Test DD',
        ddType: 'acquisition',
        targetEntityName: 'Target Inc',
        ipTypesInScope: ['patents'],
        jurisdictionsInScope: ['US'],
        leadAnalyst: 'analyst-001',
      });

      expect(report.getDaysUntilClose()).toBeUndefined();
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a report with existing ID and properties', () => {
      const existingId = 'existing-report-123';
      const props = {
        reportNumber: 'DD-2024-001',
        title: 'Reconstituted Report',
        status: 'analysis' as const,
        ddType: 'acquisition' as const,
        targetEntityName: 'Target Corp',
        targetEntityId: 'target-123',
        transactionValue: 25000000,
        transactionCurrency: 'USD',
        initiatedDate: new Date('2024-01-15'),
        documentRequestDate: new Date('2024-01-16'),
        documentsReceivedDate: new Date('2024-01-20'),
        analysisStartDate: new Date('2024-01-22'),
        draftReportDate: undefined,
        finalReportDate: undefined,
        dealCloseDate: new Date('2024-06-30'),
        ipTypesInScope: ['patents'],
        jurisdictionsInScope: ['US'],
        materialsReviewed: [],
        patentCount: 50,
        trademarkCount: 20,
        copyrightCount: 5,
        tradeSecretCount: 3,
        licenseCount: 10,
        statedPortfolioValue: 15000000,
        assessedPortfolioValue: 12000000,
        valuationGapNotes: 'Some expiring patents',
        findings: [],
        overallRiskRating: undefined,
        executiveSummary: undefined,
        keyFindings: undefined,
        recommendations: undefined,
        dealBreakerIssues: [],
        leadAnalyst: 'analyst-001',
        teamMembers: ['analyst-002'],
        outsideCounselId: 'counsel-001',
        reviewedBy: undefined,
        approvedBy: undefined,
        approvedDate: undefined,
      };

      const report = DueDiligenceReport.reconstitute(existingId, props);

      expect(report.id).toBe(existingId);
      expect(report.reportNumber).toBe('DD-2024-001');
      expect(report.status).toBe('analysis');
      expect(report.patentCount).toBe(50);
      expect(report.statedPortfolioValue).toBe(15000000);
    });
  });

  describe('DD types', () => {
    const ddTypes = [
      'acquisition',
      'divestiture',
      'licensing_in',
      'licensing_out',
      'investment',
      'joint_venture',
      'ipo',
      'financing',
    ] as const;

    ddTypes.forEach(ddType => {
      it(`should support ${ddType} due diligence type`, () => {
        const report = DueDiligenceReport.create({
          title: `${ddType} DD Report`,
          ddType,
          targetEntityName: 'Target Inc',
          ipTypesInScope: ['patents'],
          jurisdictionsInScope: ['US'],
          leadAnalyst: 'analyst-001',
        });

        expect(report.ddType).toBe(ddType);
      });
    });
  });

  describe('status transitions', () => {
    it('should follow correct status workflow: initiated -> document_review -> analysis -> findings_review -> complete', () => {
      const report = createTestReport();

      expect(report.status).toBe('initiated');

      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      expect(report.status).toBe('document_review');

      report.startAnalysis('user-1');
      expect(report.status).toBe('analysis');

      report.submitDraftReport({
        executiveSummary: 'Summary',
        keyFindings: 'Findings',
        recommendations: 'Recommendations',
      }, 'user-1');
      expect(report.status).toBe('findings_review');

      report.review('reviewer-001', 'approve', 'user-1');
      expect(report.status).toBe('complete');
    });

    it('should allow return from findings_review to analysis', () => {
      const report = createTestReport();
      report.sendDocumentRequest('user-1');
      report.documentsReceived('user-1');
      report.startAnalysis('user-1');
      report.submitDraftReport({
        executiveSummary: 'Summary',
        keyFindings: 'Findings',
        recommendations: 'Recommendations',
      }, 'user-1');

      report.review('reviewer-001', 'return', 'user-1');
      expect(report.status).toBe('analysis');

      // Should be able to resubmit
      report.submitDraftReport({
        executiveSummary: 'Updated Summary',
        keyFindings: 'Updated Findings',
        recommendations: 'Updated Recommendations',
      }, 'user-1');
      expect(report.status).toBe('findings_review');
    });

    it('should allow termination from any non-terminal status', () => {
      const statuses = ['initiated', 'document_review', 'analysis', 'findings_review'] as const;

      statuses.forEach(targetStatus => {
        const report = createTestReport();

        if (targetStatus === 'document_review' || targetStatus === 'analysis' || targetStatus === 'findings_review') {
          report.sendDocumentRequest('user-1');
          report.documentsReceived('user-1');
        }
        if (targetStatus === 'analysis' || targetStatus === 'findings_review') {
          report.startAnalysis('user-1');
        }
        if (targetStatus === 'findings_review') {
          report.submitDraftReport({
            executiveSummary: 'S',
            keyFindings: 'F',
            recommendations: 'R',
          }, 'user-1');
        }

        expect(report.status).toBe(targetStatus);

        report.terminate(`Terminating from ${targetStatus}`, 'user-1');
        expect(report.status).toBe('terminated');
      });
    });
  });
});
