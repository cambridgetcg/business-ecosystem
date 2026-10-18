/**
 * Entity Governance Integration Tests
 *
 * Tests the full lifecycle of legal entities including:
 * - Entity creation and status transitions
 * - Officer management (appoint, update, terminate)
 * - Shareholder management (add, update, transfer)
 * - Filing creation and status updates
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/rest/app.js';

// =============================================================================
// TEST SETUP
// =============================================================================

let app: FastifyInstance;

// Mock RabbitMQ publisher to prevent actual connections
vi.mock('@ecosystem/messaging', () => ({
  createRabbitMQPublisher: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    connected: true,
  })),
}));

// =============================================================================
// TEST FIXTURES / FACTORY FUNCTIONS
// =============================================================================

function createLegalEntityInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Company',
    legalName: 'Test Company Ltd',
    entityType: 'llc',
    jurisdictionCountry: 'US',
    jurisdictionState: 'DE',
    incorporationDate: new Date().toISOString(),
    taxId: '12-3456789',
    registrationNumber: 'DE-12345',
    metadata: { industry: 'technology' },
    ...overrides,
  };
}

function createOfficerInput(entityId: string, overrides: Record<string, unknown> = {}) {
  return {
    personId: crypto.randomUUID(),
    name: 'John Smith',
    title: 'ceo',
    email: 'john.smith@testcompany.com',
    appointmentDate: new Date().toISOString(),
    compensationAmount: 250000,
    metadata: { department: 'executive' },
    ...overrides,
  };
}

function createShareholderInput(entityId: string, overrides: Record<string, unknown> = {}) {
  return {
    shareholderType: 'individual',
    name: 'Jane Investor',
    taxId: '98-7654321',
    contactEmail: 'jane@investor.com',
    address: {
      line1: '123 Investment Street',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
    },
    metadata: { investorType: 'angel' },
    ...overrides,
  };
}

function createFilingInput(entityId: string, overrides: Record<string, unknown> = {}) {
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 3);

  return {
    filingType: 'annual_report',
    filingYear: new Date().getFullYear(),
    dueDate: futureDate.toISOString(),
    ...overrides,
  };
}

function createFilingRequirementInput(entityId: string, overrides: Record<string, unknown> = {}) {
  return {
    jurisdictionCountry: 'US',
    jurisdictionState: 'DE',
    filingType: 'annual_report',
    frequency: 'annual',
    dueDateRule: { monthsAfterYearEnd: 3, dayOfMonth: 1 },
    fee: 300,
    ...overrides,
  };
}

// =============================================================================
// LIFECYCLE SETUP
// =============================================================================

beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/entity_governance_test';
  process.env.LOG_LEVEL = 'error';

  // Build the app
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// ENTITY CREATION WORKFLOW TESTS
// =============================================================================

describe('Entity Creation Workflow', () => {
  it('should create a legal entity with valid input', async () => {
    const input = createLegalEntityInput();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      payload: input,
    });

    expect(response.statusCode).toBe(201);

    const entity = response.json();
    expect(entity.id).toBeDefined();
    expect(entity.name).toBe(input.name);
    expect(entity.legalName).toBe(input.legalName);
    expect(entity.entityType).toBe(input.entityType);
    expect(entity.status).toBe('active');
    expect(entity.jurisdiction?.country).toBe(input.jurisdictionCountry);
    expect(entity.jurisdiction?.state).toBe(input.jurisdictionState);
    expect(entity.version).toBe(1);
  });

  it('should reject entity creation with missing required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      payload: {
        name: 'Incomplete Company',
        // Missing legalName, entityType, jurisdictionCountry
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should reject invalid entity type', async () => {
    const input = createLegalEntityInput({ entityType: 'invalid_type' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      payload: input,
    });

    expect(response.statusCode).toBe(400);
  });

  it('should reject invalid jurisdiction country code', async () => {
    const input = createLegalEntityInput({ jurisdictionCountry: 'USA' }); // Should be 2 chars

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      payload: input,
    });

    expect(response.statusCode).toBe(400);
  });

  it('should allow optional fields to be omitted', async () => {
    const input = {
      name: 'Minimal Company',
      legalName: 'Minimal Company Inc',
      entityType: 'corporation',
      jurisdictionCountry: 'GB',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      payload: input,
    });

    expect(response.statusCode).toBe(201);

    const entity = response.json();
    expect(entity.jurisdictionState).toBeUndefined();
    expect(entity.taxId).toBeUndefined();
    expect(entity.registrationNumber).toBeUndefined();
  });

  it('should retrieve created entity by ID', async () => {
    // Create entity first
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      payload: createLegalEntityInput({ name: 'Retrievable Company' }),
    });
    const created = createResponse.json();

    // Retrieve it
    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/entities/${created.id}`,
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().id).toBe(created.id);
    expect(getResponse.json().name).toBe('Retrievable Company');
  });

  it('should return 404 for non-existent entity', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/entities/${crypto.randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('should list entities with pagination', async () => {
    // Create multiple entities
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        payload: createLegalEntityInput({ name: `Paginated Company ${i}` }),
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/entities?limit=2&offset=0',
    });

    expect(response.statusCode).toBe(200);
    const result = response.json();
    expect(result.data).toBeDefined();
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(0);
  });
});

// =============================================================================
// ENTITY STATUS TRANSITIONS TESTS
// =============================================================================

describe('Entity Status Transitions', () => {
  let entityId: string;

  beforeEach(async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      payload: createLegalEntityInput({ name: 'Status Transition Company' }),
    });
    entityId = response.json().id;
  });

  it('should transition from active to inactive', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/entities/${entityId}`,
      payload: { status: 'inactive' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('inactive');
  });

  it('should transition from active to suspended', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/entities/${entityId}`,
      payload: { status: 'suspended' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('suspended');
  });

  it('should dissolve an active entity', async () => {
    const dissolutionDate = new Date().toISOString();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/entities/${entityId}/dissolve`,
      payload: {
        dissolutionDate,
        reason: 'Business closure',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('dissolved');
    expect(response.json().dissolutionDate).toBeDefined();
  });

  it('should dissolve an inactive entity', async () => {
    // First make it inactive
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/entities/${entityId}`,
      payload: { status: 'inactive' },
    });

    // Then dissolve it
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/entities/${entityId}/dissolve`,
      payload: {
        dissolutionDate: new Date().toISOString(),
        reason: 'Voluntary dissolution',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('dissolved');
  });

  it('should not allow dissolving an already dissolved entity', async () => {
    // First dissolve it
    await app.inject({
      method: 'POST',
      url: `/api/v1/entities/${entityId}/dissolve`,
      payload: {
        dissolutionDate: new Date().toISOString(),
        reason: 'First dissolution',
      },
    });

    // Try to dissolve again
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/entities/${entityId}/dissolve`,
      payload: {
        dissolutionDate: new Date().toISOString(),
        reason: 'Second dissolution attempt',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should not allow dissolving a suspended entity', async () => {
    // First suspend it
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/entities/${entityId}`,
      payload: { status: 'suspended' },
    });

    // Try to dissolve
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/entities/${entityId}/dissolve`,
      payload: {
        dissolutionDate: new Date().toISOString(),
        reason: 'Attempted dissolution',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should soft delete an entity', async () => {
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/entities/${entityId}`,
    });

    expect(deleteResponse.statusCode).toBe(204);

    // Verify entity is no longer retrievable
    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/entities/${entityId}`,
    });

    expect(getResponse.statusCode).toBe(404);
  });

  it('should update entity name and legal name', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/entities/${entityId}`,
      payload: {
        name: 'Updated Company Name',
        legalName: 'Updated Company Legal Name Ltd',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Updated Company Name');
    expect(response.json().legalName).toBe('Updated Company Legal Name Ltd');
  });
});

// =============================================================================
// OFFICER MANAGEMENT TESTS
// =============================================================================

describe('Officer Management', () => {
  let entityId: string;

  beforeEach(async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      payload: createLegalEntityInput({ name: 'Officer Test Company' }),
    });
    entityId = response.json().id;
  });

  describe('Officer Appointment', () => {
    it('should appoint a new officer', async () => {
      const officerInput = createOfficerInput(entityId);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/officers`,
        payload: officerInput,
      });

      expect(response.statusCode).toBe(201);

      const officer = response.json();
      expect(officer.id).toBeDefined();
      expect(officer.entityId).toBe(entityId);
      expect(officer.name).toBe(officerInput.name);
      expect(officer.title).toBe(officerInput.title);
    });

    it('should appoint officers with different titles', async () => {
      const titles = ['ceo', 'cfo', 'coo', 'secretary', 'treasurer'];

      for (const title of titles) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/entities/${entityId}/officers`,
          payload: createOfficerInput(entityId, { title, name: `${title.toUpperCase()} Officer` }),
        });

        expect(response.statusCode).toBe(201);
        expect(response.json().title).toBe(title);
      }

      // List all officers
      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${entityId}/officers`,
      });

      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().count).toBe(titles.length);
    });

    it('should reject appointment without required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/officers`,
        payload: {
          name: 'Incomplete Officer',
          // Missing personId, title, appointmentDate
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject appointment for non-existent entity', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${crypto.randomUUID()}/officers`,
        payload: createOfficerInput(entityId),
      });

      expect(response.statusCode).toBe(404);
    });

    it('should allow custom title for other officer type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/officers`,
        payload: createOfficerInput(entityId, {
          title: 'other',
          customTitle: 'Chief Innovation Officer',
        }),
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().title).toBe('other');
      expect(response.json().customTitle).toBe('Chief Innovation Officer');
    });
  });

  describe('Officer Update', () => {
    let officerId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/officers`,
        payload: createOfficerInput(entityId),
      });
      officerId = response.json().id;
    });

    it('should update officer title', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/officers/${officerId}`,
        payload: { title: 'president' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().title).toBe('president');
    });

    it('should update officer email', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/officers/${officerId}`,
        payload: { email: 'new.email@company.com' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().email).toBe('new.email@company.com');
    });

    it('should update officer compensation', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/officers/${officerId}`,
        payload: { compensationAmount: 300000 },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().compensationAmount).toBe(300000);
    });

    it('should retrieve officer by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/officers/${officerId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().id).toBe(officerId);
    });

    it('should return 404 for non-existent officer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/officers/${crypto.randomUUID()}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Officer Termination', () => {
    let officerId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/officers`,
        payload: createOfficerInput(entityId),
      });
      officerId = response.json().id;
    });

    it('should terminate an officer', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/officers/${officerId}/terminate`,
        payload: {
          terminationDate: new Date().toISOString(),
          reason: 'Resignation',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().terminationDate).toBeDefined();
    });

    it('should not allow terminating an already terminated officer', async () => {
      // First termination
      await app.inject({
        method: 'POST',
        url: `/api/v1/officers/${officerId}/terminate`,
        payload: {
          terminationDate: new Date().toISOString(),
          reason: 'First termination',
        },
      });

      // Second termination attempt
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/officers/${officerId}/terminate`,
        payload: {
          terminationDate: new Date().toISOString(),
          reason: 'Second termination attempt',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should exclude terminated officers from default list', async () => {
      // Terminate the officer
      await app.inject({
        method: 'POST',
        url: `/api/v1/officers/${officerId}/terminate`,
        payload: {
          terminationDate: new Date().toISOString(),
          reason: 'Resignation',
        },
      });

      // List officers (without terminated)
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${entityId}/officers`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().count).toBe(0);
    });

    it('should include terminated officers when requested', async () => {
      // Terminate the officer
      await app.inject({
        method: 'POST',
        url: `/api/v1/officers/${officerId}/terminate`,
        payload: {
          terminationDate: new Date().toISOString(),
          reason: 'Resignation',
        },
      });

      // List officers (including terminated)
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${entityId}/officers?includeTerminated=true`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().count).toBe(1);
    });

    it('should not allow updating a terminated officer', async () => {
      // Terminate the officer
      await app.inject({
        method: 'POST',
        url: `/api/v1/officers/${officerId}/terminate`,
        payload: {
          terminationDate: new Date().toISOString(),
          reason: 'Resignation',
        },
      });

      // Try to update
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/officers/${officerId}`,
        payload: { title: 'cfo' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should delete an officer record', async () => {
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/v1/officers/${officerId}`,
      });

      expect(deleteResponse.statusCode).toBe(204);

      // Verify officer is gone
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/officers/${officerId}`,
      });

      expect(getResponse.statusCode).toBe(404);
    });
  });
});

// =============================================================================
// SHAREHOLDER MANAGEMENT TESTS
// =============================================================================

describe('Shareholder Management', () => {
  let entityId: string;

  beforeEach(async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      payload: createLegalEntityInput({ name: 'Shareholder Test Company' }),
    });
    entityId = response.json().id;
  });

  describe('Add Shareholder', () => {
    it('should add an individual shareholder', async () => {
      const shareholderInput = createShareholderInput(entityId);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/shareholders`,
        payload: shareholderInput,
      });

      expect(response.statusCode).toBe(201);

      const shareholder = response.json();
      expect(shareholder.id).toBeDefined();
      expect(shareholder.entityId).toBe(entityId);
      expect(shareholder.name).toBe(shareholderInput.name);
      expect(shareholder.shareholderType).toBe('individual');
    });

    it('should add a corporate shareholder', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/shareholders`,
        payload: createShareholderInput(entityId, {
          shareholderType: 'corporation',
          name: 'Investment Corp LLC',
        }),
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().shareholderType).toBe('corporation');
    });

    it('should add a trust shareholder', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/shareholders`,
        payload: createShareholderInput(entityId, {
          shareholderType: 'trust',
          name: 'Family Trust',
        }),
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().shareholderType).toBe('trust');
    });

    it('should reject shareholder for non-existent entity', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${crypto.randomUUID()}/shareholders`,
        payload: createShareholderInput(entityId),
      });

      expect(response.statusCode).toBe(404);
    });

    it('should add shareholder without optional fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/shareholders`,
        payload: {
          shareholderType: 'individual',
          name: 'Minimal Shareholder',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should list shareholders for an entity', async () => {
      // Add multiple shareholders
      await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/shareholders`,
        payload: createShareholderInput(entityId, { name: 'Shareholder 1' }),
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/shareholders`,
        payload: createShareholderInput(entityId, { name: 'Shareholder 2' }),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${entityId}/shareholders`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().count).toBe(2);
    });
  });

  describe('Update Shareholder', () => {
    let shareholderId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/shareholders`,
        payload: createShareholderInput(entityId),
      });
      shareholderId = response.json().id;
    });

    it('should update shareholder name', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/shareholders/${shareholderId}`,
        payload: { name: 'Updated Shareholder Name' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().name).toBe('Updated Shareholder Name');
    });

    it('should update shareholder contact email', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/shareholders/${shareholderId}`,
        payload: { contactEmail: 'new.email@investor.com' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().contactEmail).toBe('new.email@investor.com');
    });

    it('should update shareholder address', async () => {
      const newAddress = {
        line1: '456 New Street',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'US',
      };

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/shareholders/${shareholderId}`,
        payload: { address: newAddress },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().address.city).toBe('Los Angeles');
    });

    it('should retrieve shareholder by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/shareholders/${shareholderId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().id).toBe(shareholderId);
    });

    it('should return 404 for non-existent shareholder', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/shareholders/${crypto.randomUUID()}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Remove Shareholder', () => {
    let shareholderId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/shareholders`,
        payload: createShareholderInput(entityId),
      });
      shareholderId = response.json().id;
    });

    it('should remove a shareholder', async () => {
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/v1/shareholders/${shareholderId}`,
      });

      expect(deleteResponse.statusCode).toBe(204);

      // Verify shareholder is removed
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/shareholders/${shareholderId}`,
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 when removing non-existent shareholder', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/shareholders/${crypto.randomUUID()}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });
});

// =============================================================================
// FILING MANAGEMENT TESTS
// =============================================================================

describe('Filing Management', () => {
  let entityId: string;

  beforeEach(async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      payload: createLegalEntityInput({ name: 'Filing Test Company' }),
    });
    entityId = response.json().id;
  });

  describe('Filing Requirements', () => {
    it('should create a filing requirement', async () => {
      const requirementInput = createFilingRequirementInput(entityId);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filing-requirements`,
        payload: requirementInput,
      });

      expect(response.statusCode).toBe(201);

      const requirement = response.json();
      expect(requirement.id).toBeDefined();
      expect(requirement.entityId).toBe(entityId);
      expect(requirement.filingType).toBe(requirementInput.filingType);
      expect(requirement.frequency).toBe('annual');
    });

    it('should list filing requirements for an entity', async () => {
      // Create multiple requirements
      await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filing-requirements`,
        payload: createFilingRequirementInput(entityId, { filingType: 'annual_report' }),
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filing-requirements`,
        payload: createFilingRequirementInput(entityId, { filingType: 'franchise_tax' }),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${entityId}/filing-requirements`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().count).toBe(2);
    });
  });

  describe('Filing Creation and Status Updates', () => {
    it('should create a filing', async () => {
      const filingInput = createFilingInput(entityId);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: filingInput,
      });

      expect(response.statusCode).toBe(201);

      const filing = response.json();
      expect(filing.id).toBeDefined();
      expect(filing.entityId).toBe(entityId);
      expect(filing.filingType).toBe(filingInput.filingType);
      expect(filing.status).toBe('pending');
    });

    it('should retrieve a filing by ID', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId),
      });
      const filingId = createResponse.json().id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/filings/${filingId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().id).toBe(filingId);
    });

    it('should return 404 for non-existent filing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/filings/${crypto.randomUUID()}`,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should list filings for an entity', async () => {
      // Create multiple filings
      await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId, { filingYear: 2024 }),
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId, { filingYear: 2025 }),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${entityId}/filings`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().count).toBe(2);
    });

    it('should filter filings by year', async () => {
      await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId, { filingYear: 2024 }),
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId, { filingYear: 2025 }),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${entityId}/filings?year=2024`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().count).toBe(1);
      expect(response.json().data[0].filingYear).toBe(2024);
    });

    it('should filter filings by status', async () => {
      // Create a filing
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId),
      });
      const filingId = createResponse.json().id;

      // Submit the filing
      await app.inject({
        method: 'POST',
        url: `/api/v1/filings/${filingId}/submit`,
        payload: { confirmationNumber: 'CONF-123' },
      });

      // Create another pending filing
      await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId, { filingType: 'other_filing' }),
      });

      // Filter by submitted status
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${entityId}/filings?status=submitted`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().count).toBe(1);
      expect(response.json().data[0].status).toBe('submitted');
    });

    it('should update filing status', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId),
      });
      const filingId = createResponse.json().id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/filings/${filingId}`,
        payload: { status: 'submitted' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('submitted');
    });

    it('should submit a filing with confirmation number', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId),
      });
      const filingId = createResponse.json().id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/filings/${filingId}/submit`,
        payload: {
          confirmationNumber: 'CH-2024-001234',
          feePaid: 300,
        },
      });

      expect(response.statusCode).toBe(200);

      const filing = response.json();
      expect(filing.status).toBe('submitted');
      expect(filing.confirmationNumber).toBe('CH-2024-001234');
      expect(filing.feePaid).toBe(300);
      expect(filing.filedDate).toBeDefined();
    });

    it('should mark filing as accepted after submission', async () => {
      // Create and submit
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId),
      });
      const filingId = createResponse.json().id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/filings/${filingId}/submit`,
        payload: { confirmationNumber: 'CH-123' },
      });

      // Update to accepted
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/filings/${filingId}`,
        payload: { status: 'accepted' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('accepted');
    });

    it('should mark filing as rejected', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId),
      });
      const filingId = createResponse.json().id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/filings/${filingId}/submit`,
        payload: { confirmationNumber: 'CH-123' },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/filings/${filingId}`,
        payload: { status: 'rejected' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('rejected');
    });
  });

  describe('Filing Compliance Views', () => {
    it('should get upcoming filings', async () => {
      // Create a future filing
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId, { dueDate: futureDate.toISOString() }),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/filings/upcoming?entityId=${entityId}&days=90`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().count).toBeGreaterThanOrEqual(1);
    });

    it('should get overdue filings', async () => {
      // Create a past-due filing
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/filings`,
        payload: createFilingInput(entityId, { dueDate: pastDate.toISOString() }),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/filings/overdue?entityId=${entityId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().count).toBeGreaterThanOrEqual(1);
    });
  });
});

// =============================================================================
// HEALTH CHECK TESTS
// =============================================================================

describe('Health Checks', () => {
  it('should return healthy status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
  });

  it('should return live status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('live');
  });

  it('should check readiness with database connectivity', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    // May be 200 or 503 depending on database availability
    expect([200, 503]).toContain(response.statusCode);
  });
});
