/**
 * @ecosystem/test-utils - Test Fixtures
 *
 * Factory functions for generating test data across the ecosystem.
 * All factories return fully-typed, valid domain objects with sensible defaults.
 */

import { randomUUID } from 'node:crypto';

// =============================================================================
// Types
// =============================================================================

export interface TestEntity {
  id: string;
  name: string;
  legalName: string;
  entityType: 'corporation' | 'llc' | 'lp' | 'llp' | 'partnership' | 'sole_proprietorship' | 'nonprofit' | 'trust' | 'other';
  status: 'active' | 'inactive' | 'dissolved' | 'merged' | 'converted' | 'suspended';
  jurisdictionCountry: string;
  jurisdictionState?: string;
  incorporationDate?: Date;
  taxId?: string;
  registrationNumber?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
  deletedAt?: Date;
}

export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'viewer' | 'auditor';
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface TestPolicy {
  id: string;
  name: string;
  description: string;
  policyType: 'insurance' | 'compliance' | 'privacy' | 'security';
  status: 'draft' | 'active' | 'expired' | 'cancelled';
  effectiveDate: Date;
  expirationDate?: Date;
  premium?: number;
  coverage?: number;
  entityId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface TestObligation {
  id: string;
  name: string;
  description: string;
  obligationType: 'regulatory' | 'contractual' | 'internal' | 'tax';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'waived';
  dueDate: Date;
  completedDate?: Date;
  entityId: string;
  responsiblePartyId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  regulatoryFramework?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface TestOfficer {
  id: string;
  entityId: string;
  personId: string;
  name: string;
  title: 'ceo' | 'cfo' | 'coo' | 'cto' | 'president' | 'vice_president' | 'secretary' | 'treasurer' | 'general_counsel' | 'other';
  customTitle?: string;
  email?: string;
  appointmentDate: Date;
  terminationDate?: Date;
  compensationAmount?: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  deletedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface TestShareholder {
  id: string;
  entityId: string;
  shareholderType: 'individual' | 'corporation' | 'trust' | 'partnership' | 'other';
  name: string;
  taxId?: string;
  contactEmail?: string;
  sharesOwned?: number;
  ownershipPercentage?: number;
  address?: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  createdAt: Date;
  updatedAt: Date;
  version: number;
  deletedAt?: Date;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Overrides Types
// =============================================================================

export type TestEntityOverrides = Partial<Omit<TestEntity, 'id' | 'createdAt' | 'updatedAt'>>;
export type TestUserOverrides = Partial<Omit<TestUser, 'id' | 'createdAt' | 'updatedAt'>>;
export type TestPolicyOverrides = Partial<Omit<TestPolicy, 'id' | 'createdAt' | 'updatedAt'>>;
export type TestObligationOverrides = Partial<Omit<TestObligation, 'id' | 'createdAt' | 'updatedAt'>>;
export type TestOfficerOverrides = Partial<Omit<TestOfficer, 'id' | 'createdAt' | 'updatedAt'>>;
export type TestShareholderOverrides = Partial<Omit<TestShareholder, 'id' | 'createdAt' | 'updatedAt'>>;

// =============================================================================
// Fixture Counter (for unique names)
// =============================================================================

let fixtureCounter = 0;

function nextId(): number {
  return ++fixtureCounter;
}

/**
 * Reset fixture counter (useful for test isolation)
 */
export function resetFixtureCounter(): void {
  fixtureCounter = 0;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a test legal entity with sensible defaults
 */
export function createTestEntity(overrides: TestEntityOverrides = {}): TestEntity {
  const count = nextId();
  const now = new Date();

  return {
    id: randomUUID(),
    name: `Test Entity ${count}`,
    legalName: `Test Entity ${count} Ltd.`,
    entityType: 'corporation',
    status: 'active',
    jurisdictionCountry: 'US',
    jurisdictionState: 'DE',
    incorporationDate: new Date('2024-01-01'),
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a test user with sensible defaults
 */
export function createTestUser(overrides: TestUserOverrides = {}): TestUser {
  const count = nextId();
  const now = new Date();

  return {
    id: randomUUID(),
    email: `testuser${count}@example.com`,
    firstName: `Test`,
    lastName: `User${count}`,
    role: 'user',
    permissions: ['read', 'write'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a test policy with sensible defaults
 */
export function createTestPolicy(overrides: TestPolicyOverrides = {}): TestPolicy {
  const count = nextId();
  const now = new Date();
  const effectiveDate = new Date();
  const expirationDate = new Date();
  expirationDate.setFullYear(expirationDate.getFullYear() + 1);

  return {
    id: randomUUID(),
    name: `Test Policy ${count}`,
    description: `Description for test policy ${count}`,
    policyType: 'insurance',
    status: 'active',
    effectiveDate,
    expirationDate,
    premium: 10000,
    coverage: 1000000,
    entityId: randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a test compliance obligation with sensible defaults
 */
export function createTestObligation(overrides: TestObligationOverrides = {}): TestObligation {
  const count = nextId();
  const now = new Date();
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 1);

  return {
    id: randomUUID(),
    name: `Test Obligation ${count}`,
    description: `Description for test obligation ${count}`,
    obligationType: 'regulatory',
    status: 'pending',
    dueDate,
    entityId: randomUUID(),
    priority: 'medium',
    regulatoryFramework: 'SOC2',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a test officer with sensible defaults
 */
export function createTestOfficer(overrides: TestOfficerOverrides = {}): TestOfficer {
  const count = nextId();
  const now = new Date();

  return {
    id: randomUUID(),
    entityId: randomUUID(),
    personId: randomUUID(),
    name: `Test Officer ${count}`,
    title: 'ceo',
    email: `officer${count}@example.com`,
    appointmentDate: new Date('2024-01-01'),
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a test shareholder with sensible defaults
 */
export function createTestShareholder(overrides: TestShareholderOverrides = {}): TestShareholder {
  const count = nextId();
  const now = new Date();

  return {
    id: randomUUID(),
    entityId: randomUUID(),
    shareholderType: 'individual',
    name: `Test Shareholder ${count}`,
    contactEmail: `shareholder${count}@example.com`,
    sharesOwned: 1000,
    ownershipPercentage: 10,
    address: {
      street: '123 Test Street',
      city: 'Test City',
      state: 'CA',
      postalCode: '12345',
      country: 'US',
    },
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Bulk Factories
// =============================================================================

/**
 * Create multiple test entities
 */
export function createTestEntities(count: number, overrides: TestEntityOverrides = {}): TestEntity[] {
  return Array.from({ length: count }, () => createTestEntity(overrides));
}

/**
 * Create multiple test users
 */
export function createTestUsers(count: number, overrides: TestUserOverrides = {}): TestUser[] {
  return Array.from({ length: count }, () => createTestUser(overrides));
}

/**
 * Create multiple test policies
 */
export function createTestPolicies(count: number, overrides: TestPolicyOverrides = {}): TestPolicy[] {
  return Array.from({ length: count }, () => createTestPolicy(overrides));
}

/**
 * Create multiple test obligations
 */
export function createTestObligations(count: number, overrides: TestObligationOverrides = {}): TestObligation[] {
  return Array.from({ length: count }, () => createTestObligation(overrides));
}

// =============================================================================
// Scenario Factories
// =============================================================================

/**
 * Create a complete entity with officers and shareholders
 */
export function createTestEntityWithRelations(
  entityOverrides: TestEntityOverrides = {},
  options: {
    officerCount?: number;
    shareholderCount?: number;
  } = {}
): {
  entity: TestEntity;
  officers: TestOfficer[];
  shareholders: TestShareholder[];
} {
  const entity = createTestEntity(entityOverrides);

  const officers = Array.from(
    { length: options.officerCount ?? 2 },
    () => createTestOfficer({ entityId: entity.id })
  );

  const shareholders = Array.from(
    { length: options.shareholderCount ?? 3 },
    () => createTestShareholder({ entityId: entity.id })
  );

  return { entity, officers, shareholders };
}

/**
 * Create an entity hierarchy (parent with subsidiaries)
 */
export function createTestEntityHierarchy(
  parentOverrides: TestEntityOverrides = {},
  subsidiaryCount: number = 2
): {
  parent: TestEntity;
  subsidiaries: TestEntity[];
} {
  const parent = createTestEntity({ ...parentOverrides, name: 'Parent Corp' });

  const subsidiaries = Array.from({ length: subsidiaryCount }, (_, i) =>
    createTestEntity({
      name: `Subsidiary ${i + 1}`,
      jurisdictionCountry: parent.jurisdictionCountry,
    })
  );

  return { parent, subsidiaries };
}
