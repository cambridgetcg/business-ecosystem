/**
 * Strategy Test Factory
 *
 * Creates strategy domain test data: Valuations, FTO Analyses, Due Diligence.
 *
 * @module test/factories
 */

import { randomUUID } from 'crypto';

// ============================================================================
// IP Valuation Factory
// ============================================================================

export type ValuationStatus = 'draft' | 'in_progress' | 'review' | 'approved' | 'superseded' | 'archived';
export type ValuationMethodology = 'cost' | 'market' | 'income' | 'relief_from_royalty' | 'excess_earnings';
export type ValuationPurpose = 'financial_reporting' | 'tax' | 'litigation' | 'licensing' | 'sale' | 'm_and_a';

export interface ValuationTestData {
  id: string;
  valuationNumber: string | null;
  name: string;
  purpose: ValuationPurpose;
  methodology: ValuationMethodology;
  valuationDate: Date;
  ipAssets: Array<{ type: string; id: string; name: string; weight?: number }>;
  selectedValue: number | null;
  currency: string;
  confidenceLevel: number | null;
  status: ValuationStatus;
  preparedBy: string | null;
  approvedBy: string | null;
  assumptions: string[];
}

const valuationDefaults: ValuationTestData = {
  id: '',
  valuationNumber: null,
  name: 'Test IP Valuation',
  purpose: 'financial_reporting',
  methodology: 'income',
  valuationDate: new Date(),
  ipAssets: [
    { type: 'patent', id: 'patent-1', name: 'Widget Patent', weight: 0.6 },
    { type: 'trademark', id: 'trademark-1', name: 'Widget Mark', weight: 0.4 },
  ],
  selectedValue: null,
  currency: 'USD',
  confidenceLevel: null,
  status: 'draft',
  preparedBy: null,
  approvedBy: null,
  assumptions: ['Market growth rate: 5%', 'Discount rate: 10%'],
};

export function createValuation(overrides: Partial<ValuationTestData> = {}): ValuationTestData {
  return {
    ...valuationDefaults,
    id: randomUUID(),
    ...overrides,
  };
}

export function createCompletedValuation(overrides: Partial<ValuationTestData> = {}): ValuationTestData {
  return createValuation({
    status: 'review',
    selectedValue: 5000000,
    confidenceLevel: 0.85,
    valuationNumber: `VAL-2024-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    ...overrides,
  });
}

export function createApprovedValuation(overrides: Partial<ValuationTestData> = {}): ValuationTestData {
  return createCompletedValuation({
    status: 'approved',
    approvedBy: 'approver-1',
    ...overrides,
  });
}

// ============================================================================
// FTO Analysis Factory
// ============================================================================

export type FTOStatus = 'initiated' | 'in_progress' | 'review' | 'completed' | 'superseded';
export type FTORiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type FTOFindingType = 'potential_infringement' | 'design_around_available' | 'license_available' | 'patent_invalid' | 'non_infringement';

export interface FTOFindingTestData {
  id: string;
  patentNumber: string;
  patentTitle: string;
  patentHolder: string;
  findingType: FTOFindingType;
  riskLevel: FTORiskLevel;
  relevantClaims: number[];
  analysis: string;
  recommendation: string;
  designAroundPossible: boolean;
  licensingOption: boolean;
}

export interface FTOTestData {
  id: string;
  ftoNumber: string | null;
  name: string;
  product: string;
  productDescription: string | null;
  jurisdiction: string;
  status: FTOStatus;
  overallRiskLevel: FTORiskLevel | null;
  targetLaunchDate: Date | null;
  analyst: string | null;
  findings: FTOFindingTestData[];
}

const ftoDefaults: FTOTestData = {
  id: '',
  ftoNumber: null,
  name: 'Test FTO Analysis',
  product: 'Widget Pro',
  productDescription: 'Advanced widget manufacturing device',
  jurisdiction: 'US',
  status: 'initiated',
  overallRiskLevel: null,
  targetLaunchDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  analyst: null,
  findings: [],
};

export function createFTOAnalysis(overrides: Partial<FTOTestData> = {}): FTOTestData {
  return {
    ...ftoDefaults,
    id: randomUUID(),
    ...overrides,
  };
}

export function createFTOFinding(overrides: Partial<FTOFindingTestData> = {}): FTOFindingTestData {
  return {
    id: randomUUID(),
    patentNumber: 'US10,123,456',
    patentTitle: 'Method for Widget Manufacturing',
    patentHolder: 'Competitor Corp',
    findingType: 'potential_infringement',
    riskLevel: 'medium',
    relevantClaims: [1, 3, 5],
    analysis: 'Claims 1, 3, and 5 may cover aspects of the Widget Pro design.',
    recommendation: 'Consider design-around for claim 1 elements.',
    designAroundPossible: true,
    licensingOption: true,
    ...overrides,
  };
}

export function createHighRiskFTO(overrides: Partial<FTOTestData> = {}): FTOTestData {
  return createFTOAnalysis({
    status: 'completed',
    overallRiskLevel: 'high',
    ftoNumber: `FTO-2024-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    findings: [
      createFTOFinding({ riskLevel: 'high', findingType: 'potential_infringement' }),
      createFTOFinding({ riskLevel: 'medium', findingType: 'license_available' }),
    ],
    ...overrides,
  });
}

export function createClearFTO(overrides: Partial<FTOTestData> = {}): FTOTestData {
  return createFTOAnalysis({
    status: 'completed',
    overallRiskLevel: 'low',
    ftoNumber: `FTO-2024-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    findings: [
      createFTOFinding({ riskLevel: 'low', findingType: 'non_infringement' }),
    ],
    ...overrides,
  });
}

// ============================================================================
// Due Diligence Factory
// ============================================================================

export type DDStatus = 'initiated' | 'document_collection' | 'analysis' | 'review' | 'completed' | 'on_hold' | 'cancelled';
export type DDType = 'acquisition' | 'merger' | 'licensing_in' | 'licensing_out' | 'investment' | 'ip_sale';
export type DDFindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type DDFindingCategory = 'ownership' | 'validity' | 'encumbrances' | 'litigation' | 'freedom_to_operate' | 'maintenance' | 'licensing';

export interface DDFindingTestData {
  id: string;
  category: DDFindingCategory;
  severity: DDFindingSeverity;
  title: string;
  description: string;
  impact: string | null;
  recommendation: string | null;
  affectedAssets: Array<{ type: string; id: string }>;
}

export interface DueDiligenceTestData {
  id: string;
  reportNumber: string | null;
  name: string;
  type: DDType;
  targetEntity: string | null;
  transactionType: string | null;
  transactionValue: number | null;
  status: DDStatus;
  overallRisk: DDFindingSeverity | null;
  leadAnalyst: string | null;
  dueDate: Date | null;
  findings: DDFindingTestData[];
}

const ddDefaults: DueDiligenceTestData = {
  id: '',
  reportNumber: null,
  name: 'Test Due Diligence Report',
  type: 'acquisition',
  targetEntity: 'Target Corp',
  transactionType: 'Asset Purchase',
  transactionValue: 10000000,
  status: 'initiated',
  overallRisk: null,
  leadAnalyst: null,
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  findings: [],
};

export function createDueDiligence(overrides: Partial<DueDiligenceTestData> = {}): DueDiligenceTestData {
  return {
    ...ddDefaults,
    id: randomUUID(),
    ...overrides,
  };
}

export function createDDFinding(overrides: Partial<DDFindingTestData> = {}): DDFindingTestData {
  return {
    id: randomUUID(),
    category: 'ownership',
    severity: 'medium',
    title: 'Chain of Title Issue',
    description: 'Assignment document from inventor to company is missing.',
    impact: 'May affect enforceability of patent rights.',
    recommendation: 'Obtain assignment or quitclaim from original inventor.',
    affectedAssets: [{ type: 'patent', id: 'patent-1' }],
    ...overrides,
  };
}

export function createCompletedDueDiligence(
  overrides: Partial<DueDiligenceTestData> = {}
): DueDiligenceTestData {
  return createDueDiligence({
    status: 'completed',
    overallRisk: 'medium',
    reportNumber: `DD-2024-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    findings: [
      createDDFinding({ severity: 'medium', category: 'ownership' }),
      createDDFinding({ severity: 'low', category: 'maintenance' }),
    ],
    ...overrides,
  });
}

export function createCriticalDueDiligence(
  overrides: Partial<DueDiligenceTestData> = {}
): DueDiligenceTestData {
  return createDueDiligence({
    status: 'review',
    overallRisk: 'critical',
    reportNumber: `DD-2024-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    findings: [
      createDDFinding({ severity: 'critical', category: 'litigation', title: 'Ongoing Infringement Lawsuit' }),
      createDDFinding({ severity: 'high', category: 'encumbrances', title: 'Security Interest in Patents' }),
    ],
    ...overrides,
  });
}

// ============================================================================
// Batch Creators
// ============================================================================

export function createValuations(count: number, overrides: Partial<ValuationTestData> = {}): ValuationTestData[] {
  return Array.from({ length: count }, (_, i) =>
    createValuation({
      name: `Valuation ${i + 1}`,
      ...overrides,
    })
  );
}

export function createFTOAnalyses(count: number, overrides: Partial<FTOTestData> = {}): FTOTestData[] {
  return Array.from({ length: count }, (_, i) =>
    createFTOAnalysis({
      name: `FTO Analysis ${i + 1}`,
      product: `Product ${i + 1}`,
      ...overrides,
    })
  );
}

export function createDueDiligenceReports(count: number, overrides: Partial<DueDiligenceTestData> = {}): DueDiligenceTestData[] {
  return Array.from({ length: count }, (_, i) =>
    createDueDiligence({
      name: `Due Diligence Report ${i + 1}`,
      targetEntity: `Target Company ${i + 1}`,
      ...overrides,
    })
  );
}
