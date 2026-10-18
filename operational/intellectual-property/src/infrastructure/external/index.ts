/**
 * External Service Integrations
 *
 * Exports all external service integrations for the intellectual property service.
 *
 * @module infrastructure/external
 */

// Configuration
export {
  externalIntegrationConfig,
  getUSPTOClientConfig,
  getUSPTOSyncConfig,
  getUSPTOWebhookConfig,
  isServiceConfigured,
  validateExternalConfig,
  ENV_VARS,
  type ExternalIntegrationConfig,
  type USPTOConfig,
  type PatentOfficeConfig,
  type DomainRegistrarConfig,
  type RetryPolicy,
  type RateLimitConfig,
} from './external-integration.config.js';

// USPTO PAIR & TEAS Integration
export * from './uspto/index.js';

// WIPO Madrid Monitor Integration
export * from './wipo/index.js';
