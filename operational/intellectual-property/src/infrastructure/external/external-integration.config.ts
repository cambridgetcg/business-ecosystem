/**
 * External Integration Configuration
 *
 * Centralized configuration for external API integrations.
 * Values loaded from environment or defaults for development.
 *
 * @module infrastructure/external
 */

const environment = process.env.NODE_ENV ?? 'development';

/**
 * Retry policy configuration.
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  baseDelayMs: number;
  /** Maximum delay between retries (ms) */
  maxDelayMs: number;
  /** HTTP status codes that trigger retry */
  retryableStatuses: number[];
  /** Whether to retry on network errors */
  retryOnNetworkError: boolean;
}

/**
 * Rate limit configuration.
 */
export interface RateLimitConfig {
  /** Requests per time window */
  requestsPerWindow: number;
  /** Time window size (ms) */
  windowSizeMs: number;
  /** Minimum delay between requests (ms) */
  minRequestIntervalMs: number;
}

/**
 * USPTO TEAS API configuration.
 */
export interface USPTOConfig {
  /** USPTO TSDR API base URL */
  baseUrl: string;
  /** API key (if using API key authentication) */
  apiKey: string | undefined;
  /** OAuth2 client ID (if using OAuth2) */
  clientId: string | undefined;
  /** OAuth2 client secret (if using OAuth2) */
  clientSecret: string | undefined;
  /** Request timeout (ms) */
  timeoutMs: number;
  /** Retry policy */
  retryPolicy: RetryPolicy;
  /** Rate limit configuration */
  rateLimit: RateLimitConfig;
  /** User agent string */
  userAgent: string;
  /** Webhook signing secret */
  webhookSigningSecret: string | undefined;
  /** Sync service configuration */
  sync: {
    /** Enable sync service */
    enabled: boolean;
    /** Minimum interval between syncs (ms) */
    intervalMs: number;
    /** Batch size for sync operations */
    batchSize: number;
    /** Max consecutive errors before disabling sync for a trademark */
    maxConsecutiveErrors: number;
  };
}

/**
 * Patent office API configuration (for future use).
 */
export interface PatentOfficeConfig {
  /** USPTO API configuration */
  uspto: {
    baseUrl: string;
    apiKey: string | undefined;
    timeoutMs: number;
  };
  /** EPO (European Patent Office) configuration */
  epo: {
    baseUrl: string;
    consumerKey: string | undefined;
    consumerSecret: string | undefined;
    timeoutMs: number;
  };
  /** WIPO (World IP Organization) configuration */
  wipo: {
    baseUrl: string;
    apiKey: string | undefined;
    timeoutMs: number;
  };
}

/**
 * Domain registrar API configuration (for future use).
 */
export interface DomainRegistrarConfig {
  /** Default registrar */
  defaultRegistrar: 'godaddy' | 'namecheap' | 'cloudflare';
  /** GoDaddy API configuration */
  godaddy: {
    baseUrl: string;
    apiKey: string | undefined;
    apiSecret: string | undefined;
    timeoutMs: number;
  };
  /** Namecheap API configuration */
  namecheap: {
    baseUrl: string;
    apiUser: string | undefined;
    apiKey: string | undefined;
    timeoutMs: number;
  };
  /** Cloudflare API configuration */
  cloudflare: {
    baseUrl: string;
    apiToken: string | undefined;
    timeoutMs: number;
  };
}

/**
 * Complete external integration configuration.
 */
export interface ExternalIntegrationConfig {
  /** Current environment */
  environment: string;
  /** USPTO configuration */
  uspto: USPTOConfig;
  /** Patent office configuration */
  patentOffices: PatentOfficeConfig;
  /** Domain registrar configuration */
  domainRegistrars: DomainRegistrarConfig;
  /** Global retry policy (can be overridden per-service) */
  globalRetryPolicy: RetryPolicy;
  /** Global rate limit (can be overridden per-service) */
  globalRateLimit: RateLimitConfig;
}

/**
 * Default retry policy.
 */
const defaultRetryPolicy: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryOnNetworkError: true,
};

/**
 * Default rate limit configuration.
 */
const defaultRateLimit: RateLimitConfig = {
  requestsPerWindow: 100,
  windowSizeMs: 60000, // 1 minute
  minRequestIntervalMs: 100,
};

/**
 * External integration configuration.
 */
export const externalIntegrationConfig: ExternalIntegrationConfig = {
  environment,

  // USPTO Configuration
  uspto: {
    baseUrl: process.env.USPTO_API_BASE_URL ?? 'https://tsdrapi.uspto.gov',
    apiKey: process.env.USPTO_API_KEY,
    clientId: process.env.USPTO_CLIENT_ID,
    clientSecret: process.env.USPTO_CLIENT_SECRET,
    timeoutMs: parseInt(process.env.USPTO_TIMEOUT_MS ?? '30000', 10),
    retryPolicy: {
      ...defaultRetryPolicy,
      maxRetries: parseInt(process.env.USPTO_MAX_RETRIES ?? '3', 10),
    },
    rateLimit: {
      ...defaultRateLimit,
      requestsPerWindow: parseInt(process.env.USPTO_RATE_LIMIT ?? '100', 10),
    },
    userAgent: process.env.USPTO_USER_AGENT ?? 'BusinessEcosystem-IP-Service/1.0',
    webhookSigningSecret: process.env.USPTO_WEBHOOK_SECRET,
    sync: {
      enabled: process.env.USPTO_SYNC_ENABLED !== 'false',
      intervalMs: parseInt(process.env.USPTO_SYNC_INTERVAL_MS ?? '3600000', 10), // 1 hour
      batchSize: parseInt(process.env.USPTO_SYNC_BATCH_SIZE ?? '50', 10),
      maxConsecutiveErrors: parseInt(process.env.USPTO_SYNC_MAX_ERRORS ?? '5', 10),
    },
  },

  // Patent Office Configuration
  patentOffices: {
    uspto: {
      baseUrl: process.env.USPTO_PATENT_API_URL ?? 'https://developer.uspto.gov/api',
      apiKey: process.env.USPTO_PATENT_API_KEY,
      timeoutMs: parseInt(process.env.USPTO_PATENT_TIMEOUT_MS ?? '30000', 10),
    },
    epo: {
      baseUrl: process.env.EPO_API_URL ?? 'https://ops.epo.org/3.2/rest-services',
      consumerKey: process.env.EPO_CONSUMER_KEY,
      consumerSecret: process.env.EPO_CONSUMER_SECRET,
      timeoutMs: parseInt(process.env.EPO_TIMEOUT_MS ?? '30000', 10),
    },
    wipo: {
      baseUrl: process.env.WIPO_API_URL ?? 'https://patentscope.wipo.int/search/en/api',
      apiKey: process.env.WIPO_API_KEY,
      timeoutMs: parseInt(process.env.WIPO_TIMEOUT_MS ?? '30000', 10),
    },
  },

  // Domain Registrar Configuration
  domainRegistrars: {
    defaultRegistrar: (process.env.DEFAULT_REGISTRAR as 'godaddy' | 'namecheap' | 'cloudflare') ?? 'godaddy',
    godaddy: {
      baseUrl: process.env.GODADDY_API_URL ?? 'https://api.godaddy.com',
      apiKey: process.env.GODADDY_API_KEY,
      apiSecret: process.env.GODADDY_API_SECRET,
      timeoutMs: parseInt(process.env.GODADDY_TIMEOUT_MS ?? '30000', 10),
    },
    namecheap: {
      baseUrl: process.env.NAMECHEAP_API_URL ?? 'https://api.namecheap.com/xml.response',
      apiUser: process.env.NAMECHEAP_API_USER,
      apiKey: process.env.NAMECHEAP_API_KEY,
      timeoutMs: parseInt(process.env.NAMECHEAP_TIMEOUT_MS ?? '30000', 10),
    },
    cloudflare: {
      baseUrl: process.env.CLOUDFLARE_API_URL ?? 'https://api.cloudflare.com/client/v4',
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
      timeoutMs: parseInt(process.env.CLOUDFLARE_TIMEOUT_MS ?? '30000', 10),
    },
  },

  // Global defaults
  globalRetryPolicy: defaultRetryPolicy,
  globalRateLimit: defaultRateLimit,
};

/**
 * Get USPTO client configuration.
 */
export function getUSPTOClientConfig(): {
  baseUrl: string;
  apiKey?: string | undefined;
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  userAgent: string;
} {
  const config = externalIntegrationConfig.uspto;
  return {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    timeoutMs: config.timeoutMs,
    maxRetries: config.retryPolicy.maxRetries,
    retryBaseDelayMs: config.retryPolicy.baseDelayMs,
    retryMaxDelayMs: config.retryPolicy.maxDelayMs,
    userAgent: config.userAgent,
  };
}

/**
 * Get USPTO sync service configuration.
 */
export function getUSPTOSyncConfig(): {
  usptoClientConfig: ReturnType<typeof getUSPTOClientConfig>;
  minSyncIntervalMs: number;
  batchSize: number;
  maxConsecutiveErrors: number;
  enabled: boolean;
} {
  const config = externalIntegrationConfig.uspto;
  return {
    usptoClientConfig: getUSPTOClientConfig(),
    minSyncIntervalMs: config.sync.intervalMs,
    batchSize: config.sync.batchSize,
    maxConsecutiveErrors: config.sync.maxConsecutiveErrors,
    enabled: config.sync.enabled,
  };
}

/**
 * Get USPTO webhook handler configuration.
 */
export function getUSPTOWebhookConfig(): {
  signingSecret: string;
  allowedSourceIps: string[];
  maxEventAgeMs: number;
  enabled: boolean;
} {
  return {
    signingSecret: externalIntegrationConfig.uspto.webhookSigningSecret ?? '',
    allowedSourceIps: process.env.USPTO_WEBHOOK_ALLOWED_IPS?.split(',') ?? [],
    maxEventAgeMs: parseInt(process.env.USPTO_WEBHOOK_MAX_AGE_MS ?? '300000', 10),
    enabled: process.env.USPTO_WEBHOOK_ENABLED !== 'false',
  };
}

/**
 * Check if a service is configured and ready to use.
 */
export function isServiceConfigured(
  service: 'uspto' | 'epo' | 'wipo' | 'godaddy' | 'namecheap' | 'cloudflare'
): boolean {
  switch (service) {
    case 'uspto':
      return !!(externalIntegrationConfig.uspto.apiKey || externalIntegrationConfig.uspto.clientId);
    case 'epo':
      return !!(
        externalIntegrationConfig.patentOffices.epo.consumerKey &&
        externalIntegrationConfig.patentOffices.epo.consumerSecret
      );
    case 'wipo':
      return !!externalIntegrationConfig.patentOffices.wipo.apiKey;
    case 'godaddy':
      return !!(
        externalIntegrationConfig.domainRegistrars.godaddy.apiKey &&
        externalIntegrationConfig.domainRegistrars.godaddy.apiSecret
      );
    case 'namecheap':
      return !!(
        externalIntegrationConfig.domainRegistrars.namecheap.apiUser &&
        externalIntegrationConfig.domainRegistrars.namecheap.apiKey
      );
    case 'cloudflare':
      return !!externalIntegrationConfig.domainRegistrars.cloudflare.apiToken;
    default:
      return false;
  }
}

/**
 * Validate configuration on startup.
 */
export function validateExternalConfig(): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check USPTO configuration
  if (!externalIntegrationConfig.uspto.apiKey && !externalIntegrationConfig.uspto.clientId) {
    warnings.push('USPTO API credentials not configured - using public endpoints only');
  }

  // Check if sync is enabled but USPTO not configured
  if (externalIntegrationConfig.uspto.sync.enabled && !isServiceConfigured('uspto')) {
    warnings.push('USPTO sync enabled but API credentials not configured');
  }

  // Check webhook configuration
  if (process.env.USPTO_WEBHOOK_ENABLED === 'true' && !externalIntegrationConfig.uspto.webhookSigningSecret) {
    errors.push('USPTO webhook enabled but signing secret not configured');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

// Export type-safe environment variable names for documentation
export const ENV_VARS = {
  // USPTO
  USPTO_API_BASE_URL: 'USPTO_API_BASE_URL',
  USPTO_API_KEY: 'USPTO_API_KEY',
  USPTO_CLIENT_ID: 'USPTO_CLIENT_ID',
  USPTO_CLIENT_SECRET: 'USPTO_CLIENT_SECRET',
  USPTO_TIMEOUT_MS: 'USPTO_TIMEOUT_MS',
  USPTO_MAX_RETRIES: 'USPTO_MAX_RETRIES',
  USPTO_RATE_LIMIT: 'USPTO_RATE_LIMIT',
  USPTO_USER_AGENT: 'USPTO_USER_AGENT',
  USPTO_WEBHOOK_SECRET: 'USPTO_WEBHOOK_SECRET',
  USPTO_WEBHOOK_ENABLED: 'USPTO_WEBHOOK_ENABLED',
  USPTO_WEBHOOK_ALLOWED_IPS: 'USPTO_WEBHOOK_ALLOWED_IPS',
  USPTO_SYNC_ENABLED: 'USPTO_SYNC_ENABLED',
  USPTO_SYNC_INTERVAL_MS: 'USPTO_SYNC_INTERVAL_MS',
  USPTO_SYNC_BATCH_SIZE: 'USPTO_SYNC_BATCH_SIZE',
  USPTO_SYNC_MAX_ERRORS: 'USPTO_SYNC_MAX_ERRORS',
  // Patent offices
  USPTO_PATENT_API_URL: 'USPTO_PATENT_API_URL',
  USPTO_PATENT_API_KEY: 'USPTO_PATENT_API_KEY',
  EPO_API_URL: 'EPO_API_URL',
  EPO_CONSUMER_KEY: 'EPO_CONSUMER_KEY',
  EPO_CONSUMER_SECRET: 'EPO_CONSUMER_SECRET',
  WIPO_API_URL: 'WIPO_API_URL',
  WIPO_API_KEY: 'WIPO_API_KEY',
  // Domain registrars
  DEFAULT_REGISTRAR: 'DEFAULT_REGISTRAR',
  GODADDY_API_URL: 'GODADDY_API_URL',
  GODADDY_API_KEY: 'GODADDY_API_KEY',
  GODADDY_API_SECRET: 'GODADDY_API_SECRET',
  NAMECHEAP_API_URL: 'NAMECHEAP_API_URL',
  NAMECHEAP_API_USER: 'NAMECHEAP_API_USER',
  NAMECHEAP_API_KEY: 'NAMECHEAP_API_KEY',
  CLOUDFLARE_API_URL: 'CLOUDFLARE_API_URL',
  CLOUDFLARE_API_TOKEN: 'CLOUDFLARE_API_TOKEN',
} as const;
