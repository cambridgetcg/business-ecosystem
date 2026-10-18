/**
 * USPTO PAIR Sync Service
 *
 * Periodically synchronizes patent status with USPTO PAIR system.
 * Detects status changes, office actions, grants, and maintenance fee windows.
 * Emits domain events and creates deadlines for tracked patents.
 *
 * @module infrastructure/external/uspto
 */

import { randomUUID } from 'crypto';
import { USPTOPairClient, usptoPairClient } from './pair-client.js';
import { USPTOPairEventMapper, createEventMapper } from './pair-event-mapper.js';
import type {
  PatentApplicationSummary,
  PatentProsecutionHistory,
  MaintenanceFeeStatus,
  PairSyncResult,
  StatusChangeDetected,
  OfficeActionDetected,
  GrantDetected,
  PublicationDetected,
  AbandonmentDetected,
  MaintenanceFeeWindowOpened,
  PairApiError,
  PatentApplicationStatus,
  OfficeAction,
} from './pair-types.js';
import type {
  USPTODomainEvent,
  DeadlineToCreate,
  NotificationToSend,
} from './pair-event-mapper.js';

/**
 * Tracked patent record from internal system.
 */
export interface TrackedPatent {
  id: string;                        // Internal patent ID
  applicationNumber?: string;        // USPTO application number
  patentNumber?: string;             // USPTO patent number (if granted)
  status: PatentApplicationStatus;   // Last known status
  lastSyncedAt?: Date;               // Last successful sync
  lastOfficeActionId?: string;       // Last processed office action
  entityId: string;                  // Owning entity in the system
}

/**
 * Repository interface for tracked patents.
 */
export interface TrackedPatentRepository {
  findAll(): Promise<TrackedPatent[]>;
  findByApplicationNumber(applicationNumber: string): Promise<TrackedPatent | null>;
  findByPatentNumber(patentNumber: string): Promise<TrackedPatent | null>;
  findPendingSync(olderThan: Date): Promise<TrackedPatent[]>;
  updateSyncStatus(patentId: string, syncedAt: Date, status?: PatentApplicationStatus): Promise<void>;
  updateLastOfficeAction(patentId: string, officeActionId: string): Promise<void>;
}

/**
 * Event publisher interface.
 */
export interface USPTOEventPublisher {
  publish(event: USPTODomainEvent): Promise<void>;
  publishBatch(events: USPTODomainEvent[]): Promise<void>;
}

/**
 * Deadline service interface.
 */
export interface DeadlineService {
  createDeadline(deadline: DeadlineToCreate): Promise<string>;
  createDeadlines(deadlines: DeadlineToCreate[]): Promise<string[]>;
}

/**
 * Notification service interface.
 */
export interface NotificationService {
  send(notification: NotificationToSend): Promise<void>;
  sendBatch(notifications: NotificationToSend[]): Promise<void>;
}

/**
 * Configuration for sync service.
 */
export interface SyncServiceConfig {
  syncIntervalMs: number;       // How often to run sync (default: 1 hour)
  batchSize: number;            // Patents to sync per batch (default: 50)
  staleSyncThresholdMs: number; // Consider stale after (default: 24 hours)
  enableAutoSync: boolean;      // Auto-start periodic sync
  deadlineWarningDays: number[];// Days before deadline to warn (default: [90, 60, 30, 14, 7])
  maintenanceFeeLeadDays: number; // Days before fee window to create deadline
}

/**
 * Default sync configuration.
 */
export const DEFAULT_SYNC_CONFIG: SyncServiceConfig = {
  syncIntervalMs: 60 * 60 * 1000,          // 1 hour
  batchSize: 50,
  staleSyncThresholdMs: 24 * 60 * 60 * 1000, // 24 hours
  enableAutoSync: false,
  deadlineWarningDays: [90, 60, 30, 14, 7],
  maintenanceFeeLeadDays: 180,             // 6 months
};

/**
 * USPTO PAIR Sync Service
 *
 * Responsibilities:
 * - Poll USPTO PAIR for status updates on tracked patents
 * - Detect status changes and emit events
 * - Create deadlines for office action responses
 * - Track publication and grant dates
 * - Monitor maintenance fee windows
 * - Schedule periodic sync jobs
 */
export class USPTOPairSyncService {
  private readonly config: SyncServiceConfig;
  private readonly client: USPTOPairClient;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly repository: TrackedPatentRepository,
    private readonly eventPublisher: USPTOEventPublisher,
    private readonly deadlineService: DeadlineService,
    private readonly notificationService: NotificationService,
    config: Partial<SyncServiceConfig> = {},
    client?: USPTOPairClient
  ) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.client = client ?? usptoPairClient;

    if (this.config.enableAutoSync) {
      this.startPeriodicSync();
    }
  }

  /**
   * Start periodic synchronization.
   */
  startPeriodicSync(): void {
    if (this.syncInterval) {
      return; // Already running
    }

    this.syncInterval = setInterval(
      () => this.runFullSync().catch(console.error),
      this.config.syncIntervalMs
    );

    // Run initial sync
    this.runFullSync().catch(console.error);
  }

  /**
   * Stop periodic synchronization.
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Run a full sync of all tracked patents.
   */
  async runFullSync(): Promise<PairSyncResult> {
    if (this.isRunning) {
      throw new Error('Sync already in progress');
    }

    this.isRunning = true;
    const syncId = randomUUID();
    const startTime = new Date();

    const result: PairSyncResult = {
      syncId,
      startTime,
      endTime: new Date(),
      applicationsChecked: 0,
      statusChanges: [],
      officeActionsReceived: [],
      grantsDetected: [],
      publicationsDetected: [],
      abandonmentsDetected: [],
      maintenanceFeeWindows: [],
      errors: [],
    };

    try {
      const trackedPatents = await this.repository.findAll();

      for (let i = 0; i < trackedPatents.length; i += this.config.batchSize) {
        const batch = trackedPatents.slice(i, i + this.config.batchSize);
        const batchResult = await this.syncBatch(batch, syncId);

        result.applicationsChecked += batchResult.applicationsChecked;
        result.statusChanges.push(...batchResult.statusChanges);
        result.officeActionsReceived.push(...batchResult.officeActionsReceived);
        result.grantsDetected.push(...batchResult.grantsDetected);
        result.publicationsDetected.push(...batchResult.publicationsDetected);
        result.abandonmentsDetected.push(...batchResult.abandonmentsDetected);
        result.maintenanceFeeWindows.push(...batchResult.maintenanceFeeWindows);
        result.errors.push(...batchResult.errors);
      }

      result.endTime = new Date();
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync patents that haven't been synced recently.
   */
  async runStaleSync(): Promise<PairSyncResult> {
    const staleDate = new Date(Date.now() - this.config.staleSyncThresholdMs);
    const stalePatents = await this.repository.findPendingSync(staleDate);

    const syncId = randomUUID();
    return this.syncBatch(stalePatents, syncId);
  }

  /**
   * Sync a single patent immediately.
   */
  async syncPatent(patentId: string): Promise<PairSyncResult> {
    const patent = await this.findTrackedPatent(patentId);
    if (!patent) {
      throw new Error(`Tracked patent not found: ${patentId}`);
    }

    const syncId = randomUUID();
    return this.syncBatch([patent], syncId);
  }

  /**
   * Sync a batch of patents.
   */
  private async syncBatch(
    patents: TrackedPatent[],
    syncId: string
  ): Promise<PairSyncResult> {
    const startTime = new Date();
    const result: PairSyncResult = {
      syncId,
      startTime,
      endTime: new Date(),
      applicationsChecked: 0,
      statusChanges: [],
      officeActionsReceived: [],
      grantsDetected: [],
      publicationsDetected: [],
      abandonmentsDetected: [],
      maintenanceFeeWindows: [],
      errors: [],
    };

    const eventMapper = createEventMapper(syncId);

    for (const patent of patents) {
      try {
        if (patent.applicationNumber) {
          await this.syncPendingApplication(patent, eventMapper, result);
        }

        if (patent.patentNumber) {
          await this.syncGrantedPatent(patent, eventMapper, result);
        }

        result.applicationsChecked++;

        // Update sync timestamp
        await this.repository.updateSyncStatus(patent.id, new Date());
      } catch (error) {
        if (this.isPairError(error)) {
          result.errors.push(error);
        } else {
          result.errors.push({
            code: 'UNKNOWN',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    result.endTime = new Date();
    return result;
  }

  /**
   * Sync a pending patent application.
   */
  private async syncPendingApplication(
    patent: TrackedPatent,
    eventMapper: USPTOPairEventMapper,
    result: PairSyncResult
  ): Promise<void> {
    const applicationNumber = patent.applicationNumber!;

    // Get current status from USPTO
    const currentStatus = await this.client.getApplicationStatus(applicationNumber);
    if (!currentStatus) {
      return;
    }

    // Check for status change
    if (currentStatus.status !== patent.status) {
      await this.handleStatusChange(patent, currentStatus, eventMapper, result);
    }

    // Check for publication
    if (
      currentStatus.publicationNumber &&
      currentStatus.status === 'published' &&
      patent.status === 'pending'
    ) {
      await this.handlePublication(patent, currentStatus, eventMapper, result);
    }

    // Check for grant
    if (currentStatus.patentNumber && currentStatus.status === 'granted') {
      await this.handleGrant(patent, currentStatus, eventMapper, result);
    }

    // Check for abandonment
    if (currentStatus.status === 'abandoned' && patent.status !== 'abandoned') {
      await this.handleAbandonment(patent, currentStatus, eventMapper, result);
    }

    // Check for new office actions
    await this.checkForOfficeActions(patent, eventMapper, result);
  }

  /**
   * Sync a granted patent for maintenance fees.
   */
  private async syncGrantedPatent(
    patent: TrackedPatent,
    eventMapper: USPTOPairEventMapper,
    result: PairSyncResult
  ): Promise<void> {
    const patentNumber = patent.patentNumber!;

    // Get maintenance fee status
    const feeStatus = await this.client.getMaintenanceFeeStatus(patentNumber);
    if (!feeStatus) {
      return;
    }

    // Check for maintenance fee windows opening soon
    const now = new Date();
    const leadDate = new Date(now.getTime() + this.config.maintenanceFeeLeadDays * 24 * 60 * 60 * 1000);

    for (const fee of feeStatus.fees) {
      if (
        fee.status === 'not_yet_due' &&
        fee.windowOpensDate <= leadDate &&
        fee.windowOpensDate > now
      ) {
        await this.handleMaintenanceFeeWindow(patent, feeStatus, fee, eventMapper, result);
      }

      // Check for fees currently in window
      if (fee.status === 'window_open' || fee.status === 'due') {
        await this.handleMaintenanceFeeWindow(patent, feeStatus, fee, eventMapper, result);
      }
    }
  }

  /**
   * Handle detected status change.
   */
  private async handleStatusChange(
    patent: TrackedPatent,
    currentStatus: PatentApplicationSummary,
    eventMapper: USPTOPairEventMapper,
    result: PairSyncResult
  ): Promise<void> {
    const change: StatusChangeDetected = {
      applicationNumber: currentStatus.applicationNumber,
      patentId: patent.id,
      previousStatus: patent.status,
      newStatus: currentStatus.status,
      changeDate: new Date(),
      details: `Status changed from ${patent.status} to ${currentStatus.status}`,
    };

    result.statusChanges.push(change);

    const mappingResult = eventMapper.mapStatusChange(change);
    await this.processEventMappingResult(mappingResult);

    // Update status in repository
    await this.repository.updateSyncStatus(patent.id, new Date(), currentStatus.status);
  }

  /**
   * Handle detected publication.
   */
  private async handlePublication(
    patent: TrackedPatent,
    currentStatus: PatentApplicationSummary,
    eventMapper: USPTOPairEventMapper,
    result: PairSyncResult
  ): Promise<void> {
    const detection: PublicationDetected = {
      applicationNumber: currentStatus.applicationNumber,
      patentId: patent.id,
      publicationNumber: currentStatus.publicationNumber!,
      publicationDate: currentStatus.publicationDate!,
    };

    result.publicationsDetected.push(detection);

    const mappingResult = eventMapper.mapPatentPublished(detection);
    await this.processEventMappingResult(mappingResult);
  }

  /**
   * Handle detected grant.
   */
  private async handleGrant(
    patent: TrackedPatent,
    currentStatus: PatentApplicationSummary,
    eventMapper: USPTOPairEventMapper,
    result: PairSyncResult
  ): Promise<void> {
    // Get full grant details
    const grant = await this.client.getPatentGrant(currentStatus.patentNumber!);
    if (!grant) {
      return;
    }

    const detection: GrantDetected = {
      applicationNumber: currentStatus.applicationNumber,
      patentId: patent.id,
      grant,
    };

    result.grantsDetected.push(detection);

    const mappingResult = eventMapper.mapPatentGranted(detection);
    await this.processEventMappingResult(mappingResult);
  }

  /**
   * Handle detected abandonment.
   */
  private async handleAbandonment(
    patent: TrackedPatent,
    currentStatus: PatentApplicationSummary,
    eventMapper: USPTOPairEventMapper,
    result: PairSyncResult
  ): Promise<void> {
    // Get prosecution history for abandonment details
    const history = await this.client.getProsecutionHistory(currentStatus.applicationNumber);
    const abandonmentEvent = history?.events.find(e => e.eventType === 'abandonment');

    const revivalDeadline = new Date();
    revivalDeadline.setMonth(revivalDeadline.getMonth() + 2); // 2 months for revival petition

    const detection: AbandonmentDetected = {
      applicationNumber: currentStatus.applicationNumber,
      patentId: patent.id,
      abandonmentDate: abandonmentEvent?.eventDate ?? new Date(),
      reason: abandonmentEvent?.description ?? 'Unknown reason',
      revivable: true, // Most abandonments can be revived with petition
      revivalDeadline,
    };

    result.abandonmentsDetected.push(detection);

    const mappingResult = eventMapper.mapPatentAbandoned(detection);
    await this.processEventMappingResult(mappingResult);
  }

  /**
   * Check for new office actions.
   */
  private async checkForOfficeActions(
    patent: TrackedPatent,
    eventMapper: USPTOPairEventMapper,
    result: PairSyncResult
  ): Promise<void> {
    const officeActions = await this.client.getOfficeActions(patent.applicationNumber!);

    for (const oa of officeActions) {
      // Skip if we've already processed this office action
      if (oa.id === patent.lastOfficeActionId) {
        continue;
      }

      // Check if this is a new office action (mailed in last sync period)
      const mailDate = new Date(oa.mailedDate);
      const lastSync = patent.lastSyncedAt ?? new Date(0);

      if (mailDate > lastSync) {
        const detection: OfficeActionDetected = {
          applicationNumber: patent.applicationNumber!,
          patentId: patent.id,
          officeAction: oa,
        };

        result.officeActionsReceived.push(detection);

        const mappingResult = eventMapper.mapOfficeActionReceived(detection);
        await this.processEventMappingResult(mappingResult);

        // Update last processed office action
        await this.repository.updateLastOfficeAction(patent.id, oa.id);
      }

      // Check for approaching deadlines on pending actions
      if (oa.responseStatus === 'pending') {
        await this.checkDeadlineWarnings(patent, oa, eventMapper);
      }
    }
  }

  /**
   * Check if deadline warnings should be sent.
   */
  private async checkDeadlineWarnings(
    patent: TrackedPatent,
    officeAction: OfficeAction,
    eventMapper: USPTOPairEventMapper
  ): Promise<void> {
    const now = new Date();
    const deadline = new Date(officeAction.responseDeadline);
    const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Check if overdue
    if (daysUntil < 0) {
      const mappingResult = eventMapper.mapResponseOverdue(
        patent.id,
        patent.applicationNumber!,
        officeAction,
        Math.abs(daysUntil)
      );
      await this.processEventMappingResult(mappingResult);
      return;
    }

    // Check warning thresholds
    for (const warningDays of this.config.deadlineWarningDays) {
      if (daysUntil === warningDays) {
        const mappingResult = eventMapper.mapResponseDeadlineApproaching(
          patent.id,
          patent.applicationNumber!,
          officeAction,
          daysUntil
        );
        await this.processEventMappingResult(mappingResult);
        break; // Only send one warning per check
      }
    }
  }

  /**
   * Handle maintenance fee window detection.
   */
  private async handleMaintenanceFeeWindow(
    patent: TrackedPatent,
    feeStatus: MaintenanceFeeStatus,
    fee: MaintenanceFeeStatus['fees'][0],
    eventMapper: USPTOPairEventMapper,
    result: PairSyncResult
  ): Promise<void> {
    const window: MaintenanceFeeWindowOpened = {
      patentNumber: feeStatus.patentNumber,
      patentId: patent.id,
      feeWindow: fee.feeWindow,
      windowOpensDate: fee.windowOpensDate,
      dueDate: fee.dueDate,
      gracePeriodEnds: fee.gracePeriodEnds,
      feeAmount: fee.baseFee,
    };

    result.maintenanceFeeWindows.push(window);

    const mappingResult = eventMapper.mapMaintenanceFeeWindowOpened(window);
    await this.processEventMappingResult(mappingResult);
  }

  /**
   * Process event mapping result.
   */
  private async processEventMappingResult(result: {
    domainEvents: USPTODomainEvent[];
    deadlinesToCreate: DeadlineToCreate[];
    notifications: NotificationToSend[];
  }): Promise<void> {
    // Publish domain events
    if (result.domainEvents.length > 0) {
      await this.eventPublisher.publishBatch(result.domainEvents);
    }

    // Create deadlines
    if (result.deadlinesToCreate.length > 0) {
      await this.deadlineService.createDeadlines(result.deadlinesToCreate);
    }

    // Send notifications
    if (result.notifications.length > 0) {
      await this.notificationService.sendBatch(result.notifications);
    }
  }

  /**
   * Find a tracked patent by ID.
   */
  private async findTrackedPatent(patentId: string): Promise<TrackedPatent | null> {
    const allPatents = await this.repository.findAll();
    return allPatents.find(p => p.id === patentId) ?? null;
  }

  /**
   * Type guard for PairApiError.
   */
  private isPairError(error: unknown): error is PairApiError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error
    );
  }

  /**
   * Get current sync status.
   */
  getSyncStatus(): {
    isRunning: boolean;
    autoSyncEnabled: boolean;
    syncIntervalMs: number;
  } {
    return {
      isRunning: this.isRunning,
      autoSyncEnabled: this.syncInterval !== null,
      syncIntervalMs: this.config.syncIntervalMs,
    };
  }
}

/**
 * Factory function for creating sync service with dependencies.
 */
export function createUSPTOPairSyncService(
  repository: TrackedPatentRepository,
  eventPublisher: USPTOEventPublisher,
  deadlineService: DeadlineService,
  notificationService: NotificationService,
  config?: Partial<SyncServiceConfig>
): USPTOPairSyncService {
  return new USPTOPairSyncService(
    repository,
    eventPublisher,
    deadlineService,
    notificationService,
    config
  );
}
