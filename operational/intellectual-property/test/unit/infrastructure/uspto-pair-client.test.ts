/**
 * USPTO PAIR Client Unit Tests
 *
 * Tests for the USPTO Patent Application Information Retrieval client.
 * Uses mock HTTP responses to test client logic independently.
 *
 * @module test/unit/infrastructure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  USPTOPairClient,
  type PairClientConfig,
  type PatentApplicationStatus,
  type MaintenanceFeeWindow,
  USPTOPairEventMapper,
  type StatusChangeDetected,
  type OfficeActionDetected,
  type GrantDetected,
  type AbandonmentDetected,
  type MaintenanceFeeWindowOpened,
  type OfficeAction,
} from '../../../src/infrastructure/external/uspto/index.js';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock response
function createMockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

// ============================================================================
// USPTOPairClient Tests
// ============================================================================

describe('USPTOPairClient', () => {
  let client: USPTOPairClient;
  const testConfig: Partial<PairClientConfig> = {
    baseUrl: 'https://test.uspto.gov/api',
    timeout: 5000,
    maxRetries: 2,
    retryDelayMs: 100,
    rateLimitPerMinute: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new USPTOPairClient(testConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getApplicationStatus', () => {
    it('should fetch application status successfully', async () => {
      const mockResponse = {
        applicationNumber: '17/123,456',
        filingDate: '2024-01-15',
        inventionTitle: 'Test Patent Application',
        applicationStatus: 'Pending',
        examinerName: 'John Examiner',
        groupArtUnitNumber: '2100',
        inventors: [{ nameLineOne: 'Jane Inventor' }],
        assigneeEntityName: 'Test Corp',
        entityStatusCode: 'SMALL',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.getApplicationStatus('17/123,456');

      expect(result).not.toBeNull();
      expect(result?.applicationNumber).toBe('17/123,456');
      expect(result?.title).toBe('Test Patent Application');
      expect(result?.status).toBe('pending');
      expect(result?.examinerName).toBe('John Examiner');
      expect(result?.entitySize).toBe('small');
    });

    it('should return null for not found application', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, 404));

      const result = await client.getApplicationStatus('99/999,999');

      expect(result).toBeNull();
    });

    it('should normalize application number formats', async () => {
      const mockResponse = {
        applicationNumber: '17/123,456',
        filingDate: '2024-01-15',
        inventionTitle: 'Test',
        applicationStatus: 'Pending',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      // Test without formatting
      await client.getApplicationStatus('17123456');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('17/123,456'),
        expect.any(Object)
      );
    });

    it('should map granted status correctly', async () => {
      const mockResponse = {
        applicationNumber: '17/123,456',
        filingDate: '2024-01-15',
        inventionTitle: 'Test',
        applicationStatus: 'Patented Case',
        patentNumber: '12,345,678',
        grantDate: '2024-06-15',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.getApplicationStatus('17/123,456');

      expect(result?.status).toBe('granted');
      expect(result?.patentNumber).toBe('12,345,678');
    });

    it('should map abandoned status correctly', async () => {
      const mockResponse = {
        applicationNumber: '17/123,456',
        filingDate: '2024-01-15',
        inventionTitle: 'Test',
        applicationStatus: 'Abandoned -- Failure to Respond',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.getApplicationStatus('17/123,456');

      expect(result?.status).toBe('abandoned');
    });
  });

  describe('getProsecutionHistory', () => {
    it('should fetch prosecution history with events', async () => {
      const mockResponse = {
        applicationNumber: '17/123,456',
        filingDate: '2024-01-15',
        inventionTitle: 'Test Patent',
        applicationStatus: 'Pending',
        events: [
          {
            eventCode: 'FWDX',
            eventDate: '2024-01-15',
            eventDescription: 'Application Filed',
          },
          {
            eventCode: 'CTNF',
            eventDate: '2024-04-15',
            eventDescription: 'Non-Final Rejection',
          },
        ],
        officeActions: [
          {
            actionType: 'Non-Final Rejection',
            mailedDate: '2024-04-15',
            responseDeadline: '2024-07-15',
            examinerName: 'John Examiner',
            summary: 'Claims 1-5 rejected under 103',
            rejectedClaims: [1, 2, 3, 4, 5],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.getProsecutionHistory('17/123,456');

      expect(result).not.toBeNull();
      expect(result?.events).toHaveLength(2);
      expect(result?.officeActions).toHaveLength(1);
      expect(result?.officeActions[0]?.actionType).toBe('non_final');
      expect(result?.officeActions[0]?.rejectedClaims).toEqual([1, 2, 3, 4, 5]);
    });

    it('should identify pending office action requiring response', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 2);

      const mockResponse = {
        applicationNumber: '17/123,456',
        filingDate: '2024-01-15',
        inventionTitle: 'Test Patent',
        applicationStatus: 'Pending',
        events: [],
        officeActions: [
          {
            actionType: 'Non-Final Rejection',
            mailedDate: new Date().toISOString().split('T')[0],
            responseDeadline: futureDate.toISOString().split('T')[0],
            examinerName: 'John Examiner',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.getProsecutionHistory('17/123,456');

      expect(result?.pendingOfficeAction).toBeDefined();
      expect(result?.pendingOfficeAction?.actionType).toBe('non_final');
    });
  });

  describe('getOfficeActions', () => {
    it('should fetch and map office actions', async () => {
      const mockResponse = {
        officeActions: [
          {
            documentId: 'oa-123',
            actionType: 'Final Rejection',
            mailedDate: '2024-05-15',
            responseDeadline: '2024-08-15',
            examinerName: 'Jane Examiner',
            groupArtUnit: '2100',
            summary: 'Final rejection of claims 1-3',
            rejectedClaims: [1, 2, 3],
            allowedClaims: [4, 5],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.getOfficeActions('17/123,456');

      expect(result).toHaveLength(1);
      expect(result[0]?.actionType).toBe('final');
      expect(result[0]?.rejectedClaims).toEqual([1, 2, 3]);
      expect(result[0]?.allowedClaims).toEqual([4, 5]);
    });

    it('should map restriction requirements', async () => {
      const mockResponse = {
        officeActions: [
          {
            actionType: 'Restriction Requirement',
            mailedDate: '2024-03-15',
            responseDeadline: '2024-04-15',
            examinerName: 'Test Examiner',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.getOfficeActions('17/123,456');

      expect(result[0]?.actionType).toBe('requirement');
    });

    it('should map notice of allowance', async () => {
      const mockResponse = {
        officeActions: [
          {
            actionType: 'Notice of Allowance',
            mailedDate: '2024-06-15',
            examinerName: 'Test Examiner',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.getOfficeActions('17/123,456');

      expect(result[0]?.actionType).toBe('allowance');
      expect(result[0]?.responseStatus).toBe('not_required');
    });
  });

  describe('getPatentGrant', () => {
    it('should fetch patent grant details', async () => {
      const mockResponse = {
        patentNumber: '12,345,678',
        applicationNumber: '17/123,456',
        inventionTitle: 'Test Invention',
        abstractText: 'A test invention for testing purposes.',
        grantDate: '2024-06-15',
        filingDate: '2024-01-15',
        expirationDate: '2044-01-15',
        entityStatusCode: 'MICRO',
        inventors: [
          { nameLineOne: 'Jane Inventor', city: 'San Francisco', state: 'CA', country: 'US' },
        ],
        assignee: {
          name: 'Test Corp',
          city: 'San Francisco',
          state: 'CA',
          country: 'US',
        },
        claims: [
          { claimNumber: 1, claimText: 'A method comprising...', isIndependent: true },
          { claimNumber: 2, claimText: 'The method of claim 1...', dependsOn: [1] },
        ],
        classifications: [
          {
            classificationSystem: 'CPC',
            section: 'G',
            mainClass: '06',
            subclass: 'F',
            mainGroup: '3',
            subGroup: '00',
            symbol: 'G06F3/00',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.getPatentGrant('12,345,678');

      expect(result).not.toBeNull();
      expect(result?.patentNumber).toBe('12,345,678');
      expect(result?.title).toBe('Test Invention');
      expect(result?.entitySize).toBe('micro');
      expect(result?.inventors).toHaveLength(1);
      expect(result?.claims).toHaveLength(2);
      expect(result?.claims[0]?.isIndependent).toBe(true);
      expect(result?.claims[1]?.dependsOn).toEqual([1]);
    });

    it('should return null for not found patent', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, 404));

      const result = await client.getPatentGrant('99,999,999');

      expect(result).toBeNull();
    });
  });

  describe('getMaintenanceFeeStatus', () => {
    it('should fetch maintenance fee status', async () => {
      const mockResponse = {
        patentNumber: '12,345,678',
        applicationNumber: '17/123,456',
        grantDate: '2020-01-15',
        entityStatusCode: 'SMALL',
        payments: [
          {
            feeWindow: '3.5',
            paidDate: '2023-07-01',
            amount: 800,
            receiptNumber: 'RCT-123',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.getMaintenanceFeeStatus('12,345,678');

      expect(result).not.toBeNull();
      expect(result?.patentNumber).toBe('12,345,678');
      expect(result?.entitySize).toBe('small');
      expect(result?.fees).toHaveLength(3);

      // First fee should be paid
      const firstFee = result?.fees.find(f => f.feeWindow === '3.5');
      expect(firstFee?.status).toBe('paid');
      expect(firstFee?.paidAmount).toBe(800);
    });

    it('should identify next due fee', async () => {
      // Use a recent grant date so 3.5 year fee is still upcoming
      const recentGrantDate = new Date();
      recentGrantDate.setFullYear(recentGrantDate.getFullYear() - 1); // 1 year ago

      const mockResponse = {
        patentNumber: '12,345,678',
        applicationNumber: '17/123,456',
        grantDate: recentGrantDate.toISOString().split('T')[0], // Grant date sets fee schedule
        entityStatusCode: 'LARGE',
        payments: [],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.getMaintenanceFeeStatus('12,345,678');

      expect(result?.nextDue).toBeDefined();
      expect(result?.nextDue?.feeWindow).toBe('3.5');
    });
  });

  describe('calculateMaintenanceFeeSchedule', () => {
    it('should calculate correct fee schedule from grant date', () => {
      const grantDate = new Date('2022-01-15');
      const fees = client.calculateMaintenanceFeeSchedule(grantDate, 'large');

      expect(fees).toHaveLength(3);

      // Check 3.5 year fee
      const fee35 = fees.find(f => f.feeWindow === '3.5');
      expect(fee35?.dueDate.getFullYear()).toBe(2025);
      expect(fee35?.dueDate.getMonth()).toBe(6); // July (0-indexed)

      // Check 7.5 year fee
      const fee75 = fees.find(f => f.feeWindow === '7.5');
      expect(fee75?.dueDate.getFullYear()).toBe(2029);

      // Check 11.5 year fee
      const fee115 = fees.find(f => f.feeWindow === '11.5');
      expect(fee115?.dueDate.getFullYear()).toBe(2033);
    });

    it('should set correct window open dates (6 months before)', () => {
      const grantDate = new Date('2022-01-15');
      const fees = client.calculateMaintenanceFeeSchedule(grantDate, 'small');

      const fee35 = fees.find(f => f.feeWindow === '3.5');
      expect(fee35?.windowOpensDate.getFullYear()).toBe(2025);
      expect(fee35?.windowOpensDate.getMonth()).toBe(0); // January
    });

    it('should set correct grace period end dates (6 months after)', () => {
      const grantDate = new Date('2022-01-15');
      const fees = client.calculateMaintenanceFeeSchedule(grantDate, 'micro');

      const fee35 = fees.find(f => f.feeWindow === '3.5');
      expect(fee35?.gracePeriodEnds.getFullYear()).toBe(2026);
      expect(fee35?.gracePeriodEnds.getMonth()).toBe(0); // January
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limits', async () => {
      vi.useFakeTimers();

      const mockResponse = {
        applicationNumber: '17/123,456',
        filingDate: '2024-01-15',
        inventionTitle: 'Test',
        applicationStatus: 'Pending',
      };

      // Make many rapid requests
      const requests: Promise<unknown>[] = [];
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));
        requests.push(client.getApplicationStatus(`17/123,${456 + i}`));
      }

      // Fast-forward timers
      await vi.runAllTimersAsync();

      await Promise.all(requests);

      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('retry logic', () => {
    it('should retry on 503 errors', async () => {
      vi.useFakeTimers();

      const mockResponse = {
        applicationNumber: '17/123,456',
        filingDate: '2024-01-15',
        inventionTitle: 'Test',
        applicationStatus: 'Pending',
      };

      // First call returns 503, second succeeds
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, 503))
        .mockResolvedValueOnce(createMockResponse(mockResponse));

      const resultPromise = client.getApplicationStatus('17/123,456');

      // Fast-forward timers to allow retry
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result?.applicationNumber).toBe('17/123,456');
    });

    it('should handle rate limit response with retry-after', async () => {
      vi.useFakeTimers();

      const mockResponse = {
        applicationNumber: '17/123,456',
        filingDate: '2024-01-15',
        inventionTitle: 'Test',
        applicationStatus: 'Pending',
      };

      const rateLimitResponse = {
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '2' }),
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      } as Response;

      mockFetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(createMockResponse(mockResponse));

      const resultPromise = client.getApplicationStatus('17/123,456');

      // Fast-forward timers
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).not.toBeNull();
    });
  });

  describe('searchApplications', () => {
    it('should search with filters', async () => {
      const mockResponse = {
        totalCount: 2,
        applications: [
          {
            applicationNumber: '17/123,456',
            filingDate: '2024-01-15',
            inventionTitle: 'Test 1',
            applicationStatus: 'Pending',
          },
          {
            applicationNumber: '17/123,457',
            filingDate: '2024-01-16',
            inventionTitle: 'Test 2',
            applicationStatus: 'Pending',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.searchApplications({
        assigneeName: 'Test Corp',
        status: ['pending'],
        limit: 10,
        offset: 0,
      });

      expect(result.totalCount).toBe(2);
      expect(result.applications).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it('should indicate when more results exist', async () => {
      const mockResponse = {
        totalCount: 100,
        applications: new Array(10).fill({
          applicationNumber: '17/123,456',
          filingDate: '2024-01-15',
          inventionTitle: 'Test',
          applicationStatus: 'Pending',
        }),
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await client.searchApplications({
        limit: 10,
        offset: 0,
      });

      expect(result.hasMore).toBe(true);
      expect(result.nextOffset).toBe(10);
    });
  });
});

// ============================================================================
// USPTOPairEventMapper Tests
// ============================================================================

describe('USPTOPairEventMapper', () => {
  let mapper: USPTOPairEventMapper;

  beforeEach(() => {
    mapper = new USPTOPairEventMapper('test-sync-id');
  });

  describe('mapStatusChange', () => {
    it('should create domain event for status change', () => {
      const change: StatusChangeDetected = {
        applicationNumber: '17/123,456',
        patentId: 'patent-uuid-123',
        previousStatus: 'pending',
        newStatus: 'published',
        changeDate: new Date('2024-06-01'),
        details: 'Application published as US2024/0123456',
      };

      const result = mapper.mapStatusChange(change);

      expect(result.domainEvents).toHaveLength(1);
      expect(result.domainEvents[0]?.type).toBe('USPTO.StatusChanged');
      expect(result.domainEvents[0]?.patentId).toBe('patent-uuid-123');
      expect(result.domainEvents[0]?.payload).toMatchObject({
        previousStatus: 'pending',
        newStatus: 'published',
      });
    });

    it('should create notification for significant status changes', () => {
      const change: StatusChangeDetected = {
        applicationNumber: '17/123,456',
        patentId: 'patent-uuid-123',
        previousStatus: 'pending',
        newStatus: 'granted',
        changeDate: new Date(),
        details: 'Patent granted',
      };

      const result = mapper.mapStatusChange(change);

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.priority).toBe('high');
    });
  });

  describe('mapOfficeActionReceived', () => {
    it('should create event and deadline for non-final rejection', () => {
      const detection: OfficeActionDetected = {
        applicationNumber: '17/123,456',
        patentId: 'patent-uuid-123',
        officeAction: {
          id: 'oa-123',
          applicationNumber: '17/123,456',
          actionType: 'non_final',
          mailedDate: new Date('2024-05-01'),
          responseDeadline: new Date('2024-08-01'),
          responseStatus: 'pending',
          examinerName: 'John Examiner',
          groupArtUnit: '2100',
          summary: 'Claims 1-5 rejected under 103',
          rejectedClaims: [1, 2, 3, 4, 5],
        },
      };

      const result = mapper.mapOfficeActionReceived(detection);

      expect(result.domainEvents).toHaveLength(1);
      expect(result.domainEvents[0]?.type).toBe('USPTO.OfficeActionReceived');

      expect(result.deadlinesToCreate).toHaveLength(1);
      expect(result.deadlinesToCreate[0]?.deadlineType).toContain('office_action_response');
      expect(result.deadlinesToCreate[0]?.priority).toBe('high');

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.priority).toBe('high');
    });

    it('should create critical priority for final rejection', () => {
      const detection: OfficeActionDetected = {
        applicationNumber: '17/123,456',
        patentId: 'patent-uuid-123',
        officeAction: {
          id: 'oa-456',
          applicationNumber: '17/123,456',
          actionType: 'final',
          mailedDate: new Date('2024-05-01'),
          responseDeadline: new Date('2024-08-01'),
          responseStatus: 'pending',
          examinerName: 'John Examiner',
          groupArtUnit: '2100',
          summary: 'Final rejection',
        },
      };

      const result = mapper.mapOfficeActionReceived(detection);

      expect(result.deadlinesToCreate[0]?.priority).toBe('critical');
      expect(result.notifications[0]?.priority).toBe('critical');
    });

    it('should not create deadline for notice of allowance', () => {
      const detection: OfficeActionDetected = {
        applicationNumber: '17/123,456',
        patentId: 'patent-uuid-123',
        officeAction: {
          id: 'oa-789',
          applicationNumber: '17/123,456',
          actionType: 'allowance',
          mailedDate: new Date('2024-05-01'),
          responseDeadline: new Date('2024-08-01'),
          responseStatus: 'not_required',
          examinerName: 'John Examiner',
          groupArtUnit: '2100',
          summary: 'Notice of Allowance',
        },
      };

      const result = mapper.mapOfficeActionReceived(detection);

      // Should have event but no deadline
      expect(result.domainEvents).toHaveLength(1);
      expect(result.deadlinesToCreate).toHaveLength(0);
    });
  });

  describe('mapPatentGranted', () => {
    it('should create event and maintenance fee schedule', () => {
      const detection: GrantDetected = {
        applicationNumber: '17/123,456',
        patentId: 'patent-uuid-123',
        grant: {
          patentNumber: '12,345,678',
          applicationNumber: '17/123,456',
          title: 'Test Invention',
          abstract: 'A test invention',
          grantDate: new Date('2024-06-15'),
          filingDate: new Date('2024-01-15'),
          expirationDate: new Date('2044-01-15'),
          inventors: [{ name: 'Jane Inventor', city: 'SF', country: 'US' }],
          claims: [
            { claimNumber: 1, text: 'A method...', isIndependent: true },
          ],
          classifications: [],
          citations: [],
          entitySize: 'small',
        },
      };

      const result = mapper.mapPatentGranted(detection);

      expect(result.domainEvents).toHaveLength(1);
      expect(result.domainEvents[0]?.type).toBe('USPTO.PatentGranted');

      // Should create 3 maintenance fee deadlines (3.5, 7.5, 11.5 year)
      expect(result.deadlinesToCreate).toHaveLength(3);
      expect(result.deadlinesToCreate[0]?.deadlineType).toContain('patent_maintenance');

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.priority).toBe('high');
    });
  });

  describe('mapPatentAbandoned', () => {
    it('should create event and revival deadline if revivable', () => {
      const detection: AbandonmentDetected = {
        applicationNumber: '17/123,456',
        patentId: 'patent-uuid-123',
        abandonmentDate: new Date('2024-06-01'),
        reason: 'Failure to respond to office action',
        revivable: true,
        revivalDeadline: new Date('2024-08-01'),
      };

      const result = mapper.mapPatentAbandoned(detection);

      expect(result.domainEvents).toHaveLength(1);
      expect(result.domainEvents[0]?.type).toBe('USPTO.PatentAbandoned');

      expect(result.deadlinesToCreate).toHaveLength(1);
      expect(result.deadlinesToCreate[0]?.deadlineType).toBe('patent_revival');
      expect(result.deadlinesToCreate[0]?.priority).toBe('critical');

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.priority).toBe('critical');
    });

    it('should not create revival deadline if not revivable', () => {
      const detection: AbandonmentDetected = {
        applicationNumber: '17/123,456',
        patentId: 'patent-uuid-123',
        abandonmentDate: new Date('2024-06-01'),
        reason: 'Intentional abandonment',
        revivable: false,
      };

      const result = mapper.mapPatentAbandoned(detection);

      expect(result.domainEvents).toHaveLength(1);
      expect(result.deadlinesToCreate).toHaveLength(0);
    });
  });

  describe('mapMaintenanceFeeWindowOpened', () => {
    it('should create event and deadline for maintenance fee', () => {
      const window: MaintenanceFeeWindowOpened = {
        patentNumber: '12,345,678',
        patentId: 'patent-uuid-123',
        feeWindow: '3.5' as MaintenanceFeeWindow,
        windowOpensDate: new Date('2027-06-15'),
        dueDate: new Date('2027-12-15'),
        gracePeriodEnds: new Date('2028-06-15'),
        feeAmount: { micro: 400, small: 800, large: 1600 },
      };

      const result = mapper.mapMaintenanceFeeWindowOpened(window);

      expect(result.domainEvents).toHaveLength(1);
      expect(result.domainEvents[0]?.type).toBe('USPTO.MaintenanceFeeWindowOpened');

      expect(result.deadlinesToCreate).toHaveLength(1);
      expect(result.deadlinesToCreate[0]?.deadlineType).toContain('patent_maintenance');
      expect(result.deadlinesToCreate[0]?.amount).toBe(1600); // Large entity default
      expect(result.deadlinesToCreate[0]?.priority).toBe('high');

      expect(result.notifications).toHaveLength(1);
    });
  });

  describe('mapResponseDeadlineApproaching', () => {
    it('should escalate priority as deadline approaches', () => {
      const officeAction: OfficeAction = {
        id: 'oa-123',
        applicationNumber: '17/123,456',
        actionType: 'non_final',
        mailedDate: new Date('2024-01-01'),
        responseDeadline: new Date('2024-04-01'),
        responseStatus: 'pending',
        examinerName: 'Test',
        groupArtUnit: '2100',
        summary: 'Test',
      };

      // 30 days out - medium priority
      const result30 = mapper.mapResponseDeadlineApproaching(
        'patent-123',
        '17/123,456',
        officeAction,
        30
      );
      expect(result30.notifications[0]?.priority).toBe('medium');

      // 7 days out - critical priority
      const result7 = mapper.mapResponseDeadlineApproaching(
        'patent-123',
        '17/123,456',
        officeAction,
        7
      );
      expect(result7.notifications[0]?.priority).toBe('critical');
    });
  });

  describe('mapResponseOverdue', () => {
    it('should create critical notification for overdue response', () => {
      const officeAction: OfficeAction = {
        id: 'oa-123',
        applicationNumber: '17/123,456',
        actionType: 'final',
        mailedDate: new Date('2024-01-01'),
        responseDeadline: new Date('2024-04-01'),
        responseStatus: 'overdue',
        examinerName: 'Test',
        groupArtUnit: '2100',
        summary: 'Final rejection',
      };

      const result = mapper.mapResponseOverdue(
        'patent-123',
        '17/123,456',
        officeAction,
        5
      );

      expect(result.domainEvents).toHaveLength(1);
      expect(result.domainEvents[0]?.type).toBe('USPTO.ResponseOverdue');

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.priority).toBe('critical');
      expect(result.notifications[0]?.subject).toContain('OVERDUE');
    });
  });
});
