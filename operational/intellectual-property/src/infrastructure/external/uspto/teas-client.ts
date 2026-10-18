/**
 * USPTO TEAS Client
 *
 * Client for USPTO Trademark Status & Document Retrieval (TSDR) system.
 * Handles authentication, rate limiting, retries, and response parsing.
 *
 * Note: USPTO requires registration for API access. This implementation
 * follows their TSDR XML/JSON data format specifications.
 *
 * @module infrastructure/external/uspto
 */

import { randomUUID } from 'crypto';
import type {
  TrademarkApplicationStatus,
  TrademarkRegistration,
  USPTOSearchResult,
  USPTOSearchQuery,
  USPTOApiResponse,
  OfficeAction,
  USPTOCorrespondent,
  USPTOAttorney,
  USPTOClassification,
  PublicationDetails,
  MaintenanceFiling,
  USPTOApplicationStatus,
  USPTOMarkType,
  USPTOActionType,
} from './teas-types.js';

/**
 * USPTO TEAS Client configuration.
 */
export interface USPTOTeasClientConfig {
  /** USPTO API base URL */
  baseUrl: string;
  /** API key (if using API key auth) */
  apiKey?: string | undefined;
  /** OAuth2 client ID (if using OAuth2) */
  clientId?: string | undefined;
  /** OAuth2 client secret (if using OAuth2) */
  clientSecret?: string | undefined;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  retryBaseDelayMs: number;
  /** Maximum delay between retries (ms) */
  retryMaxDelayMs: number;
  /** User agent string */
  userAgent: string;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Partial<USPTOTeasClientConfig> = {
  baseUrl: 'https://tsdrapi.uspto.gov',
  timeoutMs: 30000,
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  retryMaxDelayMs: 30000,
  userAgent: 'BusinessEcosystem-IP-Service/1.0',
};

/**
 * Rate limiter state.
 */
interface RateLimiterState {
  remaining: number;
  resetAt: Date;
  lastRequestAt: Date | undefined;
}

/**
 * USPTO TEAS Client
 *
 * Provides methods to interact with USPTO's trademark systems.
 */
export class USPTOTeasClient {
  private readonly config: USPTOTeasClientConfig;
  private accessToken: string | undefined;
  private tokenExpiresAt: Date | undefined;
  private rateLimiter: RateLimiterState;

  constructor(config: Partial<USPTOTeasClientConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as USPTOTeasClientConfig;

    this.rateLimiter = {
      remaining: 100, // Default limit assumption
      resetAt: new Date(Date.now() + 3600000), // 1 hour from now
      lastRequestAt: undefined,
    };
  }

  /**
   * Authenticate with USPTO API.
   * Supports both API key and OAuth2 authentication.
   */
  async authenticate(): Promise<void> {
    if (this.config.apiKey) {
      // API key auth - no additional steps needed
      console.log('[USPTOTeasClient] Using API key authentication');
      return;
    }

    if (this.config.clientId && this.config.clientSecret) {
      await this.authenticateOAuth2();
      return;
    }

    console.log('[USPTOTeasClient] No authentication configured - using public endpoints only');
  }

  /**
   * Authenticate using OAuth2 client credentials flow.
   */
  private async authenticateOAuth2(): Promise<void> {
    const tokenUrl = `${this.config.baseUrl}/oauth/token`;

    const response = await this.makeRequest<{
      access_token: string;
      token_type: string;
      expires_in: number;
    }>(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId!,
        client_secret: this.config.clientSecret!,
      }).toString(),
      skipAuth: true,
    });

    if (response.success && response.data) {
      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);
      console.log('[USPTOTeasClient] OAuth2 authentication successful');
    } else {
      throw new Error(`OAuth2 authentication failed: ${response.error}`);
    }
  }

  /**
   * Search trademark applications by serial number.
   */
  async getApplicationBySerialNumber(
    serialNumber: string
  ): Promise<USPTOApiResponse<TrademarkApplicationStatus>> {
    const normalizedSerial = this.normalizeSerialNumber(serialNumber);
    const url = `${this.config.baseUrl}/v1/trademarks/${normalizedSerial}/status`;

    const response = await this.makeRequest<TSDRStatusResponse>(url);

    if (response.success && response.data) {
      return {
        ...response,
        data: this.parseStatusResponse(response.data),
      };
    }

    return {
      ...response,
      data: undefined,
    };
  }

  /**
   * Get trademark application status and history.
   */
  async getApplicationStatus(
    serialNumber: string
  ): Promise<USPTOApiResponse<TrademarkApplicationStatus>> {
    return this.getApplicationBySerialNumber(serialNumber);
  }

  /**
   * Get trademark registration details by registration number.
   */
  async getRegistrationByNumber(
    registrationNumber: string
  ): Promise<USPTOApiResponse<TrademarkRegistration>> {
    const normalizedRegNum = this.normalizeRegistrationNumber(registrationNumber);
    const url = `${this.config.baseUrl}/v1/registrations/${normalizedRegNum}`;

    const response = await this.makeRequest<TSDRRegistrationResponse>(url);

    if (response.success && response.data) {
      return {
        ...response,
        data: this.parseRegistrationResponse(response.data),
      };
    }

    return {
      ...response,
      data: undefined,
    };
  }

  /**
   * Search trademark database.
   */
  async searchTrademarks(query: USPTOSearchQuery): Promise<USPTOApiResponse<USPTOSearchResult[]>> {
    const url = `${this.config.baseUrl}/v1/trademarks/search`;
    const params = this.buildSearchParams(query);

    const response = await this.makeRequest<TSDRSearchResponse>(`${url}?${params}`);

    if (response.success && response.data) {
      return {
        ...response,
        data: this.parseSearchResults(response.data),
      };
    }

    return {
      ...response,
      data: undefined,
    };
  }

  /**
   * Get prosecution history (office actions) for an application.
   */
  async getProsecutionHistory(
    serialNumber: string
  ): Promise<USPTOApiResponse<OfficeAction[]>> {
    const normalizedSerial = this.normalizeSerialNumber(serialNumber);
    const url = `${this.config.baseUrl}/v1/trademarks/${normalizedSerial}/prosecution`;

    const response = await this.makeRequest<TSDRProsecutionResponse>(url);

    if (response.success && response.data) {
      return {
        ...response,
        data: this.parseProsecutionHistory(response.data),
      };
    }

    return {
      ...response,
      data: undefined,
    };
  }

  /**
   * Get document download URL for a specific document.
   */
  async getDocumentUrl(
    serialNumber: string,
    documentId: string
  ): Promise<USPTOApiResponse<string>> {
    const normalizedSerial = this.normalizeSerialNumber(serialNumber);
    const url = `${this.config.baseUrl}/v1/trademarks/${normalizedSerial}/documents/${documentId}/url`;

    return this.makeRequest<string>(url);
  }

  /**
   * Make an authenticated HTTP request with retry logic.
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit & { skipAuth?: boolean } = {}
  ): Promise<USPTOApiResponse<T>> {
    const requestId = randomUUID();

    // Check rate limit
    await this.checkRateLimit();

    // Ensure authentication is current
    if (!options.skipAuth) {
      await this.ensureAuthenticated();
    }

    const headers: Record<string, string> = {
      'User-Agent': this.config.userAgent,
      Accept: 'application/json',
      'X-Request-Id': requestId,
      ...(options.headers as Record<string, string>),
    };

    // Add authentication
    if (!options.skipAuth) {
      if (this.config.apiKey) {
        headers['X-API-Key'] = this.config.apiKey;
      } else if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Update rate limiter from response headers
        this.updateRateLimiter(response);

        if (response.ok) {
          const data = await response.json() as T;
          return {
            success: true,
            data,
            error: undefined,
            errorCode: undefined,
            requestId,
            timestamp: new Date(),
            rateLimitRemaining: this.rateLimiter.remaining,
            rateLimitReset: this.rateLimiter.resetAt,
          };
        }

        // Handle specific error codes
        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = response.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.calculateBackoff(attempt);
          console.log(`[USPTOTeasClient] Rate limited, waiting ${waitMs}ms before retry`);
          await this.sleep(waitMs);
          continue;
        }

        if (response.status === 401 || response.status === 403) {
          // Authentication error - try to re-authenticate
          if (attempt === 0 && !options.skipAuth) {
            console.log('[USPTOTeasClient] Authentication error, attempting re-authentication');
            this.accessToken = undefined;
            this.tokenExpiresAt = undefined;
            await this.authenticate();
            continue;
          }
        }

        if (response.status === 404) {
          return {
            success: false,
            data: undefined,
            error: 'Trademark application not found',
            errorCode: 'NOT_FOUND',
            requestId,
            timestamp: new Date(),
            rateLimitRemaining: this.rateLimiter.remaining,
            rateLimitReset: this.rateLimiter.resetAt,
          };
        }

        if (response.status >= 500) {
          // Server error - retry with backoff
          const waitMs = this.calculateBackoff(attempt);
          console.log(`[USPTOTeasClient] Server error ${response.status}, retrying in ${waitMs}ms`);
          await this.sleep(waitMs);
          continue;
        }

        // Other client errors
        const errorBody = await response.text();
        return {
          success: false,
          data: undefined,
          error: `HTTP ${response.status}: ${errorBody}`,
          errorCode: `HTTP_${response.status}`,
          requestId,
          timestamp: new Date(),
          rateLimitRemaining: this.rateLimiter.remaining,
          rateLimitReset: this.rateLimiter.resetAt,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`[USPTOTeasClient] Request timeout, attempt ${attempt + 1}/${this.config.maxRetries + 1}`);
        } else {
          console.log(`[USPTOTeasClient] Request error: ${lastError.message}, attempt ${attempt + 1}/${this.config.maxRetries + 1}`);
        }

        if (attempt < this.config.maxRetries) {
          const waitMs = this.calculateBackoff(attempt);
          await this.sleep(waitMs);
        }
      }
    }

    return {
      success: false,
      data: undefined,
      error: lastError?.message ?? 'Request failed after all retries',
      errorCode: 'REQUEST_FAILED',
      requestId,
      timestamp: new Date(),
      rateLimitRemaining: this.rateLimiter.remaining,
      rateLimitReset: this.rateLimiter.resetAt,
    };
  }

  /**
   * Ensure we have a valid authentication token.
   */
  private async ensureAuthenticated(): Promise<void> {
    if (this.config.apiKey) {
      return; // API key doesn't expire
    }

    if (this.accessToken && this.tokenExpiresAt) {
      // Refresh token if it expires in less than 5 minutes
      if (this.tokenExpiresAt.getTime() - Date.now() < 300000) {
        await this.authenticateOAuth2();
      }
    }
  }

  /**
   * Check and enforce rate limiting.
   */
  private async checkRateLimit(): Promise<void> {
    if (this.rateLimiter.remaining <= 0) {
      const waitMs = Math.max(0, this.rateLimiter.resetAt.getTime() - Date.now());
      if (waitMs > 0) {
        console.log(`[USPTOTeasClient] Rate limit reached, waiting ${waitMs}ms`);
        await this.sleep(waitMs);
      }
    }

    // Enforce minimum delay between requests (100ms)
    if (this.rateLimiter.lastRequestAt) {
      const elapsed = Date.now() - this.rateLimiter.lastRequestAt.getTime();
      if (elapsed < 100) {
        await this.sleep(100 - elapsed);
      }
    }

    this.rateLimiter.lastRequestAt = new Date();
  }

  /**
   * Update rate limiter state from response headers.
   */
  private updateRateLimiter(response: Response): void {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    if (remaining) {
      this.rateLimiter.remaining = parseInt(remaining, 10);
    } else {
      this.rateLimiter.remaining = Math.max(0, this.rateLimiter.remaining - 1);
    }

    if (reset) {
      this.rateLimiter.resetAt = new Date(parseInt(reset, 10) * 1000);
    }
  }

  /**
   * Calculate exponential backoff delay.
   */
  private calculateBackoff(attempt: number): number {
    const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(delay + jitter, this.config.retryMaxDelayMs);
  }

  /**
   * Normalize serial number format (remove slashes, dashes, etc.).
   */
  private normalizeSerialNumber(serialNumber: string): string {
    return serialNumber.replace(/[^0-9]/g, '');
  }

  /**
   * Normalize registration number format.
   */
  private normalizeRegistrationNumber(registrationNumber: string): string {
    return registrationNumber.replace(/[^0-9]/g, '');
  }

  /**
   * Build search query parameters.
   */
  private buildSearchParams(query: USPTOSearchQuery): URLSearchParams {
    const params = new URLSearchParams();

    if (query.textQuery) {
      params.append('q', query.textQuery);
    }
    if (query.serialNumber) {
      params.append('serialNumber', this.normalizeSerialNumber(query.serialNumber));
    }
    if (query.registrationNumber) {
      params.append('registrationNumber', this.normalizeRegistrationNumber(query.registrationNumber));
    }
    if (query.ownerName) {
      params.append('owner', query.ownerName);
    }
    if (query.classes && query.classes.length > 0) {
      params.append('classes', query.classes.join(','));
    }
    if (query.status && query.status.length > 0) {
      params.append('status', query.status.join(','));
    }
    if (query.filingDateFrom) {
      params.append('filingDateFrom', query.filingDateFrom.toISOString().split('T')[0]);
    }
    if (query.filingDateTo) {
      params.append('filingDateTo', query.filingDateTo.toISOString().split('T')[0]);
    }
    params.append('limit', String(query.limit ?? 50));
    params.append('offset', String(query.offset ?? 0));

    return params;
  }

  /**
   * Parse USPTO TSDR status response into our domain types.
   */
  private parseStatusResponse(response: TSDRStatusResponse): TrademarkApplicationStatus {
    return {
      serialNumber: response.serialNumber,
      registrationNumber: response.registrationNumber ?? undefined,
      markLiteral: response.markLiteral ?? '',
      markType: this.parseMarkType(response.markType),
      status: this.parseStatus(response.status),
      statusDate: new Date(response.statusDate),
      filingDate: new Date(response.filingDate),
      registrationDate: response.registrationDate ? new Date(response.registrationDate) : undefined,
      owner: this.parseCorrespondent(response.owner),
      attorney: response.attorney ? this.parseAttorney(response.attorney) : undefined,
      classifications: response.classifications?.map(c => this.parseClassification(c)) ?? [],
      prosecutionHistory: response.prosecutionHistory?.map(a => this.parseOfficeAction(a)) ?? [],
      publication: response.publication ? this.parsePublication(response.publication) : undefined,
      maintenanceFilings: response.maintenanceFilings?.map(m => this.parseMaintenanceFiling(m)) ?? [],
      markDescription: response.markDescription ?? undefined,
      designCodes: response.designCodes ?? [],
      disclaimer: response.disclaimer ?? undefined,
      drawingUrl: response.drawingUrl ?? undefined,
      specimenUrl: response.specimenUrl ?? undefined,
      internationalRegistrationNumber: response.internationalRegistrationNumber ?? undefined,
      priorityDate: response.priorityDate ? new Date(response.priorityDate) : undefined,
      lastSyncedAt: new Date(),
    };
  }

  /**
   * Parse USPTO registration response.
   */
  private parseRegistrationResponse(response: TSDRRegistrationResponse): TrademarkRegistration {
    return {
      registrationNumber: response.registrationNumber,
      serialNumber: response.serialNumber,
      markLiteral: response.markLiteral ?? '',
      markType: this.parseMarkType(response.markType),
      registrationDate: new Date(response.registrationDate),
      renewalDate: new Date(response.renewalDate),
      expirationDate: new Date(response.expirationDate),
      owner: this.parseCorrespondent(response.owner),
      classifications: response.classifications?.map(c => this.parseClassification(c)) ?? [],
      maintenanceFilings: response.maintenanceFilings?.map(m => this.parseMaintenanceFiling(m)) ?? [],
      incontestable: response.incontestable ?? false,
      section15FilingDate: response.section15FilingDate ? new Date(response.section15FilingDate) : undefined,
      markDescription: response.markDescription ?? undefined,
      disclaimer: response.disclaimer ?? undefined,
      drawingUrl: response.drawingUrl ?? undefined,
      lastSyncedAt: new Date(),
    };
  }

  /**
   * Parse search results.
   */
  private parseSearchResults(response: TSDRSearchResponse): USPTOSearchResult[] {
    return response.results?.map(r => ({
      serialNumber: r.serialNumber,
      registrationNumber: r.registrationNumber ?? undefined,
      markLiteral: r.markLiteral ?? '',
      markType: this.parseMarkType(r.markType),
      status: this.parseStatus(r.status),
      ownerName: r.ownerName ?? '',
      filingDate: new Date(r.filingDate),
      registrationDate: r.registrationDate ? new Date(r.registrationDate) : undefined,
      primaryClass: r.primaryClass ?? 0,
      classes: r.classes ?? [],
      relevanceScore: r.relevanceScore ?? undefined,
    })) ?? [];
  }

  /**
   * Parse prosecution history response.
   */
  private parseProsecutionHistory(response: TSDRProsecutionResponse): OfficeAction[] {
    return response.actions?.map(a => this.parseOfficeAction(a)) ?? [];
  }

  /**
   * Parse mark type from USPTO response.
   */
  private parseMarkType(type: string | undefined): USPTOMarkType {
    const mapping: Record<string, USPTOMarkType> = {
      '1': 'STANDARD_CHARACTER',
      '4': 'SPECIAL_FORM',
      '5': 'SOUND',
      '6': 'SCENT',
      STANDARD_CHARACTER: 'STANDARD_CHARACTER',
      SPECIAL_FORM: 'SPECIAL_FORM',
      SOUND: 'SOUND',
      SCENT: 'SCENT',
      MOTION: 'MOTION',
      POSITION: 'POSITION',
      TRADE_DRESS: 'TRADE_DRESS',
    };
    return mapping[type ?? ''] ?? 'STANDARD_CHARACTER';
  }

  /**
   * Parse status from USPTO response.
   */
  private parseStatus(status: string | undefined): USPTOApplicationStatus {
    const mapping: Record<string, USPTOApplicationStatus> = {
      '001': 'NEW_APPLICATION',
      '011': 'NON_FINAL_ACTION_MAILED',
      '012': 'NON_FINAL_ACTION_PENDING',
      '013': 'FINAL_REFUSAL_MAILED',
      '014': 'FINAL_REFUSAL_PENDING',
      '700': 'APPROVED_FOR_PUBLICATION',
      '700A': 'PUBLISHED_FOR_OPPOSITION',
      '703': 'OPPOSITION_PENDING',
      '704': 'OPPOSITION_DISMISSED',
      '800': 'REGISTERED',
      '900': 'CANCELLED',
      '901': 'EXPIRED',
      '606': 'ABANDONED',
      NEW_APPLICATION: 'NEW_APPLICATION',
      NON_FINAL_ACTION_MAILED: 'NON_FINAL_ACTION_MAILED',
      NON_FINAL_ACTION_PENDING: 'NON_FINAL_ACTION_PENDING',
      FINAL_REFUSAL_MAILED: 'FINAL_REFUSAL_MAILED',
      FINAL_REFUSAL_PENDING: 'FINAL_REFUSAL_PENDING',
      APPROVED_FOR_PUBLICATION: 'APPROVED_FOR_PUBLICATION',
      PUBLISHED_FOR_OPPOSITION: 'PUBLISHED_FOR_OPPOSITION',
      OPPOSITION_PENDING: 'OPPOSITION_PENDING',
      OPPOSITION_DISMISSED: 'OPPOSITION_DISMISSED',
      REGISTERED: 'REGISTERED',
      CANCELLED: 'CANCELLED',
      EXPIRED: 'EXPIRED',
      ABANDONED: 'ABANDONED',
    };
    return mapping[status ?? ''] ?? 'NEW_APPLICATION';
  }

  /**
   * Parse correspondent from USPTO response.
   */
  private parseCorrespondent(data: TSDRCorrespondent | undefined): USPTOCorrespondent {
    return {
      name: data?.name ?? '',
      entityType: this.parseEntityType(data?.entityType),
      stateCountry: data?.stateCountry ?? '',
      address1: data?.address1 ?? '',
      address2: data?.address2 ?? undefined,
      city: data?.city ?? '',
      state: data?.state ?? undefined,
      postalCode: data?.postalCode ?? undefined,
      country: data?.country ?? 'US',
      email: data?.email ?? undefined,
      phone: data?.phone ?? undefined,
      dbaName: data?.dbaName ?? undefined,
    };
  }

  /**
   * Parse entity type.
   */
  private parseEntityType(type: string | undefined): USPTOCorrespondent['entityType'] {
    const mapping: Record<string, USPTOCorrespondent['entityType']> = {
      INDIVIDUAL: 'INDIVIDUAL',
      CORPORATION: 'CORPORATION',
      LLC: 'LLC',
      PARTNERSHIP: 'PARTNERSHIP',
      TRUST: 'TRUST',
    };
    return mapping[type ?? ''] ?? 'OTHER';
  }

  /**
   * Parse attorney from USPTO response.
   */
  private parseAttorney(data: TSDRAttorney): USPTOAttorney {
    return {
      name: data.name ?? '',
      barMembership: data.barMembership ?? '',
      firmName: data.firmName ?? undefined,
      docketNumber: data.docketNumber ?? undefined,
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
      registrationNumber: data.registrationNumber ?? undefined,
    };
  }

  /**
   * Parse classification from USPTO response.
   */
  private parseClassification(data: TSDRClassification): USPTOClassification {
    return {
      classNumber: data.classNumber ?? 0,
      classHeading: data.classHeading ?? '',
      goodsServicesDescription: data.goodsServicesDescription ?? '',
      filingBasis: data.filingBasis ?? '1a',
      status: this.parseClassStatus(data.status),
      firstUseDate: data.firstUseDate ? new Date(data.firstUseDate) : undefined,
      firstUseInCommerceDate: data.firstUseInCommerceDate ? new Date(data.firstUseInCommerceDate) : undefined,
    };
  }

  /**
   * Parse class status.
   */
  private parseClassStatus(status: string | undefined): USPTOClassification['status'] {
    const mapping: Record<string, USPTOClassification['status']> = {
      ACTIVE: 'ACTIVE',
      DELETED: 'DELETED',
      TRANSFERRED: 'TRANSFERRED',
    };
    return mapping[status ?? ''] ?? 'ACTIVE';
  }

  /**
   * Parse office action from USPTO response.
   */
  private parseOfficeAction(data: TSDRAction): OfficeAction {
    return {
      actionType: this.parseActionType(data.actionType),
      mailedDate: new Date(data.mailedDate),
      responseDeadline: data.responseDeadline ? new Date(data.responseDeadline) : undefined,
      responded: data.responded ?? false,
      responseDate: data.responseDate ? new Date(data.responseDate) : undefined,
      actionCode: data.actionCode ?? '',
      description: data.description ?? '',
      documentUrl: data.documentUrl ?? undefined,
      isFinal: data.isFinal ?? false,
      responseRequired: data.responseRequired ?? false,
    };
  }

  /**
   * Parse action type.
   */
  private parseActionType(type: string | undefined): USPTOActionType {
    const mapping: Record<string, USPTOActionType> = {
      FILING_RECEIPT: 'FILING_RECEIPT',
      EXAMINING_ATTORNEY_ASSIGNED: 'EXAMINING_ATTORNEY_ASSIGNED',
      NON_FINAL_OFFICE_ACTION: 'NON_FINAL_OFFICE_ACTION',
      FINAL_OFFICE_ACTION: 'FINAL_OFFICE_ACTION',
      SUSPENSION_LETTER: 'SUSPENSION_LETTER',
      NOTICE_OF_PUBLICATION: 'NOTICE_OF_PUBLICATION',
      NOTICE_OF_ALLOWANCE: 'NOTICE_OF_ALLOWANCE',
      REGISTRATION_CERTIFICATE: 'REGISTRATION_CERTIFICATE',
      SECTION_8_REMINDER: 'SECTION_8_REMINDER',
      SECTION_15_FILING: 'SECTION_15_FILING',
      RENEWAL_REMINDER: 'RENEWAL_REMINDER',
      CANCELLATION_NOTICE: 'CANCELLATION_NOTICE',
      LETTER_OF_PROTEST: 'LETTER_OF_PROTEST',
      OPPOSITION_FILED: 'OPPOSITION_FILED',
      APPLICANT_RESPONSE: 'APPLICANT_RESPONSE',
      REQUEST_FOR_EXTENSION: 'REQUEST_FOR_EXTENSION',
      PRIORITY_ACTION: 'PRIORITY_ACTION',
    };
    return mapping[type ?? ''] ?? 'OTHER';
  }

  /**
   * Parse publication details from USPTO response.
   */
  private parsePublication(data: TSDRPublication): PublicationDetails {
    const pubDate = new Date(data.publicationDate);
    const oppStart = data.oppositionPeriodStart
      ? new Date(data.oppositionPeriodStart)
      : pubDate;
    const oppEnd = data.oppositionPeriodEnd
      ? new Date(data.oppositionPeriodEnd)
      : new Date(oppStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      publicationDate: pubDate,
      gazetteIssue: data.gazetteIssue ?? '',
      gazettePage: data.gazettePage ?? undefined,
      oppositionPeriodStart: oppStart,
      oppositionPeriodEnd: oppEnd,
      oppositionExtended: data.oppositionExtended ?? false,
      extendedDeadline: data.extendedDeadline ? new Date(data.extendedDeadline) : undefined,
    };
  }

  /**
   * Parse maintenance filing from USPTO response.
   */
  private parseMaintenanceFiling(data: TSDRMaintenanceFiling): MaintenanceFiling {
    return {
      filingType: this.parseFilingType(data.filingType),
      dueDate: new Date(data.dueDate),
      gracePeriodEnd: new Date(data.gracePeriodEnd),
      filed: data.filed ?? false,
      filingDate: data.filingDate ? new Date(data.filingDate) : undefined,
      acceptanceDate: data.acceptanceDate ? new Date(data.acceptanceDate) : undefined,
      status: this.parseFilingStatus(data.status),
    };
  }

  /**
   * Parse filing type.
   */
  private parseFilingType(type: string | undefined): MaintenanceFiling['filingType'] {
    const mapping: Record<string, MaintenanceFiling['filingType']> = {
      SECTION_8: 'SECTION_8',
      SECTION_9: 'SECTION_9',
      SECTION_15: 'SECTION_15',
      SECTION_8_15_COMBINED: 'SECTION_8_15_COMBINED',
      SECTION_71: 'SECTION_71',
    };
    return mapping[type ?? ''] ?? 'SECTION_8';
  }

  /**
   * Parse filing status.
   */
  private parseFilingStatus(status: string | undefined): MaintenanceFiling['status'] {
    const mapping: Record<string, MaintenanceFiling['status']> = {
      NOT_DUE: 'NOT_DUE',
      DUE: 'DUE',
      GRACE_PERIOD: 'GRACE_PERIOD',
      FILED: 'FILED',
      ACCEPTED: 'ACCEPTED',
      REJECTED: 'REJECTED',
      MISSED: 'MISSED',
    };
    return mapping[status ?? ''] ?? 'NOT_DUE';
  }

  /**
   * Sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Internal types for USPTO TSDR API responses
interface TSDRCorrespondent {
  name?: string;
  entityType?: string;
  stateCountry?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  phone?: string;
  dbaName?: string;
}

interface TSDRAttorney {
  name?: string;
  barMembership?: string;
  firmName?: string;
  docketNumber?: string;
  email?: string;
  phone?: string;
  registrationNumber?: string;
}

interface TSDRClassification {
  classNumber?: number;
  classHeading?: string;
  goodsServicesDescription?: string;
  filingBasis?: string;
  status?: string;
  firstUseDate?: string;
  firstUseInCommerceDate?: string;
}

interface TSDRAction {
  actionType?: string;
  mailedDate: string;
  responseDeadline?: string;
  responded?: boolean;
  responseDate?: string;
  actionCode?: string;
  description?: string;
  documentUrl?: string;
  isFinal?: boolean;
  responseRequired?: boolean;
}

interface TSDRPublication {
  publicationDate: string;
  gazetteIssue?: string;
  gazettePage?: number;
  oppositionPeriodStart?: string;
  oppositionPeriodEnd?: string;
  oppositionExtended?: boolean;
  extendedDeadline?: string;
}

interface TSDRMaintenanceFiling {
  filingType?: string;
  dueDate: string;
  gracePeriodEnd: string;
  filed?: boolean;
  filingDate?: string;
  acceptanceDate?: string;
  status?: string;
}

interface TSDRStatusResponse {
  serialNumber: string;
  registrationNumber?: string;
  markLiteral?: string;
  markType?: string;
  status: string;
  statusDate: string;
  filingDate: string;
  registrationDate?: string;
  owner?: TSDRCorrespondent;
  attorney?: TSDRAttorney;
  classifications?: TSDRClassification[];
  prosecutionHistory?: TSDRAction[];
  publication?: TSDRPublication;
  maintenanceFilings?: TSDRMaintenanceFiling[];
  markDescription?: string;
  designCodes?: string[];
  disclaimer?: string;
  drawingUrl?: string;
  specimenUrl?: string;
  internationalRegistrationNumber?: string;
  priorityDate?: string;
}

interface TSDRRegistrationResponse {
  registrationNumber: string;
  serialNumber: string;
  markLiteral?: string;
  markType?: string;
  registrationDate: string;
  renewalDate: string;
  expirationDate: string;
  owner?: TSDRCorrespondent;
  classifications?: TSDRClassification[];
  maintenanceFilings?: TSDRMaintenanceFiling[];
  incontestable?: boolean;
  section15FilingDate?: string;
  markDescription?: string;
  disclaimer?: string;
  drawingUrl?: string;
}

interface TSDRSearchResult {
  serialNumber: string;
  registrationNumber?: string;
  markLiteral?: string;
  markType?: string;
  status: string;
  ownerName?: string;
  filingDate: string;
  registrationDate?: string;
  primaryClass?: number;
  classes?: number[];
  relevanceScore?: number;
}

interface TSDRSearchResponse {
  results?: TSDRSearchResult[];
  total?: number;
  offset?: number;
  limit?: number;
}

interface TSDRProsecutionResponse {
  serialNumber: string;
  actions?: TSDRAction[];
}

// Singleton instance factory
export function createUSPTOTeasClient(config?: Partial<USPTOTeasClientConfig>): USPTOTeasClient {
  return new USPTOTeasClient(config);
}
