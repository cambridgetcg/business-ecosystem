/**
 * WIPO Madrid Client Unit Tests
 *
 * Tests for the WIPOMadridClient, WIPOMadridSyncService, and WIPOMadridEventMapper.
 *
 * @module test/unit/infrastructure
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WIPOMadridClient,
  WIPOAPIException,
  WIPOMadridSyncService,
  WIPOMadridEventMapper,
  type InternationalRegistration,
  type CountryDesignation,
  type CentralAttackNotification,
  type MadridRenewalStatus,
  type MadridEvent,
  type WIPORegistrationData,
} from '../../../src/infrastructure/external/wipo/index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock EventBridge publisher
const mockPublisher = {
  publish: vi.fn().mockResolvedValue('event-id'),
  publishBatch: vi.fn().mockResolvedValue({ successCount: 1, failedCount: 0, failedEvents: [] }),
};

// =============================================================================
// Test Data Factories
// =============================================================================

function createMockRegistrationData(overrides: Partial<WIPORegistrationData> = {}): WIPORegistrationData {
  return {
    internationalRegistrationNumber: 'IR1234567',
    basicMarkReference: 'US97/123456',
    officeOfOrigin: 'US',
    holderName: 'Test Corporation',
    holderAddress: '123 Test Street, Test City, USA',
    filingDate: '2023-01-15',
    registrationDate: '2023-03-01',
    expirationDate: '2033-03-01',
    status: 'registered',
    mark: 'TESTMARK',
    markType: 'word',
    niceClasses: [
      { classNumber: 9, goodsServices: 'Computer software' },
      { classNumber: 42, goodsServices: 'Software as a service' },
    ],
    designations: [
      {
        countryCode: 'DE',
        countryName: 'Germany',
        designationDate: '2023-01-15',
        status: 'protected',
        statusDate: '2023-06-01',
        protectionDate: '2023-06-01',
        classes: [9, 42],
      },
      {
        countryCode: 'FR',
        countryName: 'France',
        designationDate: '2023-01-15',
        status: 'pending',
        statusDate: '2023-01-15',
        classes: [9, 42],
      },
    ],
    centralAttackPeriodEnds: '2028-03-01',
    lastModified: new Date().toISOString(),
    ...overrides,
  };
}

function createMockInternationalRegistration(
  overrides: Partial<InternationalRegistration> = {}
): InternationalRegistration {
  return {
    internationalRegistrationNumber: 'IR1234567',
    basicMarkReference: 'US97/123456',
    officeOfOrigin: 'US',
    holderName: 'Test Corporation',
    holderAddress: '123 Test Street, Test City, USA',
    filingDate: new Date('2023-01-15'),
    registrationDate: new Date('2023-03-01'),
    expirationDate: new Date('2033-03-01'),
    status: 'registered',
    mark: 'TESTMARK',
    markType: 'word',
    niceClasses: [
      { classNumber: 9, goodsServices: 'Computer software' },
      { classNumber: 42, goodsServices: 'Software as a service' },
    ],
    designations: [
      {
        countryCode: 'DE',
        countryName: 'Germany',
        designationDate: new Date('2023-01-15'),
        status: 'protected',
        statusDate: new Date('2023-06-01'),
        protectionDate: new Date('2023-06-01'),
        classesProtected: [9, 42],
        appealPending: false,
      },
    ],
    centralAttackPeriodEnds: new Date('2028-03-01'),
    inDependencyPeriod: true,
    lastSyncedAt: new Date(),
    ...overrides,
  };
}

function createMockMadridEvent(
  type: MadridEvent['type'],
  overrides: Partial<MadridEvent> = {}
): MadridEvent {
  return {
    type,
    internationalRegistrationNumber: 'IR1234567',
    trademarkId: 'tm-001',
    timestamp: new Date(),
    payload: {},
    severity: 'info',
    ...overrides,
  };
}

// =============================================================================
// WIPOMadridClient Tests
// =============================================================================

describe('WIPOMadridClient', () => {
  let client: WIPOMadridClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new WIPOMadridClient({
      apiBaseUrl: 'https://test-api.wipo.int/v1',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      timeout: 5000,
      retryAttempts: 1,
      debug: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate successfully with valid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'test-token', expiresIn: 3600 }),
      });

      await client.authenticate();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.wipo.int/v1/auth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should throw error when API key is not configured', async () => {
      const noKeyClient = new WIPOMadridClient({ apiKey: '' });

      await expect(noKeyClient.authenticate()).rejects.toThrow(WIPOAPIException);
      await expect(noKeyClient.authenticate()).rejects.toThrow('API key not configured');
    });

    it('should throw error on authentication failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ code: 'AUTH_FAILED', message: 'Invalid credentials' }),
      });

      await expect(client.authenticate()).rejects.toThrow(WIPOAPIException);
    });

    it('should reuse valid token on subsequent calls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'test-token', expiresIn: 3600 }),
      });

      await client.authenticate();
      await client.authenticate();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('searchByRegistrationNumber', () => {
    beforeEach(async () => {
      // Mock authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'test-token', expiresIn: 3600 }),
      });
    });

    it('should find registration by number', async () => {
      const mockData = createMockRegistrationData();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await client.searchByRegistrationNumber('IR1234567');

      expect(result).not.toBeNull();
      expect(result?.internationalRegistrationNumber).toBe('IR1234567');
      expect(result?.mark).toBe('TESTMARK');
      expect(result?.status).toBe('registered');
    });

    it('should normalize registration number (remove IR prefix)', async () => {
      const mockData = createMockRegistrationData();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      await client.searchByRegistrationNumber('IR1234567');

      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://test-api.wipo.int/v1/registrations/1234567',
        expect.any(Object)
      );
    });

    it('should return null for non-existent registration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify({ code: 'NOT_FOUND', message: 'Registration not found' }),
      });

      const result = await client.searchByRegistrationNumber('IR9999999');

      expect(result).toBeNull();
    });

    it('should map designations correctly', async () => {
      const mockData = createMockRegistrationData();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await client.searchByRegistrationNumber('IR1234567');

      expect(result?.designations).toHaveLength(2);
      expect(result?.designations[0]).toMatchObject({
        countryCode: 'DE',
        status: 'protected',
      });
      expect(result?.designations[1]).toMatchObject({
        countryCode: 'FR',
        status: 'pending',
      });
    });
  });

  describe('getDesignationStatus', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'test-token', expiresIn: 3600 }),
      });
    });

    it('should get designation status for specific country', async () => {
      const mockData = createMockRegistrationData();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await client.getDesignationStatus('IR1234567', 'DE');

      expect(result).not.toBeNull();
      expect(result?.countryCode).toBe('DE');
      expect(result?.status).toBe('protected');
    });

    it('should return null for non-designated country', async () => {
      const mockData = createMockRegistrationData();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await client.getDesignationStatus('IR1234567', 'JP');

      expect(result).toBeNull();
    });
  });

  describe('checkCentralAttackStatus', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'test-token', expiresIn: 3600 }),
      });
    });

    it('should return null when no central attack', async () => {
      const mockData = createMockRegistrationData();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await client.checkCentralAttackStatus('IR1234567');

      expect(result).toBeNull();
    });

    it('should return central attack notification when present', async () => {
      const mockData = createMockRegistrationData({
        centralAttackNotification: {
          notificationId: 'notif-001',
          notificationDate: '2024-06-01',
          attackType: 'cancellation',
          ceasedDate: '2024-05-15',
          classesAffected: [9, 42],
          fullCancellation: true,
          transformationDeadline: '2024-09-01',
        },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await client.checkCentralAttackStatus('IR1234567');

      expect(result).not.toBeNull();
      expect(result?.attackType).toBe('cancellation');
      expect(result?.severity).toBe('critical');
      expect(result?.fullCancellation).toBe(true);
    });
  });

  describe('getRenewalStatus', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'test-token', expiresIn: 3600 }),
      });
    });

    it('should calculate renewal status correctly', async () => {
      const mockData = createMockRegistrationData();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await client.getRenewalStatus('IR1234567');

      expect(result.internationalRegistrationNumber).toBe('IR1234567');
      expect(result.currentExpirationDate).toEqual(new Date('2033-03-01'));
      expect(result.renewalDueDate).toEqual(new Date('2033-03-01'));
      expect(result.inGracePeriod).toBe(false);
      expect(result.estimatedFee).toBeGreaterThan(0);
    });

    it('should set renewal window 6 months before expiration', async () => {
      const mockData = createMockRegistrationData();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await client.getRenewalStatus('IR1234567');

      const expectedWindowOpens = new Date('2032-09-01');
      expect(result.renewalWindowOpens.getFullYear()).toBe(expectedWindowOpens.getFullYear());
      expect(result.renewalWindowOpens.getMonth()).toBe(expectedWindowOpens.getMonth());
    });

    it('should set grace deadline 6 months after expiration', async () => {
      const mockData = createMockRegistrationData();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await client.getRenewalStatus('IR1234567');

      const expectedGraceDeadline = new Date('2033-09-01');
      expect(result.graceDeadline.getFullYear()).toBe(expectedGraceDeadline.getFullYear());
      expect(result.graceDeadline.getMonth()).toBe(expectedGraceDeadline.getMonth());
    });
  });
});

// =============================================================================
// WIPOMadridSyncService Tests
// =============================================================================

describe('WIPOMadridSyncService', () => {
  let syncService: WIPOMadridSyncService;
  let mockClient: Partial<WIPOMadridClient>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      getRegistrationStatus: vi.fn(),
      checkCentralAttackStatus: vi.fn(),
      getRenewalStatus: vi.fn(),
    };

    syncService = new WIPOMadridSyncService(
      mockClient as WIPOMadridClient,
      mockPublisher as any
    );
  });

  afterEach(() => {
    syncService.stopSyncJob();
    vi.clearAllMocks();
  });

  describe('trackRegistration', () => {
    it('should add registration to tracking list', () => {
      syncService.trackRegistration('IR1234567', 'tm-001');

      const tracked = syncService.getTrackingStatus('IR1234567');
      expect(tracked).toBeDefined();
      expect(tracked?.trademarkId).toBe('tm-001');
    });

    it('should not duplicate tracking', () => {
      syncService.trackRegistration('IR1234567', 'tm-001');
      syncService.trackRegistration('IR1234567', 'tm-002');

      const tracked = syncService.getTrackedRegistrations();
      expect(tracked).toHaveLength(1);
      expect(tracked[0]?.trademarkId).toBe('tm-001');
    });
  });

  describe('untrackRegistration', () => {
    it('should remove registration from tracking', () => {
      syncService.trackRegistration('IR1234567', 'tm-001');
      syncService.untrackRegistration('IR1234567');

      const tracked = syncService.getTrackingStatus('IR1234567');
      expect(tracked).toBeUndefined();
    });
  });

  describe('runSync', () => {
    it('should sync all tracked registrations', async () => {
      const mockRegistration = createMockInternationalRegistration();
      (mockClient.getRegistrationStatus as any).mockResolvedValue(mockRegistration);

      syncService.trackRegistration('IR1234567', 'tm-001');

      const result = await syncService.runSync();

      expect(result.registrationsChecked).toBe(1);
      expect(result.success).toBe(true);
      expect(mockClient.getRegistrationStatus).toHaveBeenCalledWith('IR1234567');
    });

    it('should detect status changes', async () => {
      const mockRegistration = createMockInternationalRegistration({
        status: 'renewed',
      });
      (mockClient.getRegistrationStatus as any).mockResolvedValue(mockRegistration);

      syncService.trackRegistration('IR1234567', 'tm-001');

      const result = await syncService.runSync();

      expect(result.statusChanges).toBeGreaterThanOrEqual(1);
      expect(result.registrationsUpdated).toBe(1);
    });

    it('should detect new designations', async () => {
      const mockRegistration = createMockInternationalRegistration({
        designations: [
          {
            countryCode: 'DE',
            countryName: 'Germany',
            designationDate: new Date('2023-01-15'),
            status: 'protected',
            statusDate: new Date('2023-06-01'),
            classesProtected: [9, 42],
            appealPending: false,
          },
          {
            countryCode: 'JP',
            countryName: 'Japan',
            designationDate: new Date('2024-01-15'),
            status: 'pending',
            statusDate: new Date('2024-01-15'),
            classesProtected: [9],
            appealPending: false,
          },
        ],
      });
      (mockClient.getRegistrationStatus as any).mockResolvedValue(mockRegistration);

      syncService.trackRegistration('IR1234567', 'tm-001');

      const result = await syncService.runSync();

      expect(result.newDesignations).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      (mockClient.getRegistrationStatus as any).mockRejectedValue(
        new Error('API Error')
      );

      syncService.trackRegistration('IR1234567', 'tm-001');

      const result = await syncService.runSync();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe('API Error');
    });

    it('should not run if already running', async () => {
      const mockRegistration = createMockInternationalRegistration();
      (mockClient.getRegistrationStatus as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockRegistration), 100))
      );

      syncService.trackRegistration('IR1234567', 'tm-001');

      const promise1 = syncService.runSync();

      await expect(syncService.runSync()).rejects.toThrow('Sync already in progress');

      await promise1;
    });

    it('should publish sync completed event', async () => {
      const mockRegistration = createMockInternationalRegistration();
      (mockClient.getRegistrationStatus as any).mockResolvedValue(mockRegistration);

      syncService.trackRegistration('IR1234567', 'tm-001');

      await syncService.runSync();

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'Madrid.SyncCompleted',
          aggregateType: 'MadridSync',
        })
      );
    });
  });

  describe('syncJob', () => {
    it('should start sync job with interval', () => {
      vi.useFakeTimers();

      syncService.startSyncJob(60);

      const job = syncService.getSyncJobStatus();
      expect(job).not.toBeNull();
      expect(job?.enabled).toBe(true);
      expect(job?.intervalMinutes).toBe(60);

      vi.useRealTimers();
    });

    it('should stop sync job', () => {
      vi.useFakeTimers();

      syncService.startSyncJob(60);
      syncService.stopSyncJob();

      const job = syncService.getSyncJobStatus();
      expect(job?.enabled).toBe(false);

      vi.useRealTimers();
    });

    it('should restart sync job if started twice', () => {
      vi.useFakeTimers();

      syncService.startSyncJob(60);
      const job1 = syncService.getSyncJobStatus();

      syncService.startSyncJob(30);
      const job2 = syncService.getSyncJobStatus();

      expect(job1?.jobId).not.toBe(job2?.jobId);
      expect(job2?.intervalMinutes).toBe(30);

      vi.useRealTimers();
    });
  });
});

// =============================================================================
// WIPOMadridEventMapper Tests
// =============================================================================

describe('WIPOMadridEventMapper', () => {
  let mapper: WIPOMadridEventMapper;

  beforeEach(() => {
    vi.clearAllMocks();
    mapper = new WIPOMadridEventMapper(mockPublisher as any);
  });

  describe('mapDesignationAccepted', () => {
    it('should map to update_trademark_territories action', () => {
      const event = createMockMadridEvent('designation_accepted', {
        payload: {
          countryCode: 'DE',
          countryName: 'Germany',
          protectionDate: '2024-06-01',
          classesProtected: [9, 42],
        },
      });

      const result = mapper.mapEvent(event);

      expect(result.success).toBe(true);
      expect(result.actions).toContainEqual(
        expect.objectContaining({
          type: 'update_trademark_territories',
          payload: expect.objectContaining({
            action: 'add_territory',
            countryCode: 'DE',
          }),
        })
      );
    });

    it('should emit Trademark.TerritoryProtected domain event', () => {
      const event = createMockMadridEvent('designation_accepted', {
        payload: {
          countryCode: 'FR',
        },
      });

      const result = mapper.mapEvent(event);

      expect(result.domainEvents).toContainEqual(
        expect.objectContaining({
          type: 'Trademark.TerritoryProtected',
          aggregateType: 'Trademark',
        })
      );
    });
  });

  describe('mapDesignationRefused', () => {
    it('should map to create_appeal_deadline action when appeal deadline provided', () => {
      const appealDeadline = new Date();
      appealDeadline.setMonth(appealDeadline.getMonth() + 2);

      const event = createMockMadridEvent('designation_refused', {
        payload: {
          countryCode: 'JP',
          refusalReason: 'Relative grounds - prior rights',
          appealDeadline: appealDeadline.toISOString(),
        },
      });

      const result = mapper.mapEvent(event);

      expect(result.success).toBe(true);
      expect(result.actions).toContainEqual(
        expect.objectContaining({
          type: 'create_appeal_deadline',
          priority: 'high',
        })
      );
    });

    it('should send warning alert', () => {
      const event = createMockMadridEvent('designation_refused', {
        payload: {
          countryCode: 'CN',
          refusalReason: 'Absolute grounds',
        },
      });

      const result = mapper.mapEvent(event);

      expect(result.actions).toContainEqual(
        expect.objectContaining({
          type: 'send_warning_alert',
          priority: 'high',
        })
      );
    });
  });

  describe('mapDesignationProvisionallyRefused', () => {
    it('should map to create_response_deadline action', () => {
      const responseDeadline = new Date();
      responseDeadline.setMonth(responseDeadline.getMonth() + 3);

      const event = createMockMadridEvent('designation_provisionally_refused', {
        payload: {
          countryCode: 'KR',
          refusalReason: 'Requires disclaimer',
          responseDeadline: responseDeadline.toISOString(),
        },
      });

      const result = mapper.mapEvent(event);

      expect(result.actions).toContainEqual(
        expect.objectContaining({
          type: 'create_response_deadline',
          priority: 'critical',
        })
      );
    });
  });

  describe('mapCentralAttackNotified', () => {
    it('should map to critical alert and transformation deadline', () => {
      const transformationDeadline = new Date();
      transformationDeadline.setMonth(transformationDeadline.getMonth() + 3);

      const event = createMockMadridEvent('central_attack_notified', {
        payload: {
          notificationId: 'notif-001',
          notificationDate: new Date().toISOString(),
          attackType: 'cancellation',
          officeOfOrigin: 'US',
          ceasedDate: new Date().toISOString(),
          classesAffected: [9, 42],
          fullCancellation: true,
          transformationDeadline: transformationDeadline.toISOString(),
          countriesForTransformation: ['DE', 'FR', 'JP'],
        },
        severity: 'critical',
      });

      const result = mapper.mapEvent(event);

      expect(result.success).toBe(true);

      // Should have critical alert
      expect(result.actions).toContainEqual(
        expect.objectContaining({
          type: 'send_critical_alert',
          priority: 'critical',
        })
      );

      // Should have transformation deadline
      expect(result.actions).toContainEqual(
        expect.objectContaining({
          type: 'create_transformation_deadline',
          priority: 'critical',
        })
      );

      // Should update trademark status
      expect(result.actions).toContainEqual(
        expect.objectContaining({
          type: 'update_trademark_status',
          priority: 'critical',
        })
      );
    });

    it('should emit CentralAttackNotified domain event', () => {
      const event = createMockMadridEvent('central_attack_notified', {
        payload: {
          attackType: 'invalidation',
          officeOfOrigin: 'EM',
          transformationDeadline: new Date().toISOString(),
          countriesForTransformation: ['US', 'CN'],
          classesAffected: [9],
          fullCancellation: false,
        },
      });

      const result = mapper.mapEvent(event);

      expect(result.domainEvents).toContainEqual(
        expect.objectContaining({
          type: 'Trademark.CentralAttackNotified',
          payload: expect.objectContaining({
            severity: 'critical',
          }),
        })
      );
    });
  });

  describe('mapRenewalDue', () => {
    it('should map to create_renewal_deadline action', () => {
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 3);

      const event = createMockMadridEvent('renewal_due', {
        payload: {
          expirationDate: expirationDate.toISOString(),
          daysUntilExpiration: 90,
          estimatedFee: 2000,
          designationCount: 5,
          inGracePeriod: false,
        },
      });

      const result = mapper.mapEvent(event);

      expect(result.actions).toContainEqual(
        expect.objectContaining({
          type: 'create_renewal_deadline',
          priority: 'medium',
        })
      );
    });

    it('should set high priority when less than 30 days', () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 20);

      const event = createMockMadridEvent('renewal_due', {
        payload: {
          expirationDate: expirationDate.toISOString(),
          daysUntilExpiration: 20,
          estimatedFee: 2000,
          designationCount: 5,
          inGracePeriod: false,
        },
      });

      const result = mapper.mapEvent(event);

      expect(result.actions[0]?.priority).toBe('high');
    });
  });

  describe('mapRenewalOverdue', () => {
    it('should map to critical alert and grace period deadline', () => {
      const graceDeadline = new Date();
      graceDeadline.setMonth(graceDeadline.getMonth() + 5);

      const event = createMockMadridEvent('renewal_overdue', {
        payload: {
          expirationDate: new Date().toISOString(),
          daysUntilExpiration: -30,
          graceDeadline: graceDeadline.toISOString(),
          estimatedFee: 2000,
          designationCount: 5,
          inGracePeriod: true,
        },
        severity: 'critical',
      });

      const result = mapper.mapEvent(event);

      expect(result.actions).toContainEqual(
        expect.objectContaining({
          type: 'send_critical_alert',
          priority: 'critical',
        })
      );

      expect(result.actions).toContainEqual(
        expect.objectContaining({
          type: 'create_renewal_deadline',
          priority: 'critical',
          payload: expect.objectContaining({
            isGracePeriod: true,
          }),
        })
      );
    });
  });

  describe('mapAndPublish', () => {
    it('should publish domain events', async () => {
      const event = createMockMadridEvent('designation_accepted', {
        payload: { countryCode: 'AU' },
      });

      await mapper.mapAndPublish(event);

      expect(mockPublisher.publish).toHaveBeenCalled();
    });

    it('should not publish if mapping fails', async () => {
      // Create an event that will fail mapping
      const badEvent = { type: 'invalid_type' } as unknown as MadridEvent;

      const result = await mapper.mapAndPublish(badEvent);

      expect(result.success).toBe(false);
      expect(mockPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return error result for invalid event type', () => {
      const badEvent = { type: 'unknown_event' } as unknown as MadridEvent;

      const result = mapper.mapEvent(badEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
