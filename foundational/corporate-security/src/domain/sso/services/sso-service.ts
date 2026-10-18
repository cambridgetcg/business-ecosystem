/**
 * SSO Service
 *
 * Manages SSO provider configuration and authentication flows.
 *
 * @module domain/sso/services/sso-service
 */

import { v4 as uuidv4 } from 'uuid';
import {
  type SSOProvider,
  type SSOSession,
  type CreateSSOProviderInput,
  type SAMLConfig,
  type OIDCConfig,
  type AttributeMapping,
  isProviderActive,
  isEmailDomainAllowed,
  mapAttributes,
  validateProviderConfig,
} from '../models/sso-provider.js';

// =============================================================================
// TYPES
// =============================================================================

export interface SAMLAuthRequest {
  requestId: string;
  redirectUrl: string;
  relayState?: string;
}

export interface SAMLAuthResponse {
  nameId: string;
  nameIdFormat: string;
  sessionIndex?: string;
  attributes: Record<string, unknown>;
}

export interface OIDCAuthRequest {
  state: string;
  nonce: string;
  codeVerifier?: string;
  redirectUrl: string;
}

export interface OIDCTokenResponse {
  accessToken: string;
  refreshToken?: string;
  idToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface OIDCUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  [key: string]: unknown;
}

export interface SSOAuthResult {
  success: boolean;
  identityId?: string;
  email?: string;
  attributes?: Record<string, string | undefined>;
  session?: SSOSession;
  error?: string;
  newUser?: boolean;
}

// =============================================================================
// SERVICE
// =============================================================================

export class SSOService {
  // In-memory storage for demo
  private providers: Map<string, SSOProvider> = new Map();
  private sessions: Map<string, SSOSession> = new Map();
  private pendingAuth: Map<string, { providerId: string; state: string; nonce?: string; codeVerifier?: string }> = new Map();

  constructor() {}

  // ===========================================================================
  // PROVIDER MANAGEMENT
  // ===========================================================================

  /**
   * Create a new SSO provider.
   */
  async createProvider(input: CreateSSOProviderInput): Promise<SSOProvider> {
    const now = new Date();

    const provider: SSOProvider = {
      id: uuidv4(),
      tenantId: input.tenantId,
      name: input.name,
      description: input.description,
      type: input.type,
      status: 'pending_verification',
      samlConfig: input.samlConfig,
      oidcConfig: input.oidcConfig,
      attributeMapping: input.attributeMapping ?? {},
      emailDomains: input.emailDomains,
      autoProvision: input.autoProvision ?? true,
      defaultRoleId: input.defaultRoleId,
      forceReauthentication: false,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      verifiedAt: null,
    };

    const errors = validateProviderConfig(provider);
    if (errors.length > 0) {
      throw new Error(`Invalid provider configuration: ${errors.join(', ')}`);
    }

    this.providers.set(provider.id, provider);
    return provider;
  }

  /**
   * Get provider by ID.
   */
  async getProvider(providerId: string): Promise<SSOProvider | null> {
    return this.providers.get(providerId) ?? null;
  }

  /**
   * Get providers for a tenant.
   */
  async getProvidersByTenant(tenantId: string): Promise<SSOProvider[]> {
    return Array.from(this.providers.values()).filter(
      p => p.tenantId === tenantId
    );
  }

  /**
   * Find provider by email domain.
   */
  async findProviderByEmailDomain(
    tenantId: string,
    email: string
  ): Promise<SSOProvider | null> {
    const providers = await this.getProvidersByTenant(tenantId);

    for (const provider of providers) {
      if (isProviderActive(provider) && isEmailDomainAllowed(provider, email)) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Activate a provider after verification.
   */
  async activateProvider(providerId: string): Promise<SSOProvider> {
    const provider = await this.getProvider(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    provider.status = 'active';
    provider.verifiedAt = new Date();
    provider.updatedAt = new Date();
    this.providers.set(providerId, provider);

    return provider;
  }

  /**
   * Deactivate a provider.
   */
  async deactivateProvider(providerId: string): Promise<SSOProvider> {
    const provider = await this.getProvider(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    provider.status = 'inactive';
    provider.updatedAt = new Date();
    this.providers.set(providerId, provider);

    return provider;
  }

  // ===========================================================================
  // SAML AUTHENTICATION
  // ===========================================================================

  /**
   * Generate SAML authentication request.
   */
  async generateSAMLAuthRequest(
    providerId: string,
    relayState?: string
  ): Promise<SAMLAuthRequest> {
    const provider = await this.getProvider(providerId);
    if (!provider || provider.type !== 'saml' || !provider.samlConfig) {
      throw new Error('Invalid SAML provider');
    }

    if (!isProviderActive(provider)) {
      throw new Error('Provider is not active');
    }

    const config = provider.samlConfig;
    const requestId = `_${uuidv4()}`;

    // Store pending auth state
    this.pendingAuth.set(requestId, { providerId, state: requestId });

    // In production, this would generate a proper SAML AuthnRequest
    // and redirect URL with signed XML
    const params = new URLSearchParams({
      SAMLRequest: this.generateSAMLRequestXML(config, requestId),
      ...(relayState && { RelayState: relayState }),
    });

    return {
      requestId,
      redirectUrl: `${config.ssoUrl}?${params.toString()}`,
      relayState,
    };
  }

  /**
   * Process SAML authentication response.
   */
  async processSAMLResponse(
    samlResponse: string,
    relayState?: string
  ): Promise<SSOAuthResult> {
    try {
      // In production, this would:
      // 1. Decode and validate the SAML Response XML
      // 2. Verify signature using IdP certificate
      // 3. Validate assertions (timestamps, audience, etc.)
      // 4. Extract attributes

      // For demo, simulate a successful response
      const mockResponse: SAMLAuthResponse = {
        nameId: 'user@example.com',
        nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        sessionIndex: `_${uuidv4()}`,
        attributes: {
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      return {
        success: true,
        email: mockResponse.nameId,
        attributes: mockResponse.attributes as Record<string, string>,
        newUser: true, // Would check against existing identities
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SAML authentication failed',
      };
    }
  }

  // ===========================================================================
  // OIDC AUTHENTICATION
  // ===========================================================================

  /**
   * Generate OIDC authorization request.
   */
  async generateOIDCAuthRequest(providerId: string): Promise<OIDCAuthRequest> {
    const provider = await this.getProvider(providerId);
    if (!provider || provider.type !== 'oidc' || !provider.oidcConfig) {
      throw new Error('Invalid OIDC provider');
    }

    if (!isProviderActive(provider)) {
      throw new Error('Provider is not active');
    }

    const config = provider.oidcConfig;
    const state = uuidv4();
    const nonce = uuidv4();

    // Generate PKCE code verifier if enabled
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;

    if (config.usePKCE) {
      codeVerifier = this.generateCodeVerifier();
      codeChallenge = await this.generateCodeChallenge(codeVerifier);
    }

    // Store pending auth state
    this.pendingAuth.set(state, { providerId, state, nonce, codeVerifier });

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: config.responseType,
      scope: config.scopes.join(' '),
      state,
      nonce,
      ...(codeChallenge && { code_challenge: codeChallenge }),
      ...(codeChallenge && { code_challenge_method: 'S256' }),
      ...(config.responseMode && { response_mode: config.responseMode }),
    });

    return {
      state,
      nonce,
      codeVerifier,
      redirectUrl: `${config.authorizationEndpoint}?${params.toString()}`,
    };
  }

  /**
   * Exchange authorization code for tokens.
   */
  async exchangeOIDCCode(
    code: string,
    state: string
  ): Promise<SSOAuthResult> {
    try {
      const pending = this.pendingAuth.get(state);
      if (!pending) {
        return { success: false, error: 'Invalid or expired state' };
      }

      const provider = await this.getProvider(pending.providerId);
      if (!provider || !provider.oidcConfig) {
        return { success: false, error: 'Provider not found' };
      }

      const config = provider.oidcConfig;

      // In production, this would make a POST request to the token endpoint
      // For demo, simulate a successful token response
      const tokenResponse: OIDCTokenResponse = {
        accessToken: `access_${uuidv4()}`,
        refreshToken: `refresh_${uuidv4()}`,
        idToken: `id_${uuidv4()}`,
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      // Fetch user info
      const userInfo: OIDCUserInfo = {
        sub: uuidv4(),
        email: 'user@example.com',
        email_verified: true,
        name: 'John Doe',
        given_name: 'John',
        family_name: 'Doe',
      };

      // Map attributes
      const mappedAttributes = mapAttributes(
        userInfo as Record<string, unknown>,
        provider.attributeMapping
      );

      // Create SSO session
      const session = await this.createSSOSession(
        pending.providerId,
        provider,
        userInfo.sub,
        tokenResponse,
        userInfo
      );

      // Clean up pending auth
      this.pendingAuth.delete(state);

      return {
        success: true,
        email: userInfo.email,
        attributes: mappedAttributes,
        session,
        newUser: true, // Would check against existing identities
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OIDC authentication failed',
      };
    }
  }

  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================

  /**
   * Get SSO session by ID.
   */
  async getSession(sessionId: string): Promise<SSOSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Revoke SSO session.
   */
  async revokeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'revoked';
      session.revokedAt = new Date();
      this.sessions.set(sessionId, session);
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private async createSSOSession(
    providerId: string,
    provider: SSOProvider,
    externalId: string,
    tokens: OIDCTokenResponse,
    userInfo: OIDCUserInfo
  ): Promise<SSOSession> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tokens.expiresIn * 1000);

    const session: SSOSession = {
      id: uuidv4(),
      identityId: '', // Would be set after identity lookup/creation
      tenantId: provider.tenantId,
      providerId,
      providerType: provider.type,
      providerName: provider.name,
      externalSessionId: externalId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      tokenExpiresAt: expiresAt,
      attributes: userInfo as Record<string, unknown>,
      status: 'active',
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
      revokedAt: null,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  private generateSAMLRequestXML(config: SAMLConfig, requestId: string): string {
    // In production, generate proper XML with signature
    // For demo, return base64 encoded placeholder
    const xml = `<samlp:AuthnRequest ID="${requestId}" Version="2.0" IssueInstant="${new Date().toISOString()}" Destination="${config.ssoUrl}"><saml:Issuer>${config.spEntityId}</saml:Issuer></samlp:AuthnRequest>`;
    return Buffer.from(xml).toString('base64');
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hash));
  }

  private base64UrlEncode(buffer: Uint8Array): string {
    const base64 = Buffer.from(buffer).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createSSOService(): SSOService {
  return new SSOService();
}
