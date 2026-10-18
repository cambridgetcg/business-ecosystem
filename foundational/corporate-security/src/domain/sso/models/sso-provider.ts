/**
 * SSO Provider Models
 *
 * Configuration and types for SAML 2.0 and OIDC providers.
 *
 * @module domain/sso/models/sso-provider
 */

import { z } from 'zod';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

export const SSOProviderTypeSchema = z.enum(['saml', 'oidc']);
export type SSOProviderType = z.infer<typeof SSOProviderTypeSchema>;

export const SSOProviderStatusSchema = z.enum([
  'active',
  'inactive',
  'pending_verification',
  'error',
]);
export type SSOProviderStatus = z.infer<typeof SSOProviderStatusSchema>;

// =============================================================================
// SAML CONFIGURATION
// =============================================================================

export const SAMLConfigSchema = z.object({
  // Identity Provider metadata
  entityId: z.string().min(1),
  ssoUrl: z.string().url(),
  sloUrl: z.string().url().optional(),
  certificate: z.string().min(1),

  // Service Provider settings
  spEntityId: z.string().min(1),
  spAcsUrl: z.string().url(),
  spSloUrl: z.string().url().optional(),

  // Signing and encryption
  signRequests: z.boolean().default(true),
  signatureAlgorithm: z.enum([
    'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  ]).default('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'),
  digestAlgorithm: z.enum([
    'http://www.w3.org/2001/04/xmlenc#sha256',
    'http://www.w3.org/2000/09/xmldsig#sha1',
  ]).default('http://www.w3.org/2001/04/xmlenc#sha256'),

  // Name ID
  nameIdFormat: z.enum([
    'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
    'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
  ]).default('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'),

  // Binding
  authnRequestBinding: z.enum(['HTTP-Redirect', 'HTTP-POST']).default('HTTP-Redirect'),

  // Validation
  allowUnencryptedAssertions: z.boolean().default(false),
  wantAssertionsSigned: z.boolean().default(true),
  clockSkewMs: z.number().int().default(60000),
});

export type SAMLConfig = z.infer<typeof SAMLConfigSchema>;

// =============================================================================
// OIDC CONFIGURATION
// =============================================================================

export const OIDCConfigSchema = z.object({
  // Provider endpoints (or discovery URL)
  issuer: z.string().url(),
  authorizationEndpoint: z.string().url(),
  tokenEndpoint: z.string().url(),
  userinfoEndpoint: z.string().url().optional(),
  jwksUri: z.string().url().optional(),
  endSessionEndpoint: z.string().url().optional(),

  // Client credentials
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),

  // Scopes
  scopes: z.array(z.string()).default(['openid', 'email', 'profile']),

  // Response settings
  responseType: z.enum(['code', 'id_token', 'code id_token']).default('code'),
  responseMode: z.enum(['query', 'fragment', 'form_post']).optional(),

  // Token settings
  tokenEndpointAuthMethod: z.enum([
    'client_secret_basic',
    'client_secret_post',
    'private_key_jwt',
    'none',
  ]).default('client_secret_basic'),

  // PKCE
  usePKCE: z.boolean().default(true),

  // Redirect
  redirectUri: z.string().url(),
  postLogoutRedirectUri: z.string().url().optional(),

  // Validation
  clockSkewMs: z.number().int().default(60000),
});

export type OIDCConfig = z.infer<typeof OIDCConfigSchema>;

// =============================================================================
// ATTRIBUTE MAPPING
// =============================================================================

export const AttributeMappingSchema = z.object({
  email: z.string().default('email'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().optional(),
  groups: z.string().optional(),
  roles: z.string().optional(),
  department: z.string().optional(),
  employeeId: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export type AttributeMapping = z.infer<typeof AttributeMappingSchema>;

// =============================================================================
// SSO PROVIDER
// =============================================================================

export const SSOProviderSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Basic info
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: SSOProviderTypeSchema,
  status: SSOProviderStatusSchema.default('pending_verification'),

  // Configuration (one of these based on type)
  samlConfig: SAMLConfigSchema.optional(),
  oidcConfig: OIDCConfigSchema.optional(),

  // Attribute mapping
  attributeMapping: AttributeMappingSchema.default({}),

  // Domain restrictions
  emailDomains: z.array(z.string()).optional(),
  allowedDomains: z.array(z.string()).optional(),

  // Provisioning
  autoProvision: z.boolean().default(true),
  defaultRoleId: z.string().uuid().optional(),

  // Session settings
  forceReauthentication: z.boolean().default(false),
  sessionTimeout: z.number().int().optional(),

  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
  lastUsedAt: z.date().nullable().optional(),
  verifiedAt: z.date().nullable().optional(),

  // Metadata
  metadata: z.record(z.unknown()).optional(),
});

export type SSOProvider = z.infer<typeof SSOProviderSchema>;

// =============================================================================
// SSO SESSION
// =============================================================================

export const SSOSessionSchema = z.object({
  id: z.string().uuid(),
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  providerId: z.string().uuid(),

  // Provider info
  providerType: SSOProviderTypeSchema,
  providerName: z.string(),

  // Session details
  externalSessionId: z.string().optional(),
  nameId: z.string().optional(),
  nameIdFormat: z.string().optional(),

  // Tokens (OIDC)
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  idToken: z.string().optional(),
  tokenExpiresAt: z.date().optional(),

  // User attributes from provider
  attributes: z.record(z.unknown()).optional(),

  // Status
  status: z.enum(['active', 'expired', 'revoked']).default('active'),

  // Timestamps
  createdAt: z.date(),
  expiresAt: z.date(),
  lastActivityAt: z.date(),
  revokedAt: z.date().nullable().optional(),
});

export type SSOSession = z.infer<typeof SSOSessionSchema>;

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

export const CreateSSOProviderInputSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: SSOProviderTypeSchema,
  samlConfig: SAMLConfigSchema.optional(),
  oidcConfig: OIDCConfigSchema.optional(),
  attributeMapping: AttributeMappingSchema.optional(),
  emailDomains: z.array(z.string()).optional(),
  autoProvision: z.boolean().default(true),
  defaultRoleId: z.string().uuid().optional(),
});

export type CreateSSOProviderInput = z.infer<typeof CreateSSOProviderInputSchema>;

// =============================================================================
// DOMAIN FUNCTIONS
// =============================================================================

/**
 * Check if a provider is ready for use.
 */
export function isProviderActive(provider: SSOProvider): boolean {
  return provider.status === 'active';
}

/**
 * Check if an email domain is allowed for this provider.
 */
export function isEmailDomainAllowed(
  provider: SSOProvider,
  email: string
): boolean {
  if (!provider.emailDomains || provider.emailDomains.length === 0) {
    return true;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  return provider.emailDomains.some(d => d.toLowerCase() === domain);
}

/**
 * Map external attributes to internal identity attributes.
 */
export function mapAttributes(
  externalAttributes: Record<string, unknown>,
  mapping: AttributeMapping
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};

  const getValue = (key: string): string | undefined => {
    const value = externalAttributes[key];
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return undefined;
  };

  if (mapping.email) result.email = getValue(mapping.email);
  if (mapping.firstName) result.firstName = getValue(mapping.firstName);
  if (mapping.lastName) result.lastName = getValue(mapping.lastName);
  if (mapping.displayName) result.displayName = getValue(mapping.displayName);
  if (mapping.department) result.department = getValue(mapping.department);
  if (mapping.employeeId) result.employeeId = getValue(mapping.employeeId);
  if (mapping.phoneNumber) result.phoneNumber = getValue(mapping.phoneNumber);

  return result;
}

/**
 * Validate provider configuration completeness.
 */
export function validateProviderConfig(provider: SSOProvider): string[] {
  const errors: string[] = [];

  if (provider.type === 'saml' && !provider.samlConfig) {
    errors.push('SAML configuration is required for SAML providers');
  }

  if (provider.type === 'oidc' && !provider.oidcConfig) {
    errors.push('OIDC configuration is required for OIDC providers');
  }

  if (provider.type === 'saml' && provider.samlConfig) {
    if (!provider.samlConfig.entityId) errors.push('SAML entityId is required');
    if (!provider.samlConfig.ssoUrl) errors.push('SAML ssoUrl is required');
    if (!provider.samlConfig.certificate) errors.push('SAML certificate is required');
  }

  if (provider.type === 'oidc' && provider.oidcConfig) {
    if (!provider.oidcConfig.issuer) errors.push('OIDC issuer is required');
    if (!provider.oidcConfig.clientId) errors.push('OIDC clientId is required');
    if (!provider.oidcConfig.clientSecret) errors.push('OIDC clientSecret is required');
    if (!provider.oidcConfig.redirectUri) errors.push('OIDC redirectUri is required');
  }

  return errors;
}
