/**
 * Webhooks Infrastructure - Public API
 *
 * Exports for webhook validation, configuration, and types.
 *
 * @module infrastructure/webhooks
 */

// Types
export type {
  WebhookProvider,
  SignatureAlgorithm,
  BaseWebhookPayload,
  WebhookProcessingResult,
  PatentWatchAlertType,
  PatentAlertInfo,
  PatentClassification,
  AssigneeInfo,
  PriorityClaim,
  PatentWatchAlert,
  TrademarkWatchAlertType,
  TrademarkAlertInfo,
  GoodsServicesEntry,
  SimilarityAnalysis,
  TrademarkWatchAlert,
  DomainWatchAlertType,
  DomainAlertInfo,
  DomainWatchAlert,
  LitigationAlertType,
  LitigationParty,
  LitigationCaseInfo,
  DocketEntry,
  LitigationAlert,
  WebhookAlert,
} from './webhook-types.js';

// Type guards
export {
  isPatentWatchAlert,
  isTrademarkWatchAlert,
  isDomainWatchAlert,
  isLitigationAlert,
} from './webhook-types.js';

// Configuration
export type {
  WebhookProviderConfig,
  PayloadMapper,
} from './webhook-config.js';

export {
  PROVIDER_CONFIGS,
  getProviderConfig,
  getEnabledProviders,
  detectProviderFromHeaders,
  applyFieldMappings,
  mapToPatentWatchAlert,
  mapToTrademarkWatchAlert,
  mapToDomainWatchAlert,
  mapToLitigationAlert,
  webhookConfig,
} from './webhook-config.js';

// Validator
export type {
  SignatureValidationResult,
  PayloadValidationResult,
} from './webhook-validator.js';

export {
  WebhookValidator,
  webhookValidator,
  patentWatchAlertSchema,
  trademarkWatchAlertSchema,
  domainWatchAlertSchema,
  litigationAlertSchema,
} from './webhook-validator.js';
