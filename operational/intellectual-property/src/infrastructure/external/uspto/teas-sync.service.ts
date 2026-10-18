/**
 * USPTO Sync Service
 *
 * Polls USPTO for status updates on tracked trademarks,
 * detects changes, and emits domain events.
 *
 * @module infrastructure/external/uspto
 */

import { randomUUID } from 'crypto';
import { USPTOTeasClient, type USPTOTeasClientConfig } from './teas-client.js';
import type {
  TrademarkApplicationStatus,
  USPTOApplicationStatus,
  StatusChangeDetection,
  SyncResult,
  OfficeAction,
  MaintenanceFiling,
} from './teas-types.js';
import type { DomainEvent } from '../../../domain/events/domain-event.js';
import type { IPEventPublisher } from '../../messaging/event-publisher.js';
import { InMemoryEventPublisher } from '../../messaging/event-publisher.js';
import type { TrademarkRepository } from '../../persistence/trademark.repository.js';
import { Trademark } from '../../../domain/entities/trademark.entity.js';

/**
 * Tracked trademark record for sync comparison.
 */
export interface TrackedTrademark {
  /** Internal ID */
  id: string;
  /** USPTO serial number */
  serialNumber: string;
  /** Last known USPTO status */
  lastKnownStatus: USPTOApplicationStatus;
  /** Last synced timestamp */
  lastSyncedAt: Date;
  /** Whether sync is enabled */
  syncEnabled: boolean;
  /** Number of consecutive sync errors */
  syncErrorCount: number;
  /** Last sync error message */
  lastSyncError: string | undefined;
  /** USPTO data snapshot (last known state) */
  usptpSnapshot: TrademarkApplicationStatus | undefined;
}

/**
 * Sync service configuration.
 */
export interface USPTOSyncServiceConfig {
  /** USPTO client configuration */
  usptoClientConfig: Partial<USPTOTeasClientConfig>;
  /** Minimum interval between syncs (ms) */
  minSyncIntervalMs: number;
  /** Maximum syncs per batch */
  batchSize: number;
  /** Max consecutive errors before disabling sync */
  maxConsecutiveErrors: number;
  /** Enable sync (can be disabled for testing) */
  enabled: boolean;
}

/**
 * Default sync configuration.
 */
const DEFAULT_SYNC_CONFIG: USPTOSyncServiceConfig = {
  usptoClientConfig: {},
  minSyncIntervalMs: 3600000, // 1 hour
  batchSize: 50,
  maxConsecutiveErrors: 5,
  enabled: true,
};

/**
 * USPTO Sync Service
 *
 * Responsibilities:
 * 1. Poll USPTO for status updates on tracked trademarks
 * 2. Compare with local database and detect changes
 * 3. Emit events when status changes (filed -> published -> registered)
 * 4. Handle office actions (create deadlines for responses)
 * 5. Schedule periodic sync jobs
 */
export class USPTOSyncService {
  private readonly client: USPTOTeasClient;
  private readonly config: USPTOSyncServiceConfig;
  private readonly trackedTrademarks: Map<string, TrackedTrademark>;
  private syncInProgress: boolean = false;
  private lastSyncRun: Date | undefined;
  private nextScheduledSync: Date | undefined;
  private syncTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly eventPublisher: IPEventPublisher = new InMemoryEventPublisher(),
    private readonly trademarkRepository?: TrademarkRepository | undefined,
    config: Partial<USPTOSyncServiceConfig> = {}
  ) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.client = new USPTOTeasClient(this.config.usptoClientConfig);
    this.trackedTrademarks = new Map();
  }

  /**
   * Initialize the sync service.
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[USPTOSyncService] Sync service is disabled');
      return;
    }

    await this.client.authenticate();
    console.log('[USPTOSyncService] Initialized and authenticated');
  }

  /**
   * Start periodic sync scheduling.
   */
  startPeriodicSync(): void {
    if (!this.config.enabled) {
      console.log('[USPTOSyncService] Periodic sync not started - service is disabled');
      return;
    }

    this.scheduleNextSync();
    console.log('[USPTOSyncService] Periodic sync started');
  }

  /**
   * Stop periodic sync scheduling.
   */
  stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = undefined;
    }
    console.log('[USPTOSyncService] Periodic sync stopped');
  }

  /**
   * Track a trademark for USPTO status updates.
   */
  async trackTrademark(
    id: string,
    serialNumber: string,
    initialStatus?: USPTOApplicationStatus | undefined
  ): Promise<TrackedTrademark> {
    const tracked: TrackedTrademark = {
      id,
      serialNumber,
      lastKnownStatus: initialStatus ?? 'NEW_APPLICATION',
      lastSyncedAt: new Date(0), // Never synced
      syncEnabled: true,
      syncErrorCount: 0,
      lastSyncError: undefined,
      usptpSnapshot: undefined,
    };

    this.trackedTrademarks.set(id, tracked);
    console.log(`[USPTOSyncService] Tracking trademark ${serialNumber} (ID: ${id})`);

    // Perform initial sync
    await this.syncSingleTrademark(tracked);

    return tracked;
  }

  /**
   * Stop tracking a trademark.
   */
  untrackTrademark(id: string): boolean {
    const removed = this.trackedTrademarks.delete(id);
    if (removed) {
      console.log(`[USPTOSyncService] Stopped tracking trademark ${id}`);
    }
    return removed;
  }

  /**
   * Get all tracked trademarks.
   */
  getTrackedTrademarks(): TrackedTrademark[] {
    return Array.from(this.trackedTrademarks.values());
  }

  /**
   * Get a specific tracked trademark.
   */
  getTrackedTrademark(id: string): TrackedTrademark | undefined {
    return this.trackedTrademarks.get(id);
  }

  /**
   * Manually trigger a sync for all tracked trademarks.
   */
  async syncAll(): Promise<SyncResult> {
    if (this.syncInProgress) {
      console.log('[USPTOSyncService] Sync already in progress, skipping');
      return this.createEmptySyncResult();
    }

    this.syncInProgress = true;
    const startTime = new Date();
    const result: SyncResult = {
      syncedCount: 0,
      changesDetected: [],
      errors: [],
      startedAt: startTime,
      completedAt: startTime, // Will be updated
      nextSyncAt: new Date(Date.now() + this.config.minSyncIntervalMs),
    };

    try {
      console.log(`[USPTOSyncService] Starting sync for ${this.trackedTrademarks.size} trademarks`);

      // Get trademarks that need syncing (sorted by last sync time)
      const trademarksToSync = this.getTrademarksDueForSync();

      // Process in batches
      for (let i = 0; i < trademarksToSync.length; i += this.config.batchSize) {
        const batch = trademarksToSync.slice(i, i + this.config.batchSize);

        const batchResults = await Promise.allSettled(
          batch.map(tm => this.syncSingleTrademark(tm))
        );

        for (let j = 0; j < batchResults.length; j++) {
          const batchResult = batchResults[j];
          const trademark = batch[j];

          if (batchResult.status === 'fulfilled') {
            result.syncedCount++;
            if (batchResult.value) {
              result.changesDetected.push(batchResult.value);
            }
          } else {
            result.errors.push({
              serialNumber: trademark.serialNumber,
              error: batchResult.reason?.message ?? 'Unknown error',
            });
          }
        }
      }

      result.completedAt = new Date();
      this.lastSyncRun = result.completedAt;

      console.log(
        `[USPTOSyncService] Sync completed: ${result.syncedCount} synced, ` +
        `${result.changesDetected.length} changes, ${result.errors.length} errors`
      );

      // Publish sync completed event
      await this.publishEvent({
        type: 'USPTO.SyncCompleted',
        aggregateType: 'USPTOSync',
        aggregateId: 'singleton',
        payload: {
          syncedCount: result.syncedCount,
          changesDetected: result.changesDetected.length,
          errorCount: result.errors.length,
        },
      });

    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  /**
   * Sync a single trademark with USPTO.
   */
  async syncSingleTrademark(tracked: TrackedTrademark): Promise<StatusChangeDetection | undefined> {
    if (!tracked.syncEnabled) {
      return undefined;
    }

    try {
      // Fetch current status from USPTO
      const response = await this.client.getApplicationStatus(tracked.serialNumber);

      if (!response.success || !response.data) {
        tracked.syncErrorCount++;
        tracked.lastSyncError = response.error ?? 'Unknown error';

        if (tracked.syncErrorCount >= this.config.maxConsecutiveErrors) {
          tracked.syncEnabled = false;
          console.log(
            `[USPTOSyncService] Disabled sync for ${tracked.serialNumber} after ${tracked.syncErrorCount} consecutive errors`
          );
        }

        throw new Error(response.error ?? 'Failed to fetch USPTO status');
      }

      const usptoData = response.data;
      tracked.syncErrorCount = 0;
      tracked.lastSyncError = undefined;
      tracked.lastSyncedAt = new Date();

      // Detect changes
      const changes = this.detectChanges(tracked, usptoData);

      // Update snapshot
      const previousSnapshot = tracked.usptpSnapshot;
      tracked.usptpSnapshot = usptoData;

      // Process changes if any
      if (changes) {
        await this.processStatusChange(tracked, changes, previousSnapshot);

        // Update local trademark entity if repository is available
        await this.updateLocalTrademark(tracked, usptoData);
      }

      // Check for new office actions
      await this.processOfficeActions(tracked, usptoData, previousSnapshot);

      // Check for maintenance deadlines
      await this.processMaintenanceFilings(tracked, usptoData);

      return changes;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[USPTOSyncService] Error syncing ${tracked.serialNumber}: ${message}`);
      throw error;
    }
  }

  /**
   * Detect changes between local state and USPTO data.
   */
  private detectChanges(
    tracked: TrackedTrademark,
    usptoData: TrademarkApplicationStatus
  ): StatusChangeDetection | undefined {
    if (tracked.lastKnownStatus === usptoData.status) {
      return undefined;
    }

    // Detect new office actions
    const newOfficeActions = this.detectNewOfficeActions(
      tracked.usptpSnapshot?.prosecutionHistory ?? [],
      usptoData.prosecutionHistory
    );

    // Generate deadline info for new actions
    const newDeadlines = this.generateDeadlinesFromActions(newOfficeActions, usptoData.status);

    return {
      serialNumber: tracked.serialNumber,
      previousStatus: tracked.lastKnownStatus,
      newStatus: usptoData.status,
      detectedAt: new Date(),
      statusDate: usptoData.statusDate,
      newOfficeActions,
      newDeadlines,
    };
  }

  /**
   * Detect new office actions by comparing prosecution histories.
   */
  private detectNewOfficeActions(
    previousActions: OfficeAction[],
    currentActions: OfficeAction[]
  ): OfficeAction[] {
    const previousIds = new Set(
      previousActions.map(a => `${a.actionType}-${a.mailedDate.toISOString()}`)
    );

    return currentActions.filter(
      a => !previousIds.has(`${a.actionType}-${a.mailedDate.toISOString()}`)
    );
  }

  /**
   * Generate deadline information from office actions.
   */
  private generateDeadlinesFromActions(
    actions: OfficeAction[],
    status: USPTOApplicationStatus
  ): Array<{ type: string; dueDate: Date; description: string }> {
    const deadlines: Array<{ type: string; dueDate: Date; description: string }> = [];

    for (const action of actions) {
      if (action.responseRequired && action.responseDeadline) {
        deadlines.push({
          type: this.mapActionToDeadlineType(action.actionType),
          dueDate: action.responseDeadline,
          description: `Response deadline for ${action.description || action.actionType}`,
        });
      }
    }

    // Add publication-based deadline if published
    if (status === 'PUBLISHED_FOR_OPPOSITION') {
      const now = new Date();
      const oppositionDeadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      deadlines.push({
        type: 'opposition_window',
        dueDate: oppositionDeadline,
        description: 'Opposition filing window closes',
      });
    }

    return deadlines;
  }

  /**
   * Map office action type to deadline type.
   */
  private mapActionToDeadlineType(actionType: string): string {
    const mapping: Record<string, string> = {
      NON_FINAL_OFFICE_ACTION: 'office_action_response',
      FINAL_OFFICE_ACTION: 'final_office_action_response',
      SUSPENSION_LETTER: 'suspension_response',
      NOTICE_OF_ALLOWANCE: 'statement_of_use',
      OPPOSITION_FILED: 'opposition_response',
    };
    return mapping[actionType] ?? 'office_action_response';
  }

  /**
   * Process a status change.
   */
  private async processStatusChange(
    tracked: TrackedTrademark,
    changes: StatusChangeDetection,
    _previousSnapshot: TrademarkApplicationStatus | undefined
  ): Promise<void> {
    console.log(
      `[USPTOSyncService] Status change detected for ${tracked.serialNumber}: ` +
      `${changes.previousStatus} -> ${changes.newStatus}`
    );

    // Update tracked state
    tracked.lastKnownStatus = changes.newStatus;

    // Emit appropriate domain event based on status transition
    const eventType = this.determineEventType(changes.previousStatus, changes.newStatus);

    await this.publishEvent({
      type: eventType,
      aggregateType: 'Trademark',
      aggregateId: tracked.id,
      payload: {
        serialNumber: tracked.serialNumber,
        previousStatus: changes.previousStatus,
        newStatus: changes.newStatus,
        statusDate: changes.statusDate,
        newDeadlines: changes.newDeadlines,
      },
    });

    // Create deadlines for any new requirements
    for (const deadline of changes.newDeadlines) {
      await this.publishEvent({
        type: 'Deadline.CreateRequested',
        aggregateType: 'Deadline',
        aggregateId: randomUUID(),
        payload: {
          assetId: tracked.id,
          assetType: 'trademark',
          deadlineType: deadline.type,
          dueDate: deadline.dueDate.toISOString(),
          description: deadline.description,
          source: 'USPTO_SYNC',
        },
      });
    }
  }

  /**
   * Determine the domain event type based on status transition.
   */
  private determineEventType(
    previousStatus: USPTOApplicationStatus,
    newStatus: USPTOApplicationStatus
  ): string {
    const transitionMap: Record<string, string> = {
      'NEW_APPLICATION->NON_FINAL_ACTION_MAILED': 'USPTO.OfficeActionMailed',
      'NON_FINAL_ACTION_PENDING->APPROVED_FOR_PUBLICATION': 'USPTO.ApplicationApprovedForPublication',
      'APPROVED_FOR_PUBLICATION->PUBLISHED_FOR_OPPOSITION': 'USPTO.ApplicationPublished',
      'PUBLISHED_FOR_OPPOSITION->OPPOSITION_PENDING': 'USPTO.OppositionFiled',
      'PUBLISHED_FOR_OPPOSITION->REGISTERED': 'USPTO.TrademarkRegistered',
      'OPPOSITION_DISMISSED->REGISTERED': 'USPTO.TrademarkRegistered',
      'REGISTERED->CANCELLED': 'USPTO.TrademarkCancelled',
      'REGISTERED->EXPIRED': 'USPTO.TrademarkExpired',
    };

    const key = `${previousStatus}->${newStatus}`;
    return transitionMap[key] ?? 'USPTO.StatusChanged';
  }

  /**
   * Process new office actions.
   */
  private async processOfficeActions(
    tracked: TrackedTrademark,
    usptoData: TrademarkApplicationStatus,
    previousSnapshot: TrademarkApplicationStatus | undefined
  ): Promise<void> {
    const newActions = this.detectNewOfficeActions(
      previousSnapshot?.prosecutionHistory ?? [],
      usptoData.prosecutionHistory
    );

    for (const action of newActions) {
      console.log(
        `[USPTOSyncService] New office action for ${tracked.serialNumber}: ${action.actionType}`
      );

      await this.publishEvent({
        type: 'USPTO.OfficeActionReceived',
        aggregateType: 'Trademark',
        aggregateId: tracked.id,
        payload: {
          serialNumber: tracked.serialNumber,
          actionType: action.actionType,
          mailedDate: action.mailedDate,
          responseDeadline: action.responseDeadline,
          responseRequired: action.responseRequired,
          isFinal: action.isFinal,
          description: action.description,
        },
      });

      // Create deadline if response is required
      if (action.responseRequired && action.responseDeadline) {
        await this.publishEvent({
          type: 'Deadline.CreateRequested',
          aggregateType: 'Deadline',
          aggregateId: randomUUID(),
          payload: {
            assetId: tracked.id,
            assetType: 'trademark',
            deadlineType: this.mapActionToDeadlineType(action.actionType),
            dueDate: action.responseDeadline.toISOString(),
            description: `Response required for ${action.description || action.actionType}`,
            priority: action.isFinal ? 'critical' : 'high',
            source: 'USPTO_SYNC',
          },
        });
      }
    }
  }

  /**
   * Process maintenance filing requirements.
   */
  private async processMaintenanceFilings(
    tracked: TrackedTrademark,
    usptoData: TrademarkApplicationStatus
  ): Promise<void> {
    for (const filing of usptoData.maintenanceFilings) {
      // Skip filings that are already filed or not due
      if (filing.status === 'FILED' || filing.status === 'ACCEPTED' || filing.status === 'NOT_DUE') {
        continue;
      }

      // Check if we should create/update a deadline
      if (filing.status === 'DUE' || filing.status === 'GRACE_PERIOD') {
        const deadlineType = this.mapFilingTypeToDeadlineType(filing.filingType);
        const priority = filing.status === 'GRACE_PERIOD' ? 'critical' : 'high';

        await this.publishEvent({
          type: 'Deadline.CreateRequested',
          aggregateType: 'Deadline',
          aggregateId: randomUUID(),
          payload: {
            assetId: tracked.id,
            assetType: 'trademark',
            deadlineType,
            dueDate: filing.status === 'GRACE_PERIOD'
              ? filing.gracePeriodEnd.toISOString()
              : filing.dueDate.toISOString(),
            description: `${filing.filingType} filing ${filing.status === 'GRACE_PERIOD' ? '(grace period)' : ''}`,
            priority,
            source: 'USPTO_SYNC',
            metadata: {
              filingType: filing.filingType,
              gracePeriodEnd: filing.gracePeriodEnd.toISOString(),
            },
          },
        });
      }
    }
  }

  /**
   * Map filing type to deadline type.
   */
  private mapFilingTypeToDeadlineType(filingType: MaintenanceFiling['filingType']): string {
    const mapping: Record<string, string> = {
      SECTION_8: 'section_8_affidavit',
      SECTION_9: 'section_9_renewal',
      SECTION_15: 'section_15_incontestability',
      SECTION_8_15_COMBINED: 'section_8_15_combined',
      SECTION_71: 'section_71_declaration',
    };
    return mapping[filingType] ?? 'trademark_maintenance';
  }

  /**
   * Update local trademark entity with USPTO data.
   */
  private async updateLocalTrademark(
    tracked: TrackedTrademark,
    usptoData: TrademarkApplicationStatus
  ): Promise<void> {
    if (!this.trademarkRepository) {
      return;
    }

    try {
      const trademark = await this.trademarkRepository.findById(tracked.id);
      if (!trademark) {
        console.log(`[USPTOSyncService] Trademark ${tracked.id} not found in local database`);
        return;
      }

      // Map USPTO status to local status and update if needed
      const localStatus = this.mapUSPTOStatusToLocalStatus(usptoData.status);

      // Check if registration occurred
      if (
        usptoData.status === 'REGISTERED' &&
        trademark.status !== 'registered' &&
        usptoData.registrationNumber &&
        usptoData.registrationDate
      ) {
        // Calculate expiration date (10 years from registration in US)
        const expirationDate = new Date(usptoData.registrationDate);
        expirationDate.setFullYear(expirationDate.getFullYear() + 10);

        trademark.register(
          usptoData.registrationNumber,
          usptoData.registrationDate,
          expirationDate,
          'USPTO_SYNC'
        );

        await this.trademarkRepository.save(trademark);
        console.log(`[USPTOSyncService] Updated local trademark ${tracked.id} to registered`);
      }

      // Note: Other status updates would require additional methods on the Trademark entity

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[USPTOSyncService] Error updating local trademark: ${message}`);
    }
  }

  /**
   * Map USPTO status to local trademark status.
   */
  private mapUSPTOStatusToLocalStatus(
    usptoStatus: USPTOApplicationStatus
  ): 'draft' | 'pending' | 'published' | 'opposed' | 'registered' | 'cancelled' | 'expired' | 'abandoned' {
    const mapping: Record<USPTOApplicationStatus, 'draft' | 'pending' | 'published' | 'opposed' | 'registered' | 'cancelled' | 'expired' | 'abandoned'> = {
      NEW_APPLICATION: 'pending',
      NON_FINAL_ACTION_MAILED: 'pending',
      NON_FINAL_ACTION_PENDING: 'pending',
      FINAL_REFUSAL_MAILED: 'pending',
      FINAL_REFUSAL_PENDING: 'pending',
      APPROVED_FOR_PUBLICATION: 'pending',
      PUBLISHED_FOR_OPPOSITION: 'published',
      OPPOSITION_PENDING: 'opposed',
      OPPOSITION_DISMISSED: 'pending',
      REGISTERED: 'registered',
      CANCELLED: 'cancelled',
      EXPIRED: 'expired',
      ABANDONED: 'abandoned',
    };
    return mapping[usptoStatus];
  }

  /**
   * Get trademarks that are due for syncing.
   */
  private getTrademarksDueForSync(): TrackedTrademark[] {
    const now = Date.now();
    const minInterval = this.config.minSyncIntervalMs;

    return Array.from(this.trackedTrademarks.values())
      .filter(tm => tm.syncEnabled)
      .filter(tm => now - tm.lastSyncedAt.getTime() >= minInterval)
      .sort((a, b) => a.lastSyncedAt.getTime() - b.lastSyncedAt.getTime());
  }

  /**
   * Schedule the next sync run.
   */
  private scheduleNextSync(): void {
    const delayMs = this.config.minSyncIntervalMs;
    this.nextScheduledSync = new Date(Date.now() + delayMs);

    this.syncTimer = setTimeout(async () => {
      try {
        await this.syncAll();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[USPTOSyncService] Scheduled sync failed: ${message}`);
      } finally {
        this.scheduleNextSync();
      }
    }, delayMs);
  }

  /**
   * Create an empty sync result.
   */
  private createEmptySyncResult(): SyncResult {
    const now = new Date();
    return {
      syncedCount: 0,
      changesDetected: [],
      errors: [],
      startedAt: now,
      completedAt: now,
      nextSyncAt: new Date(Date.now() + this.config.minSyncIntervalMs),
    };
  }

  /**
   * Publish a domain event.
   */
  private async publishEvent(event: {
    type: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const domainEvent: DomainEvent = {
      id: randomUUID(),
      type: event.type,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      payload: event.payload,
      metadata: {
        correlationId: randomUUID(),
        causationId: undefined,
        userId: 'USPTO_SYNC',
        tenantId: undefined,
        source: 'intellectual-property',
        timestamp: new Date(),
      },
      occurredAt: new Date(),
      version: 1,
    };

    await this.eventPublisher.publish(domainEvent);
  }

  /**
   * Get service status.
   */
  getStatus(): {
    enabled: boolean;
    syncInProgress: boolean;
    lastSyncRun: Date | undefined;
    nextScheduledSync: Date | undefined;
    trackedCount: number;
  } {
    return {
      enabled: this.config.enabled,
      syncInProgress: this.syncInProgress,
      lastSyncRun: this.lastSyncRun,
      nextScheduledSync: this.nextScheduledSync,
      trackedCount: this.trackedTrademarks.size,
    };
  }
}

// Factory function
export function createUSPTOSyncService(
  eventPublisher?: IPEventPublisher | undefined,
  trademarkRepository?: TrademarkRepository | undefined,
  config?: Partial<USPTOSyncServiceConfig> | undefined
): USPTOSyncService {
  return new USPTOSyncService(eventPublisher, trademarkRepository, config);
}
