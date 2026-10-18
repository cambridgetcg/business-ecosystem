/**
 * WIPO Madrid Sync Service
 *
 * Scheduled service that monitors international trademark registrations
 * under the Madrid Protocol. Polls WIPO for status updates and emits
 * domain events for changes.
 *
 * Features:
 * - Poll WIPO for status updates on tracked registrations
 * - Monitor designation acceptances/refusals per country
 * - Detect central attacks (when basic mark is cancelled)
 * - Track renewal deadlines (10-year periods)
 * - Emit events for status changes
 * - Schedule periodic sync jobs
 *
 * @module infrastructure/external/wipo
 */

import { randomUUID } from 'crypto';
import { WIPOMadridClient, wipoMadridClient, WIPOAPIException } from './madrid-client.js';
import {
  type InternationalRegistration,
  type CountryDesignation,
  type CentralAttackNotification,
  type MadridRenewalStatus,
  type MadridSyncConfig,
  type SyncResult,
  type SyncError,
  type MadridEvent,
  type MadridEventType,
} from './madrid-types.js';
import {
  EventBridgePublisher,
  eventBridgePublisher,
} from '../../aws/eventbridge-publisher.js';

/**
 * Tracked registration record.
 */
export interface TrackedRegistration {
  internationalRegistrationNumber: string;
  trademarkId: string;
  lastSyncedAt: Date;
  lastKnownStatus: string;
  lastKnownDesignations: Map<string, string>; // countryCode -> status
  centralAttackDetected: boolean;
  renewalAlertSent: boolean;
}

/**
 * Configuration for sync jobs.
 */
export interface SyncJobConfig {
  /** Job ID */
  jobId: string;
  /** Interval in minutes */
  intervalMinutes: number;
  /** Enabled */
  enabled: boolean;
  /** Last run time */
  lastRunAt?: Date;
  /** Next scheduled run */
  nextRunAt?: Date;
}

/**
 * WIPO Madrid Sync Service
 *
 * Manages periodic synchronization with WIPO Madrid Monitor API.
 */
export class WIPOMadridSyncService {
  private readonly client: WIPOMadridClient;
  private readonly publisher: EventBridgePublisher;
  private trackedRegistrations: Map<string, TrackedRegistration> = new Map();
  private syncJob: SyncJobConfig | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    client: WIPOMadridClient = wipoMadridClient,
    publisher: EventBridgePublisher = eventBridgePublisher
  ) {
    this.client = client;
    this.publisher = publisher;
  }

  // ===========================================================================
  // Registration Tracking
  // ===========================================================================

  /**
   * Add a registration to track.
   */
  trackRegistration(
    internationalRegistrationNumber: string,
    trademarkId: string
  ): void {
    if (this.trackedRegistrations.has(internationalRegistrationNumber)) {
      return;
    }

    this.trackedRegistrations.set(internationalRegistrationNumber, {
      internationalRegistrationNumber,
      trademarkId,
      lastSyncedAt: new Date(0), // Never synced
      lastKnownStatus: 'unknown',
      lastKnownDesignations: new Map(),
      centralAttackDetected: false,
      renewalAlertSent: false,
    });

    console.log(`[MadridSync] Now tracking registration ${internationalRegistrationNumber}`);
  }

  /**
   * Stop tracking a registration.
   */
  untrackRegistration(internationalRegistrationNumber: string): void {
    this.trackedRegistrations.delete(internationalRegistrationNumber);
    console.log(`[MadridSync] Stopped tracking registration ${internationalRegistrationNumber}`);
  }

  /**
   * Get all tracked registrations.
   */
  getTrackedRegistrations(): TrackedRegistration[] {
    return Array.from(this.trackedRegistrations.values());
  }

  /**
   * Get tracking status for a registration.
   */
  getTrackingStatus(internationalRegistrationNumber: string): TrackedRegistration | undefined {
    return this.trackedRegistrations.get(internationalRegistrationNumber);
  }

  // ===========================================================================
  // Sync Operations
  // ===========================================================================

  /**
   * Run a full sync for all tracked registrations.
   */
  async runSync(): Promise<SyncResult> {
    if (this.isRunning) {
      throw new Error('Sync already in progress');
    }

    this.isRunning = true;
    const syncId = randomUUID();
    const startedAt = new Date();

    const result: SyncResult = {
      syncId,
      startedAt,
      completedAt: new Date(),
      registrationsChecked: 0,
      registrationsUpdated: 0,
      newDesignations: 0,
      statusChanges: 0,
      centralAttacksDetected: 0,
      renewalAlerts: 0,
      errors: [],
      success: false,
    };

    console.log(`[MadridSync] Starting sync run ${syncId}`);

    try {
      const registrations = Array.from(this.trackedRegistrations.values());

      for (const tracked of registrations) {
        try {
          result.registrationsChecked++;

          const syncResult = await this.syncRegistration(tracked);

          if (syncResult.updated) {
            result.registrationsUpdated++;
          }
          result.newDesignations += syncResult.newDesignations;
          result.statusChanges += syncResult.statusChanges;
          if (syncResult.centralAttackDetected) {
            result.centralAttacksDetected++;
          }
          if (syncResult.renewalAlertGenerated) {
            result.renewalAlerts++;
          }
        } catch (error) {
          const syncError: SyncError = {
            registrationNumber: tracked.internationalRegistrationNumber,
            errorCode: error instanceof WIPOAPIException ? error.code : 'UNKNOWN',
            message: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
            recoverable: !(error instanceof WIPOAPIException && error.statusCode === 404),
          };
          result.errors.push(syncError);

          console.error(`[MadridSync] Error syncing ${tracked.internationalRegistrationNumber}: ${syncError.message}`);
        }

        // Add delay between registrations to respect rate limits
        await this.delay(500);
      }

      result.success = result.errors.length === 0;
      result.completedAt = new Date();

      // Update sync job status
      if (this.syncJob) {
        this.syncJob.lastRunAt = startedAt;
        this.syncJob.nextRunAt = new Date(
          Date.now() + this.syncJob.intervalMinutes * 60 * 1000
        );
      }

      // Publish sync completed event
      await this.publisher.publish({
        type: 'Madrid.SyncCompleted',
        aggregateType: 'MadridSync',
        aggregateId: syncId,
        timestamp: new Date(),
        payload: {
          registrationsChecked: result.registrationsChecked,
          registrationsUpdated: result.registrationsUpdated,
          statusChanges: result.statusChanges,
          centralAttacksDetected: result.centralAttacksDetected,
          renewalAlerts: result.renewalAlerts,
          errorCount: result.errors.length,
          durationMs: result.completedAt.getTime() - startedAt.getTime(),
        },
      });

      console.log(`[MadridSync] Sync run ${syncId} completed: ${result.registrationsUpdated}/${result.registrationsChecked} updated`);
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  /**
   * Sync a single registration and detect changes.
   */
  private async syncRegistration(tracked: TrackedRegistration): Promise<{
    updated: boolean;
    newDesignations: number;
    statusChanges: number;
    centralAttackDetected: boolean;
    renewalAlertGenerated: boolean;
  }> {
    const result = {
      updated: false,
      newDesignations: 0,
      statusChanges: 0,
      centralAttackDetected: false,
      renewalAlertGenerated: false,
    };

    // Fetch current registration from WIPO
    const registration = await this.client.getRegistrationStatus(
      tracked.internationalRegistrationNumber
    );

    // Check for status change
    if (registration.status !== tracked.lastKnownStatus) {
      result.statusChanges++;
      result.updated = true;

      await this.emitStatusChangeEvent(tracked, registration);
      tracked.lastKnownStatus = registration.status;
    }

    // Check designation changes
    for (const designation of registration.designations) {
      const previousStatus = tracked.lastKnownDesignations.get(designation.countryCode);

      if (!previousStatus) {
        // New designation
        result.newDesignations++;
        result.updated = true;
        tracked.lastKnownDesignations.set(designation.countryCode, designation.status);
      } else if (previousStatus !== designation.status) {
        // Status changed
        result.statusChanges++;
        result.updated = true;

        await this.emitDesignationChangeEvent(tracked, designation, previousStatus);
        tracked.lastKnownDesignations.set(designation.countryCode, designation.status);
      }
    }

    // Check for central attack
    if (registration.centralAttackNotification && !tracked.centralAttackDetected) {
      result.centralAttackDetected = true;
      result.updated = true;
      tracked.centralAttackDetected = true;

      await this.emitCentralAttackEvent(tracked, registration.centralAttackNotification);
    }

    // Check renewal status
    const renewalAlert = await this.checkRenewalStatus(tracked, registration);
    if (renewalAlert) {
      result.renewalAlertGenerated = true;
      result.updated = true;
    }

    // Update last synced time
    tracked.lastSyncedAt = new Date();

    return result;
  }

  /**
   * Check renewal status and emit alerts if needed.
   */
  private async checkRenewalStatus(
    tracked: TrackedRegistration,
    registration: InternationalRegistration
  ): Promise<boolean> {
    if (!registration.expirationDate) {
      return false;
    }

    const now = new Date();
    const expirationDate = registration.expirationDate;
    const daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Check if renewal alert thresholds are met
    const alertThresholds = [180, 90, 30, 14, 7]; // Days before expiration
    const shouldAlert = alertThresholds.some(
      threshold => daysUntilExpiration <= threshold && daysUntilExpiration > threshold - 7
    );

    // Also check for overdue (in grace period)
    const isOverdue = daysUntilExpiration < 0 && daysUntilExpiration >= -180;

    if ((shouldAlert || isOverdue) && !tracked.renewalAlertSent) {
      const renewalStatus = await this.client.getRenewalStatus(
        tracked.internationalRegistrationNumber
      );

      if (!renewalStatus.renewalPaid) {
        const eventType: MadridEventType = isOverdue ? 'renewal_overdue' : 'renewal_due';

        await this.emitMadridEvent({
          type: eventType,
          internationalRegistrationNumber: tracked.internationalRegistrationNumber,
          trademarkId: tracked.trademarkId,
          timestamp: new Date(),
          payload: {
            expirationDate: expirationDate.toISOString(),
            daysUntilExpiration,
            renewalWindowOpens: renewalStatus.renewalWindowOpens.toISOString(),
            graceDeadline: renewalStatus.graceDeadline.toISOString(),
            estimatedFee: renewalStatus.estimatedFee,
            designationCount: renewalStatus.designationCount,
            inGracePeriod: renewalStatus.inGracePeriod,
          },
          severity: isOverdue ? 'critical' : daysUntilExpiration <= 30 ? 'warning' : 'info',
        });

        // Reset alert flag after 7 days to allow next threshold alert
        if (daysUntilExpiration <= 7) {
          tracked.renewalAlertSent = true;
        }

        return true;
      }
    }

    return false;
  }

  // ===========================================================================
  // Event Emission
  // ===========================================================================

  /**
   * Emit a status change event.
   */
  private async emitStatusChangeEvent(
    tracked: TrackedRegistration,
    registration: InternationalRegistration
  ): Promise<void> {
    await this.emitMadridEvent({
      type: 'registration_status_changed',
      internationalRegistrationNumber: tracked.internationalRegistrationNumber,
      trademarkId: tracked.trademarkId,
      timestamp: new Date(),
      payload: {
        previousStatus: tracked.lastKnownStatus,
        newStatus: registration.status,
        registrationDate: registration.registrationDate?.toISOString(),
        expirationDate: registration.expirationDate?.toISOString(),
      },
      severity: registration.status === 'cancelled' ? 'critical' : 'info',
    });
  }

  /**
   * Emit a designation change event.
   */
  private async emitDesignationChangeEvent(
    tracked: TrackedRegistration,
    designation: CountryDesignation,
    previousStatus: string
  ): Promise<void> {
    let eventType: MadridEventType;
    let severity: MadridEvent['severity'];

    switch (designation.status) {
      case 'accepted':
      case 'protected':
        eventType = 'designation_accepted';
        severity = 'info';
        break;
      case 'refused':
        eventType = 'designation_refused';
        severity = 'warning';
        break;
      case 'provisionally_refused':
        eventType = 'designation_provisionally_refused';
        severity = 'warning';
        break;
      default:
        // Generic status change
        await this.publisher.publish({
          type: 'Madrid.DesignationStatusChanged',
          aggregateType: 'MadridRegistration',
          aggregateId: tracked.internationalRegistrationNumber,
          timestamp: new Date(),
          payload: {
            trademarkId: tracked.trademarkId,
            countryCode: designation.countryCode,
            countryName: designation.countryName,
            previousStatus,
            newStatus: designation.status,
          },
        });
        return;
    }

    await this.emitMadridEvent({
      type: eventType,
      internationalRegistrationNumber: tracked.internationalRegistrationNumber,
      trademarkId: tracked.trademarkId,
      timestamp: new Date(),
      payload: {
        countryCode: designation.countryCode,
        countryName: designation.countryName,
        previousStatus,
        newStatus: designation.status,
        statusDate: designation.statusDate.toISOString(),
        protectionDate: designation.protectionDate?.toISOString(),
        refusalDate: designation.refusalDate?.toISOString(),
        refusalReason: designation.refusalReason,
        responseDeadline: designation.responseDeadline?.toISOString(),
        appealDeadline: designation.appealDeadline?.toISOString(),
        classesProtected: designation.classesProtected,
        classesRefused: designation.classesRefused,
      },
      severity,
    });
  }

  /**
   * Emit a central attack event.
   */
  private async emitCentralAttackEvent(
    tracked: TrackedRegistration,
    notification: CentralAttackNotification
  ): Promise<void> {
    await this.emitMadridEvent({
      type: 'central_attack_notified',
      internationalRegistrationNumber: tracked.internationalRegistrationNumber,
      trademarkId: tracked.trademarkId,
      timestamp: new Date(),
      payload: {
        notificationId: notification.notificationId,
        notificationDate: notification.notificationDate.toISOString(),
        attackType: notification.attackType,
        officeOfOrigin: notification.officeOfOrigin,
        ceasedDate: notification.ceasedDate.toISOString(),
        classesAffected: notification.classesAffected,
        fullCancellation: notification.fullCancellation,
        transformationDeadline: notification.transformationDeadline.toISOString(),
        countriesForTransformation: notification.countriesForTransformation,
        notes: notification.notes,
      },
      severity: 'critical',
    });

    // Also emit transformation deadline approaching event
    await this.emitMadridEvent({
      type: 'transformation_deadline_approaching',
      internationalRegistrationNumber: tracked.internationalRegistrationNumber,
      trademarkId: tracked.trademarkId,
      timestamp: new Date(),
      payload: {
        transformationDeadline: notification.transformationDeadline.toISOString(),
        daysRemaining: Math.ceil(
          (notification.transformationDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        ),
        countriesForTransformation: notification.countriesForTransformation,
        action: 'File national applications in desired countries within 3 months to preserve priority',
      },
      severity: 'critical',
    });
  }

  /**
   * Emit a Madrid event via EventBridge.
   */
  private async emitMadridEvent(event: MadridEvent): Promise<void> {
    const eventTypeMap: Record<MadridEventType, string> = {
      designation_accepted: 'Madrid.DesignationAccepted',
      designation_refused: 'Madrid.DesignationRefused',
      designation_provisionally_refused: 'Madrid.DesignationProvisionallyRefused',
      central_attack_notified: 'Madrid.CentralAttackNotified',
      renewal_due: 'Madrid.RenewalDue',
      renewal_overdue: 'Madrid.RenewalOverdue',
      registration_status_changed: 'Madrid.RegistrationStatusChanged',
      transformation_deadline_approaching: 'Madrid.TransformationDeadlineApproaching',
    };

    await this.publisher.publish({
      type: eventTypeMap[event.type],
      aggregateType: 'MadridRegistration',
      aggregateId: event.internationalRegistrationNumber,
      timestamp: event.timestamp,
      payload: {
        trademarkId: event.trademarkId,
        severity: event.severity,
        ...event.payload,
      },
    });

    console.log(`[MadridSync] Emitted event: ${eventTypeMap[event.type]} for ${event.internationalRegistrationNumber}`);
  }

  // ===========================================================================
  // Scheduling
  // ===========================================================================

  /**
   * Start periodic sync job.
   */
  startSyncJob(intervalMinutes = 60): void {
    if (this.syncTimer) {
      this.stopSyncJob();
    }

    this.syncJob = {
      jobId: randomUUID(),
      intervalMinutes,
      enabled: true,
      lastRunAt: undefined,
      nextRunAt: new Date(Date.now() + intervalMinutes * 60 * 1000),
    };

    this.syncTimer = setInterval(async () => {
      try {
        await this.runSync();
      } catch (error) {
        console.error('[MadridSync] Scheduled sync failed:', error);
      }
    }, intervalMinutes * 60 * 1000);

    console.log(`[MadridSync] Started sync job ${this.syncJob.jobId}, interval: ${intervalMinutes} minutes`);
  }

  /**
   * Stop periodic sync job.
   */
  stopSyncJob(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.syncJob) {
      this.syncJob.enabled = false;
      console.log(`[MadridSync] Stopped sync job ${this.syncJob.jobId}`);
    }
  }

  /**
   * Get sync job status.
   */
  getSyncJobStatus(): SyncJobConfig | null {
    return this.syncJob;
  }

  /**
   * Check if sync is currently running.
   */
  isSyncRunning(): boolean {
    return this.isRunning;
  }

  // ===========================================================================
  // Direct Monitoring Methods
  // ===========================================================================

  /**
   * Poll for designation updates for a specific registration.
   */
  async pollDesignationUpdates(
    internationalRegistrationNumber: string
  ): Promise<CountryDesignation[]> {
    const registration = await this.client.getRegistrationStatus(internationalRegistrationNumber);
    return registration.designations;
  }

  /**
   * Monitor for central attack on a specific registration.
   */
  async monitorCentralAttack(
    internationalRegistrationNumber: string
  ): Promise<CentralAttackNotification | null> {
    return this.client.checkCentralAttackStatus(internationalRegistrationNumber);
  }

  /**
   * Get renewal deadline status for a specific registration.
   */
  async getRenewalDeadline(internationalRegistrationNumber: string): Promise<MadridRenewalStatus> {
    return this.client.getRenewalStatus(internationalRegistrationNumber);
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Delay execution.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const wipoMadridSyncService = new WIPOMadridSyncService();
