/**
 * USPTO PAIR Client
 *
 * Client for interacting with USPTO's Patent Center and PAIR APIs.
 * Handles patent application status retrieval, prosecution history,
 * office actions, and maintenance fee status.
 *
 * @module infrastructure/external/uspto
 */

import {
  type PatentApplicationSummary,
  type PatentProsecutionHistory,
  type PatentGrant,
  type MaintenanceFeeStatus,
  type OfficeAction,
  type PairSearchResult,
  type PairSearchFilters,
  type PairApiError,
  type PairClientConfig,
  type ProsecutionEvent,
  type MaintenanceFee,
  type EntitySize,
  type PatentApplicationStatus,
  type MaintenanceFeeWindow,
  DEFAULT_PAIR_CONFIG,
  MAINTENANCE_FEE_SCHEDULE,
  SURCHARGE_AMOUNTS,
} from './pair-types.js';

/**
 * Rate limiter for API calls.
 */
class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(requestsPerMinute: number) {
    this.maxRequests = requestsPerMinute;
    this.windowMs = 60000;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.timestamps[0] as number;
      const waitTime = this.windowMs - (now - oldestTimestamp);
      await this.sleep(waitTime);
      return this.acquire();
    }

    this.timestamps.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * USPTO PAIR API Client
 *
 * Provides methods to query USPTO's Patent Center for:
 * - Patent application status and details
 * - Prosecution history and office actions
 * - Patent grant details
 * - Maintenance fee status
 *
 * Features:
 * - Rate limiting to comply with USPTO API limits
 * - Automatic retry with exponential backoff
 * - Comprehensive error handling
 */
export class USPTOPairClient {
  private readonly config: PairClientConfig;
  private readonly rateLimiter: RateLimiter;

  constructor(config: Partial<PairClientConfig> = {}) {
    this.config = { ...DEFAULT_PAIR_CONFIG, ...config };
    this.rateLimiter = new RateLimiter(this.config.rateLimitPerMinute);
  }

  /**
   * Search patent applications by various criteria.
   */
  async searchApplications(filters: PairSearchFilters): Promise<PairSearchResult> {
    await this.rateLimiter.acquire();

    const queryParams = this.buildSearchParams(filters);
    const response = await this.makeRequest<PairSearchResponse>(
      '/search',
      'POST',
      queryParams
    );

    return {
      totalCount: response.totalCount,
      applications: response.applications.map(app => this.mapToApplicationSummary(app)),
      hasMore: (filters.offset ?? 0) + response.applications.length < response.totalCount,
      nextOffset: (filters.offset ?? 0) + response.applications.length,
    };
  }

  /**
   * Get application status by application number.
   */
  async getApplicationStatus(applicationNumber: string): Promise<PatentApplicationSummary | null> {
    await this.rateLimiter.acquire();

    const normalizedNumber = this.normalizeApplicationNumber(applicationNumber);

    try {
      const response = await this.makeRequest<PairApplicationResponse>(
        `/applications/${normalizedNumber}`,
        'GET'
      );

      return this.mapToApplicationSummary(response);
    } catch (error) {
      if (this.isPairError(error) && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get full prosecution history for an application.
   */
  async getProsecutionHistory(applicationNumber: string): Promise<PatentProsecutionHistory | null> {
    await this.rateLimiter.acquire();

    const normalizedNumber = this.normalizeApplicationNumber(applicationNumber);

    try {
      const response = await this.makeRequest<PairProsecutionResponse>(
        `/applications/${normalizedNumber}/prosecution`,
        'GET'
      );

      return this.mapToProsecutionHistory(response);
    } catch (error) {
      if (this.isPairError(error) && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get office actions for an application.
   */
  async getOfficeActions(applicationNumber: string): Promise<OfficeAction[]> {
    await this.rateLimiter.acquire();

    const normalizedNumber = this.normalizeApplicationNumber(applicationNumber);

    try {
      const response = await this.makeRequest<PairOfficeActionsResponse>(
        `/applications/${normalizedNumber}/office-actions`,
        'GET'
      );

      return response.officeActions.map(oa => this.mapToOfficeAction(oa, applicationNumber));
    } catch (error) {
      if (this.isPairError(error) && error.code === 'NOT_FOUND') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get patent grant details by patent number.
   */
  async getPatentGrant(patentNumber: string): Promise<PatentGrant | null> {
    await this.rateLimiter.acquire();

    const normalizedNumber = this.normalizePatentNumber(patentNumber);

    try {
      const response = await this.makeRequest<PairPatentResponse>(
        `/patents/${normalizedNumber}`,
        'GET'
      );

      return this.mapToPatentGrant(response);
    } catch (error) {
      if (this.isPairError(error) && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get maintenance fee status for a granted patent.
   */
  async getMaintenanceFeeStatus(patentNumber: string): Promise<MaintenanceFeeStatus | null> {
    await this.rateLimiter.acquire();

    const normalizedNumber = this.normalizePatentNumber(patentNumber);

    try {
      const response = await this.makeRequest<PairMaintenanceResponse>(
        `/patents/${normalizedNumber}/maintenance`,
        'GET'
      );

      return this.mapToMaintenanceFeeStatus(response);
    } catch (error) {
      if (this.isPairError(error) && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get pending office action requiring response.
   */
  async getPendingOfficeAction(applicationNumber: string): Promise<OfficeAction | null> {
    const officeActions = await this.getOfficeActions(applicationNumber);

    const pendingAction = officeActions.find(
      oa => oa.responseStatus === 'pending' && oa.responseDeadline > new Date()
    );

    return pendingAction ?? null;
  }

  /**
   * Check if an application has any overdue responses.
   */
  async hasOverdueResponse(applicationNumber: string): Promise<boolean> {
    const officeActions = await this.getOfficeActions(applicationNumber);

    return officeActions.some(
      oa => oa.responseStatus === 'pending' && oa.responseDeadline < new Date()
    );
  }

  /**
   * Get applications with upcoming deadlines within specified days.
   */
  async getApplicationsWithUpcomingDeadlines(
    applicationNumbers: string[],
    withinDays: number
  ): Promise<Array<{ applicationNumber: string; deadline: Date; type: string }>> {
    const results: Array<{ applicationNumber: string; deadline: Date; type: string }> = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + withinDays);

    for (const appNumber of applicationNumbers) {
      const officeActions = await this.getOfficeActions(appNumber);

      for (const oa of officeActions) {
        if (
          oa.responseStatus === 'pending' &&
          oa.responseDeadline <= cutoffDate &&
          oa.responseDeadline > new Date()
        ) {
          results.push({
            applicationNumber: appNumber,
            deadline: oa.responseDeadline,
            type: `office_action_${oa.actionType}`,
          });
        }
      }
    }

    return results.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  }

  /**
   * Calculate maintenance fee schedule for a patent.
   */
  calculateMaintenanceFeeSchedule(
    grantDate: Date,
    entitySize: EntitySize
  ): MaintenanceFee[] {
    const fees: MaintenanceFee[] = [];
    const windows: MaintenanceFeeWindow[] = ['3.5', '7.5', '11.5'];

    for (const window of windows) {
      const years = parseFloat(window);
      const wholeYears = Math.floor(years);
      const fractionalMonths = Math.round((years - wholeYears) * 12);

      const dueDate = new Date(grantDate);
      dueDate.setFullYear(dueDate.getFullYear() + wholeYears);
      dueDate.setMonth(dueDate.getMonth() + fractionalMonths);

      const windowOpensDate = new Date(dueDate);
      windowOpensDate.setMonth(windowOpensDate.getMonth() - 6);

      const gracePeriodEnds = new Date(dueDate);
      gracePeriodEnds.setMonth(gracePeriodEnds.getMonth() + 6);

      const now = new Date();
      let status: MaintenanceFee['status'];

      if (now < windowOpensDate) {
        status = 'not_yet_due';
      } else if (now < dueDate) {
        status = 'window_open';
      } else if (now < gracePeriodEnds) {
        status = 'grace_period';
      } else {
        status = 'expired';
      }

      fees.push({
        feeWindow: window,
        windowOpensDate,
        dueDate,
        gracePeriodEnds,
        status,
        baseFee: MAINTENANCE_FEE_SCHEDULE[window],
        surcharge: status === 'grace_period' ? SURCHARGE_AMOUNTS : undefined,
      });
    }

    return fees;
  }

  /**
   * Make HTTP request to PAIR API with retry logic.
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST',
    body?: unknown
  ): Promise<T> {
    let lastError: PairApiError | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };

        if (this.config.apiKey) {
          headers['X-API-Key'] = this.config.apiKey;
        }

        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10);
          lastError = {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded',
            retryAfter,
          };
          await this.sleep(retryAfter * 1000);
          continue;
        }

        if (response.status === 404) {
          throw { code: 'NOT_FOUND', message: 'Resource not found' } as PairApiError;
        }

        if (response.status === 503) {
          lastError = {
            code: 'SERVICE_UNAVAILABLE',
            message: 'USPTO service temporarily unavailable',
          };
          await this.sleep(this.config.retryDelayMs * Math.pow(2, attempt));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw {
            code: 'UNKNOWN',
            message: `HTTP ${response.status}: ${errorBody}`,
          } as PairApiError;
        }

        return await response.json() as T;
      } catch (error) {
        if (this.isPairError(error)) {
          throw error;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          lastError = { code: 'TIMEOUT', message: 'Request timed out' };
        } else {
          lastError = {
            code: 'UNKNOWN',
            message: error instanceof Error ? error.message : 'Unknown error',
          };
        }

        if (attempt < this.config.maxRetries - 1) {
          await this.sleep(this.config.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }

    throw lastError ?? { code: 'UNKNOWN', message: 'Request failed after retries' };
  }

  /**
   * Normalize application number to standard format (e.g., "17/123,456").
   */
  private normalizeApplicationNumber(number: string): string {
    // Remove all non-numeric characters
    const digits = number.replace(/\D/g, '');

    // Format as XX/XXX,XXX for modern applications
    if (digits.length >= 8) {
      const series = digits.slice(0, 2);
      const serialFirst = digits.slice(2, 5);
      const serialSecond = digits.slice(5, 8);
      return `${series}/${serialFirst},${serialSecond}`;
    }

    return number;
  }

  /**
   * Normalize patent number to standard format (e.g., "12,345,678").
   */
  private normalizePatentNumber(number: string): string {
    // Remove all non-numeric characters except leading letters (for design patents)
    const match = number.match(/^([A-Z]*)(\d+)/i);
    if (!match) return number;

    const prefix = match[1]?.toUpperCase() ?? '';
    const digits = match[2] ?? '';

    // Format with commas for utility patents (8+ digits)
    if (digits.length >= 7 && !prefix) {
      const parts: string[] = [];
      for (let i = digits.length; i > 0; i -= 3) {
        parts.unshift(digits.slice(Math.max(0, i - 3), i));
      }
      return parts.join(',');
    }

    return `${prefix}${digits}`;
  }

  /**
   * Build search parameters from filters.
   */
  private buildSearchParams(filters: PairSearchFilters): Record<string, unknown> {
    const params: Record<string, unknown> = {
      start: filters.offset ?? 0,
      rows: filters.limit ?? 50,
    };

    if (filters.applicationNumber) {
      params.applicationNumber = this.normalizeApplicationNumber(filters.applicationNumber);
    }
    if (filters.patentNumber) {
      params.patentNumber = this.normalizePatentNumber(filters.patentNumber);
    }
    if (filters.title) {
      params.title = filters.title;
    }
    if (filters.inventorName) {
      params.inventorName = filters.inventorName;
    }
    if (filters.assigneeName) {
      params.assigneeName = filters.assigneeName;
    }
    if (filters.filingDateFrom) {
      params.filingDateFrom = filters.filingDateFrom.toISOString().split('T')[0];
    }
    if (filters.filingDateTo) {
      params.filingDateTo = filters.filingDateTo.toISOString().split('T')[0];
    }
    if (filters.status?.length) {
      params.status = filters.status;
    }
    if (filters.groupArtUnit) {
      params.groupArtUnit = filters.groupArtUnit;
    }

    return params;
  }

  /**
   * Map API response to PatentApplicationSummary.
   */
  private mapToApplicationSummary(response: PairApplicationResponse): PatentApplicationSummary {
    return {
      applicationNumber: response.applicationNumber,
      filingDate: new Date(response.filingDate),
      title: response.inventionTitle,
      status: this.mapStatus(response.applicationStatus),
      examinerName: response.examinerName,
      groupArtUnit: response.groupArtUnitNumber,
      inventors: response.inventors?.map(i => i.nameLineOne) ?? [],
      assignee: response.assigneeEntityName,
      entitySize: this.mapEntitySize(response.entityStatusCode),
      patentNumber: response.patentNumber,
      grantDate: response.grantDate ? new Date(response.grantDate) : undefined,
      publicationNumber: response.publicationNumber,
      publicationDate: response.publicationDate ? new Date(response.publicationDate) : undefined,
      expirationDate: response.patentExpirationDate
        ? new Date(response.patentExpirationDate)
        : undefined,
      lastUpdated: new Date(response.lastUpdatedTimestamp ?? Date.now()),
    };
  }

  /**
   * Map API response to PatentProsecutionHistory.
   */
  private mapToProsecutionHistory(response: PairProsecutionResponse): PatentProsecutionHistory {
    const events: ProsecutionEvent[] = response.events?.map(e => ({
      eventType: this.mapEventType(e.eventCode),
      eventDate: new Date(e.eventDate),
      description: e.eventDescription,
      documentCode: e.documentCode,
      documentDescription: e.documentDescription,
      documentUrl: e.documentUrl,
      pages: e.pageCount,
    })) ?? [];

    const officeActions = response.officeActions?.map(oa =>
      this.mapToOfficeAction(oa, response.applicationNumber)
    ) ?? [];

    const pendingAction = officeActions.find(
      oa => oa.responseStatus === 'pending' && oa.responseDeadline > new Date()
    );

    return {
      applicationNumber: response.applicationNumber,
      title: response.inventionTitle,
      status: this.mapStatus(response.applicationStatus),
      filingDate: new Date(response.filingDate),
      events,
      officeActions,
      pendingOfficeAction: pendingAction,
      lastActivityDate: events.length > 0
        ? new Date(Math.max(...events.map(e => e.eventDate.getTime())))
        : new Date(response.filingDate),
      patentNumber: response.patentNumber,
      grantDate: response.grantDate ? new Date(response.grantDate) : undefined,
    };
  }

  /**
   * Map API response to OfficeAction.
   */
  private mapToOfficeAction(
    response: PairOfficeActionResponse,
    applicationNumber: string
  ): OfficeAction {
    const mailedDate = new Date(response.mailedDate);
    const responseDeadline = response.responseDeadline
      ? new Date(response.responseDeadline)
      : this.calculateResponseDeadline(mailedDate, response.actionType);

    return {
      id: response.documentId ?? `${applicationNumber}-${mailedDate.getTime()}`,
      applicationNumber,
      actionType: this.mapOfficeActionType(response.actionType),
      mailedDate,
      responseDeadline,
      responseStatus: this.mapResponseStatus(response, responseDeadline),
      responseFiledDate: response.responseFiledDate
        ? new Date(response.responseFiledDate)
        : undefined,
      examinerName: response.examinerName ?? '',
      groupArtUnit: response.groupArtUnit ?? '',
      summary: response.summary ?? response.description ?? '',
      rejectedClaims: response.rejectedClaims,
      objectedClaims: response.objectedClaims,
      allowedClaims: response.allowedClaims,
      citedReferences: response.citations?.map(c => ({
        type: c.type as 'patent' | 'publication' | 'npl',
        citation: c.citation,
        relevantClaims: c.relevantClaims ?? [],
        relevanceType: c.relevanceType as '102' | '103' | '112' | 'other',
      })),
      documentUrl: response.documentUrl,
    };
  }

  /**
   * Map API response to PatentGrant.
   */
  private mapToPatentGrant(response: PairPatentResponse): PatentGrant {
    return {
      patentNumber: response.patentNumber,
      applicationNumber: response.applicationNumber,
      title: response.inventionTitle,
      abstract: response.abstractText ?? '',
      grantDate: new Date(response.grantDate),
      filingDate: new Date(response.filingDate),
      priorityDate: response.priorityDate ? new Date(response.priorityDate) : undefined,
      expirationDate: new Date(response.expirationDate),
      inventors: response.inventors?.map(i => ({
        name: i.nameLineOne,
        city: i.city ?? '',
        state: i.state,
        country: i.country ?? 'US',
      })) ?? [],
      assignee: response.assignee ? {
        name: response.assignee.name,
        city: response.assignee.city ?? '',
        state: response.assignee.state,
        country: response.assignee.country ?? 'US',
        assignmentDate: response.assignee.assignmentDate
          ? new Date(response.assignee.assignmentDate)
          : undefined,
      } : undefined,
      claims: response.claims?.map(c => ({
        claimNumber: c.claimNumber,
        text: c.claimText,
        isIndependent: c.isIndependent ?? !c.dependsOn?.length,
        dependsOn: c.dependsOn,
      })) ?? [],
      classifications: response.classifications?.map(c => ({
        system: c.classificationSystem as 'CPC' | 'IPC',
        section: c.section,
        class: c.mainClass,
        subclass: c.subclass,
        mainGroup: c.mainGroup,
        subGroup: c.subGroup,
        fullSymbol: c.symbol,
      })) ?? [],
      citations: response.citations?.map(c => ({
        type: c.type as 'us_patent' | 'us_application' | 'foreign' | 'npl',
        citation: c.citation,
        citedBy: c.citedBy as 'examiner' | 'applicant',
      })) ?? [],
      entitySize: this.mapEntitySize(response.entityStatusCode),
    };
  }

  /**
   * Map API response to MaintenanceFeeStatus.
   */
  private mapToMaintenanceFeeStatus(response: PairMaintenanceResponse): MaintenanceFeeStatus {
    const grantDate = new Date(response.grantDate);
    const entitySize = this.mapEntitySize(response.entityStatusCode);

    const fees = this.calculateMaintenanceFeeSchedule(grantDate, entitySize);

    // Update with actual payment status from response
    if (response.payments) {
      for (const payment of response.payments) {
        const fee = fees.find(f => f.feeWindow === payment.feeWindow);
        if (fee) {
          fee.status = 'paid';
          fee.paidDate = new Date(payment.paidDate);
          fee.paidAmount = payment.amount;
          fee.receiptNumber = payment.receiptNumber;
        }
      }
    }

    const nextDue = fees.find(f => f.status !== 'paid' && f.status !== 'expired');

    // Determine if patent is still active
    let currentStatus: 'active' | 'lapsed' | 'expired';
    const expiredFee = fees.find(f => f.status === 'expired');
    if (expiredFee) {
      currentStatus = 'lapsed';
    } else if (fees.every(f => f.status === 'paid' || f.status === 'not_yet_due')) {
      // Check if past 20 year term
      const termEnd = new Date(grantDate);
      termEnd.setFullYear(termEnd.getFullYear() + 20);
      currentStatus = new Date() > termEnd ? 'expired' : 'active';
    } else {
      currentStatus = 'active';
    }

    return {
      patentNumber: response.patentNumber,
      applicationNumber: response.applicationNumber,
      grantDate,
      entitySize,
      fees,
      nextDue,
      currentStatus,
    };
  }

  /**
   * Map USPTO status code to PatentApplicationStatus.
   */
  private mapStatus(status: string): PatentApplicationStatus {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('patented') || statusLower.includes('issued')) {
      return 'granted';
    }
    if (statusLower.includes('abandon')) {
      return 'abandoned';
    }
    if (statusLower.includes('published')) {
      return 'published';
    }
    return 'pending';
  }

  /**
   * Map USPTO entity status code to EntitySize.
   */
  private mapEntitySize(code: string | undefined): EntitySize {
    if (!code) return 'large';
    const codeLower = code.toLowerCase();
    if (codeLower.includes('micro')) return 'micro';
    if (codeLower.includes('small')) return 'small';
    return 'large';
  }

  /**
   * Map event code to ProsecutionEventType.
   */
  private mapEventType(code: string): ProsecutionEvent['eventType'] {
    const codeUpper = code.toUpperCase();
    const mappings: Record<string, ProsecutionEvent['eventType']> = {
      'FWDX': 'filing',
      'PGPB': 'publication',
      'CTNF': 'office_action_mailed',
      'CTFR': 'office_action_mailed',
      'REM': 'response_filed',
      'APTS': 'amendment_filed',
      'INT': 'interview_conducted',
      'IDS': 'ids_filed',
      'NOA': 'notice_of_allowance',
      'ISFE': 'issue_fee_paid',
      'ISSU': 'patent_issued',
      'ABN': 'abandonment',
      'PETG': 'petition_decided',
      'APBK': 'appeal_filed',
      'TDIS': 'terminal_disclaimer',
    };
    return mappings[codeUpper] ?? 'filing';
  }

  /**
   * Map office action type from response.
   */
  private mapOfficeActionType(type: string): OfficeAction['actionType'] {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('restriction') || typeLower.includes('requirement')) return 'requirement';
    if (typeLower.includes('non-final') || typeLower.includes('nonfinal')) return 'non_final';
    if (typeLower.includes('final')) return 'final';
    if (typeLower.includes('advisory')) return 'advisory';
    if (typeLower.includes('allowance')) return 'allowance';
    if (typeLower.includes('interview')) return 'examiner_interview';
    if (typeLower.includes('information disclosure') || typeLower.includes('ids')) {
      return 'information_disclosure';
    }
    return 'other';
  }

  /**
   * Calculate response deadline based on office action type.
   */
  private calculateResponseDeadline(mailedDate: Date, actionType: string): Date {
    const deadline = new Date(mailedDate);

    // Most office actions have a 3-month shortened statutory period
    // with option to extend up to 6 months
    if (actionType.toLowerCase().includes('restriction')) {
      deadline.setMonth(deadline.getMonth() + 1); // 1 month for restriction
    } else {
      deadline.setMonth(deadline.getMonth() + 3); // 3 months standard
    }

    return deadline;
  }

  /**
   * Determine response status from response data.
   */
  private mapResponseStatus(
    response: PairOfficeActionResponse,
    deadline: Date
  ): OfficeAction['responseStatus'] {
    if (response.responseFiledDate) return 'filed';
    if (response.actionType?.toLowerCase().includes('allowance')) return 'not_required';
    if (new Date() > deadline) return 'overdue';
    return 'pending';
  }

  /**
   * Type guard for PairApiError.
   */
  private isPairError(error: unknown): error is PairApiError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error
    );
  }

  /**
   * Sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Internal API Response Types (matching USPTO PAIR API structure)
// ============================================================================

interface PairSearchResponse {
  totalCount: number;
  applications: PairApplicationResponse[];
}

interface PairApplicationResponse {
  applicationNumber: string;
  filingDate: string;
  inventionTitle: string;
  applicationStatus: string;
  examinerName?: string;
  groupArtUnitNumber?: string;
  inventors?: Array<{ nameLineOne: string }>;
  assigneeEntityName?: string;
  entityStatusCode?: string;
  patentNumber?: string;
  grantDate?: string;
  publicationNumber?: string;
  publicationDate?: string;
  patentExpirationDate?: string;
  lastUpdatedTimestamp?: string;
}

interface PairProsecutionResponse extends PairApplicationResponse {
  events?: Array<{
    eventCode: string;
    eventDate: string;
    eventDescription: string;
    documentCode?: string;
    documentDescription?: string;
    documentUrl?: string;
    pageCount?: number;
  }>;
  officeActions?: PairOfficeActionResponse[];
}

interface PairOfficeActionResponse {
  documentId?: string;
  actionType: string;
  mailedDate: string;
  responseDeadline?: string;
  responseFiledDate?: string;
  examinerName?: string;
  groupArtUnit?: string;
  summary?: string;
  description?: string;
  rejectedClaims?: number[];
  objectedClaims?: number[];
  allowedClaims?: number[];
  citations?: Array<{
    type: string;
    citation: string;
    relevantClaims?: number[];
    relevanceType: string;
  }>;
  documentUrl?: string;
}

interface PairOfficeActionsResponse {
  officeActions: PairOfficeActionResponse[];
}

interface PairPatentResponse {
  patentNumber: string;
  applicationNumber: string;
  inventionTitle: string;
  abstractText?: string;
  grantDate: string;
  filingDate: string;
  priorityDate?: string;
  expirationDate: string;
  entityStatusCode?: string;
  inventors?: Array<{
    nameLineOne: string;
    city?: string;
    state?: string;
    country?: string;
  }>;
  assignee?: {
    name: string;
    city?: string;
    state?: string;
    country?: string;
    assignmentDate?: string;
  };
  claims?: Array<{
    claimNumber: number;
    claimText: string;
    isIndependent?: boolean;
    dependsOn?: number[];
  }>;
  classifications?: Array<{
    classificationSystem: string;
    section: string;
    mainClass: string;
    subclass: string;
    mainGroup: string;
    subGroup: string;
    symbol: string;
  }>;
  citations?: Array<{
    type: string;
    citation: string;
    citedBy: string;
  }>;
}

interface PairMaintenanceResponse {
  patentNumber: string;
  applicationNumber: string;
  grantDate: string;
  entityStatusCode?: string;
  payments?: Array<{
    feeWindow: MaintenanceFeeWindow;
    paidDate: string;
    amount: number;
    receiptNumber?: string;
  }>;
}

// Singleton instance
export const usptoPairClient = new USPTOPairClient();
