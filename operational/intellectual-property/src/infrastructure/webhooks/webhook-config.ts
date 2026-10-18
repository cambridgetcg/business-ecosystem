/**
 * Webhook Configuration
 *
 * Configuration for supported webhook providers including
 * secret keys, payload mappings, and validation rules.
 *
 * @module infrastructure/webhooks
 */

import type {
  WebhookProvider,
  SignatureAlgorithm,
  PatentWatchAlert,
  TrademarkWatchAlert,
  DomainWatchAlert,
  LitigationAlert,
} from './webhook-types.js';

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Get environment variable with fallback.
 */
function getEnvVar(key: string, defaultValue = ''): string {
  return process.env[key] ?? defaultValue;
}

// ============================================================================
// Provider Configuration Types
// ============================================================================

/**
 * Webhook provider configuration.
 */
export interface WebhookProviderConfig {
  /** Provider identifier */
  provider: WebhookProvider;
  /** Provider display name */
  name: string;
  /** Whether this provider is enabled */
  enabled: boolean;
  /** Secret key for signature verification */
  secretKey: string;
  /** Signature algorithm used */
  signatureAlgorithm: SignatureAlgorithm;
  /** Header name for signature */
  signatureHeader: string;
  /** Header name for timestamp (for replay protection) */
  timestampHeader?: string;
  /** Maximum age of webhook in seconds (replay protection) */
  maxAgeSeconds: number;
  /** Field mappings for normalizing payloads */
  fieldMappings?: Record<string, string>;
  /** Custom headers to expect */
  expectedHeaders?: string[];
}

/**
 * Payload mapper function type.
 */
export type PayloadMapper<T> = (raw: Record<string, unknown>, provider: WebhookProvider) => T;

// ============================================================================
// Provider Configurations
// ============================================================================

/**
 * Provider configurations loaded from environment.
 */
export const PROVIDER_CONFIGS: Record<WebhookProvider, WebhookProviderConfig> = {
  anaqua: {
    provider: 'anaqua',
    name: 'Anaqua',
    enabled: Boolean(getEnvVar('WEBHOOK_ANAQUA_SECRET')),
    secretKey: getEnvVar('WEBHOOK_ANAQUA_SECRET'),
    signatureAlgorithm: 'hmac-sha256',
    signatureHeader: 'X-Anaqua-Signature',
    timestampHeader: 'X-Anaqua-Timestamp',
    maxAgeSeconds: 300,
    fieldMappings: {
      'event_id': 'eventId',
      'event_type': 'eventType',
      'created_at': 'timestamp',
    },
  },

  clarivate: {
    provider: 'clarivate',
    name: 'Clarivate (Derwent)',
    enabled: Boolean(getEnvVar('WEBHOOK_CLARIVATE_SECRET')),
    secretKey: getEnvVar('WEBHOOK_CLARIVATE_SECRET'),
    signatureAlgorithm: 'hmac-sha256',
    signatureHeader: 'X-Clarivate-Signature',
    timestampHeader: 'X-Clarivate-Timestamp',
    maxAgeSeconds: 300,
    fieldMappings: {
      'alertId': 'eventId',
      'alertType': 'eventType',
      'alertTimestamp': 'timestamp',
    },
  },

  trademarknow: {
    provider: 'trademarknow',
    name: 'TrademarkNow',
    enabled: Boolean(getEnvVar('WEBHOOK_TRADEMARKNOW_SECRET')),
    secretKey: getEnvVar('WEBHOOK_TRADEMARKNOW_SECRET'),
    signatureAlgorithm: 'hmac-sha256',
    signatureHeader: 'X-TrademarkNow-Signature',
    maxAgeSeconds: 300,
    fieldMappings: {
      'id': 'eventId',
      'type': 'eventType',
      'timestamp': 'timestamp',
    },
  },

  markmonitor: {
    provider: 'markmonitor',
    name: 'MarkMonitor',
    enabled: Boolean(getEnvVar('WEBHOOK_MARKMONITOR_SECRET')),
    secretKey: getEnvVar('WEBHOOK_MARKMONITOR_SECRET'),
    signatureAlgorithm: 'hmac-sha256',
    signatureHeader: 'X-MarkMonitor-Signature',
    timestampHeader: 'X-MarkMonitor-Timestamp',
    maxAgeSeconds: 300,
  },

  corsearch: {
    provider: 'corsearch',
    name: 'Corsearch',
    enabled: Boolean(getEnvVar('WEBHOOK_CORSEARCH_SECRET')),
    secretKey: getEnvVar('WEBHOOK_CORSEARCH_SECRET'),
    signatureAlgorithm: 'hmac-sha256',
    signatureHeader: 'X-Corsearch-Signature',
    maxAgeSeconds: 300,
  },

  brandshelter: {
    provider: 'brandshelter',
    name: 'BrandShelter',
    enabled: Boolean(getEnvVar('WEBHOOK_BRANDSHELTER_SECRET')),
    secretKey: getEnvVar('WEBHOOK_BRANDSHELTER_SECRET'),
    signatureAlgorithm: 'hmac-sha256',
    signatureHeader: 'X-BrandShelter-Signature',
    maxAgeSeconds: 300,
  },

  compumark: {
    provider: 'compumark',
    name: 'CompuMark',
    enabled: Boolean(getEnvVar('WEBHOOK_COMPUMARK_SECRET')),
    secretKey: getEnvVar('WEBHOOK_COMPUMARK_SECRET'),
    signatureAlgorithm: 'hmac-sha256',
    signatureHeader: 'X-CompuMark-Signature',
    maxAgeSeconds: 300,
  },

  darts_ip: {
    provider: 'darts_ip',
    name: 'Darts-IP',
    enabled: Boolean(getEnvVar('WEBHOOK_DARTS_IP_SECRET')),
    secretKey: getEnvVar('WEBHOOK_DARTS_IP_SECRET'),
    signatureAlgorithm: 'hmac-sha256',
    signatureHeader: 'X-DartsIP-Signature',
    maxAgeSeconds: 300,
  },

  custom: {
    provider: 'custom',
    name: 'Custom Provider',
    enabled: Boolean(getEnvVar('WEBHOOK_CUSTOM_SECRET')),
    secretKey: getEnvVar('WEBHOOK_CUSTOM_SECRET'),
    signatureAlgorithm: 'hmac-sha256',
    signatureHeader: 'X-Webhook-Signature',
    timestampHeader: 'X-Webhook-Timestamp',
    maxAgeSeconds: 300,
  },
};

// ============================================================================
// Get Provider Config
// ============================================================================

/**
 * Get configuration for a specific provider.
 */
export function getProviderConfig(provider: WebhookProvider): WebhookProviderConfig | null {
  const config = PROVIDER_CONFIGS[provider];
  if (!config || !config.enabled) {
    return null;
  }
  return config;
}

/**
 * Get all enabled providers.
 */
export function getEnabledProviders(): WebhookProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS).filter(config => config.enabled);
}

/**
 * Determine provider from headers.
 */
export function detectProviderFromHeaders(headers: Record<string, string | undefined>): WebhookProvider | null {
  // Check each provider's signature header
  for (const config of Object.values(PROVIDER_CONFIGS)) {
    if (config.enabled && headers[config.signatureHeader.toLowerCase()]) {
      return config.provider;
    }
  }

  // Check for generic provider header
  const providerHeader = headers['x-webhook-provider'];
  if (providerHeader && providerHeader in PROVIDER_CONFIGS) {
    return providerHeader as WebhookProvider;
  }

  return null;
}

// ============================================================================
// Payload Mappings
// ============================================================================

/**
 * Apply field mappings to normalize payload.
 */
export function applyFieldMappings(
  payload: Record<string, unknown>,
  mappings: Record<string, string> | undefined
): Record<string, unknown> {
  if (!mappings) {
    return payload;
  }

  const normalized = { ...payload };

  for (const [source, target] of Object.entries(mappings)) {
    if (source in payload && !(target in normalized)) {
      normalized[target] = payload[source];
    }
  }

  return normalized;
}

// ============================================================================
// Default Patent Watch Mapper
// ============================================================================

/**
 * Map raw payload to PatentWatchAlert.
 */
export const mapToPatentWatchAlert: PayloadMapper<Partial<PatentWatchAlert>> = (raw, provider) => {
  const config = PROVIDER_CONFIGS[provider];
  const normalized = applyFieldMappings(raw, config?.fieldMappings);

  return {
    eventId: String(normalized.eventId ?? normalized.id ?? normalized.alertId ?? ''),
    eventType: String(normalized.eventType ?? normalized.type ?? normalized.webhookType ?? ''),
    timestamp: String(normalized.timestamp ?? normalized.createdAt ?? normalized.alertTimestamp ?? new Date().toISOString()),
    provider,
    alertType: normalized.alertType as PatentWatchAlert['alertType'],
    patent: normalized.patent as PatentWatchAlert['patent'],
    relatedPatent: normalized.relatedPatent as PatentWatchAlert['relatedPatent'],
    watchProfileId: normalized.watchProfileId as string | undefined,
    watchProfileName: normalized.watchProfileName as string | undefined,
    matchedKeywords: normalized.matchedKeywords as string[] | undefined,
    matchedClassifications: normalized.matchedClassifications as string[] | undefined,
    matchedCompetitor: normalized.matchedCompetitor as string | undefined,
    relevanceScore: normalized.relevanceScore as number | undefined,
    providerAlertId: String(normalized.providerAlertId ?? normalized.alertId ?? normalized.id ?? ''),
    metadata: normalized.metadata as Record<string, unknown> | undefined,
  };
};

// ============================================================================
// Default Trademark Watch Mapper
// ============================================================================

/**
 * Map raw payload to TrademarkWatchAlert.
 */
export const mapToTrademarkWatchAlert: PayloadMapper<Partial<TrademarkWatchAlert>> = (raw, provider) => {
  const config = PROVIDER_CONFIGS[provider];
  const normalized = applyFieldMappings(raw, config?.fieldMappings);

  return {
    eventId: String(normalized.eventId ?? normalized.id ?? normalized.alertId ?? ''),
    eventType: String(normalized.eventType ?? normalized.type ?? normalized.webhookType ?? ''),
    timestamp: String(normalized.timestamp ?? normalized.createdAt ?? normalized.alertTimestamp ?? new Date().toISOString()),
    provider,
    alertType: normalized.alertType as TrademarkWatchAlert['alertType'],
    trademark: normalized.trademark as TrademarkWatchAlert['trademark'],
    monitoredMark: normalized.monitoredMark as TrademarkWatchAlert['monitoredMark'],
    similarity: normalized.similarity as TrademarkWatchAlert['similarity'],
    watchProfileId: normalized.watchProfileId as string | undefined,
    watchProfileName: normalized.watchProfileName as string | undefined,
    deadlineDate: normalized.deadlineDate as string | undefined,
    providerAlertId: String(normalized.providerAlertId ?? normalized.alertId ?? normalized.id ?? ''),
    metadata: normalized.metadata as Record<string, unknown> | undefined,
  };
};

// ============================================================================
// Default Domain Watch Mapper
// ============================================================================

/**
 * Map raw payload to DomainWatchAlert.
 */
export const mapToDomainWatchAlert: PayloadMapper<Partial<DomainWatchAlert>> = (raw, provider) => {
  const config = PROVIDER_CONFIGS[provider];
  const normalized = applyFieldMappings(raw, config?.fieldMappings);

  return {
    eventId: String(normalized.eventId ?? normalized.id ?? normalized.alertId ?? ''),
    eventType: String(normalized.eventType ?? normalized.type ?? normalized.webhookType ?? ''),
    timestamp: String(normalized.timestamp ?? normalized.createdAt ?? normalized.alertTimestamp ?? new Date().toISOString()),
    provider,
    alertType: normalized.alertType as DomainWatchAlert['alertType'],
    domain: normalized.domain as DomainWatchAlert['domain'],
    protectedAsset: normalized.protectedAsset as DomainWatchAlert['protectedAsset'],
    similarityScore: normalized.similarityScore as number | undefined,
    detectionMethod: normalized.detectionMethod as string | undefined,
    riskLevel: normalized.riskLevel as DomainWatchAlert['riskLevel'],
    recommendedAction: normalized.recommendedAction as string | undefined,
    watchProfileId: normalized.watchProfileId as string | undefined,
    providerAlertId: String(normalized.providerAlertId ?? normalized.alertId ?? normalized.id ?? ''),
    metadata: normalized.metadata as Record<string, unknown> | undefined,
  };
};

// ============================================================================
// Default Litigation Alert Mapper
// ============================================================================

/**
 * Map raw payload to LitigationAlert.
 */
export const mapToLitigationAlert: PayloadMapper<Partial<LitigationAlert>> = (raw, provider) => {
  const config = PROVIDER_CONFIGS[provider];
  const normalized = applyFieldMappings(raw, config?.fieldMappings);

  return {
    eventId: String(normalized.eventId ?? normalized.id ?? normalized.alertId ?? ''),
    eventType: String(normalized.eventType ?? normalized.type ?? normalized.webhookType ?? ''),
    timestamp: String(normalized.timestamp ?? normalized.createdAt ?? normalized.alertTimestamp ?? new Date().toISOString()),
    provider,
    alertType: normalized.alertType as LitigationAlert['alertType'],
    case: normalized.case as LitigationAlert['case'],
    docketEntry: normalized.docketEntry as LitigationAlert['docketEntry'],
    watchProfileId: normalized.watchProfileId as string | undefined,
    watchProfileName: normalized.watchProfileName as string | undefined,
    relatedAssets: normalized.relatedAssets as LitigationAlert['relatedAssets'],
    importance: normalized.importance as LitigationAlert['importance'],
    providerAlertId: String(normalized.providerAlertId ?? normalized.alertId ?? normalized.id ?? ''),
    metadata: normalized.metadata as Record<string, unknown> | undefined,
  };
};

// ============================================================================
// Export All
// ============================================================================

export const webhookConfig = {
  providers: PROVIDER_CONFIGS,
  getProviderConfig,
  getEnabledProviders,
  detectProviderFromHeaders,
  applyFieldMappings,
  mappers: {
    patent: mapToPatentWatchAlert,
    trademark: mapToTrademarkWatchAlert,
    domain: mapToDomainWatchAlert,
    litigation: mapToLitigationAlert,
  },
};

export default webhookConfig;
