/**
 * Consent Repository Interface
 * Abstracts data access for consent records
 */

import type {
  ConsentRecord,
  ConsentQueryFilter,
  GrantConsentInput,
  ConsentStatus,
  CaptureMethod,
} from '../models/consent-record.js';

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

export interface ConsentRepository {
  /**
   * Find consent by ID
   */
  findById(id: string): Promise<ConsentRecord | null>;

  /**
   * Find consents matching filter
   */
  findMany(filter: ConsentQueryFilter): Promise<{ data: ConsentRecord[]; total: number }>;

  /**
   * Find all consents for a subject
   */
  findBySubject(subjectId: string): Promise<ConsentRecord[]>;

  /**
   * Find all consents for an entity
   */
  findByEntity(entityId: string): Promise<ConsentRecord[]>;

  /**
   * Find active consent for subject + purpose
   */
  findActiveConsent(subjectId: string, purpose: string): Promise<ConsentRecord | null>;

  /**
   * Create new consent record
   */
  create(input: GrantConsentInput): Promise<ConsentRecord>;

  /**
   * Update consent status
   */
  updateStatus(
    id: string,
    status: ConsentStatus,
    metadata?: {
      withdrawnAt?: Date | undefined;
      withdrawalReason?: string | undefined;
      withdrawalMethod?: CaptureMethod | undefined;
    }
  ): Promise<ConsentRecord>;

  /**
   * Count consents matching filter
   */
  count(filter: Omit<ConsentQueryFilter, 'limit' | 'offset'>): Promise<number>;
}
