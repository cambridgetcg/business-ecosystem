/**
 * FTO Analysis Entity Unit Tests
 *
 * Tests for the FTOAnalysis domain entity - Freedom-to-Operate analysis
 * for product/technology launch decisions.
 *
 * @module test/unit/domain
 */

import { describe, it, expect } from 'vitest';
import { FTOAnalysis } from '../../../src/domain/entities/fto-analysis.entity.js';
import type { FTOFinding, FTORiskLevel, FTOFindingType } from '../../../src/domain/entities/fto-analysis.entity.js';

describe('FTOAnalysis Entity', () => {
  /**
   * Helper to create a standard test FTO Analysis
   */
  const createTestFTOAnalysis = () => FTOAnalysis.create({
    title: 'FTO Analysis for SmartWidget Product Line',
    productName: 'SmartWidget Pro',
    productDescription: 'An AI-powered widget with IoT connectivity for industrial automation',
    technicalSpecification: 'Uses machine learning algorithms for predictive maintenance',
    targetMarkets: ['US', 'EU', 'Asia-Pacific'],
    launchDate: new Date('2025-06-01'),
    jurisdictions: ['US', 'EP', 'CN', 'JP'],
    patentClassifications: ['G06N', 'H04L', 'G05B'],
    searchStrategy: 'Comprehensive patent search across USPTO, EPO, CNIPA, JPO databases',
    assignedTo: 'analyst-john-doe',
  });

  /**
   * Helper to create a minimal test FTO Analysis
   */
  const createMinimalFTOAnalysis = () => FTOAnalysis.create({
    title: 'Basic FTO Review',
    productName: 'SimpleWidget',
    productDescription: 'A basic widget product',
    targetMarkets: ['US'],
    jurisdictions: ['US'],
    assignedTo: 'analyst-jane-smith',
  });

  /**
   * Helper to create a sample FTO finding
   */
  const createSampleFinding = (overrides?: Partial<Omit<FTOFinding, 'id'>>): Omit<FTOFinding, 'id'> => ({
    patentNumber: 'US10,123,456',
    patentTitle: 'Method for Automated Widget Assembly',
    patentHolder: 'Competitor Corp.',
    patentExpiration: new Date('2038-05-15'),
    jurisdiction: 'US',
    findingType: 'potential_issue',
    riskLevel: 'moderate',
    claimsAtIssue: [1, 3, 5],
    analysisNotes: 'Claims 1, 3, and 5 may cover our assembly process',
    overlapDescription: 'Potential overlap with our automated assembly feature',
    differentiatingFeatures: 'Our method uses AI optimization not disclosed in patent',
    designAroundOption: 'Modify assembly sequence to avoid claim coverage',
    designAroundFeasibility: 'High - requires minor process changes',
    designAroundCost: 50000,
    licensingOption: true,
    estimatedLicenseCost: 250000,
    invalidityArguments: 'Prior art exists in academic publications from 2015',
    priorArtReferences: ['IEEE-2015-1234', 'ACM-2014-5678'],
    recommendation: 'Pursue design-around option as primary strategy',
    ...overrides,
  });

  describe('create', () => {
    it('should create an FTO analysis with initiated status', () => {
      const analysis = createTestFTOAnalysis();

      expect(analysis.status).toBe('initiated');
      expect(analysis.title).toBe('FTO Analysis for SmartWidget Product Line');
      expect(analysis.productName).toBe('SmartWidget Pro');
    });

    it('should generate a unique ID', () => {
      const analysis1 = createTestFTOAnalysis();
      const analysis2 = createTestFTOAnalysis();

      expect(analysis1.id).toBeDefined();
      expect(analysis2.id).toBeDefined();
      expect(analysis1.id).not.toBe(analysis2.id);
    });

    it('should have correct initial properties', () => {
      const analysis = createTestFTOAnalysis();

      expect(analysis.productDescription).toBe('An AI-powered widget with IoT connectivity for industrial automation');
      expect(analysis.technicalSpecification).toBe('Uses machine learning algorithms for predictive maintenance');
      expect(analysis.searchStrategy).toBe('Comprehensive patent search across USPTO, EPO, CNIPA, JPO databases');
      expect(analysis.assignedTo).toBe('analyst-john-doe');
    });

    it('should have correct initial jurisdictions', () => {
      const analysis = createTestFTOAnalysis();

      expect(analysis.jurisdictions).toHaveLength(4);
      expect(analysis.jurisdictions).toContain('US');
      expect(analysis.jurisdictions).toContain('EP');
      expect(analysis.jurisdictions).toContain('CN');
      expect(analysis.jurisdictions).toContain('JP');
    });

    it('should have correct initial target markets', () => {
      const analysis = createTestFTOAnalysis();

      expect(analysis.targetMarkets).toHaveLength(3);
      expect(analysis.targetMarkets).toContain('US');
      expect(analysis.targetMarkets).toContain('EU');
      expect(analysis.targetMarkets).toContain('Asia-Pacific');
    });

    it('should have correct patent classifications', () => {
      const analysis = createTestFTOAnalysis();

      expect(analysis.patentClassifications).toHaveLength(3);
      expect(analysis.patentClassifications).toContain('G06N');
    });

    it('should have correct launch date', () => {
      const analysis = createTestFTOAnalysis();

      expect(analysis.launchDate?.toISOString().split('T')[0]).toBe('2025-06-01');
    });

    it('should set initiatedDate to current date', () => {
      const beforeCreate = new Date();
      const analysis = createTestFTOAnalysis();
      const afterCreate = new Date();

      expect(analysis.initiatedDate.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(analysis.initiatedDate.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('should have empty findings initially', () => {
      const analysis = createTestFTOAnalysis();

      expect(analysis.findings).toHaveLength(0);
      expect(analysis.potentialIssuesCount).toBe(0);
    });

    it('should have zero search statistics initially', () => {
      const analysis = createTestFTOAnalysis();

      expect(analysis.patentsSearched).toBe(0);
      expect(analysis.patentsReviewed).toBe(0);
    });

    it('should have undefined overall risk initially', () => {
      const analysis = createTestFTOAnalysis();

      expect(analysis.overallRisk).toBeUndefined();
    });

    it('should have undefined analysis number initially', () => {
      const analysis = createTestFTOAnalysis();

      expect(analysis.analysisNumber).toBeUndefined();
    });

    it('should throw if no jurisdictions provided', () => {
      expect(() => FTOAnalysis.create({
        title: 'Invalid Analysis',
        productName: 'Test Product',
        productDescription: 'Test description',
        targetMarkets: ['US'],
        jurisdictions: [],
        assignedTo: 'analyst-1',
      })).toThrow('FTO analysis must specify at least one jurisdiction');
    });

    it('should create minimal analysis with required fields only', () => {
      const analysis = createMinimalFTOAnalysis();

      expect(analysis.status).toBe('initiated');
      expect(analysis.productName).toBe('SimpleWidget');
      expect(analysis.jurisdictions).toHaveLength(1);
      expect(analysis.patentClassifications).toHaveLength(0);
      expect(analysis.technicalSpecification).toBeUndefined();
    });

    it('should emit FTOAnalysis.Initiated domain event', () => {
      const analysis = createTestFTOAnalysis();

      const events = analysis.domainEvents;
      const initiatedEvent = events.find(e => e.type === 'FTOAnalysis.Initiated');

      expect(initiatedEvent).toBeDefined();
      expect(initiatedEvent?.payload).toMatchObject({
        productName: 'SmartWidget Pro',
        jurisdictions: ['US', 'EP', 'CN', 'JP'],
      });
      expect(initiatedEvent?.payload.launchDate).toBe('2025-06-01T00:00:00.000Z');
    });
  });

  describe('assignNumber', () => {
    it('should assign analysis number', () => {
      const analysis = createTestFTOAnalysis();

      analysis.assignNumber('FTO-2025-001', 'user-1');

      expect(analysis.analysisNumber).toBe('FTO-2025-001');
    });

    it('should throw if number already assigned', () => {
      const analysis = createTestFTOAnalysis();
      analysis.assignNumber('FTO-2025-001', 'user-1');

      expect(() => analysis.assignNumber('FTO-2025-002', 'user-1'))
        .toThrow('Analysis number already assigned');
    });
  });

  describe('updateSearchStats', () => {
    it('should update search statistics in initiated status', () => {
      const analysis = createTestFTOAnalysis();

      analysis.updateSearchStats({ patentsSearched: 500, patentsReviewed: 50 }, 'user-1');

      expect(analysis.patentsSearched).toBe(500);
      expect(analysis.patentsReviewed).toBe(50);
    });

    it('should update search statistics in search_complete status', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');

      analysis.updateSearchStats({ patentsSearched: 600, patentsReviewed: 75 }, 'user-1');

      expect(analysis.patentsSearched).toBe(600);
      expect(analysis.patentsReviewed).toBe(75);
    });

    it('should throw if updating stats after analysis phase', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      expect(() => analysis.updateSearchStats({ patentsSearched: 700, patentsReviewed: 100 }, 'user-1'))
        .toThrow('Cannot update search stats after analysis phase');
    });
  });

  describe('completeSearch', () => {
    it('should transition from initiated to search_complete', () => {
      const analysis = createTestFTOAnalysis();

      analysis.completeSearch('user-1');

      expect(analysis.status).toBe('search_complete');
      expect(analysis.searchCompletedDate).toBeDefined();
    });

    it('should set searchCompletedDate', () => {
      const analysis = createTestFTOAnalysis();
      const beforeComplete = new Date();

      analysis.completeSearch('user-1');

      expect(analysis.searchCompletedDate?.getTime()).toBeGreaterThanOrEqual(beforeComplete.getTime());
    });

    it('should throw if not in initiated status', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');

      expect(() => analysis.completeSearch('user-1'))
        .toThrow('Search can only be completed from initiated status');
    });
  });

  describe('startAnalysis', () => {
    it('should transition from search_complete to analysis_in_progress', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');

      analysis.startAnalysis('user-1');

      expect(analysis.status).toBe('analysis_in_progress');
    });

    it('should throw if not in search_complete status', () => {
      const analysis = createTestFTOAnalysis();

      expect(() => analysis.startAnalysis('user-1'))
        .toThrow('Analysis can only start after search is complete');
    });
  });

  describe('addFinding', () => {
    it('should add a finding during analysis phase', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      const findingId = analysis.addFinding(createSampleFinding(), 'user-1');

      expect(findingId).toBeDefined();
      expect(analysis.findings).toHaveLength(1);
      expect(analysis.findings[0].patentNumber).toBe('US10,123,456');
    });

    it('should increment potentialIssuesCount for non-clear findings', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      analysis.addFinding(createSampleFinding({ findingType: 'potential_issue' }), 'user-1');

      expect(analysis.potentialIssuesCount).toBe(1);
    });

    it('should not increment potentialIssuesCount for clear findings', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      analysis.addFinding(createSampleFinding({ findingType: 'clear', riskLevel: 'clear' }), 'user-1');

      expect(analysis.potentialIssuesCount).toBe(0);
    });

    it('should not increment potentialIssuesCount for expired patents', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      analysis.addFinding(createSampleFinding({ findingType: 'expired', riskLevel: 'clear' }), 'user-1');

      expect(analysis.potentialIssuesCount).toBe(0);
    });

    it('should emit FTOAnalysis.FindingAdded domain event', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.clearEvents();

      analysis.addFinding(createSampleFinding(), 'user-1');

      const events = analysis.getUncommittedEvents();
      const findingEvent = events.find(e => e.type === 'FTOAnalysis.FindingAdded');

      expect(findingEvent).toBeDefined();
      expect(findingEvent?.payload).toMatchObject({
        patentNumber: 'US10,123,456',
        findingType: 'potential_issue',
        riskLevel: 'moderate',
      });
    });

    it('should throw if not in analysis_in_progress status', () => {
      const analysis = createTestFTOAnalysis();

      expect(() => analysis.addFinding(createSampleFinding(), 'user-1'))
        .toThrow('Findings can only be added during analysis phase');
    });

    it('should add multiple findings', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      analysis.addFinding(createSampleFinding({ patentNumber: 'US10,111,111' }), 'user-1');
      analysis.addFinding(createSampleFinding({ patentNumber: 'US10,222,222' }), 'user-1');
      analysis.addFinding(createSampleFinding({ patentNumber: 'US10,333,333' }), 'user-1');

      expect(analysis.findings).toHaveLength(3);
      expect(analysis.potentialIssuesCount).toBe(3);
    });

    it('should add finding with all risk levels', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      const riskLevels: FTORiskLevel[] = ['clear', 'low', 'moderate', 'high', 'blocking'];

      riskLevels.forEach((riskLevel, index) => {
        analysis.addFinding(createSampleFinding({
          patentNumber: `US10,${index}00,000`,
          riskLevel,
        }), 'user-1');
      });

      expect(analysis.findings).toHaveLength(5);
    });

    it('should add finding with all finding types', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      const findingTypes: FTOFindingType[] = [
        'clear', 'potential_issue', 'design_around_needed',
        'license_required', 'blocking', 'expired', 'narrow_claim'
      ];

      findingTypes.forEach((findingType, index) => {
        analysis.addFinding(createSampleFinding({
          patentNumber: `US10,${index}00,000`,
          findingType,
        }), 'user-1');
      });

      expect(analysis.findings).toHaveLength(7);
    });
  });

  describe('updateFinding', () => {
    it('should update a finding during analysis phase', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      const findingId = analysis.addFinding(createSampleFinding(), 'user-1');

      analysis.updateFinding(findingId, {
        riskLevel: 'high',
        recommendation: 'Updated recommendation - seek license',
      }, 'user-1');

      const finding = analysis.findings.find(f => f.id === findingId);
      expect(finding?.riskLevel).toBe('high');
      expect(finding?.recommendation).toBe('Updated recommendation - seek license');
    });

    it('should update a finding during review phase', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      const findingId = analysis.addFinding(createSampleFinding(), 'user-1');
      analysis.completeAnalysis('moderate', 'Proceed with caution', 'user-1');

      analysis.updateFinding(findingId, { analysisNotes: 'Reviewed and updated notes' }, 'user-1');

      const finding = analysis.findings.find(f => f.id === findingId);
      expect(finding?.analysisNotes).toBe('Reviewed and updated notes');
    });

    it('should throw if finding not found', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      expect(() => analysis.updateFinding('non-existent-id', { riskLevel: 'high' }, 'user-1'))
        .toThrow('Finding non-existent-id not found');
    });

    it('should throw if not in analysis or review status', () => {
      const analysis = createTestFTOAnalysis();

      expect(() => analysis.updateFinding('some-id', { riskLevel: 'high' }, 'user-1'))
        .toThrow('Findings can only be updated during analysis or review');
    });
  });

  describe('completeAnalysis', () => {
    it('should transition from analysis_in_progress to review', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      analysis.completeAnalysis('moderate', 'Proceed with design-around modifications', 'user-1');

      expect(analysis.status).toBe('review');
      expect(analysis.overallRisk).toBe('moderate');
      expect(analysis.recommendation).toBe('Proceed with design-around modifications');
    });

    it('should set analysisCompletedDate', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      const beforeComplete = new Date();

      analysis.completeAnalysis('low', 'Minor modifications recommended', 'user-1');

      expect(analysis.analysisCompletedDate?.getTime()).toBeGreaterThanOrEqual(beforeComplete.getTime());
    });

    it('should throw if not in analysis_in_progress status', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');

      expect(() => analysis.completeAnalysis('clear', 'No issues found', 'user-1'))
        .toThrow('Can only complete from analysis_in_progress status');
    });
  });

  describe('risk escalation', () => {
    it('should recalculate overall risk when adding high-risk finding', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      // Add a low risk finding first
      analysis.addFinding(createSampleFinding({ riskLevel: 'low' }), 'user-1');
      expect(analysis.overallRisk).toBe('low');

      // Add a high risk finding
      analysis.addFinding(createSampleFinding({
        patentNumber: 'US10,999,999',
        riskLevel: 'high',
      }), 'user-1');

      expect(analysis.overallRisk).toBe('high');
    });

    it('should emit RiskEscalated event when risk increases', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      // Add initial low risk finding
      analysis.addFinding(createSampleFinding({ riskLevel: 'low' }), 'user-1');
      analysis.clearEvents();

      // Add blocking finding - should trigger escalation
      analysis.addFinding(createSampleFinding({
        patentNumber: 'US10,999,999',
        findingType: 'blocking',
        riskLevel: 'blocking',
      }), 'user-1');

      const events = analysis.getUncommittedEvents();
      const escalationEvent = events.find(e => e.type === 'FTOAnalysis.RiskEscalated');

      expect(escalationEvent).toBeDefined();
      expect(escalationEvent?.payload).toMatchObject({
        productName: 'SmartWidget Pro',
        previousRisk: 'low',
        newRisk: 'blocking',
      });
    });

    it('should not emit RiskEscalated event when risk stays same', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      analysis.addFinding(createSampleFinding({ riskLevel: 'moderate' }), 'user-1');
      analysis.clearEvents();

      analysis.addFinding(createSampleFinding({
        patentNumber: 'US10,999,999',
        riskLevel: 'low',
      }), 'user-1');

      const events = analysis.getUncommittedEvents();
      const escalationEvent = events.find(e => e.type === 'FTOAnalysis.RiskEscalated');

      expect(escalationEvent).toBeUndefined();
    });

    it('should not emit RiskEscalated event when risk decreases', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      // Add high risk finding
      analysis.addFinding(createSampleFinding({ riskLevel: 'high' }), 'user-1');
      analysis.clearEvents();

      // Add low risk finding - overall risk stays at high
      analysis.addFinding(createSampleFinding({
        patentNumber: 'US10,999,999',
        riskLevel: 'clear',
      }), 'user-1');

      const events = analysis.getUncommittedEvents();
      const escalationEvent = events.find(e => e.type === 'FTOAnalysis.RiskEscalated');

      expect(escalationEvent).toBeUndefined();
    });
  });

  describe('addRecommendedAction', () => {
    it('should add recommended action during analysis', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      analysis.addRecommendedAction({
        action: 'Implement design-around for assembly process',
        priority: 'high',
        deadline: '2025-03-01',
        estimatedCost: 75000,
      }, 'user-1');

      expect(analysis.recommendedActions).toHaveLength(1);
      expect(analysis.recommendedActions[0].action).toBe('Implement design-around for assembly process');
      expect(analysis.recommendedActions[0].priority).toBe('high');
    });

    it('should add recommended action during review', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.completeAnalysis('moderate', 'Some issues identified', 'user-1');

      analysis.addRecommendedAction({
        action: 'Seek license from Competitor Corp.',
        priority: 'medium',
      }, 'user-1');

      expect(analysis.recommendedActions).toHaveLength(1);
    });

    it('should throw if not in analysis or review status', () => {
      const analysis = createTestFTOAnalysis();

      expect(() => analysis.addRecommendedAction({
        action: 'Some action',
        priority: 'low',
      }, 'user-1')).toThrow('Actions can only be added during analysis or review');
    });

    it('should add multiple recommended actions', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      analysis.addRecommendedAction({
        action: 'Action 1',
        priority: 'high',
      }, 'user-1');
      analysis.addRecommendedAction({
        action: 'Action 2',
        priority: 'medium',
      }, 'user-1');
      analysis.addRecommendedAction({
        action: 'Action 3',
        priority: 'low',
      }, 'user-1');

      expect(analysis.recommendedActions).toHaveLength(3);
    });
  });

  describe('review', () => {
    it('should approve and complete analysis', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.completeAnalysis('low', 'Minor issues only', 'user-1');

      analysis.review('reviewer-1', 'approve', 'user-1');

      expect(analysis.status).toBe('complete');
      expect(analysis.reviewedBy).toBe('reviewer-1');
      expect(analysis.approvedBy).toBe('reviewer-1');
      expect(analysis.reviewCompletedDate).toBeDefined();
    });

    it('should return analysis for further work', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.completeAnalysis('moderate', 'Needs more analysis', 'user-1');

      analysis.review('reviewer-1', 'return', 'user-1');

      expect(analysis.status).toBe('analysis_in_progress');
      expect(analysis.reviewedBy).toBe('reviewer-1');
      expect(analysis.approvedBy).toBeUndefined();
    });

    it('should emit FTOAnalysis.Completed event on approval', () => {
      const analysis = createTestFTOAnalysis();
      analysis.assignNumber('FTO-2025-001', 'user-1');
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.addFinding(createSampleFinding(), 'user-1');
      analysis.addFinding(createSampleFinding({
        patentNumber: 'US10,222,222',
        findingType: 'clear',
        riskLevel: 'clear',
      }), 'user-1');
      analysis.completeAnalysis('moderate', 'Proceed with caution', 'user-1');
      analysis.clearEvents();

      analysis.review('reviewer-1', 'approve', 'user-1');

      const events = analysis.getUncommittedEvents();
      const completedEvent = events.find(e => e.type === 'FTOAnalysis.Completed');

      expect(completedEvent).toBeDefined();
      expect(completedEvent?.payload).toMatchObject({
        analysisNumber: 'FTO-2025-001',
        productName: 'SmartWidget Pro',
        overallRisk: 'moderate',
        findingsCount: 2,
        potentialIssuesCount: 1,
      });
    });

    it('should throw if not in review status', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      expect(() => analysis.review('reviewer-1', 'approve', 'user-1'))
        .toThrow('Can only review from review status');
    });
  });

  describe('assignOutsideCounsel', () => {
    it('should assign outside counsel', () => {
      const analysis = createTestFTOAnalysis();

      analysis.assignOutsideCounsel('counsel-firm-123', undefined, 'user-1');

      expect(analysis.outsideCounselId).toBe('counsel-firm-123');
    });

    it('should assign outside counsel with opinion reference', () => {
      const analysis = createTestFTOAnalysis();

      analysis.assignOutsideCounsel('counsel-firm-123', 'OPINION-2025-001', 'user-1');

      expect(analysis.outsideCounselId).toBe('counsel-firm-123');
      expect(analysis.outsideCounselOpinionRef).toBe('OPINION-2025-001');
    });
  });

  describe('markAsUpdated', () => {
    it('should mark complete analysis as updated', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.completeAnalysis('clear', 'No issues', 'user-1');
      analysis.review('reviewer-1', 'approve', 'user-1');

      analysis.markAsUpdated('New patents published in relevant technology area', 'user-1');

      expect(analysis.status).toBe('updated');
    });

    it('should throw if not in complete status', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.completeAnalysis('low', 'Minor issues', 'user-1');

      expect(() => analysis.markAsUpdated('Some reason', 'user-1'))
        .toThrow('Can only update a complete analysis');
    });
  });

  describe('supersede', () => {
    it('should supersede a complete analysis', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.completeAnalysis('clear', 'No issues', 'user-1');
      analysis.review('reviewer-1', 'approve', 'user-1');

      analysis.supersede('new-analysis-id', 'user-1');

      expect(analysis.status).toBe('superseded');
    });

    it('should supersede an updated analysis', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.completeAnalysis('clear', 'No issues', 'user-1');
      analysis.review('reviewer-1', 'approve', 'user-1');
      analysis.markAsUpdated('New patents found', 'user-1');

      analysis.supersede('newer-analysis-id', 'user-1');

      expect(analysis.status).toBe('superseded');
    });

    it('should throw if not complete or updated', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      expect(() => analysis.supersede('new-id', 'user-1'))
        .toThrow('Can only supersede complete or updated analyses');
    });
  });

  describe('getFindingsByRisk', () => {
    it('should return findings filtered by risk level', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      analysis.addFinding(createSampleFinding({ patentNumber: 'US1', riskLevel: 'low' }), 'user-1');
      analysis.addFinding(createSampleFinding({ patentNumber: 'US2', riskLevel: 'moderate' }), 'user-1');
      analysis.addFinding(createSampleFinding({ patentNumber: 'US3', riskLevel: 'moderate' }), 'user-1');
      analysis.addFinding(createSampleFinding({ patentNumber: 'US4', riskLevel: 'high' }), 'user-1');

      const moderateFindings = analysis.getFindingsByRisk('moderate');

      expect(moderateFindings).toHaveLength(2);
      expect(moderateFindings.every(f => f.riskLevel === 'moderate')).toBe(true);
    });

    it('should return empty array if no findings match', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      analysis.addFinding(createSampleFinding({ riskLevel: 'low' }), 'user-1');

      const blockingFindings = analysis.getFindingsByRisk('blocking');

      expect(blockingFindings).toHaveLength(0);
    });
  });

  describe('getBlockingFindings', () => {
    it('should return only blocking findings', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');

      analysis.addFinding(createSampleFinding({
        patentNumber: 'US1',
        findingType: 'potential_issue',
        riskLevel: 'moderate',
      }), 'user-1');
      analysis.addFinding(createSampleFinding({
        patentNumber: 'US2',
        findingType: 'blocking',
        riskLevel: 'blocking',
      }), 'user-1');
      analysis.addFinding(createSampleFinding({
        patentNumber: 'US3',
        findingType: 'blocking',
        riskLevel: 'blocking',
      }), 'user-1');

      const blockingFindings = analysis.getBlockingFindings();

      expect(blockingFindings).toHaveLength(2);
      expect(blockingFindings.every(f => f.findingType === 'blocking')).toBe(true);
    });
  });

  describe('isLaunchAtRisk', () => {
    it('should return true for high overall risk', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.addFinding(createSampleFinding({ riskLevel: 'high' }), 'user-1');

      expect(analysis.isLaunchAtRisk()).toBe(true);
    });

    it('should return true for blocking overall risk', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.addFinding(createSampleFinding({ riskLevel: 'blocking' }), 'user-1');

      expect(analysis.isLaunchAtRisk()).toBe(true);
    });

    it('should return false for moderate overall risk', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.addFinding(createSampleFinding({ riskLevel: 'moderate' }), 'user-1');

      expect(analysis.isLaunchAtRisk()).toBe(false);
    });

    it('should return false for low overall risk', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.addFinding(createSampleFinding({ riskLevel: 'low' }), 'user-1');

      expect(analysis.isLaunchAtRisk()).toBe(false);
    });

    it('should return false for clear overall risk', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.addFinding(createSampleFinding({ riskLevel: 'clear' }), 'user-1');

      expect(analysis.isLaunchAtRisk()).toBe(false);
    });

    it('should return false for undefined overall risk', () => {
      const analysis = createTestFTOAnalysis();

      expect(analysis.isLaunchAtRisk()).toBe(false);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute an FTO analysis from persisted data', () => {
      const original = createTestFTOAnalysis();
      original.completeSearch('user-1');
      original.startAnalysis('user-1');
      original.addFinding(createSampleFinding(), 'user-1');

      // Simulate persisting and reconstituting
      const reconstituted = FTOAnalysis.reconstitute(original.id, {
        analysisNumber: 'FTO-2025-001',
        title: original.title,
        status: original.status,
        overallRisk: original.overallRisk,
        productName: original.productName,
        productDescription: original.productDescription,
        technicalSpecification: original.technicalSpecification,
        targetMarkets: original.targetMarkets,
        launchDate: original.launchDate,
        jurisdictions: original.jurisdictions,
        patentClassifications: original.patentClassifications,
        searchStrategy: original.searchStrategy,
        initiatedDate: original.initiatedDate,
        searchCompletedDate: original.searchCompletedDate,
        analysisCompletedDate: original.analysisCompletedDate,
        reviewCompletedDate: original.reviewCompletedDate,
        patentsSearched: original.patentsSearched,
        patentsReviewed: original.patentsReviewed,
        potentialIssuesCount: original.potentialIssuesCount,
        findings: original.findings,
        recommendation: original.recommendation,
        recommendedActions: original.recommendedActions,
        assignedTo: original.assignedTo,
        reviewedBy: original.reviewedBy,
        approvedBy: original.approvedBy,
        outsideCounselId: original.outsideCounselId,
        outsideCounselOpinionRef: original.outsideCounselOpinionRef,
      });

      expect(reconstituted.id).toBe(original.id);
      expect(reconstituted.status).toBe('analysis_in_progress');
      expect(reconstituted.findings).toHaveLength(1);
      expect(reconstituted.analysisNumber).toBe('FTO-2025-001');
    });

    it('should not emit events on reconstitution', () => {
      const reconstituted = FTOAnalysis.reconstitute('existing-id', {
        analysisNumber: 'FTO-2025-001',
        title: 'Reconstituted Analysis',
        status: 'complete',
        overallRisk: 'low',
        productName: 'Test Product',
        productDescription: 'Test description',
        technicalSpecification: undefined,
        targetMarkets: ['US'],
        launchDate: undefined,
        jurisdictions: ['US'],
        patentClassifications: [],
        searchStrategy: undefined,
        initiatedDate: new Date(),
        searchCompletedDate: new Date(),
        analysisCompletedDate: new Date(),
        reviewCompletedDate: new Date(),
        patentsSearched: 100,
        patentsReviewed: 20,
        potentialIssuesCount: 2,
        findings: [],
        recommendation: 'Proceed',
        recommendedActions: [],
        assignedTo: 'analyst-1',
        reviewedBy: 'reviewer-1',
        approvedBy: 'reviewer-1',
        outsideCounselId: undefined,
        outsideCounselOpinionRef: undefined,
      });

      expect(reconstituted.getUncommittedEvents()).toHaveLength(0);
    });
  });

  describe('status transitions - full workflow', () => {
    it('should complete full FTO analysis workflow', () => {
      const analysis = createTestFTOAnalysis();

      // Initial state
      expect(analysis.status).toBe('initiated');

      // Update search stats
      analysis.updateSearchStats({ patentsSearched: 500, patentsReviewed: 75 }, 'user-1');
      expect(analysis.patentsSearched).toBe(500);

      // Complete search phase
      analysis.completeSearch('user-1');
      expect(analysis.status).toBe('search_complete');

      // Start analysis
      analysis.startAnalysis('user-1');
      expect(analysis.status).toBe('analysis_in_progress');

      // Add findings
      analysis.addFinding(createSampleFinding({ findingType: 'clear', riskLevel: 'clear' }), 'user-1');
      analysis.addFinding(createSampleFinding({
        patentNumber: 'US10,222,222',
        findingType: 'potential_issue',
        riskLevel: 'low',
      }), 'user-1');
      analysis.addFinding(createSampleFinding({
        patentNumber: 'US10,333,333',
        findingType: 'design_around_needed',
        riskLevel: 'moderate',
      }), 'user-1');

      expect(analysis.findings).toHaveLength(3);
      expect(analysis.potentialIssuesCount).toBe(2);
      expect(analysis.overallRisk).toBe('moderate');

      // Add recommended actions
      analysis.addRecommendedAction({
        action: 'Implement design-around for patent US10,333,333',
        priority: 'high',
        deadline: '2025-04-01',
        estimatedCost: 100000,
      }, 'user-1');

      // Complete analysis
      analysis.completeAnalysis('moderate', 'Proceed with design modifications', 'user-1');
      expect(analysis.status).toBe('review');

      // Assign outside counsel for opinion
      analysis.assignOutsideCounsel('external-counsel-1', 'OPINION-2025-001', 'user-1');
      expect(analysis.outsideCounselId).toBe('external-counsel-1');

      // Review and approve
      analysis.review('senior-counsel-1', 'approve', 'user-1');
      expect(analysis.status).toBe('complete');
      expect(analysis.approvedBy).toBe('senior-counsel-1');

      // Later, mark as needing update
      analysis.markAsUpdated('New blocking patent identified', 'user-1');
      expect(analysis.status).toBe('updated');

      // Eventually supersede
      analysis.supersede('new-analysis-id', 'user-1');
      expect(analysis.status).toBe('superseded');
    });

    it('should handle review return workflow', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.addFinding(createSampleFinding(), 'user-1');
      analysis.completeAnalysis('moderate', 'Initial recommendation', 'user-1');

      // Reviewer returns for more work
      analysis.review('reviewer-1', 'return', 'user-1');
      expect(analysis.status).toBe('analysis_in_progress');

      // Add more findings
      analysis.addFinding(createSampleFinding({
        patentNumber: 'US10,555,555',
        riskLevel: 'high',
      }), 'user-1');

      // Complete analysis again
      analysis.completeAnalysis('high', 'Updated with high risk finding', 'user-1');
      expect(analysis.status).toBe('review');

      // Approve this time
      analysis.review('reviewer-1', 'approve', 'user-1');
      expect(analysis.status).toBe('complete');
    });
  });

  describe('immutability of returned arrays', () => {
    it('should return copies of jurisdictions array', () => {
      const analysis = createTestFTOAnalysis();
      const jurisdictions1 = analysis.jurisdictions;
      const jurisdictions2 = analysis.jurisdictions;

      expect(jurisdictions1).not.toBe(jurisdictions2);
      expect(jurisdictions1).toEqual(jurisdictions2);
    });

    it('should return copies of targetMarkets array', () => {
      const analysis = createTestFTOAnalysis();
      const markets1 = analysis.targetMarkets;
      const markets2 = analysis.targetMarkets;

      expect(markets1).not.toBe(markets2);
      expect(markets1).toEqual(markets2);
    });

    it('should return copies of findings array', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.addFinding(createSampleFinding(), 'user-1');

      const findings1 = analysis.findings;
      const findings2 = analysis.findings;

      expect(findings1).not.toBe(findings2);
      expect(findings1).toEqual(findings2);
    });

    it('should return copies of recommendedActions array', () => {
      const analysis = createTestFTOAnalysis();
      analysis.completeSearch('user-1');
      analysis.startAnalysis('user-1');
      analysis.addRecommendedAction({ action: 'Test', priority: 'high' }, 'user-1');

      const actions1 = analysis.recommendedActions;
      const actions2 = analysis.recommendedActions;

      expect(actions1).not.toBe(actions2);
      expect(actions1).toEqual(actions2);
    });

    it('should return copies of patentClassifications array', () => {
      const analysis = createTestFTOAnalysis();
      const classifications1 = analysis.patentClassifications;
      const classifications2 = analysis.patentClassifications;

      expect(classifications1).not.toBe(classifications2);
      expect(classifications1).toEqual(classifications2);
    });
  });
});
