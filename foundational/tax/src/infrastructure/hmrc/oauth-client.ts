/**
 * HMRC OAuth 2.0 Client
 *
 * Implements the OAuth 2.0 authorization code flow for HMRC APIs.
 * Reference: https://developer.service.hmrc.gov.uk/api-documentation/docs/authorisation
 */

import { z } from 'zod';

// =============================================================================
// Configuration Schema
// =============================================================================

export const HMRCOAuthConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  environment: z.enum(['sandbox', 'production']).default('sandbox'),
  scopes: z.array(z.string()).default(['read:vat', 'write:vat']),
});

export type HMRCOAuthConfig = z.infer<typeof HMRCOAuthConfigSchema>;

// =============================================================================
// Token Types
// =============================================================================

export interface HMRCTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

export interface HMRCTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string[];
}

// =============================================================================
// Error Types
// =============================================================================

export class HMRCAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'HMRCAuthError';
  }
}

// =============================================================================
// OAuth Client
// =============================================================================

export class HMRCOAuthClient {
  private readonly baseUrl: string;
  private readonly config: HMRCOAuthConfig;

  constructor(config: HMRCOAuthConfig) {
    this.config = HMRCOAuthConfigSchema.parse(config);
    this.baseUrl = config.environment === 'production'
      ? 'https://api.service.hmrc.gov.uk'
      : 'https://test-api.service.hmrc.gov.uk';
  }

  /**
   * Generate the authorization URL for user consent
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      scope: this.config.scopes.join(' '),
      redirect_uri: this.config.redirectUri,
      state,
    });

    return `${this.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<HMRCTokenSet> {
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new HMRCAuthError(
        error.error_description || 'Failed to exchange authorization code',
        error.error || 'exchange_failed',
        response.status
      );
    }

    const data = await response.json() as HMRCTokenResponse;
    return this.tokenResponseToTokenSet(data);
  }

  /**
   * Refresh an expired access token
   */
  async refreshToken(refreshToken: string): Promise<HMRCTokenSet> {
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new HMRCAuthError(
        error.error_description || 'Failed to refresh token',
        error.error || 'refresh_failed',
        response.status
      );
    }

    const data = await response.json() as HMRCTokenResponse;
    return this.tokenResponseToTokenSet(data);
  }

  /**
   * Check if a token set is expired (with 5 minute buffer)
   */
  isTokenExpired(tokenSet: HMRCTokenSet): boolean {
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    return new Date().getTime() >= tokenSet.expiresAt.getTime() - bufferMs;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidToken(tokenSet: HMRCTokenSet): Promise<HMRCTokenSet> {
    if (!this.isTokenExpired(tokenSet)) {
      return tokenSet;
    }
    return this.refreshToken(tokenSet.refreshToken);
  }

  private tokenResponseToTokenSet(response: HMRCTokenResponse): HMRCTokenSet {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + response.expires_in);

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt,
      scope: response.scope.split(' '),
    };
  }
}

/**
 * Token storage interface for persisting HMRC tokens
 */
export interface HMRCTokenStore {
  getToken(entityId: string, scope: string): Promise<HMRCTokenSet | null>;
  saveToken(entityId: string, scope: string, tokenSet: HMRCTokenSet): Promise<void>;
  deleteToken(entityId: string, scope: string): Promise<void>;
}

/**
 * In-memory token store for development/testing
 */
export class InMemoryTokenStore implements HMRCTokenStore {
  private tokens = new Map<string, HMRCTokenSet>();

  private key(entityId: string, scope: string): string {
    return `${entityId}:${scope}`;
  }

  async getToken(entityId: string, scope: string): Promise<HMRCTokenSet | null> {
    return this.tokens.get(this.key(entityId, scope)) ?? null;
  }

  async saveToken(entityId: string, scope: string, tokenSet: HMRCTokenSet): Promise<void> {
    this.tokens.set(this.key(entityId, scope), tokenSet);
  }

  async deleteToken(entityId: string, scope: string): Promise<void> {
    this.tokens.delete(this.key(entityId, scope));
  }
}
