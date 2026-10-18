/**
 * USPTO PAIR Integration - Public API
 *
 * Exports for USPTO Patent Application Information Retrieval integration.
 *
 * @module infrastructure/external/uspto
 */

// Types
export type {
  // Status types
  PatentApplicationStatus,
  EntitySize,
  OfficeActionType,
  ResponseStatus,
  MaintenanceFeeWindow,
  MaintenanceFeePaymentStatus,
  ProsecutionEventType,

  // Data structures
  PatentApplicationSummary,
  OfficeAction,
  CitedReference,
  ProsecutionEvent,
  PatentProsecutionHistory,
  PatentGrant,
  PatentInventor,
  PatentAssignee,
  PatentGrantClaim,
  PatentClassification,
  PatentCitation,
  MaintenanceFeeStatus,
  MaintenanceFee,
  MaintenanceFeeAmount,

  // Search types
  PairSearchResult,
  PairSearchFilters,

  // Error types
  PairErrorCode,
  PairApiError,

  // Sync detection types
  StatusChangeDetected,
  OfficeActionDetected,
  GrantDetected,
  PublicationDetected,
  AbandonmentDetected,
  MaintenanceFeeWindowOpened,
  PairSyncResult,

  // Configuration
  PairClientConfig,
} from './pair-types.js';

export {
  DEFAULT_PAIR_CONFIG,
  MAINTENANCE_FEE_SCHEDULE,
  SURCHARGE_AMOUNTS,
} from './pair-types.js';

// Client
export {
  USPTOPairClient,
  usptoPairClient,
} from './pair-client.js';

// Event Mapper
export type {
  USPTODomainEventType,
  USPTODomainEvent,
  DeadlineToCreate,
  NotificationToSend,
  EventMappingResult,
} from './pair-event-mapper.js';

export {
  USPTOPairEventMapper,
  createEventMapper,
  usptoPairEventMapper,
} from './pair-event-mapper.js';

// Sync Service
export type {
  TrackedPatent,
  TrackedPatentRepository,
  USPTOEventPublisher,
  DeadlineService,
  NotificationService,
  SyncServiceConfig,
} from './pair-sync.service.js';

export {
  USPTOPairSyncService,
  createUSPTOPairSyncService,
  DEFAULT_SYNC_CONFIG,
} from './pair-sync.service.js';

// ========================================
// TEAS (Trademark) Integration
// ========================================

// TEAS Types
export type {
  USPTOApplicationStatus as TeasApplicationStatus,
  USPTOMarkType,
  USPTOActionType as TeasActionType,
  OfficeAction as TeasOfficeAction,
  USPTOClassification,
  USPTOCorrespondent,
  USPTOAttorney,
  PublicationDetails,
  MaintenanceFiling,
  TrademarkApplicationStatus,
  TrademarkRegistration,
  USPTOSearchResult,
  USPTOSearchQuery,
  USPTOApiResponse,
  StatusChangeDetection,
  SyncResult as TeasSyncResult,
  USPTOWebhookEvent,
} from './teas-types.js';

// TEAS Client
export {
  USPTOTeasClient,
  createUSPTOTeasClient,
  type USPTOTeasClientConfig,
} from './teas-client.js';

// TEAS Sync Service
export {
  USPTOSyncService,
  createUSPTOSyncService,
  type USPTOSyncServiceConfig,
  type TrackedTrademark,
} from './teas-sync.service.js';

// TEAS Webhook Handler
export {
  USPTOWebhookHandler,
  createUSPTOWebhookHandler,
  type USPTOWebhookHandlerConfig,
  type WebhookProcessingResult,
} from './teas-webhook-handler.js';
