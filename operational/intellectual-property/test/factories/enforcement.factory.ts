/**
 * Enforcement Test Factory
 *
 * Creates enforcement matter test data with sensible defaults.
 *
 * @module test/factories
 */

import { randomUUID } from 'crypto';
import type {
  EnforcementType,
  EnforcementStatus,
  EnforcementPriority,
  IPAssetType,
  ActionType,
  ActionStatus,
  PartyRole,
} from '../../src/domain/entities/enforcement-matter.entity.js';

/**
 * Enforcement matter test data interface.
 */
export interface EnforcementMatterTestData {
  id: string;
  matterNumber: string | null;
  title: string;
  description: string | null;
  type: EnforcementType;
  status: EnforcementStatus;
  priority: EnforcementPriority;
  ipAssetType: IPAssetType;
  ipAssetId: string;
  jurisdiction: string;
  venue: string | null;
  caseNumber: string | null;
  detectedDate: Date;
  openedDate: Date | null;
  resolvedDate: Date | null;
  estimatedDamages: number | null;
  settlementAmount: number | null;
  assignedTo: string | null;
  tags: string[];
}

/**
 * Default enforcement matter values.
 */
const defaults: EnforcementMatterTestData = {
  id: '',
  matterNumber: null,
  title: 'Test Infringement Matter',
  description: 'Test enforcement matter for unit testing',
  type: 'infringement',
  status: 'monitoring',
  priority: 'medium',
  ipAssetType: 'patent',
  ipAssetId: 'patent-test-123',
  jurisdiction: 'US',
  venue: null,
  caseNumber: null,
  detectedDate: new Date('2024-01-15'),
  openedDate: null,
  resolvedDate: null,
  estimatedDamages: 500000,
  settlementAmount: null,
  assignedTo: null,
  tags: ['test'],
};

/**
 * Create enforcement matter test data.
 */
export function createEnforcementMatter(
  overrides: Partial<EnforcementMatterTestData> = {}
): EnforcementMatterTestData {
  return {
    ...defaults,
    id: randomUUID(),
    ...overrides,
  };
}

/**
 * Create an enforcement matter in investigation.
 */
export function createInvestigationMatter(
  overrides: Partial<EnforcementMatterTestData> = {}
): EnforcementMatterTestData {
  return createEnforcementMatter({
    status: 'investigation',
    openedDate: new Date(),
    assignedTo: 'investigator-1',
    ...overrides,
  });
}

/**
 * Create an enforcement matter in litigation.
 */
export function createLitigationMatter(
  overrides: Partial<EnforcementMatterTestData> = {}
): EnforcementMatterTestData {
  return createEnforcementMatter({
    status: 'litigation',
    openedDate: new Date('2024-01-15'),
    caseNumber: '1:24-cv-12345',
    venue: 'N.D. California',
    matterNumber: 'ENF-2024-001',
    ...overrides,
  });
}

/**
 * Create a settled enforcement matter.
 */
export function createSettledMatter(
  overrides: Partial<EnforcementMatterTestData> = {}
): EnforcementMatterTestData {
  return createEnforcementMatter({
    status: 'settled',
    openedDate: new Date('2024-01-15'),
    resolvedDate: new Date('2024-06-15'),
    settlementAmount: 250000,
    matterNumber: 'ENF-2024-001',
    ...overrides,
  });
}

/**
 * Create a critical priority matter.
 */
export function createCriticalMatter(
  overrides: Partial<EnforcementMatterTestData> = {}
): EnforcementMatterTestData {
  return createEnforcementMatter({
    priority: 'critical',
    title: 'Critical Infringement - Immediate Action Required',
    estimatedDamages: 5000000,
    ...overrides,
  });
}

/**
 * Action test data interface.
 */
export interface ActionTestData {
  id: string;
  actionType: ActionType;
  status: ActionStatus;
  title: string;
  description: string | null;
  dueDate: Date | null;
  completedDate: Date | null;
}

/**
 * Create action test data.
 */
export function createAction(overrides: Partial<ActionTestData> = {}): ActionTestData {
  return {
    id: randomUUID(),
    actionType: 'investigation',
    status: 'pending',
    title: 'Test Action',
    description: 'Test action description',
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    completedDate: null,
    ...overrides,
  };
}

/**
 * Create cease and desist action.
 */
export function createCeaseAndDesistAction(
  overrides: Partial<ActionTestData> = {}
): ActionTestData {
  return createAction({
    actionType: 'cease_and_desist',
    title: 'Cease and Desist Letter',
    description: 'Initial C&D letter to infringer',
    ...overrides,
  });
}

/**
 * Create court filing action.
 */
export function createCourtFilingAction(
  overrides: Partial<ActionTestData> = {}
): ActionTestData {
  return createAction({
    actionType: 'court_filing',
    title: 'Complaint Filing',
    description: 'Initial complaint filed with court',
    ...overrides,
  });
}

/**
 * Party test data interface.
 */
export interface PartyTestData {
  id: string;
  role: PartyRole;
  name: string;
  organization: string | null;
  contactEmail: string | null;
  firmName: string | null;
  barNumber: string | null;
}

/**
 * Create party test data.
 */
export function createParty(overrides: Partial<PartyTestData> = {}): PartyTestData {
  return {
    id: randomUUID(),
    role: 'infringer',
    name: 'Test Party',
    organization: 'Test Organization Inc.',
    contactEmail: 'contact@testorg.com',
    firmName: null,
    barNumber: null,
    ...overrides,
  };
}

/**
 * Create external counsel party.
 */
export function createExternalCounsel(overrides: Partial<PartyTestData> = {}): PartyTestData {
  return createParty({
    role: 'external_counsel',
    name: 'Jane Attorney',
    organization: null,
    firmName: 'Smith & Associates LLP',
    barNumber: 'CA-123456',
    contactEmail: 'jane@smithlaw.com',
    ...overrides,
  });
}

/**
 * Create infringer party.
 */
export function createInfringer(overrides: Partial<PartyTestData> = {}): PartyTestData {
  return createParty({
    role: 'infringer',
    name: 'Bad Actor Corp.',
    organization: 'Bad Actor Corporation',
    contactEmail: 'legal@badactor.com',
    ...overrides,
  });
}

/**
 * Create multiple enforcement matters.
 */
export function createEnforcementMatters(
  count: number,
  overrides: Partial<EnforcementMatterTestData> = {}
): EnforcementMatterTestData[] {
  return Array.from({ length: count }, (_, i) =>
    createEnforcementMatter({
      title: `Test Matter ${i + 1}`,
      matterNumber: `ENF-2024-${(i + 1).toString().padStart(3, '0')}`,
      ...overrides,
    })
  );
}
