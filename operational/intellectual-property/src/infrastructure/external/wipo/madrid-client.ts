/**
 * WIPO Madrid Monitor Client
 *
 * Client for interacting with the WIPO Madrid Monitor API to track
 * international trademark registrations under the Madrid Protocol.
 *
 * Features:
 * - Search international registrations by number
 * - Get registration status and designated countries
 * - Get designation status for each country
 * - Monitor central attack notifications
 * - Get renewal status
 *
 * @module infrastructure/external/wipo
 */

import {
  type InternationalRegistration,
  type CountryDesignation,
  type CentralAttackNotification,
  type MadridRenewalStatus,
  type WIPOSearchResult,
  type WIPORegistrationData,
  type WIPODesignationData,
  type WIPOAPIError,
  type MadridSyncConfig,
  type DesignationStatus,
  type InternationalRegistrationStatus,
  type RefusalReason,
  type MadridNiceClass,
} from './madrid-types.js';

/**
 * Default configuration for the WIPO Madrid client.
 */
const DEFAULT_CONFIG: MadridSyncConfig = {
  apiBaseUrl: process.env.WIPO_API_BASE_URL ?? 'https://madrid-api.wipo.int/v1',
  apiKey: process.env.WIPO_API_KEY ?? '',
  apiSecret: process.env.WIPO_API_SECRET,
  timeout: 30_000, // 30 seconds
  pollingIntervalMinutes: 60,
  batchSize: 100,
  retryAttempts: 3,
  retryDelayMs: 1000,
  debug: process.env.NODE_ENV === 'development',
};

/**
 * Error class for WIPO API errors.
 */
export class WIPOAPIException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'WIPOAPIException';
  }
}

/**
 * WIPO Madrid Monitor Client
 *
 * Provides methods to interact with the WIPO Madrid Monitor API.
 */
export class WIPOMadridClient {
  private readonly config: MadridSyncConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(config: Partial<MadridSyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  /**
   * Authenticate with WIPO API and obtain access token.
   */
  async authenticate(): Promise<void> {
    if (!this.config.apiKey) {
      throw new WIPOAPIException('WIPO API key not configured', 'AUTH_CONFIG_MISSING');
    }

    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return;
    }

    try {
      const response = await this.makeRequest<{ accessToken: string; expiresIn: number }>(
        '/auth/token',
        {
          method: 'POST',
          body: JSON.stringify({
            apiKey: this.config.apiKey,
            apiSecret: this.config.apiSecret,
          }),
          skipAuth: true,
        }
      );

      this.accessToken = response.accessToken;
      this.tokenExpiresAt = new Date(Date.now() + (response.expiresIn - 60) * 1000);

      this.log('Authenticated with WIPO API');
    } catch (error) {
      throw new WIPOAPIException(
        'Failed to authenticate with WIPO API',
        'AUTH_FAILED',
        error instanceof Error ? error.message : undefined
      );
    }
  }

  // ===========================================================================
  // Search Operations
  // ===========================================================================

  /**
   * Search for international registrations by registration number.
   */
  async searchByRegistrationNumber(
    registrationNumber: string
  ): Promise<InternationalRegistration | null> {
    await this.authenticate();

    // Normalize registration number (remove 'IR' prefix if present)
    const normalizedNumber = registrationNumber.replace(/^IR/i, '').trim();

    try {
      const data = await this.makeRequest<WIPORegistrationData>(
        `/registrations/${normalizedNumber}`
      );

      return this.mapToInternationalRegistration(data);
    } catch (error) {
      if (error instanceof WIPOAPIException && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Search for international registrations by holder name.
   */
  async searchByHolderName(
    holderName: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<WIPOSearchResult> {
    await this.authenticate();

    const params = new URLSearchParams({
      holderName,
      offset: String(options.offset ?? 0),
      limit: String(options.limit ?? 20),
    });

    const data = await this.makeRequest<{
      total: number;
      results: WIPORegistrationData[];
      offset: number;
      limit: number;
    }>(`/registrations/search?${params.toString()}`);

    return {
      totalCount: data.total,
      results: data.results.map(r => ({
        internationalRegistrationNumber: r.internationalRegistrationNumber,
        mark: r.mark,
        holderName: r.holderName,
        officeOfOrigin: r.officeOfOrigin,
        registrationDate: r.registrationDate ?? '',
        expirationDate: r.expirationDate ?? '',
        status: r.status,
        niceClasses: r.niceClasses.map(c => c.classNumber),
        designationCount: r.designations.length,
      })),
      offset: data.offset,
      limit: data.limit,
      hasMore: data.offset + data.results.length < data.total,
    };
  }

  /**
   * Search for registrations by multiple criteria.
   */
  async searchRegistrations(criteria: {
    mark?: string;
    holderName?: string;
    officeOfOrigin?: string;
    niceClasses?: number[];
    status?: InternationalRegistrationStatus;
    designatedCountries?: string[];
    registeredAfter?: Date;
    registeredBefore?: Date;
    offset?: number;
    limit?: number;
  }): Promise<WIPOSearchResult> {
    await this.authenticate();

    const params = new URLSearchParams();

    if (criteria.mark) params.set('mark', criteria.mark);
    if (criteria.holderName) params.set('holderName', criteria.holderName);
    if (criteria.officeOfOrigin) params.set('officeOfOrigin', criteria.officeOfOrigin);
    if (criteria.niceClasses?.length) params.set('niceClasses', criteria.niceClasses.join(','));
    if (criteria.status) params.set('status', criteria.status);
    if (criteria.designatedCountries?.length) {
      params.set('designatedCountries', criteria.designatedCountries.join(','));
    }
    if (criteria.registeredAfter) {
      params.set('registeredAfter', criteria.registeredAfter.toISOString().split('T')[0] as string);
    }
    if (criteria.registeredBefore) {
      params.set('registeredBefore', criteria.registeredBefore.toISOString().split('T')[0] as string);
    }
    params.set('offset', String(criteria.offset ?? 0));
    params.set('limit', String(criteria.limit ?? 20));

    const data = await this.makeRequest<{
      total: number;
      results: WIPORegistrationData[];
      offset: number;
      limit: number;
    }>(`/registrations/search?${params.toString()}`);

    return {
      totalCount: data.total,
      results: data.results.map(r => ({
        internationalRegistrationNumber: r.internationalRegistrationNumber,
        mark: r.mark,
        holderName: r.holderName,
        officeOfOrigin: r.officeOfOrigin,
        registrationDate: r.registrationDate ?? '',
        expirationDate: r.expirationDate ?? '',
        status: r.status,
        niceClasses: r.niceClasses.map(c => c.classNumber),
        designationCount: r.designations.length,
      })),
      offset: data.offset,
      limit: data.limit,
      hasMore: data.offset + data.results.length < data.total,
    };
  }

  // ===========================================================================
  // Registration Status
  // ===========================================================================

  /**
   * Get full registration status including all designations.
   */
  async getRegistrationStatus(registrationNumber: string): Promise<InternationalRegistration> {
    const registration = await this.searchByRegistrationNumber(registrationNumber);

    if (!registration) {
      throw new WIPOAPIException(
        `Registration ${registrationNumber} not found`,
        'REGISTRATION_NOT_FOUND',
        undefined,
        404
      );
    }

    return registration;
  }

  /**
   * Get designation status for a specific country.
   */
  async getDesignationStatus(
    registrationNumber: string,
    countryCode: string
  ): Promise<CountryDesignation | null> {
    const registration = await this.getRegistrationStatus(registrationNumber);

    return registration.designations.find(
      d => d.countryCode.toUpperCase() === countryCode.toUpperCase()
    ) ?? null;
  }

  /**
   * Get all designations for a registration.
   */
  async getDesignations(registrationNumber: string): Promise<CountryDesignation[]> {
    const registration = await this.getRegistrationStatus(registrationNumber);
    return registration.designations;
  }

  // ===========================================================================
  // Central Attack Monitoring
  // ===========================================================================

  /**
   * Check for central attack notifications affecting a registration.
   */
  async checkCentralAttackStatus(
    registrationNumber: string
  ): Promise<CentralAttackNotification | null> {
    await this.authenticate();

    try {
      const data = await this.makeRequest<WIPORegistrationData>(
        `/registrations/${registrationNumber.replace(/^IR/i, '')}/central-attack`
      );

      if (!data.centralAttackNotification) {
        return null;
      }

      const notification = data.centralAttackNotification;
      return {
        notificationId: notification.notificationId,
        internationalRegistrationNumber: registrationNumber,
        notificationDate: new Date(notification.notificationDate),
        attackType: this.mapAttackType(notification.attackType),
        officeOfOrigin: data.officeOfOrigin,
        ceasedDate: new Date(notification.ceasedDate),
        classesAffected: notification.classesAffected,
        fullCancellation: notification.fullCancellation,
        transformationDeadline: new Date(notification.transformationDeadline),
        countriesForTransformation: data.designations
          .filter(d => d.status !== 'refused' && d.status !== 'withdrawn')
          .map(d => d.countryCode),
        severity: 'critical',
        notes: `Central attack: Basic mark in ${data.officeOfOrigin} has been ${notification.attackType}. Transformation deadline: ${notification.transformationDeadline}`,
      };
    } catch (error) {
      if (error instanceof WIPOAPIException && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all central attack notifications for tracked registrations.
   */
  async getCentralAttackNotifications(
    registrationNumbers: string[]
  ): Promise<CentralAttackNotification[]> {
    const notifications: CentralAttackNotification[] = [];

    for (const regNum of registrationNumbers) {
      try {
        const notification = await this.checkCentralAttackStatus(regNum);
        if (notification) {
          notifications.push(notification);
        }
      } catch (error) {
        this.log(`Error checking central attack for ${regNum}: ${error}`, 'error');
      }
    }

    return notifications;
  }

  // ===========================================================================
  // Renewal Status
  // ===========================================================================

  /**
   * Get renewal status for a registration.
   */
  async getRenewalStatus(registrationNumber: string): Promise<MadridRenewalStatus> {
    const registration = await this.getRegistrationStatus(registrationNumber);

    if (!registration.expirationDate) {
      throw new WIPOAPIException(
        'Registration has no expiration date',
        'NO_EXPIRATION_DATE'
      );
    }

    const expirationDate = registration.expirationDate;
    const now = new Date();

    // Renewal window opens 6 months before expiration
    const renewalWindowOpens = new Date(expirationDate);
    renewalWindowOpens.setMonth(renewalWindowOpens.getMonth() - 6);

    // Grace period is 6 months after expiration
    const graceDeadline = new Date(expirationDate);
    graceDeadline.setMonth(graceDeadline.getMonth() + 6);

    // Check if in grace period
    const inGracePeriod = now > expirationDate && now <= graceDeadline;

    // Calculate estimated renewal fee
    // Base fee: 653 CHF + supplementary fee per class + individual fees per designation
    const baseRenewalFee = 653;
    const supplementaryFeePerClass = 100;
    const designationCount = registration.designations.filter(
      d => d.status === 'protected' || d.status === 'accepted'
    ).length;

    const classCount = registration.niceClasses.length;
    const estimatedFee = baseRenewalFee +
      (classCount > 3 ? (classCount - 3) * supplementaryFeePerClass : 0) +
      (designationCount * 100); // Simplified individual fee estimate

    const renewalStatus = registration.renewalStatus;

    return {
      internationalRegistrationNumber: registration.internationalRegistrationNumber,
      currentExpirationDate: expirationDate,
      renewalDueDate: expirationDate,
      renewalWindowOpens,
      graceDeadline,
      inGracePeriod,
      estimatedFee,
      designationCount,
      renewalPaid: renewalStatus?.renewalPaid ?? false,
      paymentDate: renewalStatus?.paymentDate,
      receiptNumber: renewalStatus?.receiptNumber,
    };
  }

  /**
   * Get renewal statuses for multiple registrations.
   */
  async getRenewalStatuses(
    registrationNumbers: string[]
  ): Promise<Map<string, MadridRenewalStatus>> {
    const statuses = new Map<string, MadridRenewalStatus>();

    for (const regNum of registrationNumbers) {
      try {
        const status = await this.getRenewalStatus(regNum);
        statuses.set(regNum, status);
      } catch (error) {
        this.log(`Error getting renewal status for ${regNum}: ${error}`, 'error');
      }
    }

    return statuses;
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  /**
   * Get updates for multiple registrations since a given date.
   */
  async getUpdatedRegistrations(
    registrationNumbers: string[],
    since: Date
  ): Promise<InternationalRegistration[]> {
    const updated: InternationalRegistration[] = [];

    // Process in batches to avoid rate limiting
    const batches = this.chunk(registrationNumbers, this.config.batchSize);

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async regNum => {
          try {
            const registration = await this.searchByRegistrationNumber(regNum);
            if (registration && registration.lastSyncedAt > since) {
              return registration;
            }
            return null;
          } catch {
            return null;
          }
        })
      );

      updated.push(...results.filter((r): r is InternationalRegistration => r !== null));

      // Add delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.delay(1000);
      }
    }

    return updated;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Make an HTTP request to the WIPO API.
   */
  private async makeRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: string;
      skipAuth?: boolean;
    } = {}
  ): Promise<T> {
    const url = `${this.config.apiBaseUrl}${endpoint}`;
    const method = options.method ?? 'GET';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (!options.skipAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: options.body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          let apiError: WIPOAPIError;

          try {
            apiError = JSON.parse(errorBody) as WIPOAPIError;
          } catch {
            apiError = {
              code: `HTTP_${response.status}`,
              message: response.statusText,
              details: errorBody,
              timestamp: new Date().toISOString(),
            };
          }

          throw new WIPOAPIException(
            apiError.message,
            apiError.code,
            apiError.details,
            response.status
          );
        }

        const data = await response.json() as T;
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof WIPOAPIException) {
          // Don't retry client errors (4xx)
          if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
            throw error;
          }
        }

        this.log(`Request attempt ${attempt} failed: ${lastError.message}`, 'warn');

        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelayMs * attempt);
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /**
   * Map WIPO API response to InternationalRegistration.
   */
  private mapToInternationalRegistration(data: WIPORegistrationData): InternationalRegistration {
    return {
      internationalRegistrationNumber: data.internationalRegistrationNumber,
      basicMarkReference: data.basicMarkReference,
      officeOfOrigin: data.officeOfOrigin,
      holderName: data.holderName,
      holderAddress: data.holderAddress,
      filingDate: new Date(data.filingDate),
      registrationDate: data.registrationDate ? new Date(data.registrationDate) : undefined,
      expirationDate: data.expirationDate ? new Date(data.expirationDate) : undefined,
      status: this.mapRegistrationStatus(data.status),
      mark: data.mark,
      markType: this.mapMarkType(data.markType),
      viennaCodes: data.viennaCodes,
      niceClasses: this.mapNiceClasses(data.niceClasses),
      priorityClaims: data.priorityClaims?.map(p => ({
        country: p.country,
        applicationNumber: p.applicationNumber,
        filingDate: new Date(p.filingDate),
      })),
      designations: data.designations.map(d => this.mapDesignation(d)),
      centralAttackPeriodEnds: data.centralAttackPeriodEnds
        ? new Date(data.centralAttackPeriodEnds)
        : undefined,
      inDependencyPeriod: data.centralAttackPeriodEnds
        ? new Date(data.centralAttackPeriodEnds) > new Date()
        : false,
      centralAttackNotification: data.centralAttackNotification
        ? {
            notificationId: data.centralAttackNotification.notificationId,
            internationalRegistrationNumber: data.internationalRegistrationNumber,
            notificationDate: new Date(data.centralAttackNotification.notificationDate),
            attackType: this.mapAttackType(data.centralAttackNotification.attackType),
            officeOfOrigin: data.officeOfOrigin,
            ceasedDate: new Date(data.centralAttackNotification.ceasedDate),
            classesAffected: data.centralAttackNotification.classesAffected,
            fullCancellation: data.centralAttackNotification.fullCancellation,
            transformationDeadline: new Date(data.centralAttackNotification.transformationDeadline),
            countriesForTransformation: data.designations
              .filter(d => d.status !== 'refused' && d.status !== 'withdrawn')
              .map(d => d.countryCode),
            severity: 'critical',
          }
        : undefined,
      renewalStatus: data.renewalStatus
        ? {
            internationalRegistrationNumber: data.internationalRegistrationNumber,
            currentExpirationDate: new Date(data.expirationDate!),
            renewalDueDate: new Date(data.renewalStatus.dueDate),
            renewalWindowOpens: this.addMonths(new Date(data.renewalStatus.dueDate), -6),
            graceDeadline: this.addMonths(new Date(data.renewalStatus.dueDate), 6),
            inGracePeriod: false,
            estimatedFee: 653, // Base fee, actual calculation done in getRenewalStatus
            designationCount: data.designations.length,
            renewalPaid: data.renewalStatus.paid,
            paymentDate: data.renewalStatus.paymentDate
              ? new Date(data.renewalStatus.paymentDate)
              : undefined,
            receiptNumber: data.renewalStatus.receiptNumber,
          }
        : undefined,
      lastSyncedAt: new Date(data.lastModified),
      wipoUrl: `https://www.wipo.int/madrid/monitor/en/showData.jsp?ID=ROM.${data.internationalRegistrationNumber}`,
    };
  }

  /**
   * Map WIPO designation data to CountryDesignation.
   */
  private mapDesignation(data: WIPODesignationData): CountryDesignation {
    return {
      countryCode: data.countryCode,
      countryName: data.countryName,
      designationDate: new Date(data.designationDate),
      status: this.mapDesignationStatus(data.status),
      statusDate: new Date(data.statusDate),
      protectionDate: data.protectionDate ? new Date(data.protectionDate) : undefined,
      refusalDate: data.refusalDate ? new Date(data.refusalDate) : undefined,
      refusalReason: data.refusalReasons?.length
        ? this.mapRefusalReason(data.refusalReasons[0] as string)
        : undefined,
      responseDeadline: data.responseDeadline ? new Date(data.responseDeadline) : undefined,
      classesProtected: data.classes,
      classesRefused: data.refusedClasses,
      localRegistrationNumber: data.localRegistrationNumber,
      appealPending: data.appealStatus === 'pending',
      appealDeadline: data.appealDeadline ? new Date(data.appealDeadline) : undefined,
      notes: data.notes,
    };
  }

  /**
   * Map Nice classes from API format.
   */
  private mapNiceClasses(
    classes: Array<{
      classNumber: number;
      goodsServices: string;
      limitations?: Array<{ country: string; text: string }>;
    }>
  ): MadridNiceClass[] {
    return classes.map(c => ({
      classNumber: c.classNumber,
      goodsServices: c.goodsServices,
      limitedInCountries: c.limitations?.map(l => l.country),
    }));
  }

  /**
   * Map registration status string to enum.
   */
  private mapRegistrationStatus(status: string): InternationalRegistrationStatus {
    const statusMap: Record<string, InternationalRegistrationStatus> = {
      'pending': 'pending',
      'registered': 'registered',
      'renewed': 'renewed',
      'cancelled': 'cancelled',
      'expired': 'expired',
      'transformed': 'transformed',
    };
    return statusMap[status.toLowerCase()] ?? 'pending';
  }

  /**
   * Map designation status string to enum.
   */
  private mapDesignationStatus(status: string): DesignationStatus {
    const statusMap: Record<string, DesignationStatus> = {
      'pending': 'pending',
      'under examination': 'under_examination',
      'under_examination': 'under_examination',
      'provisionally refused': 'provisionally_refused',
      'provisionally_refused': 'provisionally_refused',
      'accepted': 'accepted',
      'refused': 'refused',
      'withdrawn': 'withdrawn',
      'protected': 'protected',
      'ceased': 'ceased',
      'expired': 'expired',
    };
    return statusMap[status.toLowerCase()] ?? 'pending';
  }

  /**
   * Map refusal reason string to enum.
   */
  private mapRefusalReason(reason: string): RefusalReason {
    const reasonLower = reason.toLowerCase();
    if (reasonLower.includes('absolute')) return 'absolute_grounds';
    if (reasonLower.includes('relative') || reasonLower.includes('prior')) return 'relative_grounds';
    if (reasonLower.includes('formal')) return 'formal_deficiency';
    if (reasonLower.includes('bad faith')) return 'bad_faith';
    if (reasonLower.includes('public') || reasonLower.includes('moral')) return 'public_policy';
    if (reasonLower.includes('deceptive')) return 'deceptive';
    return 'other';
  }

  /**
   * Map attack type string to enum.
   */
  private mapAttackType(
    attackType: string
  ): CentralAttackNotification['attackType'] {
    const typeMap: Record<string, CentralAttackNotification['attackType']> = {
      'cancellation': 'cancellation',
      'cancelled': 'cancellation',
      'invalidation': 'invalidation',
      'invalidated': 'invalidation',
      'expiration': 'expiration',
      'expired': 'expiration',
      'abandonment': 'abandonment',
      'abandoned': 'abandonment',
      'restriction': 'restriction',
      'restricted': 'restriction',
    };
    return typeMap[attackType.toLowerCase()] ?? 'cancellation';
  }

  /**
   * Map mark type string to enum.
   */
  private mapMarkType(
    markType: string
  ): InternationalRegistration['markType'] {
    const typeMap: Record<string, InternationalRegistration['markType']> = {
      'word': 'word',
      'figurative': 'figurative',
      'combined': 'combined',
      '3d': '3d',
      'three-dimensional': '3d',
      'sound': 'sound',
      'color': 'color',
      'colour': 'color',
      'hologram': 'hologram',
      'motion': 'motion',
      'position': 'position',
      'pattern': 'pattern',
    };
    return typeMap[markType.toLowerCase()] ?? 'other';
  }

  /**
   * Add months to a date.
   */
  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  /**
   * Split array into chunks.
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Delay execution.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log message if debug is enabled.
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (this.config.debug) {
      const timestamp = new Date().toISOString();
      console[level](`[WIPOMadridClient ${timestamp}] ${message}`);
    }
  }
}

// Singleton instance with default configuration
export const wipoMadridClient = new WIPOMadridClient();
