/**
 * Webhook Handler
 *
 * Processes incoming webhook payloads from IP watch services.
 * Maps external formats to domain events and creates database records.
 *
 * @module application/handlers
 */

import pino from 'pino';
import type {
  WebhookProvider,
  WebhookProcessingResult,
  PatentWatchAlert,
  TrademarkWatchAlert,
  DomainWatchAlert,
  LitigationAlert,
  PatentWatchAlertType,
  TrademarkWatchAlertType,
  DomainWatchAlertType,
  LitigationAlertType,
} from '../../infrastructure/webhooks/webhook-types.js';
import {
  mapToPatentWatchAlert,
  mapToTrademarkWatchAlert,
  mapToDomainWatchAlert,
  mapToLitigationAlert,
} from '../../infrastructure/webhooks/webhook-config.js';
import { webhookValidator } from '../../infrastructure/webhooks/webhook-validator.js';

const logger = pino({ name: 'webhook-handler' });

// ============================================================================
// Types
// ============================================================================

/**
 * Event publisher interface for domain events.
 */
export interface WebhookEventPublisher {
  publish(eventType: string, aggregateId: string, payload: Record<string, unknown>): Promise<void>;
}

/**
 * Repository for storing webhook alerts.
 */
export interface WebhookAlertRepository {
  savePatentAlert(alert: PatentWatchAlert): Promise<string>;
  saveTrademarkAlert(alert: TrademarkWatchAlert): Promise<string>;
  saveDomainAlert(alert: DomainWatchAlert): Promise<string>;
  saveLitigationAlert(alert: LitigationAlert): Promise<string>;
  findByProviderAlertId(provider: WebhookProvider, providerAlertId: string): Promise<unknown | null>;
}

/**
 * Notification service for webhook alerts.
 */
export interface WebhookNotificationService {
  notifyPatentAlert(alert: PatentWatchAlert): Promise<void>;
  notifyTrademarkAlert(alert: TrademarkWatchAlert): Promise<void>;
  notifyDomainAlert(alert: DomainWatchAlert): Promise<void>;
  notifyLitigationAlert(alert: LitigationAlert): Promise<void>;
}

// ============================================================================
// Default Implementations (In-Memory for Development)
// ============================================================================

/**
 * In-memory repository for development.
 */
class InMemoryWebhookRepository implements WebhookAlertRepository {
  private patentAlerts = new Map<string, PatentWatchAlert>();
  private trademarkAlerts = new Map<string, TrademarkWatchAlert>();
  private domainAlerts = new Map<string, DomainWatchAlert>();
  private litigationAlerts = new Map<string, LitigationAlert>();

  async savePatentAlert(alert: PatentWatchAlert): Promise<string> {
    const id = crypto.randomUUID();
    this.patentAlerts.set(id, alert);
    logger.debug({ id, alertType: alert.alertType }, 'Saved patent alert');
    return id;
  }

  async saveTrademarkAlert(alert: TrademarkWatchAlert): Promise<string> {
    const id = crypto.randomUUID();
    this.trademarkAlerts.set(id, alert);
    logger.debug({ id, alertType: alert.alertType }, 'Saved trademark alert');
    return id;
  }

  async saveDomainAlert(alert: DomainWatchAlert): Promise<string> {
    const id = crypto.randomUUID();
    this.domainAlerts.set(id, alert);
    logger.debug({ id, alertType: alert.alertType }, 'Saved domain alert');
    return id;
  }

  async saveLitigationAlert(alert: LitigationAlert): Promise<string> {
    const id = crypto.randomUUID();
    this.litigationAlerts.set(id, alert);
    logger.debug({ id, alertType: alert.alertType }, 'Saved litigation alert');
    return id;
  }

  async findByProviderAlertId(provider: WebhookProvider, providerAlertId: string): Promise<unknown | null> {
    // Check all collections for duplicates
    for (const alert of Array.from(this.patentAlerts.values())) {
      if (alert.provider === provider && alert.providerAlertId === providerAlertId) {
        return alert;
      }
    }
    for (const alert of Array.from(this.trademarkAlerts.values())) {
      if (alert.provider === provider && alert.providerAlertId === providerAlertId) {
        return alert;
      }
    }
    for (const alert of Array.from(this.domainAlerts.values())) {
      if (alert.provider === provider && alert.providerAlertId === providerAlertId) {
        return alert;
      }
    }
    for (const alert of Array.from(this.litigationAlerts.values())) {
      if (alert.provider === provider && alert.providerAlertId === providerAlertId) {
        return alert;
      }
    }
    return null;
  }
}

/**
 * Stub notification service.
 */
class StubNotificationService implements WebhookNotificationService {
  async notifyPatentAlert(alert: PatentWatchAlert): Promise<void> {
    logger.info({ alertType: alert.alertType, patent: alert.patent.patentNumber }, 'Patent alert notification (stub)');
  }

  async notifyTrademarkAlert(alert: TrademarkWatchAlert): Promise<void> {
    logger.info({ alertType: alert.alertType, mark: alert.trademark.markName }, 'Trademark alert notification (stub)');
  }

  async notifyDomainAlert(alert: DomainWatchAlert): Promise<void> {
    logger.info({ alertType: alert.alertType, domain: alert.domain.domainName }, 'Domain alert notification (stub)');
  }

  async notifyLitigationAlert(alert: LitigationAlert): Promise<void> {
    logger.info({ alertType: alert.alertType, case: alert.case.caseNumber }, 'Litigation alert notification (stub)');
  }
}

/**
 * Stub event publisher.
 */
class StubEventPublisher implements WebhookEventPublisher {
  async publish(eventType: string, aggregateId: string, payload: Record<string, unknown>): Promise<void> {
    logger.info({ eventType, aggregateId }, 'Domain event published (stub)');
  }
}

// ============================================================================
// Webhook Handler
// ============================================================================

/**
 * Webhook Handler
 *
 * Orchestrates processing of incoming webhook payloads.
 */
export class WebhookHandler {
  private readonly repository: WebhookAlertRepository;
  private readonly notifications: WebhookNotificationService;
  private readonly eventPublisher: WebhookEventPublisher;

  constructor(
    repository?: WebhookAlertRepository,
    notifications?: WebhookNotificationService,
    eventPublisher?: WebhookEventPublisher
  ) {
    this.repository = repository ?? new InMemoryWebhookRepository();
    this.notifications = notifications ?? new StubNotificationService();
    this.eventPublisher = eventPublisher ?? new StubEventPublisher();
  }

  // ============================================================================
  // Patent Watch Processing
  // ============================================================================

  /**
   * Process a patent watch webhook.
   */
  async handlePatentWatch(
    rawPayload: Record<string, unknown>,
    provider: WebhookProvider
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    let eventsPublished = 0;

    try {
      // Map payload to our schema
      const mappedPayload = mapToPatentWatchAlert(rawPayload, provider);

      // Validate
      const validation = webhookValidator.validatePatentWatchAlert(mappedPayload);
      if (!validation.valid || !validation.data) {
        // Try flexible validation for partial data
        const baseValidation = webhookValidator.validateBasePayload(rawPayload);
        if (!baseValidation.valid) {
          return {
            success: false,
            eventId: String(rawPayload.eventId ?? rawPayload.id ?? 'unknown'),
            eventType: String(rawPayload.eventType ?? rawPayload.type ?? 'unknown'),
            provider,
            error: `Validation failed: ${JSON.stringify(validation.errors)}`,
          };
        }

        // Use flexible data
        logger.warn({ provider, errors: validation.errors }, 'Patent alert partially validated');
      }

      const alert = validation.data ?? (mappedPayload as PatentWatchAlert);

      // Check for duplicate
      const existing = await this.repository.findByProviderAlertId(provider, alert.providerAlertId);
      if (existing) {
        return {
          success: true,
          eventId: alert.eventId,
          eventType: alert.eventType,
          provider,
          message: 'Duplicate alert ignored',
        };
      }

      // Save to repository
      const recordId = await this.repository.savePatentAlert(alert);

      // Publish domain event
      await this.publishPatentEvent(alert, recordId);
      eventsPublished++;

      // Send notifications (async, don't block)
      this.notifications.notifyPatentAlert(alert).catch(err => {
        logger.error({ err, alertId: recordId }, 'Failed to send patent alert notification');
      });

      logger.info({
        provider,
        alertType: alert.alertType,
        patent: alert.patent.patentNumber,
        processingTimeMs: Date.now() - startTime,
      }, 'Patent watch alert processed');

      return {
        success: true,
        eventId: alert.eventId,
        eventType: alert.eventType,
        provider,
        message: `Patent alert processed: ${alert.alertType}`,
        recordsCreated: 1,
        eventsPublished,
      };
    } catch (error) {
      logger.error({ error, provider }, 'Failed to process patent watch webhook');
      return {
        success: false,
        eventId: String(rawPayload.eventId ?? 'unknown'),
        eventType: String(rawPayload.eventType ?? 'unknown'),
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Publish domain event for patent alert.
   */
  private async publishPatentEvent(alert: PatentWatchAlert, recordId: string): Promise<void> {
    const eventType = this.mapPatentAlertToEventType(alert.alertType);

    await this.eventPublisher.publish(eventType, recordId, {
      alertType: alert.alertType,
      patentNumber: alert.patent.patentNumber,
      jurisdiction: alert.patent.jurisdiction,
      title: alert.patent.title,
      provider: alert.provider,
      providerAlertId: alert.providerAlertId,
      relevanceScore: alert.relevanceScore,
      matchedKeywords: alert.matchedKeywords,
      matchedCompetitor: alert.matchedCompetitor,
      timestamp: alert.timestamp,
    });
  }

  /**
   * Map patent alert type to domain event type.
   */
  private mapPatentAlertToEventType(alertType: PatentWatchAlertType): string {
    const mapping: Record<PatentWatchAlertType, string> = {
      new_filing: 'PatentWatch.NewFilingDetected',
      new_publication: 'PatentWatch.NewPublicationDetected',
      new_grant: 'PatentWatch.NewGrantDetected',
      citation_forward: 'PatentWatch.ForwardCitationDetected',
      citation_backward: 'PatentWatch.BackwardCitationDetected',
      competitor_filing: 'PatentWatch.CompetitorFilingDetected',
      family_member: 'PatentWatch.FamilyMemberDetected',
      status_change: 'PatentWatch.StatusChangeDetected',
      maintenance_due: 'PatentWatch.MaintenanceDueAlert',
      expiration: 'PatentWatch.ExpirationAlert',
      opposition: 'PatentWatch.OppositionDetected',
      reexamination: 'PatentWatch.ReexaminationDetected',
      assignment: 'PatentWatch.AssignmentDetected',
      license_recorded: 'PatentWatch.LicenseRecordedDetected',
    };
    return mapping[alertType] ?? 'PatentWatch.AlertReceived';
  }

  // ============================================================================
  // Trademark Watch Processing
  // ============================================================================

  /**
   * Process a trademark watch webhook.
   */
  async handleTrademarkWatch(
    rawPayload: Record<string, unknown>,
    provider: WebhookProvider
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    let eventsPublished = 0;

    try {
      // Map payload to our schema
      const mappedPayload = mapToTrademarkWatchAlert(rawPayload, provider);

      // Validate
      const validation = webhookValidator.validateTrademarkWatchAlert(mappedPayload);
      if (!validation.valid || !validation.data) {
        const baseValidation = webhookValidator.validateBasePayload(rawPayload);
        if (!baseValidation.valid) {
          return {
            success: false,
            eventId: String(rawPayload.eventId ?? rawPayload.id ?? 'unknown'),
            eventType: String(rawPayload.eventType ?? rawPayload.type ?? 'unknown'),
            provider,
            error: `Validation failed: ${JSON.stringify(validation.errors)}`,
          };
        }
        logger.warn({ provider, errors: validation.errors }, 'Trademark alert partially validated');
      }

      const alert = validation.data ?? (mappedPayload as TrademarkWatchAlert);

      // Check for duplicate
      const existing = await this.repository.findByProviderAlertId(provider, alert.providerAlertId);
      if (existing) {
        return {
          success: true,
          eventId: alert.eventId,
          eventType: alert.eventType,
          provider,
          message: 'Duplicate alert ignored',
        };
      }

      // Save to repository
      const recordId = await this.repository.saveTrademarkAlert(alert);

      // Publish domain event
      await this.publishTrademarkEvent(alert, recordId);
      eventsPublished++;

      // Send notifications
      this.notifications.notifyTrademarkAlert(alert).catch(err => {
        logger.error({ err, alertId: recordId }, 'Failed to send trademark alert notification');
      });

      logger.info({
        provider,
        alertType: alert.alertType,
        mark: alert.trademark.markName,
        processingTimeMs: Date.now() - startTime,
      }, 'Trademark watch alert processed');

      return {
        success: true,
        eventId: alert.eventId,
        eventType: alert.eventType,
        provider,
        message: `Trademark alert processed: ${alert.alertType}`,
        recordsCreated: 1,
        eventsPublished,
      };
    } catch (error) {
      logger.error({ error, provider }, 'Failed to process trademark watch webhook');
      return {
        success: false,
        eventId: String(rawPayload.eventId ?? 'unknown'),
        eventType: String(rawPayload.eventType ?? 'unknown'),
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Publish domain event for trademark alert.
   */
  private async publishTrademarkEvent(alert: TrademarkWatchAlert, recordId: string): Promise<void> {
    const eventType = this.mapTrademarkAlertToEventType(alert.alertType);

    await this.eventPublisher.publish(eventType, recordId, {
      alertType: alert.alertType,
      markNumber: alert.trademark.markNumber,
      markName: alert.trademark.markName,
      jurisdiction: alert.trademark.jurisdiction,
      niceClasses: alert.trademark.niceClasses,
      provider: alert.provider,
      providerAlertId: alert.providerAlertId,
      similarity: alert.similarity,
      deadlineDate: alert.deadlineDate,
      timestamp: alert.timestamp,
    });
  }

  /**
   * Map trademark alert type to domain event type.
   */
  private mapTrademarkAlertToEventType(alertType: TrademarkWatchAlertType): string {
    const mapping: Record<TrademarkWatchAlertType, string> = {
      similar_mark_filed: 'TrademarkWatch.SimilarMarkFiledDetected',
      similar_mark_published: 'TrademarkWatch.SimilarMarkPublishedDetected',
      similar_mark_registered: 'TrademarkWatch.SimilarMarkRegisteredDetected',
      opposition_filed: 'TrademarkWatch.OppositionFiledDetected',
      opposition_received: 'TrademarkWatch.OppositionReceivedAlert',
      cancellation_filed: 'TrademarkWatch.CancellationFiledDetected',
      cancellation_received: 'TrademarkWatch.CancellationReceivedAlert',
      renewal_due: 'TrademarkWatch.RenewalDueAlert',
      status_change: 'TrademarkWatch.StatusChangeDetected',
      assignment: 'TrademarkWatch.AssignmentDetected',
      use_declaration_due: 'TrademarkWatch.UseDeclarationDueAlert',
      intent_to_use: 'TrademarkWatch.IntentToUseDetected',
      domain_registration: 'TrademarkWatch.DomainRegistrationDetected',
    };
    return mapping[alertType] ?? 'TrademarkWatch.AlertReceived';
  }

  // ============================================================================
  // Domain Watch Processing
  // ============================================================================

  /**
   * Process a domain watch webhook.
   */
  async handleDomainWatch(
    rawPayload: Record<string, unknown>,
    provider: WebhookProvider
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    let eventsPublished = 0;

    try {
      // Map payload to our schema
      const mappedPayload = mapToDomainWatchAlert(rawPayload, provider);

      // Validate
      const validation = webhookValidator.validateDomainWatchAlert(mappedPayload);
      if (!validation.valid || !validation.data) {
        const baseValidation = webhookValidator.validateBasePayload(rawPayload);
        if (!baseValidation.valid) {
          return {
            success: false,
            eventId: String(rawPayload.eventId ?? rawPayload.id ?? 'unknown'),
            eventType: String(rawPayload.eventType ?? rawPayload.type ?? 'unknown'),
            provider,
            error: `Validation failed: ${JSON.stringify(validation.errors)}`,
          };
        }
        logger.warn({ provider, errors: validation.errors }, 'Domain alert partially validated');
      }

      const alert = validation.data ?? (mappedPayload as DomainWatchAlert);

      // Check for duplicate
      const existing = await this.repository.findByProviderAlertId(provider, alert.providerAlertId);
      if (existing) {
        return {
          success: true,
          eventId: alert.eventId,
          eventType: alert.eventType,
          provider,
          message: 'Duplicate alert ignored',
        };
      }

      // Save to repository
      const recordId = await this.repository.saveDomainAlert(alert);

      // Publish domain event
      await this.publishDomainEvent(alert, recordId);
      eventsPublished++;

      // Send notifications
      this.notifications.notifyDomainAlert(alert).catch(err => {
        logger.error({ err, alertId: recordId }, 'Failed to send domain alert notification');
      });

      logger.info({
        provider,
        alertType: alert.alertType,
        domain: alert.domain.domainName,
        riskLevel: alert.riskLevel,
        processingTimeMs: Date.now() - startTime,
      }, 'Domain watch alert processed');

      return {
        success: true,
        eventId: alert.eventId,
        eventType: alert.eventType,
        provider,
        message: `Domain alert processed: ${alert.alertType}`,
        recordsCreated: 1,
        eventsPublished,
      };
    } catch (error) {
      logger.error({ error, provider }, 'Failed to process domain watch webhook');
      return {
        success: false,
        eventId: String(rawPayload.eventId ?? 'unknown'),
        eventType: String(rawPayload.eventType ?? 'unknown'),
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Publish domain event for domain alert.
   */
  private async publishDomainEvent(alert: DomainWatchAlert, recordId: string): Promise<void> {
    const eventType = this.mapDomainAlertToEventType(alert.alertType);

    await this.eventPublisher.publish(eventType, recordId, {
      alertType: alert.alertType,
      domainName: alert.domain.domainName,
      tld: alert.domain.tld,
      provider: alert.provider,
      providerAlertId: alert.providerAlertId,
      similarityScore: alert.similarityScore,
      riskLevel: alert.riskLevel,
      protectedAsset: alert.protectedAsset,
      timestamp: alert.timestamp,
    });
  }

  /**
   * Map domain alert type to domain event type.
   */
  private mapDomainAlertToEventType(alertType: DomainWatchAlertType): string {
    const mapping: Record<DomainWatchAlertType, string> = {
      typosquatting: 'DomainWatch.TyposquattingDetected',
      similar_registration: 'DomainWatch.SimilarRegistrationDetected',
      zone_file_addition: 'DomainWatch.ZoneFileAdditionDetected',
      expiration_notice: 'DomainWatch.ExpirationNotice',
      transfer_notice: 'DomainWatch.TransferNotice',
      whois_change: 'DomainWatch.WhoisChangeDetected',
      dns_change: 'DomainWatch.DnsChangeDetected',
      content_change: 'DomainWatch.ContentChangeDetected',
      brand_abuse: 'DomainWatch.BrandAbuseDetected',
    };
    return mapping[alertType] ?? 'DomainWatch.AlertReceived';
  }

  // ============================================================================
  // Litigation Watch Processing
  // ============================================================================

  /**
   * Process a litigation watch webhook.
   */
  async handleLitigationWatch(
    rawPayload: Record<string, unknown>,
    provider: WebhookProvider
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    let eventsPublished = 0;

    try {
      // Map payload to our schema
      const mappedPayload = mapToLitigationAlert(rawPayload, provider);

      // Validate
      const validation = webhookValidator.validateLitigationAlert(mappedPayload);
      if (!validation.valid || !validation.data) {
        const baseValidation = webhookValidator.validateBasePayload(rawPayload);
        if (!baseValidation.valid) {
          return {
            success: false,
            eventId: String(rawPayload.eventId ?? rawPayload.id ?? 'unknown'),
            eventType: String(rawPayload.eventType ?? rawPayload.type ?? 'unknown'),
            provider,
            error: `Validation failed: ${JSON.stringify(validation.errors)}`,
          };
        }
        logger.warn({ provider, errors: validation.errors }, 'Litigation alert partially validated');
      }

      const alert = validation.data ?? (mappedPayload as LitigationAlert);

      // Check for duplicate
      const existing = await this.repository.findByProviderAlertId(provider, alert.providerAlertId);
      if (existing) {
        return {
          success: true,
          eventId: alert.eventId,
          eventType: alert.eventType,
          provider,
          message: 'Duplicate alert ignored',
        };
      }

      // Save to repository
      const recordId = await this.repository.saveLitigationAlert(alert);

      // Publish domain event
      await this.publishLitigationEvent(alert, recordId);
      eventsPublished++;

      // Send notifications
      this.notifications.notifyLitigationAlert(alert).catch(err => {
        logger.error({ err, alertId: recordId }, 'Failed to send litigation alert notification');
      });

      logger.info({
        provider,
        alertType: alert.alertType,
        caseNumber: alert.case.caseNumber,
        court: alert.case.court,
        importance: alert.importance,
        processingTimeMs: Date.now() - startTime,
      }, 'Litigation watch alert processed');

      return {
        success: true,
        eventId: alert.eventId,
        eventType: alert.eventType,
        provider,
        message: `Litigation alert processed: ${alert.alertType}`,
        recordsCreated: 1,
        eventsPublished,
      };
    } catch (error) {
      logger.error({ error, provider }, 'Failed to process litigation watch webhook');
      return {
        success: false,
        eventId: String(rawPayload.eventId ?? 'unknown'),
        eventType: String(rawPayload.eventType ?? 'unknown'),
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Publish domain event for litigation alert.
   */
  private async publishLitigationEvent(alert: LitigationAlert, recordId: string): Promise<void> {
    const eventType = this.mapLitigationAlertToEventType(alert.alertType);

    await this.eventPublisher.publish(eventType, recordId, {
      alertType: alert.alertType,
      caseNumber: alert.case.caseNumber,
      caseCaption: alert.case.caseCaption,
      court: alert.case.court,
      jurisdiction: alert.case.jurisdiction,
      caseType: alert.case.caseType,
      provider: alert.provider,
      providerAlertId: alert.providerAlertId,
      importance: alert.importance,
      relatedAssets: alert.relatedAssets,
      docketEntry: alert.docketEntry,
      timestamp: alert.timestamp,
    });
  }

  /**
   * Map litigation alert type to domain event type.
   */
  private mapLitigationAlertToEventType(alertType: LitigationAlertType): string {
    const mapping: Record<LitigationAlertType, string> = {
      case_filed: 'LitigationWatch.CaseFiledDetected',
      case_updated: 'LitigationWatch.CaseUpdatedDetected',
      motion_filed: 'LitigationWatch.MotionFiledDetected',
      order_issued: 'LitigationWatch.OrderIssuedDetected',
      judgment: 'LitigationWatch.JudgmentDetected',
      appeal_filed: 'LitigationWatch.AppealFiledDetected',
      settlement: 'LitigationWatch.SettlementDetected',
      trial_date_set: 'LitigationWatch.TrialDateSetDetected',
      claim_construction: 'LitigationWatch.ClaimConstructionDetected',
      invalidity_contention: 'LitigationWatch.InvalidityContentionDetected',
      ptab_proceeding: 'LitigationWatch.PTABProceedingDetected',
      itc_investigation: 'LitigationWatch.ITCInvestigationDetected',
    };
    return mapping[alertType] ?? 'LitigationWatch.AlertReceived';
  }
}

// Singleton instance
export const webhookHandler = new WebhookHandler();

export default webhookHandler;
