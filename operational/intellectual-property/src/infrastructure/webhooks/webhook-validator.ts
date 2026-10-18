/**
 * Webhook Validator
 *
 * Validates incoming webhook requests including:
 * - HMAC signature verification for different providers
 * - Timestamp validation for replay protection
 * - Payload schema validation
 *
 * @module infrastructure/webhooks
 */

import * as crypto from 'crypto';
import { z } from 'zod';
import pino from 'pino';
import {
  getProviderConfig,
  detectProviderFromHeaders,
  type WebhookProviderConfig,
} from './webhook-config.js';
import type {
  WebhookProvider,
  PatentWatchAlert,
  TrademarkWatchAlert,
  DomainWatchAlert,
  LitigationAlert,
  PatentWatchAlertType,
  TrademarkWatchAlertType,
  DomainWatchAlertType,
  LitigationAlertType,
} from './webhook-types.js';

const logger = pino({ name: 'webhook-validator' });

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Signature validation result.
 */
export interface SignatureValidationResult {
  valid: boolean;
  provider?: WebhookProvider;
  error?: string;
  timestampAge?: number;
}

/**
 * Payload validation result.
 */
export interface PayloadValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: z.ZodError['errors'];
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Base webhook schema.
 */
const baseWebhookSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  timestamp: z.string().datetime().or(z.string().min(1)),
  provider: z.string().optional(),
  accountId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Patent alert info schema.
 */
const patentAlertInfoSchema = z.object({
  patentNumber: z.string().min(1),
  applicationNumber: z.string().optional(),
  title: z.string().min(1),
  abstract: z.string().optional(),
  filingDate: z.string().optional(),
  publicationDate: z.string().optional(),
  grantDate: z.string().optional(),
  expirationDate: z.string().optional(),
  jurisdiction: z.string().min(1),
  kindCode: z.string().optional(),
  classifications: z.array(z.object({
    system: z.enum(['IPC', 'CPC', 'USPC', 'FI', 'F-term']),
    code: z.string(),
    description: z.string().optional(),
  })).optional(),
  assignee: z.object({
    name: z.string(),
    country: z.string().optional(),
    type: z.enum(['company', 'individual', 'government', 'university', 'unknown']).optional(),
    standardizedName: z.string().optional(),
  }).optional(),
  inventors: z.array(z.string()).optional(),
  priorityClaims: z.array(z.object({
    applicationNumber: z.string(),
    filingDate: z.string(),
    jurisdiction: z.string(),
  })).optional(),
  familyMembers: z.array(z.string()).optional(),
  documentUrl: z.string().url().optional(),
});

/**
 * Patent watch alert schema.
 */
export const patentWatchAlertSchema = baseWebhookSchema.extend({
  alertType: z.enum([
    'new_filing', 'new_publication', 'new_grant', 'citation_forward', 'citation_backward',
    'competitor_filing', 'family_member', 'status_change', 'maintenance_due', 'expiration',
    'opposition', 'reexamination', 'assignment', 'license_recorded',
  ] as const),
  patent: patentAlertInfoSchema,
  relatedPatent: patentAlertInfoSchema.optional(),
  watchProfileId: z.string().optional(),
  watchProfileName: z.string().optional(),
  matchedKeywords: z.array(z.string()).optional(),
  matchedClassifications: z.array(z.string()).optional(),
  matchedCompetitor: z.string().optional(),
  relevanceScore: z.number().min(0).max(100).optional(),
  providerAlertId: z.string().min(1),
});

/**
 * Trademark alert info schema.
 */
const trademarkAlertInfoSchema = z.object({
  markNumber: z.string().min(1),
  serialNumber: z.string().optional(),
  markName: z.string().min(1),
  description: z.string().optional(),
  markType: z.enum(['word', 'design', 'combined', 'sound', 'motion', 'color', 'other']).optional(),
  filingDate: z.string().optional(),
  publicationDate: z.string().optional(),
  registrationDate: z.string().optional(),
  expirationDate: z.string().optional(),
  status: z.string().optional(),
  jurisdiction: z.string().min(1),
  niceClasses: z.array(z.number().int().min(1).max(45)).optional(),
  goodsServices: z.array(z.object({
    class: z.number().int().min(1).max(45),
    description: z.string(),
  })).optional(),
  owner: z.object({
    name: z.string(),
    country: z.string().optional(),
    type: z.enum(['company', 'individual', 'government', 'university', 'unknown']).optional(),
    standardizedName: z.string().optional(),
  }).optional(),
  imageUrl: z.string().url().optional(),
  viennaClassification: z.array(z.string()).optional(),
  documentUrl: z.string().url().optional(),
});

/**
 * Trademark watch alert schema.
 */
export const trademarkWatchAlertSchema = baseWebhookSchema.extend({
  alertType: z.enum([
    'similar_mark_filed', 'similar_mark_published', 'similar_mark_registered',
    'opposition_filed', 'opposition_received', 'cancellation_filed', 'cancellation_received',
    'renewal_due', 'status_change', 'assignment', 'use_declaration_due', 'intent_to_use',
    'domain_registration',
  ] as const),
  trademark: trademarkAlertInfoSchema,
  monitoredMark: trademarkAlertInfoSchema.optional(),
  similarity: z.object({
    overallScore: z.number().min(0).max(100),
    phoneticScore: z.number().min(0).max(100).optional(),
    visualScore: z.number().min(0).max(100).optional(),
    conceptualScore: z.number().min(0).max(100).optional(),
    classOverlap: z.boolean(),
    overlappingClasses: z.array(z.number()).optional(),
    notes: z.string().optional(),
  }).optional(),
  watchProfileId: z.string().optional(),
  watchProfileName: z.string().optional(),
  deadlineDate: z.string().optional(),
  providerAlertId: z.string().min(1),
});

/**
 * Domain alert info schema.
 */
const domainAlertInfoSchema = z.object({
  domainName: z.string().min(1),
  tld: z.string().min(1),
  registrationDate: z.string().optional(),
  expirationDate: z.string().optional(),
  lastUpdated: z.string().optional(),
  registrar: z.string().optional(),
  registrant: z.object({
    name: z.string().optional(),
    organization: z.string().optional(),
    email: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  nameServers: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  ipAddresses: z.array(z.string()).optional(),
  contentSummary: z.string().optional(),
  screenshotUrl: z.string().url().optional(),
});

/**
 * Domain watch alert schema.
 */
export const domainWatchAlertSchema = baseWebhookSchema.extend({
  alertType: z.enum([
    'typosquatting', 'similar_registration', 'zone_file_addition', 'expiration_notice',
    'transfer_notice', 'whois_change', 'dns_change', 'content_change', 'brand_abuse',
  ] as const),
  domain: domainAlertInfoSchema,
  protectedAsset: z.object({
    type: z.enum(['domain', 'trademark', 'brand']),
    name: z.string(),
    id: z.string().optional(),
  }).optional(),
  similarityScore: z.number().min(0).max(100).optional(),
  detectionMethod: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  recommendedAction: z.string().optional(),
  watchProfileId: z.string().optional(),
  providerAlertId: z.string().min(1),
});

/**
 * Litigation party schema.
 */
const litigationPartySchema = z.object({
  name: z.string().min(1),
  role: z.enum(['plaintiff', 'defendant', 'petitioner', 'respondent', 'intervenor']),
  isOurEntity: z.boolean().optional(),
  attorneys: z.array(z.string()).optional(),
  lawFirm: z.string().optional(),
});

/**
 * Litigation case info schema.
 */
const litigationCaseInfoSchema = z.object({
  caseNumber: z.string().min(1),
  caseCaption: z.string().min(1),
  court: z.string().min(1),
  jurisdiction: z.string().min(1),
  judge: z.string().optional(),
  caseType: z.enum(['patent', 'trademark', 'copyright', 'trade_secret', 'unfair_competition']).optional(),
  filingDate: z.string().min(1),
  status: z.string().optional(),
  parties: z.array(litigationPartySchema).min(1),
  patentsInSuit: z.array(z.string()).optional(),
  trademarksInSuit: z.array(z.string()).optional(),
  copyrightsInSuit: z.array(z.string()).optional(),
  damagesClaimed: z.number().optional(),
  currency: z.string().optional(),
  docketUrl: z.string().url().optional(),
});

/**
 * Litigation alert schema.
 */
export const litigationAlertSchema = baseWebhookSchema.extend({
  alertType: z.enum([
    'case_filed', 'case_updated', 'motion_filed', 'order_issued', 'judgment', 'appeal_filed',
    'settlement', 'trial_date_set', 'claim_construction', 'invalidity_contention',
    'ptab_proceeding', 'itc_investigation',
  ] as const),
  case: litigationCaseInfoSchema,
  docketEntry: z.object({
    entryNumber: z.string(),
    filingDate: z.string(),
    documentType: z.string(),
    description: z.string(),
    filingParty: z.string().optional(),
    documentUrl: z.string().url().optional(),
  }).optional(),
  watchProfileId: z.string().optional(),
  watchProfileName: z.string().optional(),
  relatedAssets: z.array(z.object({
    type: z.enum(['patent', 'trademark', 'copyright', 'trade_secret']),
    id: z.string(),
    identifier: z.string(),
  })).optional(),
  importance: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  providerAlertId: z.string().min(1),
});

// ============================================================================
// Webhook Validator Class
// ============================================================================

/**
 * Webhook Validator
 *
 * Validates webhook signatures and payloads from IP watch service providers.
 */
export class WebhookValidator {
  /**
   * Verify webhook signature.
   */
  verifySignature(
    rawBody: string | Buffer,
    signature: string,
    config: WebhookProviderConfig
  ): boolean {
    const { secretKey, signatureAlgorithm } = config;

    if (!secretKey) {
      logger.warn({ provider: config.provider }, 'No secret key configured for provider');
      return false;
    }

    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

    let algorithm: string;
    switch (signatureAlgorithm) {
      case 'hmac-sha256':
        algorithm = 'sha256';
        break;
      case 'hmac-sha512':
        algorithm = 'sha512';
        break;
      case 'rsa-sha256':
        // RSA signatures require different handling
        logger.warn('RSA signature verification not yet implemented');
        return false;
      default:
        logger.error({ algorithm: signatureAlgorithm }, 'Unsupported signature algorithm');
        return false;
    }

    const expectedSignature = crypto
      .createHmac(algorithm, secretKey)
      .update(body)
      .digest('hex');

    // Support both raw hex and prefixed signatures
    const normalizedSignature = signature.replace(/^sha256=|^sha512=/, '');

    // Constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(normalizedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      // If lengths don't match, timingSafeEqual throws
      return false;
    }
  }

  /**
   * Validate timestamp for replay protection.
   */
  validateTimestamp(
    timestamp: string | undefined,
    maxAgeSeconds: number
  ): { valid: boolean; age?: number; error?: string } {
    if (!timestamp) {
      return { valid: true }; // Timestamp validation is optional
    }

    let timestampMs: number;

    // Try parsing as Unix timestamp (seconds)
    const unixTimestamp = parseInt(timestamp, 10);
    if (!isNaN(unixTimestamp)) {
      // Check if it's seconds or milliseconds
      timestampMs = unixTimestamp > 1e12 ? unixTimestamp : unixTimestamp * 1000;
    } else {
      // Try parsing as ISO string
      timestampMs = Date.parse(timestamp);
      if (isNaN(timestampMs)) {
        return { valid: false, error: 'Invalid timestamp format' };
      }
    }

    const now = Date.now();
    const ageSeconds = Math.abs(now - timestampMs) / 1000;

    if (ageSeconds > maxAgeSeconds) {
      return {
        valid: false,
        age: ageSeconds,
        error: `Webhook timestamp too old: ${ageSeconds.toFixed(0)}s (max: ${maxAgeSeconds}s)`,
      };
    }

    return { valid: true, age: ageSeconds };
  }

  /**
   * Validate a webhook request.
   */
  validateRequest(
    rawBody: string | Buffer,
    headers: Record<string, string | undefined>,
    explicitProvider?: WebhookProvider
  ): SignatureValidationResult {
    // Determine provider
    const provider = explicitProvider ?? detectProviderFromHeaders(headers);
    if (!provider) {
      return {
        valid: false,
        error: 'Unable to determine webhook provider',
      };
    }

    // Get provider config
    const config = getProviderConfig(provider);
    if (!config) {
      return {
        valid: false,
        provider,
        error: `Provider ${provider} is not configured or enabled`,
      };
    }

    // Get signature from headers
    const signature = headers[config.signatureHeader.toLowerCase()];
    if (!signature) {
      // In development, allow unsigned webhooks
      if (process.env.NODE_ENV !== 'production') {
        logger.warn({ provider }, 'Allowing unsigned webhook in development');
        return { valid: true, provider };
      }

      return {
        valid: false,
        provider,
        error: `Missing signature header: ${config.signatureHeader}`,
      };
    }

    // Verify signature
    const signatureValid = this.verifySignature(rawBody, signature, config);
    if (!signatureValid) {
      return {
        valid: false,
        provider,
        error: 'Invalid webhook signature',
      };
    }

    // Validate timestamp if header is configured
    if (config.timestampHeader) {
      const timestamp = headers[config.timestampHeader.toLowerCase()];
      const timestampResult = this.validateTimestamp(timestamp, config.maxAgeSeconds);

      if (!timestampResult.valid) {
        return {
          valid: false,
          provider,
          timestampAge: timestampResult.age,
          error: timestampResult.error,
        };
      }
    }

    return {
      valid: true,
      provider,
    };
  }

  /**
   * Validate patent watch alert payload.
   */
  validatePatentWatchAlert(payload: unknown): PayloadValidationResult<PatentWatchAlert> {
    const result = patentWatchAlertSchema.safeParse(payload);

    if (result.success) {
      return { valid: true, data: result.data as PatentWatchAlert };
    }

    return { valid: false, errors: result.error.errors };
  }

  /**
   * Validate trademark watch alert payload.
   */
  validateTrademarkWatchAlert(payload: unknown): PayloadValidationResult<TrademarkWatchAlert> {
    const result = trademarkWatchAlertSchema.safeParse(payload);

    if (result.success) {
      return { valid: true, data: result.data as TrademarkWatchAlert };
    }

    return { valid: false, errors: result.error.errors };
  }

  /**
   * Validate domain watch alert payload.
   */
  validateDomainWatchAlert(payload: unknown): PayloadValidationResult<DomainWatchAlert> {
    const result = domainWatchAlertSchema.safeParse(payload);

    if (result.success) {
      return { valid: true, data: result.data as DomainWatchAlert };
    }

    return { valid: false, errors: result.error.errors };
  }

  /**
   * Validate litigation alert payload.
   */
  validateLitigationAlert(payload: unknown): PayloadValidationResult<LitigationAlert> {
    const result = litigationAlertSchema.safeParse(payload);

    if (result.success) {
      return { valid: true, data: result.data as LitigationAlert };
    }

    return { valid: false, errors: result.error.errors };
  }

  /**
   * Validate any webhook payload with flexible schema.
   * Used when we want to accept the payload even if it doesn't fully match our schema.
   */
  validateBasePayload(payload: unknown): PayloadValidationResult<Record<string, unknown>> {
    const baseSchema = z.object({
      eventId: z.string().optional(),
      eventType: z.string().optional(),
      alertType: z.string().optional(),
      type: z.string().optional(),
      id: z.string().optional(),
      timestamp: z.string().optional(),
    }).passthrough();

    const result = baseSchema.safeParse(payload);

    if (result.success) {
      return { valid: true, data: result.data };
    }

    return { valid: false, errors: result.error.errors };
  }
}

// Singleton instance
export const webhookValidator = new WebhookValidator();

export default webhookValidator;
