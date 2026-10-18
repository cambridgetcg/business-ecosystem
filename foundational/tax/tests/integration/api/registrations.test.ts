/**
 * Registration API Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registrationRoutes } from '../../../src/api/rest/routes/registrations.js';
import {
  createMockRegistrationRepository,
  createMockEventPublisher,
} from './test-helpers.js';

describe('Registration API', () => {
  let app: FastifyInstance;
  let mockRegistrationRepository: ReturnType<typeof createMockRegistrationRepository>;
  let mockEventPublisher: ReturnType<typeof createMockEventPublisher>;

  beforeEach(async () => {
    mockRegistrationRepository = createMockRegistrationRepository();
    mockEventPublisher = createMockEventPublisher();

    app = Fastify();
    await app.register(
      async (instance) => {
        await registrationRoutes(instance, {
          registrationRepository: mockRegistrationRepository as any,
          eventPublisher: mockEventPublisher as any,
        });
      },
      { prefix: '/api/v1/tax/registrations' }
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    mockRegistrationRepository._clear();
    mockEventPublisher._clear();
  });

  describe('POST /api/v1/tax/registrations', () => {
    it('should create a new registration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tax/registrations',
        payload: {
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          entityId: '550e8400-e29b-41d4-a716-446655440001',
          accountingPeriodEnd: '2024-03-31',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.tenantId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(body.entityId).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(mockRegistrationRepository.create).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tax/registrations',
        payload: {
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          // Missing entityId and accountingPeriodEnd
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/tax/registrations', () => {
    it('should list registrations', async () => {
      // Create a registration first
      await app.inject({
        method: 'POST',
        url: '/api/v1/tax/registrations',
        payload: {
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          entityId: '550e8400-e29b-41d4-a716-446655440001',
          accountingPeriodEnd: '2024-03-31',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/tax/registrations',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter by tenantId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/tax/registrations?tenantId=550e8400-e29b-41d4-a716-446655440000',
      });

      expect(response.statusCode).toBe(200);
      expect(mockRegistrationRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: '550e8400-e29b-41d4-a716-446655440000' }),
        expect.any(Object)
      );
    });
  });

  describe('GET /api/v1/tax/registrations/:id', () => {
    it('should get registration by ID', async () => {
      // Create a registration first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/tax/registrations',
        payload: {
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          entityId: '550e8400-e29b-41d4-a716-446655440001',
          accountingPeriodEnd: '2024-03-31',
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/tax/registrations/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(created.id);
    });

    it('should return 404 for non-existent registration', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/tax/registrations/550e8400-e29b-41d4-a716-446655440099',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/tax/registrations/:id/vat', () => {
    it('should register for VAT', async () => {
      // Create a registration first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/tax/registrations',
        payload: {
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          entityId: '550e8400-e29b-41d4-a716-446655440001',
          accountingPeriodEnd: '2024-03-31',
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/tax/registrations/${created.id}/vat`,
        payload: {
          vatNumber: 'GB123456789',
          vatRegistrationDate: '2024-01-01T00:00:00.000Z',
          vatScheme: 'standard',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.vatRegistered).toBe(true);
      expect(body.vatNumber).toBe('GB123456789');
    });
  });

  describe('POST /api/v1/tax/registrations/:id/paye', () => {
    it('should register for PAYE', async () => {
      // Create a registration first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/tax/registrations',
        payload: {
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          entityId: '550e8400-e29b-41d4-a716-446655440001',
          accountingPeriodEnd: '2024-03-31',
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/tax/registrations/${created.id}/paye`,
        payload: {
          payeReference: '123/ABC123',
          accountsOfficeReference: '123PA00123456',
          payeRegistrationDate: '2024-01-01T00:00:00.000Z',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.payeRegistered).toBe(true);
      expect(body.payeReference).toBe('123/ABC123');
    });
  });
});
