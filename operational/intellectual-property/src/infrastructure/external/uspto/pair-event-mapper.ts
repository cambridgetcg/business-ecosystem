/**
 * USPTO PAIR Event Mapper
 *
 * Maps USPTO PAIR events to domain events and deadline creation.
 * Translates external patent office events into internal system actions.
 *
 * @module infrastructure/external/uspto
 */

import { randomUUID } from 'crypto';
import type {
  StatusChangeDetected,
  OfficeActionDetected,
  GrantDetected,
  PublicationDetected,
  AbandonmentDetected,
  MaintenanceFeeWindowOpened,
  OfficeAction,
  PatentGrant,
  MaintenanceFee,
  MaintenanceFeeWindow,
} from './pair-types.js';

/**
 * Domain event types emitted from USPTO sync.
 */
export type USPTODomainEventType =
  | 'USPTO.OfficeActionReceived'
  | 'USPTO.PatentPublished'
  | 'USPTO.PatentGranted'
  | 'USPTO.PatentAbandoned'
  | 'USPTO.MaintenanceFeeWindowOpened'
  | 'USPTO.StatusChanged'
  | 'USPTO.ResponseDeadlineApproaching'
  | 'USPTO.ResponseOverdue';

/**
 * Base structure for USPTO domain events.
 */
export interface USPTODomainEvent {
  id: string;
  type: USPTODomainEventType;
  occurredAt: Date;
  patentId: string;
  applicationNumber: string;
  payload: Record<string, unknown>;
  metadata?: {
    correlationId?: string;
    syncId?: string;
    source: string;
  };
}

/**
 * Deadline to be created from USPTO events.
 */
export interface DeadlineToCreate {
  assetId: string;
  assetType: 'patent';
  deadlineType: string;
  title: string;
  description: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  jurisdiction: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result of mapping USPTO events to domain events.
 */
export interface EventMappingResult {
  domainEvents: USPTODomainEvent[];
  deadlinesToCreate: DeadlineToCreate[];
  notifications: NotificationToSend[];
}

/**
 * Notification to send based on USPTO events.
 */
export interface NotificationToSend {
  type: 'email' | 'sms' | 'in_app' | 'slack';
  priority: 'low' | 'medium' | 'high' | 'critical';
  recipient: string;
  subject: string;
  message: string;
  relatedAssetId: string;
  relatedAssetType: 'patent';
}

/**
 * USPTO PAIR Event Mapper
 *
 * Transforms USPTO PAIR events into:
 * - Domain events for the event bus
 * - Deadline creation requests
 * - Notification triggers
 *
 * Event Mappings:
 * - OfficeActionReceived -> Create response deadline
 * - PatentPublished -> Update patent status
 * - PatentGranted -> Update status, create maintenance fee schedule
 * - PatentAbandoned -> Update status, notify stakeholders
 * - MaintenanceFeeWindowOpened -> Create maintenance fee deadline
 */
export class USPTOPairEventMapper {
  private readonly syncId: string;

  constructor(syncId?: string) {
    this.syncId = syncId ?? randomUUID();
  }

  /**
   * Map a detected status change to domain events.
   */
  mapStatusChange(change: StatusChangeDetected): EventMappingResult {
    const result: EventMappingResult = {
      domainEvents: [],
      deadlinesToCreate: [],
      notifications: [],
    };

    // Create status changed event
    result.domainEvents.push(this.createDomainEvent(
      'USPTO.StatusChanged',
      change.patentId,
      change.applicationNumber,
      {
        previousStatus: change.previousStatus,
        newStatus: change.newStatus,
        changeDate: change.changeDate.toISOString(),
        details: change.details,
      }
    ));

    // Create notification for significant status changes
    if (this.isSignificantStatusChange(change.previousStatus, change.newStatus)) {
      result.notifications.push({
        type: 'email',
        priority: 'high',
        recipient: 'ip-team',
        subject: `Patent Status Changed: ${change.applicationNumber}`,
        message: `Patent application ${change.applicationNumber} status changed from ${change.previousStatus} to ${change.newStatus}. ${change.details}`,
        relatedAssetId: change.patentId,
        relatedAssetType: 'patent',
      });
    }

    return result;
  }

  /**
   * Map an office action to domain events and deadlines.
   */
  mapOfficeActionReceived(detection: OfficeActionDetected): EventMappingResult {
    const result: EventMappingResult = {
      domainEvents: [],
      deadlinesToCreate: [],
      notifications: [],
    };

    const { officeAction, patentId, applicationNumber } = detection;

    // Create office action received event
    result.domainEvents.push(this.createDomainEvent(
      'USPTO.OfficeActionReceived',
      patentId,
      applicationNumber,
      {
        officeActionId: officeAction.id,
        actionType: officeAction.actionType,
        mailedDate: officeAction.mailedDate.toISOString(),
        responseDeadline: officeAction.responseDeadline.toISOString(),
        examinerName: officeAction.examinerName,
        summary: officeAction.summary,
        rejectedClaims: officeAction.rejectedClaims,
        allowedClaims: officeAction.allowedClaims,
      }
    ));

    // Create response deadline if response is required
    if (this.requiresResponse(officeAction)) {
      const deadline = this.createOfficeActionDeadline(officeAction, patentId);
      result.deadlinesToCreate.push(deadline);

      // Determine notification priority based on action type
      const priority = this.getOfficeActionPriority(officeAction);

      result.notifications.push({
        type: 'email',
        priority,
        recipient: 'ip-team',
        subject: `Office Action Received: ${applicationNumber} - ${officeAction.actionType}`,
        message: this.buildOfficeActionMessage(officeAction, applicationNumber),
        relatedAssetId: patentId,
        relatedAssetType: 'patent',
      });
    }

    return result;
  }

  /**
   * Map a patent publication to domain events.
   */
  mapPatentPublished(detection: PublicationDetected): EventMappingResult {
    const result: EventMappingResult = {
      domainEvents: [],
      deadlinesToCreate: [],
      notifications: [],
    };

    result.domainEvents.push(this.createDomainEvent(
      'USPTO.PatentPublished',
      detection.patentId,
      detection.applicationNumber,
      {
        publicationNumber: detection.publicationNumber,
        publicationDate: detection.publicationDate.toISOString(),
      }
    ));

    result.notifications.push({
      type: 'email',
      priority: 'medium',
      recipient: 'ip-team',
      subject: `Patent Application Published: ${detection.applicationNumber}`,
      message: `Patent application ${detection.applicationNumber} has been published as ${detection.publicationNumber} on ${detection.publicationDate.toLocaleDateString()}.`,
      relatedAssetId: detection.patentId,
      relatedAssetType: 'patent',
    });

    return result;
  }

  /**
   * Map a patent grant to domain events and maintenance fee schedule.
   */
  mapPatentGranted(detection: GrantDetected): EventMappingResult {
    const result: EventMappingResult = {
      domainEvents: [],
      deadlinesToCreate: [],
      notifications: [],
    };

    const { grant, patentId, applicationNumber } = detection;

    // Create patent granted event
    result.domainEvents.push(this.createDomainEvent(
      'USPTO.PatentGranted',
      patentId,
      applicationNumber,
      {
        patentNumber: grant.patentNumber,
        grantDate: grant.grantDate.toISOString(),
        expirationDate: grant.expirationDate.toISOString(),
        claimCount: grant.claims.length,
        independentClaimCount: grant.claims.filter(c => c.isIndependent).length,
        inventors: grant.inventors.map(i => i.name),
        assignee: grant.assignee?.name,
      }
    ));

    // Create maintenance fee schedule deadlines
    const maintenanceDeadlines = this.createMaintenanceFeeSchedule(grant, patentId);
    result.deadlinesToCreate.push(...maintenanceDeadlines);

    // Send grant notification
    result.notifications.push({
      type: 'email',
      priority: 'high',
      recipient: 'ip-team',
      subject: `Patent Granted: ${grant.patentNumber}`,
      message: this.buildPatentGrantedMessage(grant, applicationNumber),
      relatedAssetId: patentId,
      relatedAssetType: 'patent',
    });

    return result;
  }

  /**
   * Map a patent abandonment to domain events.
   */
  mapPatentAbandoned(detection: AbandonmentDetected): EventMappingResult {
    const result: EventMappingResult = {
      domainEvents: [],
      deadlinesToCreate: [],
      notifications: [],
    };

    result.domainEvents.push(this.createDomainEvent(
      'USPTO.PatentAbandoned',
      detection.patentId,
      detection.applicationNumber,
      {
        abandonmentDate: detection.abandonmentDate.toISOString(),
        reason: detection.reason,
        revivable: detection.revivable,
        revivalDeadline: detection.revivalDeadline?.toISOString(),
      }
    ));

    // If revivable, create revival deadline
    if (detection.revivable && detection.revivalDeadline) {
      result.deadlinesToCreate.push({
        assetId: detection.patentId,
        assetType: 'patent',
        deadlineType: 'patent_revival',
        title: `Revival Deadline: ${detection.applicationNumber}`,
        description: `Deadline to file petition to revive abandoned application ${detection.applicationNumber}. Reason for abandonment: ${detection.reason}`,
        dueDate: detection.revivalDeadline,
        priority: 'critical',
        jurisdiction: 'US',
        metadata: {
          abandonmentDate: detection.abandonmentDate.toISOString(),
          abandonmentReason: detection.reason,
        },
      });
    }

    // Critical notification for abandonment
    result.notifications.push({
      type: 'email',
      priority: 'critical',
      recipient: 'ip-team',
      subject: `URGENT: Patent Application Abandoned: ${detection.applicationNumber}`,
      message: this.buildAbandonmentMessage(detection),
      relatedAssetId: detection.patentId,
      relatedAssetType: 'patent',
    });

    return result;
  }

  /**
   * Map a maintenance fee window opening to domain events and deadlines.
   */
  mapMaintenanceFeeWindowOpened(window: MaintenanceFeeWindowOpened): EventMappingResult {
    const result: EventMappingResult = {
      domainEvents: [],
      deadlinesToCreate: [],
      notifications: [],
    };

    result.domainEvents.push(this.createDomainEvent(
      'USPTO.MaintenanceFeeWindowOpened',
      window.patentId,
      '', // No application number for granted patents
      {
        patentNumber: window.patentNumber,
        feeWindow: window.feeWindow,
        windowOpensDate: window.windowOpensDate.toISOString(),
        dueDate: window.dueDate.toISOString(),
        gracePeriodEnds: window.gracePeriodEnds.toISOString(),
        feeAmount: window.feeAmount,
      }
    ));

    // Create maintenance fee deadline
    result.deadlinesToCreate.push({
      assetId: window.patentId,
      assetType: 'patent',
      deadlineType: `patent_maintenance_${window.feeWindow.replace('.', '_')}`,
      title: `Maintenance Fee Due: ${window.patentNumber} (${window.feeWindow} year)`,
      description: `${window.feeWindow} year maintenance fee due for patent ${window.patentNumber}. Pay by ${window.dueDate.toLocaleDateString()} to avoid surcharge. Grace period ends ${window.gracePeriodEnds.toLocaleDateString()}.`,
      dueDate: window.dueDate,
      priority: 'high',
      jurisdiction: 'US',
      amount: window.feeAmount.large, // Use large entity as default
      currency: 'USD',
      metadata: {
        patentNumber: window.patentNumber,
        feeWindow: window.feeWindow,
        gracePeriodEnds: window.gracePeriodEnds.toISOString(),
        microFee: window.feeAmount.micro,
        smallFee: window.feeAmount.small,
        largeFee: window.feeAmount.large,
      },
    });

    // Notification about fee window opening
    result.notifications.push({
      type: 'email',
      priority: 'medium',
      recipient: 'ip-team',
      subject: `Maintenance Fee Window Open: ${window.patentNumber}`,
      message: `The ${window.feeWindow} year maintenance fee window has opened for patent ${window.patentNumber}. Fee is due by ${window.dueDate.toLocaleDateString()}. Grace period (with surcharge) ends ${window.gracePeriodEnds.toLocaleDateString()}.`,
      relatedAssetId: window.patentId,
      relatedAssetType: 'patent',
    });

    return result;
  }

  /**
   * Map response deadline approaching (called by sync service).
   */
  mapResponseDeadlineApproaching(
    patentId: string,
    applicationNumber: string,
    officeAction: OfficeAction,
    daysUntilDeadline: number
  ): EventMappingResult {
    const result: EventMappingResult = {
      domainEvents: [],
      deadlinesToCreate: [],
      notifications: [],
    };

    result.domainEvents.push(this.createDomainEvent(
      'USPTO.ResponseDeadlineApproaching',
      patentId,
      applicationNumber,
      {
        officeActionId: officeAction.id,
        actionType: officeAction.actionType,
        responseDeadline: officeAction.responseDeadline.toISOString(),
        daysUntilDeadline,
      }
    ));

    // Escalate notifications as deadline approaches
    const priority = daysUntilDeadline <= 7 ? 'critical' :
                     daysUntilDeadline <= 14 ? 'high' :
                     daysUntilDeadline <= 30 ? 'medium' : 'low';

    result.notifications.push({
      type: 'email',
      priority,
      recipient: 'ip-team',
      subject: `Response Deadline in ${daysUntilDeadline} Days: ${applicationNumber}`,
      message: `Response to ${officeAction.actionType} office action for application ${applicationNumber} is due in ${daysUntilDeadline} days (${officeAction.responseDeadline.toLocaleDateString()}).`,
      relatedAssetId: patentId,
      relatedAssetType: 'patent',
    });

    return result;
  }

  /**
   * Map response overdue event.
   */
  mapResponseOverdue(
    patentId: string,
    applicationNumber: string,
    officeAction: OfficeAction,
    daysOverdue: number
  ): EventMappingResult {
    const result: EventMappingResult = {
      domainEvents: [],
      deadlinesToCreate: [],
      notifications: [],
    };

    result.domainEvents.push(this.createDomainEvent(
      'USPTO.ResponseOverdue',
      patentId,
      applicationNumber,
      {
        officeActionId: officeAction.id,
        actionType: officeAction.actionType,
        responseDeadline: officeAction.responseDeadline.toISOString(),
        daysOverdue,
      }
    ));

    result.notifications.push({
      type: 'email',
      priority: 'critical',
      recipient: 'ip-team',
      subject: `OVERDUE: Response Deadline Missed - ${applicationNumber}`,
      message: `The response deadline for ${officeAction.actionType} office action on application ${applicationNumber} is ${daysOverdue} days overdue. Immediate action required to prevent abandonment. Consider filing petition for extension of time or petition to revive.`,
      relatedAssetId: patentId,
      relatedAssetType: 'patent',
    });

    return result;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Create a standardized domain event.
   */
  private createDomainEvent(
    type: USPTODomainEventType,
    patentId: string,
    applicationNumber: string,
    payload: Record<string, unknown>
  ): USPTODomainEvent {
    return {
      id: randomUUID(),
      type,
      occurredAt: new Date(),
      patentId,
      applicationNumber,
      payload,
      metadata: {
        syncId: this.syncId,
        source: 'uspto-pair',
      },
    };
  }

  /**
   * Determine if a status change is significant enough to notify.
   */
  private isSignificantStatusChange(
    previousStatus: string,
    newStatus: string
  ): boolean {
    const significantTransitions = [
      { from: 'pending', to: 'published' },
      { from: 'pending', to: 'granted' },
      { from: 'published', to: 'granted' },
      { from: 'pending', to: 'abandoned' },
      { from: 'published', to: 'abandoned' },
    ];

    return significantTransitions.some(
      t => t.from === previousStatus && t.to === newStatus
    );
  }

  /**
   * Determine if an office action requires a response.
   */
  private requiresResponse(officeAction: OfficeAction): boolean {
    const nonResponseTypes = ['allowance', 'information_disclosure', 'examiner_interview'];
    return !nonResponseTypes.includes(officeAction.actionType);
  }

  /**
   * Get priority level for an office action.
   */
  private getOfficeActionPriority(
    officeAction: OfficeAction
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (officeAction.actionType === 'final') return 'critical';
    if (officeAction.actionType === 'non_final') return 'high';
    if (officeAction.actionType === 'requirement') return 'medium';
    return 'low';
  }

  /**
   * Create deadline for office action response.
   */
  private createOfficeActionDeadline(
    officeAction: OfficeAction,
    patentId: string
  ): DeadlineToCreate {
    const priority = this.getOfficeActionPriority(officeAction);

    return {
      assetId: patentId,
      assetType: 'patent',
      deadlineType: `office_action_response_${officeAction.actionType}`,
      title: `Response Due: ${officeAction.applicationNumber} - ${this.formatActionType(officeAction.actionType)}`,
      description: this.buildDeadlineDescription(officeAction),
      dueDate: officeAction.responseDeadline,
      priority,
      jurisdiction: 'US',
      metadata: {
        officeActionId: officeAction.id,
        officeActionType: officeAction.actionType,
        mailedDate: officeAction.mailedDate.toISOString(),
        examinerName: officeAction.examinerName,
        rejectedClaims: officeAction.rejectedClaims,
      },
    };
  }

  /**
   * Create maintenance fee schedule deadlines.
   */
  private createMaintenanceFeeSchedule(
    grant: PatentGrant,
    patentId: string
  ): DeadlineToCreate[] {
    const deadlines: DeadlineToCreate[] = [];
    const windows: MaintenanceFeeWindow[] = ['3.5', '7.5', '11.5'];

    for (const window of windows) {
      const years = parseFloat(window);
      const dueDate = new Date(grant.grantDate);
      dueDate.setFullYear(dueDate.getFullYear() + years);

      // Only create deadlines for future fees
      if (dueDate > new Date()) {
        deadlines.push({
          assetId: patentId,
          assetType: 'patent',
          deadlineType: `patent_maintenance_${window.replace('.', '_')}`,
          title: `Maintenance Fee (${window} year): ${grant.patentNumber}`,
          description: `${window} year maintenance fee for patent ${grant.patentNumber} granted on ${grant.grantDate.toLocaleDateString()}.`,
          dueDate,
          priority: 'high',
          jurisdiction: 'US',
          metadata: {
            patentNumber: grant.patentNumber,
            feeWindow: window,
            grantDate: grant.grantDate.toISOString(),
            entitySize: grant.entitySize,
          },
        });
      }
    }

    return deadlines;
  }

  /**
   * Format action type for display.
   */
  private formatActionType(actionType: string): string {
    const mappings: Record<string, string> = {
      'requirement': 'Restriction Requirement',
      'non_final': 'Non-Final Rejection',
      'final': 'Final Rejection',
      'advisory': 'Advisory Action',
      'allowance': 'Notice of Allowance',
      'examiner_interview': 'Examiner Interview',
      'information_disclosure': 'IDS',
      'other': 'Office Action',
    };
    return mappings[actionType] ?? actionType;
  }

  /**
   * Build description for office action deadline.
   */
  private buildDeadlineDescription(officeAction: OfficeAction): string {
    const lines = [
      `Response required for ${this.formatActionType(officeAction.actionType)} mailed on ${officeAction.mailedDate.toLocaleDateString()}.`,
    ];

    if (officeAction.rejectedClaims?.length) {
      lines.push(`Rejected claims: ${officeAction.rejectedClaims.join(', ')}`);
    }

    if (officeAction.allowedClaims?.length) {
      lines.push(`Allowed claims: ${officeAction.allowedClaims.join(', ')}`);
    }

    if (officeAction.summary) {
      lines.push(`Summary: ${officeAction.summary}`);
    }

    return lines.join('\n');
  }

  /**
   * Build message for office action notification.
   */
  private buildOfficeActionMessage(
    officeAction: OfficeAction,
    applicationNumber: string
  ): string {
    const lines = [
      `An office action has been received for patent application ${applicationNumber}.`,
      '',
      `Action Type: ${this.formatActionType(officeAction.actionType)}`,
      `Mailed Date: ${officeAction.mailedDate.toLocaleDateString()}`,
      `Response Deadline: ${officeAction.responseDeadline.toLocaleDateString()}`,
      `Examiner: ${officeAction.examinerName}`,
    ];

    if (officeAction.rejectedClaims?.length) {
      lines.push(`Rejected Claims: ${officeAction.rejectedClaims.join(', ')}`);
    }

    if (officeAction.summary) {
      lines.push('', `Summary: ${officeAction.summary}`);
    }

    return lines.join('\n');
  }

  /**
   * Build message for patent granted notification.
   */
  private buildPatentGrantedMessage(
    grant: PatentGrant,
    applicationNumber: string
  ): string {
    return [
      `Patent ${grant.patentNumber} has been granted!`,
      '',
      `Application Number: ${applicationNumber}`,
      `Grant Date: ${grant.grantDate.toLocaleDateString()}`,
      `Expiration Date: ${grant.expirationDate.toLocaleDateString()}`,
      `Title: ${grant.title}`,
      `Claims: ${grant.claims.length} (${grant.claims.filter(c => c.isIndependent).length} independent)`,
      `Inventors: ${grant.inventors.map(i => i.name).join(', ')}`,
      grant.assignee ? `Assignee: ${grant.assignee.name}` : '',
      '',
      'Maintenance fee schedule has been created. Next action: First maintenance fee due at 3.5 years.',
    ].filter(Boolean).join('\n');
  }

  /**
   * Build message for abandonment notification.
   */
  private buildAbandonmentMessage(detection: AbandonmentDetected): string {
    const lines = [
      `Patent application ${detection.applicationNumber} has been abandoned.`,
      '',
      `Abandonment Date: ${detection.abandonmentDate.toLocaleDateString()}`,
      `Reason: ${detection.reason}`,
    ];

    if (detection.revivable) {
      lines.push('');
      lines.push('This application MAY be revivable.');
      if (detection.revivalDeadline) {
        lines.push(`Revival Deadline: ${detection.revivalDeadline.toLocaleDateString()}`);
      }
      lines.push('Consider filing a petition to revive with appropriate fees and explanations.');
    } else {
      lines.push('');
      lines.push('This application is NOT revivable under current rules.');
    }

    return lines.join('\n');
  }
}

// Factory function for creating mapper with sync ID
export function createEventMapper(syncId?: string): USPTOPairEventMapper {
  return new USPTOPairEventMapper(syncId);
}

// Singleton instance for general use
export const usptoPairEventMapper = new USPTOPairEventMapper();
