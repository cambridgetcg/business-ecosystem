/**
 * WIPO Madrid Monitor Integration Module
 *
 * Provides integration with the WIPO Madrid Monitor API for tracking
 * international trademark registrations under the Madrid Protocol.
 *
 * Features:
 * - Search and monitor international registrations
 * - Track designation status per country
 * - Detect central attack notifications
 * - Monitor renewal deadlines
 * - Map WIPO events to domain events
 *
 * @module infrastructure/external/wipo
 */

// Types
export * from './madrid-types.js';

// Client
export {
  WIPOMadridClient,
  wipoMadridClient,
  WIPOAPIException,
} from './madrid-client.js';

// Sync Service
export {
  WIPOMadridSyncService,
  wipoMadridSyncService,
  type TrackedRegistration,
  type SyncJobConfig,
} from './madrid-sync.service.js';

// Event Mapper
export {
  WIPOMadridEventMapper,
  wipoMadridEventMapper,
  type MadridDomainAction,
  type EventMappingResult,
} from './madrid-event-mapper.js';
