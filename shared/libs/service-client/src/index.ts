/**
 * @ecosystem/service-client
 * Type-safe HTTP client for inter-service communication
 */

import { ServiceClient as AuthClient, ServiceTokenConfig, ServiceIdentity } from '@ecosystem/service-auth';
import { pino } from 'pino';

const logger = pino({ name: 'service-client' });

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

export class BaseServiceClient {
  protected baseUrl: string;
  protected authClient: AuthClient;
  protected retryConfig: RetryConfig;
  protected circuitState: CircuitState = {
    failures: 0,
    lastFailure: 0,
    state: 'closed',
  };
  protected circuitThreshold = 5;
  protected circuitResetMs = 30000;

  constructor(
    baseUrl: string,
    authConfig: ServiceTokenConfig,
    serviceIdentity: Omit<ServiceIdentity, 'issuedAt' | 'expiresAt'>,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.authClient = new AuthClient(authConfig, serviceIdentity);
    this.retryConfig = { ...defaultRetryConfig, ...retryConfig };
  }

  protected async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      correlationId?: string;
    }
  ): Promise<T> {
    if (this.isCircuitOpen()) {
      throw new ServiceClientError('Circuit breaker is open', 'CIRCUIT_OPEN', 503);
    }

    const url = this.baseUrl + path;
    const authHeaders = await this.authClient.getAuthHeaders();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options?.headers,
    };

    if (options?.correlationId) {
      headers['x-correlation-id'] = options.correlationId;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: options?.body ? JSON.stringify(options.body) : undefined,
        });

        if (!response.ok) {
          const shouldRetry = this.retryConfig.retryableStatuses.includes(response.status);
          if (shouldRetry && attempt < this.retryConfig.maxRetries) {
            await this.delay(attempt);
            continue;
          }
          this.recordFailure();
          const errorBody = await response.text();
          throw new ServiceClientError(errorBody || response.statusText, 'HTTP_ERROR', response.status);
        }

        this.recordSuccess();
        return await response.json() as T;
      } catch (error) {
        lastError = error as Error;
        if (error instanceof ServiceClientError) throw error;
        if (attempt < this.retryConfig.maxRetries) {
          logger.warn({ attempt, error: lastError.message }, 'Request failed, retrying');
          await this.delay(attempt);
          continue;
        }
        this.recordFailure();
      }
    }

    throw new ServiceClientError(lastError?.message || 'Request failed', 'NETWORK_ERROR', 0);
  }

  private async delay(attempt: number): Promise<void> {
    const delay = Math.min(this.retryConfig.baseDelayMs * Math.pow(2, attempt), this.retryConfig.maxDelayMs);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private isCircuitOpen(): boolean {
    if (this.circuitState.state === 'closed') return false;
    if (this.circuitState.state === 'open') {
      const now = Date.now();
      if (now - this.circuitState.lastFailure > this.circuitResetMs) {
        this.circuitState.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  private recordFailure(): void {
    this.circuitState.failures++;
    this.circuitState.lastFailure = Date.now();
    if (this.circuitState.failures >= this.circuitThreshold) {
      this.circuitState.state = 'open';
      logger.warn('Circuit breaker opened');
    }
  }

  private recordSuccess(): void {
    this.circuitState.failures = 0;
    if (this.circuitState.state === 'half-open') {
      this.circuitState.state = 'closed';
      logger.info('Circuit breaker closed');
    }
  }
}

export class ServiceClientError extends Error {
  constructor(
    message: string,
    public code: 'CIRCUIT_OPEN' | 'HTTP_ERROR' | 'NETWORK_ERROR' | 'VALIDATION_ERROR',
    public statusCode: number
  ) {
    super(message);
    this.name = 'ServiceClientError';
  }
}

export class EntityGovernanceClient extends BaseServiceClient {
  async getEntity(id: string, correlationId?: string) {
    return this.request<any>('GET', '/entities/' + id, { correlationId });
  }
  async createEntity(data: any, correlationId?: string) {
    return this.request<any>('POST', '/entities', { body: data, correlationId });
  }
  async updateEntity(id: string, data: any, correlationId?: string) {
    return this.request<any>('PUT', '/entities/' + id, { body: data, correlationId });
  }
  async listEntities(params?: { limit?: number; offset?: number }, correlationId?: string) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    const qs = query.toString();
    return this.request<any>('GET', '/entities' + (qs ? '?' + qs : ''), { correlationId });
  }
  async getEntityTree(id: string, correlationId?: string) {
    return this.request<any>('GET', '/entities/' + id + '/tree', { correlationId });
  }
}

export class KycIdentityClient extends BaseServiceClient {
  async getIdentity(id: string, correlationId?: string) {
    return this.request<any>('GET', '/identities/' + id, { correlationId });
  }
  async createIdentity(data: any, correlationId?: string) {
    return this.request<any>('POST', '/identities', { body: data, correlationId });
  }
  async initiateKycCheck(identityId: string, checkType: string, correlationId?: string) {
    return this.request<any>('POST', '/identities/' + identityId + '/checks', { body: { checkType }, correlationId });
  }
  async screenIdentity(identityId: string, correlationId?: string) {
    return this.request<any>('POST', '/identities/' + identityId + '/screen', { correlationId });
  }
}

export class AccountingClient extends BaseServiceClient {
  async getAccount(id: string, correlationId?: string) {
    return this.request<any>('GET', '/accounts/' + id, { correlationId });
  }
  async createAccount(data: any, correlationId?: string) {
    return this.request<any>('POST', '/accounts', { body: data, correlationId });
  }
  async createJournalEntry(data: any, correlationId?: string) {
    return this.request<any>('POST', '/journal-entries', { body: data, correlationId });
  }
}

export class BankingTreasuryClient extends BaseServiceClient {
  async getBankAccount(id: string, correlationId?: string) {
    return this.request<any>('GET', '/bank-accounts/' + id, { correlationId });
  }
  async createPayment(data: any, correlationId?: string) {
    return this.request<any>('POST', '/payments', { body: data, correlationId });
  }
}

export class ComplianceClient extends BaseServiceClient {
  async getPolicies(correlationId?: string) {
    return this.request<any>('GET', '/policies', { correlationId });
  }
  async createAuditFinding(data: any, correlationId?: string) {
    return this.request<any>('POST', '/audit-findings', { body: data, correlationId });
  }
}

export interface ServiceClients {
  entityGovernance: EntityGovernanceClient;
  kycIdentity: KycIdentityClient;
  accounting: AccountingClient;
  bankingTreasury: BankingTreasuryClient;
  compliance: ComplianceClient;
}

export function createServiceClients(
  authConfig: ServiceTokenConfig,
  serviceIdentity: Omit<ServiceIdentity, 'issuedAt' | 'expiresAt'>,
  urls?: {
    entityGovernance?: string;
    kycIdentity?: string;
    accounting?: string;
    bankingTreasury?: string;
    compliance?: string;
  }
): ServiceClients {
  return {
    entityGovernance: new EntityGovernanceClient(
      urls?.entityGovernance || process.env.ENTITY_GOVERNANCE_URL || 'http://localhost:3001',
      authConfig, serviceIdentity
    ),
    kycIdentity: new KycIdentityClient(
      urls?.kycIdentity || process.env.KYC_IDENTITY_URL || 'http://localhost:3002',
      authConfig, serviceIdentity
    ),
    accounting: new AccountingClient(
      urls?.accounting || process.env.ACCOUNTING_URL || 'http://localhost:3003',
      authConfig, serviceIdentity
    ),
    bankingTreasury: new BankingTreasuryClient(
      urls?.bankingTreasury || process.env.BANKING_TREASURY_URL || 'http://localhost:3004',
      authConfig, serviceIdentity
    ),
    compliance: new ComplianceClient(
      urls?.compliance || process.env.COMPLIANCE_URL || 'http://localhost:3006',
      authConfig, serviceIdentity
    ),
  };
}
