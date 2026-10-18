/**
 * WIPO Madrid Event Mapper
 *
 * Maps WIPO Madrid events to domain events for the intellectual property service.
 * Handles transformation of Madrid Protocol events into actions:
 * - DesignationAccepted -> update trademark territories
 * - DesignationRefused -> notify, create appeal deadline
 * - CentralAttackNotified -> CRITICAL alert, create transformation deadline
 * - RenewalDue -> create renewal deadline
 *
 * @module infrastructure/external/wipo
 */

import { randomUUID } from 'crypto';
import {
  type MadridEvent,
  type MadridEventType,
  type CountryDesignation,
  type CentralAttackNotification,
  type MadridRenewalStatus,
} from './madrid-types.js';
import {
  EventBridgePublisher,
  eventBridgePublisher,
  type DomainEvent,
} from '../../aws/eventbridge-publisher.js';

/**
 * Domain action resulting from a Madrid event.
 */
export interface MadridDomainAction {
  /** Action type */
  type:
    | 'update_trademark_territories'
    | 'create_appeal_deadline'
    | 'create_response_deadline'
    | 'create_transformation_deadline'
    | 'create_renewal_deadline'
    | 'send_critical_alert'
    | 'send_warning_alert'
    | 'send_info_notification'
    | 'update_trademark_status';
  /** Trademark ID to act on */
  trademarkId: string;
  /** International registration number */
  internationalRegistrationNumber: string;
  /** Priority of the action */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Action payload */
  payload: Record<string, unknown>;
  /** Deadline date if applicable */
  deadlineDate?: Date;
  /** Notes */
  notes?: string;
}

/**
 * Result of mapping a Madrid event.
 */
export interface EventMappingResult {
  /** Original event */
  sourceEvent: MadridEvent;
  /** Domain events to publish */
  domainEvents: DomainEvent[];
  /** Actions to execute */
  actions: MadridDomainAction[];
  /** Whether mapping was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Country name mapping for common countries.
 */
const COUNTRY_NAMES: Record<string, string> = {
  'US': 'United States',
  'EM': 'European Union',
  'CN': 'China',
  'JP': 'Japan',
  'KR': 'South Korea',
  'AU': 'Australia',
  'BR': 'Brazil',
  'IN': 'India',
  'MX': 'Mexico',
  'CA': 'Canada',
  'GB': 'United Kingdom',
  'DE': 'Germany',
  'FR': 'France',
  'IT': 'Italy',
  'ES': 'Spain',
  'RU': 'Russian Federation',
  'CH': 'Switzerland',
  'SG': 'Singapore',
  'NZ': 'New Zealand',
  'ZA': 'South Africa',
};

/**
 * WIPO Madrid Event Mapper
 *
 * Maps Madrid Protocol events to domain events and actions.
 */
export class WIPOMadridEventMapper {
  private readonly publisher: EventBridgePublisher;

  constructor(publisher: EventBridgePublisher = eventBridgePublisher) {
    this.publisher = publisher;
  }

  // ===========================================================================
  // Main Mapping Method
  // ===========================================================================

  /**
   * Map a Madrid event to domain events and actions.
   */
  mapEvent(event: MadridEvent): EventMappingResult {
    try {
      const mapper = this.getMapper(event.type);
      return mapper(event);
    } catch (error) {
      return {
        sourceEvent: event,
        domainEvents: [],
        actions: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Map and publish a Madrid event.
   */
  async mapAndPublish(event: MadridEvent): Promise<EventMappingResult> {
    const result = this.mapEvent(event);

    if (result.success && result.domainEvents.length > 0) {
      for (const domainEvent of result.domainEvents) {
        await this.publisher.publish(domainEvent);
      }
    }

    return result;
  }

  /**
   * Map multiple events.
   */
  mapEvents(events: MadridEvent[]): EventMappingResult[] {
    return events.map(event => this.mapEvent(event));
  }

  // ===========================================================================
  // Event Type Mappers
  // ===========================================================================

  /**
   * Get the appropriate mapper for an event type.
   */
  private getMapper(eventType: MadridEventType): (event: MadridEvent) => EventMappingResult {
    const mappers: Record<MadridEventType, (event: MadridEvent) => EventMappingResult> = {
      designation_accepted: this.mapDesignationAccepted.bind(this),
      designation_refused: this.mapDesignationRefused.bind(this),
      designation_provisionally_refused: this.mapDesignationProvisionallyRefused.bind(this),
      central_attack_notified: this.mapCentralAttackNotified.bind(this),
      renewal_due: this.mapRenewalDue.bind(this),
      renewal_overdue: this.mapRenewalOverdue.bind(this),
      registration_status_changed: this.mapRegistrationStatusChanged.bind(this),
      transformation_deadline_approaching: this.mapTransformationDeadlineApproaching.bind(this),
    };

    return mappers[eventType];
  }

  /**
   * Map designation accepted event.
   * -> Update trademark territories
   * -> Send notification
   */
  private mapDesignationAccepted(event: MadridEvent): EventMappingResult {
    const payload = event.payload as {
      countryCode: string;
      countryName?: string;
      protectionDate?: string;
      classesProtected?: number[];
    };

    const countryName = payload.countryName ?? COUNTRY_NAMES[payload.countryCode] ?? payload.countryCode;

    const domainEvents: DomainEvent[] = [
      {
        type: 'Trademark.TerritoryProtected',
        aggregateType: 'Trademark',
        aggregateId: event.trademarkId ?? event.internationalRegistrationNumber,
        timestamp: event.timestamp,
        payload: {
          internationalRegistrationNumber: event.internationalRegistrationNumber,
          countryCode: payload.countryCode,
          countryName,
          protectionDate: payload.protectionDate ?? event.timestamp.toISOString(),
          protectionSource: 'madrid_protocol',
          classesProtected: payload.classesProtected ?? [],
        },
      },
    ];

    const actions: MadridDomainAction[] = [
      {
        type: 'update_trademark_territories',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'medium',
        payload: {
          action: 'add_territory',
          countryCode: payload.countryCode,
          countryName,
          protectionDate: payload.protectionDate,
          classesProtected: payload.classesProtected,
        },
        notes: `Madrid designation accepted in ${countryName}`,
      },
      {
        type: 'send_info_notification',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'low',
        payload: {
          subject: `Madrid Designation Accepted: ${countryName}`,
          message: `Your trademark protection has been granted in ${countryName} via the Madrid Protocol.`,
          countryCode: payload.countryCode,
        },
      },
    ];

    return {
      sourceEvent: event,
      domainEvents,
      actions,
      success: true,
    };
  }

  /**
   * Map designation refused event.
   * -> Create appeal deadline
   * -> Send warning notification
   */
  private mapDesignationRefused(event: MadridEvent): EventMappingResult {
    const payload = event.payload as {
      countryCode: string;
      countryName?: string;
      refusalDate?: string;
      refusalReason?: string;
      appealDeadline?: string;
      classesRefused?: number[];
    };

    const countryName = payload.countryName ?? COUNTRY_NAMES[payload.countryCode] ?? payload.countryCode;
    const appealDeadline = payload.appealDeadline ? new Date(payload.appealDeadline) : undefined;

    const domainEvents: DomainEvent[] = [
      {
        type: 'Trademark.DesignationRefused',
        aggregateType: 'Trademark',
        aggregateId: event.trademarkId ?? event.internationalRegistrationNumber,
        timestamp: event.timestamp,
        payload: {
          internationalRegistrationNumber: event.internationalRegistrationNumber,
          countryCode: payload.countryCode,
          countryName,
          refusalDate: payload.refusalDate ?? event.timestamp.toISOString(),
          refusalReason: payload.refusalReason,
          appealDeadline: payload.appealDeadline,
          classesRefused: payload.classesRefused,
        },
      },
    ];

    const actions: MadridDomainAction[] = [
      {
        type: 'send_warning_alert',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'high',
        payload: {
          subject: `Madrid Designation REFUSED: ${countryName}`,
          message: `Your trademark designation has been refused in ${countryName}. Reason: ${payload.refusalReason ?? 'Not specified'}. ${appealDeadline ? `Appeal deadline: ${appealDeadline.toISOString().split('T')[0]}` : 'Check for appeal options.'}`,
          countryCode: payload.countryCode,
          refusalReason: payload.refusalReason,
        },
      },
    ];

    // Create appeal deadline if available
    if (appealDeadline) {
      actions.push({
        type: 'create_appeal_deadline',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'high',
        payload: {
          countryCode: payload.countryCode,
          countryName,
          refusalReason: payload.refusalReason,
          deadlineType: 'madrid_appeal',
          action: 'File appeal or accept refusal',
        },
        deadlineDate: appealDeadline,
        notes: `Appeal deadline for ${countryName} designation refusal`,
      });
    }

    return {
      sourceEvent: event,
      domainEvents,
      actions,
      success: true,
    };
  }

  /**
   * Map designation provisionally refused event.
   * -> Create response deadline
   * -> Send warning notification
   */
  private mapDesignationProvisionallyRefused(event: MadridEvent): EventMappingResult {
    const payload = event.payload as {
      countryCode: string;
      countryName?: string;
      refusalReason?: string;
      responseDeadline?: string;
      classesProtected?: number[];
      classesRefused?: number[];
    };

    const countryName = payload.countryName ?? COUNTRY_NAMES[payload.countryCode] ?? payload.countryCode;
    const responseDeadline = payload.responseDeadline ? new Date(payload.responseDeadline) : undefined;

    const domainEvents: DomainEvent[] = [
      {
        type: 'Trademark.DesignationProvisionallyRefused',
        aggregateType: 'Trademark',
        aggregateId: event.trademarkId ?? event.internationalRegistrationNumber,
        timestamp: event.timestamp,
        payload: {
          internationalRegistrationNumber: event.internationalRegistrationNumber,
          countryCode: payload.countryCode,
          countryName,
          refusalReason: payload.refusalReason,
          responseDeadline: payload.responseDeadline,
          classesProtected: payload.classesProtected,
          classesRefused: payload.classesRefused,
        },
      },
    ];

    const actions: MadridDomainAction[] = [
      {
        type: 'send_warning_alert',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'high',
        payload: {
          subject: `Madrid Office Action: ${countryName}`,
          message: `Your trademark designation has received a provisional refusal in ${countryName}. A response is required. ${responseDeadline ? `Deadline: ${responseDeadline.toISOString().split('T')[0]}` : 'Check the notification for deadlines.'}`,
          countryCode: payload.countryCode,
          refusalReason: payload.refusalReason,
        },
      },
    ];

    // Create response deadline if available
    if (responseDeadline) {
      actions.push({
        type: 'create_response_deadline',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'critical',
        payload: {
          countryCode: payload.countryCode,
          countryName,
          refusalReason: payload.refusalReason,
          deadlineType: 'madrid_response',
          action: 'File response to office action',
          requiresLocalCounsel: true,
        },
        deadlineDate: responseDeadline,
        notes: `Response deadline for ${countryName} provisional refusal. Local counsel may be required.`,
      });
    }

    return {
      sourceEvent: event,
      domainEvents,
      actions,
      success: true,
    };
  }

  /**
   * Map central attack notified event.
   * -> CRITICAL alert
   * -> Create transformation deadline
   * -> Update trademark status
   */
  private mapCentralAttackNotified(event: MadridEvent): EventMappingResult {
    const payload = event.payload as {
      notificationId: string;
      notificationDate: string;
      attackType: string;
      officeOfOrigin: string;
      ceasedDate: string;
      classesAffected: number[];
      fullCancellation: boolean;
      transformationDeadline: string;
      countriesForTransformation: string[];
    };

    const transformationDeadline = new Date(payload.transformationDeadline);
    const daysRemaining = Math.ceil(
      (transformationDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    const domainEvents: DomainEvent[] = [
      {
        type: 'Trademark.CentralAttackNotified',
        aggregateType: 'Trademark',
        aggregateId: event.trademarkId ?? event.internationalRegistrationNumber,
        timestamp: event.timestamp,
        payload: {
          internationalRegistrationNumber: event.internationalRegistrationNumber,
          notificationId: payload.notificationId,
          attackType: payload.attackType,
          officeOfOrigin: payload.officeOfOrigin,
          ceasedDate: payload.ceasedDate,
          classesAffected: payload.classesAffected,
          fullCancellation: payload.fullCancellation,
          transformationDeadline: payload.transformationDeadline,
          countriesForTransformation: payload.countriesForTransformation,
          severity: 'critical',
        },
      },
    ];

    const actions: MadridDomainAction[] = [
      {
        type: 'send_critical_alert',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'critical',
        payload: {
          subject: 'CRITICAL: Madrid Central Attack Notification',
          message: `Your Madrid Protocol registration ${event.internationalRegistrationNumber} is subject to a central attack. The basic mark in ${payload.officeOfOrigin} has been ${payload.attackType}. You have ${daysRemaining} days (until ${transformationDeadline.toISOString().split('T')[0]}) to file transformation requests to preserve protection in designated countries.`,
          alertType: 'central_attack',
          attackType: payload.attackType,
          officeOfOrigin: payload.officeOfOrigin,
          transformationDeadline: payload.transformationDeadline,
          countriesForTransformation: payload.countriesForTransformation,
        },
      },
      {
        type: 'create_transformation_deadline',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'critical',
        payload: {
          deadlineType: 'madrid_transformation',
          action: 'File transformation requests in desired countries',
          countriesForTransformation: payload.countriesForTransformation,
          classesAffected: payload.classesAffected,
          attackType: payload.attackType,
          officeOfOrigin: payload.officeOfOrigin,
        },
        deadlineDate: transformationDeadline,
        notes: `CRITICAL: 3-month deadline to file transformation requests. Countries available: ${payload.countriesForTransformation.join(', ')}`,
      },
      {
        type: 'update_trademark_status',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'critical',
        payload: {
          newStatus: 'central_attack_pending',
          attackType: payload.attackType,
          ceasedDate: payload.ceasedDate,
          transformationDeadline: payload.transformationDeadline,
        },
      },
    ];

    return {
      sourceEvent: event,
      domainEvents,
      actions,
      success: true,
    };
  }

  /**
   * Map renewal due event.
   * -> Create renewal deadline
   * -> Send reminder notification
   */
  private mapRenewalDue(event: MadridEvent): EventMappingResult {
    const payload = event.payload as {
      expirationDate: string;
      daysUntilExpiration: number;
      renewalWindowOpens: string;
      graceDeadline: string;
      estimatedFee: number;
      designationCount: number;
      inGracePeriod: boolean;
    };

    const expirationDate = new Date(payload.expirationDate);
    const priority = payload.daysUntilExpiration <= 30 ? 'high' : 'medium';

    const domainEvents: DomainEvent[] = [
      {
        type: 'Trademark.MadridRenewalDue',
        aggregateType: 'Trademark',
        aggregateId: event.trademarkId ?? event.internationalRegistrationNumber,
        timestamp: event.timestamp,
        payload: {
          internationalRegistrationNumber: event.internationalRegistrationNumber,
          expirationDate: payload.expirationDate,
          daysUntilExpiration: payload.daysUntilExpiration,
          estimatedFee: payload.estimatedFee,
          feeCurrency: 'CHF',
          designationCount: payload.designationCount,
        },
      },
    ];

    const actions: MadridDomainAction[] = [
      {
        type: 'create_renewal_deadline',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority,
        payload: {
          deadlineType: 'madrid_renewal',
          action: 'Pay Madrid Protocol renewal fee to WIPO',
          estimatedFee: payload.estimatedFee,
          feeCurrency: 'CHF',
          designationCount: payload.designationCount,
          graceDeadline: payload.graceDeadline,
        },
        deadlineDate: expirationDate,
        notes: `Madrid renewal due. Estimated fee: ${payload.estimatedFee} CHF for ${payload.designationCount} designations.`,
      },
      {
        type: 'send_info_notification',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'medium',
        payload: {
          subject: `Madrid Renewal Reminder: ${payload.daysUntilExpiration} days remaining`,
          message: `Your Madrid Protocol registration ${event.internationalRegistrationNumber} expires on ${payload.expirationDate.split('T')[0]}. Estimated renewal fee: ${payload.estimatedFee} CHF.`,
          notificationType: 'renewal_reminder',
        },
      },
    ];

    return {
      sourceEvent: event,
      domainEvents,
      actions,
      success: true,
    };
  }

  /**
   * Map renewal overdue event.
   * -> Critical alert
   * -> Create grace period deadline
   */
  private mapRenewalOverdue(event: MadridEvent): EventMappingResult {
    const payload = event.payload as {
      expirationDate: string;
      daysUntilExpiration: number; // Negative when overdue
      graceDeadline: string;
      estimatedFee: number;
      designationCount: number;
      inGracePeriod: boolean;
    };

    const graceDeadline = new Date(payload.graceDeadline);
    const daysIntoGrace = Math.abs(payload.daysUntilExpiration);

    const domainEvents: DomainEvent[] = [
      {
        type: 'Trademark.MadridRenewalOverdue',
        aggregateType: 'Trademark',
        aggregateId: event.trademarkId ?? event.internationalRegistrationNumber,
        timestamp: event.timestamp,
        payload: {
          internationalRegistrationNumber: event.internationalRegistrationNumber,
          expirationDate: payload.expirationDate,
          graceDeadline: payload.graceDeadline,
          daysIntoGracePeriod: daysIntoGrace,
          estimatedFeeWithSurcharge: payload.estimatedFee * 1.5, // Grace period surcharge
        },
      },
    ];

    const actions: MadridDomainAction[] = [
      {
        type: 'send_critical_alert',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'critical',
        payload: {
          subject: 'URGENT: Madrid Renewal OVERDUE - Grace Period Active',
          message: `Your Madrid Protocol registration ${event.internationalRegistrationNumber} has expired and is in the 6-month grace period. Pay renewal fee with surcharge by ${payload.graceDeadline.split('T')[0]} or protection will be lost in all designated countries.`,
          alertType: 'renewal_overdue',
          graceDeadline: payload.graceDeadline,
          daysIntoGrace,
        },
      },
      {
        type: 'create_renewal_deadline',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'critical',
        payload: {
          deadlineType: 'madrid_renewal_grace',
          action: 'Pay Madrid renewal fee with surcharge URGENTLY',
          estimatedFee: payload.estimatedFee * 1.5,
          feeCurrency: 'CHF',
          designationCount: payload.designationCount,
          isGracePeriod: true,
        },
        deadlineDate: graceDeadline,
        notes: `URGENT: Grace period renewal. Surcharge applies. Failure to renew will result in loss of protection.`,
      },
    ];

    return {
      sourceEvent: event,
      domainEvents,
      actions,
      success: true,
    };
  }

  /**
   * Map registration status changed event.
   * -> Update trademark status
   * -> Send appropriate notification
   */
  private mapRegistrationStatusChanged(event: MadridEvent): EventMappingResult {
    const payload = event.payload as {
      previousStatus: string;
      newStatus: string;
      registrationDate?: string;
      expirationDate?: string;
    };

    const domainEvents: DomainEvent[] = [
      {
        type: 'Trademark.MadridStatusChanged',
        aggregateType: 'Trademark',
        aggregateId: event.trademarkId ?? event.internationalRegistrationNumber,
        timestamp: event.timestamp,
        payload: {
          internationalRegistrationNumber: event.internationalRegistrationNumber,
          previousStatus: payload.previousStatus,
          newStatus: payload.newStatus,
          registrationDate: payload.registrationDate,
          expirationDate: payload.expirationDate,
        },
      },
    ];

    const actions: MadridDomainAction[] = [
      {
        type: 'update_trademark_status',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: payload.newStatus === 'cancelled' ? 'critical' : 'medium',
        payload: {
          newStatus: payload.newStatus,
          previousStatus: payload.previousStatus,
        },
      },
    ];

    // Add appropriate notification based on new status
    if (payload.newStatus === 'cancelled') {
      actions.push({
        type: 'send_critical_alert',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'critical',
        payload: {
          subject: 'CRITICAL: Madrid Registration Cancelled',
          message: `Your Madrid Protocol registration ${event.internationalRegistrationNumber} has been cancelled. Review transformation options if applicable.`,
          alertType: 'registration_cancelled',
        },
      });
    } else if (payload.newStatus === 'registered') {
      actions.push({
        type: 'send_info_notification',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'low',
        payload: {
          subject: 'Madrid Registration Confirmed',
          message: `Your Madrid Protocol application has been registered as ${event.internationalRegistrationNumber}.`,
          notificationType: 'registration_confirmed',
        },
      });
    }

    return {
      sourceEvent: event,
      domainEvents,
      actions,
      success: true,
    };
  }

  /**
   * Map transformation deadline approaching event.
   * -> Critical alert (already handled by central attack, but reinforcement)
   */
  private mapTransformationDeadlineApproaching(event: MadridEvent): EventMappingResult {
    const payload = event.payload as {
      transformationDeadline: string;
      daysRemaining: number;
      countriesForTransformation: string[];
      action: string;
    };

    const transformationDeadline = new Date(payload.transformationDeadline);

    const domainEvents: DomainEvent[] = [
      {
        type: 'Trademark.TransformationDeadlineApproaching',
        aggregateType: 'Trademark',
        aggregateId: event.trademarkId ?? event.internationalRegistrationNumber,
        timestamp: event.timestamp,
        payload: {
          internationalRegistrationNumber: event.internationalRegistrationNumber,
          transformationDeadline: payload.transformationDeadline,
          daysRemaining: payload.daysRemaining,
          countriesForTransformation: payload.countriesForTransformation,
        },
      },
    ];

    const actions: MadridDomainAction[] = [
      {
        type: 'send_critical_alert',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'critical',
        payload: {
          subject: `URGENT: ${payload.daysRemaining} days to file transformation requests`,
          message: payload.action,
          alertType: 'transformation_deadline',
          countriesForTransformation: payload.countriesForTransformation,
          transformationDeadline: payload.transformationDeadline,
        },
      },
    ];

    // If deadline is very close, also create/update the deadline
    if (payload.daysRemaining <= 30) {
      actions.push({
        type: 'create_transformation_deadline',
        trademarkId: event.trademarkId ?? '',
        internationalRegistrationNumber: event.internationalRegistrationNumber,
        priority: 'critical',
        payload: {
          deadlineType: 'madrid_transformation',
          action: payload.action,
          countriesForTransformation: payload.countriesForTransformation,
          daysRemaining: payload.daysRemaining,
        },
        deadlineDate: transformationDeadline,
        notes: `CRITICAL: Only ${payload.daysRemaining} days remaining to preserve protection.`,
      });
    }

    return {
      sourceEvent: event,
      domainEvents,
      actions,
      success: true,
    };
  }
}

// Singleton instance
export const wipoMadridEventMapper = new WIPOMadridEventMapper();
