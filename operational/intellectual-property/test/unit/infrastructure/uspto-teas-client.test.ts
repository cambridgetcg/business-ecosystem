/**
 * USPTO TEAS Client Unit Tests
 *
 * Tests for the USPTO Trademark Electronic Application System client.
 *
 * @module test/unit/infrastructure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  USPTOTeasClient,
  createUSPTOTeasClient,
} from '../../../src/infrastructure/external/uspto/teas-client.js';
import type {
  USPTOApplicationStatus,
  TrademarkApplicationStatus,
  TrademarkRegistration,
  USPTOSearchResult,
  OfficeAction,
} from '../../../src/infrastructure/external/uspto/teas-types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('USPTOTeasClient', () => {
  let client: USPTOTeasClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = createUSPTOTeasClient({
      baseUrl: 'https://test-api.uspto.gov',
      apiKey: 'test-api-key',
      timeoutMs: 5000,
      maxRetries: 2,
      retryBaseDelayMs: 100,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create client with default configuration', () => {
      const defaultClient = createUSPTOTeasClient();
      expect(defaultClient).toBeInstanceOf(USPTOTeasClient);
    });

    it('should create client with custom configuration', () => {
      const customClient = createUSPTOTeasClient({
        baseUrl: 'https://custom.uspto.gov',
        apiKey: 'custom-key',
        timeoutMs: 10000,
      });
      expect(customClient).toBeInstanceOf(USPTOTeasClient);
    });
  });

  describe('authenticate', () => {
    it('should authenticate with API key without making requests', async () => {
      await client.authenticate();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should authenticate with OAuth2 client credentials', async () => {
      const oauthClient = createUSPTOTeasClient({
        baseUrl: 'https://test-api.uspto.gov',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        headers: new Headers(),
      });

      await oauthClient.authenticate();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.uspto.gov/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should log when no authentication is configured', async () => {
      const noAuthClient = createUSPTOTeasClient({
        baseUrl: 'https://test-api.uspto.gov',
      });
      const consoleSpy = vi.spyOn(console, 'log');

      await noAuthClient.authenticate();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No authentication configured')
      );
    });
  });

  describe('getApplicationBySerialNumber', () => {
    const mockApplicationResponse = {
      serialNumber: '97123456',
      registrationNumber: null,
      markLiteral: 'TESTMARK',
      markType: 'STANDARD_CHARACTER',
      status: 'PUBLISHED_FOR_OPPOSITION',
      statusDate: '2024-01-15',
      filingDate: '2023-06-01',
      owner: {
        name: 'Test Corporation',
        entityType: 'CORPORATION',
        stateCountry: 'US-DE',
        address1: '123 Test St',
        city: 'Wilmington',
        state: 'DE',
        postalCode: '19801',
        country: 'US',
      },
      classifications: [
        {
          classNumber: 9,
          classHeading: 'Computer software',
          goodsServicesDescription: 'Downloadable computer software',
          filingBasis: '1a',
          status: 'ACTIVE',
        },
      ],
      prosecutionHistory: [],
    };

    it('should fetch application by serial number', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApplicationResponse,
        headers: new Headers({
          'X-RateLimit-Remaining': '99',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
        }),
      });

      const result = await client.getApplicationBySerialNumber('97/123,456');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.serialNumber).toBe('97123456');
      expect(result.data!.markLiteral).toBe('TESTMARK');
      expect(result.data!.status).toBe('PUBLISHED_FOR_OPPOSITION');
    });

    it('should normalize serial number format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApplicationResponse,
        headers: new Headers(),
      });

      await client.getApplicationBySerialNumber('97/123,456');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/97123456/'),
        expect.any(Object)
      );
    });

    it('should handle not found response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      });

      const result = await client.getApplicationBySerialNumber('99999999');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Trademark application not found');
      expect(result.errorCode).toBe('NOT_FOUND');
    });

    it('should include rate limit info in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApplicationResponse,
        headers: new Headers({
          'X-RateLimit-Remaining': '50',
          'X-RateLimit-Reset': '1705000000',
        }),
      });

      const result = await client.getApplicationBySerialNumber('97123456');

      expect(result.rateLimitRemaining).toBeDefined();
      expect(result.rateLimitReset).toBeDefined();
    });

    it('should parse classifications correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockApplicationResponse,
          classifications: [
            {
              classNumber: 9,
              classHeading: 'Computer software',
              goodsServicesDescription: 'Downloadable software',
              filingBasis: '1a',
              status: 'ACTIVE',
              firstUseDate: '2022-01-01',
              firstUseInCommerceDate: '2022-03-15',
            },
            {
              classNumber: 42,
              classHeading: 'Scientific services',
              goodsServicesDescription: 'SaaS services',
              filingBasis: '1b',
              status: 'ACTIVE',
            },
          ],
        }),
        headers: new Headers(),
      });

      const result = await client.getApplicationBySerialNumber('97123456');

      expect(result.data!.classifications).toHaveLength(2);
      expect(result.data!.classifications[0].classNumber).toBe(9);
      expect(result.data!.classifications[0].firstUseDate).toBeInstanceOf(Date);
      expect(result.data!.classifications[1].classNumber).toBe(42);
    });

    it('should parse publication details when published', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockApplicationResponse,
          publication: {
            publicationDate: '2024-01-15',
            gazetteIssue: '2024-02',
            gazettePage: 123,
            oppositionPeriodStart: '2024-01-15',
            oppositionPeriodEnd: '2024-02-14',
            oppositionExtended: false,
          },
        }),
        headers: new Headers(),
      });

      const result = await client.getApplicationBySerialNumber('97123456');

      expect(result.data!.publication).toBeDefined();
      expect(result.data!.publication!.publicationDate).toBeInstanceOf(Date);
      expect(result.data!.publication!.gazetteIssue).toBe('2024-02');
      expect(result.data!.publication!.oppositionPeriodEnd).toBeInstanceOf(Date);
    });
  });

  describe('getRegistrationByNumber', () => {
    const mockRegistrationResponse = {
      registrationNumber: '7123456',
      serialNumber: '97123456',
      markLiteral: 'TESTMARK',
      markType: 'STANDARD_CHARACTER',
      registrationDate: '2024-06-15',
      renewalDate: '2034-06-15',
      expirationDate: '2034-06-15',
      owner: {
        name: 'Test Corporation',
        entityType: 'CORPORATION',
        country: 'US',
      },
      classifications: [],
      maintenanceFilings: [],
      incontestable: false,
    };

    it('should fetch registration by registration number', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistrationResponse,
        headers: new Headers(),
      });

      const result = await client.getRegistrationByNumber('7,123,456');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.registrationNumber).toBe('7123456');
      expect(result.data!.registrationDate).toBeInstanceOf(Date);
      expect(result.data!.expirationDate).toBeInstanceOf(Date);
    });

    it('should normalize registration number format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistrationResponse,
        headers: new Headers(),
      });

      await client.getRegistrationByNumber('7,123,456');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/7123456'),
        expect.any(Object)
      );
    });

    it('should parse incontestability status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockRegistrationResponse,
          incontestable: true,
          section15FilingDate: '2030-06-15',
        }),
        headers: new Headers(),
      });

      const result = await client.getRegistrationByNumber('7123456');

      expect(result.data!.incontestable).toBe(true);
      expect(result.data!.section15FilingDate).toBeInstanceOf(Date);
    });

    it('should parse maintenance filing requirements', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockRegistrationResponse,
          maintenanceFilings: [
            {
              filingType: 'SECTION_8',
              dueDate: '2030-06-15',
              gracePeriodEnd: '2031-06-15',
              filed: false,
              status: 'NOT_DUE',
            },
            {
              filingType: 'SECTION_9',
              dueDate: '2034-06-15',
              gracePeriodEnd: '2035-06-15',
              filed: false,
              status: 'NOT_DUE',
            },
          ],
        }),
        headers: new Headers(),
      });

      const result = await client.getRegistrationByNumber('7123456');

      expect(result.data!.maintenanceFilings).toHaveLength(2);
      expect(result.data!.maintenanceFilings[0].filingType).toBe('SECTION_8');
      expect(result.data!.maintenanceFilings[0].dueDate).toBeInstanceOf(Date);
    });
  });

  describe('searchTrademarks', () => {
    const mockSearchResponse = {
      results: [
        {
          serialNumber: '97123456',
          registrationNumber: null,
          markLiteral: 'TESTMARK',
          markType: 'STANDARD_CHARACTER',
          status: 'PUBLISHED_FOR_OPPOSITION',
          ownerName: 'Test Corporation',
          filingDate: '2023-06-01',
          primaryClass: 9,
          classes: [9, 42],
          relevanceScore: 0.95,
        },
        {
          serialNumber: '97123457',
          registrationNumber: '7123457',
          markLiteral: 'TESTMARK PRO',
          markType: 'STANDARD_CHARACTER',
          status: 'REGISTERED',
          ownerName: 'Test Corporation',
          filingDate: '2022-01-15',
          registrationDate: '2023-01-15',
          primaryClass: 9,
          classes: [9],
          relevanceScore: 0.85,
        },
      ],
      total: 2,
      offset: 0,
      limit: 50,
    };

    it('should search trademarks by text query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
        headers: new Headers(),
      });

      const result = await client.searchTrademarks({
        textQuery: 'TESTMARK',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].markLiteral).toBe('TESTMARK');
      expect(result.data![0].relevanceScore).toBe(0.95);
    });

    it('should search by owner name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
        headers: new Headers(),
      });

      await client.searchTrademarks({
        ownerName: 'Test Corporation',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('owner=Test+Corporation'),
        expect.any(Object)
      );
    });

    it('should filter by Nice classes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
        headers: new Headers(),
      });

      await client.searchTrademarks({
        classes: [9, 42],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('classes=9%2C42'),
        expect.any(Object)
      );
    });

    it('should filter by status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
        headers: new Headers(),
      });

      await client.searchTrademarks({
        status: ['REGISTERED', 'PUBLISHED_FOR_OPPOSITION'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=REGISTERED%2CPUBLISHED_FOR_OPPOSITION'),
        expect.any(Object)
      );
    });

    it('should support pagination', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
        headers: new Headers(),
      });

      await client.searchTrademarks({
        textQuery: 'TESTMARK',
        limit: 20,
        offset: 40,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=40'),
        expect.any(Object)
      );
    });

    it('should filter by filing date range', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
        headers: new Headers(),
      });

      await client.searchTrademarks({
        filingDateFrom: new Date('2023-01-01'),
        filingDateTo: new Date('2023-12-31'),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('filingDateFrom=2023-01-01'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('filingDateTo=2023-12-31'),
        expect.any(Object)
      );
    });
  });

  describe('getProsecutionHistory', () => {
    const mockProsecutionResponse = {
      serialNumber: '97123456',
      actions: [
        {
          actionType: 'FILING_RECEIPT',
          mailedDate: '2023-06-02',
          actionCode: 'FILR',
          description: 'Filing receipt mailed',
          responded: true,
          responseRequired: false,
        },
        {
          actionType: 'NON_FINAL_OFFICE_ACTION',
          mailedDate: '2023-09-15',
          responseDeadline: '2024-03-15',
          actionCode: 'NFOA',
          description: 'Non-final office action mailed',
          responded: true,
          responseDate: '2024-01-10',
          responseRequired: true,
          isFinal: false,
        },
        {
          actionType: 'NOTICE_OF_PUBLICATION',
          mailedDate: '2024-01-10',
          actionCode: 'NOP',
          description: 'Notice of publication',
          responseRequired: false,
        },
      ],
    };

    it('should fetch prosecution history', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProsecutionResponse,
        headers: new Headers(),
      });

      const result = await client.getProsecutionHistory('97123456');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
    });

    it('should parse office action details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProsecutionResponse,
        headers: new Headers(),
      });

      const result = await client.getProsecutionHistory('97123456');
      const officeAction = result.data![1];

      expect(officeAction.actionType).toBe('NON_FINAL_OFFICE_ACTION');
      expect(officeAction.mailedDate).toBeInstanceOf(Date);
      expect(officeAction.responseDeadline).toBeInstanceOf(Date);
      expect(officeAction.responded).toBe(true);
      expect(officeAction.responseDate).toBeInstanceOf(Date);
      expect(officeAction.responseRequired).toBe(true);
      expect(officeAction.isFinal).toBe(false);
    });

    it('should handle empty prosecution history', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ serialNumber: '97123456', actions: [] }),
        headers: new Headers(),
      });

      const result = await client.getProsecutionHistory('97123456');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('retry logic', () => {
    it('should retry on server error (5xx)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ serialNumber: '97123456', status: 'REGISTERED' }),
          headers: new Headers(),
        });

      const resultPromise = client.getApplicationBySerialNumber('97123456');

      // Advance timers to allow retry
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('should retry on rate limit (429) with Retry-After', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '2' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ serialNumber: '97123456', status: 'REGISTERED' }),
          headers: new Headers(),
        });

      const resultPromise = client.getApplicationBySerialNumber('97123456');

      // Advance timers to allow retry
      await vi.advanceTimersByTimeAsync(3000);

      const result = await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('should fail after max retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers(),
      });

      const resultPromise = client.getApplicationBySerialNumber('97123456');

      // Advance timers for all retries
      await vi.advanceTimersByTimeAsync(10000);

      const result = await resultPromise;

      // maxRetries is 2, so 3 total attempts (1 initial + 2 retries)
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(false);
    });

    it('should retry on network timeout', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      mockFetch
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ serialNumber: '97123456', status: 'REGISTERED' }),
          headers: new Headers(),
        });

      const resultPromise = client.getApplicationBySerialNumber('97123456');

      // Advance timers to allow retry
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });
  });

  describe('authentication header handling', () => {
    it('should include API key in request headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ serialNumber: '97123456', status: 'REGISTERED' }),
        headers: new Headers(),
      });

      await client.getApplicationBySerialNumber('97123456');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
          }),
        })
      );
    });

    it('should include request ID for debugging', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ serialNumber: '97123456', status: 'REGISTERED' }),
        headers: new Headers(),
      });

      await client.getApplicationBySerialNumber('97123456');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Request-Id': expect.any(String),
          }),
        })
      );
    });

    it('should include User-Agent header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ serialNumber: '97123456', status: 'REGISTERED' }),
        headers: new Headers(),
      });

      await client.getApplicationBySerialNumber('97123456');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('BusinessEcosystem'),
          }),
        })
      );
    });
  });

  describe('status code parsing', () => {
    it.each([
      ['001', 'NEW_APPLICATION'],
      ['011', 'NON_FINAL_ACTION_MAILED'],
      ['700', 'APPROVED_FOR_PUBLICATION'],
      ['700A', 'PUBLISHED_FOR_OPPOSITION'],
      ['800', 'REGISTERED'],
      ['900', 'CANCELLED'],
      ['606', 'ABANDONED'],
    ])('should parse USPTO status code %s as %s', async (code, expectedStatus) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          serialNumber: '97123456',
          status: code,
          statusDate: '2024-01-15',
          filingDate: '2023-06-01',
        }),
        headers: new Headers(),
      });

      const result = await client.getApplicationBySerialNumber('97123456');

      expect(result.data!.status).toBe(expectedStatus);
    });
  });

  describe('mark type parsing', () => {
    it.each([
      ['1', 'STANDARD_CHARACTER'],
      ['4', 'SPECIAL_FORM'],
      ['5', 'SOUND'],
      ['STANDARD_CHARACTER', 'STANDARD_CHARACTER'],
      ['SPECIAL_FORM', 'SPECIAL_FORM'],
    ])('should parse mark type %s as %s', async (type, expectedType) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          serialNumber: '97123456',
          markType: type,
          status: 'REGISTERED',
          statusDate: '2024-01-15',
          filingDate: '2023-06-01',
        }),
        headers: new Headers(),
      });

      const result = await client.getApplicationBySerialNumber('97123456');

      expect(result.data!.markType).toBe(expectedType);
    });
  });

  describe('getDocumentUrl', () => {
    it('should return document download URL', async () => {
      // Clear any pending mocks and set up fresh mock
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => 'https://documents.uspto.gov/doc123.pdf',
        headers: new Headers(),
      });

      const result = await client.getDocumentUrl('97123456', 'doc123');

      expect(result.success).toBe(true);
      expect(result.data).toBe('https://documents.uspto.gov/doc123.pdf');
    });
  });
});

describe('USPTOTeasClient Rate Limiting', () => {
  let client: USPTOTeasClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createUSPTOTeasClient({
      baseUrl: 'https://test-api.uspto.gov',
      apiKey: 'test-api-key',
    });
  });

  it('should track rate limit remaining from headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ serialNumber: '97123456', status: 'REGISTERED' }),
      headers: new Headers({
        'X-RateLimit-Remaining': '42',
      }),
    });
    global.fetch = mockFetch;

    const result = await client.getApplicationBySerialNumber('97123456');

    expect(result.rateLimitRemaining).toBe(42);
  });

  it('should track rate limit reset time from headers', async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 3600;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ serialNumber: '97123456', status: 'REGISTERED' }),
      headers: new Headers({
        'X-RateLimit-Reset': String(resetTime),
      }),
    });
    global.fetch = mockFetch;

    const result = await client.getApplicationBySerialNumber('97123456');

    expect(result.rateLimitReset).toBeDefined();
    expect(result.rateLimitReset!.getTime()).toBeCloseTo(resetTime * 1000, -3);
  });
});
