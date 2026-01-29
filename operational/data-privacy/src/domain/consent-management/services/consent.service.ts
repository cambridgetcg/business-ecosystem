/**
 * Consent Service
 * Business logic for consent management (GDPR Art. 6, Art. 7)
 */

import type { ConsentRepository } from '../repositories/consent.repository.js';
import type {
  ConsentRecord,
  GrantConsentInput,
  WithdrawConsentInput,
  ConsentQueryFilter,
} from '../models/consent-record.js';
import { isValid, canWithdraw } from '../models/consent-record.js';

// ============================================================================
// SERVICE RESULT TYPES
// ============================================================================

export interface ConsentCheckResult {
  hasConsent: boolean;
  consentId?: string | undefined;
  lawfulBasis?: string | undefined;
  grantedAt?: Date | undefined;
  expiresAt?: Date | undefined;
}

export interface ServiceError {
  code: string;
  message: string;
}

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: ServiceError };

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class ConsentService {
  constructor(private repository: ConsentRepository) {}

  /**
   * Grant consent for a subject + purpose
   * If active consent exists for same subject/purpose, supersedes it
   */
  async grantConsent(input: GrantConsentInput): Promise<ServiceResult<ConsentRecord>> {
    // Check for existing active consent - supersede if exists
    const existing = await this.repository.findActiveConsent(input.subjectId, input.purpose);

    if (existing) {
      await this.repository.updateStatus(existing.id, 'SUPERSEDED');
    }

    const consent = await this.repository.create(input);

    return { success: true, data: consent };
  }

  /**
   * Withdraw consent (GDPR Art. 7(3) - withdrawal must be as easy as giving)
   */
  async withdrawConsent(
    id: string,
    input: WithdrawConsentInput
  ): Promise<ServiceResult<ConsentRecord>> {
    const consent = await this.repository.findById(id);

    if (!consent) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Consent record not found' },
      };
    }

    if (!canWithdraw(consent)) {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'Consent is not active' },
      };
    }

    const updated = await this.repository.updateStatus(id, 'WITHDRAWN', {
      withdrawnAt: new Date(),
      withdrawalReason: input.reason,
      withdrawalMethod: input.method,
    });

    return { success: true, data: updated };
  }

  /**
   * Check if subject has valid consent for purpose
   * Considers both status and expiry
   */
  async checkConsent(subjectId: string, purpose: string): Promise<ConsentCheckResult> {
    const consent = await this.repository.findActiveConsent(subjectId, purpose);

    if (!consent || !isValid(consent)) {
      return { hasConsent: false };
    }

    return {
      hasConsent: true,
      consentId: consent.id,
      lawfulBasis: consent.lawfulBasis,
      grantedAt: consent.grantedAt,
      expiresAt: consent.expiresAt,
    };
  }

  /**
   * Get consent by ID
   */
  async getConsent(id: string): Promise<ServiceResult<ConsentRecord>> {
    const consent = await this.repository.findById(id);

    if (!consent) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Consent record not found' },
      };
    }

    return { success: true, data: consent };
  }

  /**
   * List consents with filtering and pagination
   */
  async listConsents(
    filter: ConsentQueryFilter
  ): Promise<{ data: ConsentRecord[]; total: number }> {
    return this.repository.findMany(filter);
  }

  /**
   * Get all consents for a subject
   */
  async getSubjectConsents(subjectId: string): Promise<ConsentRecord[]> {
    return this.repository.findBySubject(subjectId);
  }

  /**
   * Get all consents for an entity
   */
  async getEntityConsents(entityId: string): Promise<ConsentRecord[]> {
    return this.repository.findByEntity(entityId);
  }
}
