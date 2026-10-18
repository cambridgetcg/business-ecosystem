/**
 * Companies House REST API Client
 *
 * Provides integration with the UK Companies House API for:
 * - Company search and retrieval
 * - Filing history retrieval
 * - Officer information
 * - PSC (Persons with Significant Control) data
 *
 * @see https://developer.company-information.service.gov.uk/
 */

import { z } from 'zod';
import { env } from '../../env.js';

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_RATE_LIMIT_REQUESTS = 600; // Companies House allows 600 requests per 5 minutes
const DEFAULT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

// =============================================================================
// Response Schemas
// =============================================================================

export const CompanyProfileSchema = z.object({
  company_number: z.string(),
  company_name: z.string(),
  company_status: z.string(),
  company_status_detail: z.string().optional(),
  type: z.string(),
  date_of_creation: z.string().optional(),
  date_of_cessation: z.string().optional(),
  jurisdiction: z.string().optional(),
  registered_office_address: z.object({
    address_line_1: z.string().optional(),
    address_line_2: z.string().optional(),
    locality: z.string().optional(),
    region: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  accounts: z.object({
    accounting_reference_date: z.object({
      day: z.string().optional(),
      month: z.string().optional(),
    }).optional(),
    last_accounts: z.object({
      made_up_to: z.string().optional(),
      type: z.string().optional(),
    }).optional(),
    next_accounts: z.object({
      due_on: z.string().optional(),
      overdue: z.boolean().optional(),
    }).optional(),
    next_due: z.string().optional(),
    next_made_up_to: z.string().optional(),
    overdue: z.boolean().optional(),
  }).optional(),
  confirmation_statement: z.object({
    last_made_up_to: z.string().optional(),
    next_due: z.string().optional(),
    next_made_up_to: z.string().optional(),
    overdue: z.boolean().optional(),
  }).optional(),
  sic_codes: z.array(z.string()).optional(),
  has_charges: z.boolean().optional(),
  has_insolvency_history: z.boolean().optional(),
  etag: z.string().optional(),
  links: z.object({
    self: z.string().optional(),
    filing_history: z.string().optional(),
    officers: z.string().optional(),
    charges: z.string().optional(),
    persons_with_significant_control: z.string().optional(),
  }).optional(),
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

export const CompanySearchResultSchema = z.object({
  company_number: z.string(),
  company_name: z.string().optional(),
  title: z.string().optional(),
  company_status: z.string().optional(),
  company_type: z.string().optional(),
  date_of_creation: z.string().optional(),
  date_of_cessation: z.string().optional(),
  address: z.object({
    address_line_1: z.string().optional(),
    address_line_2: z.string().optional(),
    locality: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  address_snippet: z.string().optional(),
  description: z.string().optional(),
  description_identifier: z.array(z.string()).optional(),
  kind: z.string().optional(),
  links: z.object({
    self: z.string().optional(),
  }).optional(),
  snippet: z.string().optional(),
  matches: z.object({
    title: z.array(z.number()).optional(),
    snippet: z.array(z.number()).optional(),
  }).optional(),
});

export type CompanySearchResult = z.infer<typeof CompanySearchResultSchema>;

export const SearchResponseSchema = z.object({
  items: z.array(CompanySearchResultSchema),
  items_per_page: z.number().optional(),
  kind: z.string().optional(),
  page_number: z.number().optional(),
  start_index: z.number().optional(),
  total_results: z.number().optional(),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export const FilingHistoryItemSchema = z.object({
  transaction_id: z.string(),
  barcode: z.string().optional(),
  type: z.string(),
  date: z.string(),
  description: z.string(),
  description_values: z.record(z.string()).optional(),
  action_date: z.string().optional(),
  category: z.string(),
  subcategory: z.string().optional(),
  paper_filed: z.boolean().optional(),
  pages: z.number().optional(),
  links: z.object({
    self: z.string().optional(),
    document_metadata: z.string().optional(),
  }).optional(),
  associated_filings: z.array(z.object({
    type: z.string(),
    date: z.string(),
    description: z.string(),
  })).optional(),
  resolutions: z.array(z.object({
    category: z.string(),
    description: z.string(),
    subcategory: z.string().optional(),
    type: z.string(),
  })).optional(),
});

export type FilingHistoryItem = z.infer<typeof FilingHistoryItemSchema>;

export const FilingHistoryResponseSchema = z.object({
  items: z.array(FilingHistoryItemSchema),
  items_per_page: z.number().optional(),
  filing_history_status: z.string().optional(),
  start_index: z.number().optional(),
  total_count: z.number().optional(),
});

export type FilingHistoryResponse = z.infer<typeof FilingHistoryResponseSchema>;

export const OfficerSchema = z.object({
  name: z.string(),
  officer_role: z.string(),
  appointed_on: z.string().optional(),
  resigned_on: z.string().optional(),
  occupation: z.string().optional(),
  nationality: z.string().optional(),
  country_of_residence: z.string().optional(),
  date_of_birth: z.object({
    month: z.number().optional(),
    year: z.number().optional(),
  }).optional(),
  address: z.object({
    address_line_1: z.string().optional(),
    address_line_2: z.string().optional(),
    locality: z.string().optional(),
    region: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
    premises: z.string().optional(),
  }).optional(),
  links: z.object({
    self: z.string().optional(),
    officer: z.object({
      appointments: z.string().optional(),
    }).optional(),
  }).optional(),
});

export type Officer = z.infer<typeof OfficerSchema>;

export const OfficerListResponseSchema = z.object({
  items: z.array(OfficerSchema),
  items_per_page: z.number().optional(),
  active_count: z.number().optional(),
  resigned_count: z.number().optional(),
  start_index: z.number().optional(),
  total_results: z.number().optional(),
  kind: z.string().optional(),
  links: z.object({
    self: z.string().optional(),
  }).optional(),
});

export type OfficerListResponse = z.infer<typeof OfficerListResponseSchema>;

export const PSCSchema = z.object({
  name: z.string().optional(),
  name_elements: z.object({
    forename: z.string().optional(),
    other_forenames: z.string().optional(),
    surname: z.string().optional(),
    title: z.string().optional(),
  }).optional(),
  natures_of_control: z.array(z.string()).optional(),
  notified_on: z.string().optional(),
  ceased_on: z.string().optional(),
  kind: z.string().optional(),
  nationality: z.string().optional(),
  country_of_residence: z.string().optional(),
  date_of_birth: z.object({
    month: z.number().optional(),
    year: z.number().optional(),
  }).optional(),
  address: z.object({
    address_line_1: z.string().optional(),
    address_line_2: z.string().optional(),
    locality: z.string().optional(),
    region: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
    premises: z.string().optional(),
  }).optional(),
  links: z.object({
    self: z.string().optional(),
    statement: z.string().optional(),
  }).optional(),
});

export type PSC = z.infer<typeof PSCSchema>;

export const PSCListResponseSchema = z.object({
  items: z.array(PSCSchema),
  items_per_page: z.number().optional(),
  active_count: z.number().optional(),
  ceased_count: z.number().optional(),
  start_index: z.number().optional(),
  total_results: z.number().optional(),
  kind: z.string().optional(),
  links: z.object({
    self: z.string().optional(),
    persons_with_significant_control_statements_list: z.string().optional(),
  }).optional(),
});

export type PSCListResponse = z.infer<typeof PSCListResponseSchema>;

// =============================================================================
// Error Types
// =============================================================================

export class CompaniesHouseApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'CompaniesHouseApiError';
  }
}

export class RateLimitError extends CompaniesHouseApiError {
  constructor(
    public readonly retryAfterMs: number
  ) {
    super('Rate limit exceeded', 429);
    this.name = 'RateLimitError';
  }
}

// =============================================================================
// Rate Limiter
// =============================================================================

interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requestTimestamps: number[] = [];

  constructor(private config: RateLimiterConfig) {}

  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Remove timestamps outside the current window
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < this.config.windowMs
    );

    if (this.requestTimestamps.length >= this.config.maxRequests) {
      // Calculate wait time until oldest request expires
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = this.config.windowMs - (now - oldestTimestamp) + 100; // Add 100ms buffer

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.requestTimestamps.push(Date.now());
  }

  reset(): void {
    this.requestTimestamps = [];
  }
}

// =============================================================================
// API Client
// =============================================================================

export interface CompaniesHouseClientConfig {
  apiKey?: string;
  baseUrl?: string;
  rateLimitRequests?: number;
  rateLimitWindowMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export class CompaniesHouseClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly rateLimiter: RateLimiter;
  private readonly retryAttempts: number;
  private readonly retryDelayMs: number;

  constructor(config: CompaniesHouseClientConfig = {}) {
    this.apiKey = config.apiKey ?? env.COMPANIES_HOUSE_API_KEY;
    this.baseUrl = config.baseUrl ?? env.COMPANIES_HOUSE_API_URL;
    this.retryAttempts = config.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
    this.retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

    this.rateLimiter = new RateLimiter({
      maxRequests: config.rateLimitRequests ?? DEFAULT_RATE_LIMIT_REQUESTS,
      windowMs: config.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
    });

    if (!this.apiKey) {
      console.warn('[CompaniesHouse] No API key configured - requests will fail');
    }
  }

  // ===========================================================================
  // Core Request Method
  // ===========================================================================

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    await this.rateLimiter.waitForSlot();

    const url = `${this.baseUrl}${endpoint}`;
    const authHeader = Buffer.from(`${this.apiKey}:`).toString('base64');

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            Authorization: `Basic ${authHeader}`,
            Accept: 'application/json',
            ...options.headers,
          },
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : this.retryDelayMs * (attempt + 1);

          if (attempt < this.retryAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          }

          throw new RateLimitError(waitMs);
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new CompaniesHouseApiError(
            `Companies House API error: ${response.statusText}`,
            response.status,
            errorBody ? JSON.parse(errorBody) : undefined
          );
        }

        const data = await response.json();

        if (schema) {
          return schema.parse(data);
        }

        return data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof CompaniesHouseApiError && error.statusCode < 500) {
          throw error;
        }

        if (attempt < this.retryAttempts - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelayMs * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  // ===========================================================================
  // Company Search
  // ===========================================================================

  /**
   * Search for companies by name or company number
   */
  async searchCompanies(
    query: string,
    options: {
      itemsPerPage?: number;
      startIndex?: number;
    } = {}
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({
      q: query,
      ...(options.itemsPerPage && { items_per_page: options.itemsPerPage.toString() }),
      ...(options.startIndex && { start_index: options.startIndex.toString() }),
    });

    return this.request(`/search/companies?${params}`, {}, SearchResponseSchema);
  }

  /**
   * Search for companies by advanced criteria
   */
  async advancedCompanySearch(
    options: {
      companyNameIncludes?: string;
      companyNameExcludes?: string;
      location?: string;
      incorporatedFrom?: string; // YYYY-MM-DD
      incorporatedTo?: string;
      sicCodes?: string[];
      companyStatus?: string[];
      companyType?: string[];
      itemsPerPage?: number;
      startIndex?: number;
    }
  ): Promise<SearchResponse> {
    const params = new URLSearchParams();

    if (options.companyNameIncludes) params.set('company_name_includes', options.companyNameIncludes);
    if (options.companyNameExcludes) params.set('company_name_excludes', options.companyNameExcludes);
    if (options.location) params.set('location', options.location);
    if (options.incorporatedFrom) params.set('incorporated_from', options.incorporatedFrom);
    if (options.incorporatedTo) params.set('incorporated_to', options.incorporatedTo);
    if (options.sicCodes) params.set('sic_codes', options.sicCodes.join(','));
    if (options.companyStatus) params.set('company_status', options.companyStatus.join(','));
    if (options.companyType) params.set('company_type', options.companyType.join(','));
    if (options.itemsPerPage) params.set('items_per_page', options.itemsPerPage.toString());
    if (options.startIndex) params.set('start_index', options.startIndex.toString());

    return this.request(`/advanced-search/companies?${params}`, {}, SearchResponseSchema);
  }

  // ===========================================================================
  // Company Profile
  // ===========================================================================

  /**
   * Get company profile by company number
   */
  async getCompanyProfile(companyNumber: string): Promise<CompanyProfile> {
    return this.request(`/company/${companyNumber}`, {}, CompanyProfileSchema);
  }

  /**
   * Get registered office address
   */
  async getRegisteredOffice(companyNumber: string): Promise<CompanyProfile['registered_office_address']> {
    const profile = await this.getCompanyProfile(companyNumber);
    return profile.registered_office_address;
  }

  // ===========================================================================
  // Filing History
  // ===========================================================================

  /**
   * Get filing history for a company
   */
  async getFilingHistory(
    companyNumber: string,
    options: {
      itemsPerPage?: number;
      startIndex?: number;
      category?: string;
    } = {}
  ): Promise<FilingHistoryResponse> {
    const params = new URLSearchParams();

    if (options.itemsPerPage) params.set('items_per_page', options.itemsPerPage.toString());
    if (options.startIndex) params.set('start_index', options.startIndex.toString());
    if (options.category) params.set('category', options.category);

    const queryString = params.toString();
    const endpoint = `/company/${companyNumber}/filing-history${queryString ? `?${queryString}` : ''}`;

    return this.request(endpoint, {}, FilingHistoryResponseSchema);
  }

  /**
   * Get a specific filing by transaction ID
   */
  async getFiling(companyNumber: string, transactionId: string): Promise<FilingHistoryItem> {
    return this.request(
      `/company/${companyNumber}/filing-history/${transactionId}`,
      {},
      FilingHistoryItemSchema
    );
  }

  // ===========================================================================
  // Officers
  // ===========================================================================

  /**
   * Get list of company officers
   */
  async getOfficers(
    companyNumber: string,
    options: {
      itemsPerPage?: number;
      startIndex?: number;
      registerType?: 'directors' | 'secretaries' | 'llp-members';
      orderBy?: 'appointed_on' | 'resigned_on' | 'surname';
    } = {}
  ): Promise<OfficerListResponse> {
    const params = new URLSearchParams();

    if (options.itemsPerPage) params.set('items_per_page', options.itemsPerPage.toString());
    if (options.startIndex) params.set('start_index', options.startIndex.toString());
    if (options.registerType) params.set('register_type', options.registerType);
    if (options.orderBy) params.set('order_by', options.orderBy);

    const queryString = params.toString();
    const endpoint = `/company/${companyNumber}/officers${queryString ? `?${queryString}` : ''}`;

    return this.request(endpoint, {}, OfficerListResponseSchema);
  }

  /**
   * Get active officers only
   */
  async getActiveOfficers(companyNumber: string): Promise<Officer[]> {
    const response = await this.getOfficers(companyNumber);
    return response.items.filter((officer) => !officer.resigned_on);
  }

  // ===========================================================================
  // Persons with Significant Control (PSC)
  // ===========================================================================

  /**
   * Get PSC list for a company
   */
  async getPSCs(
    companyNumber: string,
    options: {
      itemsPerPage?: number;
      startIndex?: number;
      registerView?: boolean;
    } = {}
  ): Promise<PSCListResponse> {
    const params = new URLSearchParams();

    if (options.itemsPerPage) params.set('items_per_page', options.itemsPerPage.toString());
    if (options.startIndex) params.set('start_index', options.startIndex.toString());
    if (options.registerView !== undefined) params.set('register_view', options.registerView.toString());

    const queryString = params.toString();
    const endpoint = `/company/${companyNumber}/persons-with-significant-control${queryString ? `?${queryString}` : ''}`;

    return this.request(endpoint, {}, PSCListResponseSchema);
  }

  /**
   * Get active PSCs only
   */
  async getActivePSCs(companyNumber: string): Promise<PSC[]> {
    const response = await this.getPSCs(companyNumber);
    return response.items.filter((psc) => !psc.ceased_on);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Check if a company number is valid format
   */
  static isValidCompanyNumber(companyNumber: string): boolean {
    // UK company numbers are typically 8 characters
    // Can be numeric or start with letters (SC, NI, OC, etc.)
    const pattern = /^([A-Z]{2})?[0-9]{6,8}$/;
    return pattern.test(companyNumber.toUpperCase());
  }

  /**
   * Format company number with leading zeros if needed
   */
  static formatCompanyNumber(companyNumber: string): string {
    const upper = companyNumber.toUpperCase().trim();

    // If starts with letters, extract prefix and pad number
    const match = upper.match(/^([A-Z]{2})(\d+)$/);
    if (match) {
      return match[1] + match[2].padStart(6, '0');
    }

    // Pure numeric - pad to 8 digits
    return upper.padStart(8, '0');
  }

  /**
   * Reset rate limiter (useful for testing)
   */
  resetRateLimiter(): void {
    this.rateLimiter.reset();
  }
}

// =============================================================================
// Factory
// =============================================================================

let clientInstance: CompaniesHouseClient | null = null;

/**
 * Get singleton instance of Companies House client
 */
export function getCompaniesHouseClient(config?: CompaniesHouseClientConfig): CompaniesHouseClient {
  if (!clientInstance || config) {
    clientInstance = new CompaniesHouseClient(config);
  }
  return clientInstance;
}

/**
 * Create a new Companies House client instance
 */
export function createCompaniesHouseClient(config?: CompaniesHouseClientConfig): CompaniesHouseClient {
  return new CompaniesHouseClient(config);
}
